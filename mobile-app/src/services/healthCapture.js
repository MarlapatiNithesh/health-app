// healthCapture.js
// Proper pipeline: explain -> ask -> capture -> normalize -> dedupe -> queue -> upload.
// Sources: Apple Health / Health Connect (history + background) and BLE watch (live).
import { toNative } from '../native/nativeBridge';

// ---------- 1. What we ask for, and WHY (shown to the user BEFORE the system dialog) ----------
export const HEALTH_METRICS = {
  steps:      { label: 'Steps',            unit: 'count', why: 'To show your daily activity and goal progress.' },
  heart_rate: { label: 'Heart rate',       unit: 'bpm',   why: 'To show your resting and live heart rate and spot unusual changes.' },
  sleep:      { label: 'Sleep',            unit: 'min',   why: 'To show how long and how well you slept.' },
  spo2:       { label: 'Blood oxygen',     unit: '%',     why: 'To track your oxygen saturation trends.' },
  calories:   { label: 'Active calories',  unit: 'kcal',  why: 'To show how much energy you burn during the day.' },
  glucose:    { label: 'Blood glucose',    unit: 'mg/dL', why: 'To show your glucose readings alongside meals and activity.' },
};

// ---------- 2. Permission flow ----------
export const PERMISSION = {
  UNKNOWN: 'unknown',
  GRANTED: 'granted',
  PARTIAL: 'partial',
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
};

/**
 * ui must implement:
 *   ui.explain({ metrics })        -> Promise<boolean>   custom screen listing each metric + reason (user taps Continue/Not now)
 *   ui.showDenied({ missing })     -> Promise<'settings'|'cancel'>   explains what won't work, offers Open Settings
 * platformHealth must implement:
 *   isAvailable(), requestPermissions(metricKeys) -> { granted: [keys] }, getGranted() -> [keys], openSettings()
 */
export async function requestHealthAccess({ metrics, platformHealth, ui, storage = defaultStorage }) {
  if (!(await platformHealth.isAvailable())) return { status: PERMISSION.UNAVAILABLE, granted: [] };

  const alreadyGranted = await platformHealth.getGranted();
  const needed = metrics.filter((m) => !alreadyGranted.includes(m));
  if (!needed.length) return { status: PERMISSION.GRANTED, granted: alreadyGranted };

  // Pre-prompt: only ask the OS once the user understands why. Never prompt on app launch cold.
  const ok = await ui.explain({ metrics: needed.map((k) => ({ key: k, ...HEALTH_METRICS[k] })) });
  if (!ok) return { status: PERMISSION.DENIED, granted: alreadyGranted, declinedByUser: true };

  const { granted } = await platformHealth.requestPermissions(needed);
  const allGranted = [...new Set([...alreadyGranted, ...granted])];
  const missing = metrics.filter((m) => !allGranted.includes(m));

  await storage.setItem('health:consent', JSON.stringify({ metrics: allGranted, at: new Date().toISOString() }));

  if (!missing.length) return { status: PERMISSION.GRANTED, granted: allGranted };

  // NOTE: iOS never reveals if READ access was denied (privacy), so "missing" there only shows up
  // as empty data. Android reports it reliably. Handle both: don't nag, explain once, link to settings.
  const choice = await ui.showDenied({ missing: missing.map((k) => ({ key: k, ...HEALTH_METRICS[k] })) });
  if (choice === 'settings') await platformHealth.openSettings();
  return { status: allGranted.length ? PERMISSION.PARTIAL : PERMISSION.DENIED, granted: allGranted, missing };
}

// ---------- 3. Normalized sample (every source maps to this) ----------
export function makeSample({ metric, value, start, end, source, deviceId = null, provider = null }) {
  const s = new Date(start).toISOString();
  const e = new Date(end || start).toISOString();
  return {
    id: `${source}:${deviceId || 'na'}:${metric}:${s}:${e}`,   // deterministic => safe to re-send (idempotent)
    metric,
    value: Number(value),
    unit: HEALTH_METRICS[metric]?.unit || null,
    start: s,
    end: e,
    source,        // 'apple_health' | 'health_connect' | 'ble_live' | 'manual'
    provider: provider || source,
    deviceId,
  };
}

// Plausibility filter: drop sensor garbage before it reaches your database.
const LIMITS = {
  heart_rate: [25, 230],
  spo2: [70, 100],
  steps: [0, 100000],
  glucose: [20, 600],
  sleep: [0, 1440],
  calories: [0, 10000],
};

export const isPlausible = (s) =>
  Number.isFinite(s.value) &&
  (!LIMITS[s.metric] || (s.value >= LIMITS[s.metric][0] && s.value <= LIMITS[s.metric][1]));

