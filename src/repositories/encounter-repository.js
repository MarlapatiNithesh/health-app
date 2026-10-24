import { withTransaction } from '../database/pool.js';
import { globalCache } from '../cache/cache-manager.js';
import { EncounterMapper } from '../mappers/index.js';

export class EncounterRepository {
  constructor(pool) {
    this.pool = pool;
  }

  // ── Encounters (chat_sessions) ────────────────────────────────────────────

  async createEncounter(patientId, {
    intent = 'general',
    riskLevel = 'low',
    modelVersion = null,
    summary = null,
    chiefComplaint = null,
    symptoms = [],
    symptomState = {},
  } = {}) {
    return withTransaction(this.pool, async (client) => {
      await client.query(
        `UPDATE members
            SET health_consent_at = COALESCE(health_consent_at, now()),
                health_consent_version = COALESCE(health_consent_version, '1.0'),
                updated_at = now()
          WHERE id = $1`,
        [patientId]
      ).catch(() => {});
      await client.query(
        `INSERT INTO patients (id, preferred_language, units_system, privacy_level)
         VALUES ($1, 'en-IN', 'metric', 'standard')
         ON CONFLICT (id) DO NOTHING`,
        [patientId]
      ).catch(() => {});

      const validIntents = ['symptom', 'medication_query', 'record_query', 'general'];
      const cleanIntent = validIntents.includes(intent) ? intent : (symptoms?.length > 0 || chiefComplaint ? 'symptom' : 'general');
      const validRisks = ['low', 'medium', 'high'];
      const cleanRisk = validRisks.includes(riskLevel) ? riskLevel : 'low';
      const cleanSummary = summary || chiefComplaint || (Array.isArray(symptoms) && symptoms.length ? `Consultation for ${symptoms.join(', ')}` : null);
      const initialSymptomState = {
        ...symptomState,
        ...(chiefComplaint ? { primarySymptom: chiefComplaint } : {}),
        ...(Array.isArray(symptoms) && symptoms.length > 0 ? { associatedSymptoms: symptoms } : {}),
      };

      const res = await client.query(
        `INSERT INTO chat_sessions (patient_id, intent, risk_level, status, model_version, summary, symptom_state)
         VALUES ($1, $2, $3, 'in_progress', $4, $5, $6)
         RETURNING id, patient_id AS "patientId", intent, risk_level AS "riskLevel",
                   status, flagged_for_review AS "flaggedForReview",
                   model_version AS "modelVersion", summary, symptom_state AS "symptomState",
                   started_at AS "startedAt", created_at AS "createdAt"`,
        [patientId, cleanIntent, cleanRisk, modelVersion, cleanSummary, JSON.stringify(initialSymptomState)]
      );
      globalCache.invalidatePrefix(`encounter:`);
      globalCache.invalidatePrefix(`api:`);
      return res.rows[0];
    });
  }

