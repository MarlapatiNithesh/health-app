import { createHmac, timingSafeEqual } from 'node:crypto';

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decode(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

export function createAccessToken(memberId, secret, expiresInSeconds = 3600) {
  if (!secret) throw new Error('JWT_SECRET is required');

  const now = Math.floor(Date.now() / 1000);
  const header  = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ sub: memberId, iat: now, exp: now + expiresInSeconds });

  const input     = `${header}.${payload}`;
  const signature = createHmac('sha256', secret).update(input).digest('base64url');

  return `${input}.${signature}`;
}

export function verifyAccessToken(token, secret) {
  if (!secret || typeof token !== 'string') return null;

  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) return null;

  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest();
  const actual   = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const tokenHeader = decode(header);
    const claims      = decode(payload);

    if (tokenHeader.alg !== 'HS256' || tokenHeader.typ !== 'JWT') return null;
    if (typeof claims.sub !== 'string' || !Number.isFinite(claims.exp)) return null;

    return claims.exp > Math.floor(Date.now() / 1000) ? claims : null;
  } catch {
    return null;
  }
}
