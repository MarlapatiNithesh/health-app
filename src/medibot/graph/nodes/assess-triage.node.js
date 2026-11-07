/**
 * LangGraph Node: Assess Triage
 * Evaluates clinical priority rules, determines the single next required inquiry field,
 * and performs clinical risk assessment when minimum data collection is met.
 */

import { logger } from '../../../logger.js';

export function createAssessTriageNode({ symptomPriorityService, encounterRepo }) {
  return async function assessTriageNode(state) {
    const { patientId, encounterId, isSymptomIntent, symptomState, patientContext } = state;

    if (!isSymptomIntent) {
      return {
        nextField: null,
        assessmentComplete: false,
        riskAssessment: null,
      };
    }

    const nextField = symptomPriorityService?.getNextField?.(symptomState) || null;
    const assessmentComplete = symptomPriorityService?.isMinimumComplete?.(symptomState) || false;

    let riskAssessment = null;
    if (assessmentComplete && !symptomState?.riskAssessed) {
      riskAssessment = symptomPriorityService?.assessRisk?.(symptomState, patientContext) || null;
      logger.info('AssessTriageNode: symptom assessment complete, risk assessed', {
        riskLevel: riskAssessment?.riskLevel,
        rules: riskAssessment?.triggeredRules,
      });

      if (riskAssessment?.riskLevel === 'high') {
        await encounterRepo?.updateEncounterStatus?.(encounterId, {
          riskLevel: 'high',
          flaggedForReview: true,
        }).catch(() => {});
      } else if (riskAssessment?.riskLevel === 'medium') {
        await encounterRepo?.updateEncounterStatus?.(encounterId, { riskLevel: 'medium' }).catch(() => {});
      }

      const updatedWithRisk = {
        ...symptomState,
        riskAssessed: true,
        riskLevel: riskAssessment?.riskLevel,
        triggeredRules: riskAssessment?.triggeredRules,
      };

      await encounterRepo?.upsertSymptomState?.(encounterId, patientId, updatedWithRisk).catch(() => {});

      return {
        nextField,
        assessmentComplete,
        riskAssessment,
        symptomState: updatedWithRisk,
      };
    }

    return {
      nextField,
      assessmentComplete,
      riskAssessment,
    };
  };
}

