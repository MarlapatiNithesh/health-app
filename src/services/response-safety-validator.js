import { logger } from '../logger.js';

const DIAGNOSIS_PATTERNS = [
  /\byou\s+have\s+(a\s+)?(confirmed|diagnosed)\b/i,
  /\bmy\s+diagnosis\s+is\b/i,
  /\bthis\s+is\s+definitively\b/i,
  /\bI\s+can\s+confirm\s+you\s+have\b/i,
];

const DOSAGE_PRESCRIPTION_PATTERNS = [
  /\btake\s+\d+\s*(mg|ml|mcg|units?|tablets?|capsules?|drops?)\b/i,
  /\bprescribe\s+(you\s+)?\d+\s*mg\b/i,
  /\byour\s+dose\s+(should\s+be|is)\s+\d+/i,
  /\bincrease\s+your\s+(dose|dosage)\s+to\s+\d+/i,
  /\bstop\s+taking\s+\w+\s+immediately\b/i,       
];

const EMERGENCY_SIGNAL_PATTERNS = [
  /call\s+(911|112|999|emergency)/i,
  /go\s+to\s+the\s+ER\b/i,
  /emergency\s+department/i,
];

const DISCLAIMER_PHRASES = [
  /consult\s+(a\s+)?(doctor|physician|healthcare|medical\s+professional)/i,
  /seek\s+medical/i,
  /not\s+a\s+substitute\s+for\s+(medical|professional)/i,
  /speak\s+(to|with)\s+(your|a)\s+(doctor|physician|healthcare)/i,
];

export class ResponseSafetyValidator {
  constructor({ strictMode = false } = {}) {
    this.strictMode = strictMode;
  }

  validate(response = '', { patientContext = {}, symptomState = null, isSymptomAssessment = false, nextRequiredField = null } = {}) {
    if (!response || typeof response !== 'string') {
      return { status: 'BLOCK', reason: 'Empty or invalid response from LLM' };
    }

    for (const pattern of DIAGNOSIS_PATTERNS) {
      if (pattern.test(response)) {
        logger.warn('ResponseSafetyValidator: BLOCK — definitive diagnosis pattern detected', { pattern: pattern.toString() });
        return {
          status: 'BLOCK',
          reason: 'Response contains a definitive diagnosis statement, which is prohibited. MediBot can only provide informational guidance.',
        };
      }
    }

    for (const pattern of DOSAGE_PRESCRIPTION_PATTERNS) {
      if (pattern.test(response)) {
        logger.warn('ResponseSafetyValidator: REVISE — dosage prescription pattern detected', { pattern: pattern.toString() });

        const revisedContent = this.#appendSafetyDisclaimer(response);
        return {
          status: 'REVISE',
          reason: 'Response contains specific dosage instructions. Disclaimer appended.',
          revisedContent,
        };
      }
    }

    if (isSymptomAssessment && nextRequiredField && symptomState?.primarySymptom) {
      const questionCount = this.#countQuestions(response);
      if (questionCount > 2) {
        logger.warn('ResponseSafetyValidator: REVISE — multiple questions detected during symptom assessment', { questionCount });

        return {
          status: 'REVISE',
          reason: `Response contained ${questionCount} questions during symptom assessment. Expected 1.`,
          revisedContent: response, 
        };
      }
    }

    const isGivingClinicalGuidance = this.#isClinicalGuidanceResponse(response) && !isSymptomAssessment;
    if (isGivingClinicalGuidance) {
      const hasCitation = /\[(Record|Source):[^\]]+\]/i.test(response);
      if (!hasCitation) {
        logger.info('ResponseSafetyValidator: REVISE — clinical guidance missing citation');
        return {
          status: 'REVISE',
          reason: 'Clinical guidance response missing source citation.',
          revisedContent: response + '\n\n*Please verify with your healthcare provider as this response lacks a specific medical record or guideline citation.*',
        };
      }

      const hasDisclaimer = DISCLAIMER_PHRASES.some((p) => p.test(response));
      if (!hasDisclaimer) {
        logger.info('ResponseSafetyValidator: REVISE — clinical guidance missing disclaimer, appending');
        return {
          status: 'REVISE',
          reason: 'Clinical guidance response missing professional consultation disclaimer.',
          revisedContent: this.#appendSafetyDisclaimer(response),
        };
      }
    }

    if (this.strictMode && patientContext?.activeMedications) {
      const groundingResult = this.#checkMedicationGrounding(response, patientContext);
      if (!groundingResult.grounded) {
        logger.warn('ResponseSafetyValidator: REVISE — ungrounded medication reference', { ungroundedMeds: groundingResult.ungroundedMeds });
        return {
          status: 'REVISE',
          reason: `Response references medications not in patient records: ${groundingResult.ungroundedMeds.join(', ')}`,
          revisedContent: response,
        };
      }
    }

    logger.debug('ResponseSafetyValidator: PASS');
    return { status: 'PASS' };
  }

  #countQuestions(text) {
    const questionMarks = (text.match(/\?/g) || []).length;
    return questionMarks;
  }

  #isClinicalGuidanceResponse(text) {
    const clinicalTerms = [
      /\bsymptom/i, /\bmedication/i, /\btreatment/i, /\bdiagnos/i,
      /\bprescri/i, /\blab\s+result/i, /\btest\s+result/i, /\bcondition/i,
      /\bblood\s+pressure/i, /\bsugar\s+level/i, /\bcholesterol/i,
    ];
    return clinicalTerms.some((p) => p.test(text));
  }

  #appendSafetyDisclaimer(text) {
    const disclaimer = '\n\n---\n⚕️ *This information is for educational purposes only and is not a substitute for professional medical advice. Please consult your doctor or a qualified healthcare professional before making any changes to your treatment or medication.*';
    if (DISCLAIMER_PHRASES.some((p) => p.test(text))) return text; 
    return text + disclaimer;
  }

  #checkMedicationGrounding(text, patientContext) {

    const patientMedNames = new Set(
      (patientContext.activeMedications || []).map((m) => (m.name || '').toLowerCase())
    );

    const commonMedPatterns = /\b([A-Z][a-z]+(?:mab|nib|ine|ide|one|cin|zole|pril|sartan|olol|statin))\b/g;
    const mentioned = [...(text.matchAll(commonMedPatterns) || [])].map((m) => m[1].toLowerCase());

    const ungroundedMeds = mentioned.filter((m) => !patientMedNames.has(m) && !patientMedNames.has(m));

    return {
      grounded: ungroundedMeds.length === 0,
      ungroundedMeds,
    };
  }
}

export default ResponseSafetyValidator;

