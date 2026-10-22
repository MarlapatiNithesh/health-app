import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuthentication } from '../middleware/authentication.js';

export function createHealthRouter(controller, jwtSecret) {
  const router = Router();

  router.use(requireAuthentication(jwtSecret));

  router.put('/phone-health/connection', asyncHandler((request, response) =>
    controller.savePhoneConnection(request, response)));

  router.get('/phone-health/connection', asyncHandler((request, response) =>
    controller.getPhoneConnection(request, response)));

  router.post(['/phone-health/sync', '/samples', '/health/samples'], asyncHandler((request, response) =>
    controller.ingestHealthData(request, response)));

  router.post(['/manual', '/health/manual'], asyncHandler((request, response) =>
    controller.ingestManualHealthData(request, response)));

  router.get('/daily-summary', asyncHandler((request, response) =>
    controller.getDailySummary(request, response)));

  return router;
}

export const createPhoneHealthRouter = createHealthRouter;
export default createHealthRouter;
