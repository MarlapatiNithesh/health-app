export class EncounterMapper {
  static toDto(row) {
    if (!row) return null;
    const symptomState = EncounterMapper.toSymptomStateDto(row.symptomState || row.symptom_state);
    return {
      id: row.id,
      patientId: row.patientId || row.patient_id,
      intent: row.intent || 'general',
      riskLevel: row.riskLevel || row.risk_level || 'low',
      status: row.status || 'in_progress',
      flaggedForReview: Boolean(row.flaggedForReview ?? row.flagged_for_review),
      symptomState,
      summary: row.summary || (row.intent === 'symptom' ? 'Symptom Consultation' : 'Clinical Consultation'),
      chiefComplaint: row.chiefComplaint || row.chief_complaint || symptomState?.primarySymptom || null,
      modelVersion: row.modelVersion || row.model_version || null,
      startedAt: row.startedAt || row.started_at,
      endedAt: row.endedAt || row.ended_at || null,
      messages: Array.isArray(row.messages) ? row.messages.map(EncounterMapper.toMessageDto) : [],
      toolCalls: Array.isArray(row.toolCalls) ? row.toolCalls.map(EncounterMapper.toToolCallDto) : [],
      modelRuns: Array.isArray(row.modelRuns) ? row.modelRuns.map(EncounterMapper.toModelRunDto) : [],
      createdAt: row.createdAt || row.created_at,
      updatedAt: row.updatedAt || row.updated_at,
    };
  }

  static toMessageDto(row) {
    if (!row) return null;
    return {
      id: row.id,
      sessionId: row.sessionId || row.session_id,
      role: row.role,
      content: row.content,
      meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : (row.meta || {}),
      latencyMs: row.latencyMs ?? row.latency_ms ?? null,
      createdAt: row.createdAt || row.created_at,
    };
  }

  static toSymptomStateDto(state) {
    if (!state) return null;
    const parsed = typeof state === 'string' ? JSON.parse(state) : state;
    if (!parsed || typeof parsed !== 'object') return null;

    // Preserve ALL fields from the stored symptom state — the ChatService needs them all
    const dto = {
      primarySymptom: parsed.primarySymptom || parsed.primary_symptom ||
        (Array.isArray(parsed.symptoms) && parsed.symptoms[0]?.name ? parsed.symptoms[0].name : null),
      severity: parsed.severity ?? parsed.overallSeverity ?? null,
      duration: parsed.duration || null,
      onset: parsed.onset || null,
      character: parsed.character || null,
      location: parsed.location || null,
      radiation: parsed.radiation || null,
      aggravatingFactors: parsed.aggravatingFactors || parsed.aggravating_factors || null,
      relievingFactors: parsed.relievingFactors || parsed.relieving_factors || null,
      associatedSymptoms: Array.isArray(parsed.associatedSymptoms)
        ? parsed.associatedSymptoms
        : (Array.isArray(parsed.symptoms) && parsed.symptoms.length > 0 ? parsed.symptoms : null),
      // Risk assessment tracking fields
      riskAssessed: parsed.riskAssessed || false,
      riskLevel: parsed.riskLevel || null,
      triggeredRules: Array.isArray(parsed.triggeredRules) ? parsed.triggeredRules : [],
    };

    // Return only non-null, non-undefined fields (except riskAssessed which can be false)
    const clean = {};
    for (const [k, v] of Object.entries(dto)) {
      if (k === 'riskAssessed') { clean[k] = Boolean(v); continue; }
      if (v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)) clean[k] = v;
    }
    return Object.keys(clean).length > 0 ? clean : null;
  }

  static toToolCallDto(row) {
    if (!row) return null;
    return {
      id: row.id,
      sessionId: row.sessionId || row.session_id,
      toolName: row.toolName || row.tool_name,
      arguments: typeof row.arguments === 'string' ? JSON.parse(row.arguments) : (row.arguments || {}),
      result: typeof row.result === 'string' ? JSON.parse(row.result) : (row.result || null),
      status: row.status,
      latencyMs: row.latencyMs ?? row.latency_ms ?? null,
      createdAt: row.createdAt || row.created_at,
    };
  }

  static toModelRunDto(row) {
    if (!row) return null;
    return {
      id: row.id,
      sessionId: row.sessionId || row.session_id,
      modelName: row.modelName || row.model_name,
      modelVersion: row.modelVersion || row.model_version,
      inputTokens: row.inputTokens ?? row.input_tokens ?? 0,
      outputTokens: row.outputTokens ?? row.output_tokens ?? 0,
      latencyMs: row.latencyMs ?? row.latency_ms ?? null,
      finishReason: row.finishReason || row.finish_reason || null,
      createdAt: row.createdAt || row.created_at,
    };
  }
}
