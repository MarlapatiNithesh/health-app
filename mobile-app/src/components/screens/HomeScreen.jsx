import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bell,
  Flame,
  Footprints,
  Moon,
  Timer,
  Thermometer,
  Heart,
  Droplets,
  Watch,
  ChevronRight,
  TrendingUp,
  Activity,
  RefreshCw,
  Plus,
  Minus,
  Stethoscope,
  FolderLock,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  X,
  Gauge,
  Battery,
  Smartphone,
  AlertCircle,
  Info,
  Zap,
  ArrowDown,
  Bluetooth,
  Radio,
  Link2,
  Calendar,
  MapPin
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { toNative, isNative, healthMessage } from '../../native/nativeBridge';
import { PullToRefresh } from '../common/PullToRefresh';
import { HealthPermissionsModal } from '../common/HealthPermissionsModal';
import { getHealthMemberId, getHealthConsentStorageKeys } from '../../utils/healthConsent';
import {
  HEALTH_METRICS,
  requestHealthAccess,
  HealthQueue,
  captureLiveHeartRate,
  WebPlatformHealth,
  BleWatchManager,
  defaultStorage,
  isPlausible,
  makeSample,
} from '../../services/healthCapture';
import HealthPermissionModal from '../common/HealthPermissionModal';
import VitalsDetailModal from '../common/VitalsDetailModal';

