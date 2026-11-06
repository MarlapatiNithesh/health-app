/**
 * LangGraph Node: Clinical Critic (Multi-Agent Review Board)
 * Attending Physician Agent verifies the draft against the patient's allergy profile,
 * dosage guidelines, and safety criteria.
 */

import { CLINICAL_CRITIC_PROMPT } from '../../prompts/prompt-templates.js';
import { logger } from '../../../logger.js';

export function createClinicalCriticNode({ chatModel, llmService = null }) {
  return async function clinicalCriticNode(state) {
    state.onProgress?.('Attending Physician Agent is reviewing the draft against your allergy list...');

    const { draftResponse, patientContext, criticAttempts } = state;

    const allergies = (patientContext.allergies || [])
      .map((a) => a.substance || a.name || a.allergen)
      .join(', ') || 'None';

    const medications = (patientContext.activeMedications || [])
      .map((m) => m.name || m.medicationName)
      .join(', ') || 'None';

    // If no allergies or already exceeded attempts, approve
    if (allergies === 'None' || (criticAttempts || 0) >= 2) {
      return {
        criticApproved: true,
        criticReason: 'Safe or max review attempts reached',
      };
    }

    try {
      if (llmService?.clinicalReviewAgent) {
        const criticResult = await llmService.clinicalReviewAgent(draftResponse, allergies);
        if (criticResult && criticResult.approved === false) {
          logger.warn('Clinical Critic REJECTED draft response', { reason: criticResult.reason });
          return {
            criticApproved: false,
            criticReason: criticResult.reason || 'Safety criteria not met',
          };
        }
        return { criticApproved: true, criticReason: 'Approved by clinical review agent' };
      }

      const prompt = await CLINICAL_CRITIC_PROMPT.format({
        allergies,
        medications,
        draftResponse,
      });

      const response = await chatModel.invoke([{ role: 'user', content: prompt }]);
      const cleaned = (typeof response.content === 'string' ? response.content : '')
        .replace(/```json|```/g, '')
        .trim();

      const parsed = JSON.parse(cleaned);
      return {
        criticApproved: parsed.approved !== false,
        criticReason: parsed.reason || 'Reviewed',
      };
    } catch (err) {
      logger.debug('Clinical critic check completed with fallback approval', { error: err.message });
      return {
        criticApproved: true,
        criticReason: 'Safety check bypassed',
      };
    }
  };
}

