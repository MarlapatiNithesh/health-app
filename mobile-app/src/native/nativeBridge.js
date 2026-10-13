// src/native/nativeBridge.js
// Put this in your Vite web app (mobile-app/src/native/nativeBridge.js).
// It is the ONLY place that talks to the React Native shell.
import { useEffect, useState } from 'react';

// ── Is this web app running inside the native Expo shell? ─────────────────────
// The shell injects window.__IS_NATIVE_APP__ = true before first render.
export const isNative =
  typeof window !== 'undefined' &&
  (!!window.ReactNativeWebView || !!window.__IS_NATIVE_APP__);

// ── Send a message to the native shell ────────────────────────────────────────
export function toNative(type, payload = {}) {
  if (
    typeof window !== 'undefined' &&
    window.ReactNativeWebView &&
    typeof window.ReactNativeWebView.postMessage === 'function'
  ) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...payload }));
  }
}

// ── Live health telemetry hook ────────────────────────────────────────────────
// Returns the latest payload pushed by the native shell via nativeHealthTelemetry event.
// Shape: {
//   status:  'ok' | 'permission_denied' | 'no_data' | 'sensor_only' | 'unavailable'
//   reason:  null | 'NO_SOURCE_APP' | 'NATIVE_MODULE_MISSING' | ...
//   source:  'health_connect' | 'apple_health' | 'sensor' | 'none'
//   battery: number | null
//   today:   { steps, activeCalories, distanceM, heartRate:{latest,avg}, sleepMinutes, weightKg }
//   history: [{ date:'YYYY-MM-DD', steps:number }, ...]
//   -- compatibility fields for the existing AuthContext --
//   liveSteps:       number
//   batteryLevel:    number | null
//   health:          { steps, calories, distance, heartRate, sleep, ... }
//   isNativeApp:     true
// }
export function useNativeHealth() {
  const [health, setHealth] = useState(() =>
    typeof window !== 'undefined' ? window.__LATEST_HEALTH_TELEMETRY__ || null : null
  );

  useEffect(() => {
    const handler = (e) => {
      if (e?.detail) setHealth(e.detail);
    };
    window.addEventListener('nativeHealthTelemetry', handler);

    // If we already have data (e.g. shell injected it before this component mounted)
    if (window.__LATEST_HEALTH_TELEMETRY__) {
      setHealth(window.__LATEST_HEALTH_TELEMETRY__);
    } else {
      // Ask the shell to re-send the last telemetry
      toNative('REQUEST_NATIVE_TELEMETRY');
    }

    return () => window.removeEventListener('nativeHealthTelemetry', handler);
  }, []);

  return health;
}

// ── Friendly message for each health state ────────────────────────────────────
// Show this in a card on Home instead of plain "0 steps".
export function healthMessage(h) {
  if (!h) return { title: 'Connecting to phone health…', body: '', action: null };
  switch (h.status) {
    case 'ok':
      return null; // Data is fine — no message needed
    case 'permission_denied':
      return {
        title: 'Allow access to your steps',
        body: h.platform === 'android'
          ? 'Open Health Connect and allow Steps, Heart rate and Sleep.'
          : 'Go to Settings › Health › Data Access and allow GOQii Health.',
        action: ['Allow now', 'REQUEST_HEALTH_PERMISSIONS'],
      };
    case 'no_data':
      return h.platform === 'android'
        ? {
            title: 'No steps found yet',
            body: 'Health Connect only stores what other apps write. Install Google Fit or Samsung Health (or connect your watch) and allow Steps.',
            action: ['Open Health Connect', 'OPEN_HEALTH_SETUP'],
          }
        : {
            title: 'No steps found',
            body: 'Check Settings › Health › Data Access & Devices and allow this app.',
            action: ['Open Settings', 'OPEN_HEALTH_SETUP'],
          };
    case 'sensor_only':
      return {
        title: 'Using phone motion sensor',
        body: h.platform === 'android'
          ? 'Counting steps since you opened the app. Install Health Connect and Google Fit for full history.'
          : 'Showing today\'s steps from the phone motion sensor.',
        action: ['Set up health sync', 'OPEN_HEALTH_SETUP'],
      };
    case 'unavailable':
      if (h.reason === 'NATIVE_MODULE_MISSING') {
        return {
          title: 'Open the installed GOQii development build',
          body: 'Expo Go does not include the native Health Connect / Apple Health module. Phone step counting may still work, but health store sync needs the development build.',
          action: null,
        };
      }
      if (h.reason === 'HEALTH_CONNECT_MISSING') {
        return {
          title: 'Health Connect is not installed',
          body: 'Install Health Connect from Google Play, then return here and refresh phone health data.',
          action: ['Set up Health Connect', 'OPEN_HEALTH_SETUP'],
        };
      }
      return { title: 'Health data unavailable on this device', body: '', action: null };
    default:
      return { title: 'Health data unavailable on this device', body: '', action: null };
  }
}

// ── Usage guide ───────────────────────────────────────────────────────────────
//
// After OTP verification succeeds:
//   toNative('LOGIN_SUCCESS', { token });
//
// On logout:
//   toNative('LOGOUT');
//
// Pull-to-refresh / Sync Now button:
//   toNative('PULL_DOWN_SYNC');
//
// "Allow phone health" button:
//   toNative('REQUEST_HEALTH_PERMISSIONS');
//
// Hide fake phone frame when running inside native app (in main.jsx or App.jsx):
//   import { isNative } from './native/nativeBridge';
//   return isNative ? <AppScreens /> : <PhoneFrame><AppScreens /></PhoneFrame>;
//
// Respect the home indicator (safe area) on the tab bar:
//   style={{ paddingBottom: window.__SAFE_BOTTOM__ || 0 }}
