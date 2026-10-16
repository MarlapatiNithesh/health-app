import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  NativeModules,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Battery from 'expo-battery';
import * as SecureStore from 'expo-secure-store';
import {
  SOURCE,
  buildSamples,
  nativeHealthState,
  observeHealthUpdates,
  readStepHistory,
  readToday,
  requestHealthPermissions,
  startLiveSteps,
} from './health/healthService';
import { uploadHealth } from './health/uploader';
import * as ble from './health/bleService';

// ─── Config ──────────────────────────────────────────────────────────────────
// Resolve the Metro development host IP dynamically so physical devices and emulators
// connect directly to the dev server without falling back or throwing ERR_CONNECTION_REFUSED.
const CURRENT_LAN_IP = '192.168.1.36';

const sanitizeDevUrl = (url) => {
  if (!url) return null;
  return url
    .replace('10.234.64.242', CURRENT_LAN_IP)
    .replace('10.234.64.112', CURRENT_LAN_IP)
    .replace('192.168.1.41', CURRENT_LAN_IP)
    .replace('192.168.1.38', CURRENT_LAN_IP);
};

const getDevServerHost = () => {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (!scriptURL) return null;
    const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
    const host = match ? match[1] : null;
    return host && host !== 'localhost' && host !== '127.0.0.1' ? host : null;
  } catch {
    return null;
  }
};

const isAndroid = Platform.OS === 'android';

const ALL_HEALTH_METRICS = [
  'steps',
  'distance',
  'calories',
  'heart_rate',
  'hrv',
  'spo2',
  'blood_pressure_systolic',
  'blood_pressure_diastolic',
  'blood_glucose',
  'respiratory_rate',
  'weight',
  'sleep',
];

const buildCandidates = () => {
  const devHost = getDevServerHost();
  const envWebUrl = sanitizeDevUrl(process.env.EXPO_PUBLIC_WEB_URL);
  const envApiUrl = sanitizeDevUrl(process.env.EXPO_PUBLIC_API_URL);
  const envApiWebUrl = envApiUrl ? `${envApiUrl.replace(/\/+$/, '')}/app/` : null;

  const list = [
    // 1. Dynamic Metro dev host if detected from scriptURL
    devHost ? `http://${devHost}:4000/app/` : null,
    // 2. USB cable with adb reverse tcp:4000 tcp:4000
    isAndroid ? 'http://127.0.0.1:4000/app/' : null,
    // 3. Active Wi-Fi LAN IP
    `http://${CURRENT_LAN_IP}:4000/app/`,
    // 4. Environment URLs (sanitized)
    envWebUrl,
    envApiWebUrl,
  ];

  if (isAndroid) {
    list.push('http://10.0.2.2:4000/app/');
    list.push('http://localhost:4000/app/');
  } else {
    list.push('http://127.0.0.1:4000/app/', 'http://localhost:4000/app/');
  }

  return Array.from(new Set(list.filter(Boolean)));
};

const URL_CANDIDATES = buildCandidates();
const WEB_URL = URL_CANDIDATES[0];
const initialDevHost = getDevServerHost();
const rawApiUrl = sanitizeDevUrl(process.env.EXPO_PUBLIC_API_URL);
const DEFAULT_API_HOST = initialDevHost
  ? `http://${initialDevHost}:4000`
  : `http://${CURRENT_LAN_IP}:4000`;
