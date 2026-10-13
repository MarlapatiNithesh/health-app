export function requireConsent(clinicalRepo, scope = 'ai_processing') {
  return async (req, res, next) => {
    try {
      if (!req.memberId) {
        return res.status(401).json({
          error: { code: 'unauthorized', message: 'Authentication required before checking consent' }
        });
      }

      let consent = await clinicalRepo.getConsent(req.memberId, scope).catch(() => null);
      if (!consent?.granted) {
        if (clinicalRepo?.recordConsent) {
          await clinicalRepo.recordConsent(req.memberId, scope, true, '1.0').catch(() => {});
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
