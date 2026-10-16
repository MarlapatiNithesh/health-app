// Open Wearables Frontend API Client
// Connects directly to backend Open Wearables API routes

const BASE_URL = '/api/wearables';

function getAuthToken() {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem('wellness_token') || localStorage.getItem('token') || '';
}

async function apiFetch(endpoint, { method = 'GET', body = null, headers = {} } = {}) {
  const token = getAuthToken();
  const reqHeaders = {
    'Accept': 'application/json',
    ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...headers,
  };

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: reqHeaders,
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });

  if (!res.ok) {
    let errorData = {};
    try {
      errorData = await res.json();
    } catch {
      const text = await res.text().catch(() => '');
      errorData = { message: text };
    }

    const message = errorData.error?.message || errorData.message || `API error [${res.status}]`;
    const error = new Error(message);
    error.status = res.status;
    error.code = errorData.error?.code || errorData.code || 'api_error';
    error.details = errorData;
    throw error;
  }

  return res.status === 204 ? null : res.json();
}

export const wearableApi = {
  // Discovery & Status
  getProviders: () => apiFetch('/providers'),
  getConnections: () => apiFetch('/connections'),
  disconnectProvider: (provider) =>
    apiFetch(`/connections/${encodeURIComponent(provider)}`, { method: 'DELETE' }),
  disconnectAll: () =>
    apiFetch('/connections', { method: 'DELETE' }),

  // Connecting
  createConnectSession: (brand, redirectUrl) =>
    apiFetch('/connect-session', {
      method: 'POST',
      body: { brand, redirectUrl },
    }),
  createSdkSession: () =>
    apiFetch('/sdk-session', { method: 'POST' }),
  syncSdkData: () =>
    apiFetch('/sdk-sync', { method: 'POST' }),
  disconnectSdkProvider: (provider) =>
    apiFetch(`/sdk-connection/${encodeURIComponent(provider)}`, { method: 'DELETE' }),

  // Manual & Provider Syncing
  syncProvider: (provider, options = {}) =>
    apiFetch(`/connections/${encodeURIComponent(provider)}/sync`, {
      method: 'POST',
      body: options,
    }),
  getSyncRuns: () => apiFetch('/sync/runs'),
  getSyncRecent: (limit = 50) => apiFetch(`/sync/recent?limit=${Number(limit) || 50}`),

  // Data Extraction
  getTimeseries: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        if (Array.isArray(val)) {
          val.forEach((item) => qs.append(key, item));
        } else {
          qs.set(key, String(val));
        }
      }
    });
    return apiFetch(`/timeseries?${qs.toString()}`);
  },
  getWorkouts: (params = {}) => apiFetch(`/workouts?${new URLSearchParams(params).toString()}`),
  getSleep: (params = {}) => apiFetch(`/sleep?${new URLSearchParams(params).toString()}`),
  getHealthScores: (params = {}) => apiFetch(`/health-scores?${new URLSearchParams(params).toString()}`),
  getWomensHealth: (params = {}) => apiFetch(`/womens-health?${new URLSearchParams(params).toString()}`),
  getDevices: () => apiFetch('/devices'),

  // Apple Health XML Export Direct & S3 Multipart Import
  importAppleXml: async (file, onProgress) => {
    const token = getAuthToken();
    const filename = file?.name || 'export.xml';
    const headers = {
      'Content-Type': 'application/octet-stream',
      'X-Filename': filename,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    if (typeof XMLHttpRequest !== 'undefined' && typeof onProgress === 'function') {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BASE_URL}/import/apple/xml?filename=${encodeURIComponent(filename)}`);
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const percent = Math.round((evt.loaded / evt.total) * 100);
            onProgress(percent, evt.loaded, evt.total);
          }
        };

        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(json);
            } else {
              reject(new Error(json?.error?.message || json?.message || `Upload failed with status ${xhr.status}`));
            }
          } catch {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve({ status: 'completed' });
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Network error during Apple Health XML upload'));
        xhr.send(file);
      });
    }

    const response = await fetch(`${BASE_URL}/import/apple/xml?filename=${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers,
      body: file,
    });

    if (!response.ok) {
      const errText = await response.text();
      let errJson;
      try { errJson = JSON.parse(errText); } catch { errJson = { message: errText }; }
      throw new Error(errJson?.error?.message || errJson?.message || `HTTP error ${response.status}`);
    }

    return response.json();
  },
};

// ── Capturing Steps and Health Data Helpers ─────────────────────────────────────
export async function getSteps(startDate, endDate, resolution = 'daily') {
  const data = await wearableApi.getTimeseries({
    start_time: new Date(startDate).toISOString(),
    end_time: new Date(endDate).toISOString(),
    types: 'steps',
    resolution, // 'daily', 'hourly', or 'raw'
  });
  return data?.data || data?.items || data || [];
}

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

// ── Connect OAuth Provider via Secure Popup Flow ──────────────────────────────
export async function connectOAuthProvider(brand) {
  const redirectUrl = `${window.location.origin}/wearables/callback`;
  const session = await wearableApi.createConnectSession(brand, redirectUrl);

  if (!session?.connectUrl) {
    throw new Error(`No authorization URL returned for provider ${brand}`);
  }

  const popup = window.open(
    session.connectUrl,
    'WearableAuth',
    'width=600,height=750,left=150,top=100,menubar=no,toolbar=no'
  );

  return new Promise((resolve, reject) => {
    let checkClosed = null;

    function cleanup() {
      if (checkClosed) clearInterval(checkClosed);
      window.removeEventListener('message', handleMessage);
    }

    function handleMessage(e) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'WEARABLE_AUTH_SUCCESS') {
        cleanup();
        if (popup && !popup.closed) popup.close();
        resolve(e.data);
      } else if (e.data?.type === 'WEARABLE_AUTH_ERROR') {
        cleanup();
        if (popup && !popup.closed) popup.close();
        reject(new Error(e.data?.message || 'Wearable authorization failed'));
      }
    }

    window.addEventListener('message', handleMessage);

    checkClosed = setInterval(() => {
      if (!popup || popup.closed) {
        cleanup();
        resolve({ type: 'WEARABLE_AUTH_CLOSED', provider: brand });
      }
    }, 1000);
  });
}
