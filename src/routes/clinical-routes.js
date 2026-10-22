import { Router } from 'express';
import { requireAuthentication } from '../middleware/authentication.js';
import { globalCache } from '../cache/cache-manager.js';
import { tagLogger } from '../middleware/tag-logger.js';

export function createClinicalRouter({
  jwtSecret,
  memberRepo = null,
  clinicalController,
  authMiddleware = null,
  consentMiddleware = null,
}) {
  const router = Router();
  const auth = authMiddleware || requireAuthentication(jwtSecret, memberRepo);
  const consent = consentMiddleware || ((_req, _res, next) => next());

  router.get(
    '/patients/:patientId',
    auth,
    consent,
    tagLogger('TAG: PATIENT_360'),
    globalCache.routeCache(15_000),
    clinicalController.getProfile
  );
  router.put(
    '/patients/:patientId',
    auth,
    consent,
    tagLogger('TAG: PATIENT_360'),
    clinicalController.updateProfile
  );
  router.get(
    ['/patients/:patientId/summary-pdf', '/summary/pdf'],
    auth,
    tagLogger('TAG: SUMMARY_PDF'),
    clinicalController.getSummaryPdf
  );
  router.get(
    '/patients/:patientId/context',
    auth,
    consent,
    tagLogger('TAG: PATIENT_360'),
    globalCache.routeCache(15_000),
    clinicalController.getContext
  );
  router.get(
    '/patients/:patientId/timeline',
    auth,
    consent,
    tagLogger('TAG: PATIENT_360'),
    globalCache.routeCache(15_000),
    clinicalController.getTimeline
  );
  router.get(
    '/patients/:patientId/proactive-insights',
    auth,
    consent,
    tagLogger('TAG: PROACTIVE_INSIGHTS'),
    clinicalController.getProactiveInsights
  );

  router.get(
    '/patients/:patientId/conditions',
    auth,
    consent,
    tagLogger('TAG: CLINICAL_RECORDS'),
    globalCache.routeCache(10_000),
    clinicalController.getConditions
  );
  router.post(
    '/patients/:patientId/conditions',
    auth,
    consent,
    tagLogger('TAG: CLINICAL_RECORDS'),
    clinicalController.addCondition
  );

  router.get(
    '/patients/:patientId/medications',
    auth,
    consent,
    tagLogger('TAG: CLINICAL_RECORDS'),
    globalCache.routeCache(10_000),
    clinicalController.getMedications
  );
  router.post(
    '/patients/:patientId/medications',
    auth,
    consent,
    tagLogger('TAG: CLINICAL_RECORDS'),
    clinicalController.addMedication
  );

  router.get(
    '/patients/:patientId/allergies',
    auth,
    consent,
    tagLogger('TAG: CLINICAL_RECORDS'),
    globalCache.routeCache(10_000),
    clinicalController.getAllergies
  );
  router.post(
    '/patients/:patientId/allergies',
    auth,
    consent,
    tagLogger('TAG: CLINICAL_RECORDS'),
    clinicalController.addAllergy
  );

  router.get(
    '/patients/:patientId/labs',
    auth,
    consent,
    tagLogger('TAG: CLINICAL_RECORDS'),
    globalCache.routeCache(10_000),
    clinicalController.getLabs
  );
  router.post(
    '/patients/:patientId/labs',
    auth,
    consent,
    tagLogger('TAG: CLINICAL_RECORDS'),
    clinicalController.addLab
  );

  router.post(
    ['/consents', '/consents/:scope'],
    auth,
    tagLogger('TAG: CONSENTS'),
    clinicalController.setConsent
  );
  router.get(
    '/consents/:scope',
    auth,
    tagLogger('TAG: CONSENTS'),
    clinicalController.getConsent
  );

  return router;
}