export function HomeScreen({ openPhoneHealthModal, openPatient360Modal, openMediBotModal, openVaultModal }) {
  const {
    member,
    token,
    livaPoints,
    hydrationGlasses,
    setHydrationGlasses,
    logWater,
    nativeTelemetry,
  } = useAuth();

  const [dailyData, setDailyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Proactive Clinical Monitoring Insights (HbA1c & Medication Monitoring)
  const [proactiveInsight, setProactiveInsight] = useState(null);
  const [insightDismissed, setInsightDismissed] = useState(false);

  // Fetch proactive clinical monitoring insights / proactive pings
  useEffect(() => {
    const pid = member?.id || 'me';
    if (!token) return;
    api.getProactiveInsights(pid)
      .then(res => {
        if (res?.insight) {
          setProactiveInsight(res.insight);
        }
      })
      .catch(err => {
        console.warn('Could not load proactive insight:', err?.message || err);
      });
  }, [member?.id, token, refreshKey]);

  // Modals for GOQii features
  const [showHraModal, setShowHraModal] = useState(false);
  const [showHealthPermissionsModal, setShowHealthPermissionsModal] = useState(false);

  // Ask for phone health access once after a member signs in on a native app.
  useEffect(() => {
    if (!isNative || !token || !member) return;
    const keys = getHealthConsentStorageKeys(getHealthMemberId(member));
    try {
      if (localStorage.getItem(keys.configured) !== 'true') {
        setShowHealthPermissionsModal(true);
      }
    } catch {}
  }, [token, member]);


  const displayName = member?.firstName || member?.fullName?.split(' ')[0] || 'Member';

  // ── Phone OS & Ecosystem Auto-Detection ──
  // Only classify as iOS if native platform is explicitly 'ios' or user agent is an iPhone/iPad.
  // All other devices (Android, PC browser, Windows, etc.) default to Android (Google Health Connect).
  const isIOS = nativeTelemetry?.platform === 'ios' || (typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent || ''));
  const isAndroid = !isIOS;
  const detectedOS = isIOS ? 'ios' : 'android';
  const phoneProvider = isIOS ? 'apple_health' : 'health_connect';
  const phoneProviderName = isIOS ? 'Apple HealthKit' : 'Google Health Connect';
  const isPermissionGranted = nativeTelemetry?.permissionGranted !== false;
  const displayBattery = (nativeTelemetry?.batteryLevel !== null && nativeTelemetry?.batteryLevel !== undefined)
    ? nativeTelemetry.batteryLevel
    : (typeof window !== 'undefined' && window.__LATEST_HEALTH_TELEMETRY__?.batteryLevel !== undefined
      ? window.__LATEST_HEALTH_TELEMETRY__.batteryLevel
      : null);

  // ── Real-time Auto-Sync State ──
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [isSyncingPhone, setIsSyncingPhone] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState(null);
  const [syncFeedback, setSyncFeedback] = useState(null);
  const [stepChartTab, setStepChartTab] = useState('7days'); // '7days' | '30days'
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null); // 'YYYY-MM-DD' or null for today

  // Direct Bluetooth Low Energy (BLE) Multi-Device State for Smart Watch & Ring
  const [pairedDeviceList, setPairedDeviceList] = useState(() => {
    try {
      const list = localStorage.getItem('wellness_paired_devices');
      if (list) {
        const parsed = JSON.parse(list);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const saved = localStorage.getItem('wellness_paired_device');
      if (saved) return [JSON.parse(saved)];
    } catch {}
    return [];
  });
  const [bleDevice, setBleDevice] = useState(() => {
    try {
      const list = localStorage.getItem('wellness_paired_devices');
      if (list) {
        const parsed = JSON.parse(list);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
      }
      const saved = localStorage.getItem('wellness_paired_device');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [bleConnected, setBleConnected] = useState(() => {
    return Boolean(localStorage.getItem('wellness_paired_devices') || localStorage.getItem('wellness_paired_device'));
  });
  const [bleScanning, setBleScanning] = useState(false);
  const [wearableMetrics, setWearableMetrics] = useState(() => {
    try {
      const saved = localStorage.getItem('wellness_wearable_metrics');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          (parsed.steps === 5803 && parsed.heart_rate === 102 && parsed.sleep === 462) ||
          (parsed.heart_rate === 74 && parsed.blood_glucose === 98) ||
          (parsed.spo2 === 99 && parsed.blood_pressure_systolic === 118) ||
          parsed.isDummy || parsed.dummy
        ) {
          localStorage.removeItem('wellness_wearable_metrics');
        } else {
          return parsed;
        }
      }
    } catch {}
    return {
      heart_rate: null,
      spo2: null,
      blood_pressure_systolic: null,
      blood_pressure_diastolic: null,
      blood_glucose: null,
      sleep: null,
      sleep_score: null,
      deep_sleep: null,
      rem_sleep: null,
      light_sleep: null,
      steps: null,
      calories: null,
      last_synced: null,
    };
  });
  const [bleHeartRate, setBleHeartRate] = useState(() => wearableMetrics.heart_rate || null);
  const [bleBattery, setBleBattery] = useState(() => {
    try {
      const saved = localStorage.getItem('wellness_paired_device');
      return saved ? (JSON.parse(saved).battery ?? null) : null;
    } catch {
      return null;
    }
  });
  const [bleStatus, setBleStatus] = useState(() => {
    return localStorage.getItem('wellness_paired_device') ? 'Paired device active' : '';
  });

  // ── OpenWearables Cloud Connections State ──
  const [openWearableConnections, setOpenWearableConnections] = useState([]);
  const [syncingOpenWearable, setSyncingOpenWearable] = useState(false);

  useEffect(() => {
    // Purge stale BLE devices from localStorage so BLE pairing is completely removed
    try {
      localStorage.removeItem('wellness_paired_devices');
      localStorage.removeItem('wellness_paired_device');
      localStorage.removeItem('wellness_wearable_metrics');
    } catch {}

    if (!token) return;

    api.getWearableConnections()
      .then((res) => {
        if (Array.isArray(res?.data)) {
          setOpenWearableConnections(
            res.data.filter(c => !['phone_pedometer', 'health_connect', 'apple_health', 'phone'].includes((c.provider || '').toLowerCase()))
          );
        }
      })
      .catch(() => {});
  }, [refreshKey, token, member?.id]);

  const handleQuickSyncOpenWearables = async () => {
    setSyncingOpenWearable(true);
    try {
      const active = openWearableConnections.find((c) => c.status === 'connected') || { provider: 'google_health' };
      await api.syncWearableProvider(active.provider);
      setSyncFeedback({
        status: 'saved',
        count: 1,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: active.provider === 'google_health' ? 'Google Health' : active.provider.replace('_', ' ')
      });
      const updated = await api.getWearableConnections();
      if (Array.isArray(updated?.data)) {
        setOpenWearableConnections(
          updated.data.filter(c => !['phone_pedometer', 'health_connect', 'apple_health', 'phone'].includes((c.provider || '').toLowerCase()))
        );
      }
    } catch (err) {
      console.warn('Quick sync error:', err);
    } finally {
      setSyncingOpenWearable(false);
    }
  };

  useEffect(() => {
    const handleWearableUpdate = (e) => {
      if (e?.detail?.metrics) {
        setWearableMetrics(e.detail.metrics);
        if (e.detail.metrics.heart_rate) {
          setBleHeartRate(e.detail.metrics.heart_rate);
        }
      }
      try {
        const devices = localStorage.getItem('wellness_paired_devices');
        if (devices) {
          const list = JSON.parse(devices);
          if (Array.isArray(list)) {
            setPairedDeviceList(list);
            setBleConnected(list.length > 0);
            if (list[0]) setBleDevice(list[0]);
          }
        }
      } catch {}
    };

    const handleNativeBle = (e) => {
      const { event, data } = e?.detail || {};
      if (!event) return;
      if (event === 'heartRate' && data?.bpm) {
        setBleHeartRate(data.bpm);
        setWearableMetrics((prev) => {
          const next = { ...prev, heart_rate: data.bpm, last_synced: new Date().toISOString() };
          try { localStorage.setItem('wellness_wearable_metrics', JSON.stringify(next)); } catch {}
          return next;
        });
        setBleStatus(`● Real-time Pulse: ${data.bpm} BPM (Live from watch)`);
      } else if (event === 'battery' && typeof data?.battery === 'number') {
        setBleBattery(data.battery);
      } else if (event === 'connectedDevice' && data) {
        setBleConnected(true);
        setBleDevice(data);
        setBleStatus(`Connected to ${data.name || 'watch'}`);
      } else if (event === 'state') {
        if (data?.state === 'connected') {
          setBleConnected(true);
          setBleStatus('Smartwatch connected over Bluetooth');
        } else if (data?.state === 'connected_no_heart_rate') {
          setBleConnected(true);
          setBleStatus('Watch connected • Steps sync via Health Connect');
        } else if (data?.state === 'disconnected') {
          setBleStatus('Device disconnected');
        }
      }
    };

    window.addEventListener('wearableTelemetryUpdated', handleWearableUpdate);
    window.addEventListener('nativeBle', handleNativeBle);
    return () => {
      window.removeEventListener('wearableTelemetryUpdated', handleWearableUpdate);
      window.removeEventListener('nativeBle', handleNativeBle);
    };
  }, []);

  const [permissionModal, setPermissionModal] = useState({
    isOpen: false,
    mode: 'explain',
    metrics: [],
    missing: [],
    resolver: null,
  });

  const uiHealthHandler = useMemo(() => ({
    explain: ({ metrics }) =>
      new Promise((resolve) => {
        setPermissionModal({
          isOpen: true,
          mode: 'explain',
          metrics,
          missing: [],
          resolver: resolve,
        });
      }),
    showDenied: ({ missing }) =>
      new Promise((resolve) => {
        setPermissionModal({
          isOpen: true,
          mode: 'denied',
          metrics,
          missing,
          resolver: resolve,
        });
      }),
  }), []);

  const ALL_BLE_OPTIONAL_SERVICES = [
    'heart_rate',
    'battery_service',
    'device_information',
    0x1822, // Pulse Oximeter / SpO2
    0x1809, // Health Thermometer
    0x1800, // Generic Access
    0x1801, // Generic Attribute
    0x1826, // Fitness Machine
    0x181C, // User Data
    0x1805, // Current Time
    0xFEE0, // Huami / Zepp / Xiaomi / boAt / Amazfit band
    0xFEE7, // Tencent Health / Sports Pedometer
    0xFFF0, // Common DaFit / Fire-Boltt / Noise / boAt data service
    0xFEA0, // Generic Fitness band
    '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (Smart rings & smartwatches)
    '0000fee0-0000-1000-8000-00805f9b34fb',
    '0000fee7-0000-1000-8000-00805f9b34fb',
    '0000fff0-0000-1000-8000-00805f9b34fb',
  ];

  const BLE_NAME_PREFIXES = [
    'Fitpass', 'fitpass', 'FITPASS', 'FitPass',
    'Noise', 'noise', 'NOISE', 'ColorFit', 'colorfit', 'NoiseFit', 'Pulse', 'pulse',
    'Wave', 'wave', 'WAVE',
    'boAt', 'boat', 'BOAT',
    'Fire', 'fire', 'Fire-Boltt', 'FireBoltt',
    'Ring', 'ring',
    'Watch', 'watch',
    'Smart', 'smart',
    'Band', 'band',
    'Fit', 'fit',
    'Luna', 'luna',
    'GOQii', 'goqii',
    'Health', 'health',
    'Titan', 'titan',
    'Boult', 'boult',
    'Fastrack', 'fastrack',
    'Realme', 'realme',
    'Redmi', 'redmi',
    'Amazfit', 'amazfit',
    'BeatXP', 'beatxp',
    'Pebble', 'pebble',
  ];

  const handleConnectBle = async (filterType = 'health') => {
    if (typeof navigator === 'undefined' || !navigator.bluetooth) {
      openPhoneHealthModal();
      return;
    }

    // Permission pipeline: explain before asking
    const platformHealth = new WebPlatformHealth({
      openSettingsCallback: () => openPhoneHealthModal(),
    });
    const healthPerm = await requestHealthAccess({
      metrics: ['steps', 'heart_rate', 'sleep', 'spo2', 'calories'],
      platformHealth,
      ui: uiHealthHandler,
      storage: defaultStorage,
    });

    if (healthPerm.status === 'denied' && healthPerm.declinedByUser) {
      setBleStatus('Pairing paused. Health permissions were not confirmed.');
      return;
    }

    setBleScanning(true);
    setBleStatus('Searching for nearby smartwatches and rings...');
    try {
      const options = {
        filters: [
          { services: ['heart_rate'] },
          ...BLE_NAME_PREFIXES.map((prefix) => ({ namePrefix: prefix })),
        ],
        optionalServices: ALL_BLE_OPTIONAL_SERVICES,
      };
      const device = await navigator.bluetooth.requestDevice(options).catch(async (reqErr) => {
        if (reqErr.name !== 'NotFoundError') {
          return await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ALL_BLE_OPTIONAL_SERVICES,
          });
        }
        throw reqErr;
      });

      if (!device) return;
      setBleStatus(`Connecting to ${device.name || 'Smart Device'}…`);

      // Clean up previous half-connected state if any
      if (device.gatt && !device.gatt.connected) {
        try { device.gatt.disconnect(); } catch (_) {}
      }

      // Robust connection loop with 3 retries
      let server = null;
      let lastConnErr = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          if (device.gatt?.connected) {
            server = device.gatt;
            break;
          }
          if (attempt > 1) {
            setBleStatus(`Connecting to ${device.name || 'Device'} (Attempt ${attempt}/3)…`);
            await new Promise((r) => setTimeout(r, 700));
          }
          server = await device.gatt.connect();
          if (server?.connected) break;
        } catch (connErr) {
          lastConnErr = connErr;
          console.warn(`[BLE] GATT connect attempt ${attempt} failed:`, connErr);
        }
      }

      if (!server || !server.connected) {
        throw lastConnErr || new Error("Can't communicate with device. Smartwatch rejected GATT link.");
      }

      const devName = device.name || 'Bluetooth Smart Device';
      const detectedBrand = 'bluetooth_ble';
      const lowerDevName = devName.toLowerCase();

      const pairedData = {
        name: devName,
        id: device.id || `ble-${Date.now()}`,
        brand: detectedBrand,
        type: lowerDevName.includes('ring') ? 'ring' : 'smartwatch',
        model: `${devName} Active Stream`,
        battery: null,
        pairedAt: new Date().toISOString(),
      };
      setBleDevice(device);
      setBleConnected(true);
      setBleStatus(`Connected to ${device.name || 'Smart Device'} • Awaiting live sensor pulse…`);

      // Store in multi-device list
      try {
        const stored = localStorage.getItem('wellness_paired_devices');
        const list = stored ? JSON.parse(stored) : [];
        const updated = [...list.filter((d) => d.id !== pairedData.id), pairedData];
        localStorage.setItem('wellness_paired_devices', JSON.stringify(updated));
        localStorage.setItem('wellness_paired_device', JSON.stringify(pairedData));
        setPairedDeviceList(updated);
      } catch {}

      // Initialize persistent queue & BLE manager for original data pipeline
      const healthQueue = new HealthQueue({
        storage: defaultStorage,
        upload: (batch) => api.post('/health/samples', { samples: batch }),
      });

      const bleManager = new BleWatchManager({
        provider: pairedData.brand || 'bluetooth_ble',
        device: pairedData,
      });

      // Pipeline step 6: Live BLE heart rate -> windowed 30s aggregated samples (don't spam every beat)
      const stopLiveHeartRate = captureLiveHeartRate({
        ble: bleManager,
        queue: healthQueue,
        windowSec: 30,
      });

      // 1. Subscribe to standard Bluetooth Heart Rate (0x180D -> 0x2A37)
      try {
        const hrService = await server.getPrimaryService('heart_rate');
        const hrChar = await hrService.getCharacteristic('heart_rate_measurement');
        await hrChar.startNotifications();
        hrChar.addEventListener('characteristicvaluechanged', (event) => {
          const val = event.target.value;
          const flags = val.getUint8(0);
          const rate = (flags & 0x01) ? val.getUint16(1, true) : val.getUint8(1);
          if (rate >= 25 && rate <= 230) {
            setBleHeartRate(rate);
            setWearableMetrics((prev) => {
              const updated = { ...prev, heart_rate: rate, last_synced: new Date().toISOString() };
              localStorage.setItem('wellness_wearable_metrics', JSON.stringify(updated));
              return updated;
            });
            setBleStatus(`● Real-time Pulse: ${rate} BPM (Live from ${device.name || 'watch'})`);

            // Feed to BleWatchManager for 30s window averaging & dedupe in HealthQueue
            bleManager.emit('heartRate', { bpm: rate, ts: Date.now() });
          }
        });
      } catch (hrErr) {
        console.warn('[BLE] Standard heart_rate service not available:', hrErr.message);
      }

      // 2. Read Battery Level (0x180F -> 0x2A19)
      try {
        const batService = await server.getPrimaryService('battery_service');
        const batChar = await batService.getCharacteristic('battery_level');
        const batVal = await batChar.readValue();
        const batLevel = batVal.getUint8(0);
        setBleBattery(batLevel);
      } catch {}

      // 3. Optional Pulse Oximeter / SpO2 (0x1822)
      try {
        const plxService = await server.getPrimaryService(0x1822);
        const plxChar = await plxService.getCharacteristic(0x2A5F).catch(() => plxService.getCharacteristic(0x2A5E));
        if (plxChar) {
          await plxChar.startNotifications();
          plxChar.addEventListener('characteristicvaluechanged', (event) => {
            const val = event.target.value;
            const spo2Val = val.getUint8(1) || val.getUint8(2);
            if (spo2Val >= 70 && spo2Val <= 100) {
              setWearableMetrics((prev) => {
                const next = { ...prev, spo2: spo2Val, last_synced: new Date().toISOString() };
                localStorage.setItem('wellness_wearable_metrics', JSON.stringify(next));
                return next;
              });
              const spo2Sample = makeSample({
                metric: 'spo2',
                value: spo2Val,
                start: new Date().toISOString(),
                end: new Date().toISOString(),
                source: 'ble_live',
                deviceId: device.id,
                provider: pairedData.brand || 'bluetooth_ble',
              });
              healthQueue.add([spo2Sample]).then(() => healthQueue.flush()).catch(() => {});
            }
          });
        }
      } catch {}

      device.addEventListener('gattserverdisconnected', () => {
        stopLiveHeartRate();
        bleManager.disconnect();
        setBleConnected(false);
        setBleHeartRate(null);
        setBleStatus('Watch disconnected from Bluetooth');
      });
    } catch (err) {
      if (err.name === 'NotFoundError') {
        setBleStatus('Bluetooth pairing was canceled. Select your device from the browser popup.');
        return;
      }

      const errMsg = (err.message || '').toLowerCase();
      const isCommErr =
        errMsg.includes("can't communicate") ||
        errMsg.includes("cant communicate") ||
        errMsg.includes("connection failed") ||
        errMsg.includes("networkerror") ||
        err.name === 'NetworkError';

      if (isCommErr) {
        setBleStatus("Can't communicate: Watch is connected to phone companion app (boAt Crest). Disconnect from app or sync via Health Connect.");
      } else {
        setBleStatus(`Pairing status: ${err.message || 'Bluetooth connection canceled'}`);
      }
    } finally {
      setBleScanning(false);
    }
  };

  const handleQuickPair = (deviceType = 'boat_wave') => {
    // Initiates genuine Bluetooth pairing with targeted name filter
    handleConnectBle(deviceType === 'boat_wave' ? 'watch' : 'ring');
  };

  const handleDisconnectBle = (deviceId = null) => {
    if (bleDevice && bleDevice.gatt?.connected) {
      try { bleDevice.gatt.disconnect(); } catch (_) {}
    }
    try {
      const stored = localStorage.getItem('wellness_paired_devices');
      if (stored) {
        const list = JSON.parse(stored);
        const filtered = deviceId ? list.filter((d) => d.id !== deviceId) : [];
        if (filtered.length > 0) {
          localStorage.setItem('wellness_paired_devices', JSON.stringify(filtered));
          localStorage.setItem('wellness_paired_device', JSON.stringify(filtered[0]));
          setPairedDeviceList(filtered);
          setBleDevice(filtered[0]);
          setBleStatus(`Connected to ${filtered[0].name}`);
          return;
        }
      }
    } catch {}
    localStorage.removeItem('wellness_paired_device');
    localStorage.removeItem('wellness_paired_devices');
    setPairedDeviceList([]);
    setBleConnected(false);
    setBleDevice(null);
    setBleHeartRate(null);
    setBleBattery(null);
    setBleStatus('Disconnected');
  };

  // Manual Step Logging State
  const [showLogStepsModal, setShowLogStepsModal] = useState(false);
  const [manualStepsInput, setManualStepsInput] = useState('');
  const [loggingSteps, setLoggingSteps] = useState(false);

  // Vitals Detail & Log Modal States
  const [selectedVitalModal, setSelectedVitalModal] = useState(null);
  const [showLogVitalModal, setShowLogVitalModal] = useState(null);
  const [vitalInputValue, setVitalInputValue] = useState('');
  const [vitalSysInput, setVitalSysInput] = useState('');
  const [vitalDiaInput, setVitalDiaInput] = useState('');
  const [loggingVital, setLoggingVital] = useState(false);

  // Sleep Details & Logging Modal State
  const [showSleepDetailsModal, setShowSleepDetailsModal] = useState(false);
  const [manualSleepHours, setManualSleepHours] = useState('');
  const [savingSleep, setSavingSleep] = useState(false);

  const handleSaveSleep = async (hours) => {
    const val = parseFloat(hours);
    if (isNaN(val) || val <= 0) return;
    const mins = Math.round(val * 60);
    setSavingSleep(true);
    try {
      const now = new Date().toISOString();
      await api.syncPhoneHealth([
        {
          provider: 'manual_entry',
          metric: 'sleep',
          externalId: `manual-sleep-${Date.now()}`,
          value: mins,
          unit: 'minutes',
          recordedAt: now,
        }
      ]);
      setShowSleepDetailsModal(false);
      setManualSleepHours('');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert('Failed to save sleep: ' + (err.message || String(err)));
    } finally {
      setSavingSleep(false);
    }
  };

  const handleSaveVital = async (e) => {
    e.preventDefault();
    setLoggingVital(true);
    try {
      const now = new Date().toISOString();
      const samples = [];

      if (showLogVitalModal === 'heart_rate') {
        const val = parseInt(vitalInputValue, 10);
        if (isNaN(val) || val <= 0) return;
        samples.push({ provider: 'manual_entry', metric: 'heart_rate', externalId: `manual-hr-${Date.now()}`, value: val, unit: 'bpm', recordedAt: now });
      } else if (showLogVitalModal === 'blood_pressure') {
        const sys = parseInt(vitalSysInput, 10);
        const dia = parseInt(vitalDiaInput, 10);
        if (isNaN(sys) || isNaN(dia) || sys <= 0 || dia <= 0) return;
        samples.push(
          { provider: 'manual_entry', metric: 'blood_pressure_systolic', externalId: `manual-sys-${Date.now()}`, value: sys, unit: 'mmHg', recordedAt: now },
          { provider: 'manual_entry', metric: 'blood_pressure_diastolic', externalId: `manual-dia-${Date.now()}`, value: dia, unit: 'mmHg', recordedAt: now }
        );
      } else if (showLogVitalModal === 'blood_glucose') {
        const val = parseFloat(vitalInputValue);
        if (isNaN(val) || val <= 0) return;
        samples.push({ provider: 'manual_entry', metric: 'blood_glucose', externalId: `manual-glucose-${Date.now()}`, value: val, unit: 'mg/dL', recordedAt: now });
      } else if (showLogVitalModal === 'spo2') {
        const val = parseFloat(vitalInputValue);
        if (isNaN(val) || val <= 0) return;
        samples.push({ provider: 'manual_entry', metric: 'spo2', externalId: `manual-spo2-${Date.now()}`, value: val, unit: '%', recordedAt: now });
      } else if (showLogVitalModal === 'sleep') {
        const mins = parseInt(vitalInputValue, 10);
        if (isNaN(mins) || mins <= 0) return;
        samples.push({ provider: 'manual_entry', metric: 'sleep', externalId: `manual-sleep-${Date.now()}`, value: mins, unit: 'minutes', recordedAt: now });
      }

      if (samples.length > 0) {
        await api.syncPhoneHealth(samples);
        setShowLogVitalModal(null);
        setVitalInputValue('');
        setVitalSysInput('');
        setVitalDiaInput('');
        setRefreshKey((k) => k + 1);
      }
    } catch (err) {
      alert('Failed to save vital: ' + (err.message || String(err)));
    } finally {
      setLoggingVital(false);
    }
  };

  const handleSaveManualSteps = async (e) => {
    e.preventDefault();
    const count = parseInt(manualStepsInput, 10);
    if (isNaN(count) || count < 0) return;
    setLoggingSteps(true);
    try {
      await api.syncPhoneHealth([
        {
          provider: 'manual_entry',
          metric: 'steps',
          externalId: `manual-steps-${Date.now()}`,
          value: count,
          unit: 'count',
          recordedAt: new Date().toISOString()
        }
      ]);
      setLiveSteps(count);
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncedTime(time);
      setSyncFeedback({ status: 'saved', count: 1, time, provider: 'Manual Entry' });
      setShowLogStepsModal(false);
      setManualStepsInput('');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert('Failed to log steps: ' + (err.message || String(err)));
    } finally {
      setLoggingSteps(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.getDailySummary()
      .then((res) => {
        if (mounted && res?.data) {
          setDailyData(res.data);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch daily summary:', err.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [refreshKey, token, member?.id]);

  // Live Phone Hardware Sensor Telemetry
  const [liveSteps, setLiveSteps] = useState(() => nativeTelemetry?.liveSteps ?? 0);

  useEffect(() => {
    const onCustomTelemetry = (e) => {
      if (e?.detail) {
        const data = e.detail;
        if (data.databaseSync?.status === 'saved') {
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setLastSyncedTime(time);
          setSyncFeedback({ status: 'saved', count: data.databaseSync.accepted, time, provider: phoneProviderName });
          api.getDailySummary().then((updated) => {
            if (updated?.data) setDailyData(updated.data);
          }).catch(() => {});
        } else if (data.databaseSync?.status === 'error') {
          setSyncFeedback({ status: 'error', message: `Phone data was read but could not be saved: ${data.databaseSync.message}` });
        }
        if (typeof data.liveSteps === 'number') {
          setLiveSteps(data.liveSteps);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('nativeHealthTelemetry', onCustomTelemetry);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('nativeHealthTelemetry', onCustomTelemetry);
      }
    };
  }, [member]);

  // Synchronize state when nativeTelemetry updates from AuthContext
  useEffect(() => {
    if (nativeTelemetry && typeof nativeTelemetry.liveSteps === 'number') {
      setLiveSteps(nativeTelemetry.liveSteps);
    }
  }, [nativeTelemetry, member]);

  // ── Request a native read & re-fetch PostgreSQL Cloud Database Summary ──
  const syncPhoneHealthToCloud = async (isBackground = false) => {
    if (isSyncingPhone) return;
    if (!isBackground) setIsSyncingPhone(true);
    toNative('PULL_DOWN_SYNC');

    try {
      // 1. Gather any live phone health readings available on client
      const currentSteps = rawHealthConnectSteps > 0
        ? rawHealthConnectSteps
        : (resolveMetricNum(liveSteps) > 0 ? resolveMetricNum(liveSteps) : (watchSteps > 0 ? watchSteps : 0));
      const currentCalories = currentSteps > 0 ? Math.round(currentSteps * 0.045) : 0;
      const currentDistance = currentSteps > 0 ? Math.round(currentSteps * 0.75) : 0;
      const currentHeartRate = healthObj?.heartRate?.latest || healthObj?.heartRate?.avg || null;
      const currentSleep = nativeTelemetry?.today?.sleepMinutes || healthObj?.sleep?.durationMinutes || null;
      const currentSpo2 = healthObj?.spo2?.latest || healthObj?.spo2 || null;
      const currentGlucose = healthObj?.bloodGlucose?.latest || healthObj?.bloodGlucose || null;

      const samplesToSync = [];
      const now = new Date();
      const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const nowIso = now.toISOString();

      const todayStartIso = `${dateKey}T00:00:00.000Z`;

      if (currentSteps > 0) {
        samplesToSync.push({
          provider: phoneProvider,
          metric: 'steps',
          externalId: `${phoneProvider}-steps-today-${dateKey}`,
          value: currentSteps,
          unit: 'count',
          aggregation: 'daily_total',
          recordedAt: todayStartIso,
        });
      }
      if (currentCalories > 0) {
        samplesToSync.push({
          provider: phoneProvider,
          metric: 'calories',
          externalId: `${phoneProvider}-calories-today-${dateKey}`,
          value: currentCalories,
          unit: 'kcal',
          aggregation: 'daily_total',
          recordedAt: todayStartIso,
        });
      }
      if (currentDistance > 0) {
        samplesToSync.push({
          provider: phoneProvider,
          metric: 'distance',
          externalId: `${phoneProvider}-distance-today-${dateKey}`,
          value: Math.round(currentDistance),
          unit: 'm',
          aggregation: 'daily_total',
          recordedAt: todayStartIso,
        });
      }
      if (currentHeartRate && currentHeartRate > 0) {
        samplesToSync.push({
          provider: phoneProvider,
          metric: 'heart_rate',
          externalId: `${phoneProvider}-hr-${dateKey}`,
          value: Math.round(currentHeartRate),
          unit: 'bpm',
          aggregation: 'instant',
          recordedAt: nowIso,
        });
      }
      if (currentSleep && currentSleep > 0) {
        const sleepMins = Math.round(currentSleep);
        samplesToSync.push({
          provider: phoneProvider,
          metric: 'sleep',
          externalId: `${phoneProvider}-sleep-${dateKey}`,
          value: sleepMins,
          unit: 'minutes',
          aggregation: 'interval',
          recordedAt: nowIso,
          endedAt: nowIso,
          startedAt: new Date(Date.now() - (sleepMins * 60000)).toISOString(),
        });
      }
      if (currentSpo2 && currentSpo2 > 0) {
        samplesToSync.push({
          provider: phoneProvider,
          metric: 'spo2',
          externalId: `${phoneProvider}-spo2-${dateKey}`,
          value: currentSpo2,
          unit: '%',
          aggregation: 'instant',
          recordedAt: nowIso,
        });
      }
      if (currentGlucose && currentGlucose > 0) {
        samplesToSync.push({
          provider: phoneProvider,
          metric: 'blood_glucose',
          externalId: `${phoneProvider}-glucose-${dateKey}`,
          value: currentGlucose,
          unit: 'mg/dL',
          aggregation: 'instant',
          recordedAt: nowIso,
        });
      }

      // 2. Seamlessly sync the past 30 days of health history to PostgreSQL database
      if (Array.isArray(nativeTelemetry?.history)) {
        for (const h of nativeTelemetry.history) {
          if (!h?.date) continue;
          const hDate = typeof h.date === 'string' ? h.date.split('T')[0] : '';
          if (hDate && hDate !== dateKey) {
            const hSteps = Number(h.steps) || 0;
            if (hSteps > 0) {
              samplesToSync.push({
                provider: phoneProvider,
                metric: 'steps',
                externalId: `${phoneProvider}-steps-history-${hDate}`,
                value: hSteps,
                unit: 'count',
                aggregation: 'daily_total',
                recordedAt: `${hDate}T12:00:00.000Z`,
              });
              const hCal = Number(h.calories) || Math.round(hSteps * 0.045);
              if (hCal > 0) {
                samplesToSync.push({
                  provider: phoneProvider,
                  metric: 'calories',
                  externalId: `${phoneProvider}-calories-history-${hDate}`,
                  value: hCal,
                  unit: 'kcal',
                  aggregation: 'daily_total',
                  recordedAt: `${hDate}T12:00:00.000Z`,
                });
              }
              const hDist = Number(h.distance) || Math.round(hSteps * 0.75);
              if (hDist > 0) {
                samplesToSync.push({
                  provider: phoneProvider,
                  metric: 'distance',
                  externalId: `${phoneProvider}-distance-history-${hDate}`,
                  value: hDist,
                  unit: 'm',
                  aggregation: 'daily_total',
                  recordedAt: `${hDate}T12:00:00.000Z`,
                });
              }
            }
            if (h.sleep && Number(h.sleep) > 0) {
              samplesToSync.push({
                provider: phoneProvider,
                metric: 'sleep',
                externalId: `${phoneProvider}-sleep-history-${hDate}`,
                value: Number(h.sleep),
                unit: 'minutes',
                aggregation: 'interval',
                recordedAt: `${hDate}T06:30:00.000Z`,
              });
            }
            if (h.heartRate && Number(h.heartRate) > 0) {
              samplesToSync.push({
                provider: phoneProvider,
                metric: 'heart_rate',
                externalId: `${phoneProvider}-hr-history-${hDate}`,
                value: Number(h.heartRate),
                unit: 'bpm',
                aggregation: 'instant',
                recordedAt: `${hDate}T08:30:00.000Z`,
              });
            }
          }
        }
      }

      if (samplesToSync.length > 0) {
        await api.syncPhoneHealth(samplesToSync).catch((syncErr) => {
          console.warn('Live sample sync to phone-health endpoint warning:', syncErr.message);
        });
      }

      const summary = await api.getDailySummary();
      if (summary?.data) {
        setDailyData(summary.data);
      }
      if (!isBackground) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSyncedTime(time);
        setSyncFeedback({
          status: 'saved',
          count: summary?.data?.steps?.today ?? liveSteps ?? 0,
          time,
          provider: phoneProviderName || 'Phone Health'
        });
      }
    } catch (e) {
      console.warn('Cloud DB refresh error:', e.message);
      if (!isBackground) {
        setSyncFeedback({ status: 'error', message: `Sync completed with warning: ${e.message}` });
      }
    } finally {
      if (!isBackground) {
        setIsSyncingPhone(false);
      }
    }
  };

  // Foreground refresh fallback. Native health store updates can also trigger sync.
  useEffect(() => {
    let timer = null;
    if (autoSyncEnabled) {
      timer = setInterval(() => {
        syncPhoneHealthToCloud(true);
      }, 5 * 60 * 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [autoSyncEnabled, liveSteps, phoneProvider, member]);

  // Safe metric numeric resolution (Guarantees primitive numbers, never [object Object])
  const resolveMetricNum = (val) => {
    if (typeof val === 'number') return val;
    if (val && typeof val.value === 'number') return val.value;
    if (val && typeof val.value === 'string' && !isNaN(Number(val.value))) return Number(val.value);
    if (val && typeof val.durationMinutes === 'number') return val.durationMinutes;
    if (val && typeof val.duration === 'number') return val.duration;
    if (typeof val === 'string' && !isNaN(Number(val))) return Number(val);
    return 0;
  };

  const healthObj = nativeTelemetry?.health || null;

  // ── Multi-Device Deduplication Resolution ("Whichever has more steps wins") ──
  // If phone has X steps and smartwatch has Y steps, display whichever recorded more steps.
  const watchSteps = resolveMetricNum(wearableMetrics?.steps);
  const dbSteps = resolveMetricNum(dailyData?.steps);
  const rawHealthConnectSteps = resolveMetricNum(nativeTelemetry?.today?.steps) || resolveMetricNum(healthObj?.steps?.today);
  const rawLiveSteps = resolveMetricNum(liveSteps);

  // Read and seamlessly merge 30-day step history from both PostgreSQL and native health telemetry
  const rawHistoryList = useMemo(() => {
    const map = new Map();
    // 1. Add PostgreSQL database history
    if (Array.isArray(dailyData?.history)) {
      for (const item of dailyData.history) {
        if (item?.date) {
          const key = typeof item.date === 'string' ? item.date.split('T')[0] : '';
          if (key) map.set(key, { ...item, date: key });
        }
      }
    }
    // 2. Overlay / merge native telemetry history
    if (Array.isArray(nativeTelemetry?.history)) {
      for (const item of nativeTelemetry.history) {
        if (item?.date) {
          const key = typeof item.date === 'string' ? item.date.split('T')[0] : '';
          if (key) {
            const existing = map.get(key) || {};
            map.set(key, {
              ...existing,
              ...item,
              date: key,
              steps: Math.max(Number(existing.steps) || 0, Number(item.steps) || 0),
              calories: Math.max(Number(existing.calories) || 0, Number(item.calories) || 0),
              distance: Math.max(Number(existing.distance) || 0, Number(item.distance) || 0),
              heartRate: item.heartRate || existing.heartRate || null,
              sleep: item.sleep || item.sleepMinutes || existing.sleep || null,
            });
          }
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [dailyData?.history, nativeTelemetry?.history]);

  // Candidate step counts for TODAY only.
  const livePhoneSteps = rawHealthConnectSteps > 0 ? rawHealthConnectSteps : (rawLiveSteps > 0 ? rawLiveSteps : 0);
  const bestPhoneSteps = Math.max(livePhoneSteps, rawHealthConnectSteps, rawLiveSteps, dbSteps);

  // Strict user requirement: phone is X, watch is Y -> show whichever has MORE steps (MAX)
  const steps = Math.max(
    Number(watchSteps) || 0,
    Number(bestPhoneSteps) || 0
  );

  const rawLiveCalories = resolveMetricNum(healthObj?.calories?.activeToday) || resolveMetricNum(nativeTelemetry?.today?.activeCalories);
  const watchCalories = resolveMetricNum(wearableMetrics?.calories);
  const dbCalories = resolveMetricNum(dailyData?.calories);

  // ── Calories Resolution ──
  // Compute authentic active burn based on steps (~0.045 kcal/step).
  // If sensor calorie reading is authentic and within realistic physical bounds, prioritize it; otherwise use step burn.
  const calculatedBurnFromSteps = steps > 0 ? Math.round(steps * 0.045) : 0;
  const maxReasonableSensorCal = steps > 0 ? Math.round(steps * 0.09) : 9999;
  const rawCal = watchCalories > 0 ? watchCalories : (rawLiveCalories > 0 ? rawLiveCalories : 0);
  const liveSensorCal = (rawCal > 0 && rawCal <= maxReasonableSensorCal) ? rawCal : 0;
  const calories = liveSensorCal > 0 ? liveSensorCal : (calculatedBurnFromSteps > 0 ? calculatedBurnFromSteps : dbCalories);

  // ── Distance Resolution ──
  const rawLiveDistance = resolveMetricNum(healthObj?.distance?.todayMeters) || resolveMetricNum(nativeTelemetry?.today?.distanceM);
  const dbDistance = resolveMetricNum(dailyData?.distance);
  const distanceMeters = rawLiveDistance > 0 ? rawLiveDistance : (dbDistance > 0 ? dbDistance : Math.round(steps * 0.75));

  const dbHeartRate = resolveMetricNum(dailyData?.heart_rate);
  const watchHeartRate = resolveMetricNum(wearableMetrics?.heart_rate);
  const phoneHeartRate = resolveMetricNum(healthObj?.heartRate?.latest) || resolveMetricNum(nativeTelemetry?.today?.heartRate?.latest);
  const heartRate = watchHeartRate > 0
    ? watchHeartRate
    : (phoneHeartRate > 0 ? phoneHeartRate : (dbHeartRate > 0 ? dbHeartRate : null));

  const dbRestingHeartRate = resolveMetricNum(dailyData?.resting_heart_rate);
  const watchRestingHr = resolveMetricNum(wearableMetrics?.resting_heart_rate);
  const restingHeartRate = watchRestingHr > 0
    ? watchRestingHr
    : (dbRestingHeartRate > 0 ? dbRestingHeartRate : null);

  const dbBpSys = resolveMetricNum(dailyData?.blood_pressure_systolic);
  const watchBpSys = resolveMetricNum(wearableMetrics?.blood_pressure_systolic);
  const phoneBpSys = resolveMetricNum(nativeTelemetry?.today?.bloodPressureSystolic);
  const bpSys = watchBpSys > 0 ? watchBpSys : (phoneBpSys > 0 ? phoneBpSys : (dbBpSys > 0 ? dbBpSys : null));

  const dbBpDia = resolveMetricNum(dailyData?.blood_pressure_diastolic);
  const watchBpDia = resolveMetricNum(wearableMetrics?.blood_pressure_diastolic);
  const phoneBpDia = resolveMetricNum(nativeTelemetry?.today?.bloodPressureDiastolic);
  const bpDia = watchBpDia > 0 ? watchBpDia : (phoneBpDia > 0 ? phoneBpDia : (dbBpDia > 0 ? dbBpDia : null));

  const dbBloodGlucose = resolveMetricNum(dailyData?.blood_glucose);
  const watchGlucose = resolveMetricNum(wearableMetrics?.blood_glucose);
  const phoneGlucose = resolveMetricNum(nativeTelemetry?.today?.bloodGlucose);
  const bloodGlucose = watchGlucose > 0 ? watchGlucose : (phoneGlucose > 0 ? phoneGlucose : (dbBloodGlucose > 0 ? dbBloodGlucose : null));

  const dbSpo2 = resolveMetricNum(dailyData?.spo2);
  const watchSpo2 = resolveMetricNum(wearableMetrics?.spo2);
  const phoneSpo2 = resolveMetricNum(healthObj?.spo2?.latest) || resolveMetricNum(nativeTelemetry?.today?.spo2);
  const rawSpo2 = watchSpo2 > 0 ? watchSpo2 : (phoneSpo2 > 0 ? phoneSpo2 : (dbSpo2 > 0 ? dbSpo2 : null));
  const spo2 = rawSpo2 != null ? Math.round(rawSpo2 > 100 ? (rawSpo2 / 100) : (rawSpo2 <= 1 ? rawSpo2 * 100 : rawSpo2)) : null;

  const rawHealthConnectSleep = (typeof nativeTelemetry?.today?.sleepMinutes === 'number' && nativeTelemetry.today.sleepMinutes > 0)
    ? nativeTelemetry.today.sleepMinutes
    : (typeof nativeTelemetry?.sleepMinutes === 'number' && nativeTelemetry.sleepMinutes > 0
      ? nativeTelemetry.sleepMinutes
      : (typeof healthObj?.sleep?.durationMinutes === 'number' && healthObj.sleep.durationMinutes > 0
        ? healthObj.sleep.durationMinutes
        : null));
  const dbSleep = resolveMetricNum(dailyData?.sleep);
  const watchSleep = resolveMetricNum(wearableMetrics?.sleep || wearableMetrics?.sleepMinutes);
  const sleepMinutes = Math.max(
    Number(watchSleep) || 0,
    Number(rawHealthConnectSleep) || 0,
    Number(dbSleep) || 0
  ) || null;

  const healthScore = (dailyData?.healthScore != null && Number(dailyData.healthScore) > 0)
    ? Math.round(Number(dailyData.healthScore))
    : (dailyData?.wellnessScore != null && Number(dailyData.wellnessScore) > 0)
      ? Math.round(Number(dailyData.wellnessScore))
      : (member?.wellnessScore != null && Number(member.wellnessScore) > 0)
        ? Math.round(Number(member.wellnessScore))
        : 70;
  const hydrationLiters = (hydrationGlasses * 0.25).toFixed(1);

  // Sync hydration glasses with PostgreSQL daily summary if recorded
  const dbHydration = resolveMetricNum(dailyData?.hydration);
  useEffect(() => {
    if (dbHydration > 0 && typeof setHydrationGlasses === 'function') {
      const glassesFromDb = Math.min(10, Math.round(dbHydration / 250));
      if (glassesFromDb > hydrationGlasses) {
        setHydrationGlasses(glassesFromDb);
        try { localStorage.setItem('wellness_hydration', String(glassesFromDb)); } catch {}
      }
    }
  }, [dbHydration, setHydrationGlasses]);

  // Combined intraday vitals timeline (merging PostgreSQL timeseries with live Health Connect telemetry)
  const intradayMerged = useMemo(() => {
    const base = dailyData?.intraday || {};
    const res = {
      heart_rate: [...(base.heart_rate || [])],
      spo2: [...(base.spo2 || [])],
      blood_pressure_systolic: [...(base.blood_pressure_systolic || [])],
      blood_pressure_diastolic: [...(base.blood_pressure_diastolic || [])],
      blood_glucose: [...(base.blood_glucose || [])],
    };

    if (Array.isArray(nativeTelemetry?.today?.heartRateSamples)) {
      for (const s of nativeTelemetry.today.heartRateSamples) {
        if (!res.heart_rate.some((x) => x.recordedAt === s.recordedAt)) {
          res.heart_rate.push(s);
        }
      }
      res.heart_rate.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    }

    if (Array.isArray(nativeTelemetry?.today?.spo2Samples)) {
      for (const s of nativeTelemetry.today.spo2Samples) {
        if (!res.spo2.some((x) => x.recordedAt === s.recordedAt)) {
          res.spo2.push(s);
        }
      }
      res.spo2.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    }

    if (Array.isArray(nativeTelemetry?.today?.bloodPressureSamples)) {
      for (const s of nativeTelemetry.today.bloodPressureSamples) {
        if (s.systolic && !res.blood_pressure_systolic.some((x) => x.recordedAt === s.recordedAt)) {
          res.blood_pressure_systolic.push({ value: s.systolic, recordedAt: s.recordedAt });
        }
        if (s.diastolic && !res.blood_pressure_diastolic.some((x) => x.recordedAt === s.recordedAt)) {
          res.blood_pressure_diastolic.push({ value: s.diastolic, recordedAt: s.recordedAt });
        }
      }
    }

    return res;
  }, [dailyData?.intraday, nativeTelemetry?.today]);

  // Target: 10,000 steps daily (standard GOQii milestone)
  const STEP_TARGET = 10000;
  const isTodayTargetMet = steps >= STEP_TARGET;

  // Dynamic weekly steps based on real 7-day Health Connect / HealthKit history
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayIdx = (new Date().getDay() + 6) % 7; // 0 = Mon, 6 = Sun
  const now = new Date();
  const mondayDate = new Date(now);
  mondayDate.setDate(now.getDate() - todayIdx);

  const weeklySteps = days.map((day, idx) => {
    const isCurrent = idx === todayIdx;
    const isFuture = idx > todayIdx;

    const dayDate = new Date(mondayDate);
    dayDate.setDate(mondayDate.getDate() + idx);
    const isoDateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;

    const matchedItem = rawHistoryList.find((h) =>
      h.date === isoDateStr || (typeof h.date === 'string' && h.date.startsWith(isoDateStr))
    );

    const countNum = isFuture
      ? 0
      : (isCurrent
          ? steps
          : (matchedItem ? Number(matchedItem.steps || 0) : 0));

    const formatted = isFuture
      ? '--'
      : (countNum >= 1000 ? `${(countNum / 1000).toFixed(1)}k` : `${countNum}`);

    const heightPct = isFuture
      ? '0%'
      : `${Math.min(100, Math.max(8, Math.round((countNum / 10000) * 100)))}%`;

    const calNum = isCurrent
      ? calories
      : (matchedItem?.calories || (countNum > 0 ? Math.round(countNum * 0.045) : 0));
    const distNum = isCurrent
      ? distanceMeters
      : (matchedItem?.distance || (countNum > 0 ? Math.round(countNum * 0.75) : 0));

    return {
      day,
      date: isoDateStr,
      fullDate: dayDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      count: formatted,
      steps: countNum,
      calories: calNum,
      distance: distNum,
      heartRate: isCurrent ? heartRate : (matchedItem?.heartRate || null),
      sleep: isCurrent ? sleepMinutes : (matchedItem?.sleep || null),
      height: heightPct,
      isCurrent,
      isFuture,
      completed: countNum >= STEP_TARGET,
    };
  });

  // ── Accurate GOQii Streak & Habit Active Tracking ──

  const calculatedStreak = useMemo(() => {
    let count = isTodayTargetMet ? 1 : 0;
    const historyMap = new Map();
    for (const h of rawHistoryList) {
      if (h?.date) {
        const dStr = typeof h.date === 'string' ? h.date.split('T')[0] : '';
        if (dStr) historyMap.set(dStr, Math.max(historyMap.get(dStr) || 0, Number(h.steps) || 0));
      }
    }

    const pad = (n) => String(n).padStart(2, '0');
    const today = new Date();
    // Check backwards from yesterday
    let offset = 1;
    let streakActive = true;
    while (offset <= 30 && streakActive) {
      const past = new Date(today);
      past.setDate(today.getDate() - offset);
      const pastKey = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`;
      const pastSteps = historyMap.get(pastKey) || 0;
      if (pastSteps >= STEP_TARGET) {
        count++;
        offset++;
      } else {
        streakActive = false;
      }
    }

    if (typeof dailyData?.streakDays === 'number' && dailyData.streakDays > 0) {
      return Math.max(count, dailyData.streakDays);
    }
    return count;
  }, [steps, rawHistoryList, isTodayTargetMet, dailyData?.streakDays]);

  // Weekly tracker pills (Mon to Sun)
  const weekPills = useMemo(() => {
    const pad = (n) => String(n).padStart(2, '0');
    const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const curIdx = (new Date().getDay() + 6) % 7;
    const mon = new Date();
    mon.setDate(mon.getDate() - curIdx);

    const historyMap = new Map();
    for (const h of rawHistoryList) {
      if (h?.date) {
        const dStr = typeof h.date === 'string' ? h.date.split('T')[0] : '';
        if (dStr) historyMap.set(dStr, Math.max(historyMap.get(dStr) || 0, Number(h.steps) || 0));
      }
    }

    return labels.map((label, idx) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + idx);
      const dKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const isCurrentDay = idx === curIdx;
      const isFuture = idx > curIdx;
      const daySteps = isCurrentDay ? steps : (historyMap.get(dKey) || 0);
      const completed = daySteps >= STEP_TARGET;

      return {
        label,
        date: dKey,
        fullDate: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        completed,
        isCurrentDay,
        isFuture,
        steps: daySteps,
      };
    });
  }, [steps, rawHistoryList]);

  const past30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const dayStr = `${d.getMonth() + 1}/${d.getDate()}`;
    const isoDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const isToday = i === 29;

    const matchedItem = rawHistoryList.find((h) =>
      h.date === isoDateStr || (typeof h.date === 'string' && h.date.startsWith(isoDateStr))
    );

    const daySteps = isToday
      ? (steps > 0 ? steps : (matchedItem ? Number(matchedItem.steps || 0) : 0))
      : (matchedItem ? Number(matchedItem.steps || 0) : 0);

    const calNum = isToday
      ? calories
      : (matchedItem?.calories || (daySteps > 0 ? Math.round(daySteps * 0.045) : 0));
    const distNum = isToday
      ? distanceMeters
      : (matchedItem?.distance || (daySteps > 0 ? Math.round(daySteps * 0.75) : 0));

    return {
      dateLabel: dayStr,
      date: isoDateStr,
      fullDate: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      steps: daySteps,
      calories: calNum,
      distance: distNum,
      heartRate: isToday ? heartRate : (matchedItem?.heartRate || null),
      sleep: isToday ? sleepMinutes : (matchedItem?.sleep || null),
      isToday,
      completed: daySteps >= STEP_TARGET,
    };
  });

  const total30DaySteps = past30Days.reduce((acc, cur) => acc + cur.steps, 0);
  const active30Days = past30Days.filter((d) => d.steps > 0);
  const avg30DaySteps = active30Days.length > 0 ? Math.round(total30DaySteps / active30Days.length) : Math.round(total30DaySteps / 30);
  const peak30DaySteps = Math.max(...past30Days.map((d) => d.steps), steps);

  // Active selected day detail resolution for interactive click inspection
  const selectedDayInfo = useMemo(() => {
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const targetDate = selectedHistoryDate || todayIso;
    const isToday = targetDate === todayIso;

    // Check weeklySteps first
    const fromWeek = weeklySteps.find((w) => w.date === targetDate);
    if (fromWeek) return { ...fromWeek, isToday: fromWeek.isCurrent || isToday };

    // Check past30Days
    const from30 = past30Days.find((d) => d.date === targetDate);
    if (from30) return { ...from30, isToday: from30.isToday || isToday };

    // Check rawHistoryList
    const fromRaw = rawHistoryList.find((h) => h.date === targetDate);
    if (fromRaw) {
      const s = Number(fromRaw.steps || 0);
      return {
        date: targetDate,
        fullDate: targetDate,
        steps: s,
        calories: Number(fromRaw.calories || (s > 0 ? Math.round(s * 0.045) : 0)),
        distance: Number(fromRaw.distance || (s > 0 ? Math.round(s * 0.75) : 0)),
        heartRate: fromRaw.heartRate || null,
        sleep: fromRaw.sleep || null,
        isToday,
        completed: s >= STEP_TARGET,
      };
    }

    return {
      date: targetDate,
      fullDate: isToday ? 'Today' : targetDate,
      steps: isToday ? steps : 0,
      calories: isToday ? calories : 0,
      distance: isToday ? distanceMeters : 0,
      heartRate: isToday ? heartRate : null,
      sleep: isToday ? sleepMinutes : null,
      isToday,
      completed: (isToday ? steps : 0) >= STEP_TARGET,
    };
  }, [selectedHistoryDate, weeklySteps, past30Days, rawHistoryList, steps, calories, distanceMeters, heartRate, sleepMinutes]);

  const healthNotice = healthMessage(nativeTelemetry);

  return (
    <PullToRefresh
      onRefresh={() => syncPhoneHealthToCloud(false)}
      providerName={phoneProviderName}
      isAndroid={isAndroid}
    >
      <div className="px-5 py-4 space-y-5 animate-fade-in">
      {/* 1. GOQii Header (Brand + Greeting + Karma Points + Bell) */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[#ED1C24] font-black text-xl tracking-tight flex items-center">
              GOQ<span className="inline-block relative">i<span className="w-1.5 h-1.5 rounded-full bg-[#ED1C24] absolute -top-1 left-[1px]"></span></span><span className="inline-block relative">i<span className="w-1.5 h-1.5 rounded-full bg-[#ED1C24] absolute -top-1 left-[1px]"></span></span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-50 text-[#ED1C24] border border-rose-200/80 rounded uppercase tracking-wider">
              Health OS
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Good Evening, {displayName}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Karma Points / GOQii Cash Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200/80 rounded-full shadow-sm">
            <span className="text-amber-500 font-extrabold text-xs">★</span>
            <span className="text-xs font-bold text-amber-900">{livaPoints}</span>
            <span className="text-[10px] text-amber-700 font-semibold hidden sm:inline">Karma</span>
          </div>

          {/* Coach Status Badge */}
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200/80 rounded-full text-[11px] font-bold text-emerald-700 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Coach Active</span>
          </div>

          {/* Notification Bell */}
          <div className="relative p-2 bg-white rounded-full border border-slate-200 shadow-sm text-slate-700 hover:bg-slate-50 transition cursor-pointer">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#ED1C24] rounded-full ring-2 ring-white"></span>
          </div>
        </div>
      </div>

      {/* 2. Signature GOQii Steps & Activity Dial */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 rounded-3xl p-5 text-white shadow-xl border border-slate-800/80 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#ED1C24]/20 text-[#ED1C24] rounded-xl border border-[#ED1C24]/30 shadow-inner">
              <Footprints size={18} />
            </span>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                GOQii Daily Steps & Activity
              </span>
              <p className="text-[10px] text-slate-400 font-semibold">
                Target: 10,000 steps • 1 Karma per 1,000 steps
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{rawLiveSteps > 0 ? 'Live Sensor Active' : 'Health Connect Synced'}</span>
            </span>
          </div>
        </div>

        {/* Central Radial Steps Gauge & Big Counter */}
        <div className="flex items-center justify-around py-1">
          {/* Circular SVG Gauge */}
          <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="10"
              />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="url(#goqiiStepsGradient)"
                strokeWidth="10"
                strokeDasharray="314.16"
                strokeDashoffset={314.16 * (1 - Math.min(1, (Number(steps || 0) / 10000)))}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
              <defs>
                <linearGradient id="goqiiStepsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ED1C24" />
                  <stop offset="100%" stopColor="#FF6B00" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-white leading-none tracking-tight">
                {Number(steps || 0).toLocaleString()}
              </span>
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#FF6B00] mt-1">
                Steps
              </span>
              <span className="text-[9px] font-bold text-slate-400 mt-0.5">
                {Math.min(100, Math.round((Number(steps || 0) / 10000) * 100))}% Goal
              </span>
            </div>
          </div>

          {/* Goal Progress Overview */}
          <div className="space-y-2 text-left pl-3 flex-1 min-w-0">
            <div className="bg-slate-800/60 p-2.5 rounded-2xl border border-slate-700/60 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-300">Daily Target</span>
                <span className="text-amber-400">10,000</span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-[#ED1C24] via-orange-500 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, Math.round((Number(steps || 0) / 10000) * 100)))}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{10000 - Number(steps || 0) > 0 ? `${(10000 - Number(steps || 0)).toLocaleString()} to go` : 'Goal crushed! 🎉'}</span>
                <span className="text-emerald-400 font-bold">{Math.round((Number(steps || 0) / 10000) * 100)}%</span>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2 flex items-center gap-2 text-amber-300">
              <span className="text-sm font-black">★</span>
              <div className="text-[10px] leading-tight">
                <span className="font-extrabold">+{Math.max(1, Math.floor(Number(steps || 0) / 1000))} GOQii Karma</span> earned today!
              </div>
            </div>
          </div>
        </div>

        {/* 4-Stat Biometrics Grid */}
        <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-800/80 text-center">
          <div className="bg-slate-800/40 rounded-xl p-2 border border-slate-700/40">
            <span className="text-[9px] text-orange-400 font-bold block truncate">Active Burn</span>
            <span className="text-xs font-black text-white">{Number(calories || 0).toLocaleString()} <span className="text-[9px] font-normal text-slate-400">kcal</span></span>
          </div>

          <div className="bg-slate-800/40 rounded-xl p-2 border border-slate-700/40">
            <span className="text-[9px] text-cyan-400 font-bold block truncate">Distance</span>
            <span className="text-xs font-black text-white">{((Number(steps || 0) * 0.75) / 1000).toFixed(2)} <span className="text-[9px] font-normal text-slate-400">km</span></span>
          </div>

          <div className="bg-slate-800/40 rounded-xl p-2 border border-slate-700/40">
            <span className="text-[9px] text-emerald-400 font-bold block truncate">Active Time</span>
            <span className="text-xs font-black text-white">{Math.round(Number(steps || 0) / 100)} <span className="text-[9px] font-normal text-slate-400">min</span></span>
          </div>

          <div className="bg-slate-800/40 rounded-xl p-2 border border-slate-700/40">
            <span className="text-[9px] text-amber-400 font-bold block truncate">GOQii Karma</span>
            <span className="text-xs font-black text-white">★ {Math.max(1, Math.floor(Number(steps || 0) / 1000))}</span>
          </div>
        </div>

        {/* Auto-Sync Footer & Sync Action */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-semibold">
            <RefreshCw size={11} className="text-emerald-400 animate-spin" style={{ animationDuration: '6s' }} />
            <span>Auto-Sync Active • {lastSyncedTime ? `Synced: ${lastSyncedTime}` : 'Live stream active'}</span>
          </div>

          <button
            onClick={() => syncPhoneHealthToCloud(false)}
            disabled={isSyncingPhone}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#ED1C24] to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-extrabold rounded-xl text-[11px] shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={11} className={isSyncingPhone ? 'animate-spin' : ''} />
            <span>{isSyncingPhone ? 'Syncing…' : 'Sync GOQii Tracker'}</span>
          </button>
        </div>

        {/* Sync Feedback Toast */}
        {syncFeedback && (
          <div className={`p-2 border rounded-xl text-[10px] font-bold flex items-center justify-between animate-fade-in ${syncFeedback.status === 'error' ? 'bg-rose-500/20 border-rose-500/40 text-rose-200' : syncFeedback.status === 'local' ? 'bg-blue-500/20 border-blue-500/40 text-blue-200' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'}`}>
            <div className="flex items-center gap-1.5">
              {syncFeedback.status === 'error' ? <AlertCircle size={13} className="text-rose-400" /> : syncFeedback.status === 'saved' ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Info size={13} className="text-blue-300" />}
              <span>
                {syncFeedback.message || (
                  (syncFeedback.count != null && syncFeedback.count > 0)
                    ? `Synced ${syncFeedback.count.toLocaleString()} health readings to your account via ${syncFeedback.provider}.`
                    : `All health data is up to date (${(steps || 1863).toLocaleString()} steps) via ${syncFeedback.provider}.`
                )}
              </span>
            </div>
            <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded">
              {syncFeedback.time || syncFeedback.status}
            </span>
          </div>
        )}
      </div>

      {/* 3. Hero Card: GOQii Health Score (82 / 100) */}
      <div className="gradient-hero-score rounded-[26px] p-5 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none"></div>

        <div className="flex items-center justify-between relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-blue-100/90 tracking-wide">Your Health Score</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 bg-white/20 rounded-full text-white uppercase tracking-wider">
                HRA Verified
              </span>
            </div>

            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-4xl font-extrabold tracking-tight">{healthScore}</span>
              <span className="text-base font-semibold text-blue-200/80">/100</span>
            </div>

            <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-cyan-200">
              <TrendingUp size={14} className="text-cyan-300" />
              <span>+3 from last week</span>
            </div>

            <button
              onClick={() => setShowHraModal(true)}
              className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 bg-white/15 hover:bg-white/25 rounded-full backdrop-blur-sm transition border border-white/20"
            >
              <span>View HRA Breakdown</span>
              <ChevronRight size={12} />
            </button>
          </div>

          {/* Radial Score Gauge */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="8"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 * (1 - healthScore / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-extrabold text-white leading-none">{healthScore}</span>
              <span className="text-[10px] font-semibold text-blue-100/80 mt-0.5">Score</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. GOQii Lifestyle & Wellness Habit Trackers */}
      <div className="grid grid-cols-2 gap-3.5">
        {/* GOQii Habit Streak */}
        <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 text-slate-500">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 shadow-xs">
              <Zap size={16} />
            </div>
            <div>
              <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase block">GOQii Streak</span>
              <span className="text-xs font-black text-slate-800">{calculatedStreak > 0 ? 'Habit Active' : 'Start Streak'}</span>
            </div>
          </div>

          <div className="my-2.5">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900">{calculatedStreak}</span>
              <span className="text-xs font-bold text-amber-600">{calculatedStreak === 1 ? 'Day' : 'Days'}</span>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              {steps >= 10000 ? '✓ 10k Target Met' : `${Number(steps || 0).toLocaleString()} / 10k steps today`}
            </p>
          </div>

          <div className="flex items-center gap-1">
            {weekPills.map((pill, idx) => {
              const isSelected = selectedHistoryDate === pill.date || (!selectedHistoryDate && pill.isCurrentDay);
              let badgeClass = 'bg-slate-100 text-slate-400';
              if (pill.completed) {
                badgeClass = pill.isCurrentDay
                  ? 'bg-amber-400 text-slate-950 font-black shadow-xs ring-1 ring-amber-400'
                  : 'bg-amber-400 text-slate-950 font-black';
              } else if (pill.isCurrentDay) {
                badgeClass = 'bg-[#ED1C24] text-white animate-pulse font-black';
              } else if (pill.isFuture) {
                badgeClass = 'bg-slate-50 text-slate-300 font-medium cursor-not-allowed';
              }
              return (
                <div
                  key={idx}
                  onClick={() => !pill.isFuture && setSelectedHistoryDate(pill.date)}
                  title={`${pill.label} (${pill.fullDate}): ${pill.steps.toLocaleString()} steps • Click to inspect`}
                  className={`flex-1 h-5 rounded-md text-[9px] flex items-center justify-center transition-all cursor-pointer ${badgeClass} ${
                    isSelected ? 'ring-2 ring-slate-900 font-black scale-105 shadow-sm' : 'hover:scale-105'
                  }`}
                >
                  {pill.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* GOQii Water & Hydration Tracker */}
        <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-500">
              <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-500 shadow-xs">
                <Droplets size={16} />
              </div>
              <div>
                <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase block">Hydration</span>
                <span className="text-xs font-black text-slate-800">Water Log</span>
              </div>
            </div>

            {/* Quick +/- buttons */}
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => logWater(-1)}
                className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-800 active:scale-95 text-xs font-black cursor-pointer"
                title="Remove 250ml glass"
              >
                -
              </button>
              <span className="text-[11px] font-black text-slate-800 px-1">{hydrationGlasses}</span>
              <button
                type="button"
                onClick={() => logWater(1)}
                className="w-5 h-5 rounded flex items-center justify-center text-sky-600 hover:text-sky-800 active:scale-95 text-xs font-black cursor-pointer"
                title="Add 250ml glass"
              >
                +
              </button>
            </div>
          </div>

          <div className="my-2.5">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900">{hydrationGlasses * 250}</span>
              <span className="text-xs font-bold text-sky-600">/ 2,500 ml</span>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              {Math.min(100, Math.round(((hydrationGlasses * 250) / 2500) * 100))}% of Daily Hydration ({hydrationGlasses} / 10 glasses)
            </p>
          </div>

          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-sky-400 to-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.round(((hydrationGlasses * 250) / 2500) * 100))}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* ── Proactive Clinical Health Insight Banner (Proactive Ping Engine) ── */}
      {proactiveInsight && !insightDismissed && (
        <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 rounded-3xl p-4 sm:p-5 border border-emerald-500/40 shadow-xl text-white relative overflow-hidden space-y-3 animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                <Sparkles size={20} className="animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                    Proactive Clinical Check-in
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                </div>
                <h4 className="text-sm font-extrabold text-white tracking-tight mt-0.5">
                  Dr. MediBot Check-in for {displayName}
                </h4>
              </div>
            </div>
            <button
              onClick={() => setInsightDismissed(true)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              title="Dismiss"
            >
              <X size={15} />
            </button>
          </div>

          <p className="text-xs text-slate-200 leading-relaxed font-normal bg-white/5 p-3 rounded-2xl border border-white/10">
            {proactiveInsight.pingMessage || proactiveInsight.summary}
          </p>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(proactiveInsight.rulesTriggered || []).map((rule, idx) => (
                <span key={idx} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 capitalize">
                  {String(rule).replace(/_/g, ' ')}
                </span>
              ))}
            </div>

            <button
              onClick={openMediBotModal}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-500/20 transition cursor-pointer shrink-0"
            >
              <span>Reply to Dr. MediBot</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 4. Unified GOQii AI Doctor & Health Locker Assistant Banner */}
      <button
        onClick={openMediBotModal}
        className="w-full bg-gradient-to-r from-indigo-950 via-slate-900 to-sky-950 p-4 sm:p-5 rounded-3xl text-left border border-indigo-800/60 shadow-xl text-white group hover:border-cyan-400/60 transition relative overflow-hidden flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/25 shrink-0">
            <Stethoscope size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-white group-hover:text-cyan-300 transition tracking-tight">
                GOQii AI Doctor & Health Locker
              </h3>
              <span className="text-[9px] font-bold px-2 py-0.5 bg-cyan-400/20 text-cyan-300 rounded-full border border-cyan-400/30">
                Agentic LLM
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium mt-1 leading-snug">
              Consult AI Doctor • Upload PDFs & Reports • Clinical RAG & Drug Safety
            </p>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 group-hover:bg-cyan-500 group-hover:text-white transition shrink-0 ml-2">
          <ChevronRight size={18} />
        </div>
      </button>

      {/* 5. Watch & Ring External Sleep Telemetry Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Sleep Tracking (Watch & Ring)</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 flex items-center gap-1">
              <Watch size={10} />
              <span>External Sensor Telemetry</span>
            </span>
          </div>
          <button
            onClick={openPhoneHealthModal}
            className="text-xs font-bold text-[#00a8cc] hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>Wearables Hub</span>
            <ChevronRight size={13} />
          </button>
        </div>

        <div 
          onClick={openPhoneHealthModal}
          className="bg-white rounded-3xl p-4 sm:p-5 border border-indigo-100 shadow-sm space-y-3.5 cursor-pointer hover:border-indigo-300 transition group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition shrink-0">
                <Moon size={22} />
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900">
                    {sleepMinutes ? `${Math.floor(sleepMinutes / 60)}h ${sleepMinutes % 60}m` : '--'}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                    sleepMinutes ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-slate-400 bg-slate-50 border-slate-200'
                  }`}>
                    {sleepMinutes ? `Score: ${wearableMetrics?.sleep_score || Math.min(100, Math.round((sleepMinutes / 480) * 100))}` : 'No Sleep Recorded'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${sleepMinutes ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                  <span>{sleepMinutes ? `Captured from ${bleDevice?.name || 'Smartwatch / Ring'}` : 'Sync watch/ring to capture sleep telemetry'}</span>
                </p>
              </div>
            </div>

            <div className="hidden sm:flex flex-col items-end">
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl ${
                sleepMinutes ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 bg-slate-100'
              }`}>
                {sleepMinutes ? 'Restorative Sleep' : 'Awaiting Night Data'}
              </span>
              <span className="text-[10px] text-slate-400 mt-1">Target: 8h 00m</span>
            </div>
          </div>

          {/* Sleep Stages Progress Bar */}
          {sleepMinutes ? (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span className="flex items-center gap-1.5 text-indigo-700">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  Deep: {wearableMetrics?.deep_sleep ? `${Math.floor(wearableMetrics.deep_sleep / 60)}h ${wearableMetrics.deep_sleep % 60}m` : `${Math.floor((sleepMinutes * 0.25) / 60)}h ${Math.round(sleepMinutes * 0.25) % 60}m`}
                </span>
                <span className="flex items-center gap-1.5 text-purple-700">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  REM: {wearableMetrics?.rem_sleep ? `${Math.floor(wearableMetrics.rem_sleep / 60)}h ${wearableMetrics.rem_sleep % 60}m` : `${Math.floor((sleepMinutes * 0.2) / 60)}h ${Math.round(sleepMinutes * 0.2) % 60}m`}
                </span>
                <span className="flex items-center gap-1.5 text-sky-700">
                  <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                  Light: {wearableMetrics?.light_sleep ? `${Math.floor(wearableMetrics.light_sleep / 60)}h ${wearableMetrics.light_sleep % 60}m` : `${Math.floor((sleepMinutes * 0.55) / 60)}h ${Math.round(sleepMinutes * 0.55) % 60}m`}
                </span>
              </div>

              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: '25%' }} title="Deep Sleep"></div>
                <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: '20%' }} title="REM Sleep"></div>
                <div className="h-full bg-sky-400 transition-all duration-500" style={{ width: '55%' }} title="Light Sleep"></div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-xs text-slate-400 flex items-center justify-between">
              <span>Sleep tracking activates automatically when wearing your watch or ring overnight.</span>
              <button onClick={openPhoneHealthModal} className="text-indigo-600 font-bold hover:underline cursor-pointer">
                Connect Wearable
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5B. OpenWearables Cloud Hub */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-4 sm:p-5 text-white shadow-xl border border-indigo-500/30 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Watch size={20} className={openWearableConnections.some(c => c.status === 'connected') ? 'text-emerald-400 animate-pulse' : 'text-indigo-400'} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black tracking-tight text-white">OpenWearables Cloud Hub</h3>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                  openWearableConnections.some(c => c.status === 'connected')
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                }`}>
                  {openWearableConnections.filter(c => c.status === 'connected').length > 0
                    ? `${openWearableConnections.filter(c => c.status === 'connected').length} Provider(s) Synced`
                    : '14 Providers Supported'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Google Health · Garmin · Oura · WHOOP · Fitbit · Withings</p>
            </div>
          </div>

          <button
            onClick={openPhoneHealthModal}
            className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 transition flex items-center gap-1 border border-slate-700 cursor-pointer"
          >
            <span>All Providers</span>
            <ChevronRight size={12} />
          </button>
        </div>

        {/* Active Connected Providers List */}
        {openWearableConnections.filter(c => c.status === 'connected').length > 0 ? (
          <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700/80 space-y-3">
            <div className="space-y-2">
              {openWearableConnections.filter(c => c.status === 'connected').map((conn) => {
                return (
                  <div key={conn.id || conn.provider} className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Watch size={15} className="animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-white capitalize">{conn.provider.replace('_', ' ')}</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        </div>
                        <span className="text-[9px] text-emerald-300 font-medium">
                          {conn.lastSyncAt ? `Synced ${new Date(conn.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Connected & Streaming'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleQuickSyncOpenWearables()}
                      disabled={syncingOpenWearable}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={10} className={syncingOpenWearable ? "animate-spin" : ""} />
                      <span>Sync</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Comprehensive 6-Vitals Telemetry Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {/* 1. Live Pulse */}
              <div
                onClick={() => setSelectedVitalModal('heart_rate')}
                className="bg-slate-900/90 p-3 rounded-xl border border-slate-700/60 cursor-pointer hover:border-rose-500/60 transition active:scale-[0.98] group"
                title="View Today's Heart Rate Timeline"
              >
                <div className="text-[10px] text-slate-400 font-bold flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Heart size={12} className={heartRate ? "text-rose-400 animate-pulse" : "text-slate-500"} /> Live Pulse
                  </div>
                  <span className="text-[9px] text-rose-400 opacity-0 group-hover:opacity-100 transition">Graph →</span>
                </div>
                <div className="text-xl font-black text-white mt-0.5">
                  {heartRate !== null ? (
                    <>{heartRate} <span className="text-xs text-slate-400">BPM</span></>
                  ) : (
                    <span className="text-slate-500 text-lg">--</span>
                  )}
                </div>
                <span className={`text-[9px] font-medium ${heartRate ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {heartRate ? '✓ OpenWearables Telemetry' : 'Awaiting sensor pulse'}
                </span>
              </div>

              {/* 2. Blood Oxygen SpO2 */}
              <div
                onClick={() => setSelectedVitalModal('spo2')}
                className="bg-slate-900/90 p-3 rounded-xl border border-slate-700/60 cursor-pointer hover:border-teal-500/60 transition active:scale-[0.98] group"
                title="View Today's SpO2 Timeline"
              >
                <div className="text-[10px] text-slate-400 font-bold flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Gauge size={12} className={spo2 !== null ? "text-teal-400" : "text-slate-500"} /> Blood Oxygen
                  </div>
                  <span className="text-[9px] text-teal-400 opacity-0 group-hover:opacity-100 transition">Graph →</span>
                </div>
                <div className="text-xl font-black text-white mt-0.5">
                  {spo2 !== null ? (
                    <>{spo2} <span className="text-xs text-slate-400">% SpO2</span></>
                  ) : (
                    <span className="text-slate-500 text-lg">--</span>
                  )}
                </div>
                <span className={`text-[9px] font-medium ${spo2 !== null ? 'text-teal-300' : 'text-slate-400'}`}>
                  {spo2 !== null ? (spo2 >= 95 ? 'Optimal Saturation' : 'Low O2') : 'Awaiting sensor reading'}
                </span>
              </div>

              {/* 3. Blood Pressure */}
              <div
                onClick={() => setSelectedVitalModal('blood_pressure')}
                className="bg-slate-900/90 p-3 rounded-xl border border-slate-700/60 cursor-pointer hover:border-sky-500/60 transition active:scale-[0.98] group"
                title="View Today's Blood Pressure Timeline"
              >
                <div className="text-[10px] text-slate-400 font-bold flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Activity size={12} className={bpSys ? "text-sky-400" : "text-slate-500"} /> Blood Pressure
                  </div>
                  <span className="text-[9px] text-sky-400 opacity-0 group-hover:opacity-100 transition">Graph →</span>
                </div>
                <div className="text-xl font-black text-white mt-0.5">
                  {bpSys && bpDia ? (
                    <>{bpSys}/{bpDia} <span className="text-xs text-slate-400">mmHg</span></>
                  ) : (
                    <span className="text-slate-500 text-lg">--/--</span>
                  )}
                </div>
                <span className={`text-[9px] font-medium ${bpSys ? 'text-sky-300' : 'text-slate-400'}`}>
                  {bpSys ? 'Normotensive' : 'Awaiting reading'}
                </span>
              </div>

              {/* 4. Blood Glucose */}
              <div
                onClick={() => setSelectedVitalModal('blood_glucose')}
                className="bg-slate-900/90 p-3 rounded-xl border border-slate-700/60 cursor-pointer hover:border-amber-500/60 transition active:scale-[0.98] group"
                title="View Today's Blood Glucose Timeline"
              >
                <div className="text-[10px] text-slate-400 font-bold flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Droplets size={12} className={bloodGlucose !== null ? "text-amber-400" : "text-slate-500"} /> Blood Glucose
                  </div>
                  <span className="text-[9px] text-amber-400 opacity-0 group-hover:opacity-100 transition">Graph →</span>
                </div>
                <div className="text-xl font-black text-white mt-0.5">
                  {bloodGlucose !== null ? (
                    <>{bloodGlucose} <span className="text-xs text-slate-400">mg/dL</span></>
                  ) : (
                    <span className="text-slate-500 text-lg">--</span>
                  )}
                </div>
                <span className={`text-[9px] font-medium ${bloodGlucose !== null ? 'text-amber-300' : 'text-slate-400'}`}>
                  {bloodGlucose !== null ? 'Normal Reading' : 'Awaiting glucose data'}
                </span>
              </div>

              {/* 5. Steps */}
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-700/60">
                <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                  <Footprints size={12} className={steps > 0 ? "text-orange-400" : "text-slate-500"} /> Step Count
                </div>
                <div className="text-xl font-black text-white mt-0.5">
                  {Number(steps || 0).toLocaleString()} <span className="text-xs text-slate-400">steps</span>
                </div>
                <span className="text-[9px] text-orange-400 font-medium">Goal: 10,000 steps</span>
              </div>

              {/* 6. Sleep Duration */}
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-700/60">
                <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                  <Moon size={12} className={sleepMinutes ? "text-indigo-400" : "text-slate-500"} /> Device Sleep
                </div>
                <div className="text-xl font-black text-white mt-0.5">
                  {sleepMinutes ? (
                    <>{Math.floor(sleepMinutes / 60)}h {sleepMinutes % 60}m</>
                  ) : (
                    <span className="text-slate-500 text-lg">--</span>
                  )}
                </div>
                <span className={`text-[9px] font-medium ${sleepMinutes ? 'text-indigo-300' : 'text-slate-400'}`}>
                  {sleepMinutes ? `Score: ${Math.min(100, Math.round((sleepMinutes / 480) * 100))}` : 'Awaiting sleep telemetry'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-700/60">
              <button
                type="button"
                onClick={openPhoneHealthModal}
                className="text-indigo-300 hover:text-white font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>Manage Connected Accounts</span>
                <ChevronRight size={11} />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700 space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              Connect your wearable accounts through <strong>OpenWearables Cloud Sync</strong> to automatically stream pulse, sleep, SpO2, and activity into your health profile.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={openPhoneHealthModal}
                className="py-2.5 px-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <Link2 size={13} />
                <span>Connect Google Health</span>
              </button>

              <button
                type="button"
                onClick={openPhoneHealthModal}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <Watch size={13} className="text-indigo-400" />
                <span>View All 14 Providers</span>
              </button>
            </div>

            <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-700/60 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Supports Google Health, Garmin, Oura, WHOOP, Fitbit, Withings & more</span>
              <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
            </div>
          </div>
        )}
      </div>


      {/* 6. GOQii Vitals Hub (Interactive + Direct DB Logging) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">GOQii Vitals Hub</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={openPhoneHealthModal}
              className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1 cursor-pointer"
              title="Pair Smartwatch via Health Connect / Apple Health"
            >
              <Watch size={13} />
              <span>Connect Watch</span>
            </button>
            <span className="text-slate-300">•</span>
            <button
              onClick={openPatient360Modal}
              className="text-xs font-bold text-[#00a8cc] hover:underline cursor-pointer"
            >
              Patient 360
            </button>
          </div>
        </div>

        {/* 4-Box Vitals Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Heart Rate */}
          <div
            onClick={() => setSelectedVitalModal('heart_rate')}
            className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex flex-col justify-between cursor-pointer hover:border-rose-300 hover:shadow-md transition active:scale-[0.98] group"
            title="Click to view Today's Heart Rate Graph & Log"
          >
            <div className="flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
                  <Heart size={14} className={heartRate ? 'animate-pulse' : ''} />
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Heart Rate</span>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${heartRate ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-100'}`}>
                {heartRate ? (heartRate < 60 ? 'Bradycardia' : heartRate <= 100 ? 'Normal' : 'Elevated') : 'Unrecorded'}
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-extrabold text-slate-900">{heartRate !== null ? heartRate : '--'}</span>
              <span className="text-xs text-slate-400 ml-1 font-semibold">bpm</span>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-[10px] text-slate-400 font-medium">
                  {restingHeartRate ? `Resting: ${restingHeartRate} bpm` : (heartRate ? 'Captured reading' : 'No captured data')}
                </p>
                <span className="text-[9px] text-rose-500 font-bold opacity-0 group-hover:opacity-100 transition">Graph →</span>
              </div>
            </div>
          </div>

          {/* Blood Pressure */}
          <div
            onClick={() => setSelectedVitalModal('blood_pressure')}
            className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex flex-col justify-between cursor-pointer hover:border-blue-300 hover:shadow-md transition active:scale-[0.98] group"
            title="Click to view Today's Blood Pressure Graph & Log"
          >
            <div className="flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <Activity size={14} />
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Blood Pressure</span>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${bpSys ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-100'}`}>
                {bpSys ? (bpSys < 120 && (bpDia == null || bpDia < 80) ? 'Optimal' : bpSys <= 129 ? 'Elevated' : 'Stage 1') : 'Unrecorded'}
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-extrabold text-slate-900">{bpSys && bpDia ? `${bpSys}/${bpDia}` : '--/--'}</span>
              <span className="text-xs text-slate-400 ml-1 font-semibold">mmHg</span>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-[10px] text-slate-400 font-medium">
                  {bpSys ? 'Saved reading' : 'No captured data'}
                </p>
                <span className="text-[9px] text-blue-500 font-bold opacity-0 group-hover:opacity-100 transition">Graph →</span>
              </div>
            </div>
          </div>

          {/* Blood Glucose */}
          <div
            onClick={() => setSelectedVitalModal('blood_glucose')}
            className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex flex-col justify-between cursor-pointer hover:border-amber-300 hover:shadow-md transition active:scale-[0.98] group"
            title="Click to view Today's Blood Glucose Graph & Log"
          >
            <div className="flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                  <Droplets size={14} />
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Blood Glucose</span>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${bloodGlucose ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-100'}`}>
                {bloodGlucose ? (bloodGlucose < 100 ? 'Fasting Normal' : bloodGlucose < 126 ? 'Pre-diabetic' : 'High') : 'Unrecorded'}
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-extrabold text-slate-900">{bloodGlucose !== null ? bloodGlucose : '--'}</span>
              <span className="text-xs text-slate-400 ml-1 font-semibold">mg/dL</span>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-[10px] text-slate-400 font-medium">
                  {bloodGlucose ? 'Recent Reading' : 'No captured data'}
                </p>
                <span className="text-[9px] text-amber-500 font-bold opacity-0 group-hover:opacity-100 transition">Graph →</span>
              </div>
            </div>
          </div>

          {/* SpO2 */}
          <div
            onClick={() => setSelectedVitalModal('spo2')}
            className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex flex-col justify-between cursor-pointer hover:border-teal-300 hover:shadow-md transition active:scale-[0.98] group"
            title="Click to view Today's Blood Oxygen Graph & Log"
          >
            <div className="flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                  <Gauge size={14} />
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Blood Oxygen</span>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${spo2 ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-100'}`}>
                {spo2 ? (spo2 >= 95 ? 'Optimal' : 'Low O2') : 'Unrecorded'}
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-extrabold text-slate-900">{spo2 !== null ? spo2 : '--'}</span>
              <span className="text-xs text-slate-400 ml-1 font-semibold">%</span>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-[10px] text-slate-400 font-medium">
                  {spo2 ? 'Recent Reading' : 'No captured data'}
                </p>
                <span className="text-[9px] text-teal-500 font-bold opacity-0 group-hover:opacity-100 transition">Graph →</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Weekly & 30-Day Monthly Steps Analytics */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Step Analytics</h2>
          <div className="flex items-center p-1 bg-slate-100 rounded-xl text-[11px] font-extrabold">
            <button
              onClick={() => setStepChartTab('7days')}
              className={`px-3 py-1 rounded-lg transition ${
                stepChartTab === '7days'
                  ? 'bg-white text-[#00A8D0] shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setStepChartTab('30days')}
              className={`px-3 py-1 rounded-lg transition ${
                stepChartTab === '30days'
                  ? 'bg-white text-[#00A8D0] shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              30 Days
            </button>
          </div>
        </div>

        {stepChartTab === '7days' ? (
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-1">
              <span>Weekly Step Breakdown</span>
              <span>Tap any day to inspect</span>
            </div>
            <div className="flex items-end justify-between h-36 pt-4 pb-2 px-1">
              {weeklySteps.map((item, idx) => {
                const isSelected = selectedHistoryDate === item.date || (!selectedHistoryDate && item.isCurrent);
                return (
                  <div
                    key={idx}
                    onClick={() => !item.isFuture && setSelectedHistoryDate(item.date)}
                    className={`flex flex-col items-center gap-1.5 flex-1 transition-all ${
                      item.isFuture ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:opacity-90 active:scale-95'
                    }`}
                    title={`${item.day} (${item.fullDate}): ${item.steps.toLocaleString()} steps • Click to view`}
                  >
                    <span className={`text-[10px] font-bold ${isSelected ? 'text-[#00A8D0] font-black' : 'text-slate-500'}`}>
                      {item.count}
                    </span>
                    <div className={`w-7 bg-slate-100 rounded-t-lg flex items-end h-24 overflow-hidden transition-all ${
                      isSelected ? 'ring-2 ring-[#00A8D0] shadow-sm' : ''
                    }`}>
                      <div
                        className={`w-full rounded-t-lg transition-all duration-500 ${
                          isSelected
                            ? 'bg-[#00A8D0]'
                            : item.isCurrent
                            ? 'bg-[#00a8cc]'
                            : item.completed
                            ? 'bg-emerald-400'
                            : item.steps > 0
                            ? 'bg-[#93e2f5]'
                            : 'bg-slate-200'
                        }`}
                        style={{ height: item.height }}
                      ></div>
                    </div>
                    <span className={`text-[11px] font-bold ${
                      isSelected
                        ? 'text-[#00A8D0] font-black underline underline-offset-4 decoration-2'
                        : item.isCurrent
                        ? 'text-[#00a8cc]'
                        : 'text-slate-400'
                    }`}>
                      {item.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-4">
            {/* 30-Day Key Summary Metrics */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">30-Day Total</span>
                <span className="text-sm font-black text-slate-900">{total30DaySteps.toLocaleString()}</span>
                <span className="text-[9px] text-slate-400 font-semibold block">steps</span>
              </div>
              <div className="bg-cyan-50/60 rounded-xl p-2.5 border border-cyan-100">
                <span className="text-[9px] font-extrabold text-cyan-600 uppercase tracking-wider block">Daily Average</span>
                <span className="text-sm font-black text-[#00A8D0]">{avg30DaySteps.toLocaleString()}</span>
                <span className="text-[9px] text-cyan-600 font-semibold block">steps/day</span>
              </div>
              <div className="bg-emerald-50/60 rounded-xl p-2.5 border border-emerald-100">
                <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider block">Peak Day</span>
                <span className="text-sm font-black text-emerald-700">{peak30DaySteps.toLocaleString()}</span>
                <span className="text-[9px] text-emerald-600 font-semibold block">highest</span>
              </div>
            </div>

            {/* 30-Day Bar Visual */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                <span>Past 30 Days Activity Trend (Tap any day)</span>
                <span>Today (Right)</span>
              </div>
              <div className="flex items-end justify-between h-28 pt-2 pb-1 px-1 bg-slate-50 rounded-xl border border-slate-100 gap-0.5 overflow-x-auto no-scrollbar">
                {past30Days.map((item, idx) => {
                  const maxVal = Math.max(10000, peak30DaySteps);
                  const heightPct = `${Math.min(100, Math.max(8, Math.round((item.steps / maxVal) * 100)))}%`;
                  const isSelected = selectedHistoryDate === item.date || (!selectedHistoryDate && item.isToday);
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedHistoryDate(item.date)}
                      className={`flex flex-col items-center flex-1 min-w-[8px] cursor-pointer group transition-transform ${
                        isSelected ? 'scale-110 z-10' : 'hover:scale-105'
                      }`}
                      title={`${item.dateLabel} (${item.fullDate}): ${item.steps.toLocaleString()} steps • Click to view`}
                    >
                      <div className={`w-full bg-slate-200/80 rounded-t-sm flex items-end h-20 overflow-hidden ${
                        isSelected ? 'ring-2 ring-cyan-500' : ''
                      }`}>
                        <div
                          className={`w-full rounded-t-sm transition-all duration-300 ${
                            isSelected
                              ? 'bg-cyan-500 font-black'
                              : item.isToday
                              ? 'bg-[#00A8D0]'
                              : item.steps >= 10000
                              ? 'bg-emerald-500'
                              : item.steps >= 8000
                              ? 'bg-emerald-400'
                              : item.steps > 0
                              ? 'bg-sky-300'
                              : 'bg-slate-200'
                          }`}
                          style={{ height: heightPct }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Selected Day Activity Breakdown Card */}
        {selectedDayInfo && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                  selectedDayInfo.isToday ? 'bg-[#00A8D0]/10 text-[#00A8D0]' : 'bg-slate-100 text-slate-700'
                }`}>
                  <Calendar size={15} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-900">
                      {selectedDayInfo.fullDate || selectedDayInfo.date}
                    </span>
                    {selectedDayInfo.isToday ? (
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-cyan-50 text-[#00A8D0] rounded-full border border-cyan-200">
                        Live Today
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded-full">
                        Selected Day
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {selectedDayInfo.steps >= 10000
                      ? '★ Daily Target Achieved (10,000+ steps)'
                      : selectedDayInfo.steps > 0
                      ? `${(10000 - selectedDayInfo.steps).toLocaleString()} steps left to target`
                      : 'No activity recorded on this day'}
                  </span>
                </div>
              </div>

              {!selectedDayInfo.isToday && (
                <button
                  type="button"
                  onClick={() => setSelectedHistoryDate(null)}
                  className="px-2.5 py-1 text-[10px] font-black text-[#00A8D0] bg-cyan-50 hover:bg-cyan-100 rounded-lg transition active:scale-95 flex items-center gap-1"
                  title="Return to today's live activity"
                >
                  <RefreshCw size={11} />
                  <span>Back to Today</span>
                </button>
              )}
            </div>

            {/* 4-Item Metrics Grid for Selected Day */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Steps Card */}
              <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold">
                  <span className="flex items-center gap-1">
                    <Footprints size={12} className="text-[#00A8D0]" /> Steps
                  </span>
                  <span className="text-[9px] font-black text-[#00A8D0]">
                    {Math.round((selectedDayInfo.steps / 10000) * 100)}%
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-base font-black text-slate-900">
                    {selectedDayInfo.steps.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold ml-1">/ 10k</span>
                </div>
                {/* Micro progress bar */}
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      selectedDayInfo.steps >= 10000 ? 'bg-emerald-500' : 'bg-[#00A8D0]'
                    }`}
                    style={{ width: `${Math.min(100, Math.round((selectedDayInfo.steps / 10000) * 100))}%` }}
                  ></div>
                </div>
              </div>

              {/* Calories Card */}
              <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold">
                  <span className="flex items-center gap-1">
                    <Flame size={12} className="text-rose-500" /> Active Burn
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-base font-black text-slate-900">
                    {(selectedDayInfo.calories || (selectedDayInfo.steps > 0 ? Math.round(selectedDayInfo.steps * 0.045) : 0)).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold ml-1">kcal</span>
                </div>
                <span className="text-[9px] text-slate-400 block mt-1 font-medium">Daily energy burn</span>
              </div>

              {/* Distance Card */}
              <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="text-emerald-500" /> Distance
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-base font-black text-slate-900">
                    {selectedDayInfo.distance > 0
                      ? (selectedDayInfo.distance >= 1000
                          ? (selectedDayInfo.distance / 1000).toFixed(2)
                          : selectedDayInfo.distance)
                      : (selectedDayInfo.steps > 0 ? (selectedDayInfo.steps * 0.00075).toFixed(2) : '0.00')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold ml-1">
                    {selectedDayInfo.distance >= 1000 || selectedDayInfo.steps > 1000 ? 'km' : 'm'}
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 block mt-1 font-medium">Total distance</span>
              </div>

              {/* Vitals / Day Summary Card */}
              <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold">
                  <span className="flex items-center gap-1">
                    <Heart size={12} className="text-red-500" /> Vitals & Rest
                  </span>
                </div>
                <div className="mt-1">
                  {selectedDayInfo.heartRate ? (
                    <div>
                      <span className="text-base font-black text-slate-900">{selectedDayInfo.heartRate}</span>
                      <span className="text-[10px] text-slate-400 font-semibold ml-1">bpm</span>
                    </div>
                  ) : selectedDayInfo.sleep ? (
                    <div>
                      <span className="text-base font-black text-slate-900">
                        {Math.floor(selectedDayInfo.sleep / 60)}h {selectedDayInfo.sleep % 60}m
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs font-bold text-slate-500">
                        {selectedDayInfo.completed ? 'Goal Achieved' : selectedDayInfo.steps > 0 ? 'Normal Active' : 'Rest Day'}
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-slate-400 block mt-1 font-medium">
                  {selectedDayInfo.heartRate ? 'Heart rate' : selectedDayInfo.sleep ? 'Sleep duration' : 'Daily Status'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 8. Hydration Tracker (Synced directly to PostgreSQL) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Hydration Tracker</h2>
          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            Auto-synced to DB
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-500">
                <Droplets size={20} />
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-slate-900">{hydrationLiters}L</span>
                  <span className="text-xs text-slate-400 font-medium">of 2.5L daily goal</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => logWater(-1)}
                className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-600 hover:text-slate-900 active:scale-95"
              >
                <Minus size={14} />
              </button>
              <span className="text-xs font-bold px-2 text-slate-800">{hydrationGlasses}</span>
              <button
                onClick={() => logWater(1)}
                className="w-7 h-7 rounded-lg bg-sky-500 text-white shadow-sm flex items-center justify-center hover:bg-sky-600 active:scale-95"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* 8 Clickable Droplet Glasses */}
          <div className="flex items-center justify-between pt-2">
            {[...Array(8)].map((_, i) => (
              <button
                key={i}
                onClick={() => logWater(i < hydrationGlasses ? -1 : 1)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${i < hydrationGlasses
                    ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30 scale-105'
                    : 'bg-sky-50 text-sky-300 hover:bg-sky-100'
                  }`}
                title={`Glass ${i + 1} (250 mL)`}
              >
                <Droplets size={16} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 9. Connected Health Providers Tracker */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 text-white space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-cyan-500/20 text-cyan-400 rounded-xl">
              <ShieldCheck size={16} />
            </span>
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-wider">Connected Health Providers</h3>
              <p className="text-[10px] text-slate-400 font-medium">Real-time sync with native health hubs</p>
            </div>
          </div>
          <button
            onClick={() => setShowHealthPermissionsModal(true)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold rounded-lg text-[10px] border border-slate-700 transition cursor-pointer"
          >
            Manage
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
          <div className="p-2 bg-slate-800/60 rounded-xl border border-slate-700/60 flex flex-col items-center gap-1">
            <span className="font-extrabold text-emerald-400">{isAndroid ? '🤖 Health Connect' : '🍏 Apple Health'}</span>
            <span className="text-[9px] text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded font-bold">Connected</span>
          </div>

          <div className="p-2 bg-slate-800/60 rounded-xl border border-slate-700/60 flex flex-col items-center gap-1">
            <span className="font-extrabold text-purple-400">⌚ boAt / Wearables</span>
            <span className="text-[9px] text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded font-bold">Open Wearable</span>
          </div>

          <div className="p-2 bg-slate-800/60 rounded-xl border border-slate-700/60 flex flex-col items-center gap-1">
            <span className="font-extrabold text-cyan-400">🐘 PostgreSQL DB</span>
            <span className="text-[9px] text-cyan-300 bg-cyan-500/20 px-1.5 py-0.5 rounded font-bold">Auto-Synced</span>
          </div>
        </div>
      </div>

      {/* Pull to refresh helper */}
      <div className="text-center pt-2">
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-medium"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Refreshing vitals…' : 'Sync data with PostgreSQL server'}</span>
        </button>
      </div>

      {/* ── MODAL 1: HRA Assessment Breakdown ── */}
      {showHraModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ShieldCheck size={18} />
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">Health Risk Assessment (HRA)</h3>
              </div>
              <button onClick={() => setShowHraModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>Cardiovascular Health</span>
                  <span className="text-emerald-600">85% (Low Risk)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '85%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>Metabolic Fitness</span>
                  <span className="text-emerald-600">80% (Normal)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '80%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>Sleep & Recovery</span>
                  <span className="text-sky-600">78% (Good)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: '78%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>Stress Resilience</span>
                  <span className="text-indigo-600">86% (Resilient)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: '86%' }}></div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              💡 <strong>Coach Recommendation:</strong> Maintain your 8,000+ daily steps routine and 2.5L water intake to stay in the low cardiovascular risk bracket.
            </p>

            <button
              onClick={() => setShowHraModal(false)}
              className="w-full py-2.5 bg-[#00a8cc] hover:bg-[#0092b3] text-white font-bold rounded-xl text-xs transition"
            >
              Close Assessment
            </button>
          </div>
        </div>
      )}

      {/* ── Sleep Details & Manual Log Modal ── */}
      {showSleepDetailsModal && (
        <div 
          onClick={() => setShowSleepDetailsModal(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[28px] max-w-sm w-full p-5 space-y-4 shadow-2xl border border-slate-100"
          >
            {/* Header with clear (X) close button */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                  <Moon size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Sleep Analysis & Recovery</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Circadian rhythm & sleep tracking</p>
                </div>
              </div>
              <button
                onClick={() => setShowSleepDetailsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Today's Sleep Stat */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50/50 p-4 rounded-2xl border border-purple-100 text-center space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-bold text-purple-600 block">Today's Recorded Sleep</span>
              <span className="text-3xl font-black text-slate-900 block">
                {sleepMinutes ? `${Math.floor(sleepMinutes / 60)}h ${sleepMinutes % 60}m` : '--'}
              </span>
              <p className="text-xs text-slate-500 font-medium">
                {sleepMinutes 
                  ? (sleepMinutes >= 420 ? 'Optimal restorative sleep (7h+)' : 'Slightly below recommended 7-8h target') 
                  : 'No sleep reading tracked yet today'}
              </p>
            </div>

            {/* Quick Log Sleep Duration */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-bold text-slate-800 block">Log Last Night's Sleep</span>
              <div className="grid grid-cols-4 gap-1.5">
                {[6, 7, 7.5, 8].map((hrs) => (
                  <button
                    key={hrs}
                    onClick={() => handleSaveSleep(hrs)}
                    disabled={savingSleep}
                    className="py-2 text-center rounded-xl border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 font-bold text-xs text-slate-700 transition"
                  >
                    {hrs} hrs
                  </button>
                ))}
              </div>

              {/* Custom hours input */}
              <div className="flex gap-1.5 pt-1">
                <input
                  type="number"
                  step="0.5"
                  placeholder="Custom hours (e.g. 7.5)"
                  value={manualSleepHours}
                  onChange={(e) => setManualSleepHours(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-xl bg-slate-50 border-slate-200 text-xs font-medium outline-none focus:ring-1 focus:ring-purple-500"
                />
                <button
                  onClick={() => handleSaveSleep(manualSleepHours)}
                  disabled={savingSleep || !manualSleepHours}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-xs"
                >
                  {savingSleep ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            {/* Close Button at bottom */}
            <div className="pt-2 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => setShowSleepDetailsModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Today's Interactive Vitals Intraday Graph Modal ── */}
      {selectedVitalModal && (
        <VitalsDetailModal
          vitalKey={selectedVitalModal}
          onClose={() => setSelectedVitalModal(null)}
          intradayData={intradayMerged}
          latestValues={{
            heartRate,
            restingHeartRate,
            spo2,
            bpSys,
            bpDia,
            bloodGlucose,
          }}
          onOpenLogModal={(k) => setShowLogVitalModal(k)}
        />
      )}

      {/* ── Quick Manual Vital Entry Modal ── */}
      {showLogVitalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-slate-100 text-slate-800">
                  {showLogVitalModal === 'heart_rate' && <Heart size={18} className="text-rose-500" />}
                  {showLogVitalModal === 'spo2' && <Gauge size={18} className="text-teal-500" />}
                  {showLogVitalModal === 'blood_pressure' && <Activity size={18} className="text-sky-500" />}
                  {showLogVitalModal === 'blood_glucose' && <Droplets size={18} className="text-amber-500" />}
                </span>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    {showLogVitalModal === 'heart_rate' && 'Log Pulse (Heart Rate)'}
                    {showLogVitalModal === 'spo2' && 'Log Blood Oxygen (SpO2)'}
                    {showLogVitalModal === 'blood_pressure' && 'Log Blood Pressure'}
                    {showLogVitalModal === 'blood_glucose' && 'Log Blood Glucose'}
                  </h3>
                  <p className="text-[10px] text-slate-400">Stores directly to Health Connect & OpenWearables</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLogVitalModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveVital} className="space-y-3">
              {showLogVitalModal === 'blood_pressure' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Systolic (mmHg)</label>
                    <input
                      type="number"
                      placeholder="e.g. 120"
                      value={vitalSysInput}
                      onChange={(e) => setVitalSysInput(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#00a8cc]"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Diastolic (mmHg)</label>
                    <input
                      type="number"
                      placeholder="e.g. 80"
                      value={vitalDiaInput}
                      onChange={(e) => setVitalDiaInput(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#00a8cc]"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    {showLogVitalModal === 'heart_rate' && 'Pulse Value (BPM)'}
                    {showLogVitalModal === 'spo2' && 'Oxygen Percentage (%)'}
                    {showLogVitalModal === 'blood_glucose' && 'Glucose Level (mg/dL)'}
                  </label>
                  <input
                    type="number"
                    step={showLogVitalModal === 'blood_glucose' ? '0.1' : '1'}
                    placeholder={
                      showLogVitalModal === 'heart_rate' ? 'e.g. 72' :
                      showLogVitalModal === 'spo2' ? 'e.g. 98' : 'e.g. 95'
                    }
                    value={vitalInputValue}
                    onChange={(e) => setVitalInputValue(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#00a8cc]"
                    required
                    autoFocus
                  />
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogVitalModal(null)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loggingVital}
                  className="w-1/2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {loggingVital && <RefreshCw size={12} className="animate-spin" />}
                  <span>Save Reading</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>

      <HealthPermissionsModal
        isOpen={showHealthPermissionsModal}
        onClose={() => setShowHealthPermissionsModal(false)}
        detectedPlatform={detectedOS}
        memberId={getHealthMemberId(member)}
        authToken={token}
        onGranted={() => {
          setShowHealthPermissionsModal(false);
          syncPhoneHealthToCloud(false);
        }}
      />

      {/* Pre-prompt Explain & Denied Modal Pipeline */}
      <HealthPermissionModal
        isOpen={permissionModal.isOpen}
        mode={permissionModal.mode}
        metrics={permissionModal.metrics}
        missing={permissionModal.missing}
        onConfirm={() => {
          const resolver = permissionModal.resolver;
          setPermissionModal((prev) => ({ ...prev, isOpen: false }));
          if (resolver) {
            resolver(permissionModal.mode === 'explain' ? true : 'settings');
          }
        }}
        onCancel={() => {
          const resolver = permissionModal.resolver;
          setPermissionModal((prev) => ({ ...prev, isOpen: false }));
          if (resolver) {
            resolver(permissionModal.mode === 'explain' ? false : 'cancel');
          }
        }}
      />
    </PullToRefresh>
  );
}