const API_URL = rawApiUrl || DEFAULT_API_HOST;
const SYNC_EVERY_MS = 5 * 60 * 1000; // foreground refresh; native OS SDK schedules background work
const memberStorageKey = (name, memberId) => {
  const safeName = String(name).replace(/[^A-Za-z0-9._-]/g, '_');
  const value = String(memberId || 'unknown-member');
  let hashA = 2166136261;
  let hashB = 5381;
  for (const character of value) {
    const code = character.codePointAt(0);
    hashA = Math.imul(hashA ^ code, 16777619);
    hashB = Math.imul(hashB ^ code, 33);
  }
  // SecureStore keys permit only letters, digits, periods, hyphens, and underscores.
  return `${safeName}_${(hashA >>> 0).toString(36)}_${(hashB >>> 0).toString(36)}`;
};
const localDayKey = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// ─── Shell Component ──────────────────────────────────────────────────────────
function Shell() {
  const insets = useSafeAreaInsets();
  const web = useRef(null);
  const webReady = useRef(false);
  const token = useRef(null);
  const activeMemberId = useRef(null);
  const selectedHealthPermissions = useRef(null);
  const asked = useRef(false);    // Have we already shown the permission sheet?
  const permissionGranted = useRef(null);
  const healthStoreGranted = useRef(null);
  const pedometerGranted = useRef(false);
  const busy = useRef(false);     // Prevent concurrent syncs
  const healthUpdates = useRef(null);
  const sensorSyncTimer = useRef(null);
  const syncRef = useRef(null);
  const last = useRef(null);      // Last telemetry payload sent to the web app
  const live = useRef({ steps: 0, sensorSteps: 0, sleepMinutes: 0, sub: null }); // Fallback state

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [webKey, setWebKey] = useState(0); // Increment to force WebView reload
  const [urlIndex, setUrlIndex] = useState(0);
  const activeCandidates = useMemo(() => buildCandidates(), [webKey]);
  const activeWebUrl = activeCandidates[urlIndex % activeCandidates.length];

  const handleUrlFailure = useCallback(() => {
    if (webReady.current) return;
    if (urlIndex < activeCandidates.length - 1) {
      console.log(`[WebView] Trying candidate ${urlIndex + 2}: ${activeCandidates[urlIndex + 1]}`);
      setUrlIndex((idx) => idx + 1);
    } else {
      console.warn('[WebView] All web candidates failed:', activeCandidates);
      setFailed(true);
      setLoading(false);
    }
  }, [urlIndex, activeCandidates]);

  // Avoid leaving the user on an indefinite splash screen when the local Vite server is unavailable.
  useEffect(() => {
    if (!loading || failed || webReady.current) return undefined;
    const timer = setTimeout(() => {
      if (!webReady.current) {
        handleUrlFailure();
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading, failed, urlIndex, handleUrlFailure]);

  const readBattery = async () => {
    try {
      const lvl = await Battery.getBatteryLevelAsync();
      return lvl >= 0 ? Math.round(lvl * 100) : null;
    } catch {
      return null;
    }
  };

  // ── Push payload into the web app ─────────────────────────────────────────
  // Sets window.__LATEST_HEALTH_TELEMETRY__ + dispatches 'nativeHealthTelemetry' event.
  // The web app's nativeBridge.js listens for this event.
  const push = useCallback((payload) => {
    last.current = payload;
    const js = `
      (function(){try{
        var p=${JSON.stringify(payload)};
        window.__LATEST_HEALTH_TELEMETRY__=p;
        window.dispatchEvent(new CustomEvent('nativeHealthTelemetry',{detail:p}));
        if(typeof window.onNativeHealthTelemetry==='function') window.onNativeHealthTelemetry(p);
      }catch(e){}}()); true;`;
    web.current?.injectJavaScript(js);
  }, []);

  const pushBle = useCallback((event, data) => {
    const js = `(function(){try{window.dispatchEvent(new CustomEvent('nativeBle',{detail:${JSON.stringify({ event, data })}}));}catch(e){}}()); true;`;
    web.current?.injectJavaScript(js);
  }, []);

  // ── Master sync: permission → read → push → upload ────────────────────────
  const sync = useCallback(
    async ({ prompt = false, force = false, permissions = null, isInitialLogin = false } = {}) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const battery = await readBattery();
        const base = {
          type: 'HEALTH_TELEMETRY',
          platform: Platform.OS,
          source: SOURCE,
          battery,
          fetchedAt: new Date().toISOString(),
          isNativeApp: true, // Tells the web app to hide the fake phone frame
        };

        const state = nativeHealthState();
        let selected = (Array.isArray(permissions) && permissions.length > 0)
          ? permissions
          : (Array.isArray(selectedHealthPermissions.current) && selectedHealthPermissions.current.length > 0)
          ? selectedHealthPermissions.current
          : ALL_HEALTH_METRICS;

        if (prompt || force || !asked.current) {
          const r = await requestHealthPermissions(selected);
          selectedHealthPermissions.current = selected;
          asked.current = true;
          permissionGranted.current = r.granted;
          healthStoreGranted.current = r.healthStoreGranted;
          pedometerGranted.current = Boolean(r.pedometerGranted);
          const scope = activeMemberId.current || 'unknown-member';
          await SecureStore.setItemAsync(memberStorageKey('health_permissions_selected', scope), JSON.stringify(selected)).catch(() => {});
          await SecureStore.setItemAsync(memberStorageKey('health_asked', scope), '1').catch(() => {});
          await SecureStore.setItemAsync(memberStorageKey('health_permission_granted', scope), String(permissionGranted.current)).catch(() => {});
          await SecureStore.setItemAsync(memberStorageKey('health_store_granted', scope), String(healthStoreGranted.current)).catch(() => {});
          await SecureStore.setItemAsync(memberStorageKey('pedometer_granted', scope), String(pedometerGranted.current)).catch(() => {});
          if (!r.granted) {
            push({
              ...base,
              status: 'permission_denied',
              reason: r.reason,
              today: { steps: 0 },
              history: [],
              liveSteps: 0,
              batteryLevel: battery,
            });
            return;
          }
        }
        selected = Array.isArray(selectedHealthPermissions.current) ? selectedHealthPermissions.current : selected;
        const wantsSteps = selected.includes('steps');
        const startPedometer = async (initialStoreSteps = 0) => {
          if (!wantsSteps || !pedometerGranted.current || live.current.sub) return;
          const sensorKey = memberStorageKey(
            'phone_pedometer_steps',
            `${activeMemberId.current || 'unknown-member'}:${localDayKey()}`,
          );
          const storeNum = Number(initialStoreSteps) || 0;
          const storedSteps = Number(await SecureStore.getItemAsync(sensorKey).catch(() => '0')) || 0;
          // When Health Connect / HealthKit reports a reading, that is the authoritative baseline
          const baseline = storeNum > 0 ? storeNum : Math.max(live.current.sensorSteps || 0, storedSteps);
          live.current.sensorSteps = baseline;
          if (storeNum > 0 && activeMemberId.current) {
            SecureStore.setItemAsync(sensorKey, String(storeNum)).catch(() => {});
          }
          const subscription = await startLiveSteps((count) => {
            const previous = live.current.sensorSteps || 0;
            const next = Math.max(previous, Number(count) || 0);
            if (next <= previous) return;
            live.current.sensorSteps = next;
            if (activeMemberId.current) SecureStore.setItemAsync(sensorKey, String(next)).catch(() => {});

            const current = last.current;
            if (current) {
              const storeSteps = Number(current.today?.steps) || 0;
              const visibleSteps = Math.max(storeSteps, next);
              const calculatedBurn = Math.round(visibleSteps * 0.045);
              const visibleCalories = Math.max(Number(current.today?.activeCalories) || 0, calculatedBurn);
              const calculatedDistance = Math.round(visibleSteps * 0.75);
              const visibleDistance = Math.max(Number(current.today?.distanceM) || 0, calculatedDistance);
              const useSensor = next > storeSteps;

              push({
                ...current,
                status: visibleSteps > 0 ? 'ok' : current.status,
                stepSource: useSensor ? 'phone_pedometer' : (current.stepSource || SOURCE),
                today: {
                  ...(current.today || {}),
                  steps: visibleSteps,
                  activeCalories: visibleCalories,
                  distanceM: visibleDistance,
                },
                liveSteps: visibleSteps,
                health: {
                  ...(current.health || {}),
                  steps: { today: visibleSteps, unit: 'count' },
                  calories: { activeToday: visibleCalories, unit: 'kcal' },
                  distance: { todayMeters: visibleDistance, unit: 'm' },
                },
              });
            }

            if (sensorSyncTimer.current) clearTimeout(sensorSyncTimer.current);
            sensorSyncTimer.current = setTimeout(() => syncRef.current?.(), 15_000);
          }, baseline);
          live.current.sub = subscription;
        };

        // A) Health store not usable → fallback to the phone step sensor
        if (!state.ok) {
          await startPedometer();
          const sensorSteps = live.current.sensorSteps || 0;
          const sensorCalories = Math.round(sensorSteps * 0.04);
          const sensorDistance = Math.round(sensorSteps * 0.75);
          const payload = {
            ...base,
            status: sensorSteps > 0 ? 'sensor_only' : 'unavailable',
            reason: state.reason,
            source: sensorSteps > 0 ? 'phone_pedometer' : 'none',
            stepSource: 'phone_pedometer',
            today: {
              steps: sensorSteps,
              activeCalories: sensorCalories,
              distanceM: sensorDistance,
              sleepMinutes: live.current.sleepMinutes || 0,
            },
            history: [],
            liveSteps: sensorSteps,
            batteryLevel: battery,
            health: {
              steps: { today: sensorSteps, unit: 'count' },
              calories: { activeToday: sensorCalories, unit: 'kcal' },
              distance: { todayMeters: sensorDistance, unit: 'm' },
              sleep: { durationMinutes: live.current.sleepMinutes || 0, unit: 'minutes' },
              source: 'PHONE_PEDOMETER',
            },
          };
          push({
            ...payload,
          });
          if (token.current && sensorSteps > 0) {
            try {
              const samples = buildSamples(
                { steps: sensorSteps, activeCalories: sensorCalories, distanceM: sensorDistance },
                [],
                { stepProvider: 'phone_pedometer', stepDeviceId: 'phone-motion-sensor' },
              );
              const upload = await uploadHealth({ apiBase: API_URL, token: token.current, samples, permissions: ['steps', 'calories', 'distance'] });
              push({ ...payload, databaseSync: { status: 'saved', accepted: upload.accepted, uploaded: upload.uploaded } });
            } catch (sensorErr) {
              console.log('[Health] sensor upload error:', sensorErr?.message);
              push({ ...payload, databaseSync: { status: 'error', message: sensorErr?.message || 'Sensor sync failed' } });
            }
          }
          return;
        }

        if (healthStoreGranted.current === true && !healthUpdates.current) {
          healthUpdates.current = await observeHealthUpdates(() => sync(), selectedHealthPermissions.current).catch((e) => {
            console.log('[Health] observer setup failed:', e?.message);
            return null;
          });
        }

        // C) Read real data from Google Health Connect / Apple HealthKit
        let today;
        let history;
        if (!selected.length) {
          today = {
            steps: 0, activeCalories: null, distanceM: null, heartRate: null,
            hrvMs: null, spo2: null, bloodGlucose: null, bloodPressureSystolic: null,
            bloodPressureDiastolic: null, respiratoryRate: null, weightKg: null, sleepMinutes: 0,
          };
          history = [];
        } else {
          // A null grant state means the native key has not been restored yet.
          // Incremental Sync vs Initial 30-Day Sync:
          // When a user logs in for the first time, fetch the previous 30 days.
          // On later syncs (foreground, 5-min intervals, end-of-day background sync),
          // check what was the user's lastSync from SecureStore and fetch from that day up to today.
          // Always fetch full 30-day history on every sync (auto or manual) so that
          // no past days show 0 steps and the complete 30-day timeline is persisted to the database.
          const daysToFetch = 30;

          let freshHistory = [];
          [today, freshHistory] = await Promise.all([
            readToday(selected),
            readStepHistory(daysToFetch, selected),
          ]);

          // Merge fresh incremental history into cached in-memory history
          const mergedMap = new Map();
          if (Array.isArray(last.current?.history)) {
            for (const h of last.current.history) {
              if (h?.date) mergedMap.set(h.date, h);
            }
          }
          for (const h of freshHistory) {
            if (h?.date) mergedMap.set(h.date, h);
          }
          history = Array.from(mergedMap.values()).sort((a, b) => b.date.localeCompare(a.date));
        }

        let stepProvider = SOURCE;
        if (wantsSteps && pedometerGranted.current) {
          const storeSteps = today.steps || 0;
          await startPedometer(storeSteps);
          const sensorSteps = live.current.sensorSteps || 0;
          // When a user connects with a wearable (Fitbit, Whoop, Google Fit, Samsung Health, etc.),
          // default phone and wearable steps are NEVER added together; we choose the best reading:
          const maxSteps = Math.max(storeSteps, sensorSteps);
          today.steps = maxSteps;
          stepProvider = sensorSteps > storeSteps ? 'phone_pedometer' : SOURCE;
          if (today.steps > 0) {
            const minBurn = Math.round(today.steps * 0.045);
            const maxBurn = Math.round(today.steps * 0.09);
            const curBurn = Number(today.activeCalories) || 0;
            today.activeCalories = (curBurn > 0 && curBurn <= maxBurn) ? curBurn : minBurn;
            const curDist = Number(today.distanceM) || 0;
            today.distanceM = curDist > 0 ? curDist : Math.round(today.steps * 0.75);
          }
        }

        const hasData =
          today.steps > 0 ||
          history.some((d) => d.steps > 0) ||
          Boolean(
            today.heartRate ||
              today.hrvMs ||
              today.spo2 ||
              today.bloodGlucose ||
              today.bloodPressureSystolic ||
              today.bloodPressureDiastolic ||
              today.respiratoryRate ||
              today.sleepMinutes ||
              today.activeCalories ||
              today.distanceM ||
              today.weightKg
          );

        const payload = {
          ...base,
          status: hasData ? 'ok' : 'no_data',
          reason: hasData
            ? null
            : Platform.OS === 'android'
            ? 'NO_SOURCE_APP'
            : 'NO_DATA_OR_DENIED',
          today,
          history,
          stepSource: stepProvider,
          // Compatibility with existing web app frontend (AuthContext + HomeScreen)
          liveSteps: today.steps,
          batteryLevel: battery,
          permissionGranted: hasData ? true : permissionGranted.current,
          healthAvailable: hasData || permissionGranted.current === true,
          healthAuthorized: hasData || permissionGranted.current === true,
          healthSource: SOURCE.toUpperCase(),
          health: {
            steps: { today: today.steps, unit: 'count' },
            calories: { activeToday: today.activeCalories ?? 0, unit: 'kcal' },
            distance: { todayMeters: today.distanceM ?? 0, unit: 'm' },
            heartRate: today.heartRate
              ? { latest: today.heartRate.latest, average: today.heartRate.avg, unit: 'bpm' }
              : null,
            hrv: today.hrvMs ? { latest: today.hrvMs, unit: 'ms' } : null,
            spo2: today.spo2 != null ? { latest: Math.round(today.spo2 <= 1 ? today.spo2 * 100 : (today.spo2 > 100 ? today.spo2 / 100 : today.spo2)), unit: '%' } : null,
            bloodGlucose: today.bloodGlucose ? { latestMgDl: today.bloodGlucose, unit: 'mg/dL' } : null,
            bloodPressure: today.bloodPressureSystolic && today.bloodPressureDiastolic
              ? { systolic: today.bloodPressureSystolic, diastolic: today.bloodPressureDiastolic, unit: 'mmHg' }
              : null,
            respiratoryRate: today.respiratoryRate ? { latest: today.respiratoryRate, unit: 'count/min' } : null,
            weight: today.weightKg ? { latestKg: today.weightKg, unit: 'kg' } : null,
            sleep: { durationMinutes: today.sleepMinutes ?? 0, unit: 'minutes' },
            source: SOURCE.toUpperCase(),
            fetchedAt: base.fetchedAt,
          },
        };

        push(payload);

        // D) Upload fresh captured samples directly to PostgreSQL database
        if (token.current) {
          const samples = buildSamples(today, history, {
            stepProvider,
            stepDeviceId: stepProvider === 'phone_pedometer' ? 'phone-motion-sensor' : null,
          });
          try {
            const upload = await uploadHealth({
              apiBase: API_URL,
              token: token.current,
              samples,
              permissions: selectedHealthPermissions.current,
            });
            const memberScope = activeMemberId.current || 'unknown-member';
            await SecureStore.setItemAsync(
              memberStorageKey('last_health_sync_time', memberScope),
              new Date().toISOString()
            ).catch(() => {});
            push({ ...payload, databaseSync: { status: 'saved', accepted: upload.accepted, uploaded: upload.uploaded } });
          } catch (e) {
            console.log('[Health] upload failed:', e?.message);
            if (e?.message?.includes('member_inactive') || e?.message?.includes('user_not_found') || e?.message?.includes('401')) {
              token.current = null;
              await SecureStore.deleteItemAsync('auth_token').catch(() => {});
              await SecureStore.deleteItemAsync('auth_member_id').catch(() => {});
            }
            push({ ...payload, databaseSync: { status: 'error', message: e?.message || 'Upload failed' } });
          }
        }
      } catch (e) {
        console.log('[Health] sync error:', e?.message);
      } finally {
        busy.current = false;
      }
    },
    [push]
  );
  syncRef.current = sync;

  // ── Restore session and sync on startup ───────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        token.current = await SecureStore.getItemAsync('auth_token');
        activeMemberId.current = await SecureStore.getItemAsync('auth_member_id');
        const scope = activeMemberId.current || 'unknown-member';
        asked.current = (await SecureStore.getItemAsync(memberStorageKey('health_asked', scope))) === '1';
        const savedPermission = await SecureStore.getItemAsync(memberStorageKey('health_permission_granted', scope));
        permissionGranted.current = savedPermission === 'true' ? true : savedPermission === 'false' ? false : null;
        const storePermission = await SecureStore.getItemAsync(memberStorageKey('health_store_granted', scope));
        healthStoreGranted.current = storePermission === 'true' ? true : storePermission === 'false' ? false : null;
        pedometerGranted.current = (await SecureStore.getItemAsync(memberStorageKey('pedometer_granted', scope))) === 'true';
        const savedPermissions = await SecureStore.getItemAsync(memberStorageKey('health_permissions_selected', scope));
        if (savedPermissions) {
          try { selectedHealthPermissions.current = JSON.parse(savedPermissions); } catch {}
        }
        if (activeMemberId.current) {
          const sensorKey = memberStorageKey('phone_pedometer_steps', `${activeMemberId.current}:${localDayKey()}`);
          live.current.sensorSteps = Number(await SecureStore.getItemAsync(sensorKey).catch(() => '0')) || 0;
        }
        if (token.current) {
          sync();
        }
      } catch (e) {
        console.log('[Health] SecureStore restore error:', e?.message);
      }
    })();
  }, [sync]);

  // ── Foreground refresh + 5-min interval ──────────────────────────────────
  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') sync();
    }, SYNC_EVERY_MS);

    return () => {
      appStateSub.remove();
      clearInterval(interval);
      // Unsubscribe pedometer
      live.current.sub?.remove?.();
    };
  }, [sync]);

  // ── Messages from the web app ─────────────────────────────────────────────
  const onMessage = async (event) => {
    let m;
    try {
      m = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    switch (m.type) {
      // Sent by the web app right after OTP verification succeeds
      case 'LOGIN_SUCCESS':
        token.current = m.token;
        activeMemberId.current = String(m.memberId || 'unknown-member');
        await SecureStore.setItemAsync('auth_token', m.token).catch(() => {});
        await SecureStore.setItemAsync('auth_member_id', activeMemberId.current).catch(() => {});
        {
          const scope = activeMemberId.current;
          asked.current = (await SecureStore.getItemAsync(memberStorageKey('health_asked', scope))) === '1';
          const savedPermission = await SecureStore.getItemAsync(memberStorageKey('health_permission_granted', scope));
          permissionGranted.current = savedPermission === 'true' ? true : savedPermission === 'false' ? false : null;
          const storePermission = await SecureStore.getItemAsync(memberStorageKey('health_store_granted', scope));
          healthStoreGranted.current = storePermission === 'true' ? true : storePermission === 'false' ? false : null;
          pedometerGranted.current = (await SecureStore.getItemAsync(memberStorageKey('pedometer_granted', scope))) === 'true';
          const savedPermissions = await SecureStore.getItemAsync(memberStorageKey('health_permissions_selected', scope));
          try { selectedHealthPermissions.current = savedPermissions ? JSON.parse(savedPermissions) : []; } catch { selectedHealthPermissions.current = []; }
          if (Array.isArray(m.permissions)) {
            const validPermissions = m.permissions.filter((permission) =>
              ['steps', 'distance', 'calories', 'heart_rate', 'hrv', 'spo2', 'blood_pressure_systolic', 'blood_pressure_diastolic', 'blood_glucose', 'respiratory_rate', 'weight', 'sleep'].includes(permission)
            );
            selectedHealthPermissions.current = validPermissions;
            await SecureStore.setItemAsync(
              memberStorageKey('health_permissions_selected', scope),
              JSON.stringify(validPermissions),
            ).catch(() => {});
          }
          const sensorKey = memberStorageKey('phone_pedometer_steps', `${scope}:${localDayKey()}`);
          live.current.sensorSteps = Number(await SecureStore.getItemAsync(sensorKey).catch(() => '0')) || 0;
        }
        // Trigger native health permission request & master 30-day sync immediately upon login
        await sync({ prompt: true, force: true, permissions: ALL_HEALTH_METRICS, isInitialLogin: true });
        break;

      case 'LOGOUT':
        token.current = null;
        activeMemberId.current = null;
        asked.current = false;
        selectedHealthPermissions.current = null;
        permissionGranted.current = null;
        healthStoreGranted.current = null;
        pedometerGranted.current = false;
        healthUpdates.current?.remove?.();
        healthUpdates.current = null;
        await SecureStore.deleteItemAsync('auth_token').catch(() => {});
        await SecureStore.deleteItemAsync('auth_member_id').catch(() => {});
        live.current.sub?.remove?.();
        live.current.sub = null;
        if (sensorSyncTimer.current) clearTimeout(sensorSyncTimer.current);
        sensorSyncTimer.current = null;
        live.current = { steps: 0, sensorSteps: 0, sleepMinutes: 0, sub: null };
        ble.disconnect().catch(() => {});
        break;

      case 'BLE_SCAN_START':
        try {
          pushBle('scanState', { scanning: true });
          await ble.startScan(
            (d) => pushBle('device', d),
            (e) => pushBle('error', { message: e?.message }),
            (g) => pushBle('diag', g),
          );
          setTimeout(() => { ble.stopScan(); pushBle('scanState', { scanning: false }); }, 15000);
        } catch (e) {
          pushBle('scanState', { scanning: false });
          pushBle('error', { message: e?.message || 'Bluetooth scan failed' });
        }
        break;

      case 'BLE_SCAN_STOP':
        ble.stopScan();
        pushBle('scanState', { scanning: false });
        break;

      case 'BLE_CONNECT':
        try {
          const dev = await ble.connect(m.deviceId, {
            onHeartRate: (hr) => pushBle('heartRate', hr),
            onBattery: (b) => pushBle('battery', b),
            onState: (s) => pushBle('state', { state: s }),
            onServices: (l) => pushBle('services', l),
          });
          pushBle('connectedDevice', dev);
        } catch (e) {
          pushBle('state', { state: 'disconnected' });
          pushBle('error', { message: e?.message || 'Connect failed' });
        }
        break;

      case 'BLE_DISCONNECT':
        await ble.disconnect();
        break;

      case 'REQUEST_HEALTH_PERMISSIONS':
        if (m.memberId) activeMemberId.current = String(m.memberId);
        sync({ prompt: true, force: true, permissions: m.permissions });
        break;

      case 'REVOKE_HEALTH_ACCESS':
        if (m.memberId) activeMemberId.current = String(m.memberId);
        selectedHealthPermissions.current = [];
        permissionGranted.current = false;
        healthStoreGranted.current = false;
        pedometerGranted.current = false;
        healthUpdates.current?.remove?.();
        healthUpdates.current = null;
        live.current.sub?.remove?.();
        live.current.sub = null;
        if (sensorSyncTimer.current) clearTimeout(sensorSyncTimer.current);
        sensorSyncTimer.current = null;
        {
          const scope = activeMemberId.current || 'unknown-member';
          SecureStore.setItemAsync(memberStorageKey('health_permissions_selected', scope), '[]').catch(() => {});
          SecureStore.setItemAsync(memberStorageKey('health_asked', scope), '1').catch(() => {});
          SecureStore.setItemAsync(memberStorageKey('health_permission_granted', scope), 'false').catch(() => {});
          SecureStore.setItemAsync(memberStorageKey('health_store_granted', scope), 'false').catch(() => {});
          SecureStore.setItemAsync(memberStorageKey('pedometer_granted', scope), 'false').catch(() => {});
        }
        sync();
        break;

      case 'SYNC_MOBILE_HEALTH':
      case 'PULL_DOWN_SYNC':
        sync();
        break;

      case 'REQUEST_NATIVE_TELEMETRY':
        last.current ? push(last.current) : sync();
        break;

      // Opens Android Health Connect Permissions Screen directly (bypassing general App Info)
      case 'OPEN_HEALTH_SETUP':
        if (Platform.OS === 'android') {
          Linking.openURL('intent:#Intent;action=androidx.health.ACTION_HEALTH_CONNECT_SETTINGS;end')
            .catch(() => Linking.openURL('intent:#Intent;action=android.health.connect.action.HEALTH_CONNECT_SETTINGS;end'))
            .catch(() => Linking.openURL('market://details?id=com.google.android.apps.healthdata'))
            .catch(() => Linking.openSettings());
        } else {
          Linking.openSettings();
        }
        break;

      case 'WEB_CONSOLE_ERROR':
        console.error('[WebView JS Error]:', m.message, m.stack || '');
        break;

      case 'DOWNLOAD_PDF':
      case 'OPEN_URL':
        if (m.url) {
          Linking.openURL(m.url).catch((err) => {
            console.warn('[expo-mobile] Could not open PDF URL via Linking:', err);
          });
        }
        break;

      default:
        break;
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Light status bar to match the web app's #F8FAFC background */}
      <StatusBar style="dark" backgroundColor="#F8FAFC" />
      <View style={styles.flex}>
        <WebView
          key={webKey}
          ref={web}
          source={{ uri: activeWebUrl }}
          style={styles.web}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          allowsInlineMediaPlayback
          geolocationEnabled
          mixedContentMode="always"
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          cacheEnabled={false}
          cacheMode="LOAD_NO_CACHE"
          androidLayerType="hardware"
          scalesPageToFit={false}
          setSupportMultipleWindows={false}
          webviewDebuggingEnabled={true}
          // Injected BEFORE first render so the web app hides the fake phone frame immediately
          injectedJavaScriptBeforeContentLoaded={`
            window.__IS_NATIVE_APP__ = true;
            window.__SAFE_BOTTOM__ = ${Math.round(insets.bottom)};
            window.useRef = window.useRef || function(initial) { return { current: initial !== undefined ? initial : null }; };
            window.onerror = function(msg, url, lineNo, columnNo, error) {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'WEB_CONSOLE_ERROR',
                  message: String(msg) + ' at ' + String(url) + ':' + lineNo,
                  stack: error ? error.stack : ''
                }));
              }
              return false;
            };
            window.onunhandledrejection = function(event) {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'WEB_CONSOLE_ERROR',
                  message: 'Unhandled Promise Rejection: ' + (event.reason ? (event.reason.message || String(event.reason)) : 'unknown')
                }));
              }
            };
            true;
          `}
          onLoadStart={() => {
            webReady.current = false;
            setLoading(true);
            setFailed(false);
          }}
          onLoad={() => {
            webReady.current = true;
            setLoading(false);
            setFailed(false);
          }}
          onLoadEnd={() => {
            webReady.current = true;
            setLoading(false);
            // Re-send last known telemetry so the web app has data immediately on reload
            if (last.current) push(last.current);
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('[WebView onError]:', nativeEvent?.description, nativeEvent?.url);
            handleUrlFailure();
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('[WebView onHttpError]:', nativeEvent?.statusCode, nativeEvent?.url);
            const isMainFrame = nativeEvent?.isForMainFrame !== false;
            if (isMainFrame && nativeEvent?.statusCode >= 400) {
              handleUrlFailure();
            }
          }}
          onMessage={onMessage}
          onConsoleMessage={(event) => {
            console.log('[WebView Console]:', event.nativeEvent.message);
          }}
          onShouldStartLoadWithRequest={(request) => {
            const url = request?.url || '';
            // Intercept PDF downloads or summary-pdf endpoint and launch in system browser/viewer
            if (url.includes('/summary-pdf') || url.endsWith('.pdf')) {
              Linking.openURL(url).catch((err) => {
                console.warn('[expo-mobile] Failed to open PDF URL in system handler:', err);
              });
              return false; // Prevent webview from trying to navigate to PDF binary
            }
            return true;
          }}
          bounces={false}
          overScrollMode="never"
        />

        {loading && !failed && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#00A8D0" />
            <Text style={styles.overlayTitle}>Loading GOQii Health…</Text>
          </View>
        )}

        {failed && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#00A8D0" />
            <Text style={styles.overlayTitle}>Connecting to GOQii Health…</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => { setFailed(false); setUrlIndex(0); setWebKey((k) => k + 1); }}>
              <Text style={styles.retryBtnText}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  flex: { flex: 1 },
  web: { flex: 1, backgroundColor: '#F8FAFC' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  overlayTitle: {
    color: '#0B1220',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  overlaySub: {
    color: '#6B7A90',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#00A8D0',
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 20,
    shadowColor: '#00A8D0',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
});
