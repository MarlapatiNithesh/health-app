import { DEVICE_TIERS } from '../domain/reconciliation.js';
import {
  mapWorkout,
  mapSleepSession,
  mapWomensHealth,
  mapHealthScore,
  mapTimeseriesRow,
} from '../mappers/wearable-mapper.js';

import { TimeseriesRepository } from './timeseries-repository.js';

export class WearableRepository {
  constructor(pool, { timeseriesRepo = null } = {}) {
    this.pool = pool;
    this.timeseriesRepo = timeseriesRepo || new TimeseriesRepository(pool);
  }

  async listWearableDevices(memberId, client = this.pool) {
    const result = await client.query(
      `SELECT
         id,
         member_id        AS "memberId",
         provider         AS brand,
         connection_type  AS "connectionType",
         status,
         (status IN ('connected', 'syncing')) AS connected,
         model,
         battery_pct      AS "batteryPct",
         metrics_provided AS "metricsProvided",
         metadata,
         sync_cursor      AS "syncCursor",
         connected_at     AS "connectedAt",
         disconnected_at  AS "disconnectedAt",
         last_sync_at     AS "lastSyncAt",
         last_data_at     AS "lastDataAt",
         error_detail     AS "errorDetail",
         created_at       AS "createdAt",
         updated_at       AS "updatedAt"
       FROM wearable_links
       WHERE member_id = $1
         AND provider NOT IN ('apple_health','health_connect')
       ORDER BY created_at DESC`,
      [memberId],
    );

    return result.rows.map((r) => ({
      ...r,
      deviceTier: DEVICE_TIERS[r.brand] ?? 4,
      metricsProvided: r.metricsProvided ?? [],
      model: r.model ?? null,
      batteryPct: r.batteryPct ?? null,
    }));
  }

  async listWearableLinks(memberId, client = this.pool) {
    const result = await client.query(
      `SELECT
         id,
         member_id        AS "memberId",
         provider,
         provider         AS brand,
         connection_type  AS "connectionType",
         status,
         (status IN ('connected', 'syncing')) AS connected,
         model,
         battery_pct      AS "batteryPct",
         metrics_provided AS "metricsProvided",
         metadata,
         sync_cursor      AS "syncCursor",
         connected_at     AS "connectedAt",
         disconnected_at  AS "disconnectedAt",
         last_sync_at     AS "lastSyncAt",
         last_data_at     AS "lastDataAt",
         error_detail     AS "errorDetail",
         created_at       AS "createdAt",
         updated_at       AS "updatedAt"
       FROM wearable_links
       WHERE member_id = $1
       ORDER BY created_at DESC`,
      [memberId],
    );

    return result.rows.map((r) => ({
      ...r,
      deviceTier: DEVICE_TIERS[r.provider] ?? 4,
      metricsProvided: r.metricsProvided ?? [],
      model: r.model ?? null,
      batteryPct: r.batteryPct ?? null,
    }));
  }

  async createWearableDevice(memberId, input, client = this.pool) {
    const status = input.status || (input.connected !== false ? 'connected' : 'disconnected');
    const brand = (input.brand || input.provider || '').toLowerCase();
    const connectionType = input.connectionType || 'oauth';
    const model = input.model ?? null;
    const batteryPct = input.batteryPct != null ? Number(input.batteryPct) : null;
    const metricsProvided = Array.isArray(input.metricsProvided) ? input.metricsProvided : [];
    const metadata = input.metadata && typeof input.metadata === 'object' ? input.metadata : {};

    const result = await client.query(
      `INSERT INTO wearable_links
         (member_id, provider, connection_type, status, model, battery_pct,
          metrics_provided, metadata, connected_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8,
          CASE WHEN $4 IN ('connected','syncing') THEN now() ELSE NULL END)
       ON CONFLICT (member_id, provider) DO UPDATE SET
         connection_type  = COALESCE(EXCLUDED.connection_type, wearable_links.connection_type),
         status           = EXCLUDED.status,
         model            = COALESCE(EXCLUDED.model, wearable_links.model),
         battery_pct      = COALESCE(EXCLUDED.battery_pct, wearable_links.battery_pct),
         metrics_provided = CASE WHEN array_length(EXCLUDED.metrics_provided, 1) > 0 THEN EXCLUDED.metrics_provided ELSE wearable_links.metrics_provided END,
         metadata         = wearable_links.metadata || EXCLUDED.metadata,
         connected_at     = CASE WHEN EXCLUDED.status IN ('connected','syncing') THEN now() ELSE wearable_links.connected_at END,
         updated_at       = now()
       RETURNING
         id,
         member_id        AS "memberId",
         provider         AS brand,
         connection_type  AS "connectionType",
         status,
         (status IN ('connected', 'syncing')) AS connected,
         model,
         battery_pct      AS "batteryPct",
         metrics_provided AS "metricsProvided",
         metadata,
         last_sync_at     AS "lastSyncAt",
         created_at       AS "createdAt",
         updated_at       AS "updatedAt"`,
      [memberId, brand, connectionType, status, model, batteryPct, metricsProvided, JSON.stringify(metadata)],
    );

    const row = result.rows[0];
    return {
      ...row,
      deviceTier: DEVICE_TIERS[row.brand] ?? 4,
      metricsProvided: row.metricsProvided ?? [],
      model: row.model ?? null,
      batteryPct: row.batteryPct ?? null,
    };
  }

