export const VALID_OPEN_WEARABLES_PROVIDERS = new Set([
  'apple', 'samsung', 'garmin', 'health_connect', 'google_health',
  'polar', 'suunto', 'whoop', 'strava', 'oura', 'fitbit',
  'ultrahuman', 'sensorbio', 'withings', 'unknown', 'internal'
]);

export function normalizeToOpenWearables(provider) {
  if (!provider) return null;
  const p = String(provider).trim().toLowerCase();
  if (['apple', 'apple_health', 'apple_watch', 'apple_health_sdk'].includes(p)) return 'apple';
  if (['samsung', 'samsung_health'].includes(p)) return 'samsung';
  if (['health_connect', 'google_health_connect'].includes(p)) return 'health_connect';
  if (['google_health', 'google_fit', 'google'].includes(p)) return 'google_health';
  if (VALID_OPEN_WEARABLES_PROVIDERS.has(p)) return p;
  return null;
}

export class OpenWearablesClient {
  constructor({
    baseUrl = process.env.OPEN_WEARABLES_BASE_URL || 'https://api.openwearables.io',
    apiKey = process.env.OPEN_WEARABLES_API_KEY || null,
    appId = process.env.OPEN_WEARABLES_APP_ID || null,
    appSecret = process.env.OPEN_WEARABLES_APP_SECRET || null,
    mobileBaseUrl = process.env.OPEN_WEARABLES_MOBILE_BASE_URL || null,
    fetchFn = null,
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.appId = appId;
    this.appSecret = appSecret;
    this.mobileBaseUrl = mobileBaseUrl;
    this.fetchFn = fetchFn || globalThis.fetch.bind(globalThis);
    this.timeoutMs = 10_000;
    this.circuitBreaker = {
      state: 'CLOSED',
      failures: 0,
      failureThreshold: 5,
      lastFailureTime: 0,
      resetTimeoutMs: 30_000,
    };
  }

  get circuitOpen() {
    return this.circuitBreaker.state === 'OPEN';
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async createUser({ email, externalUserId, firstName = null, lastName = null } = {}) {
    return this.request('/api/v1/users', {
      method: 'POST',
      body: {
        email,
        external_user_id: externalUserId,
        first_name: firstName,
        last_name: lastName,
      },
    });
  }

  async findOrCreateUser({ email, externalUserId, firstName = null, lastName = null } = {}) {
    const searchTerm = externalUserId || email;
    if (searchTerm) {
      const found = await this.listUsers({ search: searchTerm });
      const list = found?.items || found?.data || (Array.isArray(found) ? found : []);
      const existing = list.find((u) => (externalUserId && u.external_user_id === externalUserId) || (email && u.email === email));
      if (existing) return existing;
    }
    try {
      return await this.createUser({ email, externalUserId, firstName, lastName });
    } catch (err) {
      if (err.status === 409 && searchTerm) {
        const found = await this.listUsers({ search: searchTerm });
        const list = found?.items || found?.data || (Array.isArray(found) ? found : []);
        const existing = list.find((u) => (externalUserId && u.external_user_id === externalUserId) || (email && u.email === email));
        if (existing) return existing;
      }
      throw err;
    }
  }

  async getUser(userId) {
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}`);
  }

  async createSdkUserToken(userId) {
    if (!this.appId || !this.appSecret) {
      const error = new Error('OpenWearables SDK application credentials are not configured on the backend.');
      error.status = 503;
      error.code = 'open_wearables_sdk_unconfigured';
      throw error;
    }
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/token`, {
      method: 'POST',
      body: { app_id: this.appId, app_secret: this.appSecret },
    });
  }

