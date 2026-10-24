export function requireConsent(clinicalRepo, scope = 'ai_processing') {
  return async (req, res, next) => {
    try {
      if (!req.memberId) {
        return res.status(401).json({
          error: { code: 'unauthorized', message: 'Authentication required before checking consent' }
        });
      }

      const consent = await clinicalRepo.getConsent(req.memberId, scope);
      if (!consent?.granted) {
        return res.status(403).json({
          error: { code: 'consent_required', message: `Patient consent required for scope: ${scope}` }
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
