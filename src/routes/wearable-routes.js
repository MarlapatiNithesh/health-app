import express, { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuthentication } from '../middleware/authentication.js';

export function createWearableRouter(controller, jwtSecret) {
  const router = Router();

  router.use(requireAuthentication(jwtSecret));

  router.get('/providers', asyncHandler((request, response) =>
    controller.listProviders(request, response)));

  router.get('/connections', asyncHandler((request, response) =>
    controller.listConnections(request, response)));

  router.delete('/connections', asyncHandler((request, response) =>
    controller.disconnectAllConnections(request, response)));

  router.delete('/connections/:provider', asyncHandler((request, response) =>
    controller.disconnectConnection(request, response)));

  router.post('/connections/:provider/connect', asyncHandler((request, response) =>
    controller.connectProvider(request, response)));

  router.post('/connections/:provider/sync', asyncHandler((request, response) =>
    controller.syncProvider(request, response)));

  router.get('/sync/runs', asyncHandler((request, response) =>
    controller.getSyncRuns(request, response)));

  router.get('/sync/recent', asyncHandler((request, response) =>
    controller.getSyncRecent(request, response)));

  router.post('/connect-session', asyncHandler((request, response) =>
    controller.createConnectSession(request, response)));

  router.post('/sdk-session', asyncHandler((request, response) =>
    controller.createSdkSession(request, response)));

  router.post('/sdk-sync', asyncHandler((request, response) =>
    controller.syncSdkData(request, response)));

  router.delete('/sdk-connection/:provider', asyncHandler((request, response) =>
    controller.disconnectSdkProvider(request, response)));

  router.get('/devices', asyncHandler((request, response) =>
    controller.listDevices(request, response)));

  router.post('/devices', asyncHandler((request, response) =>
    controller.addDevice(request, response)));

  router.patch('/devices/:deviceId', asyncHandler((request, response) =>
    controller.updateDevice(request, response)));

  router.delete('/devices/:deviceId', asyncHandler((request, response) =>
    controller.removeDevice(request, response)));

  router.post('/devices/:deviceId/sync', asyncHandler((request, response) =>
    controller.syncDevice(request, response)));

  router.get('/timeseries', asyncHandler((request, response) =>
    controller.listTimeseries(request, response)));

  router.get('/workouts', asyncHandler((request, response) =>
    controller.listWorkouts(request, response)));

  router.get('/sleep', asyncHandler((request, response) =>
    controller.listSleepSessions(request, response)));

  router.get('/health-scores', asyncHandler((request, response) =>
    controller.listHealthScores(request, response)));

  router.get('/womens-health', asyncHandler((request, response) =>
    controller.listWomensHealth(request, response)));

  router.get('/sync-logs', asyncHandler((request, response) =>
    controller.getSyncLogs(request, response)));

  router.post(
    '/import/apple/xml',
    express.raw({ type: '*/*', limit: '500mb' }),
    asyncHandler((request, response) => controller.importAppleXml(request, response)),
  );

  return router;
}
