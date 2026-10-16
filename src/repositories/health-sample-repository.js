import { TimeseriesRepository } from './timeseries-repository.js';
import { WellnessService } from '../services/wellness-service.js';

export class HealthSampleRepository {
  constructor(pool, { timeseriesRepo = null, wellnessService = null } = {}) {
    this.pool = pool;
    this.timeseriesRepo = timeseriesRepo || new TimeseriesRepository(pool);
    this.wellnessService = wellnessService || new WellnessService(pool);
  }

  async insertBatch(memberId, samples, clientOrOpts = {}, maybeClient = null) {
    const client = (clientOrOpts && typeof clientOrOpts.query === 'function')
      ? clientOrOpts
      : (maybeClient && typeof maybeClient.query === 'function' ? maybeClient : this.pool);
    return this.timeseriesRepo.upsertBatch(memberId, samples, client);
  }


  async listSamples(memberId, from, to, client = this.pool) {
    const result = await client.query(
      `SELECT
         metric_type      AS metric,
         recorded_at      AS "recordedAt",
         ended_at         AS "endedAt",
         local_date::text AS "localDate",
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

  async calculateWellnessMetrics(memberId, client = this.pool) {
    return this.wellnessService.calculateWellnessMetrics(memberId, client);
  }
}