// ---------- 4. Persistent queue + batch upload (works offline) ----------
export class HealthQueue {
  constructor({ storage = defaultStorage, upload, batchSize = 200, maxQueue = 20000 }) {
    this.storage = storage;
    this.upload = upload;
    this.batchSize = batchSize;
    this.maxQueue = maxQueue;
    this.flushing = false;
  }

  async _load() {
    try {
      const val = await this.storage.getItem('health:queue');
      return JSON.parse(val || '[]');
    } catch {
      return [];
    }
  }

  async _save(q) {
    try {
      await this.storage.setItem('health:queue', JSON.stringify(q.slice(-this.maxQueue)));
    } catch (e) {
      console.warn('[HealthQueue] Failed to save queue to storage:', e);
    }
  }

  async add(samples) {
    const clean = samples.filter(isPlausible);
    if (!clean.length) return;
    const q = await this._load();
    const seen = new Set(q.map((x) => x.id));
    for (const s of clean) {
      if (!seen.has(s.id)) {
        q.push(s);   // dedupe
        seen.add(s.id);
      }
    }
    await this._save(q);
  }

  async flush() {
    if (this.flushing) return;
    this.flushing = true;
    try {
      let q = await this._load();
      while (q.length) {
        const batch = q.slice(0, this.batchSize);
        await this.upload(batch);          // must be idempotent server-side (upsert by id)
        q = q.slice(batch.length);
        await this._save(q);               // only drop AFTER success
      }
    } finally {
      this.flushing = false;               // on failure the data stays queued for the next flush
    }
  }

  async size() {
    const q = await this._load();
    return q.length;
  }
}

// ---------- 5. Incremental history sync (Apple Health / Health Connect) ----------
// reader.read(metric, fromISO, toISO) -> [{ value, start, end, deviceId? }]
export async function syncHistory({ metrics, reader, source, queue, storage = defaultStorage, firstSyncDays = 30 }) {
  const now = new Date();
  for (const metric of metrics) {
    const key = `health:cursor:${source}:${metric}`;
    const last = await storage.getItem(key);
    const from = last
      ? new Date(new Date(last).getTime() - 5 * 60 * 1000)           // 5 min overlap, dedupe handles repeats
      : new Date(now.getTime() - firstSyncDays * 86400000);
    try {
      const rows = await reader.read(metric, from.toISOString(), now.toISOString());
      if (Array.isArray(rows) && rows.length > 0) {
        await queue.add(rows.map((r) => makeSample({ metric, source, ...r })));
      }
      await storage.setItem(key, now.toISOString());                 // advance cursor only on success
    } catch (e) {
      console.warn(`[health] ${metric} sync failed`, e);             // other metrics keep going
    }
  }
  await queue.flush().catch((err) => {
    console.warn('[health] Queue flush deferred:', err.message);
  });
}

// ---------- 6. Live BLE heart rate -> aggregated samples (don't store every beat) ----------
// Pass your BleWatchManager instance. Stores 1 sample per `windowSec` (avg) to keep data small.
export function captureLiveHeartRate({ ble, queue, windowSec = 30 }) {
  let buf = [];
  let windowStart = Date.now();
  const off = ble.on('heartRate', async ({ bpm, ts }) => {
    if (typeof bpm !== 'number' || bpm < 25 || bpm > 230) return;
    buf.push(bpm);
    if (ts - windowStart >= windowSec * 1000 && buf.length > 0) {
      const avg = Math.round(buf.reduce((a, b) => a + b, 0) / buf.length);
      await queue.add([makeSample({
        metric: 'heart_rate',
        value: avg,
        start: windowStart,
        end: ts,
        source: 'ble_live',
        deviceId: ble.device?.id,
        provider: ble.provider || 'bluetooth_ble',
      })]);
      buf = [];
      windowStart = ts;
      queue.flush().catch(() => {});
    }
  });

  const offState = ble.on('state', ({ state }) => {
    if (state === 'connected') {
      queue.flush().catch(() => {});
    }
  });

  return () => {
    off();
    offState();
  };
}

// ---------- 7. Default Browser / Hybrid Storage ----------
export const defaultStorage = {
  getItem: async (key) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  setItem: async (key, value) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, String(value));
    }
  },
  removeItem: async (key) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  },
};

// ---------- 8. Web & Hybrid Platform Health Implementation ----------
export class WebPlatformHealth {
  constructor({ platform = 'web', openSettingsCallback = null } = {}) {
    this.platform = platform;
    this.openSettingsCallback = openSettingsCallback;
  }

  async isAvailable() {
    if (typeof window === 'undefined') return false;
    // Available if Web Bluetooth or local sensors or native shell bridge exists
    return (
      !!navigator.bluetooth ||
      !!window.DeviceMotionEvent ||
      !!window.ReactNativeWebView ||
      !!window.__IS_NATIVE_APP__
    );
  }

