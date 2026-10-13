import { MemberRepository } from './member-repository.js';
import { PhoneVerificationRepository } from './phone-verification-repository.js';
import { PhoneHealthRepository } from './phone-health-repository.js';
import { WearableRepository } from './wearable-repository.js';
import { HealthSampleRepository } from './health-sample-repository.js';
import { TimeseriesRepository } from './timeseries-repository.js';
import { SyncLogRepository } from './sync-log-repository.js';
import { ClinicalRecordRepository } from './clinical-record-repository.js';
import { EncounterRepository } from './encounter-repository.js';
import { DocumentRepository } from './document-repository.js';

export function createRepositories(pool) {
  const timeseriesRepo = new TimeseriesRepository(pool);
  const syncLogRepo = new SyncLogRepository(pool);
  const wearableRepo = new WearableRepository(pool, { timeseriesRepo, syncLogRepo });
  const healthSampleRepo = new HealthSampleRepository(pool, { timeseriesRepo });
  const clinicalRepo = new ClinicalRecordRepository(pool);
  const encounterRepo = new EncounterRepository(pool);
  const documentRepo = new DocumentRepository(pool);

  return {
    memberRepo: new MemberRepository(pool),
    wearableRepo,
    openWearablesRepo: wearableRepo,
    owRepo: wearableRepo,
    phoneVerificationRepo: new PhoneVerificationRepository(pool),
    phoneHealthRepo: new PhoneHealthRepository(pool),
    healthSampleRepo,
    timeseriesRepo,
    syncLogRepo,
    clinicalRepo,
    encounterRepo,
    documentRepo,
  };
}

export {
  MemberRepository,
  WearableRepository,
  WearableRepository as OpenWearablesRepository,
  WearableRepository as OWRepository,
  PhoneVerificationRepository,
  PhoneHealthRepository,
  HealthSampleRepository,
  TimeseriesRepository,
  SyncLogRepository,
  ClinicalRecordRepository,
  EncounterRepository,
  DocumentRepository,
};
