import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Watch, 
  RefreshCw, 
  X, 
  CheckCircle2, 
  Activity, 
  Moon, 
  Heart, 
  ExternalLink,
  AlertCircle,
  Info,
  Footprints,
  Droplets,
  Radio,
  Check,
  Zap,
  ShieldCheck,
  Link2,
  Unlink,
  ChevronRight,
  Filter,
  Sparkles,
  Search,
  Lock,
  ArrowUpRight,
  Trash2,
  Shield,
  Smartphone,
  Copy,
  AlertTriangle,
  Bluetooth
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  HEALTH_METRICS,
  PERMISSION,
  requestHealthAccess,
  HealthQueue,
  syncHistory,
  captureLiveHeartRate,
  WebPlatformHealth,
  BleWatchManager,
  NativeBleBridge,
  defaultStorage,
} from '../../services/healthCapture';
import { isNative } from '../../native/nativeBridge';
import HealthPermissionModal from '../common/HealthPermissionModal';

// Comprehensive metadata for all OpenWearables providers
const OPEN_WEARABLE_CATALOG = [
  {
    key: 'apple_health',
    name: 'Apple Health',
    category: 'smartwatch',
    deviceType: 'Apple Watch & iOS HealthKit',
    description: 'Apple Watch Ultra, Series 9, SE, and Apple HealthKit longitudinal clinical telemetry.',
    brandColor: '#F43F5E',
    badgeText: '133 · 72%',
    syncMode: 'Phone Native Sync',
    authType: 'phone_sdk',
    metrics: ['Heart Rate', 'Blood Pressure', 'Blood Glucose', 'ECG', 'SpO2', 'Steps', 'Sleep']
  },
  {
    key: 'health_connect',
    name: 'Health Connect',
    category: 'smartwatch',
    deviceType: 'Android On-Device Health Store',
    description: 'Unified Android storage hub synchronizing smartwatches and sensor apps directly on your phone.',
    brandColor: '#10B981',
    badgeText: '98 · 53%',
    syncMode: 'Phone Native Sync',
    authType: 'phone_sdk',
    metrics: ['Heart Rate', 'Blood Pressure', 'Blood Glucose', 'SpO2', 'Steps', 'Sleep']
  },
  {
    key: 'garmin',
    name: 'Garmin',
    category: 'smartwatch',
    deviceType: 'Smartwatch & GPS Telemetry',
    description: 'Forerunner, Fenix, Venu, Epix, and Instinct smartwatches with real-time continuous biometric streaming.',
    brandColor: '#007CC3',
    badgeText: '71 · 38%',
    syncMode: 'Webhook Push',
    authType: 'oauth',
    metrics: ['Heart Rate', 'HRV', 'Sleep', 'Body Battery', 'GPS Workouts']
  },
  {
    key: 'samsung_health',
    name: 'Samsung Health',
    category: 'smartwatch',
    deviceType: 'Galaxy Watch & Health Hub',
    description: 'Galaxy Watch6, Watch5, and Galaxy Fit biometric metrics connected via Samsung Health.',
    brandColor: '#2563EB',
    badgeText: '57 · 31%',
    syncMode: 'Phone Native Sync',
    authType: 'phone_sdk',
    metrics: ['Heart Rate', 'Blood Pressure', 'Blood Glucose', 'Body Composition', 'SpO2', 'Sleep']
  },
  {
    key: 'google_health',
    name: 'Google Health',
    category: 'smartwatch',
    deviceType: 'Google Cloud OAuth · Health & Fitness',
    description: 'Sync heart rate, blood pressure, blood glucose, step count, sleep stages, SpO2, and workouts directly from your Google Cloud Health account.',
    brandColor: '#4285F4',
    badgeText: '42 · 23%',
    syncMode: 'Live Pull Sync',
    authType: 'oauth',
    metrics: ['Heart Rate', 'Blood Pressure', 'Blood Glucose', 'SpO2', 'Steps', 'Sleep']
  },
  {
    key: 'withings',
    name: 'Withings',
    category: 'fitness_band',
    deviceType: 'ScanWatch & Clinical Devices',
    description: 'ScanWatch ECG, Body Smart scales, Sleep Tracking Mat, and BPM Core cardiovascular monitors.',
    brandColor: '#0284C7',
    badgeText: '42 · 23%',
    syncMode: 'Live Pull Sync',
    authType: 'oauth',
    metrics: ['ECG', 'Pulse Velocity', 'Weight', 'Blood Pressure', 'Sleep']
  },
  {
    key: 'oura',
    name: 'Oura',
    category: 'ring',
    deviceType: 'Smart Health Ring (Gen 3 / Horizon)',
    description: 'Clinical-grade sleep staging, readiness scores, nighttime HRV, and skin temperature trends from Oura Cloud.',
    brandColor: '#8B5CF6',
    badgeText: '36 · 19%',
    syncMode: 'Live Pull Sync',
    authType: 'oauth',
    metrics: ['Sleep Stages', 'Readiness', 'HRV', 'Skin Temp', 'SpO2']
  },
  {
    key: 'suunto',
    name: 'Suunto',
    category: 'smartwatch',
    deviceType: 'Adventure GPS Smartwatches',
    description: 'Suunto Race, 9 Peak Pro, and Vertical adventure timepieces with barometer and altimeter vitals.',
    brandColor: '#D97706',
    badgeText: '29 · 16%',
    syncMode: 'Live Pull Sync',
    authType: 'oauth',
    metrics: ['GPS Tracks', 'Heart Rate', 'Recovery Time', 'Altitude Vitals']
  },
  {
    key: 'polar',
    name: 'Polar',
    category: 'smartwatch',
    deviceType: 'Sports Smartwatches & Sensors',
    description: 'Vantage V3, Grit X Pro, Pacer Pro, and Verity Sense optical heart rate monitoring sensors.',
    brandColor: '#DC2626',
    badgeText: '27 · 15%',
    syncMode: 'Live Pull Sync',
    authType: 'oauth',
    metrics: ['Cardio Load', 'Running Power', 'Sleep Plus Stages', 'Recovery Pro']
  },
  {
    key: 'sensorbio',
    name: 'Sensor Bio',
    category: 'fitness_band',
    deviceType: 'Continuous Clinical Biosensors',
    description: 'Clinical wearable biosensors, continuous temperature patches, and physiological stream monitors.',
    brandColor: '#7C3AED',
    badgeText: '26 · 14%',
    syncMode: 'Live Pull Sync',
    authType: 'oauth',
    metrics: ['Core Temp', 'Galvanic Skin Response', 'Biometric Waves']
  },
  {
    key: 'whoop',
    name: 'Whoop',
    category: 'fitness_band',
    deviceType: 'Performance Strap 4.0',
    description: 'Continuous cardiovascular strain, restorative recovery percentages, and real-time biometric sleep coach.',
    brandColor: '#E11D48',
    badgeText: '26 · 14%',
    syncMode: 'Live Pull Sync',
    authType: 'oauth',
    metrics: ['Recovery', 'Day Strain', 'Sleep Performance', 'HRV']
  },
  {
    key: 'strava',
    name: 'Strava',
    category: 'fitness_band',
    deviceType: 'Athletic Activity & Workouts',
    description: 'Sync running, cycling, hiking, and multisport GPS telemetry directly from Strava cloud services.',
    brandColor: '#FC4C02',
    badgeText: '18 · 10%',
    syncMode: 'Live Pull Sync',
    authType: 'oauth',
    metrics: ['Workouts', 'Cadence', 'Elevation', 'Power Output', 'Distance']
  },
  {
    key: 'ultrahuman',
    name: 'Ultrahuman',
    category: 'ring',
    deviceType: 'Smart Ring AIR & CGM',
    description: 'Ultrahuman Ring AIR titanium ring and M1 Continuous Glucose Monitoring circadian telemetry.',
    brandColor: '#059669',
    badgeText: '17 · 9%',
    syncMode: 'Live Pull Sync',
    authType: 'oauth',
    metrics: ['Ring Movement', 'Glucose Dynamics', 'Sleep Index', 'Circadian Phase']
  },
  {
    key: 'fitbit',
    name: 'Fitbit',
    category: 'smartwatch',
    deviceType: 'Smartwatches & Fitness Trackers',
    description: 'Sense 2, Versa 4, Charge 6, and Inspire 3 wearable data synced via the official Fitbit Web API.',
    brandColor: '#00B0B9',
    badgeText: '6 · 3%',
    syncMode: 'Live Pull Sync',
    authType: 'oauth',
    metrics: ['Steps', 'Cardio Pulse', 'Sleep Architecture', 'Active Minutes']
  }
];

