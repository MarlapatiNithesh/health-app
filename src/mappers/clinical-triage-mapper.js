export class ClinicalTriageMapper {
  static toChatResponseDto({
    encounterId,
    role = 'assistant',
    content,
    riskLevel = 'low',
    status = 'in_progress',
    messageId,
    latencyMs = 0,

    symptomState = null,
    nextField = null,
    assessmentComplete = false,
    emergencyFlag = false,
    trigger = null,
    riskAssessment = null,
    modelName = null,
  }) {
    const dto = {
      encounterId,
      role,
      content,
      riskLevel,
      status,
      messageId,
      latencyMs,
      ...(modelName ? { modelName } : {}),
    };

    if (symptomState && symptomState.primarySymptom) {
      dto.symptomAssessment = {
        primarySymptom: symptomState.primarySymptom,
        isComplete: assessmentComplete,
        nextField: nextField || null,
        collectedFields: Object.keys(symptomState).filter((k) => {
          const v = symptomState[k];
          return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0) &&
            !['riskAssessed', 'riskLevel', 'triggeredRules'].includes(k);
        }),
      };
    }

    if (emergencyFlag) {
      dto.emergency = { flag: true, trigger };
    }

    if (riskAssessment) {
      dto.riskAssessment = {
        level: riskAssessment.riskLevel,
        summary: riskAssessment.summary,
        triggeredRules: riskAssessment.triggeredRules || [],
      };
    }

    return dto;
  }

  static toRagResponseDto({ query, results = [], structuredEvidence = {} }) {
    return {
      query,
      results: results.map((r) => ({
        id: r.id,
        contentText: r.contentText || r.content_text || '',
        similarity: r.similarity !== undefined ? Number(r.similarity) : 1.0,
      })),
      structuredEvidence,
    };
  }

  static toSafetyCheckDto({ status = 'SAFE', reasons = [], sources = [], timestamp = null }) {
    return {
      status,
      isSafe: status === 'SAFE',
      reasons,
      contraindications: reasons,
      sources,
      timestamp: timestamp || new Date().toISOString(),
    };
  }
}

