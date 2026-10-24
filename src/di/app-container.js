import { Container } from './container.js';
import { globalCache } from '../cache/cache-manager.js';
import { MemberRepository } from '../repositories/member-repository.js';
import { PhoneHealthRepository } from '../repositories/phone-health-repository.js';
import { HealthSampleRepository } from '../repositories/health-sample-repository.js';
import { ClinicalRecordRepository } from '../repositories/clinical-record-repository.js';
import { EncounterRepository } from '../repositories/encounter-repository.js';
import { DocumentRepository } from '../repositories/document-repository.js';
import { WearableRepository } from '../repositories/wearable-repository.js';
import { TimeseriesRepository } from '../repositories/timeseries-repository.js';
import { SyncLogRepository } from '../repositories/sync-log-repository.js';
import { PhoneVerificationRepository } from '../repositories/phone-verification-repository.js';

import { ClinicalService, ClinicalRulesService } from '../services/clinical-service.js';
import { EncounterService } from '../services/encounter-service.js';
import { DocumentService, DocumentProcessorService } from '../services/document-service.js';
import { ChatService, ClinicalOrchestratorService } from '../services/chat-service.js';
import { HealthService } from '../services/health-service.js';
import { MemberService } from '../services/member-service.js';
import { WearableService } from '../services/wearable-service.js';
import { LLMService } from '../services/llm-service.js';
import { SymptomPriorityService } from '../services/symptom-priority-service.js';
import { ResponseSafetyValidator } from '../services/response-safety-validator.js';

import { ClinicalController } from '../controllers/clinical-controller.js';
import { EncounterController } from '../controllers/encounter-controller.js';
import { DocumentController } from '../controllers/document-controller.js';
import { ChatController, OrchestratorController } from '../controllers/chat-controller.js';
import { HealthController } from '../controllers/health-controller.js';
import { MemberController } from '../controllers/member-controller.js';