  async listUsers({ page = 1, limit = 20, search } = {}) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('search', search);
    return this.request(`/api/v1/users?${params}`);
  }

  async updateUser(userId, data = {}) {
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async deleteUser(userId) {
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
  }

  async getProviderAuthorizationUrl(userId, provider, redirectUri) {
    const owProvider = normalizeToOpenWearables(provider) || provider.toLowerCase();
    const params = new URLSearchParams({ user_id: userId });
    if (redirectUri) params.set('redirect_uri', redirectUri);

    return this.request(`/api/v1/oauth/${encodeURIComponent(owProvider)}/authorize?${params}`);
  }

  async listProviders({ enabledOnly = true } = {}) {
    const params = new URLSearchParams();
    if (enabledOnly) params.set('enabled_only', 'true');
    const query = params.toString() ? `?${params}` : '';
    return this.request(`/api/v1/oauth/providers${query}`);
  }

  async getConnections(userId) {
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/connections`);
  }

  async disconnectProvider(userId, provider) {
    const owProvider = normalizeToOpenWearables(provider);
    if (!owProvider) {
      return { status: 'skipped', message: `Provider ${provider} is not managed by OpenWearables.` };
    }
    return this.request(
      `/api/v1/users/${encodeURIComponent(userId)}/connections/${encodeURIComponent(owProvider)}`,
      { method: 'DELETE' },
    );
  }

  async deleteProviderData(userId, provider) {
    const owProvider = normalizeToOpenWearables(provider);
    if (!owProvider) return { status: 'skipped' };
    return this.request(
      `/api/v1/users/${encodeURIComponent(userId)}/connections/${encodeURIComponent(owProvider)}/data`,
      { method: 'DELETE' },
    );
  }

  async syncUserData(userId, provider, options = {}) {
    const owProvider = normalizeToOpenWearables(provider);
    if (!owProvider) {
      return { status: 'skipped', message: `Provider ${provider} is not managed by OpenWearables.` };
    }
    const params = new URLSearchParams();
    if (options.startTime) params.set('summary_start_time', options.startTime);
    if (options.endTime) params.set('summary_end_time', options.endTime);
    if (options.dataType) params.set('data_type', options.dataType);
    if (options.samples !== undefined) params.set('samples', String(options.samples));
    if (options.zones !== undefined) params.set('zones', String(options.zones));
    if (options.route !== undefined) params.set('route', String(options.route));
    if (options.since !== undefined) params.set('since', String(options.since));
    if (options.limit !== undefined) params.set('limit', String(options.limit));

    const query = params.toString() ? `?${params}` : '';
    return this.request(
      `/api/v1/providers/${encodeURIComponent(owProvider)}/users/${encodeURIComponent(userId)}/sync${query}`,
      { method: 'POST' },
    );
  }

  async syncHistoricalData(userId, provider = 'garmin') {
    const owProvider = normalizeToOpenWearables(provider) || provider.toLowerCase();
    return this.request(
      `/api/v1/providers/${encodeURIComponent(owProvider)}/users/${encodeURIComponent(userId)}/sync/historical`,
      { method: 'POST' },
    );
  }

  async syncSdkData(userId, payload) {
    return this.request(
      `/api/v1/sdk/users/${encodeURIComponent(userId)}/sync`,
      {
        method: 'POST',
        body: payload,
      },
    );
  }

  // getTimeseries is defined below with full options support

  async getWorkouts(userId, startDate, endDate, options = {}) {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/events/workouts?${params}`);
  }

  async getSleepSessions(userId, startDate, endDate, options = {}) {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/events/sleep?${params}`);
  }

  async getMenstrualCycles(userId, startDate, endDate, options = {}) {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/events/menstrual-cycles?${params}`);
  }

  async getActivitySummary(userId, startDate, endDate, options = {}) {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/summaries/activity?${params}`);
  }

  async getSleepSummary(userId, startDate, endDate, options = {}) {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/summaries/sleep?${params}`);
  }

  async getRecoverySummary(userId, startDate, endDate, options = {}) {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/summaries/recovery?${params}`);
  }

  async getTimeseries(userId, startTime, endTime, options = {}) {
    const params = new URLSearchParams({ start_time: startTime, end_time: endTime });
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.resolution) params.set('resolution', options.resolution);
    if (options.provider) params.set('provider', options.provider);
    if (Array.isArray(options.types) && options.types.length) {
      for (const t of options.types) {
        params.append('types', t);
      }
    }
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/timeseries?${params}`);
  }

  async getBodySummary(userId, options = {}) {
    const params = new URLSearchParams();
    if (options.averagePeriod || options.average_period) {
      params.set('average_period', String(options.averagePeriod || options.average_period));
    }
    if (options.latestWindowHours || options.latest_window_hours) {
      params.set('latest_window_hours', String(options.latestWindowHours || options.latest_window_hours));
    }
    const query = params.toString() ? `?${params}` : '';
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/summaries/body${query}`);
  }

  async getDataSummary(userId, startDate, endDate, options = {}) {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (options.limit) params.set('limit', String(options.limit));
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/summaries/data?${params}`);
  }

  async listWebhookEndpoints() {
    return this.request('/api/v1/webhooks/endpoints');
  }

  async createWebhookEndpoint({ url, description, filterTypes = null, userId = null } = {}) {
    const body = { url };
    if (description) body.description = description;
    if (filterTypes !== undefined) body.filter_types = filterTypes;
    if (userId !== undefined) body.user_id = userId;

    return this.request('/api/v1/webhooks/endpoints', {
      method: 'POST',
      body,
    });
  }

  async getWebhookEndpoint(endpointId) {
    return this.request(`/api/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}`);
  }

  async updateWebhookEndpoint(endpointId, { url, description, filterTypes, userId } = {}) {
    const body = {};
    if (url !== undefined) body.url = url;
    if (description !== undefined) body.description = description;
    if (filterTypes !== undefined) body.filter_types = filterTypes;
    if (userId !== undefined) body.user_id = userId;

    return this.request(`/api/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}`, {
      method: 'PATCH',
      body,
    });
  }

  async deleteWebhookEndpoint(endpointId) {
    return this.request(`/api/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}`, {
      method: 'DELETE',
    });
  }

  async getWebhookEndpointSecret(endpointId) {
    return this.request(`/api/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}/secret`);
  }

  async listWebhookAttempts(endpointId) {
    return this.request(`/api/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}/attempts`);
  }

  async listWebhookMessages() {
    return this.request('/api/v1/webhooks/messages');
  }

  async sendWebhookTestEvent(endpointId, eventType = 'workout.created') {
    return this.request(`/api/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}/test`, {
      method: 'POST',
      body: { event_type: eventType },
    });
  }

  async listEventTypes() {
    return this.request('/api/v1/webhooks/event-types');
  }

  async listProviderSubscriptions(provider) {
    return this.request(`/api/v1/providers/${encodeURIComponent(provider.toLowerCase())}/webhooks/subscriptions`);
  }

  async registerProviderSubscription(provider, callbackUrl) {
    const params = new URLSearchParams({ callback_url: callbackUrl });
    return this.request(
      `/api/v1/providers/${encodeURIComponent(provider.toLowerCase())}/webhooks/subscriptions?${params}`,
      { method: 'POST' },
    );
  }

  async getProviderSubscription(provider, subscriptionId) {
    return this.request(
      `/api/v1/providers/${encodeURIComponent(provider.toLowerCase())}/webhooks/subscriptions/${encodeURIComponent(subscriptionId)}`,
    );
  }

  async updateProviderSubscription(provider, subscriptionId, callbackUrl) {
    const params = new URLSearchParams({ callback_url: callbackUrl });
    return this.request(
      `/api/v1/providers/${encodeURIComponent(provider.toLowerCase())}/webhooks/subscriptions/${encodeURIComponent(subscriptionId)}?${params}`,
      { method: 'PUT' },
    );
  }

  async deleteProviderSubscription(provider, subscriptionId) {
    return this.request(
      `/api/v1/providers/${encodeURIComponent(provider.toLowerCase())}/webhooks/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { method: 'DELETE' },
    );
  }

  async renewProviderSubscriptions(provider = 'oura') {
    return this.request(
      `/api/v1/providers/${encodeURIComponent(provider.toLowerCase())}/webhooks/subscriptions/renew`,
      { method: 'POST' },
    );
  }

  getSyncStreamUrl(userId, replay = 20) {
    return `${this.baseUrl}/api/v1/users/${encodeURIComponent(userId)}/sync/stream?replay=${encodeURIComponent(replay)}`;
  }

  async getSyncRecent(userId, limit = 50) {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/sync/recent?limit=${safeLimit}`);
  }

  async getSyncRuns(userId, limit = 20) {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/sync/runs?limit=${safeLimit}`);
  }

  /**
   * Fetch health/readiness scores (Whoop recovery, Oura readiness, etc.)
   * Uses the /summaries/health-scores endpoint if available.
   */
  async getHealthScores(userId, startDate, endDate, options = {}) {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.provider) params.set('provider', options.provider);
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/summaries/health-scores?${params}`);
  }

  /**
   * Fetch generic activity sessions (not workouts).
   */
  async getActivities(userId, startDate, endDate, options = {}) {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/events/activities?${params}`);
  }

  async requestAppleXmlS3Presigned(userId, { filename = 'export.xml', expirationSeconds = 300, maxFileSize = 52428800 } = {}) {
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/import/apple/xml/s3`, {
      method: 'POST',
      body: {
        filename,
        expiration_seconds: expirationSeconds,
        max_file_size: maxFileSize,
      },
    });
  }

  async createAppleXmlMultipart(userId, { filename, contentType = 'application/xml', fileSize }) {
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/import/apple/xml/s3/multipart/create`, {
      method: 'POST',
      body: {
        filename,
        content_type: contentType,
        file_size: fileSize,
      },
    });
  }

  async signAppleXmlMultipart(userId, { key, uploadId, partNumbers }) {
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/import/apple/xml/s3/multipart/sign`, {
      method: 'POST',
      body: {
        key,
        upload_id: uploadId,
        part_numbers: partNumbers,
      },
    });
  }

  async completeAppleXmlMultipart(userId, { key, uploadId, parts }) {
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/import/apple/xml/s3/multipart/complete`, {
      method: 'POST',
      body: {
        key,
        upload_id: uploadId,
        parts,
      },
    });
  }

  async uploadAppleXmlDirect(userId, fileBuffer, filename = 'export.xml') {
    if (typeof FormData !== 'undefined') {
      const formData = new FormData();
      const payload = typeof Blob !== 'undefined'
        ? new Blob([fileBuffer], { type: 'application/xml' })
        : fileBuffer;
      formData.append('file', payload, filename);
      return this.request(`/api/v1/users/${encodeURIComponent(userId)}/import/apple/xml/direct`, {
        method: 'POST',
        body: formData,
      });
    }

    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/import/apple/xml/direct`, {
      method: 'POST',
      body: fileBuffer,
      headers: {
        'Content-Type': 'application/xml',
        'X-Filename': filename,
      },
    });
  }

  async abortAppleXmlMultipart(userId, { key, uploadId }) {
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/import/apple/xml/s3/multipart/abort`, {
      method: 'POST',
      body: {
        key,
        upload_id: uploadId,
      },
    });
  }

  async getSyncHistory(userId, options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    const query = params.toString() ? `?${params}` : '';
    return this.request(`/api/v1/users/${encodeURIComponent(userId)}/sync/history${query}`);
  }

  async getSyncRunByKey(runKey) {
    return this.request(`/api/v1/sync/history/${encodeURIComponent(runKey)}`);
  }

  async request(path, { method = 'GET', body = null, headers = {} } = {}) {
    if (this.circuitBreaker.state === 'OPEN') {
      if (Date.now() - this.circuitBreaker.lastFailureTime > this.circuitBreaker.resetTimeoutMs) {
        this.circuitBreaker.state = 'HALF_OPEN';
        this.circuitBreaker.probing = false;
      } else {
        const error = new Error('Open Wearables circuit breaker is OPEN (service temporarily unavailable)');
        error.status = 503;
        error.code = 'circuit_breaker_open';
        throw error;
      }
    }

    if (this.circuitBreaker.state === 'HALF_OPEN') {
      if (this.circuitBreaker.probing) {
        const error = new Error('Open Wearables circuit breaker is HALF_OPEN (probe in flight)');
        error.status = 503;
        error.code = 'circuit_breaker_open';
        throw error;
      }
      this.circuitBreaker.probing = true;
    }

    const url = `${this.baseUrl}${path}`;
    const reqHeaders = { ...headers };
    let reqBody = null;

    if (body != null) {
      const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
      const isBinary = (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) ||
        (typeof Uint8Array !== 'undefined' && body instanceof Uint8Array) ||
        (typeof Blob !== 'undefined' && body instanceof Blob);

      if (isFormData) {
        delete reqHeaders['Content-Type'];
        reqBody = body;
      } else if (isBinary) {
        if (!reqHeaders['Content-Type']) {
          reqHeaders['Content-Type'] = 'application/octet-stream';
        }
        reqBody = body;
      } else if (typeof body === 'string') {
        if (!reqHeaders['Content-Type']) {
          reqHeaders['Content-Type'] = 'application/json';
        }
        reqBody = body;
      } else {
        if (!reqHeaders['Content-Type']) {
          reqHeaders['Content-Type'] = 'application/json';
        }
        reqBody = JSON.stringify(body);
      }
    }

    if (this.apiKey) {
      reqHeaders['X-Open-Wearables-API-Key'] = this.apiKey;
    }

    const maxRetries = method === 'GET' ? 3 : 0;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const signal = typeof AbortSignal.timeout === 'function'
          ? AbortSignal.timeout(this.timeoutMs)
          : undefined;

        const response = await this.fetchFn(url, {
          method,
          headers: reqHeaders,
          body: reqBody,
          signal,
        });

        if (!response.ok) {
          if (attempt < maxRetries && (response.status === 429 || response.status >= 500)) {
            attempt++;
            const backoffMs = Math.pow(2, attempt) * 150 + Math.random() * 100;
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }

          const errorText = await response.text();
          let errorJson;
          try {
            errorJson = JSON.parse(errorText);
          } catch {
            errorJson = { message: errorText };
          }

          const error = new Error(
            `Open Wearables API error [${response.status}]: ${errorJson.detail || errorJson.message || response.statusText}`,
          );
          error.status = response.status;
          error.details = errorJson;

          throw error;
        }

        if (this.circuitBreaker.state === 'HALF_OPEN' || this.circuitBreaker.failures > 0) {
          this.circuitBreaker.state = 'CLOSED';
          this.circuitBreaker.failures = 0;
          this.circuitBreaker.probing = false;
        }

        if (response.status === 204) return null;
        return response.json();
      } catch (err) {
        if (err.status && err.status < 500 && err.status !== 429) {
          throw err;
        }

        if (attempt < maxRetries) {
          attempt++;
          const backoffMs = Math.pow(2, attempt) * 150 + Math.random() * 100;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        this.#recordFailure();
        throw err;
      }
    }
  }

  #recordFailure() {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();
    this.circuitBreaker.probing = false;
    if (this.circuitBreaker.failures >= this.circuitBreaker.failureThreshold || this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'OPEN';
    }
  }
}
