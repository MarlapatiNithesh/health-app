import { withTransaction } from '../database/pool.js';

export class PhoneVerificationRepository {
  constructor(pool) {
    this.pool = pool;
    this._sessions = new Map();
  }

  #makeId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  #pruneExpired() {
    const now = Date.now();
    for (const [key, s] of this._sessions) {
      if (s.expiresAt && new Date(s.expiresAt).getTime() < now) {
        this._sessions.delete(key);
      }
    }
  }

  async getRecentSession(phoneE164, cooldownSeconds = 60) {
    if (this.pool?.query) {
      const res = await this.pool.query(
        `SELECT id, created_at AS "createdAt"
         FROM phone_verification_sessions
         WHERE phone_e164 = $1
           AND status = 'pending'
           AND created_at > now() - ($2 || ' seconds')::interval
         LIMIT 1`,
        [phoneE164, cooldownSeconds],
      );
      if (res.rows[0]) return res.rows[0];
    }
    this.#pruneExpired();
    const session = this._sessions.get(phoneE164);
    if (!session) return null;
    const elapsed = (Date.now() - new Date(session.createdAt).getTime()) / 1000;
    return elapsed < cooldownSeconds ? session : null;
  }

  async createVerificationSession(session) {
    if (this.pool?.query) {
      await this.pool.query(
        `UPDATE phone_verification_sessions SET status = 'canceled' WHERE phone_e164 = $1 AND status = 'pending'`,
        [session.phoneE164],
      );
      const res = await this.pool.query(
        `INSERT INTO phone_verification_sessions
           (member_id, phone_e164, channel, max_verify_attempts, max_resend_count,
            request_ip, user_agent, provider_message_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING
           id,
           member_id AS "memberId",
           phone_e164 AS "phoneE164",
           channel,
           status,
           verify_attempts AS "verifyAttempts",
           max_verify_attempts AS "maxVerifyAttempts",
           expires_at AS "expiresAt",
           created_at AS "createdAt"`,
        [
          session.memberId ?? null,
          session.phoneE164,
          session.channel || 'sms',
          session.maxVerifyAttempts || 5,
          session.maxResendCount || 3,
          session.requestIp ?? null,
          session.userAgent ?? null,
          session.providerMessageId ?? null,
          session.expiresAt || new Date(Date.now() + 600_000).toISOString(),
        ],
      );
      if (res.rows[0]) return res.rows[0];
    }
    this.#pruneExpired();
    const existing = this._sessions.get(session.phoneE164);
    if (existing && existing.status === 'pending') {
      existing.status = 'canceled';
    }

    const id = this.#makeId();
    const now = new Date().toISOString();
    const newSession = {
      id,
      memberId: session.memberId ?? null,
      phoneE164: session.phoneE164,
      channel: session.channel || 'sms',
      status: 'pending',
      verifyAttempts: 0,
      maxVerifyAttempts: session.maxVerifyAttempts || 5,
      resendCount: 0,
      maxResendCount: session.maxResendCount || 3,
      providerMessageId: session.providerMessageId ?? null,
      expiresAt: session.expiresAt || new Date(Date.now() + 600_000).toISOString(),
      createdAt: now,
    };

    this._sessions.set(session.phoneE164, newSession);
    return newSession;
  }

  async findPendingSession(phoneE164, forUpdate = false) {
    if (this.pool?.query) {
      const res = await this.pool.query(
        `SELECT id, member_id AS "memberId", phone_e164 AS "phoneE164", status, verify_attempts AS "verifyAttempts", max_verify_attempts AS "maxVerifyAttempts", expires_at AS "expiresAt", created_at AS "createdAt" FROM phone_verification_sessions WHERE phone_e164 = $1 AND status = 'pending'`,
        [phoneE164],
      );
      if (res.rows[0]) return res.rows[0];
    }
    this.#pruneExpired();
    const session = this._sessions.get(phoneE164);
    if (!session || session.status !== 'pending') return null;
    return session;
  }

  async recordFailedAttempt(sessionId, newStatus = null) {
    if (this.pool?.query) {
      if (newStatus) {
        await this.pool.query(
          `UPDATE phone_verification_sessions
           SET verify_attempts = verify_attempts + 1, status = $2
           WHERE id = $1`,
          [sessionId, newStatus],
        );
      } else {
        await this.pool.query(
          `UPDATE phone_verification_sessions
           SET verify_attempts = verify_attempts + 1
           WHERE id = $1`,
          [sessionId],
        );
      }
    }
    for (const [, s] of this._sessions) {
      if (s.id === sessionId) {
        s.verifyAttempts = (s.verifyAttempts || 0) + 1;
        if (newStatus) s.status = newStatus;
        return { id: s.id, verifyAttempts: s.verifyAttempts, maxVerifyAttempts: s.maxVerifyAttempts, status: s.status };
      }
    }
    return null;
  }

  async completeVerification(sessionId, phoneE164, memberId = null) {
    return withTransaction(this.pool, async (client) => {
      if (client?.query) {
        await client.query(
          `UPDATE phone_verification_sessions SET status = 'verified' WHERE id = $1`,
          [sessionId],
        );
      }
      for (const [, s] of this._sessions) {
        if (s.id === sessionId) {
          s.status = 'verified';
          break;
        }
      }

      const memberResult = await client.query(
        `INSERT INTO members (phone, phone_e164, phone_verified, phone_verified_at, status, health_consent_at, health_consent_version)
         VALUES ($1, $1, true, now(), 'active', now(), '1.0')
         ON CONFLICT (phone)
         DO UPDATE SET
           phone_e164        = EXCLUDED.phone_e164,
           phone_verified    = true,
           phone_verified_at = now(),
           status            = CASE
             WHEN members.status = 'pending_verification' THEN 'active'
             ELSE members.status
           END,
           health_consent_at = COALESCE(members.health_consent_at, now()),
           health_consent_version = COALESCE(members.health_consent_version, '1.0'),
           updated_at = now()
         RETURNING
           id,
           phone_e164        AS "phoneE164",
           phone_verified    AS "phoneVerified",
           phone_verified_at AS "phoneVerifiedAt",
           status,
           full_name         AS "fullName",
           dob, gender,
           height_cm         AS "heightCm",
           weight_kg         AS "weightKg",
           insurance_tier    AS "insuranceTier",
           wellness_score    AS "wellnessScore"`,
        [phoneE164],
      );

      const member = memberResult.rows[0];

      if (member?.id) {
        await client.query(
          `INSERT INTO patients (id, preferred_language, units_system, privacy_level)
           VALUES ($1, 'en-IN', 'metric', 'standard')
           ON CONFLICT (id) DO NOTHING`,
          [member.id],
        ).catch(() => {});
      }

      return {
        sessionId,
        member,
        verified: true,
      };
    });
  }
}
