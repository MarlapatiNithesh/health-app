import { ApplicationError } from '../errors/application-error.js';
import { OpenWearablesClient } from '../integrations/open-wearables-client.js';
import { logger } from '../logger.js';
import {
  PROVIDER_CAPABILITIES,
  getProviderConfig,
  isOauthProvider,
  isManualProvider,
  listSupportedProviders,
} from '../domain/providers.js';
import { METRIC_DEFINITIONS } from '../domain/metrics.js';

export const WEARABLE_BRANDS = Object.keys(PROVIDER_CAPABILITIES);

export const WEARABLE_METRICS = [
  'steps',
  'heart_rate',
  'hrv',
  'spo2',
  'sleep',
  'stress',
  'temperature',
  'workout',
  'weight',
  'respiratory_rate',
  'blood_glucose',
  'calories',
];

export const OPEN_WEARABLES_DATA_TYPES = ['timeseries', 'workout', 'sleep', 'womens_health', 'health_scores'];

function validateRedirectUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const isDeepLink = parsed.protocol && !['http:', 'https:'].includes(parsed.protocol);
    if (isDeepLink) {
      return url;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Invalid protocol');
    }
    const allowlistEnv = process.env.REDIRECT_ALLOWLIST || process.env.OPEN_WEARABLES_REDIRECT_URL;
    if (allowlistEnv && process.env.NODE_ENV === 'production') {
      const allowedUrls = allowlistEnv.split(',').map((u) => u.trim());
      const isAllowed = allowedUrls.some((allowed) => url === allowed || url.startsWith(allowed));
      if (!isAllowed) {
        throw new Error('Redirect URL not in allowlist');
      }
    }
    return url;
  } catch (err) {
    throw new ApplicationError(
      `Invalid redirectUrl: ${err.message}`,
      422,
      'validation_error',
      [{ field: 'redirectUrl', message: err.message }],
    );
  }
}

export class WearableService {
  constructor(wearableRepo, memberRepo = null, openWearablesClient = new OpenWearablesClient(), openWearablesRepo = null) {
    if (wearableRepo && typeof wearableRepo === 'object' && wearableRepo.wearableRepo) {
      this.wearableRepo = wearableRepo.wearableRepo;
      this.openWearablesRepo = wearableRepo.openWearablesRepo || wearableRepo.wearableRepo;
      this.owRepo = this.openWearablesRepo;
      this.memberRepo = wearableRepo.memberRepo;
      this.openWearables = memberRepo?.openWearablesClient || wearableRepo.openWearablesClient || openWearablesClient;
    } else {
      this.wearableRepo = wearableRepo;
      this.openWearablesRepo = openWearablesRepo || wearableRepo;
      this.owRepo = this.openWearablesRepo;
      this.memberRepo = memberRepo;
      this.openWearables = openWearablesClient;
    }
  }

  async getOrCreateOwUserId(memberId) {
    if (this.memberRepo?.getOwUserId) {
      const existing = await this.memberRepo.getOwUserId(memberId);
      if (existing) return existing;
    }

    if (!this.openWearables || !this.openWearables.isConfigured()) {
      return null;
    }

    const member = await this.requireMember(memberId);
    if ((process.env.NODE_ENV === 'production' || process.env.ENFORCE_CONSENT === 'true') &&
        !member.healthConsentAt && !member.health_consent_at) {
      throw new ApplicationError(
        'Health data consent is required before connecting wearables.',
        403,
        'consent_required',
      );
    }

    const pool = this.memberRepo?.pool || this.wearableRepo?.pool;
    if (pool?.connect) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [memberId]);
        const check = await client.query('SELECT ow_user_id AS "owUserId" FROM members WHERE id = $1', [memberId]);
        if (check.rows[0]?.owUserId) {
          await client.query('COMMIT');
          return check.rows[0].owUserId;
        }

        const owUser = await this.openWearables.findOrCreateUser({
          email: `${member.id}@phone.health`,
          externalUserId: member.id,
          firstName: member.profile?.fullName ? member.profile.fullName.split(' ')[0] : 'Member',
        });

