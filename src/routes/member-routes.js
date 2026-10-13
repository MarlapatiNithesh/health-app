import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuthentication } from '../middleware/authentication.js';

export function createMemberRouter(controller, jwtSecret, memberRepo = null) {
  const router = Router();

  // Allow delete account even if the member was already soft-deleted (GDPR idempotency)
  router.delete('/', requireAuthentication(jwtSecret), asyncHandler((request, response) =>
    controller.deleteAccount(request, response)));

  // For other profile endpoints, require an active member
  router.use(requireAuthentication(jwtSecret, memberRepo));

  router.get('/profile', asyncHandler((request, response) =>
    controller.profile(request, response)));

  router.get('/profile/history', asyncHandler((request, response) =>
    controller.profileHistory(request, response)));

  router.get('/profile/weight-progress', asyncHandler((request, response) =>
    controller.weightProgress(request, response)));

  router.patch('/profile', asyncHandler((request, response) =>
    controller.updateProfile(request, response)));

  router.post('/consents', asyncHandler((request, response) =>
    controller.consent(request, response)));
  router.get('/consents/:scope', asyncHandler((request, response) =>
    controller.getConsent(request, response)));

  return router;
}
