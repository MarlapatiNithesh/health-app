import { logger } from '../logger.js';

export function tagLogger(tag) {
  return (req, _res, next) => {
    logger.info(`[${tag}] ${req.method} ${req.baseUrl || ''}${req.path}`, {
      memberId: req.memberId,
      params: req.params,
    });
    next();
  };
}
