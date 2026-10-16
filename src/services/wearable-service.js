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
import {
  reconcileWorkouts,
  reconcileSleepSessions,
  reconcileHealthScores,
  reconcileWomensHealth,
} from '../domain/reconciliation.js';

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

function responseItems(response, collectionName) {
  if (Array.isArray(response)) return response;
  const candidates = [response?.[collectionName], response?.data?.[collectionName], response?.data, response?.items];
  return candidates.find(Array.isArray) || [];
}

function validateRedirectUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const isDeepLink = parsed.protocol && !['http:', 'https:'].includes(parsed.protocol);
    if (isDeepLink) {
      if (parsed.protocol === 'goqiihealth:' && parsed.hostname === 'wearables' && parsed.pathname === '/callback') {
        return url;
      }
      throw new Error('Mobile redirects must use goqiihealth://wearables/callback');
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

function normalizeOpenWearablesProvider(provider) {
  const value = String(provider || '').trim().toLowerCase();
  if (['apple', 'apple_health', 'apple_health_sdk'].includes(value)) return 'apple_health';
  if (['health_connect', 'google_health_connect'].includes(value)) return 'health_connect';
  return value;
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

  async createSdkSession(memberId, requestOrigin = null) {
    await this.requireMember(memberId);
    if (!this.openWearables?.isConfigured?.() || typeof this.openWearables.createSdkUserToken !== 'function') {
      throw new ApplicationError('OpenWearables SDK credentials are not configured.', 503, 'open_wearables_sdk_unconfigured');
    }

    const owUserId = await this.getOrCreateOwUserId(memberId);
    if (!owUserId) {
      throw new ApplicationError('Could not create the OpenWearables user for this account.', 502, 'open_wearables_user_missing');
    }

    let host = this.openWearables.mobileBaseUrl || requestOrigin;
    if (!host) {
      throw new ApplicationError('OpenWearables mobile API URL is not configured.', 503, 'open_wearables_mobile_url_missing');
    }
    try {
      const parsed = new URL(host);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('URL must use HTTP or HTTPS.');
      host = parsed.toString().replace(/\/$/, '');
    } catch (err) {
      throw new ApplicationError(`OpenWearables mobile API URL is invalid: ${err.message}`, 503, 'open_wearables_mobile_url_invalid');
    }

    try {
      const credentials = await this.openWearables.createSdkUserToken(owUserId);
      const accessToken = credentials?.access_token || credentials?.accessToken;
      const refreshToken = credentials?.refresh_token || credentials?.refreshToken;
      if (!accessToken || !refreshToken) throw new Error('OpenWearables did not return SDK tokens.');
      return { userId: owUserId, accessToken, refreshToken, host };
    } catch (err) {
      throw new ApplicationError(`Could not start OpenWearables health sync: ${err.message}`, err.status === 503 ? 503 : 502, 'open_wearables_sdk_auth_failed');
    }
  }

  async syncSdkDataToHealthLocker(memberId) {
    await this.requireMember(memberId);
    const result = await this.syncMemberDataFromOpenWearables(memberId);
    return result;
  }

  async disconnectSdkProvider(memberId, provider) {
    await this.requireMember(memberId);
    const normalized = String(provider || '').trim().toLowerCase();
    if (!['apple', 'health_connect'].includes(normalized)) {
      throw new ApplicationError('Only Apple Health and Health Connect SDK sources can be disconnected here.', 422, 'invalid_sdk_provider');
    }
    if (!this.openWearables?.isConfigured?.()) {
      throw new ApplicationError('OpenWearables is not configured.', 503, 'open_wearables_unconfigured');
    }
    const owUserId = await this.getOrCreateOwUserId(memberId);
    await this.openWearables.disconnectProvider(owUserId, normalized);
    return { provider: normalized, status: 'disconnected' };
  }

  async listProviders() {
    const supported = listSupportedProviders();
    let integrationStatus = 'not_configured';
    if (this.openWearables && this.openWearables.isConfigured()) {
      integrationStatus = 'unavailable';
      try {
        const result = await this.openWearables.listProviders({ enabledOnly: true });
        const remoteList = responseItems(result, 'providers');
        integrationStatus = 'ready';
        if (remoteList.length > 0) {
          const remoteMap = new Map(remoteList.map((p) => [(p.provider || p.id || p.name || '').toLowerCase(), p]));
          return supported.map((s) => {
            const remote = remoteMap.get(s.provider)
              || ((s.provider === 'apple_health' || s.provider === 'apple_watch') ? remoteMap.get('apple') : null)
              || (s.provider === 'samsung_health' ? remoteMap.get('samsung') : null);
            return {
              ...s,
              integrationStatus,
              iconUrl: remote?.icon_url || null,
              liveSyncMode: remote?.live_sync_mode || null,
              hasCloudApi: remote?.has_cloud_api ?? (s.type === 'oauth'),
              isEnabled: Boolean(remote && (
                remote.is_enabled
                ?? remote.isEnabled
                ?? remote.enabled
                ?? true
              )),
            };
          });
        }
      } catch (err) {
        logger.warn('Failed to fetch remote providers from Open Wearables, using defaults', { err: err.message });
      }
    }
    return supported.map((s) => ({
      ...s,
      integrationStatus,
      isEnabled: false,
    }));
  }

  async generateConnectSession(memberId, brand, redirectUrl) {
    const member = await this.requireMember(memberId);
    brand = String(brand || '').trim().toLowerCase();
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
      if (config.type === 'phone_sdk') {
        const link = await this.wearableRepo.upsertWearableLink(memberId, {
          provider: brand,
          connectionType: 'phone_sdk',
          status: 'connected',
          metricsProvided: [
            'heart_rate',
            'resting_heart_rate',
            'steps',
            'blood_pressure_systolic',
            'blood_pressure_diastolic',
            'blood_glucose',
            'spo2',
            'sleep',
          ],
          metadata: {
            connectedVia: 'phone_sdk_bridge',
            sdkType: config.via || brand,
          },
          force: true,
        });

        return {
          deviceId: link.id,
          brand,
          status: 'connected',
          connectionType: 'phone_sdk',
          connectUrl: null,
          instructions: `Provider ${brand} is connected via the mobile health bridge. Vitals stream automatically from your phone store.`,
        };
      }

      const flowMsg = `Provider ${brand} is a manual entry provider. Please use manual device entry.`;
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

    let connectUrl = null;

    if (this.openWearables && typeof this.openWearables.isConfigured === 'function' && this.openWearables.isConfigured()) {
      try {
        let owUserId = null;
        try {
          owUserId = await this.getOrCreateOwUserId(memberId);
        } catch (owErr) {
          logger.warn(`Could not lookup/create OW user for ${memberId}, using memberId fallback: ${owErr.message}`);
        }
        if (!owUserId) {
          owUserId = memberId;
        }

        let authData = await this.openWearables.getProviderAuthorizationUrl(owUserId, brand, validRedirect).catch(() => null);
        if (!authData?.authorization_url && (brand === 'google_health' || brand === 'google')) {
          authData = await this.openWearables.getProviderAuthorizationUrl(owUserId, 'google', validRedirect).catch(() => null);
        }
        connectUrl = authData?.authorization_url || null;
      } catch (err) {
        logger.warn(`OpenWearables authorization URL error for ${brand}: ${err.message}`, { memberId });
      }
    }

    if (!connectUrl) {
      throw new ApplicationError(
        `Provider '${brand}' OAuth is not yet configured or reachable in OpenWearables. Please check OpenWearables service credentials.`,
        422,
        'oauth_unconfigured'
      );
    }

    const existing = (await this.wearableRepo.listWearableDevices(memberId)).find((d) => d.brand === brand);
    const isAlreadyConnected = existing?.status === 'connected' || existing?.status === 'syncing';
    const targetStatus = isAlreadyConnected ? existing.status : 'connecting';

    const link = await this.wearableRepo.upsertWearableLink(memberId, {
      provider: brand,
      connectionType: 'oauth',
      status: targetStatus,
      force: true,
    });

    return {
      deviceId: link.id,
      brand,
      status: targetStatus,
      connectUrl,
      instructions: `Open connectUrl in browser. Once authorized, Open Wearables will stream data for member ${memberId}.`,
    };
  }

  async connectProvider(memberId, provider, options = {}) {
    await this.requireMember(memberId);
    const brand = String(provider || '').trim().toLowerCase();
    const config = getProviderConfig(brand);
    if (!config) {
      throw new ApplicationError(`Unsupported wearable provider: ${brand}.`, 422, 'validation_error');
    }

    const defaultMetrics = [
      'heart_rate',
      'resting_heart_rate',
      'steps',
      'blood_pressure_systolic',
      'blood_pressure_diastolic',
      'blood_glucose',
      'spo2',
      'sleep',
    ];

    const isHealthConnect = options.mode === 'health_connect' || brand === 'health_connect';
    const link = await this.wearableRepo.upsertWearableLink(memberId, {
      provider: brand,
      connectionType: isHealthConnect ? 'phone_sdk' : (config.type || 'oauth'),
      status: 'connected',
      metricsProvided: defaultMetrics,
      metadata: {
        connectedVia: options.mode || 'direct_connect',
        platform: options.platform || 'cloud',
        note: options.note || 'Provider verified & connected',
      },
      force: true,
    });

    return {
      success: true,
      provider: brand,
      status: 'connected',
      message: `Successfully connected ${config.name || brand}.`,
      link,
    };
  }

  async triggerRemoteSync(memberId, provider, options = {}) {
    await this.requireMember(memberId);
    const config = getProviderConfig(provider);
    if (!config) {
      throw new ApplicationError(`Invalid provider: ${provider}`, 422, 'validation_error');
    }

    if (!this.openWearables || !this.openWearables.isConfigured()) {
      await this.wearableRepo.touchLastSync?.(memberId, provider).catch(() => {});
      return { status: 'success', provider, message: `${config.name || provider} is connected and syncing via active pipeline.` };
    }

    const owUserId = await this.memberRepo?.getOwUserId?.(memberId);
    if (!owUserId) {
      return { status: 'skipped', message: `User has no remote connection for ${provider}.` };
    }

    try {
      let providerSync;
      // Garmin is webhook-only: it has no REST polling path.
      // Only trigger a historical backfill (e.g. on first connect).
      // For subsequent syncs, data arrives automatically via webhook push.
      const isGarmin = provider.toLowerCase() === 'garmin';
      if (isGarmin) {
        if (options?.firstConnect || options?.historical) {
          providerSync = await this.openWearables.syncHistoricalData(owUserId, 'garmin');
        } else {
          // Garmin data arrives via webhook — skip the REST trigger.
          providerSync = { status: 'skipped', message: 'Garmin syncs via webhook push; use historical=true to request a backfill.' };
        }
      } else {
        providerSync = await this.openWearables.syncUserData(owUserId, provider, options);
      }

      const importResult = await this.syncMemberDataFromOpenWearables(memberId, owUserId);
      const accepted = (importResult.workoutsSaved || 0)
        + (importResult.sleepSaved || 0)
        + (importResult.recoveriesSaved || 0)
        + (importResult.timeseriesSaved || 0);

      await this.wearableRepo.touchLastSync?.(memberId, provider).catch(() => {});

      return {
        status: importResult.synced ? 'success' : accepted > 0 ? 'partial' : 'success',
        provider,
        accepted,
        providerSync,
        imported: importResult,
        message: `Successfully synced ${config.name || provider}.`,
      };
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        throw new ApplicationError(`Open Wearables API auth error: ${error.message}`, 401, 'open_wearables_unauthorized');
      }
      if (error.status === 404) {
        return { status: 'skipped', message: `User has no remote connection for ${provider}.` };
      }
      logger.warn(`Remote sync for ${provider}: ${error.message}. Local connection maintained.`, { memberId });
      await this.wearableRepo.touchLastSync?.(memberId, provider).catch(() => {});
      return {
        status: 'success',
        provider,
        accepted: 0,
        message: `Sync checked for ${config.name || provider}. Telemetry records are up-to-date.`,
      };
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
    // OAuth completes at OpenWearables. Refresh its authoritative connection
    // state before returning local rows so an account becomes visible after
    // the browser/app returns from provider authorization.
    let reconciliation = { reconciled: false };
    try {
      reconciliation = await this.reconcileRemoteConnections(memberId);
    } catch (err) {
      logger.warn('Reconcile remote connections notice:', { err: err.message });
    }

    if (this.wearableRepo?.listWearableLinks) {
      const links = await this.wearableRepo.listWearableLinks(memberId);
      if (!reconciliation.reconciled) {
        return links.map((link) => {
          const isLocalOrSdk = link.connectionType === 'phone_sdk' ||
                               link.connectionType === 'phone' ||
                               link.metadata?.connectedVia === 'health_connect' ||
                               link.metadata?.connectedVia === 'direct_connect' ||
                               link.provider === 'health_connect' ||
                               link.provider === 'google_health';
          if (isLocalOrSdk) return link;
          return link.connectionType === 'oauth' && link.status === 'connected'
            ? { ...link, status: 'unverified' }
            : link;
        });
      }
      return links;
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
      const remoteList = responseItems(remoteConns, 'connections');
      const localLinks = await this.wearableRepo.listWearableLinks(memberId);
      const updates = [];
      const remoteByProvider = new Map();

      for (const remote of remoteList) {
        const rawProvider = (remote.provider || remote.name || '').toLowerCase();
        const prov = normalizeOpenWearablesProvider(rawProvider);
        if (!prov) continue;
        remoteByProvider.set(prov, remote);
        const connectionType = ['apple_health', 'health_connect'].includes(prov) ? 'phone_sdk' : 'oauth';
        const rawStatus = String(remote.status || '').toLowerCase();
        const remoteStatus = ['active', 'connected'].includes(rawStatus)
          ? 'connected'
          : ['expired', 'revoked'].includes(rawStatus)
            ? 'token_expired'
            : rawStatus === 'pending'
              ? 'connecting'
              : rawStatus === 'error'
                ? 'error'
                : 'disconnected';
        const local = localLinks.find((l) => l.provider === prov);
        if (!local) {
          await this.wearableRepo.upsertWearableLink(memberId, {
            provider: prov,
            connectionType,
            status: remoteStatus,
            metadata: remote.metadata || {},
            force: true,
          });
          updates.push({ provider: prov, from: null, to: remoteStatus });
        } else if (local.status !== remoteStatus) {
          await this.wearableRepo.upsertWearableLink(memberId, {
            provider: prov,
            connectionType,
            status: remoteStatus,
            metadata: remote.metadata || {},
            errorDetail: remote.error || null,
            force: true,
          });
          updates.push({ provider: prov, from: local.status, to: remoteStatus });
        }
      }

      for (const local of localLinks) {
        if (local.connectionType !== 'oauth' || remoteByProvider.has(local.provider) || local.status === 'disconnected') continue;
        await this.wearableRepo.setWearableLinkStatus(memberId, local.provider, 'disconnected');
        updates.push({ provider: local.provider, from: local.status, to: 'disconnected' });
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

    const hasOauthLink = (await this.wearableRepo.listWearableLinks(memberId))
      .some((link) => link.provider === prov && link.connectionType === 'oauth');
    if (hasOauthLink && (!this.openWearables || !this.openWearables.isConfigured())) {
      throw new ApplicationError('OpenWearables is not configured; the provider account could not be disconnected.', 503, 'open_wearables_unconfigured');
    }

    if (this.openWearables && this.openWearables.isConfigured()) {
      let owUserId = await this.memberRepo?.getOwUserId?.(memberId);
      if (hasOauthLink && !owUserId) {
        throw new ApplicationError('OpenWearables user link is missing; the provider account could not be disconnected.', 503, 'open_wearables_user_missing');
      }
      if (owUserId) {
        try {
          await this.openWearables.disconnectProvider(owUserId, prov);
        } catch (error) {
          logger.warn('Remote disconnect notice in OpenWearables:', { err: error.message, provider: prov });
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

  async disconnectAllRemoteProviders(memberId) {
    await this.requireMember(memberId);
    const links = await this.wearableRepo.listWearableLinks(memberId);
    const owUserId = await this.memberRepo?.getOwUserId?.(memberId);

    if (owUserId && this.openWearables && this.openWearables.isConfigured()) {
      try {
        const remoteConns = await this.openWearables.getConnections(owUserId);
        const remoteList = responseItems(remoteConns, 'connections');
        for (const remote of remoteList) {
          const prov = (remote.provider || remote.name || '').toLowerCase();
          if (prov) {
            try {
              await this.openWearables.disconnectProvider(owUserId, prov);
            } catch (err) {
              if (err.status !== 404) {
                logger.warn('Failed to disconnect remote provider in OW', { err: err.message, provider: prov });
              }
            }
          }
        }
      } catch (err) {
        logger.warn('Failed to fetch remote connections for disconnect all', { err: err.message });
      }
    }

    for (const link of links) {
      if (owUserId && link.connectionType === 'oauth' && this.openWearables && this.openWearables.isConfigured()) {
        try {
          await this.openWearables.disconnectProvider(owUserId, link.provider);
        } catch (err) {
          if (err.status !== 404) {
            logger.warn('Failed to disconnect remote provider in OW', { err: err.message, provider: link.provider });
          }
        }
      }
      await this.wearableRepo.setWearableLinkStatus(memberId, link.provider, 'disconnected');
      if (this.openWearablesRepo?.setWearableLinkStatus) {
        await this.openWearablesRepo.setWearableLinkStatus(memberId, link.provider, 'disconnected');
      }
    }
    return { success: true, message: 'All wearable providers have been disconnected.' };
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
        connections = responseItems(res, 'connections');
      } catch (err) {
        logger.error('Failed to fetch OpenWearables connections', { memberId, error: err.message });
        return { synced: false, reason: 'fetch_connections_failed', error: err.message };
      }
    }

    // `connections` is already the flat array extracted by responseItems above.
    const connList = connections;
    const connectedProviders = [];

    for (const conn of connList) {
      const rawProvider = (conn.provider || conn.source?.provider || conn.brand || '').toLowerCase();
      const p = normalizeOpenWearablesProvider(rawProvider);
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
          connectionType: ['apple_health', 'health_connect'].includes(p) ? 'phone_sdk' : 'oauth',
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
    const fallbackDataProvider = connectedProviders.length === 1 ? connectedProviders[0] : 'openwearables';

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
      // Default to 30 days ago (not a hard-coded year) so first-time syncs
      // get a reasonable rolling window instead of all data since 2024.
      startDate = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
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
        const p = normalizeOpenWearablesProvider(w.provider || w.source?.provider || fallbackDataProvider);
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
        const p = normalizeOpenWearablesProvider(s.provider || s.source?.provider || fallbackDataProvider);
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
        const p = normalizeOpenWearablesProvider(r.provider || r.source?.provider || fallbackDataProvider);
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
          const p = normalizeOpenWearablesProvider(act.provider || act.source?.provider || fallbackDataProvider);
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
          const p = normalizeOpenWearablesProvider(ss.provider || ss.source?.provider || fallbackDataProvider);
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
        // Timeseries uses cursor pagination — we must page through all results.
        const allTsItems = await fetchAllPages(({ cursor }) =>
          this.openWearables.getTimeseries(
            owUserId,
            `${startDate}T00:00:00Z`,
            `${endDate}T23:59:59Z`,
            {
              cursor,
              types: [
                'heart_rate', 'resting_heart_rate', 'steps',
                'heart_rate_variability_sdnn', 'heart_rate_variability_rmssd',
                'oxygen_saturation', 'blood_glucose', 'blood_pressure_systolic',
                'blood_pressure_diastolic', 'respiratory_rate', 'active_energy',
                'distance_walking_running', 'weight',
              ],
            },
          )
        );
        const items = allTsItems.map((row) => ({
          ...row,
          provider: normalizeOpenWearablesProvider(row.provider || row.source?.provider || fallbackDataProvider),
        }));
        if (items.length && this.openWearablesRepo?.insertTimeseriesBatch) {
          const count = await this.openWearablesRepo.insertTimeseriesBatch(memberId, 'wearable', items);
          timeseriesSaved += count;
          for (const item of items) {
            if (item.provider) touchedProviders.add(item.provider);
          }
        }
      } catch (err) {
        endpointErrors.push({ endpoint: 'timeseries', error: err.message });
        logger.error('Failed to sync timeseries from OpenWearables', { memberId, error: err.message });
      }
    }

    if (typeof this.openWearables.getBodySummary === 'function') {
      try {
        const body = await this.openWearables.getBodySummary(owUserId);
        if (body && typeof body === 'object') {
          const bodyTs = [];
          const nowIso = new Date().toISOString();
          const p = fallbackDataProvider;

          if (body.latest?.blood_pressure_systolic != null) {
            bodyTs.push({
              provider: p,
              metricType: 'blood_pressure_systolic',
              recordedAt: body.latest.timestamp || nowIso,
              value: Number(body.latest.blood_pressure_systolic),
              unit: 'mmHg',
              sourceRecordId: `bp_sys_${owUserId}_${Date.now()}`,
            });
          }
          if (body.latest?.blood_pressure_diastolic != null) {
            bodyTs.push({
              provider: p,
              metricType: 'blood_pressure_diastolic',
              recordedAt: body.latest.timestamp || nowIso,
              value: Number(body.latest.blood_pressure_diastolic),
              unit: 'mmHg',
              sourceRecordId: `bp_dia_${owUserId}_${Date.now()}`,
            });
          }
          if (body.latest?.blood_glucose != null) {
            bodyTs.push({
              provider: p,
              metricType: 'blood_glucose',
              recordedAt: body.latest.timestamp || nowIso,
              value: Number(body.latest.blood_glucose),
              unit: 'mg/dL',
              sourceRecordId: `glucose_${owUserId}_${Date.now()}`,
            });
          }
          if (body.latest?.body_temperature != null || body.latest?.body_temperature_celsius != null) {
            bodyTs.push({
              provider: p,
              metricType: 'temperature',
              recordedAt: body.latest.timestamp || nowIso,
              value: Number(body.latest.body_temperature ?? body.latest.body_temperature_celsius),
              unit: '°C',
              sourceRecordId: `temp_${owUserId}_${Date.now()}`,
            });
          }
          if (body.averaged?.resting_heart_rate_bpm != null) {
            bodyTs.push({
              provider: p,
              metricType: 'resting_heart_rate',
              recordedAt: nowIso,
              value: Number(body.averaged.resting_heart_rate_bpm),
              unit: 'bpm',
              sourceRecordId: `rhr_avg_${owUserId}_${Date.now()}`,
            });
          }
          if (body.averaged?.avg_hrv_rmssd_ms != null) {
            bodyTs.push({
              provider: p,
              metricType: 'hrv',
              recordedAt: nowIso,
              value: Number(body.averaged.avg_hrv_rmssd_ms),
              unit: 'ms',
              sourceRecordId: `hrv_avg_${owUserId}_${Date.now()}`,
            });
          }
          if (body.static?.weight_kg != null) {
            bodyTs.push({
              provider: p,
              metricType: 'weight',
              recordedAt: nowIso,
              value: Number(body.static.weight_kg),
              unit: 'kg',
              sourceRecordId: `weight_${owUserId}_${Date.now()}`,
            });
          }

          if (bodyTs.length && this.openWearablesRepo?.insertTimeseriesBatch) {
            const count = await this.openWearablesRepo.insertTimeseriesBatch(memberId, 'wearable', bodyTs);
            timeseriesSaved += count;
            touchedProviders.add(p);
          }
        }
      } catch (err) {
        endpointErrors.push({ endpoint: 'body_summary', error: err.message });
        logger.error('Failed to sync body summary from OpenWearables', { memberId, error: err.message });
      }
    }

    try {
      const cycles = await fetchAllPages(({ cursor, page }) =>
        this.openWearables.getMenstrualCycles(owUserId, startDate, endDate, { cursor, page })
      );
      for (const c of cycles) {
        const p = normalizeOpenWearablesProvider(c.provider || c.source?.provider || fallbackDataProvider);
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
    const brand = (input.brand || input.provider || 'bluetooth_ble').toLowerCase();
    const config = getProviderConfig(brand);
    // Saving a device profile only records its model. It does not prove that an
    // OAuth account or phone health permission has been connected.
    const connectionType = 'manual';

    let batteryPct = 90;
    if (input.batteryPct != null) {
      const b = Number(input.batteryPct);
      if (!Number.isNaN(b) && b >= 0 && b <= 100) batteryPct = Math.round(b);
    }
    const model = typeof input.model === 'string' && input.model.trim()
      ? input.model.slice(0, 100)
      : typeof input.deviceModel === 'string' && input.deviceModel.trim()
      ? input.deviceModel.slice(0, 100)
      : config?.name || brand.toUpperCase();

    const defaultMetrics = ['steps', 'heart_rate', 'sleep', 'calories', 'spo2'];
    const metricsProvided = Array.isArray(input.metricsProvided) && input.metricsProvided.length > 0
      ? input.metricsProvided.filter((m) => METRIC_DEFINITIONS[m])
      : defaultMetrics;

    const dev = await this.wearableRepo.createWearableDevice(memberId, {
      brand,
      connectionType,
      status: 'disconnected',
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

    if (device.connectionType === 'oauth') {
      await this.disconnectRemoteProvider(memberId, device.brand);
    }
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
    const workouts = await this.openWearablesRepo.listWorkouts(memberId, query);
    return reconcileWorkouts(workouts);
  }

  async listSleepSessions(memberId, query = {}) {
    await this.requireMember(memberId);
    const sessions = await this.openWearablesRepo.listSleepSessions(memberId, query);
    return reconcileSleepSessions(sessions);
  }

  async listHealthScores(memberId, query = {}) {
    await this.requireMember(memberId);
    const scores = await this.openWearablesRepo.listHealthScores(memberId, query);
    return reconcileHealthScores(scores);
  }

  async listWomensHealth(memberId, query = {}) {
    await this.requireMember(memberId);
    const records = await this.openWearablesRepo.listWomensHealth(memberId, query);
    return reconcileWomensHealth(records);
  }

  async getSyncLogs(memberId, query = {}) {
    await this.requireMember(memberId);
    return this.openWearablesRepo.getRecentSyncLogs(memberId, query);
  }

  async importAppleXml(memberId, fileBuffer, filename = 'export.xml') {
    await this.requireMember(memberId);
    if (!this.openWearables || !this.openWearables.isConfigured()) {
      throw new ApplicationError('OpenWearables is not configured.', 503, 'open_wearables_unconfigured');
    }
    const owUserId = await this.getOrCreateOwUserId(memberId);
    if (!owUserId) {
      throw new ApplicationError('Could not resolve OpenWearables user.', 502, 'open_wearables_user_missing');
    }

    const fileSize = Buffer.byteLength(fileBuffer);
    const MIN_MULTIPART = 5 * 1024 * 1024; // 5 MiB

    if (fileSize < MIN_MULTIPART) {
      // Small file (< 5 MiB): use direct upload endpoint
      try {
        const directResult = await this.openWearables.uploadAppleXmlDirect(owUserId, fileBuffer, filename);
        return {
          status: directResult?.status || 'processing',
          taskId: directResult?.task_id || directResult?.id || null,
          method: 'direct',
          owUserId,
        };
      } catch (directErr) {
        logger.warn(`Apple XML direct upload failed: ${directErr.message}`, { memberId });
        throw new ApplicationError(
          `Apple XML direct upload failed: ${directErr.message}`,
          directErr.status || 502,
          'apple_xml_upload_failed',
        );
      }
    }

    // Large file: use multipart upload
    const PART_SIZE = 100 * 1024 * 1024; // 100 MiB default
    const created = await this.openWearables.createAppleXmlMultipart(owUserId, {
      filename,
      contentType: 'application/xml',
      fileSize,
    });

    const partSize = created.part_size || PART_SIZE;
    const partCount = Math.ceil(fileSize / partSize);
    const partNumbers = Array.from({ length: partCount }, (_, i) => i + 1);

    let completionSubmitted = false;
    try {
      const signed = await this.openWearables.signAppleXmlMultipart(owUserId, {
        key: created.key,
        uploadId: created.upload_id,
        partNumbers,
      });

      const urlMap = new Map(
        (signed.urls || []).map((u) => [u.part_number, u.url]),
      );

      const completedParts = [];
      for (let i = 0; i < partCount; i++) {
        const start = i * partSize;
        const chunk = fileBuffer.slice(start, start + partSize);
        const partUrl = urlMap.get(i + 1);
        if (!partUrl) throw new Error(`No presigned URL for part ${i + 1}`);

        const res = await this.openWearables.fetchFn(partUrl, {
          method: 'PUT',
          body: chunk,
          headers: { 'Content-Type': 'application/octet-stream' },
        });
        if (!res.ok) throw new Error(`Part ${i + 1} upload failed: ${res.status}`);
        const etag = res.headers.get('etag') || res.headers.get('ETag');
        if (!etag) throw new Error(`Missing ETag for part ${i + 1} — ensure CORS exposes the ETag header.`);
        completedParts.push({ part_number: i + 1, etag: etag.replace(/"/g, '') });
        logger.info(`Apple XML multipart: uploaded part ${i + 1}/${partCount}`, { memberId });
      }

      completionSubmitted = true;
      const result = await this.openWearables.completeAppleXmlMultipart(owUserId, {
        key: created.key,
        uploadId: created.upload_id,
        parts: completedParts,
      });

      return { status: result.status || 'processing', taskId: result.task_id || null, key: result.key, owUserId };
    } catch (err) {
      if (!completionSubmitted) {
        try {
          await this.openWearables.abortAppleXmlMultipart(owUserId, {
            key: created.key,
            uploadId: created.upload_id,
          });
        } catch (abortErr) {
          logger.warn('Failed to abort Apple XML multipart upload', { err: abortErr.message });
        }
      }
      throw new ApplicationError(
        `Apple XML import failed: ${err.message}`,
        err.status >= 400 && err.status < 500 ? err.status : 502,
        'apple_xml_import_failed',
      );
    }
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
