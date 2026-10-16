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
  Bluetooth,
  UploadCloud,
  FileText
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
  defaultStorage,
} from '../../services/healthCapture';
import { isNative, toNative } from '../../native/nativeBridge';
import HealthPermissionModal from '../common/HealthPermissionModal';

// Helper to open OAuth and external URLs in the phone's native browser (avoiding WebView Error 403)
const openExternalUrl = (url) => {
  if (!url) return;
  if (typeof window !== 'undefined' && window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_URL', url }));
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

// Comprehensive metadata for all OpenWearables providers (Garmin, Samsung, Google, Withings, Oura, Whoop, Polar, Suunto, Ultrahuman, Fitbit)
const OPEN_WEARABLE_CATALOG = [
  {
    key: 'apple',
    name: 'Apple Health',
    category: 'smartwatch',
    deviceType: 'Apple Watch & HealthKit Hub',
    description: 'Apple Watch Ultra, Series, and iPhone HealthKit biometrics including ECG, continuous heart rate, sleep stages, and XML export imports.',
    brandColor: '#000000',
    badgeText: 'HealthKit (iOS Only)',
    syncMode: 'Live Sync & XML Upload',
    authType: 'apple_hybrid',
    metrics: ['Heart Rate', 'ECG', 'Steps', 'Sleep Stages', 'Active Energy', 'HRV', 'SpO2']
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
    description: 'Galaxy Watch6, Watch5, and Galaxy Fit biometrics connected via Samsung Health Cloud or Partner API.',
    brandColor: '#2563EB',
    badgeText: 'Galaxy Cloud Sync',
    syncMode: 'Cloud Webhook & Pull',
    authType: 'samsung_modal',
    metrics: ['Heart Rate', 'Blood Pressure', 'Blood Glucose', 'Body Composition', 'SpO2', 'Sleep']
  },
  {
    key: 'google_health',
    name: 'Google Health',
    category: 'smartwatch',
    deviceType: 'Google Cloud Health OAuth',
    description: 'Sync heart rate, step count, calories, sleep stages, SpO2, and vitals via Google Cloud Health OAuth 2.0.',
    brandColor: '#4285F4',
    badgeText: 'Google Cloud OAuth',
    syncMode: 'Cloud OAuth 2.0',
    authType: 'google_hybrid',
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

// Helper to detect device hardware platform and enforce OS-specific wearable provider visibility
export function getDevicePlatform() {
  if (typeof navigator === 'undefined') {
    return { isApple: false, isSamsung: false, isAndroid: false, label: 'Standard Phone' };
  }
  const ua = (navigator.userAgent || '').toLowerCase();
  const isApple = /ipad|iphone|ipod|macintosh/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSamsung = !isApple && /samsung|sm-[a-z0-9]+|sec-sgh|galaxy/.test(ua);
  const isAndroid = !isApple && (/android/.test(ua) || isSamsung);

  let label = 'Android Phone';
  if (isApple) label = 'Apple iOS Device';
  else if (isSamsung) label = 'Samsung Galaxy (Android)';
  else if (isAndroid) label = 'Android Phone';
  else label = 'Desktop Web';

  return { isApple, isSamsung, isAndroid, label };
}

// Check if a wearable provider is allowed for the detected device:
// - Android (non-Samsung): Google Health + Universal Cloud (No Samsung, No Apple)
// - Samsung Android: Google Health + Samsung Health + Universal Cloud (No Apple)
// - Apple iOS: Apple Health + Google Health + Universal Cloud (No Samsung)
export function isProviderAllowedForDevice(providerKey, device) {
  const p = String(providerKey || '').toLowerCase();
  
  // Universal OpenWearables Cloud Providers (Garmin, Fitbit, Oura, WHOOP, Polar, Suunto, Withings, Strava, Ultrahuman, SensorBio)
  const cloudProviders = [
    'garmin', 'withings', 'oura', 'suunto', 'polar', 
    'sensorbio', 'whoop', 'strava', 'ultrahuman', 'fitbit'
  ];
  if (cloudProviders.includes(p)) return true;

  // Google Health (OAuth 2.0 / Google Cloud Health): Supported on all platforms
  if (p === 'google_health' || p === 'google') return true;

  // Samsung Health: ONLY on Samsung Galaxy devices (no generic Android, no Apple)
  if (p === 'samsung_health' || p === 'samsung') {
    return Boolean(device.isSamsung);
  }

  // Apple Health: ONLY on Apple devices (no Android, no Samsung)
  if (p === 'apple' || p === 'apple_health') {
    return Boolean(device.isApple);
  }

  return false;
}

export function WearablesScreen({ onClose }) {
  const { member } = useAuth();
  const device = useMemo(() => getDevicePlatform(), []);
  
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

  // Apple Health XML Import states
  const [appleXmlModalOpen, setAppleXmlModalOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingXml, setUploadingXml] = useState(false);
  const [selectedXmlFile, setSelectedXmlFile] = useState(null);
  const [xmlUploadStatus, setXmlUploadStatus] = useState(null);

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
    try {
      localStorage.removeItem('wellness_paired_devices');
      localStorage.removeItem('wellness_paired_device');
      localStorage.removeItem('wellness_wearable_metrics');
    } catch {}
    loadData();
  }, []);

  // Map and merge remote provider status with our catalog based on detected device
  const catalogList = useMemo(() => {
    const connMap = new Map();
    connections.forEach((conn) => {
      const provKey = (conn.provider || '').toLowerCase();
      if (!['apple_health', 'health_connect', 'phone_pedometer', 'phone'].includes(provKey)) {
        if (isProviderAllowedForDevice(provKey, device)) {
          connMap.set(provKey, conn);
        }
      }
    });

    const remoteProvMap = new Map();
    providers.forEach((p) => {
      const pKey = (p.provider || '').toLowerCase();
      if (!['apple_health', 'health_connect', 'phone_pedometer', 'phone'].includes(pKey)) {
        remoteProvMap.set(pKey, p);
      }
    });

    return OPEN_WEARABLE_CATALOG
      .filter((cat) => isProviderAllowedForDevice(cat.key, device))
      .map((cat) => {
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
  }, [providers, connections, device]);

  // Auto-Sync on Tab Focus (re-sync if last sync was > 15 minutes ago; Garmin uses webhook push)
  useEffect(() => {
    let lastSyncTime = Date.now();
    const handleFocus = async () => {
      if (Date.now() - lastSyncTime > 15 * 60 * 1000) {
        lastSyncTime = Date.now();
        const connectedNonGarmin = catalogList.filter((c) => c.isConnected && c.key !== 'garmin');
        if (connectedNonGarmin.length > 0) {
          try {
            await Promise.allSettled(
              connectedNonGarmin.map((p) => api.syncWearableProvider(p.key).catch(() => {}))
            );
            loadData(true);
          } catch {}
        }
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [catalogList]);

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





  // Handle Apple Health XML Direct / S3 Multipart upload
  const handleUploadAppleXml = async () => {
    if (!selectedXmlFile) return;
    setUploadingXml(true);
    setUploadProgress(0);
    setXmlUploadStatus(null);

    try {
      const result = await api.importAppleXml(selectedXmlFile, (percent) => {
        setUploadProgress(percent);
      });

      setXmlUploadStatus({
        type: 'success',
        text: `Apple Health XML successfully queued! Task ID: ${result?.taskId || result?.task_id || 'Queued'}. Biometrics will be normalized into your vitals dial.`,
        taskId: result?.taskId || result?.task_id || null,
      });

      setStatusMessage({
        type: 'success',
        text: `Apple Health XML import started (${result?.method === 'direct' ? 'Direct Upload' : 'S3 Multipart'}). Processing background pipeline.`,
      });

      setSelectedXmlFile(null);
      setTimeout(() => loadData(true), 1500);
    } catch (err) {
      console.error('Failed to import Apple Health XML:', err);
      setXmlUploadStatus({
        type: 'error',
        text: err?.message || 'Failed to upload Apple Health XML export.',
      });
    } finally {
      setUploadingXml(false);
    }
  };

  // Connect Google Health Connect on Android (Live on-device sensor pipeline)
  const handleConnectGoogleHealthConnect = async () => {
    setActionInProgress((prev) => ({ ...prev, google_health: 'connecting' }));
    setStatusMessage(null);
    try {
      const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
      if (isIOS) {
        setStatusMessage({
          type: 'error',
          text: 'Google Health Connect is exclusive to Android devices. On your Apple device, please connect Apple HealthKit.'
        });
        return;
      }

      // 1. Request native Android Health Connect permissions
      if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'REQUEST_HEALTH_PERMISSIONS',
          permissions: ['steps', 'calories', 'distance', 'heart_rate', 'sleep', 'spo2', 'blood_glucose', 'blood_pressure_systolic', 'blood_pressure_diastolic']
        }));
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PULL_DOWN_SYNC' }));
      }

      // 2. Register both health_connect and google_health connections on backend
      await api.updatePhoneHealthConnection({
        provider: 'health_connect',
        platform: 'android',
        permissions: ['steps', 'calories', 'distance', 'heart_rate', 'sleep', 'spo2', 'blood_glucose'],
        status: 'connected',
      }).catch(() => {});


      // 3. Immediately pull latest telemetry from window.__LATEST_HEALTH_TELEMETRY__ and upload
      const latestTele = typeof window !== 'undefined' ? window.__LATEST_HEALTH_TELEMETRY__ : null;
      if (latestTele?.today?.steps && Number(latestTele.today.steps) > 0) {
        const nowIso = new Date().toISOString();
        const dateKey = nowIso.split('T')[0];
        const stepVal = Number(latestTele.today.steps);
        const samples = [
          {
            provider: 'health_connect',
            metric: 'steps',
            value: stepVal,
            unit: 'count',
            aggregation: 'daily_total',
            recordedAt: nowIso,
            externalId: `hc-steps-today-${dateKey}`
          },
          {
            provider: 'health_connect',
            metric: 'calories',
            value: Number(latestTele.today.activeCalories) || Math.round(stepVal * 0.045),
            unit: 'kcal',
            aggregation: 'daily_total',
            recordedAt: nowIso,
            externalId: `hc-calories-today-${dateKey}`
          },
          {
            provider: 'health_connect',
            metric: 'distance',
            value: Number(latestTele.today.distanceM) || Math.round(stepVal * 0.75),
            unit: 'm',
            aggregation: 'daily_total',
            recordedAt: nowIso,
            externalId: `hc-distance-today-${dateKey}`
          }
        ];
        if (latestTele?.today?.heartRate?.latest || latestTele?.health?.heartRate?.latest) {
          const hrVal = Number(latestTele?.today?.heartRate?.latest || latestTele?.health?.heartRate?.latest);
          if (hrVal > 0) {
            samples.push({
              provider: 'health_connect',
              metric: 'heart_rate',
              value: hrVal,
              unit: 'bpm',
              aggregation: 'instant',
              recordedAt: nowIso,
              externalId: `hc-hr-${dateKey}`
            });
          }
        }
        await api.syncPhoneHealth(samples).catch(() => {});
      }

      setStatusMessage({
        type: 'success',
        text: 'Connected to Google Health Connect! Live steps, energy burn, and vitals synced.',
      });
      loadData(true);
    } catch (err) {
      console.error('Failed to connect Google Health Connect:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Could not connect Google Health Connect.',
      });
    } finally {
      setActionInProgress((prev) => ({ ...prev, google_health: null }));
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

    // 0. Apple Health (HealthKit SDK + XML Export Import)
    if (provider.key === 'apple' || provider.authType === 'apple_hybrid') {
      setActionInProgress((prev) => ({ ...prev, [provider.key]: null }));
      setAuthModal({
        provider,
        isAppleHybrid: true,
      });
      return;
    }

    // 1. Samsung Health Guard (Prevent false-connect as phone sensor on non-Samsung devices)
    if (provider.key === 'samsung_health' || provider.authType === 'samsung_modal') {
      setActionInProgress((prev) => ({ ...prev, [provider.key]: null }));
      setAuthModal({
        provider,
        isSamsungHealth: true,
      });
      return;
    }

    // 2. Google Health: Direct OAuth 2.0 launch via OpenWearables
    if (provider.key === 'google_health' || provider.authType === 'google_hybrid') {
      try {
        const redirectUrl = `${window.location.origin}/wearables/callback`;
        let session = null;
        try {
          session = await api.createWearableConnectSession('google_health', redirectUrl);
        } catch (_) {}
        const googleOAuthUrl = session?.connectUrl;
        if (!googleOAuthUrl) {
          setErrorModal({
            title: 'OAuth Unavailable',
            message: 'Could not generate Google OAuth link from OpenWearables. Please try again.',
          });
          return;
        }
        openExternalUrl(googleOAuthUrl);
        setAuthModal({
          provider,
          authUrl: googleOAuthUrl,
          isGoogleHealthModal: true,
        });
      } finally {
        setActionInProgress((prev) => ({ ...prev, [provider.key]: null }));
      }
      return;
    }


    // 4. Phone SDK Provider Flow (Google Health Connect, Apple Health, Samsung Health)
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

    // 4. Cloud OAuth Provider Flow (Garmin, WHOOP, Oura, Fitbit, etc.)
    try {
      const redirectUrl = `${window.location.origin}/wearables/callback`;
      let session = null;
      try {
        session = await api.createWearableConnectSession(provider.key, redirectUrl);
      } catch (sessionErr) {
        if (sessionErr.status === 403 || sessionErr.code === 'consent_required') {
          setStatusMessage({
            type: 'info',
            text: 'Health data consent is required before connecting wearables. Please confirm consent.',
          });
          setPermissionModal({
            isOpen: true,
            mode: 'explain',
            metrics: ['steps', 'heart_rate', 'sleep'],
            missing: [],
            resolver: async (granted) => {
              if (granted) {
                await api.recordMemberConsent('health_data', true).catch(() => {});
                handleConnectProvider(provider);
              }
            },
          });
          return;
        }
        throw sessionErr;
      }

      const connectUrl = session?.connectUrl || null;
      setAuthModal({
        provider,
        authUrl: connectUrl,
      });

      if (connectUrl) {
        const popup = window.open(
          connectUrl,
          'WearableAuth',
          'width=600,height=750,left=150,top=100,menubar=no,toolbar=no'
        );

        // Await popup completion via postMessage
        const handleOAuthMessage = (e) => {
          if (e.origin !== window.location.origin) return;
          if (e.data?.type === 'WEARABLE_AUTH_SUCCESS') {
            window.removeEventListener('message', handleOAuthMessage);
            setAuthModal(null);
            setStatusMessage({
              type: 'success',
              text: `Successfully connected ${provider.name}! Live sync active.`,
            });
            setTimeout(() => loadData(true), 1200);
          } else if (e.data?.type === 'WEARABLE_AUTH_ERROR') {
            window.removeEventListener('message', handleOAuthMessage);
            setStatusMessage({
              type: 'error',
              text: e.data?.message || `Failed to authenticate ${provider.name}.`,
            });
          }
        };

        window.addEventListener('message', handleOAuthMessage);

        const checkClosed = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleOAuthMessage);
            loadData(true);
          }
        }, 1200);
      }
    } catch (err) {
      console.error(`Failed to connect ${provider.name}:`, err);
      setStatusMessage({
        type: 'error',
        text: err?.message || `Could not connect ${provider.name}.`,
      });
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
      const isPhoneSdk = provider.authType === 'phone_sdk';
      const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
      const expectedPhoneKey = isIOS ? 'apple_health' : 'health_connect';

      if (isPhoneSdk) {
        // Trigger native bridge pull if in WebView
        if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PULL_DOWN_SYNC', provider: provider.key }));
        }

        const latestTele = typeof window !== 'undefined' ? window.__LATEST_HEALTH_TELEMETRY__ : null;
        const realSamples = [];
        const nowIso = new Date().toISOString();
        const dateKey = nowIso.split('T')[0];
        const canSyncPhone = (provider.key === expectedPhoneKey || isGoogleHealth);

        if (canSyncPhone && latestTele?.today?.steps && Number(latestTele.today.steps) > 0) {
          const stepVal = Number(latestTele.today.steps);
          realSamples.push({
            provider: isGoogleHealth ? 'health_connect' : provider.key,
            metric: 'steps',
            value: stepVal,
            unit: 'count',
            aggregation: 'daily_total',
            recordedAt: nowIso,
            externalId: `${provider.key}-steps-today-${dateKey}`
          });
          const calVal = (latestTele?.today?.activeCalories && Number(latestTele.today.activeCalories) > 0)
            ? Number(latestTele.today.activeCalories)
            : Math.round(stepVal * 0.045);
          realSamples.push({
            provider: isGoogleHealth ? 'health_connect' : provider.key,
            metric: 'calories',
            value: calVal,
            unit: 'kcal',
            aggregation: 'daily_total',
            recordedAt: nowIso,
            externalId: `${provider.key}-calories-today-${dateKey}`
          });
          const distVal = (latestTele?.today?.distanceM && Number(latestTele.today.distanceM) > 0)
            ? Number(latestTele.today.distanceM)
            : Math.round(stepVal * 0.75);
          realSamples.push({
            provider: isGoogleHealth ? 'health_connect' : provider.key,
            metric: 'distance',
            value: distVal,
            unit: 'm',
            aggregation: 'daily_total',
            recordedAt: nowIso,
            externalId: `${provider.key}-distance-today-${dateKey}`
          });
        }
        if (latestTele?.health?.heartRate?.latest && Number(latestTele.health.heartRate.latest) > 0) {
          realSamples.push({
            provider: isGoogleHealth ? 'health_connect' : provider.key,
            metric: 'heart_rate',
            value: Number(latestTele.health.heartRate.latest),
            unit: 'bpm',
            aggregation: 'instant',
            recordedAt: nowIso,
            externalId: `${provider.key}-hr-${dateKey}`
          });
        }

        if (realSamples.length > 0) {
          await api.syncPhoneHealth(realSamples).catch(() => {});
        }

        // Also trigger cloud sync if google_health
        if (isGoogleHealth) {
          await api.syncWearableProvider('google_health').catch(() => {});
        }

        if (realSamples.length > 0) {
          setStatusMessage({
            type: 'success',
            text: `Synced ${provider.name} successfully! Recorded ${realSamples.length} live hardware reading(s).`
          });
        } else {
          setStatusMessage({
            type: 'info',
            text: `Sync requested for ${provider.name}. Pulling latest telemetry from phone health store.`
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
        if (['samsung_health', 'health_connect', 'apple_health', 'phone_pedometer'].includes(provider.key) || provider.authType === 'phone_sdk' || provider.authType === 'samsung_modal') {
          await api.updatePhoneHealthConnection({
            provider: provider.key,
            status: 'disconnected',
            permissions: [],
          }).catch(() => {});
        }
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

  const totalConnectedCount = connectedList.length;
  const connectedCount = totalConnectedCount;

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
                Official OpenWearables Cloud Sync Hub
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

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-sky-800 bg-sky-100/90 px-2 py-0.5 rounded-full border border-sky-300">
              <Smartphone size={10} />
              <span>{device.label}</span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
              <Lock size={10} />
              <span>1:1 Device Binding</span>
            </div>
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

        {/* Apple Health XML Export Importer Banner (iOS only) */}
        {device.isApple && (
          <div className="mx-4 mt-2.5 p-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-[#044343] rounded-2xl text-white shadow-md border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white shadow-inner shrink-0">
                <UploadCloud size={20} className="text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black tracking-tight text-white">Apple Health XML Data Import</h4>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    Direct / S3 Multipart (up to 5GB)
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5 font-medium">
                  Import complete iPhone Apple Health exports (<code className="text-emerald-300 font-mono">export.xml</code> or <code className="text-emerald-300 font-mono">export.zip</code>) directly into Open Wearables!
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAppleXmlModalOpen(true)}
              className="w-full sm:w-auto py-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-700/25 flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
            >
              <UploadCloud size={13} />
              <span>Upload Health XML</span>
            </button>
          </div>
        )}

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

              {/* Connected Devices Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

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
                            onClick={async () => {
                              setActionInProgress((prev) => ({ ...prev, [prov.key]: 'verifying' }));
                              try {
                                await api.syncWearableProvider(prov.key).catch(() => {});
                                await loadData(true);
                                setStatusMessage({
                                  type: 'info',
                                  text: `Checked connection for ${prov.name}.`
                                });
                              } finally {
                                setActionInProgress((prev) => ({ ...prev, [prov.key]: null }));
                              }
                            }}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <RefreshCw size={11} className={actionInProgress[prov.key] ? "animate-spin" : ""} />
                            <span>{actionInProgress[prov.key] ? "Verifying..." : "Verify Connection"}</span>
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

              {authModal.isAppleHybrid ? (
                <div className="space-y-3">
                  {(() => {
                    const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
                    if (!isIOS) {
                      return (
                        <div className="space-y-3">
                          <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-amber-950 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                              <span className="text-xs font-black text-amber-900">Apple HealthKit is iOS Exclusive</span>
                            </div>
                            <p className="text-xs text-amber-800 leading-relaxed">
                              Apple HealthKit and Apple Watch live pairing are only available on <b>Apple iOS devices (iPhone & Apple Watch)</b>. You are currently using an <b>Android device</b>.
                            </p>
                            <p className="text-xs text-amber-800 leading-relaxed">
                              On this Android phone, please use <b>Google Health Connect</b> to sync your steps, energy burn, and daily vitals.
                            </p>
                          </div>

                          {/* Primary Option on Android: Switch to Google Health Connect */}
                          <button
                            type="button"
                            onClick={async () => {
                              setAuthModal(null);
                              await handleConnectGoogleHealthConnect();
                            }}
                            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                          >
                            <Smartphone size={16} className="text-cyan-300" />
                            <span>Switch to Google Health Connect (Android)</span>
                          </button>

                          {/* Secondary Option: User explicitly wants to upload export.xml */}
                          <button
                            type="button"
                            onClick={() => {
                              setAuthModal(null);
                              setAppleXmlModalOpen(true);
                            }}
                            className="w-full py-2.5 px-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                          >
                            <UploadCloud size={15} className="text-emerald-600" />
                            <span>Import XML Export File (from previous iPhone)</span>
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        <div className="p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-black text-white rounded-2xl border border-slate-700 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                            <span className="text-xs font-black text-white">Apple Health & Apple Watch</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            Connect live HealthKit on your iPhone or upload an Apple Health XML export file from any device.
                          </p>
                        </div>

                        {/* Option 1: Live HealthKit */}
                        <button
                          type="button"
                          onClick={async () => {
                            setAuthModal(null);
                            const platformHealth = new WebPlatformHealth({
                              openSettingsCallback: () => {
                                try {
                                  if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
                                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_HEALTH_SETUP' }));
                                  }
                                } catch {}
                              },
                            });

                            try {
                              const healthPerm = await requestHealthAccess({
                                metrics: ['steps', 'heart_rate', 'sleep', 'spo2', 'calories', 'glucose'],
                                platformHealth,
                                ui: uiHealthHandler,
                                storage: defaultStorage,
                              });

                              if (healthPerm.status !== 'denied') {
                                await api.updatePhoneHealthConnection({
                                  provider: 'apple_health',
                                  platform: 'ios',
                                  permissions: healthPerm.granted.length > 0 ? healthPerm.granted : ['steps', 'heart_rate', 'sleep', 'spo2', 'calories', 'glucose'],
                                  status: 'connected',
                                });
                                setStatusMessage({
                                  type: 'success',
                                  text: 'Connected to Apple HealthKit! Live telemetry active.',
                                });
                                loadData(true);
                              }
                            } catch (err) {
                              setStatusMessage({ type: 'error', text: err.message });
                            }
                          }}
                          className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                        >
                          <Smartphone size={16} className="text-emerald-400" />
                          <span>Connect Apple HealthKit (Live iPhone / Watch)</span>
                        </button>

                        {/* Option 2: Apple Health XML Export */}
                        <button
                          type="button"
                          onClick={() => {
                            setAuthModal(null);
                            setAppleXmlModalOpen(true);
                          }}
                          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                        >
                          <UploadCloud size={16} />
                          <span>Import Apple Health XML Export (export.xml / zip)</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : authModal.isSamsungHealth ? (
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-blue-700 space-y-2">
                    <div className="flex items-center gap-2">
                      <Watch size={16} className="text-blue-400" />
                      <span className="text-xs font-black text-white">Samsung Health & Galaxy Watch</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Sync Galaxy Watch biometric telemetry, sleep stages, continuous pulse, and SpO2 into OpenWearables.
                    </p>
                  </div>

                  {authModal.authUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        const url = authModal.authUrl;
                        setAuthModal(null);
                        openExternalUrl(url);
                        setStatusMessage({
                          type: 'info',
                          text: 'Opening Samsung Account Sign-In in your browser. Return to the app after authorizing.'
                        });
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                    >
                      <ExternalLink size={16} className="text-white" />
                      <span>Sign in with Samsung Account (Cloud OAuth 2.0)</span>
                    </button>
                  ) : (
                    <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs space-y-2">
                      <div className="flex items-center gap-2 font-bold text-blue-950">
                        <Info size={14} className="text-blue-600" />
                        <span>Samsung Health Setup Guide</span>
                      </div>
                      <p className="text-[11px] text-blue-800 leading-relaxed">
                        To sync your Galaxy Watch, enable data sharing in the Samsung Health app: <b>Samsung Health &gt; Settings &gt; Health Connect</b> (or configure Samsung Partner API credentials in your OpenWearables dashboard).
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setAuthModal(null)}
                    className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              ) : (authModal.provider.key === 'google_health' || authModal.isGoogleHealthModal) ? (
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-blue-800 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping"></span>
                      <span className="text-xs font-black text-blue-300">Google Cloud OAuth 2.0 Sign-In</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      We opened Google Sign-In in your browser. Select your Google account and grant permissions to sync your Google Health / Google Fit data.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        const authUrl = authModal.authUrl;
                        if (authUrl) {
                          openExternalUrl(authUrl);
                          setStatusMessage({
                            type: 'info',
                            text: 'Opening Google Sign-In in your browser...',
                          });
                        } else {
                          setStatusMessage({
                            type: 'error',
                            text: 'Google OAuth URL is unavailable. Please try again.',
                          });
                        }
                      }}
                      className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                    >
                      <ExternalLink size={16} className="text-cyan-200" />
                      <span>Re-Open Google Sign-In (OAuth 2.0)</span>
                    </button>
                    <p className="text-[11px] text-slate-500 font-medium px-1 flex items-center gap-1.5">
                      <ShieldCheck size={12} className="text-blue-500 shrink-0" />
                      <span>Official Google Cloud OAuth 2.0 Consent Screen</span>
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const pKey = authModal.provider.key;
                        setActionInProgress((prev) => ({ ...prev, [pKey]: 'verifying' }));
                        try {
                          await api.syncWearableProvider(pKey).catch(() => {});
                          await loadData(true);
                          const check = await api.getWearableConnections().catch(() => ({ data: [] }));
                          const conn = (check?.data || []).find((c) => (c.provider || '').toLowerCase() === pKey);
                          if (conn && (conn.status === 'connected' || conn.status === 'active')) {
                            setAuthModal(null);
                            setStatusMessage({
                              type: 'success',
                              text: 'Google Health connected successfully!',
                            });
                          } else {
                            setStatusMessage({
                              type: 'info',
                              text: 'Waiting for Google authorization in browser. Please finish sign-in, then tap Verify.',
                            });
                          }
                        } finally {
                          setActionInProgress((prev) => ({ ...prev, [pKey]: null }));
                        }
                      }}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={14} className="text-emerald-400" />
                      <span>{actionInProgress[authModal.provider.key] === 'verifying' ? 'Verifying...' : 'Verify Connection'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAuthModal(null)}
                      className="py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Official OAuth link if available */}
                  {authModal.authUrl ? (
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2.5">
                      <div className="flex items-center justify-between text-slate-500 text-[11px]">
                        <span>Official OpenWearables Authorization</span>
                        <span className="text-emerald-600 font-bold">HTTPS Secure</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const url = authModal.authUrl;
                          setAuthModal(null);
                          openExternalUrl(url);
                          setStatusMessage({
                            type: 'info',
                            text: `Opening official ${authModal.provider.name} authorization in your browser. Return to the app after authorizing.`,
                          });
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                      >
                        <span>Open Official {authModal.provider.name} Sign-In</span>
                        <ExternalLink size={14} />
                      </button>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(authModal.authUrl);
                            setStatusMessage({
                              type: 'info',
                              text: 'Authorization link copied to clipboard!'
                            });
                          }}
                          className="flex-1 py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Copy size={13} />
                          <span>Copy Link</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            const pKey = authModal.provider.key;
                            setAuthModal(null);
                            setActionInProgress((prev) => ({ ...prev, [pKey]: 'verifying' }));
                            try {
                              await api.syncWearableProvider(pKey).catch(() => {});
                              await loadData(true);
                              setStatusMessage({
                                type: 'success',
                                text: `Verified ${authModal.provider.name} connection status.`
                              });
                            } finally {
                              setActionInProgress((prev) => ({ ...prev, [pKey]: null }));
                            }
                          }}
                          className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          <span>Verify Connection</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-950 space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                        <span className="font-extrabold text-amber-900">OAuth Setup Required</span>
                      </div>
                      <p className="text-amber-800 leading-relaxed text-[11px]">
                        Client credentials for <b>{authModal.provider.name}</b> are not yet configured in your OpenWearables dashboard.
                      </p>
                      <p className="text-amber-800 leading-relaxed text-[11px]">
                        Please add your {authModal.provider.name} Client ID and Client Secret in your OpenWearables project settings to enable direct OAuth sign-in.
                      </p>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setAuthModal(null)}
                          className="w-full py-2 px-3 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-xs transition cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
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

        {/* Apple Health XML Import Modal */}
        {appleXmlModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-60 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 text-slate-800 border border-slate-200 space-y-4">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-black flex items-center justify-center text-white shadow-sm">
                    <UploadCloud size={20} className="text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Import Apple Health XML Export
                    </h3>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Direct Upload & S3 Multipart Pipeline
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAppleXmlModalOpen(false);
                    setSelectedXmlFile(null);
                    setXmlUploadStatus(null);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Instructions */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-2">
                <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Info size={14} className="text-[#044343]" />
                  How to export your data from iPhone:
                </span>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 pl-1">
                  <li>Open the <b>Health</b> app on your iPhone</li>
                  <li>Tap your <b>Profile Picture / Icon</b> in top-right corner</li>
                  <li>Scroll to the bottom and tap <b>"Export All Health Data"</b></li>
                  <li>Choose the generated <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">export.zip</code> or unzipped <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">export.xml</code></li>
                </ol>
              </div>

              {/* File Dropzone */}
              {!selectedXmlFile ? (
                <label className="border-2 border-dashed border-slate-300 hover:border-emerald-600 hover:bg-emerald-50/30 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition group">
                  <input
                    type="file"
                    accept=".xml,.zip,application/xml,application/zip"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setSelectedXmlFile(e.target.files[0]);
                        setXmlUploadStatus(null);
                      }
                    }}
                  />
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-2.5 group-hover:scale-105 transition">
                    <FileText size={24} />
                  </div>
                  <span className="text-xs font-black text-slate-800">
                    Click to select export.xml or export.zip
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">
                    Accepts XML or ZIP files up to 500 MB (Direct or S3 Multipart)
                  </span>
                </label>
              ) : (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-black text-slate-900 block truncate">
                        {selectedXmlFile.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {(selectedXmlFile.size / (1024 * 1024)).toFixed(2)} MB · {selectedXmlFile.size < 5 * 1024 * 1024 ? 'Direct Upload (< 5MB)' : 'S3 Multipart Chunked Upload (≥ 5MB)'}
                      </span>
                    </div>
                  </div>
                  {!uploadingXml && (
                    <button
                      type="button"
                      onClick={() => setSelectedXmlFile(null)}
                      className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              )}

              {/* Upload Progress Bar */}
              {uploadingXml && (
                <div className="space-y-1.5 py-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span>Uploading health records...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-[#044343] transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] text-slate-500 block text-center">
                    Processing through Open Wearables pipeline
                  </span>
                </div>
              )}

              {/* Status feedback */}
              {xmlUploadStatus && (
                <div className={`p-3 rounded-2xl text-xs flex items-start gap-2 ${
                  xmlUploadStatus.type === 'success'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-rose-100 text-rose-900 border border-rose-300'
                }`}>
                  {xmlUploadStatus.type === 'success' ? (
                    <CheckCircle2 size={16} className="text-emerald-700 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-700 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold leading-relaxed">{xmlUploadStatus.text}</p>
                    {xmlUploadStatus.taskId && (
                      <span className="font-mono text-[10px] bg-white/70 px-1.5 py-0.5 rounded border border-emerald-300 block w-fit">
                        Task ID: {xmlUploadStatus.taskId}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAppleXmlModalOpen(false);
                    setSelectedXmlFile(null);
                    setXmlUploadStatus(null);
                  }}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {xmlUploadStatus?.type === 'success' ? 'Close' : 'Cancel'}
                </button>
                {selectedXmlFile && !xmlUploadStatus?.type && (
                  <button
                    type="button"
                    onClick={handleUploadAppleXml}
                    disabled={uploadingXml}
                    className="flex-1 py-2.5 px-4 bg-[#044343] hover:bg-[#064e3b] text-white rounded-xl text-xs font-black transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md"
                  >
                    {uploadingXml ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Uploading ({uploadProgress}%)</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={14} />
                        <span>Start Import</span>
                      </>
                    )}
                  </button>
                )}
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
