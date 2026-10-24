import { Router } from 'express';
import { requireAuthentication } from '../middleware/authentication.js';

export function createNotificationRouter(notificationController, jwtSecret, memberRepo) {
  const router = Router();
  const auth   = requireAuthentication(jwtSecret, memberRepo);

  router.post  ('/tokens',              auth, wrap(notificationController.registerToken));
  router.delete('/tokens/:token',       auth, wrap(notificationController.deregisterToken));

  router.get ('/preferences',           auth, wrap(notificationController.listPreferences));
  router.put ('/preferences/:category', auth, wrap(notificationController.updatePreference));

  router.get ('/',                      auth, wrap(notificationController.listNotifications));
  router.get ('/stats',                 auth, wrap(notificationController.getStats));
  router.post('/:id/engage',            auth, wrap(notificationController.recordEngagement));

  router.post('/test',                  auth, wrap(notificationController.sendTestNotification));

  return router;
}

function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
