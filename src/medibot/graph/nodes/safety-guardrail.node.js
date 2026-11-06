/**
 * LangGraph Node: Safety Guardrail
 * Post-generation safety validation to ensure compliance with clinical guidance boundaries
 * and append medical disclaimers.
 */

import { logger } from '../../../logger.js';

export function createSafetyGuardrailNode({ responseSafetyValidator }) {
  return async function safetyGuardrailNode(state) {
    state.onProgress?.('Validating response safety guardrails...');

    const { draftResponse, patientContext, symptomState, isSymptomIntent, assessmentComplete, nextField } = state;

    let finalContent = draftResponse || '';

    const validation = responseSafetyValidator?.validate?.(finalContent, {
      patientContext,
      symptomState,
      isSymptomAssessment: isSymptomIntent && !assessmentComplete,
      nextRequiredField: nextField,
    }) || { status: 'PASS' };

    if (validation.status === 'REVISE' && validation.revisedContent) {
      finalContent = validation.revisedContent;
      logger.info('SafetyGuardrailNode: response revised', { reason: validation.reason });
    } else if (validation.status === 'BLOCK') {
      logger.warn('SafetyGuardrailNode: response BLOCKED', { reason: validation.reason });
      finalContent = "I'm sorry, I wasn't able to generate an appropriate response for that. Please consult your healthcare provider for specific medical guidance.";
    }

    return {
      validationResult: validation,
      finalResponse: finalContent,
    };
  };
}

