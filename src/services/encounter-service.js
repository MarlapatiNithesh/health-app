import { ApplicationError } from '../errors/application-error.js';
import { globalCache } from '../cache/cache-manager.js';
import { EncounterMapper } from '../mappers/index.js';

export class EncounterService {
  constructor(encounterRepo) {
    this.encounterRepo = encounterRepo;
  }

  async createEncounter(patientId, data = {}) {
    const encounter = await this.encounterRepo.createEncounter(patientId, data);
    globalCache.invalidatePrefix('encounter:');
    globalCache.invalidatePrefix('api:');
    return EncounterMapper.toDto(encounter);
  }

  async getEncounter(patientId, encounterId) {
    const cacheKey = `encounter:${encounterId}`;
    return globalCache.coalesce(cacheKey, async () => {
      const encounter = await this.encounterRepo.findEncounterById(encounterId);
      if (!encounter) {
        throw new ApplicationError('Encounter not found', 404, 'not_found');
      }
      if (encounter.patientId !== patientId) {
        throw new ApplicationError('Forbidden', 403, 'forbidden');
      }
      return EncounterMapper.toDto(encounter);
    }, 15_000);
  }

  async listEncounters(patientId, limit = 20) {
    const encounters = await this.encounterRepo.listEncountersByPatient(patientId, limit);
    return encounters.map((e) => EncounterMapper.toDto(e));
  }

  async updateStatus(patientId, encounterId, updates = {}) {
    const existing = await this.encounterRepo.findEncounterById(encounterId);
    if (!existing) {
      throw new ApplicationError('Encounter not found', 404, 'not_found');
    }
    if (existing.patientId !== patientId) {
      throw new ApplicationError('Forbidden', 403, 'forbidden');
    }
    const updated = await this.encounterRepo.updateEncounterStatus(encounterId, updates);
    globalCache.invalidatePrefix(`encounter:${encounterId}`);
    globalCache.invalidatePrefix('api:');
    return EncounterMapper.toDto(updated);
  }

  async postMessage(patientId, encounterId, { role = 'user', content, text, message, meta = {} } = {}) {
    const messageContent = content || text || message;
    if (!messageContent) {
      throw new ApplicationError('Message content is required', 400, 'validation_error');
    }
    const existing = await this.encounterRepo.findEncounterById(encounterId);
    if (!existing) {
      throw new ApplicationError('Encounter not found', 404, 'not_found');
    }
    if (existing.patientId !== patientId) {
      throw new ApplicationError('Forbidden', 403, 'forbidden');
    }
    const msg = await this.encounterRepo.appendMessage(encounterId, patientId, { role, content: messageContent, meta });
    globalCache.invalidatePrefix(`encounter:${encounterId}`);
    globalCache.invalidatePrefix('api:');
    return EncounterMapper.toMessageDto(msg);
  }

  async getSymptomState(patientId, encounterId) {
    const existing = await this.encounterRepo.findEncounterById(encounterId);
    if (!existing) {
      throw new ApplicationError('Encounter not found', 404, 'not_found');
    }
    if (existing.patientId !== patientId) {
      throw new ApplicationError('Forbidden', 403, 'forbidden');
    }
    const state = await this.encounterRepo.getSymptomState(encounterId);
    return EncounterMapper.toSymptomStateDto(state) || { isComplete: false };
  }

  async updateSymptomState(patientId, encounterId, data = {}) {
    const existing = await this.encounterRepo.findEncounterById(encounterId);
    if (!existing) {
      throw new ApplicationError('Encounter not found', 404, 'not_found');
    }
    if (existing.patientId !== patientId) {
      throw new ApplicationError('Forbidden', 403, 'forbidden');
    }
    const updated = await this.encounterRepo.upsertSymptomState(encounterId, patientId, data);
    globalCache.invalidatePrefix(`encounter:${encounterId}`);
    globalCache.invalidatePrefix('api:');
    return EncounterMapper.toSymptomStateDto(updated);
  }
}