export function createAppContainer(config = {}) {
  const container = new Container();

  const pool = config.pool ?? null;
  const jwtSecret = config.jwtSecret || process.env.JWT_SECRET || 'secret';
  container.registerInstance('pool', pool);
  container.registerInstance('jwtSecret', jwtSecret);
  container.registerInstance('cacheManager', config.cacheManager || globalCache);

  const repos = config.repositories || {};

  if (repos.memberRepo || config.memberRepo) container.registerInstance('memberRepo', repos.memberRepo || config.memberRepo);
  else container.registerClass('memberRepo', MemberRepository, ['pool']);

  if (repos.phoneHealthRepo || config.phoneHealthRepo) container.registerInstance('phoneHealthRepo', repos.phoneHealthRepo || config.phoneHealthRepo);
  else container.registerClass('phoneHealthRepo', PhoneHealthRepository, ['pool']);

  if (repos.healthSampleRepo || config.healthSampleRepo) container.registerInstance('healthSampleRepo', repos.healthSampleRepo || config.healthSampleRepo);
  else container.registerClass('healthSampleRepo', HealthSampleRepository, ['pool']);

  if (repos.clinicalRepo || config.clinicalRepo) container.registerInstance('clinicalRepo', repos.clinicalRepo || config.clinicalRepo);
  else container.registerClass('clinicalRepo', ClinicalRecordRepository, ['pool']);

  if (repos.encounterRepo || config.encounterRepo) container.registerInstance('encounterRepo', repos.encounterRepo || config.encounterRepo);
  else container.registerClass('encounterRepo', EncounterRepository, ['pool']);

  if (repos.documentRepo || config.documentRepo) container.registerInstance('documentRepo', repos.documentRepo || config.documentRepo);
  else container.registerClass('documentRepo', DocumentRepository, ['pool']);

  if (repos.wearableRepo || config.wearableRepo) container.registerInstance('wearableRepo', repos.wearableRepo || config.wearableRepo);
  else container.registerClass('wearableRepo', WearableRepository, ['pool']);

  if (repos.timeseriesRepo || config.timeseriesRepo) container.registerInstance('timeseriesRepo', repos.timeseriesRepo || config.timeseriesRepo);
  else container.registerClass('timeseriesRepo', TimeseriesRepository, ['pool']);

  if (repos.syncLogRepo || config.syncLogRepo) container.registerInstance('syncLogRepo', repos.syncLogRepo || config.syncLogRepo);
  else container.registerClass('syncLogRepo', SyncLogRepository, ['pool']);

  if (repos.phoneVerificationRepo || config.phoneVerificationRepo) container.registerInstance('phoneVerificationRepo', repos.phoneVerificationRepo || config.phoneVerificationRepo);
  else container.registerClass('phoneVerificationRepo', PhoneVerificationRepository, ['pool']);

  container.register('repos', (c) => ({
    memberRepo: c.resolve('memberRepo'),
    phoneHealthRepo: c.resolve('phoneHealthRepo'),
    healthSampleRepo: c.resolve('healthSampleRepo'),
    wearableRepo: c.resolve('wearableRepo'),
    openWearablesRepo: config.openWearablesRepo,
    clinicalRepo: c.resolve('clinicalRepo'),
    encounterRepo: c.resolve('encounterRepo'),
    documentRepo: c.resolve('documentRepo'),
    timeseriesRepo: c.resolve('timeseriesRepo'),
    syncLogRepo: c.resolve('syncLogRepo'),
  }));

  if (config.clinicalService) container.registerInstance('clinicalService', config.clinicalService);
  else container.registerClass('clinicalService', ClinicalService, ['clinicalRepo']);

  if (config.encounterService) container.registerInstance('encounterService', config.encounterService);
  else container.registerClass('encounterService', EncounterService, ['encounterRepo']);

  if (config.documentService || config.documentProcessorService) {
    const docSvc = config.documentService || config.documentProcessorService;
    container.registerInstance('documentService', docSvc);
    container.registerInstance('documentProcessorService', docSvc);
  } else {
    container.register('documentService', (c) => new DocumentService({
      documentRepo: c.resolve('documentRepo'),
      clinicalRepo: c.resolve('clinicalRepo'),
      uploadDir: config.uploadDir || './uploads/documents',
    }));
    container.register('documentProcessorService', (c) => c.resolve('documentService'));
  }

  if (config.clinicalRulesService) container.registerInstance('clinicalRulesService', config.clinicalRulesService);
  else container.registerClass('clinicalRulesService', ClinicalRulesService, ['clinicalRepo']);

  if (config.llmService) container.registerInstance('llmService', config.llmService);
  else container.register('llmService', () => new LLMService({ geminiApiKey: config.geminiApiKey || process.env.GEMINI_API_KEY || '' }));

  // Symptom priority service (singleton — stateless, safe to share)
  if (config.symptomPriorityService) container.registerInstance('symptomPriorityService', config.symptomPriorityService);
  else container.registerClass('symptomPriorityService', SymptomPriorityService, []);

  // Response safety validator
  if (config.responseSafetyValidator) container.registerInstance('responseSafetyValidator', config.responseSafetyValidator);
  else container.register('responseSafetyValidator', () => new ResponseSafetyValidator({ strictMode: false }));

  if (config.clinicalOrchestratorService) container.registerInstance('clinicalOrchestratorService', config.clinicalOrchestratorService);
  else {
    container.register('clinicalOrchestratorService', (c) => new ClinicalOrchestratorService({
      clinicalRepo: c.resolve('clinicalRepo'),
      encounterRepo: c.resolve('encounterRepo'),
      documentRepo: c.resolve('documentRepo'),
      rulesService: c.resolve('clinicalRulesService'),
      clinicalRulesService: c.resolve('clinicalRulesService'),
      llmService: c.resolve('llmService'),
      symptomPriorityService: c.resolve('symptomPriorityService'),
      responseSafetyValidator: c.resolve('responseSafetyValidator'),
    }));
  }

  if (config.healthService) container.registerInstance('healthService', config.healthService);
  else container.register('healthService', (c) => new HealthService(c.resolve('repos'), { batchLimit: config.healthBatchLimit || 200 }));

  if (config.memberService) container.registerInstance('memberService', config.memberService);
  else container.register('memberService', (c) => new MemberService(c.resolve('repos')));

  if (config.wearableService) container.registerInstance('wearableService', config.wearableService);
  else container.register('wearableService', (c) => new WearableService(c.resolve('repos')));

  if (config.clinicalController) container.registerInstance('clinicalController', config.clinicalController);
  else container.registerClass('clinicalController', ClinicalController, ['clinicalService']);

  if (config.encounterController) container.registerInstance('encounterController', config.encounterController);
  else container.registerClass('encounterController', EncounterController, ['encounterService']);

  if (config.documentController) container.registerInstance('documentController', config.documentController);
  else container.registerClass('documentController', DocumentController, ['documentService', 'documentRepo']);

  if (config.orchestratorController) container.registerInstance('orchestratorController', config.orchestratorController);
  else {
    container.register('orchestratorController', (c) => new OrchestratorController({
      clinicalOrchestratorService: c.resolve('clinicalOrchestratorService'),
      clinicalRulesService: c.resolve('clinicalRulesService'),
      clinicalRepo: c.resolve('clinicalRepo'),
    }));
  }

  if (config.healthController) container.registerInstance('healthController', config.healthController);
  else container.registerClass('healthController', HealthController, ['healthService']);

  if (config.memberController) container.registerInstance('memberController', config.memberController);
  else container.registerClass('memberController', MemberController, ['memberService']);

  return container;
}
