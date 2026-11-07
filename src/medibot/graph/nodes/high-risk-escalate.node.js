/**
 * LangGraph Node: High Risk Escalate
 * Escalates symptoms assessed as clinically high-risk with urgent medical advice.
 */

import { ClinicalTriageMapper } from '../../../mappers/clinical-triage-mapper.js';
import { logger } from '../../../logger.js';

export function createHighRiskEscalateNode({ encounterRepo }) {
  return async function highRiskEscalateNode(state) {
    const { patientId, encounterId, symptomState, riskAssessment, startTime } = state;

    const primarySymptom = symptomState?.primarySymptom || 'the symptoms described';
    const escalationResponse = `⚠️ **Based on your symptom assessment**, your reported symptoms — particularly ${primarySymptom} — warrant **urgent medical attention**.

${riskAssessment?.summary || 'Clinical rules suggest immediate medical review is necessary.'}

**Please take one of the following actions immediately:**
- Call your local emergency number (112 / 911 / 999)
- Go to the nearest Emergency Department
- Call your doctor or an emergency after-hours service right now

Do not wait. This is not a diagnosis, but your symptoms require professional clinical evaluation without delay.`;

    const latencyMs = Date.now() - (startTime || Date.now());

    let assistantMsg = { id: null };
    try {
      const [, msg] = await Promise.all([
        encounterRepo?.updateEncounterStatus?.(encounterId, {
          status: 'high_risk',
          riskLevel: 'high',
          flaggedForReview: true,
          summary: riskAssessment?.summary,
        }),
        encounterRepo?.appendMessage?.(encounterId, patientId, {
          role: 'assistant',
          content: escalationResponse,
          meta: { escalation: true, riskLevel: 'high', triggeredRules: riskAssessment?.triggeredRules },
          latencyMs,
        }),
      ]);
      assistantMsg = msg;
    } catch (err) {
      logger.error('Failed to escalate high-risk encounter', { error: err.message });
    }

    const resultDto = ClinicalTriageMapper.toChatResponseDto({
      encounterId,
      role: 'assistant',
      content: escalationResponse,
      riskLevel: 'high',
      status: 'high_risk',
      messageId: assistantMsg?.id,
      latencyMs,
      symptomState,
      riskAssessment,
    });

    return {
      finalResponse: escalationResponse,
      resultDto,
    };
  };
}

