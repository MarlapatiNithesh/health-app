import { logger } from '../logger.js';

export class NotificationRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async upsertDeviceToken(memberId, { platform, token, appVersion, deviceModel }) {
    const now = new Date().toISOString();
    const tokenObj = {
      platform,
      token,
      appVersion: appVersion ?? null,
      deviceModel: deviceModel ?? null,
      isActive: true,
      lastSeenAt: now,
      createdAt: now,
    };

    const { rows } = await this.pool.query(
      `UPDATE members
       SET device_tokens = (
         SELECT jsonb_agg(
           CASE WHEN elem->>'token' = $2 AND elem->>'platform' = $3
                THEN jsonb_build_object(
                  'platform', elem->>'platform',
                  'token', elem->>'token',
                  'appVersion', COALESCE($4, elem->>'appVersion'),
                  'deviceModel', COALESCE($5, elem->>'deviceModel'),
                  'isActive', true,
                  'lastSeenAt', $6,
                  'createdAt', COALESCE(elem->>'createdAt', $6)
                )
                ELSE elem
           END
         )
         FROM jsonb_array_elements(COALESCE(device_tokens, '[]'::jsonb)) AS elem
       )
       WHERE id = $1 AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(COALESCE(device_tokens, '[]'::jsonb)) e
         WHERE e->>'token' = $2 AND e->>'platform' = $3
       )
       RETURNING device_tokens`,
      [memberId, token, platform, appVersion ?? null, deviceModel ?? null, now],
    );

    if (rows.length > 0 && rows[0].device_tokens) {
      return tokenObj;
    }

    await this.pool.query(
      `UPDATE members
       SET device_tokens = COALESCE(device_tokens, '[]'::jsonb) || $2::jsonb
       WHERE id = $1`,
      [memberId, JSON.stringify([tokenObj])],
    );

