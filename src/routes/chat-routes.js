import { Router } from 'express';
import { requireAuthentication } from '../middleware/authentication.js';
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

export function createChatRouter({
  jwtSecret,
  memberRepo = null,
  orchestratorController,
  authMiddleware = null,
  consentMiddleware = null,
}) {
  const router = Router();
  const auth = authMiddleware || requireAuthentication(jwtSecret, memberRepo);
  const consent = consentMiddleware || ((req, res, next) => next());

  router.post(
    '/chat',
    auth,
    consent,
    tagLogger('TAG: CLINICAL_TRIAGE_AI'),
    orchestratorController.chat
  );

  router.post(
    '/rag',
    auth,
    consent,
    tagLogger('TAG: CLINICAL_TRIAGE_AI'),
    orchestratorController.ragQuery
  );

  router.post(
    '/rules/validate',
    auth,
    consent,
    tagLogger('TAG: CLINICAL_TRIAGE_AI'),
    orchestratorController.validateDrug
  );

  router.post(
    '/chat/feedback',
    auth,
    consent,
    tagLogger('TAG: CHAT_FEEDBACK'),
    orchestratorController.submitFeedback
  );

  router.post(
    '/chat/summarize',
    auth,
    consent,
    tagLogger('TAG: CHAT_SUMMARIZE'),
    orchestratorController.summarizeChat
  );

  return router;
}
