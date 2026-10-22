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
    return this.timeseriesRepo.listSamples(memberId, from, to, client);
  }

  async calculateWellnessMetrics(memberId, client = this.pool) {
    return this.wellnessService.calculateWellnessMetrics(memberId, client);
  }
}
