import { ApplicationError } from '../errors/application-error.js';
import { verifyAccessToken } from '../security/tokens.js';

export function requireAuthentication(jwtSecret, memberRepo = null) {
  return async (request, response, next) => {
    const authorization = request.headers.authorization;
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    const claims = verifyAccessToken(token, jwtSecret);

    if (!claims) {
      return next(new ApplicationError('Authentication required', 401, 'unauthorized'));
    }

    if (memberRepo?.findMemberById) {
      try {
        const member = await memberRepo.findMemberById(claims.sub);
        if (member && ['deleted', 'suspended', 'deletion_requested'].includes(member.status)) {
          return next(new ApplicationError(`Member account is ${member.status}`, 403, 'member_inactive'));
        }
      } catch (err) {
        return next(err);
      }
    }

    request.memberId = claims.sub;
    request.phone = claims.phone || claims.phoneE164 || null;
    request.phoneE164 = claims.phone || claims.phoneE164 || null;
    return next();
  };
}
