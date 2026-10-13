import { mapTimeseriesRow } from '../mappers/wearable-mapper.js';
import { getDefaultAggregation } from '../domain/metrics.js';

export class TimeseriesRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async upsertBatch(memberIdOrRows, maybeProviderOrRows, maybeRows, maybeClient) {
    let memberId = null;
    let defaultProvider = 'phone';
    let rawRows = [];
    let client = this.pool;

    if (Array.isArray(memberIdOrRows)) {
      rawRows = memberIdOrRows;
      client = maybeProviderOrRows || this.pool;
    } else if (typeof memberIdOrRows === 'string') {
      memberId = memberIdOrRows;
      if (Array.isArray(maybeProviderOrRows)) {
        rawRows = maybeProviderOrRows;
        client = maybeRows || this.pool;
      } else if (typeof maybeProviderOrRows === 'string') {
        defaultProvider = maybeProviderOrRows;
        rawRows = maybeRows || [];
        client = maybeClient || this.pool;
      }
    }

    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return { inserted: 0, updated: 0, accepted: 0, duplicates: 0 };
    }

    const mapped = [];
    for (const raw of rawRows) {
      const rowMemberId = raw.memberId || memberId;
      const rowProvider = (raw.provider || defaultProvider || 'phone').toLowerCase();
      const metric = (raw.metricType || raw.metric || raw.type || '').toLowerCase();
      const defaultAgg = getDefaultAggregation(metric) || 'instant';

      const isCumulativeMetric = ['steps', 'calories', 'distance', 'active_energy_burned'].includes(metric);
      let targetAgg = raw.aggregation || defaultAgg;
      if (isCumulativeMetric || metric === 'steps') {
        targetAgg = 'daily_total';
      }

      const mappedRow = mapTimeseriesRow(raw, rowProvider, rowMemberId, {
        deviceKey: raw.deviceKey || raw.deviceId || '',
        aggregation: targetAgg,
      });

      if (mappedRow) {
        mapped.push(mappedRow);
      }
    }

    if (mapped.length === 0) {
      return { inserted: 0, updated: 0, accepted: 0, duplicates: rawRows.length };
    }

    // 1. Intra-batch deduplication
    const dedupedMap = new Map();
    for (const row of mapped) {
      let key;
      const isCumulative = row.aggregation === 'daily_total' || ['steps', 'calories', 'distance', 'active_energy_burned'].includes(row.metricType);
      if (isCumulative) {
        const localDate = row.sourceRecordId?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || row.recordedAt.split('T')[0];
        key = `dt:${row.memberId}:${row.metricType}:${localDate}:daily_total`;
      } else if (row.sourceRecordId) {
        key = `src:${row.memberId}:${row.sourceRecordId}`;
      } else {
        key = `ts:${row.memberId}:${row.provider}:${row.deviceKey}:${row.metricType}:${row.aggregation}:${row.recordedAt}`;
      }

      if (dedupedMap.has(key)) {
        const existing = dedupedMap.get(key);
        if (isCumulative) {
          if (Number(row.value) > Number(existing.value)) {
            dedupedMap.set(key, row);
          }
        } else if (Date.parse(row.recordedAt) >= Date.parse(existing.recordedAt)) {
          dedupedMap.set(key, row);
        }
      } else {
        dedupedMap.set(key, row);
      }
    }
    const dedupedRows = Array.from(dedupedMap.values());
    const intraBatchDuplicates = rawRows.length - dedupedRows.length;

    let inserted = 0;
    let updated = 0;
    let skippedDuplicates = 0;
    const batchSize = 100;

    for (let i = 0; i < dedupedRows.length; i += batchSize) {
      const chunk = dedupedRows.slice(i, i + batchSize);

      const chunkMemberIds = Array.from(new Set(chunk.map((r) => r.memberId)));
      const chunkSourceIds = Array.from(new Set(chunk.map((r) => r.sourceRecordId).filter(Boolean)));
      const chunkDailyMetrics = Array.from(new Set(chunk.filter((r) => r.aggregation === 'daily_total').map((r) => r.metricType)));
      const chunkDailyDates = Array.from(new Set(chunk.filter((r) => r.aggregation === 'daily_total').map((r) => r.recordedAt.split('T')[0])));

      // Query database for existing rows that could match candidate rows
      const existingBySourceId = new Map();
      const existingByDailyKey = new Map();

      if (chunkSourceIds.length > 0 || chunkDailyMetrics.length > 0) {
        const existingRes = await client.query(
          `SELECT id, member_id, provider, device_key, source_record_id, metric_type, aggregation,
                  local_date::text AS local_date_str, recorded_at, ended_at, value, unit, metadata
           FROM timeseries
           WHERE member_id = ANY($1::uuid[])
             AND (
               (source_record_id IS NOT NULL AND source_record_id = ANY($2::text[]))
               OR
               (aggregation = 'daily_total' AND metric_type = ANY($3::text[]))
               OR
               (metric_type = ANY(ARRAY['steps', 'calories', 'distance', 'active_energy_burned']))
             )`,
          [chunkMemberIds, chunkSourceIds, chunkDailyMetrics]
        );

        for (const er of existingRes.rows) {
          if (er.source_record_id) {
            existingBySourceId.set(`${er.member_id}:${er.source_record_id}`, er);
          }
          const isCumul = er.aggregation === 'daily_total' || ['steps', 'calories', 'distance', 'active_energy_burned'].includes(er.metric_type);
          if (isCumul) {
            const dateStr = er.local_date_str || (er.recorded_at ? new Date(er.recorded_at).toISOString().split('T')[0] : null);
            if (dateStr) {
              existingByDailyKey.set(`${er.member_id}:${er.metric_type}:${dateStr}:daily_total`, er);
            }
          }
        }
      }

      const rowsToInsert = [];

      for (const row of chunk) {
        let matchedExisting = null;
        const isCumulative = row.aggregation === 'daily_total' || ['steps', 'calories', 'distance', 'active_energy_burned'].includes(row.metricType);
        if (isCumulative) {
          const matchDate = row.sourceRecordId?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || row.recordedAt.split('T')[0];
          const utcDate = row.recordedAt.split('T')[0];
          if (existingByDailyKey.has(`${row.memberId}:${row.metricType}:${matchDate}:daily_total`)) {
            matchedExisting = existingByDailyKey.get(`${row.memberId}:${row.metricType}:${matchDate}:daily_total`);
          } else if (existingByDailyKey.has(`${row.memberId}:${row.metricType}:${utcDate}:daily_total`)) {
            matchedExisting = existingByDailyKey.get(`${row.memberId}:${row.metricType}:${utcDate}:daily_total`);
          } else if (row.sourceRecordId && existingBySourceId.has(`${row.memberId}:${row.sourceRecordId}`)) {
            matchedExisting = existingBySourceId.get(`${row.memberId}:${row.sourceRecordId}`);
          }
        } else if (row.sourceRecordId && existingBySourceId.has(`${row.memberId}:${row.sourceRecordId}`)) {
          matchedExisting = existingBySourceId.get(`${row.memberId}:${row.sourceRecordId}`);
        }

        if (matchedExisting) {
          const isSameValue = Math.abs(Number(matchedExisting.value) - Number(row.value)) < 0.0001;
          if (isSameValue) {
            // STOP! Incoming data is identical to existing/previous sync data
            skippedDuplicates++;
            continue;
          }

          // Cumulative daily metrics (steps, calories, distance, active energy burned):
          // Choose the most accurate/highest valid total among all connected devices (e.g. 1900 over 1500, never summed).
          // NEVER downgrade a higher valid reading from a smartwatch with a lower phone count.
          const isCumulative = row.aggregation === 'daily_total' || ['steps', 'calories', 'distance', 'active_energy_burned'].includes(row.metricType);
          if (isCumulative && Number(row.value) <= Number(matchedExisting.value)) {
            skippedDuplicates++;
            continue;
          }

          // Value has improved: Update existing record in-place
          await client.query(
            `UPDATE timeseries
             SET value = $1,
                 provider = $2,
                 device_key = $3,
                 recorded_at = $4,
                 ended_at = $5,
                 source_record_id = COALESCE($6, source_record_id),
                 quality_flag = $7,
                 metadata = $8
             WHERE id = $9`,
            [
              row.value,
              row.provider,
              row.deviceKey,
              row.recordedAt,
              row.endedAt,
              row.sourceRecordId,
              row.qualityFlag || 'good',
              JSON.stringify(row.metadata || {}),
              matchedExisting.id,
            ]
          );
          updated++;
          matchedExisting.value = row.value;
          continue;
        }

        rowsToInsert.push(row);
      }

      if (rowsToInsert.length === 0) {
        continue;
      }

      // Insert new rows with savepoint protection against race conditions
      for (const row of rowsToInsert) {
        let savepointActive = false;
        try {
          await client.query('SAVEPOINT ts_ins_savepoint');
          savepointActive = true;
        } catch {}

        try {
          const res = await client.query(
            `INSERT INTO timeseries
               (member_id, provider, device_key, source_record_id, metric_type,
                aggregation, recorded_at, ended_at, value, unit, quality_flag, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (member_id, provider, device_key, metric_type, aggregation, recorded_at)
             DO UPDATE SET
               ended_at     = EXCLUDED.ended_at,
               value        = CASE
                                WHEN timeseries.aggregation = 'daily_total' AND timeseries.metric_type IN ('steps', 'calories', 'distance', 'active_energy_burned')
                                  THEN GREATEST(timeseries.value, EXCLUDED.value)
                                ELSE EXCLUDED.value
                              END,
               unit         = EXCLUDED.unit,
               quality_flag = EXCLUDED.quality_flag,
               metadata     = EXCLUDED.metadata
             WHERE (timeseries.value, timeseries.unit, timeseries.ended_at)
               IS DISTINCT FROM (EXCLUDED.value, EXCLUDED.unit, EXCLUDED.ended_at)
             RETURNING id, (xmax = 0) AS is_inserted`,
            [
              row.memberId,
              row.provider,
              row.deviceKey,
              row.sourceRecordId,
              row.metricType,
              row.aggregation,
              row.recordedAt,
              row.endedAt,
              row.value,
              row.unit,
              row.qualityFlag || 'good',
              JSON.stringify(row.metadata || {}),
            ]
          );

          if (savepointActive) {
            await client.query('RELEASE SAVEPOINT ts_ins_savepoint').catch(() => {});
          }

          if (res.rows[0]?.is_inserted ?? true) {
            inserted++;
          } else {
            updated++;
          }
        } catch (err) {
          if (savepointActive) {
            await client.query('ROLLBACK TO SAVEPOINT ts_ins_savepoint').catch(() => {});
          }
          if (err.code === '23505') {
            // Concurrent race duplicate caught by database unique index
            skippedDuplicates++;
          } else {
            throw err;
          }
        }
      }
    }

    const accepted = inserted + updated;
    return {
      inserted,
      updated,
      accepted,
      duplicates: intraBatchDuplicates + skippedDuplicates,
    };
  }

  async listSamples(memberId, from, to, client = this.pool) {
    const result = await client.query(
      `SELECT
         metric_type      AS metric,
         recorded_at      AS "recordedAt",
         ended_at         AS "endedAt",
         local_date       AS "localDate",
         value,
         unit,
         provider,
         device_key       AS "deviceKey",
         aggregation,
         source_record_id AS "externalId"
       FROM timeseries
       WHERE member_id = $1
         AND ($2::timestamptz IS NULL OR recorded_at >= $2)
         AND ($3::timestamptz IS NULL OR recorded_at <= $3)
       ORDER BY recorded_at DESC`,
      [memberId, from ?? null, to ?? null],
    );
    return result.rows;
  }
}
