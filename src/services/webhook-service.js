import { withTransaction } from '../database/pool.js';
import { logger } from '../logger.js';
import {
  mapWorkout,
  mapSleepSession,
  mapWomensHealth,
  mapHealthScore,
  normalizeSample,
  extractDirectFieldSamples,
} from '../mappers/wearable-mapper.js';
import { SyncLogRepository } from '../repositories/sync-log-repository.js';
import { TimeseriesRepository } from '../repositories/timeseries-repository.js';

export class WebhookService {
  constructor(pool, {
    memberRepo = null,
    wearableRepo = null,
    syncLogRepo = null,
    timeseriesRepo = null,
    openWearablesClient = null,
    wearableService = null,
  } = {}) {
    this.pool = pool;
    this.memberRepo = memberRepo;
    this.wearableRepo = wearableRepo;
    this.syncLogRepo = syncLogRepo || new SyncLogRepository(pool);
    this.timeseriesRepo = timeseriesRepo || new TimeseriesRepository(pool);
    this.openWearablesClient = openWearablesClient;
    this.wearableService = wearableService;
  }

  inferDataType(eventType = '') {
    if (eventType.startsWith('workout')) return 'workout';
    if (eventType.startsWith('sleep')) return 'sleep';
    if (eventType.startsWith('menstrual') || eventType.startsWith('womens_health')) return 'womens_health';
    if (eventType.includes('score') || eventType.includes('readiness') || eventType.includes('recovery')) return 'health_scores';
    if (eventType.startsWith('connection')) return 'connection';
    if (eventType.startsWith('sync')) return 'other';
    return 'timeseries';
  }

  async resolveMemberId(rawId, client = this.pool) {
    if (!rawId) return null;

    const res = await client.query(
      `SELECT id FROM members WHERE ow_user_id = $1 OR id::text = $1 LIMIT 1`,
      [rawId],
    );
    if (res.rows.length > 0) {
      return res.rows[0].id;
    }

    if (this.openWearablesClient && typeof this.openWearablesClient.isConfigured === 'function' && this.openWearablesClient.isConfigured()) {
      try {
        const owUser = await this.openWearablesClient.getUser(rawId);
        const externalId = owUser?.external_user_id || owUser?.externalUserId;
        if (externalId) {
          const extRes = await client.query(
            `SELECT id FROM members WHERE id = $1 LIMIT 1`,
            [externalId],
          );
          if (extRes.rows.length > 0) {
            const memberId = extRes.rows[0].id;
            await client.query(
              `UPDATE members SET ow_user_id = $2, updated_at = now() WHERE id = $1`,
              [memberId, rawId],
            );
            return memberId;
          }
        }
      } catch (err) {
        logger.warn('Failed to query user from OpenWearables', { rawId, error: err.message });
      }
    }

    return null;
  }