        if (owUser?.id) {
          const updateRes = await client.query(
            `UPDATE members
             SET ow_user_id = $2, updated_at = now()
             WHERE id = $1 AND (ow_user_id IS NULL OR ow_user_id = $2)
             RETURNING ow_user_id AS "owUserId"`,
            [memberId, owUser.id],
          );
          if (updateRes.rows.length === 0) {
            try {
              await this.openWearables.deleteUser(owUser.id);
            } catch (err) {
              logger.warn('Failed to clean up orphaned remote Open Wearables user', { err: err.message, owUserId: owUser.id });
            }
            const latest = await client.query('SELECT ow_user_id AS "owUserId" FROM members WHERE id = $1', [memberId]);
            await client.query('COMMIT');
            return latest.rows[0]?.owUserId || owUser.id;
          }
          await client.query('COMMIT');
          return owUser.id;
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        if (err.status === 401 || err.status === 403) {
          throw new ApplicationError(`Open Wearables auth error: ${err.message}`, 401, 'open_wearables_unauthorized');
        }
        throw new ApplicationError(`Failed to resolve Open Wearables user: ${err.message}`, 502, 'open_wearables_error');
      } finally {
        client.release();
      }
    } else {
      const owUser = await this.openWearables.findOrCreateUser({
        email: `${member.id}@phone.health`,
        externalUserId: member.id,
        firstName: member.profile?.fullName ? member.profile.fullName.split(' ')[0] : 'Member',
      });
      if (owUser?.id) {
        if (this.memberRepo?.setOwUserId) {
          const updated = await this.memberRepo.setOwUserId(member.id, owUser.id);
          if (!updated) {
            try {
              await this.openWearables.deleteUser(owUser.id);
            } catch (err) {
              logger.warn('Failed to delete redundant remote Open Wearables user', { err: err.message, owUserId: owUser.id });
            }
            return (await this.memberRepo.getOwUserId(member.id)) || owUser.id;
          }
        }
        return owUser.id;
      }
    }

    return null;
  }

  async listProviders() {
    const supported = listSupportedProviders();
    if (this.openWearables && this.openWearables.isConfigured()) {
      try {
        const result = await this.openWearables.listProviders({ enabledOnly: true });
        const remoteList = Array.isArray(result) ? result : (result?.data || []);
        if (remoteList.length > 0) {
          const remoteMap = new Map(remoteList.map((p) => [(p.provider || p.name || '').toLowerCase(), p]));
          return supported.map((s) => ({
            ...s,
            isEnabled: remoteMap.has(s.provider) ? Boolean(remoteMap.get(s.provider).is_enabled ?? true) : true,
          }));
        }
      } catch (err) {
        logger.warn('Failed to fetch remote providers from Open Wearables, using defaults', { err: err.message });
      }
    }
    return supported.map((s) => ({
      ...s,
      isEnabled: true,
    }));
  }

  async generateConnectSession(memberId, brand, redirectUrl) {
    const member = await this.requireMember(memberId);
    if ((process.env.NODE_ENV === 'production' || process.env.ENFORCE_CONSENT === 'true') &&
        !member.healthConsentAt && !member.health_consent_at) {
      throw new ApplicationError(
        'Health data consent is required before connecting wearables.',
        403,
        'consent_required',
      );
    }

    const config = getProviderConfig(brand);
    if (!config) {
      throw new ApplicationError(
        `Unsupported wearable brand: ${brand}.`,
        422,
        'validation_error',
        [{ field: 'brand', message: `Must be a supported provider.` }],
      );
    }

    if (!isOauthProvider(brand)) {
      const flowMsg = config.type === 'phone_sdk'
        ? `Provider ${brand} connects via phone SDK (${config.via}). Please use the mobile app integration flow.`
        : `Provider ${brand} is a manual entry provider. Please use manual device entry.`;
      throw new ApplicationError(
        flowMsg,
        422,
        'unsupported_connection_type',
        [{ field: 'brand', message: flowMsg }],
      );
    }

    const validRedirect = validateRedirectUrl(redirectUrl)
      || process.env.OPEN_WEARABLES_REDIRECT_URL
      || 'https://app.yourwellness.com/wearables/callback';

    let connectUrl;

    if (this.openWearables && this.openWearables.isConfigured()) {
      const owUserId = await this.getOrCreateOwUserId(memberId);
      if (!owUserId) {
        throw new ApplicationError('Failed to initialize Open Wearables user for connection', 502, 'open_wearables_error');
      }

      try {
        const authData = await this.openWearables.getProviderAuthorizationUrl(
          owUserId,
          brand,
          validRedirect,
        );
        connectUrl = authData?.authorization_url;
        if (!connectUrl || typeof connectUrl !== 'string') {
          throw new Error('Authorization URL was not returned by provider');
        }
        const parsedAuth = new URL(connectUrl);
        if (parsedAuth.protocol !== 'https:') {
          throw new Error('Authorization URL must use HTTPS');
        }
        const owBaseHost = new URL(this.openWearables.baseUrl || 'https://api.openwearables.io').host;
        if (!parsedAuth.host.includes('openwearables') && parsedAuth.host !== owBaseHost && !parsedAuth.host.includes('mockwearables')) {
          throw new Error('Authorization URL host does not match OpenWearables');
        }
      } catch (err) {
        throw new ApplicationError(
          `Failed to initiate Open Wearables connection for ${brand}: ${err.message}`,
          502,
          'open_wearables_error',
        );
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new ApplicationError('Open Wearables integration is not configured', 502, 'open_wearables_unconfigured');
      }
      const baseUrl = process.env.OPEN_WEARABLES_BASE_URL || 'https://connect.openwearables.com';
      connectUrl = `${baseUrl}/sandbox/${brand}?user_id=${encodeURIComponent(memberId)}&redirect_uri=${encodeURIComponent(validRedirect)}`;
    }

    const existing = (await this.wearableRepo.listWearableDevices(memberId)).find((d) => d.brand === brand);
    const isAlreadyConnected = existing?.status === 'connected' || existing?.status === 'syncing';
    const targetStatus = isAlreadyConnected ? existing.status : 'connecting';

    const link = await this.wearableRepo.upsertWearableLink(memberId, {
      provider: brand,
      connectionType: 'oauth',
      status: targetStatus,
    });

    return {
      deviceId: link.id,
      brand,
      status: targetStatus,
      connectUrl,
      instructions: `Open connectUrl in browser. Once authorized, Open Wearables will stream data for member ${memberId}.`,
    };
  }

  async triggerRemoteSync(memberId, provider, options = {}) {
    await this.requireMember(memberId);
    const config = getProviderConfig(provider);
    if (!config) {
      throw new ApplicationError(`Invalid provider: ${provider}`, 422, 'validation_error');
    }

    if (!this.openWearables || !this.openWearables.isConfigured()) {
      throw new ApplicationError('Open Wearables is not configured with an API key', 400, 'open_wearables_unconfigured');
    }

    const owUserId = await this.memberRepo?.getOwUserId?.(memberId);
    if (!owUserId) {
      return { status: 'skipped', message: `User has no remote connection for ${provider}.` };
    }

    try {
      if (provider.toLowerCase() === 'garmin' && options?.firstConnect) {
        return await this.openWearables.syncHistoricalData(owUserId, 'garmin');
      }
      return await this.openWearables.syncUserData(owUserId, provider, options);
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        throw new ApplicationError(`Open Wearables API auth error: ${error.message}`, 401, 'open_wearables_unauthorized');
      }
      if (error.status === 404) {
        return { status: 'skipped', message: `User has no remote connection for ${provider}.` };
      }
      throw error;
    }
  }

  async triggerSync(memberId, provider, options = {}) {
    return this.triggerRemoteSync(memberId, provider, options);
  }

  async getRemoteConnections(memberId) {
    await this.requireMember(memberId);
    if (!this.openWearables || !this.openWearables.isConfigured()) return [];

    const owUserId = await this.memberRepo?.getOwUserId?.(memberId);
    if (!owUserId) return [];

    try {
      return await this.openWearables.getConnections(owUserId);
    } catch (error) {
      if (error.status === 401 || error.status === 404) {
        return [];
      }
      throw error;
    }
  }

  async listConnections(memberId) {
    await this.requireMember(memberId);
    if (this.wearableRepo?.listWearableLinks) {
      return this.wearableRepo.listWearableLinks(memberId);
    }
    if (this.openWearablesRepo?.listWearableLinks) {
      return this.openWearablesRepo.listWearableLinks(memberId);
    }
    return this.wearableRepo.listWearableDevices(memberId);
  }

  async reconcileRemoteConnections(memberId) {
    await this.requireMember(memberId);
    if (!this.openWearables || !this.openWearables.isConfigured()) return { reconciled: false, reason: 'unconfigured' };
    const owUserId = await this.memberRepo?.getOwUserId?.(memberId);
    if (!owUserId) return { reconciled: false, reason: 'no_ow_user' };

    try {
      const remoteConns = await this.openWearables.getConnections(owUserId);
      const remoteList = Array.isArray(remoteConns) ? remoteConns : (remoteConns?.data || []);
      const localLinks = await this.wearableRepo.listWearableLinks(memberId);
      const updates = [];

      for (const remote of remoteList) {
        const prov = (remote.provider || remote.name || '').toLowerCase();
        if (!prov) continue;
        const local = localLinks.find((l) => l.provider === prov);
        const remoteStatus = remote.status === 'active' ? 'connected' : (remote.status === 'expired' || remote.status === 'revoked' ? 'token_expired' : remote.status);
        if (local && local.status !== remoteStatus) {
          await this.wearableRepo.setWearableLinkStatus(memberId, prov, remoteStatus, remote.error || null);
          updates.push({ provider: prov, from: local.status, to: remoteStatus });
        }
      }
      return { reconciled: true, updates };
    } catch (err) {
      logger.error('Failed to reconcile remote connections', { memberId, error: err.message });
      return { reconciled: false, error: err.message };
    }
  }

  async disconnectRemoteProvider(memberId, provider) {
    await this.requireMember(memberId);
    const prov = provider.toLowerCase();
    const config = getProviderConfig(prov);
    if (!config) {
      throw new ApplicationError(`Invalid provider: ${provider}`, 422, 'validation_error');
    }

    if (this.openWearables && this.openWearables.isConfigured()) {
      let owUserId = await this.memberRepo?.getOwUserId?.(memberId);
      if (!owUserId && process.env.NODE_ENV !== 'production') {
        owUserId = await this.getOrCreateOwUserId(memberId).catch(() => null);
      }
      if (owUserId) {
        try {
          await this.openWearables.disconnectProvider(owUserId, prov);
        } catch (error) {
          if (error.status !== 401 && error.status !== 404) {
            throw error;
          }
        }
      }
    }

    await this.wearableRepo.setWearableLinkStatus(memberId, prov, 'disconnected');
    if (this.openWearablesRepo?.setWearableLinkStatus) {
      await this.openWearablesRepo.setWearableLinkStatus(memberId, prov, 'disconnected');
    }
  }

  async disconnectProvider(memberId, provider) {
    return this.disconnectRemoteProvider(memberId, provider);
  }

  async getSyncRuns(memberId, limit = 20) {
    await this.requireMember(memberId);
    if (!this.openWearables || !this.openWearables.isConfigured()) {
      if (this.openWearablesRepo) {
        return this.openWearablesRepo.getRecentSyncLogs(memberId, { limit });
      }
      return [];
    }

    const owUserId = await this.memberRepo?.getOwUserId?.(memberId);
    if (!owUserId) return [];

    try {
      return await this.openWearables.getSyncRuns(owUserId, limit);
    } catch (error) {
      if (error.status === 401 || error.status === 404) {
        return [];
      }
      throw error;
    }
  }

  async getSyncRecent(memberId, limit = 50) {
    await this.requireMember(memberId);
    if (!this.openWearables || !this.openWearables.isConfigured()) {
      if (this.openWearablesRepo) {
        return this.openWearablesRepo.getRecentSyncLogs(memberId, { limit });
      }
      return [];
    }

    const owUserId = await this.memberRepo?.getOwUserId?.(memberId);
    if (!owUserId) return [];

    try {
      return await this.openWearables.getSyncRecent(owUserId, limit);
    } catch (error) {
      if (error.status === 401 || error.status === 404) {
        return [];
      }
      throw error;
    }
  }

  async syncMemberDataFromOpenWearables(memberId, owUserIdParam = null) {
    const startTime = Date.now();
    await this.requireMember(memberId);
    if (!this.openWearables || !this.openWearables.isConfigured()) {
      return { synced: false, reason: 'unconfigured' };
    }

    const owUserId = owUserIdParam || await this.getOrCreateOwUserId(memberId);
    if (!owUserId) return { synced: false, reason: 'no_user_id' };

    let connections = [];
    if (typeof this.openWearables.getConnections === 'function') {
      try {
        const res = await this.openWearables.getConnections(owUserId);
        connections = Array.isArray(res) ? res : (res?.data || res?.items || []);
      } catch (err) {
        logger.error('Failed to fetch OpenWearables connections', { memberId, error: err.message });
        return { synced: false, reason: 'fetch_connections_failed', error: err.message };
      }
    }

    const connList = Array.isArray(connections) ? connections : (connections?.data || []);
    const connectedProviders = [];

    for (const conn of connList) {
      const p = (conn.provider || conn.source?.provider || conn.brand || '').toLowerCase();
      if (!p) continue;

      let status = 'disconnected';
      const rawStatus = (conn.status || '').toLowerCase();
      if (rawStatus === 'active' || rawStatus === 'connected') {
        status = 'connected';
      } else if (rawStatus === 'expired' || rawStatus === 'revoked') {
        status = 'token_expired';
      } else if (rawStatus === 'error') {
        status = 'error';
      } else if (rawStatus === 'pending') {
        status = 'connecting';
      }

      if (status === 'connected') {
        connectedProviders.push(p);
      }

      if (this.openWearablesRepo?.upsertWearableLink) {
        await this.openWearablesRepo.upsertWearableLink(memberId, {
          provider: p,
          status,
          metadata: conn.metadata || {},
        });
      }
    }

    if (connList.length === 0 || connectedProviders.length === 0) {
      return {
        synced: true,
        connections: connList.length,
        workoutsSaved: 0,
        sleepSaved: 0,
        recoveriesSaved: 0,
        timeseriesSaved: 0,
        durationMs: Date.now() - startTime,
      };
    }

    let earliestLastSync = null;
    if (this.openWearablesRepo?.listWearableLinks) {
      try {
        const links = await this.openWearablesRepo.listWearableLinks(memberId);
        for (const l of links) {
          if (l.lastSyncAt || l.last_sync_at) {
            const syncTime = new Date(l.lastSyncAt || l.last_sync_at).getTime();
            if (!earliestLastSync || syncTime < earliestLastSync) {
              earliestLastSync = syncTime;
            }
          }
        }
      } catch (err) {
        logger.warn('Could not query last_sync_at for links', { memberId });
      }
    }

    let startDate;
    if (earliestLastSync) {
      startDate = new Date(earliestLastSync - 3 * 86400000).toISOString().split('T')[0];
    } else {
      startDate = '2024-01-01';
    }
    const endDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    async function fetchAllPages(fetchFn) {
      const results = [];
      let cursor = null;
      let page = 1;
      let maxPages = 50;
      while (maxPages-- > 0) {
        const res = await fetchFn({ cursor, page });
        if (!res) break;
        const items = res.data || res.items || (Array.isArray(res) ? res : []);
        results.push(...items);

        const nextCursor = res.next_cursor || res.nextCursor || res.cursor;
        const hasMore = res.has_more ?? res.hasMore;
        const nextPage = res.next_page || res.nextPage;

        if (nextCursor && nextCursor !== cursor) {
          cursor = nextCursor;
        } else if (hasMore && nextPage) {
          page = nextPage;
        } else if (hasMore && items.length > 0) {
          page++;
        } else {
          break;
        }
      }
      return results;
    }

    const endpointErrors = [];
    let workoutsSaved = 0;
    let sleepSaved = 0;
    let recoveriesSaved = 0;
    let timeseriesSaved = 0;
    const touchedProviders = new Set();

    try {
      const workouts = await fetchAllPages(({ cursor, page }) =>
        this.openWearables.getWorkouts(owUserId, startDate, endDate, { cursor, page })
      );
      for (const w of workouts) {
        const p = (w.provider || w.source?.provider || connectedProviders[0] || 'wearable').toLowerCase();
        const saved = await this.openWearablesRepo.insertWorkout(memberId, p, w);
        if (saved > 0) {
          workoutsSaved += saved;
          touchedProviders.add(p);
        }
      }
    } catch (err) {
      endpointErrors.push({ endpoint: 'workouts', error: err.message });
      logger.error('Failed to sync workouts from OpenWearables', { memberId, error: err.message });
    }

    try {
      const sleeps = await fetchAllPages(({ cursor, page }) =>
        this.openWearables.getSleepSessions(owUserId, startDate, endDate, { cursor, page })
      );
      for (const s of sleeps) {
        const p = (s.provider || s.source?.provider || connectedProviders[0] || 'wearable').toLowerCase();
        const saved = await this.openWearablesRepo.insertSleepSession(memberId, p, s);
        if (saved > 0) {
          sleepSaved += saved;
          touchedProviders.add(p);
        }
      }
    } catch (err) {
      endpointErrors.push({ endpoint: 'sleep', error: err.message });
      logger.error('Failed to sync sleep sessions from OpenWearables', { memberId, error: err.message });
    }

    try {
      const recoveries = await fetchAllPages(({ cursor, page }) =>
        this.openWearables.getRecoverySummary(owUserId, startDate, endDate, { cursor, page })
      );
      const tsBatch = [];
      for (const r of recoveries) {
        const p = (r.provider || r.source?.provider || connectedProviders[0] || 'wearable').toLowerCase();
        if (r.recovery_score != null) {
          await this.openWearablesRepo.insertHealthScore(memberId, p, {
            scoreType: 'recovery',
            score: Number(r.recovery_score),
            qualifier: r.qualifier || null,
            components: {
              resting_hr: r.resting_heart_rate_bpm,
              hrv: r.avg_hrv_rmssd_ms,
              spo2: r.avg_spo2_percent,
            },
            calculatedAt: r.date ? (r.date.includes('T') ? r.date : `${r.date}T00:00:00.000Z`) : null,
          });
          recoveriesSaved++;
          touchedProviders.add(p);
        }
        if (r.resting_heart_rate_bpm != null) {
          tsBatch.push({
            provider: p,
            metricType: 'resting_heart_rate',
            recordedAt: r.date ? (r.date.includes('T') ? r.date : `${r.date}T00:00:00.000Z`) : null,
            value: Number(r.resting_heart_rate_bpm),
            unit: 'bpm',
            sourceRecordId: `rhr_${owUserId}_${r.date}`,
          });
        }
        if (r.avg_hrv_rmssd_ms != null) {
          tsBatch.push({
            provider: p,
            metricType: 'hrv',
            recordedAt: r.date ? (r.date.includes('T') ? r.date : `${r.date}T00:00:00.000Z`) : null,
            value: Number(r.avg_hrv_rmssd_ms),
            unit: 'ms',
            sourceRecordId: `hrv_${owUserId}_${r.date}`,
          });
        }
      }
      if (tsBatch.length && this.openWearablesRepo?.insertTimeseriesBatch) {
        const count = await this.openWearablesRepo.insertTimeseriesBatch(memberId, 'wearable', tsBatch);
        timeseriesSaved += count;
      }
    } catch (err) {
      endpointErrors.push({ endpoint: 'recovery', error: err.message });
      logger.error('Failed to sync recovery summary from OpenWearables', { memberId, error: err.message });
    }

    if (typeof this.openWearables.getActivitySummary === 'function') {
      try {
        const summaries = await fetchAllPages(({ cursor, page }) =>
          this.openWearables.getActivitySummary(owUserId, startDate, endDate, { cursor, page })
        );
        const tsRows = [];
        for (const act of summaries) {
          const p = (act.provider || act.source?.provider || connectedProviders[0] || 'wearable').toLowerCase();
          const recAt = act.date ? (act.date.includes('T') ? act.date : `${act.date}T00:00:00.000Z`) : null;
          if (!recAt) continue;
          if (act.steps_count != null || act.steps != null) {
            tsRows.push({
              provider: p,
              metricType: 'steps',
              recordedAt: recAt,
              value: Number(act.steps_count ?? act.steps),
              unit: 'count',
              sourceRecordId: `act_steps_${owUserId}_${act.date}`,
            });
            tsRows.push({
              provider: p,
              metricType: 'step_count',
              recordedAt: recAt,
              value: Number(act.steps_count ?? act.steps),
              unit: 'count',
              sourceRecordId: `act_step_count_${owUserId}_${act.date}`,
            });
          }
          if (act.calories_kcal != null || act.calories != null) {
            tsRows.push({
              provider: p,
              metricType: 'calories',
              recordedAt: recAt,
              value: Number(act.calories_kcal ?? act.calories),
              unit: 'kcal',
              sourceRecordId: `act_cal_${owUserId}_${act.date}`,
            });
          }
          if (act.distance_meters != null || act.distance != null) {
            tsRows.push({
              provider: p,
              metricType: 'distance',
              recordedAt: recAt,
              value: Number(act.distance_meters ?? act.distance),
              unit: 'm',
              sourceRecordId: `act_dist_${owUserId}_${act.date}`,
            });
          }
          if (act.active_minutes != null) {
            tsRows.push({
              provider: p,
              metricType: 'active_minutes',
              recordedAt: recAt,
              value: Number(act.active_minutes),
              unit: 'min',
              sourceRecordId: `act_min_${owUserId}_${act.date}`,
            });
          }
        }
        if (tsRows.length && this.openWearablesRepo?.insertTimeseriesBatch) {
          const count = await this.openWearablesRepo.insertTimeseriesBatch(memberId, 'wearable', tsRows);
          timeseriesSaved += count;
        }
      } catch (err) {
        endpointErrors.push({ endpoint: 'activity_summary', error: err.message });
        logger.error('Failed to sync activity summary from OpenWearables', { memberId, error: err.message });
      }
    }

    if (typeof this.openWearables.getSleepSummary === 'function') {
      try {
        const sleepSummaries = await fetchAllPages(({ cursor, page }) =>
          this.openWearables.getSleepSummary(owUserId, startDate, endDate, { cursor, page })
        );
        for (const ss of sleepSummaries) {
          const p = (ss.provider || ss.source?.provider || connectedProviders[0] || 'wearable').toLowerCase();
          if (ss.score != null || ss.sleep_score != null) {
            await this.openWearablesRepo.insertHealthScore(memberId, p, {
              scoreType: 'sleep',
              score: Number(ss.score ?? ss.sleep_score),
              qualifier: ss.qualifier || null,
              calculatedAt: ss.date ? (ss.date.includes('T') ? ss.date : `${ss.date}T00:00:00.000Z`) : null,
            });
          }
        }
      } catch (err) {
        endpointErrors.push({ endpoint: 'sleep_summary', error: err.message });
        logger.error('Failed to sync sleep summary from OpenWearables', { memberId, error: err.message });
      }
    }

    if (typeof this.openWearables.getTimeseries === 'function') {
      try {
        const tsData = await this.openWearables.getTimeseries(
          owUserId,
          `${startDate}T00:00:00Z`,
          `${endDate}T23:59:59Z`,
          { types: ['heart_rate', 'steps', 'hrv'] }
        );
        const items = tsData?.data || tsData?.items || (Array.isArray(tsData) ? tsData : []);
        if (items.length && this.openWearablesRepo?.insertTimeseriesBatch) {
          const count = await this.openWearablesRepo.insertTimeseriesBatch(memberId, 'wearable', items);
          timeseriesSaved += count;
        }
      } catch (err) {
        endpointErrors.push({ endpoint: 'timeseries', error: err.message });
        logger.error('Failed to sync timeseries from OpenWearables', { memberId, error: err.message });
      }
    }

    try {
      const cycles = await fetchAllPages(({ cursor, page }) =>
        this.openWearables.getMenstrualCycles(owUserId, startDate, endDate, { cursor, page })
      );
      for (const c of cycles) {
        const p = (c.provider || c.source?.provider || connectedProviders[0] || 'wearable').toLowerCase();
        await this.openWearablesRepo.insertWomensHealth(memberId, p, c);
        touchedProviders.add(p);
      }
    } catch (err) {
      endpointErrors.push({ endpoint: 'menstrual_cycles', error: err.message });
      logger.error('Failed to sync menstrual cycles from OpenWearables', { memberId, error: err.message });
    }

    for (const p of touchedProviders) {
      try {
        await this.openWearablesRepo.touchLastData?.(memberId, p);
      } catch (err) {
        logger.warn('Failed to touchLastData for provider', { memberId, provider: p });
      }
    }

    const durationMs = Date.now() - startTime;
    const totalRecords = workoutsSaved + sleepSaved + recoveriesSaved + timeseriesSaved;
    const isSuccess = endpointErrors.length === 0;
    const status = isSuccess ? 'success' : (totalRecords > 0 ? 'partial' : 'failed');

    if (this.openWearablesRepo?.logSync) {
      try {
        await this.openWearablesRepo.logSync(memberId, {
          provider: connectedProviders[0] || 'open_wearables',
          dataType: 'other',
          source: 'poll',
          recordsRead: totalRecords,
          recordsSaved: totalRecords,
          status,
          durationMs,
          errorMessage: endpointErrors.length > 0 ? JSON.stringify(endpointErrors) : null,
        });
      } catch (err) {
        logger.error('Failed to record sync log', { memberId, error: err.message });
      }
    }

    return {
      synced: isSuccess,
      connections: connList.length,
      workoutsSaved,
      sleepSaved,
      recoveriesSaved,
      timeseriesSaved,
      durationMs,
      errors: endpointErrors,
    };
  }

  async listDevices(memberId) {
    await this.requireMember(memberId);
    return this.wearableRepo.listWearableDevices(memberId);
  }

  async addDevice(memberId, input) {
    await this.requireMember(memberId);
    const brand = (input.brand || input.provider || '').toLowerCase();
    const config = getProviderConfig(brand);
    if (!config || config.type !== 'manual') {
      throw new ApplicationError(
        'addDevice is only allowed for manual providers (e.g. inbody, glucobase_cgm).',
        422,
        'invalid_operation',
      );
    }

    let batteryPct = null;
    if (input.batteryPct != null) {
      const b = Number(input.batteryPct);
      if (!Number.isNaN(b) && b >= 0 && b <= 100) batteryPct = Math.round(b);
    }
    const model = typeof input.model === 'string' ? input.model.slice(0, 100) : null;
    const metricsProvided = Array.isArray(input.metricsProvided)
      ? input.metricsProvided.filter((m) => METRIC_DEFINITIONS[m])
      : [];

    const dev = await this.wearableRepo.createWearableDevice(memberId, {
      brand,
      connectionType: 'manual',
      status: 'connected',
      model,
      batteryPct,
      metricsProvided,
    });
    return dev;
  }

  async updateDevice(memberId, deviceId, input) {
    await this.requireMember(memberId);
    const device = await this.wearableRepo.getWearableDevice(memberId, deviceId);
    if (!device) throw new ApplicationError('Device not found', 404, 'device_not_found');

    const patch = {};
    if (input.model !== undefined) {
      patch.model = typeof input.model === 'string' ? input.model.slice(0, 100) : null;
    }
    if (input.batteryPct !== undefined) {
      const b = Number(input.batteryPct);
      if (!Number.isNaN(b) && b >= 0 && b <= 100) patch.batteryPct = Math.round(b);
    }
    if (input.metricsProvided !== undefined && Array.isArray(input.metricsProvided)) {
      patch.metricsProvided = input.metricsProvided.filter((m) => METRIC_DEFINITIONS[m]);
    }
    return this.wearableRepo.updateWearableDevice(memberId, deviceId, patch);
  }

  async removeDevice(memberId, deviceId) {
    await this.requireMember(memberId);
    const device = await this.wearableRepo.getWearableDevice(memberId, deviceId);
    if (!device) throw new ApplicationError('Device not found', 404, 'device_not_found');

    await this.disconnectRemoteProvider(memberId, device.brand);
    await this.wearableRepo.deleteWearableDevice(memberId, deviceId);
  }

  async disconnectWearableDevice(memberId, deviceId) {
    return this.removeDevice(memberId, deviceId);
  }

  async syncDevice(memberId, deviceId) {
    await this.requireMember(memberId);
    const device = await this.wearableRepo.getWearableDevice(memberId, deviceId);
    if (!device) throw new ApplicationError('Device not found', 404, 'device_not_found');

    if (!['connected', 'syncing'].includes(device.status)) {
      throw new ApplicationError(
        `Device ${deviceId} is not connected (status: ${device.status}).`,
        409,
        'device_not_connected',
      );
    }

    if (device.lastSyncAt) {
      const elapsed = Date.now() - new Date(device.lastSyncAt).getTime();
      const cooldownMs = 60 * 1000;
      if (elapsed < cooldownMs) {
        throw new ApplicationError(
          'Sync is on cooldown. Please wait before syncing again.',
          429,
          'sync_rate_limited',
        );
      }
    }

    await this.wearableRepo.updateWearableDevice(memberId, deviceId, { status: 'syncing' });

    let syncedAt = null;
    try {
      if (this.openWearables && this.openWearables.isConfigured()) {
        const syncResult = await this.syncMemberDataFromOpenWearables(memberId);
        if (!syncResult.synced && syncResult.errors?.length > 0) {
          throw new Error(syncResult.errors[0]?.error || 'Sync failed');
        }
      }
      syncedAt = new Date().toISOString();
      await this.wearableRepo.updateWearableDevice(memberId, deviceId, {
        status: 'connected',
        lastSyncAt: syncedAt,
      });
    } catch (err) {
      await this.wearableRepo.updateWearableDevice(memberId, deviceId, {
        status: 'error',
        errorDetail: err.message,
      });
      throw err;
    }

    return { deviceId, syncedAt };
  }

  async listTimeseries(memberId, query = {}) {
    await this.requireMember(memberId);
    return this.openWearablesRepo.listTimeseries(memberId, query);
  }

  async listWorkouts(memberId, query = {}) {
    await this.requireMember(memberId);
    return this.openWearablesRepo.listWorkouts(memberId, query);
  }

  async listSleepSessions(memberId, query = {}) {
    await this.requireMember(memberId);
    return this.openWearablesRepo.listSleepSessions(memberId, query);
  }

  async listHealthScores(memberId, query = {}) {
    await this.requireMember(memberId);
    return this.openWearablesRepo.listHealthScores(memberId, query);
  }

  async getSyncLogs(memberId, query = {}) {
    await this.requireMember(memberId);
    return this.openWearablesRepo.getRecentSyncLogs(memberId, query);
  }

  async requireMember(memberId) {
    if (this.memberRepo?.findMemberById) {
      const member = await this.memberRepo.findMemberById(memberId);
      if (!member) throw new ApplicationError('User not found', 404, 'user_not_found');
      if (['deleted', 'suspended', 'deletion_requested'].includes(member.status)) {
        throw new ApplicationError(`Member account is ${member.status}`, 403, 'member_inactive');
      }
      return member;
    }
    return { id: memberId };
  }
}
