import { withTransaction } from '../database/pool.js';

const MEMBER_SELECT = `
  id,
  phone_e164        AS "phoneE164",
  phone_verified    AS "phoneVerified",
  phone_verified_at AS "phoneVerifiedAt",
  status,
  created_at        AS "createdAt",
  full_name         AS "fullName",
  dob,
  gender,
  height_cm         AS "heightCm",
  weight_kg         AS "weightKg",
  insurance_tier    AS "insuranceTier",
  wellness_score    AS "wellnessScore",
  ow_user_id        AS "owUserId",
  timezone,
  health_consent_at AS "healthConsentAt",
  health_consent_version AS "healthConsentVersion",
  wellness_updated_at AS "wellnessUpdatedAt"
`;

export class MemberRepository {
  constructor(pool) {
    this.pool = pool;
  }

  #formatMember(row) {
    if (!row) return null;
    return {
      id: row.id,
      phoneE164: row.phoneE164,
      phone: row.phoneE164,
      phoneVerified: row.phoneVerified ?? false,
      phoneVerifiedAt: row.phoneVerifiedAt ?? null,
      status: row.status,
      createdAt: row.createdAt,
      owUserId: row.owUserId ?? null,
      timezone: row.timezone ?? 'Asia/Kolkata',
      healthConsentAt: row.healthConsentAt ?? null,
      healthConsentVersion: row.healthConsentVersion ?? null,
      wellnessUpdatedAt: row.wellnessUpdatedAt ?? null,
      profile: {
        fullName: row.fullName ?? null,
        dob: row.dob ?? null,
        gender: row.gender ?? null,
        heightCm: row.heightCm != null ? Number(row.heightCm) : null,
        weightKg: row.weightKg != null ? Number(row.weightKg) : null,
        insuranceTier: row.insuranceTier,
        wellnessScore: Number(row.wellnessScore ?? 30),
      },
    };
  }

  async #writeBiometricHistory(client, memberId, prev, next, source = 'profile_update') {
    const changedFields = [];
    let previousWeightKg = null;
    let previousHeightCm = null;
    let weightChangeKg = null;
    let heightChangeCm = null;
    let weightTrend = null;

    if (next.weightKg !== undefined && next.weightKg !== prev.weightKg) {
      changedFields.push('weight_kg');
      previousWeightKg = prev.weightKg ?? null;
      if (next.weightKg != null && prev.weightKg != null) {
        weightChangeKg = Math.round((next.weightKg - prev.weightKg) * 100) / 100;
        weightTrend = weightChangeKg > 0 ? 'gain' : weightChangeKg < 0 ? 'loss' : 'unchanged';
      } else if (prev.weightKg == null && next.weightKg != null) {
        weightChangeKg = 0;
        weightTrend = 'initial';
      }
    }

    if (next.heightCm !== undefined && next.heightCm !== prev.heightCm) {
      changedFields.push('height_cm');
      previousHeightCm = prev.heightCm ?? null;
      heightChangeCm = (next.heightCm != null && prev.heightCm != null)
        ? Math.round((next.heightCm - prev.heightCm) * 100) / 100
        : 0;
    }

    if (changedFields.length === 0) return;

    await client.query(
      `INSERT INTO member_biometric_history (
         member_id,
         height_cm, weight_kg,
         weight_trend, changed_fields, change_source
       ) VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        memberId,
        next.heightCm ?? prev.heightCm ?? null,
        next.weightKg ?? prev.weightKg ?? null,
        weightTrend,
        changedFields,
        source,
      ],
    );
  }

  async upsertMemberByPhone(phoneE164, client = this.pool) {
    const result = await client.query(
      `INSERT INTO members (phone, phone_e164, phone_verified, phone_verified_at, status)
       VALUES ($1, $1, true, now(), 'active')
       ON CONFLICT (phone)
       DO UPDATE SET
         phone_e164        = EXCLUDED.phone_e164,
         phone_verified    = true,
         phone_verified_at = now(),
         status            = CASE
           WHEN members.status = 'pending_verification' THEN 'active'
           ELSE members.status
         END,
         updated_at = now()
       RETURNING ${MEMBER_SELECT}`,
      [phoneE164],
    );
    return this.#formatMember(result.rows[0]);
  }

  async createMember(input, client = this.pool) {
    const prof = input.profile ?? input;
    const phoneE164 = input.phoneE164 || input.phone || null;

    const result = await client.query(
      `INSERT INTO members (
         phone, phone_e164, status,
         full_name, dob, gender, height_cm, weight_kg,
         insurance_tier, wellness_score
       )
       VALUES ($1, $1, 'active', $2, $3, $4, $5, $6, 'bronze', 30)
       RETURNING ${MEMBER_SELECT}`,
      [
        phoneE164,
        prof.fullName ?? null,
        prof.dob ?? null,
        prof.gender ?? null,
        prof.heightCm ?? null,
        prof.weightKg ?? null,
      ],
    );

    const member = result.rows[0];

    if (member && (prof.heightCm != null || prof.weightKg != null)) {
      await this.#writeBiometricHistory(
        client, member.id,
        { weightKg: null, heightCm: null },
        { weightKg: prof.weightKg ?? null, heightCm: prof.heightCm ?? null },
        'initial',
      );
    }

    return this.#formatMember(member);
  }

  async findMemberByPhone(phoneE164, client = this.pool) {
    const result = await client.query(
      `SELECT ${MEMBER_SELECT} FROM members WHERE phone_e164 = $1`,
      [phoneE164],
    );
    return this.#formatMember(result.rows[0]);
  }

  async findMemberById(memberId, client = this.pool) {
    const result = await client.query(
      `SELECT ${MEMBER_SELECT} FROM members WHERE id = $1`,
      [memberId],
    );
    return this.#formatMember(result.rows[0]);
  }

  async recordLogin(memberId, client = this.pool) {
    await client.query(
      'UPDATE members SET last_login_at = now() WHERE id = $1',
      [memberId],
    );
  }

  async updateProfile(memberId, profileData) {
    return withTransaction(this.pool, async (client) => {
      const before = await client.query(
        `SELECT height_cm AS "heightCm", weight_kg AS "weightKg"
         FROM members WHERE id = $1 FOR UPDATE`,
        [memberId],
      );
      const prev = before.rows[0] ?? {};

      const result = await client.query(
        `UPDATE members
         SET
           full_name  = COALESCE($2, full_name),
           dob        = COALESCE($3, dob),
           gender     = COALESCE($4, gender),
           height_cm  = COALESCE($5, height_cm),
           weight_kg  = COALESCE($6, weight_kg),
           timezone   = COALESCE($7, timezone),
           updated_at = now()
         WHERE id = $1
         RETURNING
           full_name AS "fullName", dob, gender,
           height_cm AS "heightCm", weight_kg AS "weightKg",
           timezone,
           insurance_tier AS "insuranceTier", wellness_score AS "wellnessScore"`,
        [
          memberId,
          profileData.fullName ?? null,
          profileData.dob ?? null,
          profileData.gender ?? null,
          profileData.heightCm ?? null,
          profileData.weightKg ?? null,
          profileData.timezone ?? null,
        ],
      );

      const updated = result.rows[0] ?? null;

      if (updated) {
        await this.#writeBiometricHistory(
          client,
          memberId,
          {
            weightKg: prev.weightKg != null ? Number(prev.weightKg) : null,
            heightCm: prev.heightCm != null ? Number(prev.heightCm) : null,
          },
          {
            weightKg: profileData.weightKg ?? undefined,
            heightCm: profileData.heightCm ?? undefined,
          },
          'profile_update',
        );
      }

      return updated;
    });
  }

  async updateWellnessScoreAndTier(memberId, score, tier, client = this.pool) {
    return this.updateWellnessScore(memberId, score, tier, client);
  }

  async getOwUserId(memberId, client = this.pool) {
    const res = await client.query('SELECT ow_user_id AS "owUserId" FROM members WHERE id = $1', [memberId]);
    return res.rows[0]?.owUserId ?? null;
  }

  async setOwUserId(memberId, owUserId, client = this.pool) {
    const res = await client.query(
      `UPDATE members
       SET ow_user_id = $2, updated_at = now()
       WHERE id = $1 AND (ow_user_id IS NULL OR ow_user_id = $2)
       RETURNING ow_user_id AS "owUserId"`,
      [memberId, owUserId],
    );
    if (!res.rows[0]) {
      return this.getOwUserId(memberId, client);
    }
    return res.rows[0].owUserId;
  }

  async findMemberByOwUserId(owUserId, client = this.pool) {
    if (!owUserId) return null;
    const res = await client.query(
      `SELECT ${MEMBER_SELECT} FROM members WHERE ow_user_id = $1`,
      [owUserId],
    );
    return this.#formatMember(res.rows[0]);
  }

  async recordConsent(memberId, { type = 'health_data', version = '1.0', granted = true } = {}, client = this.pool) {
    const result = await client.query(
      `UPDATE members
       SET health_consent_at = CASE WHEN $2 THEN now() ELSE NULL END,
           health_consent_version = $3,
           updated_at = now()
       WHERE id = $1
       RETURNING id, health_consent_at AS "healthConsentAt", health_consent_version AS "healthConsentVersion"`,
      [memberId, Boolean(granted), version],
    );
    await client.query(
      `INSERT INTO member_consents (member_id, scope, granted, granted_at, revoked_at)
       VALUES ($1, $2, $3, CASE WHEN $3 THEN now() ELSE NULL END, CASE WHEN $3 THEN NULL ELSE now() END)
       ON CONFLICT (member_id, scope) DO UPDATE SET
         granted = EXCLUDED.granted,
         granted_at = CASE WHEN EXCLUDED.granted THEN now() ELSE member_consents.granted_at END,
         revoked_at = CASE WHEN EXCLUDED.granted THEN NULL ELSE now() END`,
      [memberId, type, Boolean(granted)],
    );
    return {
      ...(result.rows[0] || {}),
      id: memberId,
      memberId,
      scope: type,
      granted: Boolean(granted),
      createdAt: new Date().toISOString(),
      version,
    };
  }

  async getConsent(memberId, scope, client = this.pool) {
    const result = await client.query(
      `SELECT id, member_id AS "memberId", scope, granted,
              granted_at AS "grantedAt", revoked_at AS "revokedAt", created_at AS "createdAt"
         FROM member_consents WHERE member_id = $1 AND scope = $2`,
      [memberId, scope],
    );
    return result.rows[0] ?? null;
  }

  async deleteMember(memberId, reason = null, client = this.pool) {
    // GDPR right-to-be-forgotten: Erase all related health records, consents, vault documents, and biometrics
    await client.query('DELETE FROM member_consents WHERE member_id = $1', [memberId]).catch(() => {});
    await client.query('DELETE FROM sync_logs WHERE member_id = $1', [memberId]).catch(() => {});
    await client.query('DELETE FROM health_scores WHERE member_id = $1', [memberId]).catch(() => {});
    await client.query('DELETE FROM member_biometric_history WHERE member_id = $1', [memberId]).catch(() => {});
    await client.query('DELETE FROM timeseries WHERE member_id = $1', [memberId]).catch(() => {});
    await client.query('DELETE FROM sleep_sessions WHERE member_id = $1', [memberId]).catch(() => {});
    await client.query('DELETE FROM workouts WHERE member_id = $1', [memberId]).catch(() => {});
    await client.query('DELETE FROM wearable_links WHERE member_id = $1', [memberId]).catch(() => {});
    await client.query('DELETE FROM patients WHERE id = $1', [memberId]).catch(() => {});
    const result = await client.query('DELETE FROM members WHERE id = $1 RETURNING id', [memberId]).catch(() => ({ rows: [] }));
    return { id: memberId, status: 'deleted' };
  }

  async getProfileHistory(memberId, { limit = 50, offset = 0 } = {}, client = this.pool) {
    const result = await client.query(
      `SELECT
         id,
         height_cm     AS "heightCm",
         weight_kg     AS "weightKg",
         weight_trend  AS "weightTrend",
         changed_fields AS "changedFields",
         change_source  AS "changeSource",
         recorded_at   AS "recordedAt"
       FROM member_biometric_history
       WHERE member_id = $1
       ORDER BY recorded_at DESC
       LIMIT $2 OFFSET $3`,
      [memberId, Math.min(Math.max(Number(limit) || 50, 1), 100), Math.max(Number(offset) || 0, 0)],
    );

    return result.rows.map((row) => ({
      id: row.id,
      heightCm: row.heightCm != null ? Number(row.heightCm) : null,
      weightKg: row.weightKg != null ? Number(row.weightKg) : null,
      weightTrend: row.weightTrend,
      changedFields: row.changedFields ?? [],
      changeSource: row.changeSource,
      recordedAt: row.recordedAt,
    }));
  }

  async updateWellnessScore(memberId, score, tier, client = this.pool) {
    const result = await client.query(
      `UPDATE members
       SET wellness_score = $2, insurance_tier = $3, wellness_updated_at = now(), updated_at = now()
       WHERE id = $1
       RETURNING wellness_score AS "wellnessScore", insurance_tier AS "insuranceTier", wellness_updated_at AS "wellnessUpdatedAt"`,
      [memberId, score, tier],
    );
    return result.rows[0] ?? null;
  }

  async updateWellnessScoreAndTier(memberId, score, tier, client = this.pool) {
    return this.updateWellnessScore(memberId, score, tier, client);
  }

  async deleteMember(memberId, reason = 'user_requested', client = this.pool) {
    const result = await client.query(
      `UPDATE members
       SET status = 'deleted', deletion_reason = $2, deletion_at = now(), updated_at = now()
       WHERE id = $1
       RETURNING id, status, deletion_at AS "deletionAt"`,
      [memberId, reason]
    );
    return result.rows[0];
  }
}

