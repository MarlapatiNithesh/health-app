import { timingSafeEqual } from 'node:crypto';
import { Webhook } from 'svix';

export function matchesSecret(provided, expected) {
  if (!provided || !expected || typeof provided !== 'string' || typeof expected !== 'string') {
    return false;
  }

  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);

  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }

  return timingSafeEqual(providedBytes, expectedBytes);
}

export function verifyWebhookSignature(headers = {}, rawBody, secret, { toleranceSeconds = 300 } = {}) {
  // Fail closed if secret is missing or empty
  if (!secret || typeof secret !== 'string' || secret.trim() === '') {
    return false;
  }

  // 1. Direct shared-secret headers (Bearer token or raw secret)
  const candidateSecret = headers['x-webhook-secret']
    || headers['webhook-secret']
    || headers['authorization'];

  if (candidateSecret && typeof candidateSecret === 'string') {
    const cleanProvided = candidateSecret.startsWith('Bearer ')
      ? candidateSecret.slice(7).trim()
      : candidateSecret.trim();
    if (matchesSecret(cleanProvided, secret)) {
      return true;
    }
  }

  // 2. Svix HMAC-SHA256 signature verification
  const msgSignature = headers['svix-signature'] || headers['webhook-signature'];
  if (msgSignature && rawBody) {
    const msgTimestamp = headers['svix-timestamp'] || headers['webhook-timestamp'];
    if (msgTimestamp) {
      const ts = Number(msgTimestamp);
      if (Number.isFinite(ts)) {
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - ts) > toleranceSeconds) {
          return false;
        }
      }
    }

    try {
      const wh = new Webhook(secret);
      wh.verify(rawBody, headers);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export function verifySvixSignature(rawBody, headers, secret, options) {
  return verifyWebhookSignature(headers, rawBody, secret, options);
}
