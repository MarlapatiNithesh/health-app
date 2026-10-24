import { Router } from 'express';
import multer from 'multer';
import { requireAuthentication } from '../middleware/authentication.js';
import { globalCache } from '../cache/cache-manager.js';
import { logger } from '../logger.js';

const defaultUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function tagLogger(tag) {
  return (req, _res, next) => {
    logger.info(`[${tag}] ${req.method} ${req.baseUrl || ''}${req.path}`, {
      memberId: req.memberId,
      params: req.params,
    });
    next();
  };
}

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
  const consent = consentMiddleware || ((req, res, next) => next());

  const handleUpload = [auth, consent, tagLogger('TAG: DOCUMENTS'), upload.single('file'), documentController.upload];
  const handleList = [auth, consent, tagLogger('TAG: DOCUMENTS'), globalCache.routeCache(10_000), documentController.listDocuments];
  const handleGet = [auth, consent, tagLogger('TAG: DOCUMENTS'), documentController.getDocument];
  const handleCommit = [auth, consent, tagLogger('TAG: DOCUMENTS'), documentController.commitFields];

  if (prefix) {
    router.post(`${prefix}/upload`, ...handleUpload);
    router.post(prefix, ...handleUpload);
    router.get(prefix, ...handleList);
    router.post(`${prefix}/:id/commit`, ...handleCommit);
    router.get(`${prefix}/:id`, ...handleGet);
  } else {
    router.post('/upload', ...handleUpload);
    router.post('/', ...handleUpload);
    router.get('/', ...handleList);
    router.post('/:id/commit', ...handleCommit);
    router.get('/:id', ...handleGet);
  }

  return router;
}
