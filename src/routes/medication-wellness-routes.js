import { Router } from 'express';
import { requireAuthentication } from '../middleware/authentication.js';

function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function createMedicationWellnessRouter(controller, jwtSecret, memberRepo) {
  const router = Router();
  const auth = requireAuthentication(jwtSecret, memberRepo);

  // ── Medication Management & OCR Verification ────────────────────────────
  router.post('/medications/manual', auth, wrap(controller.addManualMedication.bind(controller)));
  router.get('/medications/schedules', auth, wrap(controller.getActiveMedications.bind(controller)));
  router.post('/medications/intake/mark', auth, wrap(controller.markDose.bind(controller)));
  router.post(
    '/medications/intake/verify-ocr',
    auth,
    controller.uploadMiddleware,
    wrap(controller.verifyMedicationOcr.bind(controller))
  );
  router.post('/medications/evaluate-reminders', auth, wrap(controller.evaluateDoseReminders.bind(controller)));

  // ── Wearables & Telemetry Anomaly / LLM Triage ──────────────────────────
  router.post('/wearables/telemetry/evaluate-anomaly', auth, wrap(controller.evaluateTelemetryAnomaly.bind(controller)));
  router.get('/wearables/anomalies/active', auth, wrap(controller.getActiveAnomalies.bind(controller)));

  // ── Metabolic Pacing, Caloric Budgeting & Dynamic Exercise ──────────────
  router.get('/wellness/metabolic-summary', auth, wrap(controller.getMetabolicSummary.bind(controller)));
  router.post('/wellness/meals/log', auth, wrap(controller.logMeal.bind(controller)));
  router.post('/wellness/water/log', auth, wrap(controller.logWater.bind(controller)));
  router.post('/wellness/exercise/recalculate', auth, wrap(controller.recalculateExercise.bind(controller)));
  router.post('/wellness/notifications/meal', auth, wrap(controller.dispatchMealNotification.bind(controller)));
  router.post('/wellness/notifications/exercise', auth, wrap(controller.dispatchExerciseNotification.bind(controller)));

  return router;
}
