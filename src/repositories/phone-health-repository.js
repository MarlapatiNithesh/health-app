export class PhoneHealthRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async upsertPhoneConnection(memberId, connection, client = this.pool) {
    const provider = (connection.provider || 'apple_health').toLowerCase();
    const status = connection.status || 'connected';
    const metadata = {
      deviceId: connection.deviceId ?? null,
      hardwareId: connection.hardwareId ?? null,
      platform: connection.platform ?? null,
      permissions: Array.isArray(connection.permissions) ? connection.permissions : [],
      error: connection.error ?? null,
    };
    const syncCursor = connection.syncCursor ?? null;

    const result = await client.query(
      `INSERT INTO wearable_links
         (member_id, provider, connection_type, status, metrics_provided,
          metadata, sync_cursor, connected_at, updated_at)
       VALUES
         ($1, $2, 'phone_sdk', $3, $4, $5, $6,
          CASE WHEN $3 IN ('connected','syncing') THEN now() ELSE NULL END, now())
       ON CONFLICT (member_id, provider) DO UPDATE SET
         connection_type  = 'phone_sdk',
         status           = EXCLUDED.status,
         metrics_provided = EXCLUDED.metrics_provided,
         metadata         = wearable_links.metadata || EXCLUDED.metadata,
         sync_cursor      = COALESCE(EXCLUDED.sync_cursor, wearable_links.sync_cursor),
         connected_at     = CASE WHEN EXCLUDED.status IN ('connected','syncing') THEN COALESCE(wearable_links.connected_at, now()) ELSE wearable_links.connected_at END,
         updated_at       = now()
       RETURNING
         id,
         member_id        AS "userId",
         provider,
         status,
         metadata,
         sync_cursor      AS "syncCursor",
         last_sync_at     AS "lastSyncAt",
         updated_at       AS "updatedAt"`,
      [
        memberId,
        provider,
        status,
        metadata.permissions,
        JSON.stringify(metadata),
        syncCursor,
      ],
    );

    const row = result.rows[0];
    const meta = typeof row.metadata === 'object' && row.metadata !== null ? row.metadata : {};

    return {
      id: row.id,
      userId: row.userId,
      provider: row.provider,
      status: row.status,
      lastSyncAt: row.lastSyncAt,
      updatedAt: row.updatedAt,
      deviceId: meta.deviceId ?? null,
      hardwareId: meta.hardwareId ?? null,
      platform: meta.platform ?? null,
      permissions: meta.permissions ?? [],
      syncCursor: row.syncCursor,
      error: meta.error ?? null,
    };
  }

  async getPhoneConnection(memberId, preferredProviderOrClient = null, maybeClient = null) {
    let targetProvider = null;
    let client = this.pool;

    if (typeof preferredProviderOrClient === 'string') {
      targetProvider = preferredProviderOrClient.toLowerCase();
      client = maybeClient || this.pool;
    } else if (preferredProviderOrClient && typeof preferredProviderOrClient.query === 'function') {
      client = preferredProviderOrClient;
    }

    let query = `
      SELECT
         id,
         member_id    AS "userId",
         provider,
         status,
         metadata,
         sync_cursor  AS "syncCursor",
         last_sync_at AS "lastSyncAt",
         updated_at   AS "updatedAt"
       FROM wearable_links
       WHERE member_id = $1
         AND provider IN ('apple_health','health_connect','phone_pedometer')
    `;
    const params = [memberId];

    if (targetProvider) {
      query += ` AND provider = $2`;
      params.push(targetProvider);
    } else {
      query += ` ORDER BY last_sync_at DESC NULLS LAST LIMIT 1`;
    }

    const result = await client.query(query, params);

    if (!result.rows[0]) return null;
    const row = result.rows[0];
    const meta = typeof row.metadata === 'object' && row.metadata !== null ? row.metadata : {};

    return {
      id: row.id,
      userId: row.userId,
      provider: row.provider,
      status: row.status,
      lastSyncAt: row.lastSyncAt,
      updatedAt: row.updatedAt,
      deviceId: meta.deviceId ?? null,
      hardwareId: meta.hardwareId ?? null,
      platform: meta.platform ?? null,
      permissions: Array.isArray(meta.permissions) && meta.permissions.length > 0 ? meta.permissions : (Array.isArray(row.metrics_provided) ? row.metrics_provided : []),
      syncCursor: row.syncCursor,
      error: meta.error ?? null,
    };
  }

  async updateSyncTimestamp(memberId, provider = null, syncCursor = null, client = this.pool) {
    let prov = 'apple_health';
    let cursor = syncCursor;
    if (provider && typeof provider === 'string' && ['apple_health', 'health_connect', 'phone_pedometer'].includes(provider.toLowerCase())) {
      prov = provider.toLowerCase();
    } else if (provider && typeof provider === 'string' && !syncCursor) {
      cursor = provider;
    }

    const result = await client.query(
      `UPDATE wearable_links
       SET last_sync_at = now(),
           last_data_at = now(),
           sync_cursor  = COALESCE($3, sync_cursor),
           updated_at   = now()
       WHERE member_id = $1
         AND provider = $2
         AND status != 'disconnected'
       RETURNING last_sync_at AS "lastSyncAt"`,
      [memberId, prov, cursor],
    );
    return result.rows[0]?.lastSyncAt ?? new Date().toISOString();
  }

  async getSyncResponse(memberId, idempotencyKey, client = this.pool) {
    if (!idempotencyKey) return null;
    const result = await client.query(
      `SELECT response
       FROM sync_logs
       WHERE member_id = $1 AND idempotency_key = $2
       LIMIT 1`,
      [memberId, idempotencyKey],
    );
    return result.rows[0]?.response ?? null;
  }

  async claimSync(memberId, idempotencyKey, receivedCount, noData, client = this.pool) {
    if (!idempotencyKey) return true;
    const claimed = await client.query(
      `INSERT INTO sync_logs
         (member_id, provider, data_type, source, idempotency_key,
          records_read, records_saved, status)
       VALUES ($1, 'phone', 'timeseries', 'phone', $2, $3, 0, 'pending')
       ON CONFLICT (member_id, idempotency_key)
       DO UPDATE SET status = 'pending', updated_at = now()
       WHERE sync_logs.status IN ('failed', 'pending')
         AND sync_logs.updated_at < now() - interval '2 minutes'
       RETURNING id`,
      [memberId, idempotencyKey, receivedCount],
    );
    return claimed.rowCount > 0;
  }

  async completeSync(memberId, idempotencyKey, acceptedCount, duplicateCount, responsePayload, client = this.pool) {
    if (!idempotencyKey) return;
    await client.query(
      `UPDATE sync_logs
       SET records_saved = $3,
           status        = 'success',
           response      = $4::jsonb,
           completed_at  = now(),
           updated_at    = now()
       WHERE member_id = $1 AND idempotency_key = $2`,
      [memberId, idempotencyKey, acceptedCount, JSON.stringify(responsePayload)],
    );
  }

  async failSync(memberId, idempotencyKey, errorMessage, client = this.pool) {
    if (!idempotencyKey) return;
    await client.query(
      `UPDATE sync_logs
       SET status        = 'failed',
           error_message = $3,
           updated_at    = now()
       WHERE member_id = $1 AND idempotency_key = $2`,
      [memberId, idempotencyKey, errorMessage],
    );
  }
}