  async findEncounterById(encounterId) {
    const sessionRes = await this.pool.query(
      `SELECT id, patient_id AS "patientId", intent, risk_level AS "riskLevel",
              status, flagged_for_review AS "flaggedForReview", symptom_state AS "symptomState",
              summary, model_version AS "modelVersion",
              started_at AS "startedAt", ended_at AS "endedAt",
              created_at AS "createdAt", updated_at AS "updatedAt"
         FROM chat_sessions
        WHERE id = $1`,
      [encounterId]
    );
    const encounter = sessionRes.rows[0];
    if (!encounter) return null;

    const [messagesRes, symptomRes, toolCallsRes, modelRunsRes] = await Promise.all([
      this.pool.query(
        `SELECT id, session_id AS "sessionId", role, content, meta, latency_ms AS "latencyMs", created_at AS "createdAt"
           FROM chat_messages
          WHERE session_id = $1
          ORDER BY created_at ASC`,
        [encounterId]
      ),
      this.pool.query(
        `SELECT id, session_id AS "sessionId", primary_symptom AS "primarySymptom",
                onset, duration, severity, character, location, radiation,
                aggravating_factors AS "aggravatingFactors", relieving_factors AS "relievingFactors",
                associated_symptoms AS "associatedSymptoms", extraction_confidence AS "extractionConfidence",
                is_complete AS "isComplete", completed_at AS "completedAt"
           FROM symptom_states
          WHERE session_id = $1`,
        [encounterId]
      ).catch(() => ({ rows: [] })),
      this.pool.query(
        `SELECT id, session_id AS "sessionId", tool_name AS "toolName", arguments, result, status, latency_ms AS "latencyMs", created_at AS "createdAt"
           FROM tool_calls
          WHERE session_id = $1
          ORDER BY created_at ASC`,
        [encounterId]
      ),
      this.pool.query(
        `SELECT id, session_id AS "sessionId", model_name AS "modelName", model_version AS "modelVersion",
                prompt_hash AS "promptHash", input_tokens AS "inputTokens", output_tokens AS "outputTokens",
                latency_ms AS "latencyMs", finish_reason AS "finishReason", created_at AS "createdAt"
           FROM model_runs
          WHERE session_id = $1
          ORDER BY created_at ASC`,
        [encounterId]
      ),
    ]);

    encounter.messages = messagesRes.rows;
    encounter.symptomState = symptomRes.rows[0] ?? encounter.symptomState ?? null;
    encounter.toolCalls = toolCallsRes.rows;
    encounter.modelRuns = modelRunsRes.rows;

    return EncounterMapper.toDto(encounter);
  }

  async listEncountersByPatient(patientId, limit = 20) {
    const res = await this.pool.query(
      `SELECT id, patient_id AS "patientId", intent, risk_level AS "riskLevel",
              status, flagged_for_review AS "flaggedForReview",
              summary, symptom_state AS "symptomState",
              started_at AS "startedAt", ended_at AS "endedAt",
              created_at AS "createdAt", updated_at AS "updatedAt"
         FROM chat_sessions
        WHERE patient_id = $1
        ORDER BY started_at DESC
        LIMIT $2`,
      [patientId, limit]
    );
    return res.rows;
  }

