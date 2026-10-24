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

      let targetAgg = raw.aggregation || defaultAgg;
      if (metric === 'steps') {
        targetAgg = 'interval';
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

    const dedupedMap = new Map();
    for (const row of mapped) {
      const key = `${row.memberId}:${row.provider}:${row.deviceKey}:${row.metricType}:${row.aggregation}:${row.recordedAt}`;
      dedupedMap.set(key, row);
    }
    const dedupedRows = Array.from(dedupedMap.values());
    const intraBatchDuplicates = rawRows.length - dedupedRows.length;

    let inserted = 0;
    let updated = 0;
    const batchSize = 100;

    for (let i = 0; i < dedupedRows.length; i += batchSize) {
      const chunk = dedupedRows.slice(i, i + batchSize);

      const memberIds = [];
      const providers = [];
      const deviceKeys = [];
      const sourceRecordIds = [];
      const metricTypes = [];
      const aggregations = [];
      const recordedAts = [];
      const endedAts = [];
      const values = [];
      const units = [];
      const qualityFlags = [];
      const metadatas = [];

      for (const row of chunk) {
        memberIds.push(row.memberId);
        providers.push(row.provider);
        deviceKeys.push(row.deviceKey);
        sourceRecordIds.push(row.sourceRecordId);
        metricTypes.push(row.metricType);
        aggregations.push(row.aggregation);
        recordedAts.push(row.recordedAt);
        endedAts.push(row.endedAt);
        values.push(row.value);
        units.push(row.unit);
        qualityFlags.push(row.qualityFlag || 'good');
        metadatas.push(JSON.stringify(row.metadata || {}));
      }

      const sql = `
        INSERT INTO timeseries
          (member_id, provider, device_key, source_record_id, metric_type,
           aggregation, recorded_at, ended_at, value, unit, quality_flag, metadata)
        SELECT * FROM unnest(
          $1::uuid[],
          $2::text[],
          $3::text[],
          $4::text[],
          $5::text[],
          $6::text[],
          $7::timestamptz[],
          $8::timestamptz[],
          $9::double precision[],
          $10::text[],
          $11::text[],
          $12::jsonb[]
        )
        ON CONFLICT (member_id, provider, device_key, metric_type, aggregation, recorded_at)
        DO UPDATE SET
          ended_at     = EXCLUDED.ended_at,
          value        = EXCLUDED.value,
          unit         = EXCLUDED.unit,
          quality_flag = EXCLUDED.quality_flag,
          metadata     = EXCLUDED.metadata
        WHERE (timeseries.value, timeseries.unit, timeseries.ended_at)
          IS DISTINCT FROM (EXCLUDED.value, EXCLUDED.unit, EXCLUDED.ended_at)
        RETURNING id, (xmax = 0) AS is_inserted`;

      const result = await client.query(sql, [
        memberIds,
        providers,
        deviceKeys,
        sourceRecordIds,
        metricTypes,
        aggregations,
        recordedAts,
        endedAts,
        values,
        units,
        qualityFlags,
        metadatas,
      ]);

      for (const r of result.rows) {
        if (r.is_inserted ?? true) {
          inserted++;
        } else {
          updated++;
        }
      }
    }

    const accepted = inserted + updated;
    return {
      inserted,
      updated,
      accepted,
      duplicates: intraBatchDuplicates + (dedupedRows.length - accepted),
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
