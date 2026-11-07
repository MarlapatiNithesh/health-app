/**
 * LangGraph Node: Emergency Escalate
 * Bypasses regular LLM processing when an emergency is detected, persists high-risk status,
 * and formats the emergency response DTO.
 */

import { ClinicalTriageMapper } from '../../../mappers/clinical-triage-mapper.js';
import { logger } from '../../../logger.js';

export function createEmergencyEscalateNode({ encounterRepo }) {
  return async function emergencyEscalateNode(state) {
    const { patientId, encounterId, emergencyDetails, startTime } = state;
    const alertResponse = `🚨 **EMERGENCY WARNING**: ${emergencyDetails?.message || 'Immediate attention required.'} Please seek immediate emergency medical care (call 112 / 911 / 999) or go to the nearest emergency department right now.`;

    const latencyMs = Date.now() - (startTime || Date.now());

    let assistantMsg = { id: null };
    try {
      const [, msg] = await Promise.all([
        encounterRepo.updateEncounterStatus(encounterId, {
          status: 'high_risk',
          riskLevel: 'high',
          flaggedForReview: true,
          summary: `EMERGENCY ALERT: ${emergencyDetails?.trigger}`,
        }),
        encounterRepo.appendMessage(encounterId, patientId, {
          role: 'assistant',
          content: alertResponse,
          meta: { emergency: true, trigger: emergencyDetails?.trigger },
          latencyMs,
        }),
      ]);
      assistantMsg = msg;
    } catch (err) {
      logger.error('Failed to persist emergency encounter status', { error: err.message });
    }

    const resultDto = ClinicalTriageMapper.toChatResponseDto({
      encounterId,
      role: 'assistant',
      content: alertResponse,
      riskLevel: 'high',
      status: 'high_risk',
      messageId: assistantMsg?.id,
      latencyMs,
      emergencyFlag: true,
      trigger: emergencyDetails?.trigger,
    });

    return {
      finalResponse: alertResponse,
      resultDto,
    };
  };
}