  async updateEncounterStatus(encounterId, { status, riskLevel, flaggedForReview, summary, resolution, modelVersion } = {}) {
    return withTransaction(this.pool, async (client) => {
      const fields = [];
      const values = [encounterId];
      let idx = 2;

      let cleanStatus = status;
      if (cleanStatus !== undefined) {
        cleanStatus = String(cleanStatus).toLowerCase();
        if (cleanStatus === 'completed' || cleanStatus === 'resolved' || cleanStatus === 'closed') cleanStatus = 'complete';
        if (cleanStatus === 'referred' || cleanStatus === 'escalated') cleanStatus = 'high_risk';
        if (!['in_progress', 'complete', 'high_risk', 'abandoned'].includes(cleanStatus)) cleanStatus = 'complete';

        fields.push(`status = $${idx++}`);
        values.push(cleanStatus);
        if (['complete', 'high_risk', 'abandoned'].includes(cleanStatus)) {
          fields.push('ended_at = now()');
        }
      }
      if (riskLevel !== undefined) {
        const validRisks = ['low', 'medium', 'high'];
        const cleanRisk = validRisks.includes(riskLevel) ? riskLevel : 'low';
        fields.push(`risk_level = $${idx++}`);
        values.push(cleanRisk);
      }
      if (flaggedForReview !== undefined) {
        fields.push(`flagged_for_review = $${idx++}`);
        values.push(Boolean(flaggedForReview));
      }
      const finalSummary = summary || resolution;
      if (finalSummary !== undefined) {
        fields.push(`summary = $${idx++}`);
        values.push(finalSummary);
      }
      if (modelVersion !== undefined) {
        fields.push(`model_version = $${idx++}`);
        values.push(modelVersion);
      }

      if (fields.length > 0) {
        fields.push('updated_at = now()');
        await client.query(
          `UPDATE chat_sessions SET ${fields.join(', ')} WHERE id = $1`,
          values
        );
      }
      globalCache.invalidatePrefix(`encounter:${encounterId}`);
      globalCache.invalidatePrefix(`api:`);
      return this.findEncounterById(encounterId);
    });
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  async appendMessage(encounterId, patientId, { role = 'user', content, meta = {}, latencyMs = null }) {
    let cleanRole = String(role || 'user').toLowerCase();
    if (['patient', 'member', 'client', 'me'].includes(cleanRole)) cleanRole = 'user';
    if (['bot', 'ai', 'model', 'clinician', 'doctor'].includes(cleanRole)) cleanRole = 'assistant';
    if (!['user', 'assistant', 'system', 'tool'].includes(cleanRole)) cleanRole = 'user';

    return withTransaction(this.pool, async (client) => {
      const res = await client.query(
        `INSERT INTO chat_messages (session_id, role, content, meta, latency_ms)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, session_id AS "sessionId", role, content, meta,
                   latency_ms AS "latencyMs", created_at AS "createdAt"`,
        [encounterId, cleanRole, content, JSON.stringify(meta || {}), latencyMs]
      );
      globalCache.invalidatePrefix(`encounter:${encounterId}`);
      globalCache.invalidatePrefix(`api:`);
      return EncounterMapper.toMessageDto(res.rows[0]);
    });
  }

  // ── Symptom State ─────────────────────────────────────────────────────────

  async getSymptomState(encounterId) {
    const sessionRes = await this.pool.query(
      `SELECT symptom_state AS "symptomState", patient_id AS "patientId" FROM chat_sessions WHERE id = $1`,
      [encounterId]
    );
    const raw = sessionRes.rows[0]?.symptomState || {};
    return {
      sessionId: encounterId,
      patientId: sessionRes.rows[0]?.patientId,
      ...raw,
      isComplete: Boolean(raw.isComplete),
    };
  }

  async upsertSymptomState(encounterId, patientId, data = {}) {
    return withTransaction(this.pool, async (client) => {
      const existingRes = await client.query(
        `SELECT symptom_state AS "symptomState" FROM chat_sessions WHERE id = $1`,
        [encounterId]
      );
      const existing = existingRes.rows[0]?.symptomState || {};
      const merged = { ...existing, ...data };
      if (!merged.primarySymptom && Array.isArray(data.symptoms) && data.symptoms.length > 0) {
        merged.primarySymptom = data.symptoms[0].name || data.symptoms[0].symptom;
      }
      if (merged.severity === undefined && data.overallSeverity !== undefined) {
        merged.severity = data.overallSeverity;
      }

      await client.query(
        `UPDATE chat_sessions
            SET symptom_state = $2::jsonb,
                updated_at = now()
          WHERE id = $1`,
        [encounterId, JSON.stringify(merged)]
      );
      globalCache.invalidatePrefix(`encounter:${encounterId}`);
      globalCache.invalidatePrefix(`api:`);
      return {
        sessionId: encounterId,
        patientId,
        ...merged,
      };
    });
  }

  // ── Observability: Tool Calls & Model Runs ─────────────────────────────────

  async logToolCall(encounterId, patientId, { toolName, arguments: args = {}, result = null, status = 'pending', latencyMs = null, errorMsg = null }) {
    return withTransaction(this.pool, async (client) => {
      const res = await client.query(
        `INSERT INTO tool_calls (session_id, tool_name, arguments, result, status, latency_ms, error_msg)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, session_id AS "sessionId", tool_name AS "toolName", status, created_at AS "createdAt"`,
        [encounterId, toolName, JSON.stringify(args), result ? JSON.stringify(result) : null, status, latencyMs, errorMsg]
      );
      return EncounterMapper.toToolCallDto(res.rows[0]);
    });
  }

  async logModelRun(encounterId, patientId, { modelName, modelVersion = '001', promptHash = null, inputTokens = null, outputTokens = null, latencyMs = null, finishReason = 'stop' }) {
    return withTransaction(this.pool, async (client) => {
      const res = await client.query(
        `INSERT INTO model_runs (session_id, model_name, model_version, prompt_hash, input_tokens, output_tokens, latency_ms, finish_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, session_id AS "sessionId", model_name AS "modelName", latency_ms AS "latencyMs", created_at AS "createdAt"`,
        [encounterId, modelName, modelVersion, promptHash, inputTokens, outputTokens, latencyMs, finishReason]
      );
      return EncounterMapper.toModelRunDto(res.rows[0]);
    });
  }
}
