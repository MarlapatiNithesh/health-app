# Open Wearables Frontend Integration Guide

This guide details how to integrate Open Wearables into the frontend to connect providers, capture biometric metrics and steps, and handle automated and manual syncing.

---

## 1. Architecture Overview

Your frontend communicates directly with your Express API routes (`/v1/wearables` and `/api/wearables`), ensuring your Open Wearables API secrets, master keys, and SDK credentials stay protected on the server:

```
[ Frontend App (React / React Native) ]
       │ (User Bearer JWT Token)
       ▼
[ Your Express API (/api/wearables) ]
       │ (X-Open-Wearables-API-Key)
       ▼
[ Open Wearables API ]
 ├── Cloud OAuth Providers (Fitbit, Garmin, Oura, Whoop, Strava, Polar, Suunto, Withings, Ultrahuman)
 ├── Mobile SDK Bridge (Apple Health, Health Connect)
 ├── Apple Health XML Importer (Direct upload < 5MB, S3 Multipart >= 5MB)
 └── Webhooks (Auto-pushes biometric events to backend)
```

---

## 2. Frontend API Client (`wearableApi.js`)

Located at [`mobile-app/src/services/wearableApi.js`](file:///c:/Users/nithe/Desktop/health%20(2)/mobile-app/src/services/wearableApi.js) (and re-exported via [`api.js`](file:///c:/Users/nithe/Desktop/health%20(2)/mobile-app/src/services/api.js)):

```javascript
import { wearableApi, getSteps, getSleepAndWorkouts, connectOAuthProvider } from './services/wearableApi';

// Discover enabled providers and active user connections
const { data: providers } = await wearableApi.getProviders();
const { data: connections } = await wearableApi.getConnections();

// Trigger a manual pull sync
await wearableApi.syncProvider('oura');

// Disconnect a provider
await wearableApi.disconnectProvider('fitbit');
```

---

## 3. Connecting Providers

### A. Cloud OAuth Providers (Garmin, WHOOP, Oura, Fitbit, Strava, Suunto, Polar, Withings, Ultrahuman)
1. Frontend calls `wearableApi.createConnectSession(brand, redirectUrl)`.
2. Backend queries Open Wearables for the authorization URL.
3. The client opens an authentication popup (`window.open`).
4. Upon authorization, Open Wearables redirects to `/wearables/callback`.
5. The callback page automatically dispatches `WEARABLE_AUTH_SUCCESS` via `window.opener.postMessage` and closes itself.
6. The main app listens to the event, updates the UI, and refreshes telemetry.

```javascript
export async function connectOAuthProvider(brand) {
  const redirectUrl = `${window.location.origin}/wearables/callback`;
  const session = await wearableApi.createConnectSession(brand, redirectUrl);

  const popup = window.open(
    session.connectUrl,
    'WearableAuth',
    'width=600,height=750'
  );

  return new Promise((resolve, reject) => {
    function handleMessage(e) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'WEARABLE_AUTH_SUCCESS') {
        window.removeEventListener('message', handleMessage);
        if (popup && !popup.closed) popup.close();
        resolve(e.data);
      }
    }
    window.addEventListener('message', handleMessage);
  });
}
```

### B. Phone SDKs (Apple Health & Android Health Connect)
- For iOS / Android mobile environments, request native health permissions via `requestHealthAccess()`.
- Obtain an SDK user token if running the OpenWearables native client:
  ```javascript
  const session = await wearableApi.createSdkSession();
  // Returns { userId, accessToken, refreshToken, host }
  ```

### C. Apple Health XML Export Direct & Multipart Upload
Allows users on any device (Web, iOS, Android) to import complete Apple Health export archives (`export.zip` or `export.xml`):
```javascript
await wearableApi.importAppleXml(file, (percent) => {
  console.log(`Upload progress: ${percent}%`);
});
```
- **Files < 5 MiB:** Handled via direct binary/multipart upload.
- **Files ≥ 5 MiB:** Automatically handled via S3-compatible chunked multipart upload (`create`, `sign`, PUT chunks with ETag capture, `complete`).

---

## 4. Capturing Steps and Health Data

### Timeseries Querying
```javascript
export async function getSteps(startDate, endDate, resolution = 'daily') {
  const data = await wearableApi.getTimeseries({
    start_time: new Date(startDate).toISOString(),
    end_time: new Date(endDate).toISOString(),
    types: 'steps',
    resolution, // 'daily', 'hourly', or 'raw'
  });
  return data?.data || data?.items || [];
}
```

### Sleep & Workouts
```javascript
export async function getSleepAndWorkouts(startDateStr, endDateStr) {
  const [sleep, workouts] = await Promise.all([
    wearableApi.getSleep({ start_date: startDateStr, end_date: endDateStr }),
    wearableApi.getWorkouts({ start_date: startDateStr, end_date: endDateStr }),
  ]);
  return {
    sleep: sleep?.data || sleep?.items || [],
    workouts: workouts?.data || workouts?.items || [],
  };
}
```

---

## 5. Manual Sync & Auto-Sync Patterns

1. **Manual Sync ("Sync Now" button):**
   ```javascript
   await wearableApi.syncProvider(providerKey);
   ```
2. **Auto-Sync on Tab Focus:**
   Syncs connected devices whenever the user switches back to the application tab if more than 15 minutes have elapsed since the last refresh.
3. **Garmin Exception:**
   Garmin data is delivered exclusively via webhook push notifications. Polling is disabled for Garmin after the initial connection.

---

## 6. Error Handling & Edge Cases

| Error Code | HTTP Status | Meaning & Handling |
|---|:---:|---|
| `consent_required` | 403 | Member has not yet confirmed health data consent. Prompt with `HealthPermissionModal`. |
| `open_wearables_unauthorized` | 401 | API key or credentials expired on backend. |
| `validation_error` | 422 | Unsupported provider brand or parameter validation issue. |
| `token_expired` | Connection Status | User's provider OAuth refresh token expired. Render **Reconnect** action. |
| `apple_xml_upload_failed` | 502 | Issue streaming XML or communicating with S3 multipart storage. |
