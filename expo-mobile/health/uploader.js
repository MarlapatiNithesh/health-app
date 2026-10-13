// health/uploader.js — uploads phone health data to YOUR backend using the member's JWT.
// Adapted to match the backend's validateHealthSample schema in validation/input.js:
//   Required: provider, metric, externalId, recordedAt, unit, value
//   Backend PUT /v1/me/phone-health/connection expects: provider, platform, permissions[], status
//   Backend POST /v1/me/phone-health/sync expects: { samples: [...] }
import { NativeModules, Platform } from 'react-native';

const getDevServerHost = () => {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (!scriptURL) return null;
    const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

async function call(apiBase, token, method, path, body, extraHeaders = {}) {
  const isAndroid = Platform.OS === 'android';
  const devHost = getDevServerHost();
  const validDevHost = devHost && devHost !== 'localhost' && devHost !== '127.0.0.1';

  const candidates = Array.from(new Set([
    'http://127.0.0.1:4000',
    'http://localhost:4000',
    validDevHost ? `http://${devHost}:4000` : null,
    apiBase,
    isAndroid ? 'http://10.0.2.2:4000' : null,
  ].filter(Boolean)));

  let lastErr = null;
  for (const base of candidates) {
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...extraHeaders,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`);
      }
      return await res.json().catch(() => ({}));
    } catch (err) {
      lastErr = err;
      // If it returned an HTTP response status from the backend, don't try other hosts
      if (err.message && err.message.includes('→')) {
        throw err;
      }
    }
  }
  throw lastErr || new Error('Network request failed');
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function uploadHealth({ apiBase, token, samples, permissions }) {

  if (!token) {
    console.log('[Uploader] Skipped: no token');
    return { skipped: 'NO_TOKEN' };
  }
  if (!samples || samples.length === 0) {
    console.log('[Uploader] Skipped: no samples');
    return { skipped: 'NO_SAMPLES' };
  }

  // Samples can come from Health Connect/HealthKit and the phone pedometer.
  // Register each source separately because the backend validates connection
  // state and consent against the provider attached to every sample.
  const groups = new Map();
  for (const sample of samples) {
    const group = groups.get(sample.provider) || [];
    group.push(sample);
    groups.set(sample.provider, group);
  }

  const BATCH = 200;
  let uploaded = 0;
  let accepted = 0;
  const activeProviders = [];
  for (const [provider, providerSamples] of groups) {
    const sampleMetrics = [...new Set(providerSamples.map((sample) => sample.metric))];
    const providerPermissions = provider === 'phone_pedometer'
      ? ['steps']
      : (Array.isArray(permissions) && permissions.length > 0 ? permissions : sampleMetrics);

    await call(apiBase, token, 'PUT', '/v1/me/phone-health/connection', {
      provider,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      deviceId: provider === 'phone_pedometer' ? 'phone-motion-sensor' : undefined,
      status: 'connected',
      permissions: providerPermissions,
    });

    for (let i = 0; i < providerSamples.length; i += BATCH) {
      const chunk = providerSamples.slice(i, i + BATCH);
      const idempotencyKey = uuidv4();
      const result = await call(
        apiBase,
        token,
        'POST',
        '/v1/me/phone-health/sync',
        { samples: chunk },
        { 'Idempotency-Key': idempotencyKey }
      );
      uploaded += chunk.length;
      accepted += Number(result?.accepted ?? 0);
      console.log(`[Uploader] Synced ${uploaded}/${samples.length} samples (${provider})`);
    }

    activeProviders.push(provider);
  }

  return { uploaded, accepted, platform: Platform.OS, sources: activeProviders };
}

