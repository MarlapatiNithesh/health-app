import { Router } from 'express';
import { requireAuthentication } from '../middleware/authentication.js';
import { globalCache } from '../cache/cache-manager.js';
import { tagLogger } from '../middleware/tag-logger.js';

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
  const consent = consentMiddleware || ((_req, _res, next) => next());

  const handleCreate = [auth, consent, tagLogger('TAG: ENCOUNTERS'), encounterController.createEncounter];
  const handleList = [auth, consent, tagLogger('TAG: ENCOUNTERS'), globalCache.routeCache(10_000), encounterController.listEncounters];
  const handleGet = [auth, consent, tagLogger('TAG: ENCOUNTERS'), globalCache.routeCache(10_000), encounterController.getEncounter];
  const handleStatus = [auth, consent, tagLogger('TAG: ENCOUNTERS'), encounterController.updateStatus];
  const handleMessages = [auth, consent, tagLogger('TAG: ENCOUNTERS'), encounterController.postMessage];
  const handleGetSymptom = [auth, consent, tagLogger('TAG: ENCOUNTERS'), globalCache.routeCache(10_000), encounterController.getSymptomState];
  const handlePutSymptom = [auth, consent, tagLogger('TAG: ENCOUNTERS'), encounterController.updateSymptomState];

  const base = prefix ? prefix.replace(/\/$/, '') : '';

  router.post(base || '/', ...handleCreate);
  router.get(base || '/', ...handleList);
  router.get(`${base}/:id/symptom-state`, ...handleGetSymptom);
  router.put(`${base}/:id/symptom-state`, ...handlePutSymptom);
  router.put(`${base}/:id/status`, ...handleStatus);
  router.post(`${base}/:id/messages`, ...handleMessages);
  router.get(`${base}/:id`, ...handleGet);

  return router;
}
