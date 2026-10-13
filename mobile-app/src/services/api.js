// Comprehensive API Client for Wellness & MediBot Health Platform
// Connects seamlessly to backend at http://localhost:4000 (via Vite proxy or direct URL)
import { toNative } from '../native/nativeBridge';

const BASE_URL = ''; // Relative path uses Vite proxy to localhost:4000

function getAuthToken() {
  return localStorage.getItem('wellness_token') || '';
}

async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }
  if (!response.ok) {
    const errorMsg = data?.error?.message || data?.message || `HTTP error ${response.status}`;
    const lowerMsg = String(errorMsg).toLowerCase();
    const isInactiveOrDeleted = response.status === 401 || 
      (response.status === 403 && (lowerMsg.includes('deleted') || lowerMsg.includes('inactive') || data?.error?.code === 'member_inactive')) ||
      (response.status === 404 && lowerMsg.includes('user not found'));
    
    // Auto-clean zombie session if user was deleted or token expired
    if (isInactiveOrDeleted && !endpoint.startsWith('/phone/')) {
      try {
        localStorage.removeItem('wellness_token');
        localStorage.removeItem('wellness_member');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:expired', { detail: { message: errorMsg } }));
        }
      } catch {}
    }

    const err = new Error(errorMsg);
    err.status = response.status;
    err.details = data?.error?.details || data;
    throw err;
  }

  return data;
}

