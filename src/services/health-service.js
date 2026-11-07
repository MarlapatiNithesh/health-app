import { reconcileDailyMetrics, extractLocalDate } from '../domain/reconciliation.js';
import { ApplicationError } from '../errors/application-error.js';
import { validateHealthBatch, validateIdempotencyKey, validatePhoneConnection } from '../validation/input.js';
import { withTransaction } from '../database/pool.js';
import { logger } from '../logger.js';
import { HealthSampleMapper } from '../mappers/health-sample-mapper.js';

export class HealthService {
  constructor(repos, { batchLimit = 200, notificationDispatchService = null } = {}) {
    this.phoneHealthRepo = repos.phoneHealthRepo ?? repos;
    this.healthSampleRepo = repos.healthSampleRepo ?? repos;
    this.memberRepo = repos.memberRepo ?? repos;
    this.wearableRepo = repos.wearableRepo ?? repos;
    this.openWearablesRepo = repos.openWearablesRepo ?? repos.owRepo;
    this.batchLimit = batchLimit;
    this.notificationDispatchService = notificationDispatchService;
  }

  async savePhoneConnection(memberId, input) {
    await this.requireMember(memberId);
    const validated = validatePhoneConnection(input);
    const conn = await this.phoneHealthRepo.upsertPhoneConnection(memberId, validated);
    return HealthSampleMapper.toPhoneConnectionDto(conn);
  }

  async getPhoneConnection(memberId) {
    await this.requireMember(memberId);
    const conn = await this.phoneHealthRepo.getPhoneConnection(memberId);
    return HealthSampleMapper.toPhoneConnectionDto(conn);
  }

