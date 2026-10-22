// health/uploader.js — uploads phone health data to YOUR backend using the member's JWT.
// Adapted to match the backend's validateHealthSample schema in validation/input.js:
//   Required: provider, metric, externalId, recordedAt, unit, value
//   Backend PUT /v1/me/phone-health/connection expects: provider, platform, permissions[], status
//   Backend POST /v1/me/phone-health/sync expects: { samples: [...] }
import { NativeModules, Platform } from 'react-native';

const extractHost = (val) => {
  if (!val || typeof val !== 'string') return null;
  const match = val.match(/^https?:\/\/([^:/]+)/) || val.match(/^([^:/]+)/);
  const host = match ? match[1] : null;
  return host && host !== 'localhost' && host !== '127.0.0.1' && host !== '0.0.0.0' ? host : null;
};

const getDevServerHost = () => {
  try {
    const fromPlatform = extractHost(Platform?.constants?.ServerHost) ||
                         extractHost(NativeModules?.PlatformConstants?.ServerHost);
    if (fromPlatform) return fromPlatform;

    const fromScript = extractHost(NativeModules?.SourceCode?.scriptURL);
    if (fromScript) return fromScript;

    const fromDev = extractHost(NativeModules?.DevSettings?.reloadWithLauncherUrl);
    if (fromDev) return fromDev;

    const expoConstants = NativeModules?.ExponentConstants;
    const manifest = expoConstants?.manifest || expoConstants?.manifest2;
    const fromManifest = extractHost(manifest?.debuggerHost || manifest?.extra?.expoClient?.hostUri || manifest?.extra?.expoGo?.debuggerHost);
    if (fromManifest) return fromManifest;

    return null;
  } catch {
    return null;
  }
};

// Cache the verified working backend host across sync calls so subsequent uploads connect instantly
let cachedWorkingBase = null;

async function call(apiBase, token, method, path, body, extraHeaders = {}) {
  const isAndroid = Platform.OS === 'android';
  const devHost = getDevServerHost();
  const validDevHost = devHost && devHost !== 'localhost' && devHost !== '127.0.0.1';

  // Build host candidate list dynamically — NO HARDCODED LAN IPs
  const candidateSet = new Set();

  // 1. If we previously found a working base in this session, prioritize it
  if (cachedWorkingBase) {
    candidateSet.add(cachedWorkingBase);
  }

  // 2. Dynamic host where Metro served this app bundle (matches current Wi-Fi / hotspot automatically)
  if (validDevHost) {
    candidateSet.add(`http://${devHost}:4000`);
  }

  // 3. Auto-detected computer LAN IP (from sync-dev-ip.js, zero manual configuration)
  const devMachineIp = process.env.EXPO_PUBLIC_DEV_MACHINE_IP;
  if (devMachineIp && devMachineIp !== 'localhost' && devMachineIp !== '127.0.0.1') {
    candidateSet.add(`http://${devMachineIp}:4000`);
  }

  // 4. Android USB reverse / direct ADB connection (1ms latency when USB is plugged in)
  if (isAndroid) {
    candidateSet.add('http://127.0.0.1:4000');
  }

  // 4. Clean caller-supplied apiBase (e.g. from environment or remote deployment)
  if (apiBase && typeof apiBase === 'string') {
    const clean = apiBase.trim().replace(/\/+$/, '');
    if (clean) candidateSet.add(clean);
  }

  // 5. Android emulator loopback & standard local loopbacks
  if (isAndroid) {
    candidateSet.add('http://10.0.2.2:4000');
  }
  candidateSet.add('http://127.0.0.1:4000');
  candidateSet.add('http://localhost:4000');

  const candidates = Array.from(candidateSet);

  let lastErr = null;
  for (const base of candidates) {
    let timerId = null;
    try {
      const controller = new AbortController();
      // Fast 4.5s timeout per candidate so unreachable IPs fail fast
      timerId = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(`${base}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...extraHeaders,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (timerId) clearTimeout(timerId);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`);
      }

      // Successfully connected! Cache this host for all subsequent requests
      cachedWorkingBase = base;
      return await res.json().catch(() => ({}));
    } catch (err) {
      if (timerId) clearTimeout(timerId);
      lastErr = err;

      // Invalidate cached base if it stopped working (e.g. network switch)
      if (cachedWorkingBase === base) {
        cachedWorkingBase = null;
      }

      // If the backend returned an explicit HTTP error status code (e.g. 400, 401, 404),
      // the server is reachable and responded, so do NOT try other candidate hosts.
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

