import { BleManager, State, ScanMode } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';

const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HR_CHAR = '00002a37-0000-1000-8000-00805f9b34fb';
const BATT_SERVICE = '0000180f-0000-1000-8000-00805f9b34fb';
const BATT_CHAR = '00002a19-0000-1000-8000-00805f9b34fb';

let manager = null;
const getManager = () => (manager ||= new BleManager());

let connected = null; // Device
let hrSub = null;
let discSub = null;

export async function ensureBlePermissions() {
  if (Platform.OS !== 'android') return true; // iOS prompts automatically on first scan
  if (Platform.Version >= 31) { // Android 12/13/14
    const r = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    const scanGranted = r[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
    const connectGranted = r[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
    return scanGranted && connectGranted;
  }
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

export function waitForPoweredOn(timeoutMs = 8000) {
  const m = getManager();
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => {
      if (!done) {
        done = true;
        sub?.remove?.();
        clearTimeout(t);
        resolve(ok);
      }
    };
    const sub = m.onStateChange((s) => {
      if (s === State.PoweredOn) finish(true);
      if (s === State.Unsupported) finish(false);
    }, true);
    const t = setTimeout(() => finish(false), timeoutMs);
  });
}

// Scan: shows ALL devices, with diagnostics
export async function startScan(onDevice, onError, onDiag) {
  const diag = (stage, extra = {}) => {
    console.log('[BLE diag]', stage, extra);
    onDiag?.({ stage, ...extra });
  };

  diag('requesting_permissions');
  if (!(await ensureBlePermissions())) throw new Error('BLE_PERMISSION_DENIED');
  diag('permissions_ok');

  if (!(await waitForPoweredOn())) throw new Error('BLUETOOTH_OFF');
  diag('bluetooth_on');

  const seen = new Map();
  getManager().startDeviceScan(
    null,
    { allowDuplicates: true, scanMode: ScanMode?.LowLatency ?? 2 },
    (err, d) => {
      if (err) {
        diag('scan_error', { message: err.message });
        return onError?.(err);
      }
      if (!d) return;
      const name = d.name || d.localName || null;
      const prev = seen.get(d.id);

      // If already recorded and no new name discovered, skip spamming
      if (prev && (!name || prev.name === name)) {
        return;
      }

      seen.set(d.id, { name, rssi: d.rssi });
      console.log('[BLE] found', d.id, name, d.rssi, d.serviceUUIDs);

      // Identify proximity: RSSI >= -45 dBm is literally in your hand or touching the phone
      const isRightHere = typeof d.rssi === 'number' && d.rssi >= -50;
      const fallbackName = isRightHere
        ? `Smartwatch in Hand (${d.id.slice(-5)})`
        : `Nearby Device (${d.id.slice(-5)})`;

      onDevice({
        id: d.id,
        name: name || fallbackName,
        rawName: name,
        rssi: d.rssi,
        isClosest: isRightHere,
        proximity: isRightHere ? 'in_hand' : (d.rssi >= -70 ? 'nearby' : 'far'),
        serviceUUIDs: d.serviceUUIDs || [],
        hasHeartRate: (d.serviceUUIDs || []).some((u) => u.toLowerCase().startsWith('0000180d')),
      });
      diag('device_found', { count: seen.size });
    }
  );
  diag('scanning');
}

export const stopScan = () => {
  try {
    getManager().stopDeviceScan();
  } catch {}
};

// Connect: bond if needed, then discover what the watch supports
export async function connect(id, { onHeartRate, onBattery, onState, onServices }) {
  stopScan();
  await disconnect();
  onState?.('connecting');
  const dev = await getManager().connectToDevice(id, { timeout: 20000, autoConnect: false });
  onState?.('discovering');
  await dev.discoverAllServicesAndCharacteristics();
  connected = dev;
  discSub = dev.onDisconnected(() => {
    connected = null;
    onState?.('disconnected');
  });

  // Try reading real device name directly from Generic Access Service (0x1800 -> 0x2A00)
  let resolvedName = dev.name;
  try {
    const nameChar = await dev.readCharacteristicForService('00001800-0000-1000-8000-00805f9b34fb', '00002a00-0000-1000-8000-00805f9b34fb');
    if (nameChar?.value) {
      const decoded = Buffer.from(nameChar.value, 'base64').toString('utf8').replace(/\0/g, '').trim();
      if (decoded) resolvedName = decoded;
    }
  } catch {}

  // If still unnamed, try Device Information Service (0x180A -> 0x2A24 Model Number)
  if (!resolvedName) {
    try {
      const modelChar = await dev.readCharacteristicForService('0000180a-0000-1000-8000-00805f9b34fb', '00002a24-0000-1000-8000-00805f9b34fb');
      if (modelChar?.value) {
        const decoded = Buffer.from(modelChar.value, 'base64').toString('utf8').replace(/\0/g, '').trim();
        if (decoded) resolvedName = decoded;
      }
    } catch {}
  }

  // Report every service the watch exposes (shows what is supported)
  const services = await dev.services();
  const list = [];
  for (const s of services) {
    const chars = await s.characteristics().catch(() => []);
    list.push({ service: s.uuid, characteristics: chars.map((c) => c.uuid) });
  }
  onServices?.(list);

  // Attempt battery read regardless of heart rate support
  try {
    const c = await dev.readCharacteristicForService(BATT_SERVICE, BATT_CHAR);
    if (c?.value) {
      const batLvl = Buffer.from(c.value, 'base64')[0];
      if (typeof batLvl === 'number' && batLvl >= 0 && batLvl <= 100) {
        onBattery?.({ battery: batLvl, ts: Date.now() });
      }
    }
  } catch {}

  const hasHR = services.some((s) => s.uuid.toLowerCase().startsWith('0000180d'));
  if (!hasHR) {
    console.log('[BLE] Device connected without standard 0x180D GATT HR service. Discovered services:', list.map(s => s.service));
    onState?.('connected_no_heart_rate'); // connected, but watch syncs steps/vitals via companion app & Health Connect
    return { id: dev.id, name: resolvedName || dev.name || 'Smartwatch', heartRate: false };
  }

  onState?.('pairing_may_prompt'); // reading a protected characteristic triggers the OS pairing dialog
  hrSub = dev.monitorCharacteristicForService(HR_SERVICE, HR_CHAR, (err, ch) => {
    if (err) {
      onState?.(`hr_error:${err.message}`);
      return;
    }
    if (!ch?.value) return;
    const b = Buffer.from(ch.value, 'base64');
    const bpm = (b[0] & 0x01) ? b.readUInt16LE(1) : b[1];
    if (bpm > 0) {
      onState?.('connected');
      onHeartRate?.({ bpm, ts: Date.now() });
    }
  });

  return { id: dev.id, name: resolvedName || dev.name || 'Smartwatch', heartRate: true };
}

export async function disconnect() {
  hrSub?.remove();
  hrSub = null;
  discSub?.remove();
  discSub = null;
  if (connected) {
    try {
      await connected.cancelConnection();
    } catch {}
    connected = null;
  }
}
