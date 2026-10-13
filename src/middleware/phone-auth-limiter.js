export function createPhoneAuthLimiter({ windowMs = 15 * 60 * 1000, max = 30 } = {}) {
  const ipRequests = new Map();

  return (request, response, next) => {
    const ip = request.ip || request.headers['x-forwarded-for']?.split(',')[0]?.trim() || request.socket?.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const timestamps = (ipRequests.get(ip) || []).filter((ts) => now - ts < windowMs);

    if (timestamps.length >= max) {
      return response.status(429).json({
        error: 'RATE_LIMITED',
        message: 'Too many requests, please try again later.',
      });
    }

    timestamps.push(now);
    ipRequests.set(ip, timestamps);
    return next();
  };
}
