import { withTransaction } from '../database/pool.js';
import { globalCache } from '../cache/cache-manager.js';
import { PatientMapper, ClinicalRecordMapper, HealthEventMapper } from '../mappers/index.js';
import { ensurePatientAndConsent } from './helpers.js';

export class ClinicalRecordRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findPatientById(patientId, client = this.pool) {
    const res = await client.query(
      `SELECT p.id, p.abha_id AS "abhaId", p.mrn, p.sex_at_birth AS "sexAtBirth",
              p.ethnicity_code AS "ethnicityCode", p.blood_group AS "bloodGroup",
              p.preferred_language AS "preferredLanguage", p.notification_channels AS "notificationChannels",
              p.units_system AS "unitsSystem", p.privacy_level AS "privacyLevel",
              p.emergency_contact AS "emergencyContact", p.preferences, p.lifestyle, p.goals,
              p.created_at AS "createdAt", p.updated_at AS "updatedAt",
              m.full_name AS "fullName", m.dob, m.gender, m.phone_e164 AS "phone"
         FROM patients p
         JOIN members m ON m.id = p.id
        WHERE p.id = $1`,
      [patientId]
    );
    return res.rows[0] ? PatientMapper.toDto(res.rows[0]) : null;
  }

  async ensurePatient(memberId, initialData = {}) {
    return withTransaction(this.pool, async (client) => {
      await ensurePatientAndConsent(client, memberId);
      const res = await client.query(
        `INSERT INTO patients (
          id, abha_id, mrn, sex_at_birth, blood_group, preferred_language,
          emergency_contact, preferences, lifestyle, goals
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          emergency_contact = COALESCE(EXCLUDED.emergency_contact, patients.emergency_contact),
          preferences = COALESCE(EXCLUDED.preferences, patients.preferences),
          updated_at = now()
        RETURNING id`,
        [
          memberId,
          initialData.abhaId ?? null,
          initialData.mrn ?? null,
          initialData.sexAtBirth ?? null,
          initialData.bloodGroup ?? null,
          initialData.preferredLanguage ?? 'en-IN',
          JSON.stringify(initialData.emergencyContact ?? {}),
          JSON.stringify(initialData.preferences ?? {}),
          JSON.stringify(initialData.lifestyle ?? {}),
          JSON.stringify(initialData.goals ?? []),
        ]
      );
      return res.rows[0];
    });
  }

  async updatePatient(patientId, updateData = {}) {
    return withTransaction(this.pool, async (client) => {
      const fields = [];
      const values = [patientId];
      let idx = 2;

      if (updateData.bloodGroup !== undefined) {
        fields.push(`blood_group = $${idx++}`);
        values.push(updateData.bloodGroup);
      }
      if (updateData.emergencyContact !== undefined) {
        fields.push(`emergency_contact = $${idx++}`);
        const contactObj = typeof updateData.emergencyContact === 'string'
          ? { phone: updateData.emergencyContact }
          : (updateData.emergencyContact || {});
        values.push(JSON.stringify(contactObj));
      }
      if (updateData.preferences !== undefined) {
        fields.push(`preferences = $${idx++}`);
        values.push(JSON.stringify(updateData.preferences));
      }
      if (updateData.lifestyle !== undefined) {
        fields.push(`lifestyle = $${idx++}`);
        values.push(JSON.stringify(updateData.lifestyle));
      }
      if (updateData.goals !== undefined) {
        fields.push(`goals = $${idx++}`);
        values.push(JSON.stringify(updateData.goals));
      }

      if (fields.length > 0) {
        fields.push('updated_at = now()');
        await client.query(
          `UPDATE patients SET ${fields.join(', ')} WHERE id = $1`,
          values
        );
      }
      globalCache.invalidatePrefix(`patient:${patientId}`);
      return this.findPatientById(patientId, client);
    });
  }

  async createProvenance({ sourceType = 'document', documentId = null, pageNumber = null, extractionModel = null, modelVersion = null, confidence = null }) {
    return withTransaction(this.pool, async (client) => {
      const res = await client.query(
        `INSERT INTO provenance (source_type, document_id, page_number, extraction_model, model_version, confidence)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, source_type AS "sourceType",
                   document_id AS "documentId", page_number AS "pageNumber",
                   extraction_model AS "extractionModel", model_version AS "modelVersion",
                   confidence, created_at AS "createdAt"`,
        [sourceType, documentId, pageNumber, extractionModel, modelVersion, confidence]
      );
      return res.rows[0];
    });
  }

  async getConsent(memberId, scope) {
    const res = await this.pool.query(
      `SELECT id, member_id AS "memberId", scope, granted,
              granted_at AS "grantedAt", revoked_at AS "revokedAt", created_at AS "createdAt"
         FROM member_consents
        WHERE member_id = $1 AND scope = $2`,
      [memberId, scope]
    );
    return res.rows[0] ?? null;
  }

  async setConsent(memberId, scope, granted) {
    return withTransaction(this.pool, async (client) => {
      if (granted) {
        await ensurePatientAndConsent(client, memberId);
      }

      const upsertConsent = (s) => client.query(
        `INSERT INTO member_consents (member_id, scope, granted, granted_at, revoked_at)
         VALUES ($1, $2, $3, CASE WHEN $3 THEN now() ELSE NULL END, CASE WHEN NOT $3 THEN now() ELSE NULL END)
         ON CONFLICT (member_id, scope) DO UPDATE SET
           granted = EXCLUDED.granted,
           granted_at = CASE WHEN EXCLUDED.granted THEN now() ELSE member_consents.granted_at END,
           revoked_at = CASE WHEN NOT EXCLUDED.granted THEN now() ELSE NULL END
         RETURNING id, member_id AS "memberId", scope, granted,
                   granted_at AS "grantedAt", revoked_at AS "revokedAt"`,
        [memberId, s, Boolean(granted)]
      );

      if (scope === 'global' || scope === 'all') {
        const scopes = ['data_access', 'ai_processing', 'document_upload', 'wearable_sync'];
        const results = [];
        for (const s of scopes) {
          const r = await upsertConsent(s);
          results.push(r.rows[0]);
        }
        globalCache.invalidatePrefix(`patient:${memberId}`);
        return {
          memberId,
          scope: 'global',
          granted: Boolean(granted),
          scopes: results,
          grantedAt: new Date().toISOString(),
        };
      }

      const res = await upsertConsent(scope);
      globalCache.invalidatePrefix(`patient:${memberId}`);
      return res.rows[0];
    });
  }

  async findClinicalRecords(patientId, recordType, { status = null, limit = 50 } = {}) {
    let sql = `
      SELECT cr.id, cr.patient_id AS "patientId", cr.record_type AS "recordType",
             cr.name, cr.code, cr.code_system AS "codeSystem", cr.status,
             cr.severity, cr.value_num AS "valueNum", cr.value_text AS "valueText",
             cr.unit, cr.ref_low AS "refLow", cr.ref_high AS "refHigh",
             cr.interpretation, cr.dose, cr.frequency, cr.route,
             cr.start_at AS "startAt", cr.end_at AS "endAt", cr.details,
             cr.source, cr.confidence, cr.verification_status AS "verificationStatus",
             cr.verified_at AS "verifiedAt", cr.created_at AS "createdAt",
             p.source_type AS "provenanceSourceType", p.confidence AS "provenanceConfidence"
        FROM clinical_records cr
        LEFT JOIN provenance p ON p.id = cr.provenance_id
       WHERE cr.patient_id = $1 AND cr.deleted_at IS NULL
    `;
    const params = [patientId];

    if (recordType) {
      if (recordType === 'condition') {
        sql += ` AND (cr.record_type = 'condition' OR (cr.record_type = 'observation' AND cr.name NOT LIKE '%bpm%' AND cr.name NOT LIKE '%SpO2%' AND cr.name NOT LIKE '%kg%' AND cr.name NOT LIKE '%Temp%'))`;
      } else {
        params.push(recordType);
        sql += ` AND cr.record_type = $${params.length}`;
      }
    }
    if (status) {
      params.push(status);
      sql += ` AND cr.status = $${params.length}`;
    }

    sql += ` ORDER BY cr.start_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const res = await this.pool.query(sql, params);
    return res.rows.map(ClinicalRecordMapper.toDto);
  }

  async findRecordById(patientId, recordId) {
    const res = await this.pool.query(
      `SELECT cr.id, cr.patient_id AS "patientId", cr.record_type AS "recordType",
              cr.name, cr.code, cr.code_system AS "codeSystem", cr.status,
              cr.severity, cr.value_num AS "valueNum", cr.value_text AS "valueText",
              cr.unit, cr.dose, cr.frequency, cr.route,
              cr.start_at AS "startAt", cr.end_at AS "endAt", cr.details,
              cr.source, cr.confidence, cr.verification_status AS "verificationStatus",
              cr.created_at AS "createdAt"
         FROM clinical_records cr
        WHERE cr.id = $1 AND cr.patient_id = $2 AND cr.deleted_at IS NULL`,
      [recordId, patientId]
    );
    return res.rows[0] ? ClinicalRecordMapper.toDto(res.rows[0]) : null;
  }

  async createClinicalRecord(patientId, record) {
    return withTransaction(this.pool, async (client) => {
      const existing = await client.query(
        `SELECT id, name, status, dose, frequency, route
           FROM clinical_records
          WHERE patient_id = $1 AND record_type = $2 AND LOWER(TRIM(name)) = LOWER(TRIM($3))
            AND deleted_at IS NULL
          ORDER BY created_at DESC LIMIT 1`,
        [patientId, record.recordType, record.name]
      );

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        const updateRes = await client.query(
          `UPDATE clinical_records
              SET status = COALESCE($1, status),
                  dose = COALESCE($2, dose),
                  frequency = COALESCE($3, frequency),
                  route = COALESCE($4, route),
                  severity = COALESCE($5, severity),
                  value_num = COALESCE($6, value_num),
                  value_text = COALESCE($7, value_text),
                  unit = COALESCE($8, unit),
                  details = CASE WHEN $9::jsonb IS NOT NULL THEN details || $9::jsonb ELSE details END,
                  confidence = GREATEST(confidence, COALESCE($10, confidence)),
                  verification_status = COALESCE($11, verification_status),
                  updated_at = now()
            WHERE id = $12
          RETURNING id, patient_id AS "patientId", record_type AS "recordType",
                    name, code, status, severity, dose, frequency, route,
                    start_at AS "startAt", created_at AS "createdAt"`,
          [
            record.status ?? null,
            record.dose ?? null,
            record.frequency ?? null,
            record.route ?? null,
            record.severity ?? null,
            record.valueNum ?? null,
            record.valueText ?? null,
            record.unit ?? null,
            record.details ? JSON.stringify(record.details) : null,
            record.confidence ?? null,
            record.verificationStatus ?? null,
            row.id,
          ]
        );
        globalCache.invalidatePrefix(`patient:${patientId}`);
        return updateRes.rows[0];
      }

      const res = await client.query(
        `INSERT INTO clinical_records (
          patient_id, record_type, name, code_system, code, status, severity,
          value_num, value_text, unit, ref_low, ref_high, interpretation,
          dose, frequency, route, start_at, end_at, details, source,
          document_id, provenance_id, confidence, verification_status, verified_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
        ) RETURNING id, patient_id AS "patientId", record_type AS "recordType",
                    name, code, status, severity, dose, frequency, route,
                    start_at AS "startAt", created_at AS "createdAt"`,
        [
          patientId,
          record.recordType,
          record.name,
          record.codeSystem ?? null,
          record.code ?? null,
          record.status ?? 'active',
          record.severity ?? null,
          record.valueNum ?? null,
          record.valueText ?? null,
          record.unit ?? null,
          record.refLow ?? null,
          record.refHigh ?? null,
          record.interpretation ?? null,
          record.dose ?? null,
          record.frequency ?? null,
          record.route ?? null,
          record.startAt ?? new Date(),
          record.endAt ?? null,
          JSON.stringify(record.details ?? {}),
          record.source ?? 'manual',
          record.documentId ?? null,
          record.provenanceId ?? null,
          record.confidence ?? 1.0,
          record.verificationStatus ?? 'patient_confirmed',
          ['patient_confirmed', 'clinician_verified'].includes(record.verificationStatus ?? 'patient_confirmed')
            ? (record.verifiedAt ?? new Date())
            : null,
        ]
      );
      globalCache.invalidatePrefix(`patient:${patientId}`);
      return res.rows[0];
    });
  }

  async updateClinicalRecord(patientId, recordId, updates) {
    return withTransaction(this.pool, async (client) => {
      const fields = [];
      const values = [recordId, patientId];
      let idx = 3;

      if (updates.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(updates.status);
      }
      if (updates.name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(updates.name);
      }
      if (updates.dose !== undefined) {
        fields.push(`dose = $${idx++}`);
        values.push(updates.dose);
      }
      if (updates.frequency !== undefined) {
        fields.push(`frequency = $${idx++}`);
        values.push(updates.frequency);
      }
      if (updates.endAt !== undefined) {
        fields.push(`end_at = $${idx++}`);
        values.push(updates.endAt);
      }

      if (fields.length > 0) {
        fields.push('updated_at = now()');
        await client.query(
          `UPDATE clinical_records SET ${fields.join(', ')} WHERE id = $1 AND patient_id = $2`,
          values
        );
      }
      globalCache.invalidatePrefix(`patient:${patientId}`);
      return this.findRecordById(patientId, recordId);
    });
  }

  async softDeleteClinicalRecord(patientId, recordId) {
    return withTransaction(this.pool, async (client) => {
      const res = await client.query(
        `UPDATE clinical_records
            SET deleted_at = now(), updated_at = now()
          WHERE id = $1 AND patient_id = $2 AND deleted_at IS NULL
          RETURNING id`,
        [recordId, patientId]
      );
      globalCache.invalidatePrefix(`patient:${patientId}`);
      return res.rowCount > 0;
    });
  }

  async getTimeline(patientId, limit = 50) {
    const res = await this.pool.query(
      `SELECT patient_id AS "patientId", event_time AS "eventTime",
              event_type AS "eventType", summary, ref_id AS "refId"
         FROM v_timeline
        WHERE patient_id = $1
        ORDER BY event_time DESC
        LIMIT $2`,
      [patientId, limit]
    );
    return res.rows.map(HealthEventMapper.toTimelineDto);
  }

  async createHealthEvent(patientId, { eventType, eventTime = new Date(), summary, structuredData = {}, sessionId = null, provenanceId = null }) {
    return withTransaction(this.pool, async (client) => {
      const res = await client.query(
        `INSERT INTO health_events (
          patient_id, session_id, event_type, event_time, summary, structured_data, provenance_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, patient_id AS "patientId", session_id AS "sessionId",
                  event_type AS "eventType", event_time AS "eventTime",
                  summary, structured_data AS "structuredData", created_at AS "createdAt"`,
        [patientId, sessionId, eventType, eventTime, summary, JSON.stringify(structuredData), provenanceId]
      );
      globalCache.invalidatePrefix(`patient:${patientId}`);
      return HealthEventMapper.toDto(res.rows[0]);
    });
  }

  async getRecentHealthEvents(patientId, eventType = null, limit = 5) {
    const params = [patientId];
    let query = `SELECT id, patient_id AS "patientId", session_id AS "sessionId",
                        event_type AS "eventType", event_time AS "eventTime",
                        summary, structured_data AS "structuredData", created_at AS "createdAt"
                   FROM health_events
                  WHERE patient_id = $1`;
    if (eventType) {
      params.push(eventType);
      query += ` AND event_type = $2`;
    }
    query += ` ORDER BY event_time DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    const res = await this.pool.query(query, params);
    return res.rows.map(HealthEventMapper.toDto);
  }

  async getPatientContext(patientId) {
    const cacheKey = `patient:context:${patientId}`;
    return globalCache.coalesce(cacheKey, async () => {
      const [patient, conditions, medications, allergies, labs, timeline] = await Promise.all([
        this.findPatientById(patientId),
        this.findClinicalRecords(patientId, 'condition', { status: 'active', limit: 20 }),
        this.findClinicalRecords(patientId, 'medication', { status: 'active', limit: 20 }),
        this.findClinicalRecords(patientId, 'allergy', { limit: 20 }),
        this.findClinicalRecords(patientId, 'lab_result', { limit: 10 }),
        this.getTimeline(patientId, 10),
      ]);

      return {
        patient,
        activeConditions: conditions.map((c) => ({ id: c.id, name: c.name, code: c.code, severity: c.severity })),
        activeMedications: medications.map((m) => ({ id: m.id, name: m.name, dose: m.dose, frequency: m.frequency, route: m.route })),
        allergies: allergies.map((a) => ({ id: a.id, substance: a.name, reaction: a.details?.reaction, severity: a.severity })),
        recentLabs: labs.map((l) => ({
          id: l.id,
          name: l.name,
          testName: l.name,
          value: l.valueNum ?? l.valueText,
          valueNum: l.valueNum,
          valueText: l.valueText,
          unit: l.unit,
          interpretation: l.interpretation,
        })),
        recentTimeline: timeline,
      };
    }, 15_000);
  }
}