export const api = {
  // ── Generic HTTP Methods ──
  post: (endpoint, body, options = {}) =>
    request(endpoint, {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      ...options,
    }),

  get: (endpoint, options = {}) =>
    request(endpoint, {
      method: 'GET',
      ...options,
    }),

  uploadHealthSamples: (samples) =>
    request('/v1/me/phone-health/sync', {
      method: 'POST',
      body: JSON.stringify(Array.isArray(samples) ? { samples } : samples),
    }),

  // ── 1. Phone Authentication ──
  sendOtp: (phone, channel = 'sms') => 
    request('/phone/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, channel }),
    }),

  verifyOtp: (phone, code, profile = {}) =>
    request('/phone/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code, ...profile }),
    }),

  // ── 2. Member Profile & Health ──
  getProfile: () => request('/v1/me/profile'),

  updateProfile: (data) =>
    request('/v1/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getDailySummary: () => request('/v1/me/daily-summary'),

  getProfileHistory: () => request('/v1/me/profile/history'),

  getWeightProgress: () => request('/v1/me/profile/weight-progress'),

  recordMemberConsent: (type = 'health_data', granted = true, version = '1.0') =>
    request('/v1/me/consents', {
      method: 'POST',
      body: JSON.stringify({ type, granted, version }),
    }),
  getMemberConsent: (type = 'health_data') => request(`/v1/me/consents/${type}`),

  getPhoneHealthConnection: () => request('/v1/me/phone-health/connection'),

  updatePhoneHealthConnection: (data = {}) =>
    request('/v1/me/phone-health/connection', {
      method: 'PUT',
      body: JSON.stringify({
        provider: 'apple_health',
        platform: 'ios',
        permissions: ['steps', 'heart_rate', 'sleep', 'hydration', 'blood_glucose', 'blood_pressure_systolic', 'spo2', 'temperature', 'weight'],
        status: 'connected',
        ...data,
      }),
    }),

  syncPhoneHealth: (samples) =>
    request('/v1/me/phone-health/sync', {
      method: 'POST',
      body: JSON.stringify(Array.isArray(samples) ? { samples } : samples),
    }),
  logManualHealthSamples: (samples) =>
    request('/v1/me/health/manual', {
      method: 'POST',
      body: JSON.stringify({ samples }),
    }),

  deleteAccount: () => request('/v1/me', { method: 'DELETE' }),

  // ── OpenWearables Provider Integration ──
  getWearableProviders: () => request('/v1/wearables/providers'),
  getWearableConnections: () => request('/v1/wearables/connections'),
  createWearableConnectSession: (brand, redirectUrl) =>
    request('/v1/wearables/connect-session', {
      method: 'POST',
      body: JSON.stringify({ brand, redirectUrl }),
    }),
  connectWearableProvider: (provider, options = {}) =>
    request(`/v1/wearables/connections/${encodeURIComponent(provider)}/connect`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),
  syncWearableProvider: (provider, options = {}) =>
    request(`/v1/wearables/connections/${encodeURIComponent(provider)}/sync`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),
  disconnectWearableProvider: (provider) =>
    request(`/v1/wearables/connections/${encodeURIComponent(provider)}`, {
      method: 'DELETE',
    }),
  disconnectAllWearableProviders: () =>
    request('/v1/wearables/connections', {
      method: 'DELETE',
    }),
  getWearableDevices: () => request('/v1/wearables/devices'),

  // ── 3. Clinical Consents ──
  setGlobalConsent: (scope = 'global', granted = true, version = '1.0') =>
    request('/medibot/consents', {
      method: 'POST',
      body: JSON.stringify({ scope, granted, version }),
    }),

  setScopedConsent: (scope, granted = true) =>
    request(`/medibot/consents/${scope}`, {
      method: 'POST',
      body: JSON.stringify({ granted }),
    }),

  getScopedConsent: (scope) => request(`/medibot/consents/${scope}`),

  // ── 4. Clinical Documents & OCR Vault ──
  uploadDocument: (file, docType = 'prescription') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('docType', docType);
    return request('/medibot/documents', {
      method: 'POST',
      body: formData,
    });
  },

  listDocuments: () => request('/medibot/documents'),

  getDocument: (id) => request(`/medibot/documents/${id}`),

  commitDocumentFields: (id, fieldIds = []) =>
    request(`/medibot/documents/${id}/commit`, {
      method: 'POST',
      body: JSON.stringify({ fieldIds }),
    }),

  // ── 5. Clinical Encounters ──
  createEncounter: ({ intent = 'symptom', riskLevel = 'low', chiefComplaint, symptoms = [] }) =>
    request('/medibot/encounters', {
      method: 'POST',
      body: JSON.stringify({ intent, riskLevel, chiefComplaint, symptoms }),
    }),

  listEncounters: () => request('/medibot/encounters'),

  getEncounter: (id) => request(`/medibot/encounters/${id}`),

  postEncounterMessage: (id, role = 'patient', content, meta = {}) =>
    request(`/medibot/encounters/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ role, content, meta }),
    }),

  updateEncounterStatus: (id, data) =>
    request(`/medibot/encounters/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getSymptomState: (id) => request(`/medibot/encounters/${id}/symptom-state`),

  updateSymptomState: (id, data) =>
    request(`/medibot/encounters/${id}/symptom-state`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // ── 6. MediBot AI Clinical Services ──
  chatTriage: (message, encounterId = null, model = 'gemini') =>
    request('/medibot/chat', {
      method: 'POST',
      body: JSON.stringify({ message, ...(encounterId ? { encounterId } : {}), model }),
    }),

  chatTriageStream: async ({ message, encounterId = null, model = 'gemini', onProgress, onComplete, onError }) => {
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(`${BASE_URL}/medibot/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message, encounterId, model, stream: true }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep last incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            try {
              const payload = JSON.parse(trimmed.slice(5).trim());
              if (payload.event === 'progress' && onProgress) {
                onProgress(payload.message);
              } else if (payload.event === 'complete' && onComplete) {
                onComplete(payload.data);
              } else if (payload.event === 'error' && onError) {
                onError(new Error(payload.message));
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      if (onError) onError(err);
      else throw err;
    }
  },

  submitChatFeedback: ({ messageId, encounterId = null, rating, feedbackText = null, tags = [] }) => {
    const normalizedRating = (rating === 1 || rating === 'thumbs_up' || rating === 'up') ? 'thumbs_up' : 'thumbs_down';
    return request('/medibot/chat/feedback', {
      method: 'POST',
      body: JSON.stringify({ messageId, encounterId, rating: normalizedRating, feedbackText, tags }),
    });
  },

  summarizeChat: (encounterId) =>
    request('/medibot/chat/summarize', {
      method: 'POST',
      body: JSON.stringify({ encounterId }),
    }),

  ragQuery: (query, limit = 5) =>
    request('/medibot/rag', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    }),

  validateDrugRules: (medication, patientAllergies = [], existingConditions = []) =>
    request('/medibot/rules/validate', {
      method: 'POST',
      body: JSON.stringify({
        medication,
        drug: medication,
        patientAllergies,
        existingConditions,
      }),
    }),

  getMediBotStatus: () => request('/medibot/status'),

  // ── 7. Patient 360 & Longitudinal Records ──
  getPatientChart: (patientId) => request(`/medibot/patients/${patientId}`),

  updatePatientProfile: (patientId, data) =>
    request(`/medibot/patients/${patientId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getAllergies: (patientId) => request(`/medibot/patients/${patientId}/allergies`),

  recordAllergy: (patientId, data) =>
    request(`/medibot/patients/${patientId}/allergies`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getConditions: (patientId) => request(`/medibot/patients/${patientId}/conditions`),

  recordCondition: (patientId, data) =>
    request(`/medibot/patients/${patientId}/conditions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getClinicalContext: (patientId) => request(`/medibot/patients/${patientId}/context`),

  getLabs: (patientId) => request(`/medibot/patients/${patientId}/labs`),

  recordLab: (patientId, data) =>
    request(`/medibot/patients/${patientId}/labs`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMedications: (patientId) => request(`/medibot/patients/${patientId}/medications`),

  recordMedication: (patientId, data) =>
    request(`/medibot/patients/${patientId}/medications`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getTimeline: (patientId) => request(`/medibot/patients/${patientId}/timeline`),

  getProactiveInsights: (patientId = 'me') => request(`/medibot/patients/${patientId}/proactive-insights`),

  // Health Summary PDF Generation & Download
  getHealthSummaryPdfUrl: (patientId = 'me') => {
    const safePid = (!patientId || patientId === 'undefined' || patientId === 'null') ? 'me' : patientId;
    const token = getAuthToken();
    const origin = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : '';
    const prefix = BASE_URL || origin;
    return `${prefix}/medibot/patients/${safePid}/summary-pdf${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  downloadHealthSummaryPdf: async (patientId = 'me') => {
    const safePid = (!patientId || patientId === 'undefined' || patientId === 'null') ? 'me' : patientId;
    const token = getAuthToken();
    const origin = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : '';
    const directUrl = `${origin}${BASE_URL}/medibot/patients/${safePid}/summary-pdf${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    
    // Safety abort timeout of 20 seconds so download state never hangs indefinitely
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    // If running inside React Native WebView (Expo app), notify native shell to invoke Linking.openURL
    if (typeof window !== 'undefined' && (window.ReactNativeWebView || window.__IS_NATIVE_APP__)) {
      toNative('DOWNLOAD_PDF', { url: directUrl, filename: 'Patient_Health_Summary.pdf' });
    }

    try {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BASE_URL}/medibot/patients/${safePid}/summary-pdf`, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        let errBody = '';
        try { errBody = await res.text(); } catch (_) {}
        throw new Error(`Server returned status ${res.status}: ${errBody || 'Unable to generate PDF'}`);
      }

      const blobData = await res.blob();
      const contentDisposition = res.headers.get('content-disposition') || '';
      let filename = 'Patient_Health_Summary.pdf';
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }

      const pdfBlob = new Blob([blobData], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(pdfBlob);

      // Trigger standard browser download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        try {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        } catch (_) {}
      }, 5000);

      return { success: true, filename, directUrl, blobUrl };
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('Direct blob fetch failed or timed out, trying direct browser open:', err);

      // Mobile or fallback: attempt opening direct URL
      const link = document.createElement('a');
      link.href = directUrl;
      link.download = 'Patient_Health_Summary.pdf';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try { document.body.removeChild(link); } catch (_) {}
      }, 3000);

      if (err.name === 'AbortError') {
        throw new Error('Download timed out after 20 seconds. Please try the direct link or check server connection.');
      }
      throw err;
    }
  },

  // Phone health sample sync
  getSystemHealth: () => request('/health'),
};