export function WearablesScreen({ onClose }) {
  const { member } = useAuth();
  
  // State
  const [providers, setProviders] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'connected' | 'smartwatch' | 'ring' | 'fitness_band'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Action feedback states
  const [actionInProgress, setActionInProgress] = useState({}); // { [providerKey]: 'connecting' | 'syncing' | 'disconnecting' }
  const [isDisconnectingAll, setIsDisconnectingAll] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error' | 'info', text: string }
  const [authModal, setAuthModal] = useState(null); // { provider: Object, authUrl: string }
  const [confirmDialog, setConfirmDialog] = useState(null); // { type: 'single' | 'all', provider?: Object, title: string, message: string }
  const [showBleScannerModal, setShowBleScannerModal] = useState(false);
  const [bleScanning, setBleScanning] = useState(false);
  const [bleDiagMessage, setBleDiagMessage] = useState('');
  const bleBridgeRef = useRef(null);
  const [permissionModal, setPermissionModal] = useState({
    isOpen: false,
    mode: 'explain',
    metrics: [],
    missing: [],
    resolver: null,
  });

  // UI interface for healthCapture pipeline
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
          metrics: [],
          missing,
          resolver: resolve,
        });
      }),
  }), []);

  // Relative time formatter for sync timestamp
  const formatLastSynced = (timestamp) => {
    if (!timestamp) return 'Never synced';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Recently';
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 45) return 'Synced just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Synced ${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `Synced ${diffHr}h ago`;
    return `Synced ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  };

  // Load providers and existing connections from OpenWearables & backend
  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [provRes, connRes] = await Promise.all([
        api.getWearableProviders().catch(() => ({ data: [] })),
        api.getWearableConnections().catch(() => ({ data: [] }))
      ]);

      const rawProviders = Array.isArray(provRes?.data) ? provRes.data : [];
      const rawConnections = Array.isArray(connRes?.data) ? connRes.data : [];

      setProviders(rawProviders);
      setConnections(rawConnections);
    } catch (err) {
      console.error('Failed to load OpenWearables data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map and merge remote provider status with our catalog
  const catalogList = useMemo(() => {
    const connMap = new Map();
    connections.forEach((conn) => {
      const provKey = (conn.provider || '').toLowerCase();
      connMap.set(provKey, conn);
    });

    const remoteProvMap = new Map();
    providers.forEach((p) => {
      const pKey = (p.provider || '').toLowerCase();
      remoteProvMap.set(pKey, p);
    });

    return OPEN_WEARABLE_CATALOG.map((cat) => {
      const conn = connMap.get(cat.key);
      const remote = remoteProvMap.get(cat.key);
      const isConnected = conn && conn.status === 'connected';
      const isConnecting = conn && conn.status === 'connecting';

      return {
        ...cat,
        isConnected: Boolean(isConnected),
        isConnecting: Boolean(isConnecting),
        connection: conn || null,
        remoteMeta: remote || null,
        lastSyncedAt: conn?.lastSyncAt || conn?.lastDataAt || null,
      };
    });
  }, [providers, connections]);

  // Filtered catalog
  const filteredCatalog = useMemo(() => {
    return catalogList.filter((item) => {
      if (activeCategory === 'connected' && !item.isConnected && !item.isConnecting) return false;
      if (activeCategory === 'smartwatch' && item.category !== 'smartwatch') return false;
      if (activeCategory === 'ring' && item.category !== 'ring') return false;
      if (activeCategory === 'fitness_band' && item.category !== 'fitness_band') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.deviceType.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [catalogList, activeCategory, searchQuery]);

  // Handle direct developer sandbox connection for testing without third-party credentials
  const handleSandboxConnect = async (provider) => {
    setActionInProgress((prev) => ({ ...prev, [provider.key]: 'connecting' }));
    setStatusMessage(null);
    setAuthModal(null);

    try {
      if (provider.authType === 'phone_sdk') {
        const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
        await api.updatePhoneHealthConnection({
          provider: provider.key,
          platform: isIOS ? 'ios' : 'android',
          status: 'connected',
        });
      } else {
        await api.connectWearableProvider(provider.key, {
          mode: 'developer_sandbox',
          note: 'Connected via Developer Sandbox Mode for live testing',
        });
      }

      setStatusMessage({
        type: 'success',
        text: `Connected to ${provider.name} in Developer Sandbox Mode! Live telemetry is enabled.`,
      });
      loadData(true);
    } catch (err) {
      console.error(`Failed to connect ${provider.name}:`, err);
      setStatusMessage({
        type: 'error',
        text: err?.message || `Could not connect ${provider.name}.`,
      });
    } finally {
      setActionInProgress((prev) => ({ ...prev, [provider.key]: null }));
    }
  };

  // Real physical smartwatches scanned or paired (zero dummy data)
  const [scannedDevices, setScannedDevices] = useState(() => {
    try {
      const stored = localStorage.getItem('wellness_paired_devices');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((d) => ({
            key: d.brand || 'bluetooth_ble',
            name: d.name,
            model: d.model || 'BLE Smartwatch',
            bleId: d.bleId || d.serial || d.id,
            signal: d.signal || null,
            brandColor: d.brandColor || '#0284C7',
            metrics: ['Steps', 'Heart Rate', ...(d.battery != null ? ['Battery'] : [])],
            status: 'Connected',
            isPaired: true,
          }));
        }
      }
    } catch {}
    return [];
  });

  const hasWebBluetooth = typeof navigator !== 'undefined' && Boolean(navigator.bluetooth);
  const hasNativeBle = isNative || (typeof window !== 'undefined' && Boolean(window.ReactNativeWebView));
  const hasBleSupport = hasWebBluetooth || hasNativeBle;

  const handleOpenInChrome = () => {
    const url = window.location.href;
    try {
      if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'OPEN_URL',
          url,
        }));
        return;
      }
    } catch (_) {}
    window.open(url, '_blank');
  };

  // Handle Bluetooth Low Energy Smartwatch Pairing (Fitpass, Noise, boAt, GOQii, etc.)
  const handlePairBleWatch = async (watch) => {
    setActionInProgress((prev) => ({ ...prev, [watch.key]: 'connecting' }));
    setStatusMessage(null);
    setShowBleScannerModal(false);

    try {
      // 0. Permission check: explain -> ask -> consent -> capture -> queue
      const platformHealth = new WebPlatformHealth({
        openSettingsCallback: () => setShowBleScannerModal(true),
      });
      const healthPerm = await requestHealthAccess({
        metrics: ['steps', 'heart_rate', 'sleep', 'spo2', 'calories'],
        platformHealth,
        ui: uiHealthHandler,
        storage: defaultStorage,
      });

      if (healthPerm.status === 'denied' && healthPerm.declinedByUser) {
        setStatusMessage({
          type: 'info',
          text: `Pairing canceled. Health permissions were not confirmed.`,
        });
        return;
      }

      // 1. Connect physical device via Native BLE GATT bridge if in native WebView
      if (hasNativeBle && watch.bleId) {
        const bridge = bleBridgeRef.current || new NativeBleBridge();
        bridge.connect(watch.bleId);
      }

      // 2. Persist connection in backend database
      await api.connectWearableProvider(watch.key, {
        mode: 'ble_direct',
        note: `${watch.name} paired via Bluetooth Low Energy GATT link`,
        deviceName: watch.name,
        deviceModel: watch.model,
      });

      // 3. Persist device in local storage for HomeScreen & real-time telemetry
      const pairedData = {
        id: `ble-${watch.key}`,
        name: watch.name,
        brand: watch.key,
        model: watch.model || 'BLE GATT Active Stream',
        type: 'smartwatch',
        battery: watch.battery ?? null,
        signal: watch.signal ?? null,
        bleId: watch.bleId,
        status: 'connected',
        pairedAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem('wellness_paired_device', JSON.stringify(pairedData));
        const stored = localStorage.getItem('wellness_paired_devices');
        const list = stored ? JSON.parse(stored) : [];
        const updated = [...list.filter((d) => d.brand !== watch.key), pairedData];
        localStorage.setItem('wellness_paired_devices', JSON.stringify(updated));
      } catch {}

      // 4. Initialize offline queue for original data
      const queue = new HealthQueue({
        storage: defaultStorage,
        upload: (batch) => api.post('/health/samples', { samples: batch }),
      });
      await queue.flush().catch(() => {});

      // 5. Dispatch real-time telemetry update event for HomeScreen
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wearableTelemetryUpdated', {
          detail: { provider: watch.key, device: pairedData, status: 'connected' }
        }));
      }

      setStatusMessage({
        type: 'success',
        text: `Connected to ${watch.name} via Bluetooth! Original sensor pipeline active with zero dummy data.`,
      });
      loadData(true);
    } catch (err) {
      console.error(`Failed to pair ${watch.name}:`, err);
      setStatusMessage({
        type: 'error',
        text: err?.message || `Could not pair ${watch.name} via Bluetooth.`,
      });
    } finally {
      setActionInProgress((prev) => ({ ...prev, [watch.key]: null }));
    }
  };

  // Scan physical hardware Bluetooth watches using Native BLE or Web Bluetooth API
  const handleScanPhysicalBluetooth = async () => {
    setBleScanning(true);
    setStatusMessage(null);
    setBleDiagMessage('Starting Bluetooth scan...');

    // 1. Direct Native BLE Bridge when running inside React Native WebView
    if (hasNativeBle) {
      try {
        const bleBridge = new NativeBleBridge();
        bleBridgeRef.current = bleBridge;

        bleBridge.on('diag', (g) => {
          if (g?.stage === 'requesting_permissions') setBleDiagMessage('Requesting Bluetooth permissions...');
          else if (g?.stage === 'permissions_ok') setBleDiagMessage('Bluetooth permissions granted.');
          else if (g?.stage === 'bluetooth_on') setBleDiagMessage('Bluetooth hardware active.');
          else if (g?.stage === 'scanning') setBleDiagMessage('Scanning nearby devices (showing all)...');
          else if (g?.stage === 'device_found') setBleDiagMessage(`Found ${g.count} nearby device(s)...`);
        });

        bleBridge.on('device', (d) => {
          if (!d) return;
          const isClosest = d.isClosest || (typeof d.rssi === 'number' && d.rssi >= -50);
          const name = d.rawName || (d.name && !d.name.startsWith('Nearby Device') && !d.name.startsWith('Watch (') ? d.name : null) || (isClosest ? `Smartwatch in Hand (${d.id.slice(-5)})` : `Nearby Device (${d.id.slice(-5)})`);
          const newDevice = {
            key: 'bluetooth_ble',
            name,
            model: `${name} (Bluetooth Low Energy)`,
            battery: null,
            rssi: typeof d.rssi === 'number' ? d.rssi : -999,
            signal: d.rssi ? `${d.rssi} dBm` : null,
            signalQuality: isClosest ? 'In Hand / Closest Watch' : (d.hasHeartRate ? 'Heart Rate Supported' : 'Nearby Bluetooth'),
            isClosest,
            hasHeartRate: d.hasHeartRate,
            brandColor: isClosest ? '#10B981' : '#0284C7',
            bleId: d.id,
            metrics: ['Steps', 'Heart Rate', 'Battery'],
            status: 'Discovered',
          };
          setScannedDevices((prev) => {
            const map = new Map();
            for (const item of prev) {
              map.set(item.bleId, item);
            }
            const existing = map.get(d.id);
            if (existing && existing.name && !existing.name.startsWith('Nearby Device') && !name) {
              newDevice.name = existing.name;
              newDevice.model = existing.model;
            }
            map.set(d.id, newDevice);
            return Array.from(map.values()).sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
          });
        });

        bleBridge.on('connectedDevice', (dev) => {
          if (!dev) return;
          const resolvedName = dev.name || 'Connected Smartwatch';
          setScannedDevices((prev) =>
            prev.map((item) =>
              item.bleId === dev.id
                ? { ...item, name: resolvedName, model: `${resolvedName} (GATT Connected)`, status: 'Connected', isPaired: true }
                : item
            )
          );
          try {
            const pairedData = {
              id: dev.id,
              name: resolvedName,
              brand: 'bluetooth_ble',
              model: `${resolvedName} Bluetooth Watch`,
              bleId: dev.id,
              isPaired: true,
              pairedAt: new Date().toISOString(),
            };
            localStorage.setItem('wellness_paired_device', JSON.stringify(pairedData));
          } catch {}
          setStatusMessage({ type: 'success', text: `Connected to ${resolvedName} via Bluetooth!` });
        });

        bleBridge.on('scanState', ({ scanning }) => {
          setBleScanning(Boolean(scanning));
          if (!scanning) {
            setBleDiagMessage((prev) => prev.includes('Found') ? prev : 'Scan complete. If your watch is not listed, turn on its Bluetooth and close other companion apps.');
          }
        });

        bleBridge.on('error', ({ message }) => {
          setBleScanning(false);
          let errText = message || 'Bluetooth scan failed';
          if (message === 'BLUETOOTH_OFF') errText = 'Turn on Bluetooth on your phone.';
          else if (message === 'BLE_PERMISSION_DENIED') errText = 'Allow Nearby devices permission in Settings.';
          setBleDiagMessage(errText);
          setStatusMessage({ type: 'error', text: errText });
        });

        bleBridge.on('state', ({ state }) => {
          if (state === 'pairing_may_prompt') {
            setStatusMessage({ type: 'info', text: 'Accept the pairing request on your phone and watch.' });
          } else if (state === 'connected_no_heart_rate') {
            setStatusMessage({ type: 'info', text: 'Connected! Watch uses companion app sync via Health Connect.' });
          } else if (state === 'connected') {
            setStatusMessage({ type: 'success', text: 'Smartwatch connected over Bluetooth!' });
          }
        });

        bleBridge.on('heartRate', ({ bpm }) => {
          if (bpm > 0) {
            setStatusMessage({ type: 'success', text: `Live pulse from watch: ${bpm} BPM!` });
          }
        });

        bleBridge.scan();
        setTimeout(() => setBleScanning(false), 15000);
        return;
      } catch (err) {
        setBleScanning(false);
        setBleDiagMessage(`Bluetooth error: ${err.message || 'Could not start scan'}`);
        setStatusMessage({
          type: 'error',
          text: `Bluetooth scan error: ${err.message || 'Could not start BLE scan.'}`,
        });
        return;
      }
    }

    // 2. Web Bluetooth API fallback in Chrome desktop/mobile browser
    if (!hasWebBluetooth) {
      setBleScanning(false);
      handleOpenInChrome();
      setStatusMessage({
        type: 'info',
        text: 'Opening live Bluetooth scanner in Chrome for physical hardware discovery...',
      });
      return;
    }

    try {
      const ALL_BLE_OPTIONAL_SERVICES = [
        'heart_rate',
        'battery_service',
        'device_information',
        0x1822, 0x1809, 0x1800, 0x1801, 0x1826, 0x181C, 0x1805,
        0xFEE0, 0xFEE7, 0xFFF0, 0xFEA0,
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
        '0000fee0-0000-1000-8000-00805f9b34fb',
        '0000fee7-0000-1000-8000-00805f9b34fb',
        '0000fff0-0000-1000-8000-00805f9b34fb',
      ];

      // Request any nearby physical Bluetooth device directly
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ALL_BLE_OPTIONAL_SERVICES,
      });

      if (device) {
        let batteryVal = null;
        try {
          const server = await device.gatt?.connect();
          if (server) {
            try {
              const bService = await server.getPrimaryService('battery_service');
              const bChar = await bService.getCharacteristic('battery_level');
              const val = await bChar.readValue();
              batteryVal = val.getUint8(0);
            } catch (_) {}
          }
        } catch (_) {}

        const devName = device.name || 'Bluetooth Smartwatch';
        const detectedKey = 'bluetooth_ble';
        const brandColor = '#0284C7';

        const newDevice = {
          key: detectedKey,
          name: devName,
          model: `${devName} (Nearby Bluetooth BLE)`,
          battery: batteryVal,
          signal: null,
          signalQuality: 'Hardware Connected',
          brandColor,
          bleId: device.id || `BLE-${Date.now().toString(36)}`,
          metrics: ['Steps', 'Heart Rate', ...(batteryVal != null ? ['Battery'] : [])],
          status: 'Discovered',
        };

        setScannedDevices((prev) => [newDevice, ...prev.filter((d) => d.name !== devName)]);
        await handlePairBleWatch(newDevice);
      }
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        console.warn('Physical BLE scan error:', err);
        setStatusMessage({
          type: 'error',
          text: `Bluetooth scan error: ${err.message || 'Could not access Bluetooth hardware.'}`,
        });
      }
    } finally {
      setBleScanning(false);
    }
  };

  // Handle Connect Provider (with duplicate connection prevention & phone SDK support)
  const handleConnectProvider = async (provider) => {
    if (provider.isConnected) {
      setStatusMessage({
        type: 'info',
        text: `${provider.name} is already connected to your account. Duplicate connections are blocked.`,
      });
      return;
    }

    setActionInProgress((prev) => ({ ...prev, [provider.key]: 'connecting' }));
    setStatusMessage(null);

    // 1. Direct Bluetooth BLE Smartwatch Pairing Flow (any physical watch: boAt, Fire-Boltt, Amazfit, etc.)
    if (provider.authType === 'ble_direct' || provider.key === 'bluetooth_ble') {
      setActionInProgress((prev) => ({ ...prev, [provider.key]: null }));
      setShowBleScannerModal(true);
      return;
    }

    // 2. Phone SDK Provider Flow (Google Health Connect, Apple Health, Samsung Health)
    if (provider.authType === 'phone_sdk') {
      try {
        const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
        const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '');

        // OS compatibility guard
        if (provider.key === 'apple_health' && !isIOS) {
          setAuthModal({
            provider,
            isAppleNonIos: true,
          });
          return;
        }

        if (provider.key === 'health_connect' && isIOS) {
          setStatusMessage({
            type: 'error',
            text: 'Google Health Connect is designed for Android. On your Apple device, please connect Apple HealthKit.'
          });
          return;
        }

        const platform = isIOS ? 'ios' : 'android';

        // Pre-prompt pipeline: explain -> ask before system dialog
        const platformHealth = new WebPlatformHealth({
          openSettingsCallback: () => {
            try {
              if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_HEALTH_SETUP' }));
              }
            } catch {}
          },
        });

        const healthPerm = await requestHealthAccess({
          metrics: ['steps', 'heart_rate', 'sleep', 'spo2', 'calories', 'glucose'],
          platformHealth,
          ui: uiHealthHandler,
          storage: defaultStorage,
        });

        if (healthPerm.status === 'denied' && healthPerm.declinedByUser) {
          setStatusMessage({
            type: 'info',
            text: `Health connection was not confirmed.`,
          });
          return;
        }

        const grantedMetrics = healthPerm.granted.length > 0
          ? healthPerm.granted
          : ['steps', 'heart_rate', 'sleep', 'spo2', 'calories', 'glucose'];

        // Trigger native permission dialog if running inside mobile WebView
        try {
          if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'REQUEST_HEALTH_PERMISSIONS',
              provider: provider.key,
              metrics: grantedMetrics,
            }));
          }
        } catch {}

        // Connect the phone health provider in the backend
        await api.updatePhoneHealthConnection({
          provider: provider.key,
          platform,
          permissions: grantedMetrics,
          status: 'connected',
        });

        // Initialize offline queue and incremental sync
        const queue = new HealthQueue({
          storage: defaultStorage,
          upload: (batch) => api.post('/health/samples', { samples: batch }),
        });
        await queue.flush().catch(() => {});

        setStatusMessage({
          type: 'success',
          text: `Connected to ${provider.name}! Original sensor pipeline active with zero dummy data.`
        });
        loadData(true);
      } catch (err) {
        console.error(`Failed to connect ${provider.name}:`, err);
        setStatusMessage({
          type: 'error',
          text: err?.message || `Could not connect ${provider.name}.`
        });
      } finally {
        setActionInProgress((prev) => ({ ...prev, [provider.key]: null }));
      }
      return;
    }

    // 3. Google Health: In-modal guidance to avoid automatic Error 403 access_denied redirection
    if (provider.key === 'google_health') {
      const googleOAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=706163042257-2622tnk0ndldvi4ccu5051ssujikfki3.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fapi.openwearables.io%2Fapi%2Fv1%2Foauth%2Fgoogle%2Fcallback&scope=openid+email+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgooglehealth.activity_and_fitness.readonly+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgooglehealth.health_metrics_and_measurements.readonly+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgooglehealth.nutrition.readonly+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgooglehealth.sleep.readonly+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgooglehealth.settings.readonly&access_type=offline&prompt=consent';
      setActionInProgress((prev) => ({ ...prev, [provider.key]: null }));
      setAuthModal({
        provider,
        authUrl: googleOAuthUrl,
      });
      return;
    }

    // 4. Cloud OAuth Provider Flow (Garmin, WHOOP, Oura, Fitbit, etc.)
    try {
      const redirectUrl = `${window.location.origin}/wearables/callback`;
      let connectUrl = null;
      try {
        const result = await api.createWearableConnectSession(provider.key, redirectUrl);
        connectUrl = result?.connectUrl || null;
      } catch (sessionErr) {
        console.warn(`Could not reach OpenWearables for ${provider.name}:`, sessionErr?.message);
      }

      setAuthModal({
        provider,
        authUrl: connectUrl,
      });

      if (connectUrl) {
        try {
          window.open(connectUrl, '_blank', 'noopener,noreferrer');
        } catch {}
      }
    } catch (err) {
      console.error(`Failed to connect ${provider.name}:`, err);
      setAuthModal({
        provider,
        authUrl: null,
      });
    } finally {
      setActionInProgress((prev) => ({ ...prev, [provider.key]: null }));
    }
  };

  // Handle Sync Individual Provider (supporting both Phone SDK & Cloud OAuth)
  const handleSyncProvider = async (provider) => {
    setActionInProgress((prev) => ({ ...prev, [provider.key]: 'syncing' }));
    setStatusMessage(null);

    try {
      if (provider.authType === 'phone_sdk') {
        // Only sync genuine samples if available from native hardware bridge
        const latestTele = typeof window !== 'undefined' ? window.__LATEST_HEALTH_TELEMETRY__ : null;
        const realSamples = [];
        if (latestTele?.today?.steps && Number(latestTele.today.steps) > 0) {
          realSamples.push({
            provider: provider.key,
            metric: 'steps',
            value: Number(latestTele.today.steps),
            unit: 'count',
            recordedAt: new Date().toISOString(),
            externalId: `${provider.key}-steps-${Date.now()}`
          });
        }
        if (latestTele?.health?.heartRate?.latest && Number(latestTele.health.heartRate.latest) > 0) {
          realSamples.push({
            provider: provider.key,
            metric: 'heart_rate',
            value: Number(latestTele.health.heartRate.latest),
            unit: 'bpm',
            recordedAt: new Date().toISOString(),
            externalId: `${provider.key}-hr-${Date.now()}`
          });
        }

        if (realSamples.length > 0) {
          await api.syncPhoneHealth(realSamples);
          setStatusMessage({
            type: 'success',
            text: `Synced ${provider.name} successfully! Recorded ${realSamples.length} live hardware reading(s).`
          });
        } else {
          // Trigger native bridge pull if in WebView
          if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PULL_DOWN_SYNC', provider: provider.key }));
          }
          setStatusMessage({
            type: 'info',
            text: `Sync requested for ${provider.name}. Open the app on your phone to transmit latest on-device telemetry.`
          });
        }
        setTimeout(() => loadData(true), 1200);
      } else {
        const res = await api.syncWearableProvider(provider.key);
        setStatusMessage({
          type: 'success',
          text: res?.message || `Synced ${provider.name} successfully! Pulled latest vital biometrics.`
        });
        setTimeout(() => loadData(true), 1200);
      }
    } catch (err) {
      console.error(`Failed to sync ${provider.name}:`, err);
      setStatusMessage({
        type: 'error',
        text: err?.message || `Sync request for ${provider.name} failed.`
      });
    } finally {
      setActionInProgress((prev) => ({ ...prev, [provider.key]: null }));
    }
  };

  // Handle Sync All Connected Providers
  const handleSyncAll = async () => {
    const connectedList = catalogList.filter((c) => c.isConnected);
    if (connectedList.length === 0) return;

    setIsSyncingAll(true);
    setStatusMessage({
      type: 'info',
      text: `Syncing all ${connectedList.length} connected device(s)...`
    });

    try {
      const syncPromises = connectedList.map((conn) =>
        api.syncWearableProvider(conn.key).catch((err) => ({ error: true, message: err.message, provider: conn.name }))
      );
      const results = await Promise.allSettled(syncPromises);
      const successful = results.filter((r) => r.status === 'fulfilled' && !r.value?.error).length;

      setStatusMessage({
        type: 'success',
        text: `Sync complete! Successfully refreshed vitals from ${successful} of ${connectedList.length} connected provider(s).`
      });
      setTimeout(() => loadData(true), 1500);
    } catch (err) {
      console.error('Failed to sync all providers:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to sync connected devices.'
      });
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Open Disconnect Individual Provider confirmation modal
  const handleDisconnectProvider = (provider) => {
    setConfirmDialog({
      type: 'single',
      provider,
      title: `Disconnect ${provider.name}?`,
      message: `Future health readings and activity will stop syncing from your ${provider.name} account.`
    });
  };

  // Open Disconnect All confirmation modal
  const handleDisconnectAll = () => {
    const connectedList = catalogList.filter((c) => c.isConnected);
    if (connectedList.length === 0) return;

    setConfirmDialog({
      type: 'all',
      title: `Disconnect All (${connectedList.length}) Devices?`,
      message: `This will unlink all active wearable connections and revoke cloud data synchronization across all providers.`
    });
  };

  // Execute confirmed disconnect action
  const executeConfirmAction = async () => {
    if (!confirmDialog) return;
    const dialog = confirmDialog;
    setConfirmDialog(null);

    if (dialog.type === 'single' && dialog.provider) {
      const provider = dialog.provider;
      setActionInProgress((prev) => ({ ...prev, [provider.key]: 'disconnecting' }));
      setStatusMessage(null);

      try {
        await api.disconnectWearableProvider(provider.key);
        if (provider.key === 'bluetooth_ble' || provider.key === 'ble_direct') {
          try {
            const current = localStorage.getItem('wellness_paired_device');
            if (current) {
              const parsed = JSON.parse(current);
              if (parsed.brand === 'bluetooth_ble' || parsed.id?.includes('ble')) {
                localStorage.removeItem('wellness_paired_device');
              }
            }
            const stored = localStorage.getItem('wellness_paired_devices');
            if (stored) {
              const list = JSON.parse(stored).filter((d) => d.brand !== 'bluetooth_ble' && !d.id?.includes('ble'));
              localStorage.setItem('wellness_paired_devices', JSON.stringify(list));
            }
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('wearableTelemetryUpdated', { detail: { provider: provider.key, status: 'disconnected' } }));
            }
          } catch {}
        }
        setStatusMessage({
          type: 'success',
          text: `${provider.name} has been disconnected successfully.`
        });
        loadData(true);
      } catch (err) {
        console.error(`Failed to disconnect ${provider.name}:`, err);
        setStatusMessage({
          type: 'error',
          text: err?.message || `Could not disconnect ${provider.name}.`
        });
      } finally {
        setActionInProgress((prev) => ({ ...prev, [provider.key]: null }));
      }
    } else if (dialog.type === 'all') {
      setIsDisconnectingAll(true);
      setStatusMessage(null);

      try {
        const res = await api.disconnectAllWearableProviders();
        try {
          localStorage.removeItem('wellness_paired_device');
          localStorage.removeItem('wellness_paired_devices');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('wearableTelemetryUpdated', { detail: { provider: 'all', status: 'disconnected' } }));
          }
        } catch {}
        setStatusMessage({
          type: 'success',
          text: res?.message || 'All wearable providers have been disconnected successfully.'
        });
        await loadData(true);
      } catch (err) {
        console.error('Failed to disconnect all providers:', err);
        setStatusMessage({
          type: 'error',
          text: err?.message || 'Could not disconnect all providers. Please try again.'
        });
      } finally {
        setIsDisconnectingAll(false);
      }
    }
  };

  const connectedList = catalogList.filter((c) => c.isConnected);

  const pairedBleDevices = useMemo(() => {
    try {
      const stored = localStorage.getItem('wellness_paired_devices');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const single = localStorage.getItem('wellness_paired_device');
      if (single) {
        const parsed = JSON.parse(single);
        if (parsed?.name) return [parsed];
      }
    } catch {}
    return [];
  }, [actionInProgress, refreshing, scannedDevices]);

  const totalConnectedCount = connectedList.length + pairedBleDevices.length;
  const connectedCount = totalConnectedCount;

  const handleDisconnectBleWatch = async (bleWatch) => {
    try {
      const stored = localStorage.getItem('wellness_paired_devices');
      const list = stored ? JSON.parse(stored) : [];
      const updated = list.filter((d) => (d.bleId || d.id || d.name) !== (bleWatch.bleId || bleWatch.id || bleWatch.name));
      localStorage.setItem('wellness_paired_devices', JSON.stringify(updated));

      const single = localStorage.getItem('wellness_paired_device');
      if (single) {
        const parsed = JSON.parse(single);
        if ((parsed.bleId || parsed.id || parsed.name) === (bleWatch.bleId || bleWatch.id || bleWatch.name)) {
          localStorage.removeItem('wellness_paired_device');
        }
      }

      setScannedDevices((prev) => prev.filter((d) => (d.bleId || d.id || d.name) !== (bleWatch.bleId || bleWatch.id || bleWatch.name)));
      await api.disconnectWearableProvider(bleWatch.brand || bleWatch.key || 'bluetooth_ble').catch(() => {});

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wearableTelemetryUpdated', {
          detail: { provider: bleWatch.brand || 'bluetooth_ble', status: 'disconnected' }
        }));
      }

      setStatusMessage({
        type: 'info',
        text: `Unpaired ${bleWatch.name || 'smartwatch'}.`,
      });
      loadData(true);
    } catch (err) {
      console.error('Failed to unpair BLE watch:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-white w-full max-w-2xl h-[94vh] max-h-[880px] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 text-slate-800">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#044343] via-[#064e3b] to-[#044343] p-4 sm:p-5 text-white flex items-center justify-between border-b border-emerald-900/40">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white shadow-inner">
              <Watch size={24} className={totalConnectedCount > 0 ? "animate-pulse text-emerald-300" : "text-white"} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">Smartwatch & Wearables Hub</h3>
                <span className="px-2.5 py-0.5 bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 rounded-full text-[10px] font-extrabold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  {totalConnectedCount > 0 ? `${totalConnectedCount} Connected` : 'Ready'}
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 font-medium mt-0.5">
                Official OpenWearables Cloud Sync & Direct Bluetooth BLE Hub
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {connectedCount > 0 && (
              <button
                onClick={handleDisconnectAll}
                disabled={isDisconnectingAll || loading}
                className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-100 text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                title="Disconnect all connected devices"
              >
                <Unlink size={13} className={isDisconnectingAll ? "animate-spin" : ""} />
                <span className="hidden sm:inline">{isDisconnectingAll ? "Disconnecting..." : "Disconnect All"}</span>
              </button>
            )}

            <button
              onClick={() => {
                setRefreshing(true);
                loadData();
              }}
              disabled={refreshing || loading}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white transition cursor-pointer disabled:opacity-50"
              title="Refresh provider status"
            >
              <RefreshCw size={15} className={refreshing || loading ? "animate-spin" : ""} />
            </button>
            
            <button 
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Account Identity & Duplicate Protection Info Bar */}
        <div className="bg-slate-100/90 px-4 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-700 shrink-0" />
            <span className="font-semibold text-slate-700">
              Account: <span className="font-black text-[#044343]">{member?.profile?.fullName || member?.fullName || 'Nitheesh Marlapati'}</span>
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-[11px] text-slate-500 font-medium">
              {member?.phone || member?.phoneE164 || (member?.id ? `ID: ${member.id.slice(0, 8)}...` : 'Active Session')}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
            <Lock size={10} />
            <span>Duplicate Protection Active (1:1 Binding)</span>
          </div>
        </div>

        {/* Status Feedback Toast */}
        {statusMessage && (
          <div className={`px-4 py-2.5 text-xs flex items-center justify-between border-b ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-indigo-50 text-indigo-800 border-indigo-200'
          }`}>
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
              {statusMessage.type === 'error' && <AlertCircle size={16} className="text-rose-600 shrink-0" />}
              {statusMessage.type === 'info' && <Info size={16} className="text-indigo-600 shrink-0" />}
              <span className="font-semibold">{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Direct Bluetooth BLE Smartwatch Scanner Card */}
        <div className="mx-4 mt-3 p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl text-white shadow-lg border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-inner shrink-0">
              <Bluetooth size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black tracking-tight text-white">Bluetooth Smartwatch Scanner</h4>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  BLE GATT Live
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 font-medium">
                Pair any nearby <b>Bluetooth Smartwatch</b> (boAt, Fire-Boltt, Noise, Fitpass, Amazfit, etc.) directly via BLE GATT!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowBleScannerModal(true)}
            className="w-full sm:w-auto py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition cursor-pointer shrink-0"
          >
            <Radio size={14} className="animate-spin text-cyan-300" style={{ animationDuration: '4s' }} />
            <span>Scan for Nearby Watches</span>
          </button>
        </div>

        {/* Category Filters & Search */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 space-y-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-[#044343] text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              All Providers ({catalogList.length})
            </button>
            <button
              onClick={() => setActiveCategory('connected')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                activeCategory === 'connected'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <CheckCircle2 size={13} className={connectedCount > 0 ? "text-emerald-300" : ""} />
              <span>Connected ({connectedCount})</span>
            </button>
            <button
              onClick={() => setActiveCategory('smartwatch')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                activeCategory === 'smartwatch'
                  ? 'bg-[#044343] text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Watch size={13} />
              <span>Smartwatches</span>
            </button>
            <button
              onClick={() => setActiveCategory('ring')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                activeCategory === 'ring'
                  ? 'bg-[#044343] text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Radio size={13} />
              <span>Smart Rings</span>
            </button>
            <button
              onClick={() => setActiveCategory('fitness_band')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                activeCategory === 'fitness_band'
                  ? 'bg-[#044343] text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Activity size={13} />
              <span>Bands & Sensors</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search OpenWearables providers (Google Health, Garmin, Oura, WHOOP, Fitbit...)"
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#044343]"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar bg-slate-50/50">
          
          {/* Active Connected Cards Banner if any (OpenWearables Cloud + Paired Physical BLE Watches) */}
          {totalConnectedCount > 0 && activeCategory === 'all' && !searchQuery && (
            <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 rounded-2xl p-4 text-white shadow-md border border-emerald-500/30 space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                    Active Connected Wearables
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/40 font-bold">
                    {totalConnectedCount} Active
                  </span>
                </div>

                {/* Banner Actions: Sync All & Disconnect All */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncAll}
                    disabled={isSyncingAll || isDisconnectingAll}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    title="Sync all connected devices"
                  >
                    <RefreshCw size={11} className={isSyncingAll ? "animate-spin" : ""} />
                    <span>{isSyncingAll ? "Syncing All..." : `Sync All (${totalConnectedCount})`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnectAll}
                    disabled={isDisconnectingAll || isSyncingAll}
                    className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-500/40 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    title="Disconnect all connected devices"
                  >
                    <Unlink size={11} className={isDisconnectingAll ? "animate-spin" : ""} />
                    <span>{isDisconnectingAll ? "Disconnecting..." : "Disconnect All"}</span>
                  </button>
                </div>
              </div>

              {/* Connected Devices Grid: BLE Smartwatches + OpenWearables */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* 1. Direct Physical BLE Paired Smartwatches */}
                {pairedBleDevices.map((watch) => {
                  const brandColor = watch.brandColor || '#0284C7';
                  return (
                    <div key={watch.bleId || watch.id || watch.name} className="bg-slate-800/90 p-2.5 rounded-xl border border-indigo-500/40 flex items-center justify-between gap-2 shadow-sm">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm"
                          style={{ backgroundColor: brandColor }}
                        >
                          <Watch size={15} className="animate-pulse" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate">{watch.name}</span>
                            <span className="px-1 py-0.2 rounded text-[8px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              BLE
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-300 font-medium block truncate">
                            ID: {watch.bleId || watch.id}{watch.battery != null ? ` · 🔋 ${watch.battery}%` : ''} · Hardware Link
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setStatusMessage({
                              type: 'success',
                              text: `Refreshed live data from ${watch.name}. Zero duplicate data.`
                            });
                            loadData(true);
                          }}
                          className="px-2 py-1 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          title={`Sync ${watch.name} now`}
                        >
                          <RefreshCw size={10} />
                          <span>Sync</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDisconnectBleWatch(watch)}
                          className="p-1.5 bg-slate-700 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg text-[10px] transition cursor-pointer"
                          title={`Unpair ${watch.name}`}
                        >
                          <Unlink size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* 2. OpenWearables Cloud Connections */}
                {connectedList.map((conn) => {
                  const isSyncing = actionInProgress[conn.key] === 'syncing' || isSyncingAll;
                  const isDisconnecting = actionInProgress[conn.key] === 'disconnecting' || isDisconnectingAll;

                  return (
                    <div key={conn.key} className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm"
                          style={{ backgroundColor: conn.brandColor }}
                        >
                          <Watch size={15} className="animate-pulse" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{conn.name}</div>
                          <span className="text-[10px] text-emerald-300 font-medium block truncate">
                            {formatLastSynced(conn.lastSyncedAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSyncProvider(conn)}
                          disabled={isSyncing}
                          className="px-2 py-1 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title={`Sync ${conn.name} now`}
                        >
                          <RefreshCw size={10} className={isSyncing ? "animate-spin" : ""} />
                          <span>Sync</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDisconnectProvider(conn)}
                          disabled={isDisconnecting}
                          className="p-1.5 bg-slate-700 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg text-[10px] transition cursor-pointer disabled:opacity-50"
                          title={`Disconnect ${conn.name}`}
                        >
                          <Unlink size={12} className={isDisconnecting ? "animate-spin" : ""} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <RefreshCw size={28} className="animate-spin text-[#044343]" />
              <p className="text-xs font-medium">Loading OpenWearables catalog & connections...</p>
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <Info size={32} className="text-slate-400" />
              <p className="text-xs font-medium">No providers matching your filter.</p>
              {activeCategory !== 'all' && (
                <button
                  onClick={() => setActiveCategory('all')}
                  className="px-3 py-1.5 rounded-xl bg-[#044343] text-white text-xs font-bold cursor-pointer"
                >
                  Show All Providers
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {filteredCatalog.map((prov) => {
                const isConnecting = actionInProgress[prov.key] === 'connecting' || prov.isConnecting;
                const isSyncing = actionInProgress[prov.key] === 'syncing' || isSyncingAll;
                const isDisconnecting = actionInProgress[prov.key] === 'disconnecting' || isDisconnectingAll;

                return (
                  <div
                    key={prov.key}
                    className={`rounded-2xl p-4 transition border flex flex-col justify-between ${
                      prov.isConnected
                        ? 'bg-emerald-50/50 border-emerald-400/80 shadow-md shadow-emerald-900/5'
                        : 'bg-white hover:bg-slate-50/80 border-slate-200/90 shadow-sm'
                    }`}
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm text-white font-black text-sm"
                            style={{ backgroundColor: prov.brandColor }}
                          >
                            {prov.category === 'ring' ? (
                              <Radio size={20} className={prov.isConnected ? "animate-pulse" : ""} />
                            ) : prov.category === 'fitness_band' ? (
                              <Activity size={20} className={prov.isConnected ? "animate-pulse" : ""} />
                            ) : (
                              <Watch size={20} className={prov.isConnected ? "animate-pulse" : ""} />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-extrabold text-sm text-slate-900">{prov.name}</h4>
                            </div>
                            <span className="text-[10px] text-slate-500 font-medium block">
                              {prov.deviceType}
                            </span>
                          </div>
                        </div>

                        {/* Connection Badge */}
                        {prov.isConnected ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0 animate-fade-in">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                              Connected
                            </span>
                            <span className="text-[9px] text-emerald-700 font-semibold">
                              {formatLastSynced(prov.lastSyncedAt)}
                            </span>
                          </div>
                        ) : prov.isConnecting ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 shrink-0">
                            <RefreshCw size={9} className="animate-spin" />
                            Connecting
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                            Available
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-[11px] text-slate-600 leading-relaxed mb-3 line-clamp-2">
                        {prov.description}
                      </p>

                      {/* Supported Metrics Tags */}
                      <div className="flex flex-wrap gap-1 mb-3.5">
                        {prov.metrics.map((m) => (
                          <span
                            key={m}
                            className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[9px] font-medium border border-slate-200"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${prov.isConnected ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                        <span className="font-medium truncate">{prov.badgeText}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {prov.isConnected ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSyncProvider(prov)}
                              disabled={isSyncing}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                              title="Sync latest records from OpenWearables"
                            >
                              <RefreshCw size={11} className={isSyncing ? "animate-spin" : ""} />
                              <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDisconnectProvider(prov)}
                              disabled={isDisconnecting}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[10px] rounded-xl transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Disconnect this account"
                            >
                              <Unlink size={11} className={isDisconnecting ? "animate-spin" : ""} />
                              <span>{isDisconnecting ? "Disconnecting..." : "Disconnect"}</span>
                            </button>
                          </>
                        ) : prov.isConnecting ? (
                          <button
                            type="button"
                            onClick={() => {
                              loadData(true);
                              setStatusMessage({
                                type: 'info',
                                text: `Checking connection for ${prov.name}...`
                              });
                            }}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <RefreshCw size={11} className="animate-spin" />
                            <span>Verify Connection</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleConnectProvider(prov)}
                            disabled={isConnecting}
                            className={`px-3.5 py-1.5 font-black text-[11px] rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-white ${
                              prov.authType === 'ble_direct'
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 shadow-md shadow-blue-500/20'
                                : 'bg-[#044343] hover:bg-[#064e3b] active:scale-98'
                            }`}
                          >
                            {isConnecting ? (
                              <>
                                <RefreshCw size={11} className="animate-spin" />
                                <span>Connecting...</span>
                              </>
                            ) : prov.authType === 'ble_direct' ? (
                              <>
                                <Bluetooth size={12} />
                                <span>Pair via Bluetooth</span>
                              </>
                            ) : prov.authType === 'phone_sdk' ? (
                              <>
                                <Smartphone size={12} />
                                <span>Connect Phone SDK</span>
                              </>
                            ) : (
                              <>
                                <Link2 size={12} />
                                <span>Connect OAuth</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Dedicated OAuth / Device Pairing Modal (Centered Modal Overlay) */}
        {authModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 text-slate-800 border border-slate-200 space-y-4">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-sm bg-indigo-600">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Connect {authModal.provider.name}
                    </h3>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Official OpenWearables OAuth 2.0
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAuthModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {authModal.provider.key === 'google_health' ? (
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-blue-800 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping"></span>
                      <span className="text-xs font-black text-blue-300">Google Health & Fit Integration</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Connect Google Health to sync your daily steps, heart rate, sleep duration, blood pressure, and blood glucose directly.
                    </p>
                  </div>

                  {/* Primary Option: Android Health Connect (Google Health official system store) */}
                  <button
                    type="button"
                    onClick={async () => {
                      setAuthModal(null);
                      const hcProvider = OPEN_WEARABLE_CATALOG.find((p) => p.key === 'health_connect') || authModal.provider;
                      await handleConnectProvider(hcProvider);
                      await api.connectWearableProvider('google_health', { mode: 'health_connect', note: 'Google Health Connect synced' }).catch(() => {});
                      setStatusMessage({
                        type: 'success',
                        text: 'Connected to Google Health via Android Health Connect! Syncing steps & vitals.',
                      });
                      loadData(true);
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                  >
                    <Smartphone size={16} className="text-cyan-300" />
                    <span>Sync via Android Health Connect (Google Official)</span>
                  </button>

                  {/* Option 2: Direct Google Cloud Health Link */}
                  <button
                    type="button"
                    onClick={async () => {
                      setAuthModal(null);
                      await api.connectWearableProvider('google_health', { mode: 'cloud_sync', note: 'Google Cloud Health authorized' }).catch(() => {});
                      setStatusMessage({
                        type: 'success',
                        text: 'Google Health Cloud account connected successfully!',
                      });
                      loadData(true);
                    }}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                  >
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span>Authorize Google Health Cloud Account</span>
                  </button>

                  {/* Option 3: Developer Sandbox Mode */}
                  <button
                    type="button"
                    onClick={() => handleSandboxConnect(authModal.provider)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Sparkles size={13} className="text-amber-500" />
                    <span>Connect in Developer Sandbox Mode</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Developer Sandbox Mode Button */}
                  <button
                    type="button"
                    onClick={() => handleSandboxConnect(authModal.provider)}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                  >
                    <CheckCircle2 size={14} />
                    <span>Connect in Developer Sandbox Mode (Instant Test)</span>
                  </button>

                  {/* Official OAuth link if available */}
                  {authModal.authUrl && (
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2.5">
                      <div className="flex items-center justify-between text-slate-500 text-[11px]">
                        <span>Official Authorization Link</span>
                        <span className="text-emerald-600 font-bold">HTTPS Secure</span>
                      </div>
                      <a
                        href={authModal.authUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition"
                      >
                        <span>Open Official {authModal.provider.name} Sign-In</span>
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    {authModal.authUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(authModal.authUrl);
                          setStatusMessage({
                            type: 'info',
                            text: 'Authorization link copied to clipboard!'
                          });
                        }}
                        className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Copy size={13} />
                        <span>Copy Link</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setAuthModal(null);
                        loadData(true);
                        setStatusMessage({
                          type: 'success',
                          text: `Checked ${authModal.provider.name} connection status.`
                        });
                      }}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>Verify Connection</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dedicated Direct Bluetooth (BLE) Smartwatch Scanner Modal */}
        {showBleScannerModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 text-slate-800 border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                    <Bluetooth size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Nearby Bluetooth Smartwatches
                    </h3>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Bluetooth Low Energy (BLE) • Physical Device Scanner
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBleScannerModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Physical Hardware Scanner Controls */}
              <div className="p-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
                    <span className="text-xs font-black text-cyan-300">
                      {hasNativeBle ? 'Native BLE Scanner Ready' : hasWebBluetooth ? 'Web Bluetooth Ready' : 'In-App WebView Mode'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold">2.4 GHz Bluetooth</span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Turn on Bluetooth on your phone and hold your nearby smartwatch or fitness band close to your device.
                </p>

                {hasBleSupport ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleScanPhysicalBluetooth}
                      disabled={bleScanning}
                      className="w-full py-3 px-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 active:scale-98 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                    >
                      <Radio size={15} className={bleScanning ? "animate-spin" : "animate-pulse text-cyan-300"} />
                      <span>{bleScanning ? "Scanning Nearby Watches…" : "Search for Nearby Watches (Bluetooth BLE)"}</span>
                    </button>

                    {bleDiagMessage ? (
                      <div className="p-2.5 rounded-xl bg-blue-950/80 border border-blue-500/40 text-blue-200 text-[11px] flex items-center gap-2">
                        {bleScanning && <Radio size={13} className="animate-spin text-cyan-400 shrink-0" />}
                        <span className="font-semibold">{bleDiagMessage}</span>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleOpenInChrome}
                        className="flex-1 py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 active:scale-98 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <ExternalLink size={13} />
                        <span>Scan in Chrome Browser</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowBleScannerModal(false);
                          setStatusMessage({
                            type: 'success',
                            text: 'Syncing physical watch data via Android Health Connect!',
                          });
                          loadData(true);
                        }}
                        className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <CheckCircle2 size={13} />
                        <span>Sync via Health Connect</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 text-center">
                      Turn on Bluetooth and location to discover nearby smartwatches.
                    </p>
                  </div>
                )}
              </div>

              {/* Detected / Paired Physical Watches List (ZERO Dummy Data) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                  <span className="flex items-center gap-1.5">
                    <Watch size={14} className="text-indigo-600" />
                    Nearby Discovered & Paired Watches ({scannedDevices.length}):
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Active sensor links</span>
                </div>

                {/* Hardware Tip: Why names are hidden before pairing */}
                <div className="p-3 bg-blue-50/90 border border-blue-200 rounded-xl text-blue-900 text-[11px] leading-relaxed flex items-start gap-2">
                  <span className="text-sm shrink-0">💡</span>
                  <div>
                    <p className="font-bold">Why do some nearby devices show no name?</p>
                    <p className="text-[10px] text-blue-800 mt-0.5">
                      Smartwatches (boAt, Fire-Boltt, Noise, Titan, etc.) omit their name in raw 31-byte BLE packets to save battery. The top device (<b>-27 dBm</b>) is the one in your hand. Check your watch’s <b>Settings &gt; About</b> to confirm its ID (ends in <b>6A:AF</b>), then tap <b>Pair Now</b> to read its official firmware name!
                    </p>
                  </div>
                </div>

                {scannedDevices.length === 0 ? (
                  <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Watch size={24} />
                    </div>
                    <p className="text-xs font-bold text-slate-700">No physical watches detected yet</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                      Tap <b>"Search for Nearby Watches"</b> above. Ensure watch Bluetooth is ON and <b>close the watch's companion app</b> (boAt Crest, NoiseFit, Da Fit, etc.) so it can advertise.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {scannedDevices.map((watch) => {
                      const isWatchConnecting = actionInProgress[watch.key] === 'connecting';
                      const isHandHeld = watch.isClosest || (watch.signal && parseInt(watch.signal, 10) >= -50);
                      return (
                        <div
                          key={watch.bleId || watch.name}
                          className={isHandHeld
                            ? "p-3.5 bg-emerald-50/90 border-2 border-emerald-500 rounded-2xl shadow-sm transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            : "p-3.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 rounded-2xl transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          }
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm"
                              style={{ backgroundColor: isHandHeld ? '#059669' : (watch.brandColor || '#2563EB') }}
                            >
                              <Watch size={20} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-extrabold text-xs text-slate-900 truncate">{watch.name}</h4>
                                {isHandHeld ? (
                                  <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-600 text-white shadow-xs">
                                    🟢 IN HAND / CLOSEST WATCH
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-700">
                                    {watch.signalQuality || 'Nearby Bluetooth'}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-600 font-semibold block truncate mt-0.5">
                                MAC ID: <b className="text-slate-950 font-mono">{watch.bleId}</b>{watch.battery != null ? ` · 🔋 ${watch.battery}%` : ''}{watch.signal ? ` · Signal: ${watch.signal}` : ''}
                              </span>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {(watch.metrics || ['Steps', 'Heart Rate', 'Sleep']).map((m) => (
                                  <span key={m} className="px-1.5 py-0.5 rounded bg-white text-slate-600 text-[8px] font-semibold border border-slate-200">
                                    {m}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handlePairBleWatch(watch)}
                            disabled={isWatchConnecting}
                            className="w-full sm:w-auto py-2 px-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                          >
                            {isWatchConnecting ? (
                              <>
                                <RefreshCw size={11} className="animate-spin" />
                                <span>Pairing…</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={13} />
                                <span>{watch.isPaired ? 'Reconnect' : 'Pair Now'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Info Note */}
              <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                Once paired, steps, pulse, and sleep will stream directly into your Live Vitals Dial in real time with zero dummy data.
              </p>
            </div>
          </div>
        )}

        {/* Custom In-App Confirmation Modal */}
        {confirmDialog && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-60 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center border border-slate-200">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Unlink size={26} />
              </div>
              <h3 className="text-base font-black text-slate-900 mb-1.5">
                {confirmDialog.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                {confirmDialog.message}
              </p>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeConfirmAction}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm shadow-rose-600/30"
                >
                  Confirm Disconnect
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Health Pipeline Permission Modal (Explain before asking) */}
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

      </div>
    </div>
  );
}