  async handleWebhook(body = {}, headers = {}) {
    const eventType = (body.type || body.event_type || body.event || '').toLowerCase();

    if (
      eventType === 'ping' ||
      eventType === 'test' ||
      body.type === 'ping' ||
      body.message === 'ping'
    ) {
      return { statusCode: 200, status: 'ok', event: 'ping_received' };
    }

    const messageId = headers['svix-id'] || headers['webhook-id'] || headers['x-webhook-id'] || body.id || body.message_id || null;
    const data = body.data || {};
    const rawProvider = data.provider || data.source?.provider || data.source?.slug || body.provider || null;
    const rawUserId = data.user_id || data.client_user_id || body.user_id || body.memberId || null;

    if (!rawProvider || rawProvider === 'unknown') {
      if (messageId) {
        const claim = await this.syncLogRepo.claimWebhookEvent({
          memberId: null,
          provider: 'unknown',
          dataType: this.inferDataType(eventType),
          eventType,
          idempotencyKey: messageId,
          rawPayload: body,
        });
        if (claim) {
          await this.syncLogRepo.completeWebhookEvent(claim.id, {
            status: 'dead',
            errorMessage: 'Missing or unknown provider',
          });
        }
      }
      return { statusCode: 200, status: 'dead', reason: 'unknown_provider' };
    }

    const provider = rawProvider.toLowerCase();
    const memberId = rawUserId ? await this.resolveMemberId(rawUserId) : null;

    if (rawUserId && !memberId) {
      if (messageId) {
        const claim = await this.syncLogRepo.claimWebhookEvent({
          memberId: null,
          provider,
          dataType: this.inferDataType(eventType),
          eventType,
          idempotencyKey: messageId,
          rawPayload: body,
        });
        if (claim) {
          await this.syncLogRepo.failWebhookEvent(claim.id, {
            errorMessage: `Unknown member: ${rawUserId}`,
            retryCount: claim.retryCount,
          });
        }
      }
      const err = new Error(`Member mapping for ${rawUserId} not found; retry scheduled`);
      err.status = 500;
      throw err;
    }

    let syncLogId = null;
    let retryCount = 0;

    if (messageId) {
      const claim = await this.syncLogRepo.claimWebhookEvent({
        memberId,
        provider,
        dataType: this.inferDataType(eventType),
        eventType,
        idempotencyKey: messageId,
        rawPayload: body,
      });

      if (!claim) {
        return {
          statusCode: 200,
          received: true,
          status: 'duplicate',
          message: 'Webhook event already recorded and processed.',
        };
      }
      syncLogId = claim.id;
      retryCount = claim.retryCount;
    }

    const startTime = Date.now();
    try {
      const result = await withTransaction(this.pool, async (client) => {
        return this.processEventInternal({
          memberId,
          provider,
          eventType,
          data,
          body,
          client,
        });
      });

      const durationMs = Date.now() - startTime;
      if (syncLogId) {
        await this.syncLogRepo.completeWebhookEvent(syncLogId, {
          status: result.ledgerStatus || 'success',
          recordsSaved: result.recordsSaved || 0,
          recordsRead: result.recordsRead || 0,
          durationMs,
          errorMessage: result.warning || null,
          response: result,
        });
      }

      return {
        statusCode: result.status === 'processed' ? 202 : 200,
        received: true,
        ...result,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      if (syncLogId) {
        await this.syncLogRepo.failWebhookEvent(syncLogId, {
          errorMessage: err.message,
          durationMs,
          retryCount,
        });
      }
      throw err;
    }
  }

  async processEventInternal({ memberId, provider, eventType, data, body, client }) {
    if (memberId) {
      const linkRes = await client.query(
        `SELECT status FROM wearable_links WHERE member_id = $1 AND provider = $2`,
        [memberId, provider],
      );
      const link = linkRes.rows[0];
      if (link && link.status === 'disconnected') {
        return {
          status: 'skipped',
          reason: 'link_disconnected',
          message: 'Data skipped because provider link is disconnected.',
          recordsSaved: 0,
          ledgerStatus: 'success',
        };
      }
    }

    if (eventType === 'connection.created') {
      if (memberId) {
        await client.query(
          `INSERT INTO wearable_links (member_id, provider, status, metadata, connected_at, disconnected_at, updated_at)
           VALUES ($1, $2, 'connected', $3, now(), NULL, now())
           ON CONFLICT (member_id, provider)
           DO UPDATE SET status = 'connected', disconnected_at = NULL, metadata = EXCLUDED.metadata, updated_at = now()`,
          [memberId, provider, JSON.stringify(data.metadata || {})],
        );
        if (this.wearableRepo?.getOrCreateDeviceForBrand) {
          const deviceId = await this.wearableRepo.getOrCreateDeviceForBrand(memberId, provider, client);
          await this.wearableRepo.updateWearableDevice(memberId, deviceId, {
            status: 'connected',
            connected: true,
            lastSyncAt: data.connected_at || new Date().toISOString(),
          }, client);
        }
      }
      return { status: 'ok', event: eventType, recordsSaved: 1 };
    }

    if (eventType === 'connection.revoked' || eventType === 'connection.deleted') {
      if (memberId) {
        await client.query(
          `UPDATE wearable_links
           SET status = 'disconnected', disconnected_at = now(), updated_at = now()
           WHERE member_id = $1 AND provider = $2`,
          [memberId, provider],
        );
        if (this.wearableRepo?.getOrCreateDeviceForBrand) {
          const deviceId = await this.wearableRepo.getOrCreateDeviceForBrand(memberId, provider, client);
          await this.wearableRepo.updateWearableDevice(memberId, deviceId, {
            status: 'disconnected',
            connected: false,
          }, client);
        }
      }
      return { status: 'ok', event: eventType, recordsSaved: 1 };
    }

    if (eventType.startsWith('sync.')) {
      const stage = data.stage;
      const status = data.status;

      if (stage === 'failed' || status === 'failed' || eventType === 'sync.failed') {
        const errorDetail = data.error || data.error_detail || 'Sync failed';
        if (memberId) {
          await client.query(
            `UPDATE wearable_links
             SET status = 'error', error_detail = $3, updated_at = now()
             WHERE member_id = $1 AND provider = $2`,
            [memberId, provider, errorDetail],
          );
        }
        return { status: 'acknowledged', event: eventType, recordsSaved: 0 };
      }

      if (stage === 'completed' || status === 'success' || eventType === 'sync.completed') {
        if (memberId) {
          await client.query(
            `UPDATE wearable_links
             SET status = 'connected', error_detail = NULL, updated_at = now()
             WHERE member_id = $1 AND provider = $2 AND status != 'disconnected'`,
            [memberId, provider],
          );

          if (this.wearableService?.syncMemberDataFromOpenWearables) {
            setImmediate(async () => {
              try {
                await this.wearableService.syncMemberDataFromOpenWearables(memberId);
              } catch (err) {
                logger.error('Failed to trigger incremental sync after sync.completed', { memberId, provider, error: err.message });
              }
            });
          }
        }
        return { status: 'acknowledged', event: eventType, recordsSaved: 1 };
      }

      return { status: 'acknowledged', event: eventType, recordsSaved: 0 };
    }

    let recordsSaved = 0;

    if ((eventType === 'workout.created' || eventType === 'workout.updated') && memberId) {
      if (this.wearableRepo?.insertWorkout) {
        recordsSaved += await this.wearableRepo.insertWorkout(memberId, provider, data, client);
      }
    } else if (eventType === 'workout.deleted' && memberId) {
      const sourceRecordId = data.id || data.source_record_id || data.sourceRecordId;
      if (sourceRecordId) {
        await client.query(
          `DELETE FROM workouts WHERE member_id = $1 AND provider = $2 AND source_record_id = $3`,
          [memberId, provider, String(sourceRecordId)],
        );
      }
      return { status: 'ok', event: eventType, recordsSaved: 1 };
    }

    if ((eventType === 'sleep.created' || eventType === 'sleep.updated') && memberId) {
      if (this.wearableRepo?.insertSleepSession) {
        recordsSaved += await this.wearableRepo.insertSleepSession(memberId, provider, data, client);
      }
    } else if (eventType === 'sleep.deleted' && memberId) {
      const sourceRecordId = data.id || data.source_record_id || data.sourceRecordId;
      if (sourceRecordId) {
        await client.query(
          `DELETE FROM sleep_sessions WHERE member_id = $1 AND provider = $2 AND source_record_id = $3`,
          [memberId, provider, String(sourceRecordId)],
        );
      }
      return { status: 'ok', event: eventType, recordsSaved: 1 };
    }

    if ((eventType === 'menstrual_cycle.created' || eventType === 'menstrual_cycle.updated' || eventType === 'womens_health.created') && memberId) {
      if (this.wearableRepo?.insertWomensHealth) {
        recordsSaved += await this.wearableRepo.insertWomensHealth(memberId, provider, data, client);
      }
    } else if ((eventType === 'menstrual_cycle.deleted' || eventType === 'womens_health.deleted') && memberId) {
      const sourceRecordId = data.id || data.source_record_id || data.sourceRecordId;
      if (sourceRecordId) {
        await client.query(
          `DELETE FROM womens_health WHERE member_id = $1 AND provider = $2 AND source_record_id = $3`,
          [memberId, provider, String(sourceRecordId)],
        );
      }
      return { status: 'ok', event: eventType, recordsSaved: 1 };
    }

    if (
      (eventType === 'health_score.created' ||
       eventType === 'readiness.created' ||
       eventType === 'recovery.created') &&
      memberId
    ) {
      let scoreType = 'overall';
      if (eventType.includes('readiness')) scoreType = 'readiness';
      else if (eventType.includes('recovery')) scoreType = 'recovery';

      if (this.wearableRepo?.insertHealthScore) {
        recordsSaved += await this.wearableRepo.insertHealthScore(memberId, provider, {
          ...data,
          scoreType,
        }, client);
      }
    }

    if (eventType === 'activity_summary.created' && memberId) {
      const tsRows = [];
      const timestamp = data.date || data.calendar_date || data.timestamp || data.start_time;
      if (timestamp) {
        if (data.steps != null || data.steps_count != null) {
          tsRows.push({
            metricType: 'steps',
            value: Number(data.steps ?? data.steps_count),
            unit: 'count',
            recordedAt: timestamp,
            sourceRecordId: `${provider}-steps-${timestamp}`,
          });
        }
        if (data.calories != null || data.calories_kcal != null) {
          tsRows.push({
            metricType: 'calories',
            value: Number(data.calories ?? data.calories_kcal),
            unit: 'kcal',
            recordedAt: timestamp,
            sourceRecordId: `${provider}-cal-${timestamp}`,
          });
        }
        if (data.distance != null || data.distance_meters != null) {
          tsRows.push({
            metricType: 'distance',
            value: Number(data.distance ?? data.distance_meters),
            unit: 'm',
            recordedAt: timestamp,
            sourceRecordId: `${provider}-dist-${timestamp}`,
          });
        }
        if (data.active_minutes != null) {
          tsRows.push({
            metricType: 'active_minutes',
            value: Number(data.active_minutes),
            unit: 'min',
            recordedAt: timestamp,
            sourceRecordId: `${provider}-act-${timestamp}`,
          });
        }
      }
      if (tsRows.length > 0) {
        const res = await this.timeseriesRepo.upsertBatch(memberId, provider, tsRows, client);
        recordsSaved += res.accepted ?? 0;
      }
    }

    const samples = [];
    if (Array.isArray(body.samples)) {
      for (const s of body.samples) {
        const sample = normalizeSample(s, null, `${provider}-${s.timestamp || ''}`, s.timestamp || null);
        if (sample) samples.push(sample);
      }
    } else if (Array.isArray(data.samples)) {
      const extPrefix = data.id || `${provider}`;
      const recAt = data.date || data.calendar_date || data.timestamp || data.start_time || null;
      for (const s of data.samples) {
        const sample = normalizeSample(s, data.series_type, extPrefix, recAt);
        if (sample) samples.push(sample);
      }
    }

    const directSamples = extractDirectFieldSamples(data, provider, data.id || provider);
    if (directSamples.length > 0) {
      samples.push(...directSamples);
    }

    if (samples.length > 0 && memberId) {
      const res = await this.timeseriesRepo.upsertBatch(memberId, provider, samples, client);
      recordsSaved += res.accepted ?? 0;
    }

    const knownPrefixes = ['connection.', 'sync.', 'workout.', 'sleep.', 'menstrual_cycle.', 'womens_health.', 'health_score.', 'readiness.', 'recovery.', 'activity_summary.'];
    const isKnown = knownPrefixes.some((p) => eventType.startsWith(p));
    let ledgerStatus = 'success';
    let warning = null;

    if (!isKnown && recordsSaved === 0) {
      ledgerStatus = 'partial';
      warning = `Unknown event type received: ${eventType}`;
      logger.warn('Unknown webhook event type received', { eventType, provider, memberId });
    }

    return {
      status: ledgerStatus === 'partial' ? 'partial' : 'processed',
      event: eventType,
      recordsSaved,
      accepted: recordsSaved,
      ledgerStatus,
      warning,
    };
  }

  async processRetryQueue() {
    const retryable = await this.syncLogRepo.getRetryableWebhookLogs(50);
    let processed = 0;
    let failed = 0;

    for (const log of retryable) {
      const payload = typeof log.raw_payload === 'string' ? JSON.parse(log.raw_payload) : log.raw_payload;
      if (!payload) continue;

      try {
        await this.handleWebhook(payload, { 'svix-id': log.idempotency_key });
        processed++;
      } catch (err) {
        failed++;
        logger.error('Retry worker failed to process log', { id: log.id, error: err.message });
      }
    }

    return { processed, failed };
  }

  async purgeOldSyncPayloads(retentionDays = 30) {
    return this.syncLogRepo.purgeOldSyncPayloads(retentionDays);
  }
}
