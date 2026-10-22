import { Router } from 'express';
import multer from 'multer';
import { requireAuthentication } from '../middleware/authentication.js';
import { globalCache } from '../cache/cache-manager.js';
import { tagLogger } from '../middleware/tag-logger.js';

const defaultUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export function createDocumentRouter({
  jwtSecret,
  memberRepo = null,
  documentController,
  upload = defaultUpload,
  authMiddleware = null,
  consentMiddleware = null,
  prefix = '/documents',
}) {
  const router = Router();
  const auth = authMiddleware || requireAuthentication(jwtSecret, memberRepo);
  const consent = consentMiddleware || ((_req, _res, next) => next());

  const handleUpload = [auth, consent, tagLogger('TAG: DOCUMENTS'), upload.any(), documentController.upload];
  const handleList = [auth, consent, tagLogger('TAG: DOCUMENTS'), globalCache.routeCache(10_000), documentController.listDocuments];
  const handleGet = [auth, consent, tagLogger('TAG: DOCUMENTS'), documentController.getDocument];
  const handleCommit = [auth, consent, tagLogger('TAG: DOCUMENTS'), documentController.commitFields];

  const base = prefix ? prefix.replace(/\/$/, '') : '';

  router.post([`${base}/upload`, base || '/'], ...handleUpload);
  router.get(base || '/', ...handleList);
  router.post(`${base}/:id/commit`, ...handleCommit);
  router.get(`${base}/:id`, ...handleGet);

  return router;
}
