import { Router } from 'express';
import { requireAuthentication } from '../middleware/authentication.js';
import { globalCache } from '../cache/cache-manager.js';
import { logger } from '../logger.js';

function tagLogger(tag) {
  return (req, _res, next) => {
    logger.info(`[${tag}] ${req.method} ${req.baseUrl || ''}${req.path}`, {
      memberId: req.memberId,
      params: req.params,
    });
    next();
  };
}

export function createEncounterRouter({
  jwtSecret,
  memberRepo = null,
  encounterController,
  authMiddleware = null,
  consentMiddleware = null,
  prefix = '/encounters',
}) {
  const router = Router();
  const auth = authMiddleware || requireAuthentication(jwtSecret, memberRepo);
  const consent = consentMiddleware || ((req, res, next) => next());

  const handleCreate = [auth, consent, tagLogger('TAG: ENCOUNTERS'), encounterController.createEncounter];
  const handleList = [auth, consent, tagLogger('TAG: ENCOUNTERS'), globalCache.routeCache(10_000), encounterController.listEncounters];
  const handleGet = [auth, consent, tagLogger('TAG: ENCOUNTERS'), globalCache.routeCache(10_000), encounterController.getEncounter];
  const handleStatus = [auth, consent, tagLogger('TAG: ENCOUNTERS'), encounterController.updateStatus];
  const handleMessages = [auth, consent, tagLogger('TAG: ENCOUNTERS'), encounterController.postMessage];
  const handleGetSymptom = [auth, consent, tagLogger('TAG: ENCOUNTERS'), globalCache.routeCache(10_000), encounterController.getSymptomState];
  const handlePutSymptom = [auth, consent, tagLogger('TAG: ENCOUNTERS'), encounterController.updateSymptomState];

  if (prefix) {
    router.post(prefix, ...handleCreate);
    router.get(prefix, ...handleList);
    router.get(`${prefix}/:id/symptom-state`, ...handleGetSymptom);
    router.put(`${prefix}/:id/symptom-state`, ...handlePutSymptom);
    router.put(`${prefix}/:id/status`, ...handleStatus);
    router.post(`${prefix}/:id/messages`, ...handleMessages);
    router.get(`${prefix}/:id`, ...handleGet);
  } else {
    router.post('/', ...handleCreate);
    router.get('/', ...handleList);
    router.get('/:id/symptom-state', ...handleGetSymptom);
    router.put('/:id/symptom-state', ...handlePutSymptom);
    router.put('/:id/status', ...handleStatus);
    router.post('/:id/messages', ...handleMessages);
    router.get('/:id', ...handleGet);
  }

  return router;
}