    return tokenObj;
  }

  async deactivateToken(memberId, token) {
    const { rowCount } = await this.pool.query(
      `UPDATE members
       SET device_tokens = (
         SELECT COALESCE(jsonb_agg(
           CASE WHEN elem->>'token' = $2 THEN jsonb_set(elem, '{isActive}', 'false'::jsonb)
                ELSE elem
           END
         ), '[]'::jsonb)
         FROM jsonb_array_elements(COALESCE(device_tokens, '[]'::jsonb)) AS elem
       )
       WHERE id = $1`,
      [memberId, token],
    );
    return rowCount > 0;
  }

  async getActiveTokens(memberId, platform = null) {
    const { rows } = await this.pool.query(
      `SELECT device_tokens FROM members WHERE id = $1`,
      [memberId],
    );
    const tokens = rows[0]?.device_tokens;
    if (!Array.isArray(tokens)) return [];
    return tokens.filter((t) => (t.isActive !== false && t.is_active !== false) && (!platform || t.platform === platform));
  }

  async pruneStaleTokens(_thresholdDays = 90) {
    return 0;
  }

  async getPreferences(memberId) {
    const { rows } = await this.pool.query(
      `SELECT notification_preferences FROM members WHERE id = $1`,
      [memberId],
    );
    const prefs = rows[0]?.notification_preferences ?? {};
    return Object.entries(prefs).map(([category, p]) => ({ category, ...p }));
  }

  async upsertPreference(memberId, category, prefs) {
    const {
      isEnabled = true,
      quietHoursStart = null,
      quietHoursEnd = null,
      quietHoursTz = 'UTC',
      smartSend = true,
      maxPerDay = 5,
    } = prefs;

    const entry = {
      category,
      is_enabled: isEnabled,
      quiet_hours_start: quietHoursStart,
      quiet_hours_end: quietHoursEnd,
      quiet_hours_tz: quietHoursTz,
      smart_send: smartSend,
      max_per_day: maxPerDay,
      updated_at: new Date().toISOString(),
    };

    await this.pool.query(
      `UPDATE members
       SET notification_preferences = jsonb_set(
         COALESCE(notification_preferences, '{}'::jsonb),
         ARRAY[$2],
         $3::jsonb,
         true
       )
       WHERE id = $1`,
      [memberId, category, JSON.stringify(entry)],
    );

    return entry;
  }

  async getPreferenceForCategory(memberId, category) {
    const { rows } = await this.pool.query(
      `SELECT notification_preferences->$2 AS pref FROM members WHERE id = $1`,
      [memberId, category],
    );
    return rows[0]?.pref ?? null;
  }

  async getDailyCount(memberId, category) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM notifications
       WHERE member_id = $1 AND category = $2 AND created_at >= CURRENT_DATE
         AND status NOT IN ('suppressed', 'failed')`,
      [memberId, category],
    );
    return rows[0]?.count ?? 0;
  }

  async incrementDailyCount(_memberId, _category) {}

  async getById(notificationId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM notifications WHERE id = $1`,
      [notificationId],
    );
    return rows[0] ?? null;
  }

  async createNotification(payload) {
    const {
      memberId, category, priority = 'normal', title, body,
      imageUrl = null, deepLink = null, actionLabel = null, actionUrl = null,
      sourceType = null, sourceRefId = null, rulesTriggered = null,
      metadata = null, scheduledAt = null, expiresAt = null,
      idempotencyKey = null,
    } = payload;

    const { rows } = await this.pool.query(
      `INSERT INTO notifications
         (member_id, category, priority, title, body, image_url, deep_link,
          action_label, action_url, source_type, source_ref_id, rules_triggered,
          metadata, scheduled_at, expires_at, idempotency_key, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
               CASE WHEN $14 IS NOT NULL THEN 'scheduled' ELSE 'pending' END)
       ON CONFLICT (member_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [
        memberId, category, priority, title, body, imageUrl, deepLink,
        actionLabel, actionUrl, sourceType, sourceRefId,
        rulesTriggered ? JSON.stringify(rulesTriggered) : null,
        metadata ? JSON.stringify(metadata) : '{}',
        scheduledAt, expiresAt, idempotencyKey,
      ],
    );
    return rows[0] ?? null;
  }

  async markEnqueued(notificationId) {
    const { rows } = await this.pool.query(
      `UPDATE notifications SET status = 'enqueued', updated_at = now()
       WHERE id = $1 AND status IN ('pending','scheduled','deferred')
       RETURNING *`,
      [notificationId],
    );
    return rows[0] ?? null;
  }

  async markSent(notificationId) {
    const { rows } = await this.pool.query(
      `UPDATE notifications SET status = 'sent', sent_at = now(), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [notificationId],
    );
    return rows[0] ?? null;
  }

  async markDelivered(notificationId) {
    const { rows } = await this.pool.query(
      `UPDATE notifications
       SET status = 'delivered', delivered_at = now(), updated_at = now()
       WHERE id = $1 AND status IN ('sent','enqueued') RETURNING *`,
      [notificationId],
    );
    return rows[0] ?? null;
  }

  async markEngaged(notificationId, eventType) {
    const status = eventType === 'read' ? 'read' : 'dismissed';
    const readAtClause = eventType === 'read' ? 'read_at = now(),' : '';
    const { rows } = await this.pool.query(
      `UPDATE notifications
       SET status = $2, ${readAtClause} updated_at = now()
       WHERE id = $1 AND status NOT IN ('dismissed') RETURNING *`,
      [notificationId, status],
    );
    return rows[0] ?? null;
  }

  async markFailed(notificationId, reason) {
    await this.pool.query(
      `UPDATE notifications
       SET status = 'failed',
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       WHERE id = $1`,
      [notificationId, JSON.stringify({ failReason: reason })],
    );
  }

  async defer(notificationId, scheduledAt) {
    const { rows } = await this.pool.query(
      `UPDATE notifications
       SET status = 'deferred', scheduled_at = $2, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [notificationId, scheduledAt],
    );
    return rows[0] ?? null;
  }

  async suppress(notificationId, reason) {
    await this.pool.query(
      `UPDATE notifications
       SET status = 'suppressed',
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       WHERE id = $1`,
      [notificationId, JSON.stringify({ suppressReason: reason })],
    );
  }

  async listForMember(memberId, { status, category, limit = 50, offset = 0 } = {}) {
    const conditions = ['n.member_id = $1'];
    const params = [memberId];
    let idx = 2;

    if (status) {
      conditions.push(`n.status = $${idx++}`);
      params.push(status);
    }
    if (category) {
      conditions.push(`n.category = $${idx++}`);
      params.push(category);
    }

    const limitIdx = idx;
    const offsetIdx = idx + 1;
    params.push(limit, offset);

    const { rows } = await this.pool.query(
      `SELECT n.*
       FROM notifications n
       WHERE ${conditions.join(' AND ')}
       ORDER BY n.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );
    return rows;
  }

  async pollDue(limit = 100) {
    const { rows } = await this.pool.query(
      `SELECT * FROM notifications
       WHERE status IN ('pending', 'deferred', 'scheduled')
         AND (scheduled_at IS NULL OR scheduled_at <= now())
         AND (expires_at IS NULL OR expires_at > now())
       ORDER BY
         CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
         created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [limit],
    );
    return rows;
  }

  async createDelivery({ notificationId, deviceTokenId, provider, providerMsgId, status = 'sent', latencyMs, errorCode, errorMessage }) {
    const delivery = {
      deviceTokenId: deviceTokenId ?? null,
      provider,
      providerMsgId: providerMsgId ?? null,
      status,
      latencyMs: latencyMs ?? null,
      errorCode: errorCode ?? null,
      errorMessage: errorMessage ?? null,
      attemptedAt: new Date().toISOString(),
    };

    await this.pool.query(
      `UPDATE notifications
       SET delivered_at = CASE WHEN $2 = 'sent' THEN now() ELSE delivered_at END,
           metadata = jsonb_set(
             COALESCE(metadata, '{}'::jsonb),
             '{deliveries}',
             COALESCE(metadata->'deliveries', '[]'::jsonb) || $3::jsonb,
             true
           ),
           updated_at = now()
       WHERE id = $1`,
      [notificationId, status, JSON.stringify([delivery])],
    );

    return delivery;
  }

  async logEngagement(memberId, notificationId, eventType) {
    if (eventType === 'read' || eventType === 'tapped') {
      await this.pool.query(
        `UPDATE notifications SET read_at = now(), updated_at = now() WHERE id = $1`,
        [notificationId],
      );
    }
  }

  async getOptimalSendHours(memberId) {
    const { rows } = await this.pool.query(
      `SELECT EXTRACT(HOUR FROM read_at)::int AS hour_of_day, COUNT(*) AS opens
       FROM notifications
       WHERE member_id = $1 AND read_at IS NOT NULL
         AND read_at > now() - INTERVAL '30 days'
       GROUP BY hour_of_day
       ORDER BY opens DESC
       LIMIT 3`,
      [memberId],
    );
    return rows.map((r) => r.hour_of_day);
  }

  async getDeliveryStats(memberId, days = 7) {
    const { rows } = await this.pool.query(
      `SELECT
         n.category,
         COUNT(*) FILTER (WHERE n.status = 'sent')       AS sent,
         COUNT(*) FILTER (WHERE n.status = 'delivered')  AS delivered,
         COUNT(*) FILTER (WHERE n.status = 'read')       AS read,
         COUNT(*) FILTER (WHERE n.status = 'dismissed')  AS dismissed,
         COUNT(*) FILTER (WHERE n.status = 'failed')     AS failed,
         COUNT(*) FILTER (WHERE n.status = 'suppressed') AS suppressed
       FROM notifications n
       WHERE n.member_id = $1
         AND n.created_at > now() - ($2 || ' days')::INTERVAL
       GROUP BY n.category`,
      [memberId, days],
    );
    return rows;
  }
}
