import { Router } from 'express';
import multer from 'multer';
import { requireAuthentication } from '../middleware/authentication.js';
import { requireConsent } from '../middleware/consent-gate.js';
import { globalCache } from '../cache/cache-manager.js';
import { tagLogger } from '../middleware/tag-logger.js';
import { createChatRouter } from './chat-routes.js';
import { createDocumentRouter } from './document-routes.js';
import { createEncounterRouter } from './encounter-routes.js';
import { createClinicalRouter } from './clinical-routes.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export function createMedibotRouter({
  jwtSecret,
  memberRepo,
  clinicalRepo,
  clinicalController,
  encounterController,
  documentController,
  orchestratorController,
}) {
  const router = Router();
  const auth = requireAuthentication(jwtSecret, memberRepo);
  const consentGate = requireConsent(clinicalRepo);

  router.get(
    '/status',
    tagLogger('TAG: STATUS'),
    globalCache.routeCache(30_000),
    (_req, res) => {
      res.json({
        status: 'ok',
        architecture: 'in_process_monolith',
        runtime: 'node_esm_javascript',
        database: 'postgresql_native',
        caching: {
          l1_api_route_cache: 'active',
          l2_server_lru_cache: 'active',
          l3_db_request_coalescing: 'active',
        },
        modules: {
          patient_service: 'active',
          encounter_service: 'active',
          document_service: 'active',
          clinical_rules: 'active',
          llm_orchestrator: 'active',
        },
        timestamp: new Date().toISOString(),
      });
    }
  );

  router.use(createClinicalRouter({ authMiddleware: auth, consentMiddleware: consentGate, clinicalController }));
  router.use(createEncounterRouter({ authMiddleware: auth, consentMiddleware: consentGate, encounterController }));
  router.use(createDocumentRouter({ authMiddleware: auth, consentMiddleware: consentGate, documentController, upload }));
  router.use(createChatRouter({ authMiddleware: auth, consentMiddleware: consentGate, orchestratorController }));

  return router;
}

export {
  createChatRouter,
  createDocumentRouter,
  createEncounterRouter,
  createClinicalRouter,
};