  async getWearableDevice(memberId, deviceId, client = this.pool) {
    const result = await client.query(
      `SELECT
         id,
         member_id        AS "memberId",
         provider         AS brand,
         connection_type  AS "connectionType",
         status,
         (status IN ('connected', 'syncing')) AS connected,
         model,
         battery_pct      AS "batteryPct",
         metrics_provided AS "metricsProvided",
         metadata,
         last_sync_at     AS "lastSyncAt",
         error_detail     AS "errorDetail",
         created_at       AS "createdAt",
         updated_at       AS "updatedAt"
       FROM wearable_links
       WHERE member_id = $1 AND id = $2
         AND provider NOT IN ('apple_health','health_connect')`,
      [memberId, deviceId],
    );

    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      ...row,
      deviceTier: DEVICE_TIERS[row.brand] ?? 4,
      metricsProvided: row.metricsProvided ?? [],
      model: row.model ?? null,
      batteryPct: row.batteryPct ?? null,
    };
  }

  async getOrCreateDeviceForBrand(memberId, brand, client = this.pool) {
    const provider = String(brand).toLowerCase();
    const result = await client.query(
      `INSERT INTO wearable_links (member_id, provider, connection_type, status, connected_at, last_sync_at)
       VALUES ($1, $2, 'oauth', 'connected', now(), now())
       ON CONFLICT (member_id, provider) DO UPDATE SET
         status       = CASE WHEN wearable_links.status = 'disconnected' THEN wearable_links.status ELSE 'connected' END,
         last_sync_at = now(),
         updated_at   = now()
       RETURNING id`,
      [memberId, provider],
    );
    return result.rows[0].id;
  }

  async updateWearableDevice(memberId, deviceId, patch, client = this.pool) {
    const fields = [];
    const values = [memberId, deviceId];
    let idx = 3;

    if (patch.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(patch.status);
    } else if (patch.connected !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(patch.connected ? 'connected' : 'disconnected');
    }

    if (patch.model !== undefined) {
      fields.push(`model = $${idx++}`);
      values.push(patch.model);
    }
    if (patch.batteryPct !== undefined) {
      fields.push(`battery_pct = $${idx++}`);
      values.push(patch.batteryPct);
    }
    if (patch.metricsProvided !== undefined) {
      fields.push(`metrics_provided = $${idx++}`);
      values.push(patch.metricsProvided);
    }
    if (patch.metadata !== undefined) {
      fields.push(`metadata = wearable_links.metadata || $${idx++}::jsonb`);
      values.push(JSON.stringify(patch.metadata));
    }
    if (patch.lastSyncAt !== undefined) {
      fields.push(`last_sync_at = $${idx++}`);
      values.push(patch.lastSyncAt);
    }
    if (patch.errorDetail !== undefined) {
      fields.push(`error_detail = $${idx++}`);
      values.push(patch.errorDetail);
    }

    fields.push('updated_at = now()');

    const result = await client.query(
      `UPDATE wearable_links
       SET ${fields.join(', ')}
       WHERE member_id = $1 AND id = $2
       RETURNING
         id,
         member_id    AS "memberId",
         provider     AS brand,
         status,
         (status IN ('connected', 'syncing')) AS connected,
         model,
         battery_pct  AS "batteryPct",
         last_sync_at AS "lastSyncAt",
         updated_at   AS "updatedAt"`,
      values,
    );
    return result.rows[0] ?? null;
  }

  async deleteWearableDevice(memberId, deviceId, client = this.pool) {
    await client.query(
      `UPDATE wearable_links
       SET status = 'disconnected', disconnected_at = now(), updated_at = now()
       WHERE member_id = $1 AND id = $2`,
      [memberId, deviceId],
    );
  }

  async getWearableSyncResponse(memberId, idempotencyKey, client = this.pool) {
    if (!idempotencyKey) return null;
    const result = await client.query(
      `SELECT response FROM sync_logs
       WHERE member_id = $1 AND idempotency_key = $2
       LIMIT 1`,
      [memberId, idempotencyKey],
    );
    return result.rows[0]?.response ?? null;
  }

  async claimWearableSync(memberId, deviceId, idempotencyKey, receivedCount, noData, client = this.pool) {
    if (!idempotencyKey) return true;

    let provider = 'wearable';
    if (deviceId) {
      const link = await client.query(
        `SELECT provider FROM wearable_links WHERE id = $1`,
        [deviceId],
      );
      if (link.rows[0]?.provider) provider = link.rows[0].provider;
    }

    const claimed = await client.query(
      `INSERT INTO sync_logs
         (member_id, provider, data_type, source, idempotency_key,
          records_read, records_saved, status)
       VALUES ($1, $2, 'timeseries', 'phone', $3, $4, 0, 'pending')
       ON CONFLICT (member_id, idempotency_key)
       DO UPDATE SET status = 'pending', updated_at = now()
       WHERE sync_logs.status IN ('failed', 'pending')
         AND sync_logs.updated_at < now() - interval '2 minutes'
       RETURNING id`,
      [memberId, provider, idempotencyKey, receivedCount],
    );
    return claimed.rowCount > 0;
  }

  async completeWearableSync(memberId, idempotencyKey, acceptedCount, duplicateCount, responsePayload, client = this.pool) {
    if (!idempotencyKey) return;
    await client.query(
      `UPDATE sync_logs
       SET records_saved = $2,
           status        = 'success',
           response      = $3::jsonb,
           completed_at  = now(),
           updated_at    = now()
       WHERE member_id = $4 AND idempotency_key = $1`,
      [idempotencyKey, acceptedCount, JSON.stringify(responsePayload), memberId],
    );
  }

  async failWearableSync(memberId, idempotencyKey, errorMessage, client = this.pool) {
    if (!idempotencyKey) return;
    await client.query(
      `UPDATE sync_logs
       SET status        = 'failed',
           error_message = $3,
           updated_at    = now()
       WHERE member_id = $1 AND idempotency_key = $2`,
      [memberId, idempotencyKey, errorMessage],
    );
  }

  async upsertWearableLink(memberId, {
    provider,
    connectionType = null,
    status = 'connected',
    model = null,
    batteryPct = null,
    metricsProvided = [],
    metadata = {},
    syncCursor = null,
    errorDetail = null,
    force = false,
    externalUserId = null,
  } = {}, client = this.pool, opts = {}) {
    const prov = String(provider).toLowerCase();
    const isForce = Boolean(opts?.force || force);
    const connType = connectionType || 'oauth';
    const mergedMetadata = {
      ...(metadata && typeof metadata === 'object' ? metadata : {}),
      ...(externalUserId ? { external_user_id: externalUserId, externalUserId } : {}),
    };

    const result = await client.query(
      `INSERT INTO wearable_links
         (member_id, provider, connection_type, status, model, battery_pct,
          metrics_provided, metadata, sync_cursor, error_detail,
          connected_at, disconnected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
               CASE WHEN $4 IN ('connected','syncing') THEN now() ELSE NULL END,
               CASE WHEN $4 = 'disconnected' THEN now() ELSE NULL END)
       ON CONFLICT (member_id, provider) DO UPDATE SET
         connection_type  = COALESCE($11, wearable_links.connection_type),
         status           = CASE
                              WHEN wearable_links.status = 'disconnected' AND EXCLUDED.status IN ('connected','syncing') AND NOT $12
                                THEN wearable_links.status
                              ELSE EXCLUDED.status
                            END,
         model            = COALESCE(EXCLUDED.model, wearable_links.model),
         battery_pct      = COALESCE(EXCLUDED.battery_pct, wearable_links.battery_pct),
         metrics_provided = CASE WHEN array_length(EXCLUDED.metrics_provided, 1) > 0 THEN EXCLUDED.metrics_provided ELSE wearable_links.metrics_provided END,
         metadata         = wearable_links.metadata || EXCLUDED.metadata,
         sync_cursor      = COALESCE(EXCLUDED.sync_cursor, wearable_links.sync_cursor),
         error_detail     = EXCLUDED.error_detail,
         connected_at     = CASE
                              WHEN EXCLUDED.status IN ('connected','syncing') AND (wearable_links.status != 'disconnected' OR $12)
                                THEN COALESCE(wearable_links.connected_at, now())
                              ELSE wearable_links.connected_at
                            END,
         disconnected_at  = CASE
                              WHEN EXCLUDED.status = 'disconnected'
                                THEN COALESCE(wearable_links.disconnected_at, now())
                              WHEN EXCLUDED.status IN ('connected','syncing') AND (wearable_links.status != 'disconnected' OR $12)
                                THEN NULL
                              ELSE wearable_links.disconnected_at
                            END,
         updated_at       = now()
       RETURNING
         id,
         member_id        AS "memberId",
         provider,
         connection_type  AS "connectionType",
         status,
         model,
         battery_pct      AS "batteryPct",
         metrics_provided AS "metricsProvided",
         metadata,
         sync_cursor      AS "syncCursor",
         connected_at     AS "connectedAt",
         disconnected_at  AS "disconnectedAt",
         last_sync_at     AS "lastSyncAt",
         last_data_at     AS "lastDataAt",
         error_detail     AS "errorDetail",
         created_at       AS "createdAt",
         updated_at       AS "updatedAt"`,
      [
        memberId,
        prov,
        connType,
        status,
        model,
        batteryPct,
        metricsProvided,
        JSON.stringify(mergedMetadata),
        syncCursor,
        errorDetail,
        connectionType,
        isForce,
      ],
    );
    return result.rows[0];
  }

  async setWearableLinkStatus(memberId, provider, status, errorDetail = null, client = this.pool, opts = {}) {
    const prov = String(provider).toLowerCase();
    const isDisconnected = status === 'disconnected';
    const isConnected = status === 'connected';
    const isForce = Boolean(opts?.force);

    await client.query(
      `UPDATE wearable_links
       SET status          = CASE
                               WHEN status = 'disconnected' AND $3 IN ('connected', 'syncing') AND NOT $7 THEN status
                               ELSE $3
                             END,
           error_detail    = $4,
           disconnected_at = CASE
                               WHEN $5 THEN now()
                               WHEN $6 AND (status != 'disconnected' OR $7) THEN NULL
                               ELSE disconnected_at
                             END,
           connected_at    = CASE
                               WHEN $6 AND (status != 'disconnected' OR $7) THEN COALESCE(connected_at, now())
                               ELSE connected_at
                             END,
           updated_at      = now()
       WHERE member_id = $1 AND provider = $2`,
      [memberId, prov, status, errorDetail, isDisconnected, isConnected, isForce],
    );
  }

  async getWearableLink(memberId, provider, client = this.pool) {
    const prov = String(provider).toLowerCase();
    const result = await client.query(
      `SELECT
         id,
         member_id        AS "memberId",
         provider,
         connection_type  AS "connectionType",
         status,
         model,
         battery_pct      AS "batteryPct",
         metrics_provided AS "metricsProvided",
         metadata,
         sync_cursor      AS "syncCursor",
         connected_at     AS "connectedAt",
         disconnected_at  AS "disconnectedAt",
         last_sync_at     AS "lastSyncAt",
         last_data_at     AS "lastDataAt",
         error_detail     AS "errorDetail",
         created_at       AS "createdAt",
         updated_at       AS "updatedAt"
       FROM wearable_links
       WHERE member_id = $1 AND provider = $2`,
      [memberId, prov],
    );
    return result.rows[0] ?? null;
  }

  async listWearableLinks(memberId, client = this.pool) {
    const result = await client.query(
      `SELECT
         id,
         member_id        AS "memberId",
         provider,
         connection_type  AS "connectionType",
         status,
         model,
         battery_pct      AS "batteryPct",
         metrics_provided AS "metricsProvided",
         metadata,
         sync_cursor      AS "syncCursor",
         connected_at     AS "connectedAt",
         disconnected_at  AS "disconnectedAt",
         last_sync_at     AS "lastSyncAt",
         last_data_at     AS "lastDataAt",
         error_detail     AS "errorDetail",
         created_at       AS "createdAt",
         updated_at       AS "updatedAt"
       FROM wearable_links
       WHERE member_id = $1
       ORDER BY created_at`,
      [memberId],
    );
    return result.rows;
  }

  async touchLastData(memberId, provider, client = this.pool) {
    if (!memberId || !provider) return;
    await client.query(
      `UPDATE wearable_links
       SET last_data_at = now(), updated_at = now()
       WHERE member_id = $1 AND provider = $2 AND status != 'disconnected'`,
      [memberId, provider.toLowerCase()],
    );
  }

  async insertTimeseries(memberId, raw, client = this.pool) {
    const provider = (raw.provider || 'wearable').toLowerCase();
    const res = await this.timeseriesRepo.upsertBatch(memberId, provider, [raw], client);
    if (res.accepted > 0) {
      await this.touchLastData(memberId, provider, client);
    }
    return res.accepted;
  }

  async insertTimeseriesBatch(memberId, provider, rows, client = this.pool) {
    if (!Array.isArray(rows) || rows.length === 0) return 0;
    const res = await this.timeseriesRepo.upsertBatch(memberId, provider, rows, client);
    if (res.accepted > 0) {
      await this.touchLastData(memberId, provider, client);
    }
    return res.accepted;
  }

  async insertWorkout(memberId, provider, raw, client = this.pool) {
    const w = mapWorkout(raw, provider, memberId);
    if (!w) return 0;

    const result = await client.query(
      `INSERT INTO workouts
         (member_id, provider, source_record_id, activity_type, label,
          started_at, ended_at, duration_secs, moving_time_secs,
          distance_m, steps_count, energy_burned_kcal,
          heart_rate_avg, heart_rate_max, heart_rate_min,
          average_speed, max_speed, average_cadence, average_watts, max_watts,
          total_elevation_gain, elev_high, elev_low,
          intensity, entry_source, hr_zones, power_zones, segments, metadata)
       VALUES
         ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
       ON CONFLICT (member_id, provider, source_record_id)
       DO UPDATE SET
         activity_type        = EXCLUDED.activity_type,
         label                = EXCLUDED.label,
         started_at           = EXCLUDED.started_at,
         ended_at             = EXCLUDED.ended_at,
         duration_secs        = EXCLUDED.duration_secs,
         moving_time_secs     = EXCLUDED.moving_time_secs,
         distance_m           = EXCLUDED.distance_m,
         steps_count          = EXCLUDED.steps_count,
         energy_burned_kcal   = EXCLUDED.energy_burned_kcal,
         heart_rate_avg       = EXCLUDED.heart_rate_avg,
         heart_rate_max       = EXCLUDED.heart_rate_max,
         heart_rate_min       = EXCLUDED.heart_rate_min,
         average_speed        = EXCLUDED.average_speed,
         max_speed            = EXCLUDED.max_speed,
         average_cadence      = EXCLUDED.average_cadence,
         average_watts        = EXCLUDED.average_watts,
         max_watts            = EXCLUDED.max_watts,
         total_elevation_gain = EXCLUDED.total_elevation_gain,
         elev_high            = EXCLUDED.elev_high,
         elev_low             = EXCLUDED.elev_low,
         intensity            = EXCLUDED.intensity,
         entry_source         = EXCLUDED.entry_source,
         hr_zones             = EXCLUDED.hr_zones,
         power_zones          = EXCLUDED.power_zones,
         segments             = EXCLUDED.segments,
         metadata             = EXCLUDED.metadata,
         updated_at           = now()
       RETURNING id`,
      [
        w.memberId,
        w.provider,
        w.sourceRecordId,
        w.activityType,
        w.label,
        w.startedAt,
        w.endedAt,
        w.durationSecs,
        w.movingTimeSecs,
        w.distanceM,
        w.stepsCount,
        w.energyBurnedKcal,
        w.heartRateAvg,
        w.heartRateMax,
        w.heartRateMin,
        w.averageSpeed,
        w.maxSpeed,
        w.averageCadence,
        w.averageWatts,
        w.maxWatts,
        w.totalElevationGain,
        w.elevHigh,
        w.elevLow,
        w.intensity,
        w.entrySource,
        JSON.stringify(w.hrZones),
        JSON.stringify(w.powerZones),
        JSON.stringify(w.segments),
        JSON.stringify(w.metadata),
      ],
    );

    if (result.rowCount > 0) {
      await client.query(
        `UPDATE wearable_links
         SET last_data_at = now()
         WHERE member_id = $1 AND provider = $2 AND status != 'disconnected'`,
        [memberId, provider],
      ).catch(() => {});
    }

    return result.rowCount;
  }

  async insertSleepSession(memberId, provider, raw, client = this.pool) {
    const s = mapSleepSession(raw, provider, memberId);
    if (!s) return 0;

    const result = await client.query(
      `INSERT INTO sleep_sessions
         (member_id, provider, source_record_id,
          started_at, ended_at,
          sleep_total_duration_mins, sleep_time_in_bed_minutes,
          sleep_rem_minutes, sleep_deep_minutes, sleep_light_minutes, sleep_awake_minutes,
          sleep_efficiency_score, is_nap, sleep_stages, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (member_id, provider, source_record_id)
       DO UPDATE SET
         started_at                = EXCLUDED.started_at,
         ended_at                  = EXCLUDED.ended_at,
         sleep_total_duration_mins = EXCLUDED.sleep_total_duration_mins,
         sleep_time_in_bed_minutes = EXCLUDED.sleep_time_in_bed_minutes,
         sleep_rem_minutes         = EXCLUDED.sleep_rem_minutes,
         sleep_deep_minutes        = EXCLUDED.sleep_deep_minutes,
         sleep_light_minutes       = EXCLUDED.sleep_light_minutes,
         sleep_awake_minutes       = EXCLUDED.sleep_awake_minutes,
         sleep_efficiency_score    = EXCLUDED.sleep_efficiency_score,
         is_nap                    = EXCLUDED.is_nap,
         sleep_stages              = EXCLUDED.sleep_stages,
         metadata                  = EXCLUDED.metadata,
         updated_at                = now()
       RETURNING id`,
      [
        s.memberId,
        s.provider,
        s.sourceRecordId,
        s.startedAt,
        s.endedAt,
        s.sleepTotalDurationMins,
        s.sleepTimeInBedMinutes,
        s.sleepRemMinutes,
        s.sleepDeepMinutes,
        s.sleepLightMinutes,
        s.sleepAwakeMinutes,
        s.sleepEfficiencyScore,
        s.isNap,
        JSON.stringify(s.sleepStages),
        JSON.stringify(s.metadata),
      ],
    );

    if (result.rowCount > 0) {
      await client.query(
        `UPDATE wearable_links
         SET last_data_at = now()
         WHERE member_id = $1 AND provider = $2 AND status != 'disconnected'`,
        [memberId, provider],
      ).catch(() => {});
    }

    return result.rowCount;
  }

  async insertWomensHealth(memberId, provider, raw, client = this.pool) {
    const w = mapWomensHealth(raw, provider, memberId);
    if (!w) return 0;

    const result = await client.query(
      `INSERT INTO womens_health
         (member_id, provider, source_record_id,
          current_phase, current_phase_type,
          cycle_length, day_in_cycle, period_length,
          days_until_next_phase, length_of_current_phase,
          predicted_cycle_length, is_predicted_cycle,
          has_specified_cycle_length, has_specified_period_length,
          fertile_window_start, length_of_fertile_window,
          last_updated_at, pregnancy_snapshot, metadata, recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (member_id, provider, source_record_id)
       DO UPDATE SET
         current_phase               = EXCLUDED.current_phase,
         current_phase_type          = EXCLUDED.current_phase_type,
         cycle_length                = EXCLUDED.cycle_length,
         day_in_cycle                = EXCLUDED.day_in_cycle,
         period_length               = EXCLUDED.period_length,
         days_until_next_phase       = EXCLUDED.days_until_next_phase,
         length_of_current_phase     = EXCLUDED.length_of_current_phase,
         predicted_cycle_length      = EXCLUDED.predicted_cycle_length,
         is_predicted_cycle          = EXCLUDED.is_predicted_cycle,
         has_specified_cycle_length  = EXCLUDED.has_specified_cycle_length,
         has_specified_period_length = EXCLUDED.has_specified_period_length,
         fertile_window_start        = EXCLUDED.fertile_window_start,
         length_of_fertile_window    = EXCLUDED.length_of_fertile_window,
         last_updated_at             = EXCLUDED.last_updated_at,
         pregnancy_snapshot          = EXCLUDED.pregnancy_snapshot,
         metadata                    = EXCLUDED.metadata,
         recorded_at                 = EXCLUDED.recorded_at,
         updated_at                  = now()
       RETURNING id`,
      [
        w.memberId,
        w.provider,
        w.sourceRecordId,
        w.currentPhase,
        w.currentPhaseType,
        w.cycleLength,
        w.dayInCycle,
        w.periodLength,
        w.daysUntilNextPhase,
        w.lengthOfCurrentPhase,
        w.predictedCycleLength,
        w.isPredictedCycle,
        w.hasSpecifiedCycleLength,
        w.hasSpecifiedPeriodLength,
        w.fertileWindowStart,
        w.lengthOfFertileWindow,
        w.lastUpdatedAt,
        JSON.stringify(w.pregnancySnapshot),
        JSON.stringify(w.metadata),
        w.recordedAt,
      ],
    );

    if (result.rowCount > 0) {
      await client.query(
        `UPDATE wearable_links
         SET last_data_at = now()
         WHERE member_id = $1 AND provider = $2 AND status != 'disconnected'`,
        [memberId, provider],
      ).catch(() => {});
    }

    return result.rowCount;
  }

  async insertHealthScore(memberId, provider, raw, client = this.pool) {
    const s = mapHealthScore(raw, provider, memberId, raw.scoreType || 'overall');
    if (!s) return 0;

    const result = await client.query(
      `INSERT INTO health_scores
         (member_id, provider, source_record_id, score_type, score, qualifier, components, trend, calculated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (member_id, provider, score_type, calculated_at)
       DO UPDATE SET
         score      = EXCLUDED.score,
         qualifier  = EXCLUDED.qualifier,
         components = EXCLUDED.components,
         trend      = EXCLUDED.trend,
         updated_at = now()
       RETURNING id`,
      [
        s.memberId,
        s.provider,
        s.sourceRecordId,
        s.scoreType,
        s.score,
        s.qualifier,
        JSON.stringify(s.components),
        s.trend,
        s.calculatedAt,
      ],
    );

    if (result.rowCount > 0) {
      await client.query(
        `UPDATE wearable_links
         SET last_data_at = now()
         WHERE member_id = $1 AND provider = $2 AND status != 'disconnected'`,
        [memberId, provider],
      ).catch(() => {});
    }

    return result.rowCount;
  }

  async logSync(memberId, {
    provider,
    dataType,
    source = 'poll',
    eventType = null,
    idempotencyKey = null,
    batchId = null,
    recordsRead = 0,
    recordsSaved = 0,
    status = 'pending',
    errorMessage = null,
    durationMs = null,
    response = null,
    rawPayload = null,
    retryCount = 0,
    nextRetryAt = null,
  } = {}, client = this.pool) {
    const result = await client.query(
      `INSERT INTO sync_logs
         (member_id, provider, data_type, source, event_type, idempotency_key,
          batch_id, records_read, records_saved, status, error_message, duration_ms,
          response, raw_payload, retry_count, next_retry_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
               CASE WHEN $10 IN ('success', 'failed', 'dead') THEN now() ELSE NULL END)
       RETURNING id`,
      [
        memberId,
        provider,
        dataType,
        source,
        eventType,
        idempotencyKey,
        batchId,
        recordsRead,
        recordsSaved,
        status,
        errorMessage,
        durationMs,
        response ? JSON.stringify(response) : null,
        rawPayload ? JSON.stringify(rawPayload) : null,
        retryCount,
        nextRetryAt,
      ],
    );
    return result.rows[0]?.id;
  }

  async completeSyncLog(syncLogId, recordsSaved = 0, status = 'success', errorMessage = null, durationMs = null, client = this.pool) {
    if (!syncLogId) return;
    await client.query(
      `UPDATE sync_logs
       SET records_saved = $2,
           status        = $3,
           error_message = $4,
           duration_ms   = $5,
           completed_at  = now(),
           updated_at    = now()
       WHERE id = $1`,
      [syncLogId, recordsSaved, status, errorMessage, durationMs],
    );
  }

  async purgeOldSyncPayloads(days = 30, client = this.pool) {
    const result = await client.query(
      `UPDATE sync_logs
       SET raw_payload = NULL
       WHERE status = 'success'
         AND raw_payload IS NOT NULL
         AND created_at < now() - ($1 || ' days')::interval`,
      [days],
    );
    return result.rowCount;
  }

  async getRecentSyncLogs(memberId, { provider = null, dataType = null, limit = 50 } = {}, client = this.pool) {
    const conditions = ['member_id = $1'];
    const values = [memberId];
    let idx = 2;
    if (provider) { conditions.push(`provider = $${idx++}`); values.push(provider); }
    if (dataType) { conditions.push(`data_type = $${idx++}`); values.push(dataType); }
    values.push(Math.min(Math.max(Number(limit) || 50, 1), 200));

    const result = await client.query(
      `SELECT
         id, provider, data_type AS "dataType", source, event_type AS "eventType",
         records_read AS "recordsRead", records_saved AS "recordsSaved",
         status, error_message AS "errorMessage",
         duration_ms AS "durationMs", retry_count AS "retryCount",
         completed_at AS "completedAt", created_at AS "createdAt"
       FROM sync_logs
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${idx}`,
      values,
    );
    return result.rows;
  }

  async listTimeseries(memberId, { metricType = null, provider = null, from = null, to = null, limit = 500 } = {}, client = this.pool) {
    const conditions = ['member_id = $1'];
    const values = [memberId];
    let idx = 2;
    if (metricType) { conditions.push(`metric_type = $${idx++}`); values.push(metricType); }
    if (provider) { conditions.push(`provider = $${idx++}`); values.push(provider); }
    if (from) { conditions.push(`recorded_at >= $${idx++}`); values.push(from); }
    if (to) { conditions.push(`recorded_at <= $${idx++}`); values.push(to); }
    values.push(Math.min(Math.max(Number(limit) || 500, 1), 1000));

    const result = await client.query(
      `SELECT
         metric_type AS "metricType", recorded_at AS "recordedAt",
         ended_at AS "endedAt", local_date AS "localDate",
         value, unit, provider, device_key AS "deviceKey",
         aggregation, source_record_id AS "sourceRecordId",
         quality_flag AS "qualityFlag", metadata
       FROM timeseries
       WHERE ${conditions.join(' AND ')}
       ORDER BY recorded_at DESC
       LIMIT $${idx}`,
      values,
    );
    return result.rows;
  }

  async listWorkouts(memberId, { from = null, to = null, activityType = null, limit = 50 } = {}, client = this.pool) {
    const conditions = ['member_id = $1'];
    const values = [memberId];
    let idx = 2;
    if (from) { conditions.push(`started_at >= $${idx++}`); values.push(from); }
    if (to) { conditions.push(`started_at <= $${idx++}`); values.push(to); }
    if (activityType) { conditions.push(`activity_type = $${idx++}`); values.push(activityType); }
    values.push(Math.min(Math.max(Number(limit) || 50, 1), 200));

    const result = await client.query(
      `SELECT
         id, provider, source_record_id AS "sourceRecordId",
         activity_type AS "activityType", label,
         started_at AS "startedAt", ended_at AS "endedAt",
         duration_secs AS "durationSecs", moving_time_secs AS "movingTimeSecs",
         distance_m AS "distanceM", steps_count AS "stepsCount",
         energy_burned_kcal AS "energyBurnedKcal",
         heart_rate_avg AS "heartRateAvg", heart_rate_max AS "heartRateMax", heart_rate_min AS "heartRateMin",
         average_speed AS "averageSpeed", max_speed AS "maxSpeed",
         average_cadence AS "averageCadence", average_watts AS "averageWatts", max_watts AS "maxWatts",
         total_elevation_gain AS "totalElevationGain", intensity,
         created_at AS "createdAt"
       FROM workouts
       WHERE ${conditions.join(' AND ')}
       ORDER BY started_at DESC
       LIMIT $${idx}`,
      values,
    );
    return result.rows;
  }

  async listSleepSessions(memberId, { from = null, to = null, limit = 50 } = {}, client = this.pool) {
    const conditions = ['member_id = $1'];
    const values = [memberId];
    let idx = 2;
    if (from) { conditions.push(`started_at >= $${idx++}`); values.push(from); }
    if (to) { conditions.push(`started_at <= $${idx++}`); values.push(to); }
    values.push(Math.min(Math.max(Number(limit) || 50, 1), 200));

    const result = await client.query(
      `SELECT
         id, provider, source_record_id AS "sourceRecordId",
         started_at AS "startedAt", ended_at AS "endedAt",
         sleep_total_duration_mins AS "sleepTotalDurationMins",
         sleep_time_in_bed_minutes AS "sleepTimeInBedMinutes",
         sleep_rem_minutes AS "sleepRemMinutes", sleep_deep_minutes AS "sleepDeepMinutes",
         sleep_light_minutes AS "sleepLightMinutes", sleep_awake_minutes AS "sleepAwakeMinutes",
         sleep_efficiency_score AS "sleepEfficiencyScore", is_nap AS "isNap",
         sleep_stages AS "sleepStages", created_at AS "createdAt"
       FROM sleep_sessions
       WHERE ${conditions.join(' AND ')}
       ORDER BY started_at DESC
       LIMIT $${idx}`,
      values,
    );
    return result.rows;
  }

  async listHealthScores(memberId, { scoreType = null, from = null, limit = 50 } = {}, client = this.pool) {
    const conditions = ['member_id = $1'];
    const values = [memberId];
    let idx = 2;
    if (scoreType) { conditions.push(`score_type = $${idx++}`); values.push(scoreType); }
    if (from) { conditions.push(`calculated_at >= $${idx++}`); values.push(from); }
    values.push(Math.min(Math.max(Number(limit) || 50, 1), 200));

    const result = await client.query(
      `SELECT
         id, provider, source_record_id AS "sourceRecordId",
         score_type AS "scoreType", score, qualifier,
         components, trend, calculated_at AS "calculatedAt"
       FROM health_scores
       WHERE ${conditions.join(' AND ')}
       ORDER BY calculated_at DESC
       LIMIT $${idx}`,
      values,
    );
    if (result.rows.length === 0) {
      const mem = await client.query(
        `SELECT wellness_score AS score, insurance_tier AS qualifier, wellness_updated_at AS "calculatedAt"
         FROM members WHERE id = $1`,
        [memberId],
      );
      if (mem.rows[0]) {
        const row = mem.rows[0];
        const val = Number(row.score ?? 50);
        return [{
          id: `wellness_${memberId}`,
          provider: 'composite',
          sourceRecordId: null,
          scoreType: 'overall',
          score: val,
          overallScore: val,
          qualifier: val >= 85 ? 'optimal' : val >= 70 ? 'good' : val >= 50 ? 'fair' : 'needs_attention',
          components: {},
          trend: 'stable',
          calculatedAt: row.calculatedAt || new Date().toISOString(),
        }];
      }
    }
    return result.rows;
  }

  async listWomensHealth(memberId, { from = null, limit = 50 } = {}, client = this.pool) {
    const conditions = ['member_id = $1'];
    const values = [memberId];
    let idx = 2;
    if (from) { conditions.push(`recorded_at >= $${idx++}`); values.push(from); }
    values.push(Math.min(Math.max(Number(limit) || 50, 1), 200));

    const result = await client.query(
      `SELECT
         id, provider, source_record_id AS "sourceRecordId",
         current_phase AS "currentPhase", current_phase_type AS "currentPhaseType",
         cycle_length AS "cycleLength", day_in_cycle AS "dayInCycle",
         period_length AS "periodLength", days_until_next_phase AS "daysUntilNextPhase",
         length_of_current_phase AS "lengthOfCurrentPhase",
         predicted_cycle_length AS "predictedCycleLength",
         is_predicted_cycle AS "isPredictedCycle",
         recorded_at AS "recordedAt", created_at AS "createdAt"
       FROM womens_health
       WHERE ${conditions.join(' AND ')}
       ORDER BY recorded_at DESC
       LIMIT $${idx}`,
      values,
    );
    return result.rows;
  }
}

export const OpenWearablesRepository = WearableRepository;
export const OWRepository = WearableRepository;
