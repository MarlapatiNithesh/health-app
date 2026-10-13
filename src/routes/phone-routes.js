import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { verifyAccessToken } from '../security/tokens.js';

function optionalAuth(jwtSecret) {
  return (request, _response, next) => {
    const authorization = request.headers.authorization;
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (token && jwtSecret) {
      const claims = verifyAccessToken(token, jwtSecret);
      if (claims?.sub) {
        request.memberId = claims.sub;
      }
    }
    next();
  };
}

export function createPhoneRouter(phoneController, jwtSecret = null) {
  const router = Router();
  router.use(optionalAuth(jwtSecret));

  router.post('/send-otp', asyncHandler((request, response) =>
    phoneController.sendOtp(request, response)));

  router.post('/verify-otp', asyncHandler((request, response) =>
    phoneController.verifyOtp(request, response)));

  return router;
}