  async getGranted() {
    try {
      const raw = await defaultStorage.getItem('health:consent');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.metrics)) return parsed.metrics;
      }
    } catch {}
    return [];
  }

  async requestPermissions(metricKeys) {
    // In web environment, consent granted via UI pre-prompt is stored
    return { granted: metricKeys };
  }

  async openSettings() {
    if (typeof this.openSettingsCallback === 'function') {
      return this.openSettingsCallback();
    }
    if (typeof window !== 'undefined' && window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_HEALTH_SETUP' }));
    }
  }
}

// ---------- 9. Native BLE Bridge (Direct React Native Shell Bridge) ----------
export class NativeBleBridge {
  constructor() {
    this.provider = 'bluetooth_ble';
    this.device = null;
    this.state = 'disconnected';
    this.listeners = new Map();
    if (typeof window !== 'undefined') {
      window.addEventListener('nativeBle', (e) => this._handle(e?.detail || {}));
    }
  }

  on(ev, fn) {
    if (!this.listeners.has(ev)) this.listeners.set(ev, new Set());
    this.listeners.get(ev).add(fn);
    return () => this.listeners.get(ev)?.delete(fn);
  }

  emit(ev, d) {
    this.listeners.get(ev)?.forEach((fn) => {
      try { fn(d); } catch {}
    });
  }

  _handle({ event, data } = {}) {
    if (!event) return;
    if (event === 'connectedDevice') this.device = data;
    if (event === 'state') { this.state = data?.state || 'unknown'; }
    // events: device, scanState, error, heartRate, battery, state
    this.emit(event === 'state' ? 'state' : event, event === 'state' ? { ...(data || {}), device: this.device } : data);
  }

  scan()            { toNative('BLE_SCAN_START', {}); }
  stopScan()        { toNative('BLE_SCAN_STOP', {}); }
  connect(deviceId) { toNative('BLE_CONNECT', { deviceId }); }
  disconnect()      { toNative('BLE_DISCONNECT', {}); }
}

// ---------- 10. BLE Watch Manager (Physical GATT + Event Bridge) ----------
export class BleWatchManager {
  constructor({ provider = 'bluetooth_ble', device = null } = {}) {
    this.provider = provider;
    this.device = device;
    this.state = device ? 'connected' : 'disconnected';
    this.listeners = new Map();
    this.gattServer = null;
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) handlers.delete(handler);
  }

  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (e) {
          console.error(`[BleWatchManager] Error in listener for ${event}:`, e);
        }
      }
    }
  }

  setDevice(device, provider = null) {
    this.device = device;
    if (provider) this.provider = provider;
    this.state = device ? 'connected' : 'disconnected';
    this.emit('state', { state: this.state, device: this.device });
  }

  /**
   * Connects to a physical Web Bluetooth device and hooks standard GATT characteristics:
   * 0x180D (Heart Rate Service), 0x180F (Battery Service)
   */
  async attachPhysicalGatt(bluetoothDevice) {
    if (!bluetoothDevice || !bluetoothDevice.gatt) return;
    this.device = {
      id: bluetoothDevice.id,
      name: bluetoothDevice.name || 'Smartwatch',
    };
    this.emit('state', { state: 'connecting', device: this.device });

    const server = await bluetoothDevice.gatt.connect();
    this.gattServer = server;
    this.state = 'connected';
    this.emit('state', { state: 'connected', device: this.device });

    // Handle heart rate GATT notifications
    try {
      const hrService = await server.getPrimaryService('heart_rate');
      const hrChar = await hrService.getCharacteristic('heart_rate_measurement');
      await hrChar.startNotifications();
      hrChar.addEventListener('characteristicvaluechanged', (event) => {
        const val = event.target.value;
        const flags = val.getUint8(0);
        // Bit 0: 0 = UINT8 BPM, 1 = UINT16 BPM
        const bpm = (flags & 0x01) ? val.getUint16(1, /*littleEndian=*/true) : val.getUint8(1);
        if (bpm > 0) {
          this.emit('heartRate', { bpm, ts: Date.now() });
        }
      });
    } catch (e) {
      console.warn('[BleWatchManager] Heart rate GATT service not available:', e.message);
    }

    // Handle battery level reading
    try {
      const batteryService = await server.getPrimaryService('battery_service');
      const batteryChar = await batteryService.getCharacteristic('battery_level');
      const batteryVal = await batteryChar.readValue();
      const battery = batteryVal.getUint8(0);
      this.emit('battery', { battery, ts: Date.now() });
    } catch {}

    bluetoothDevice.addEventListener('gattserverdisconnected', () => {
      this.state = 'disconnected';
      this.emit('state', { state: 'disconnected', device: this.device });
    });
  }

  disconnect() {
    if (this.gattServer && this.gattServer.connected) {
      try {
        this.gattServer.disconnect();
      } catch {}
    }
    this.state = 'disconnected';
    this.emit('state', { state: 'disconnected', device: this.device });
  }
}