  async ingestHealthData(memberId, input, idempotencyHeader) {
    await this.requireMember(memberId);

    const { samples } = validateHealthBatch(input, this.batchLimit);
    const idempotencyKey = validateIdempotencyKey(idempotencyHeader);

    const connection = await this.phoneHealthRepo.getPhoneConnection(memberId);
    if (!connection || !['connected', 'syncing'].includes(connection.status)) {
      throw new ApplicationError(
        'Connect phone health before uploading data.',
        409,
        'phone_health_not_connected',
      );
    }

    const seenKeys = new Set();
    const uniqueSamples = samples.filter((sample) => {
      const key = `${sample.provider}:${sample.externalId}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    const intraBatchDuplicates = samples.length - uniqueSamples.length;

    const isPhoneProviderMatch = (prov) => {
      if (!connection.provider) return true;
      if (prov === connection.provider) return true;
      if (prov === 'phone_pedometer' && ['health_connect', 'apple_health'].includes(connection.provider)) return true;
      if (connection.provider === 'phone_pedometer' && ['health_connect', 'apple_health'].includes(prov)) return true;
      return false;
    };

    const connectionErrors = uniqueSamples.flatMap((sample, index) => {
      const errors = [];
      if (!isPhoneProviderMatch(sample.provider)) {
        errors.push({ field: `samples[${index}].provider`, message: `The active phone connection is ${connection.provider}.` });
      }
      if (Array.isArray(connection.permissions) && connection.permissions.length > 0 && !connection.permissions.includes(sample.metric) && sample.provider !== 'phone_pedometer') {
        errors.push({ field: `samples[${index}].metric`, message: `Metric '${sample.metric}' is not granted by phone permissions.` });
      }
      return errors;
    });

    if (connectionErrors.length) {
      throw new ApplicationError(
        'Some samples are outside the connected phone permissions.',
        422,
        'validation_error',
        connectionErrors,
      );
    }

    const pool = this.phoneHealthRepo?.pool || this.healthSampleRepo?.pool;
    const runInTransaction = async (client) => {
      if (idempotencyKey) {
        const cached = await this.phoneHealthRepo.getSyncResponse(memberId, idempotencyKey, client);
        if (cached) return cached;

        const claimed = await this.phoneHealthRepo.claimSync(
          memberId,
          idempotencyKey,
          samples.length,
          samples.length === 0,
          client,
        );
        if (!claimed) {
          const retry = await this.phoneHealthRepo.getSyncResponse(memberId, idempotencyKey, client);
          if (retry) return retry;
          throw new Error('Idempotent sync was claimed but has no completed response.');
        }
      }

      try {
        const { accepted, duplicates } = await this.healthSampleRepo.insertBatch(
          memberId,
          uniqueSamples,
          client,
        );

        const syncedAt = await this.phoneHealthRepo.updateSyncTimestamp(
          memberId,
          connection.provider,
          input.syncCursor ?? null,
          client,
        );

        const response = {
          accepted,
          duplicates: intraBatchDuplicates + duplicates,
          received: samples.length,
          noData: samples.length === 0,
          syncedAt,
        };

        if (idempotencyKey) {
          await this.phoneHealthRepo.completeSync(
            memberId,
            idempotencyKey,
            accepted,
            response.duplicates,
            response,
            client,
          );
        }

        return response;
      } catch (err) {
        if (idempotencyKey && this.phoneHealthRepo.failSync) {
          try {
            await this.phoneHealthRepo.failSync(memberId, idempotencyKey, err.message, client);
          } catch (failErr) {
            logger.warn('Failed to record failSync status in sync_logs', { err: failErr.message, memberId, idempotencyKey });
          }
        }
        throw err;
      }
    };

    let response;
    if (pool) {
      response = await withTransaction(pool, runInTransaction);
    } else {
      response = await runInTransaction(pool);
    }

    if (this.notificationDispatchService && uniqueSamples.length > 0) {
      this.notificationDispatchService.onHealthDataIngested(memberId, {
        samples: uniqueSamples,
      }).catch((err) => {
        logger.error('Failed to dispatch health data notifications', { err: err.message, memberId });
      });
    }

    await this.triggerDebouncedWellness(memberId);

    return HealthSampleMapper.toSyncResponseDto(response);
  }

  async triggerDebouncedWellness(memberId) {
    if (!this.healthSampleRepo?.calculateWellnessMetrics || !this.memberRepo?.updateWellnessScoreAndTier) {
      return;
    }
    const { score, tier } = await this.healthSampleRepo.calculateWellnessMetrics(memberId);
    await this.memberRepo.updateWellnessScoreAndTier(memberId, score, tier);
  }

  async ingestWebhookData(memberId, provider, rawSamples, idempotencyHeader) {
    await this.requireMember(memberId);

    const { samples } = validateHealthBatch(
      { samples: (rawSamples || []).map((s) => ({ ...s, provider })) },
      this.batchLimit,
    );
    const idempotencyKey = typeof idempotencyHeader === 'string' && idempotencyHeader.trim()
      ? idempotencyHeader.trim()
      : null;

    const deviceId = await this.wearableRepo.getOrCreateDeviceForBrand(memberId, provider);

    const pool = this.wearableRepo?.pool || this.healthSampleRepo?.pool;
    const runInTransaction = async (client) => {
      if (idempotencyKey) {
        const cached = await this.wearableRepo.getWearableSyncResponse(memberId, idempotencyKey, client);
        if (cached) return cached;

        const claimed = await this.wearableRepo.claimWearableSync(
          memberId,
          deviceId,
          idempotencyKey,
          samples.length,
          samples.length === 0,
          client,
        );
        if (!claimed) {
          const retry = await this.wearableRepo.getWearableSyncResponse(memberId, idempotencyKey, client);
          if (retry) return retry;
          throw new Error('Idempotent wearable sync was claimed but has no completed response.');
        }
      }

      try {
        const seenKeys = new Set();
        const uniqueSamples = samples.filter((sample) => {
          const key = `${sample.provider}:${sample.externalId}`;
          if (seenKeys.has(key)) return false;
          seenKeys.add(key);
          return true;
        });

        const intraBatchDuplicates = samples.length - uniqueSamples.length;

        const { accepted, duplicates } = await this.healthSampleRepo.insertBatch(
          memberId,
          uniqueSamples,
          client,
        );

        const syncedAt = new Date().toISOString();
        await this.wearableRepo.updateWearableDevice(memberId, deviceId, {
          lastSyncAt: syncedAt,
        }, client);

        const response = {
          accepted,
          duplicates: intraBatchDuplicates + duplicates,
          received: samples.length,
          noData: samples.length === 0,
          syncedAt,
        };

        if (idempotencyKey) {
          await this.wearableRepo.completeWearableSync(
            memberId,
            idempotencyKey,
            accepted,
            response.duplicates,
            response,
            client,
          );
        }

        return response;
      } catch (err) {
        if (idempotencyKey && this.wearableRepo.failWearableSync) {
          try {
            await this.wearableRepo.failWearableSync(memberId, idempotencyKey, err.message, client);
          } catch (failErr) {
            logger.warn('Failed to record failWearableSync status in sync_logs', { err: failErr.message, memberId, idempotencyKey });
          }
        }
        throw err;
      }
    };

    let response;
    if (pool) {
      response = await withTransaction(pool, runInTransaction);
    } else {
      response = await runInTransaction(pool);
    }

    if (this.notificationDispatchService && uniqueSamples.length > 0) {
      this.notificationDispatchService.onHealthDataIngested(memberId, {
        samples: uniqueSamples,
      }).catch((err) => {
        logger.error('Failed to dispatch webhook health data notifications', { err: err.message, memberId });
      });
    }

    await this.triggerDebouncedWellness(memberId);

    return HealthSampleMapper.toSyncResponseDto(response);
  }

  async getDailySummary(memberId, from, to) {
    await this.requireMember(memberId);
    validateDateRange(from, to);
    const samples = await this.healthSampleRepo.listSamples(memberId, from, to);
    const reconciled = reconcileDailyMetrics(samples);

    // If querying general summary without strict date bounds, attach daily history for charting
    if (!from && !to && Array.isArray(samples) && samples.length > 0) {
      const samplesByDay = new Map();
      for (const s of samples) {
        const day = extractLocalDate(s);
        const list = samplesByDay.get(day) || [];
        list.push(s);
        samplesByDay.set(day, list);
      }
      const sortedDays = Array.from(samplesByDay.keys()).sort().reverse();
      const history = [];
      for (const day of sortedDays) {
        const daySamples = samplesByDay.get(day);
        const recDay = reconcileDailyMetrics(daySamples);
        history.push({
          date: day,
          steps: recDay.steps?.value || 0,
          calories: recDay.calories?.value || 0,
          distance: recDay.distance?.value || 0,
          heartRate: recDay.heart_rate?.value || null,
          spo2: recDay.spo2?.value || null,
          sleep: recDay.sleep?.value || null,
        });
      }
      reconciled.history = history;
    }

    return HealthSampleMapper.toDailySummaryDto(reconciled);
  }

  async requireMember(memberId) {
    const member = await this.memberRepo.findMemberById(memberId);
    if (!member) throw new ApplicationError('User not found', 404, 'user_not_found');
    if (['deleted', 'suspended', 'deletion_requested'].includes(member.status)) {
      throw new ApplicationError(`Member account is ${member.status}`, 403, 'member_inactive');
    }
    return member;
  }
}

function validateDateRange(from, to) {
  if (from && Number.isNaN(Date.parse(from))) {
    throw new ApplicationError(
      'from must be a valid ISO date',
      422,
      'validation_error',
      [{ field: 'from', message: 'Use an ISO-8601 date.' }],
    );
  }
  if (to && Number.isNaN(Date.parse(to))) {
    throw new ApplicationError(
      'to must be a valid ISO date',
      422,
      'validation_error',
      [{ field: 'to', message: 'Use an ISO-8601 date.' }],
    );
  }
  if (from && to && new Date(from) > new Date(to)) {
    throw new ApplicationError(
      'from must be before to',
      422,
      'validation_error',
      [{ field: 'from', message: 'The start date must be before the end date.' }],
    );
  }
  if (from && to) {
    const diffDays = (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 90) {
      throw new ApplicationError(
        'Date range cannot exceed 90 days',
        422,
        'validation_error',
        [{ field: 'to', message: 'Maximum date range is 90 days.' }],
      );
    }
  }
}
