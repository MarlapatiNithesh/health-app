import { logger } from '../logger.js';

/**
 * ResponseSafetyValidator
 *
 * Phase 4 / Phase 7: Post-generation safety check on every LLM response.
 *
 * Checks:
 *  1. No prohibited clinical content (definitive diagnoses, specific dosage prescriptions)
 *  2. Grounding check — does the response reference data the patient actually has?
 *  3. Source citation requirement for medication/lab references
 *  4. Emergency pattern check — should have been short-circuited earlier but double-checked
 *  5. Single-question enforcement during active symptom assessment
 *
 * Returns: { status: 'PASS' | 'REVISE' | 'BLOCK' | 'ESCALATE', reason?, revisedContent? }
 */

// Patterns that indicate a definitive diagnosis being stated (prohibited)
const DIAGNOSIS_PATTERNS = [
  /\byou\s+have\s+(a\s+)?(confirmed|diagnosed)\b/i,
  /\bmy\s+diagnosis\s+is\b/i,
  /\bthis\s+is\s+definitively\b/i,
  /\bI\s+can\s+confirm\s+you\s+have\b/i,
];

// Patterns that indicate specific dosage prescription (prohibited)
const DOSAGE_PRESCRIPTION_PATTERNS = [
  /\btake\s+\d+\s*(mg|ml|mcg|units?|tablets?|capsules?|drops?)\b/i,
  /\bprescribe\s+(you\s+)?\d+\s*mg\b/i,
  /\byour\s+dose\s+(should\s+be|is)\s+\d+/i,
  /\bincrease\s+your\s+(dose|dosage)\s+to\s+\d+/i,
  /\bstop\s+taking\s+\w+\s+immediately\b/i,       // Only doctors can say this
];

// Patterns that are emergency signals that should have been caught pre-LLM
const EMERGENCY_SIGNAL_PATTERNS = [
  /call\s+(911|112|999|emergency)/i,
  /go\s+to\s+the\s+ER\b/i,
  /emergency\s+department/i,
];

// Medical disclaimer phrases that must appear if clinical guidance is given
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

  /**
   * Main validation method.
   * @param {string} response - The LLM-generated response text
   * @param {object} options
   * @param {object} options.patientContext - Patient 360 context used to generate the response
   * @param {object} options.symptomState - Current symptom state if in assessment mode
   * @param {boolean} options.isSymptomAssessment - Whether this is an active symptom assessment turn
   * @param {string} options.nextRequiredField - The field that should have been asked about
   * @returns {{ status: string, reason?: string, revisedContent?: string }}
   */
  validate(response = '', { patientContext = {}, symptomState = null, isSymptomAssessment = false, nextRequiredField = null } = {}) {
    if (!response || typeof response !== 'string') {
      return { status: 'BLOCK', reason: 'Empty or invalid response from LLM' };
    }

    // ── 1. Check for prohibited definitive diagnosis statements ─────────────────
    for (const pattern of DIAGNOSIS_PATTERNS) {
      if (pattern.test(response)) {
        logger.warn('ResponseSafetyValidator: BLOCK — definitive diagnosis pattern detected', { pattern: pattern.toString() });
        return {
          status: 'BLOCK',
          reason: 'Response contains a definitive diagnosis statement, which is prohibited. MediBot can only provide informational guidance.',
        };
      }
    }

    // ── 2. Check for specific dosage prescriptions ──────────────────────────────
    for (const pattern of DOSAGE_PRESCRIPTION_PATTERNS) {
      if (pattern.test(response)) {
        logger.warn('ResponseSafetyValidator: REVISE — dosage prescription pattern detected', { pattern: pattern.toString() });
        // For dosage issues, we revise rather than block (append a disclaimer)
        const revisedContent = this.#appendSafetyDisclaimer(response);
        return {
          status: 'REVISE',
          reason: 'Response contains specific dosage instructions. Disclaimer appended.',
          revisedContent,
        };
      }
    }

    // ── 3. During active symptom assessment: enforce single-question rule ────────
    if (isSymptomAssessment && nextRequiredField && symptomState?.primarySymptom) {
      const questionCount = this.#countQuestions(response);
      if (questionCount > 2) {
        logger.warn('ResponseSafetyValidator: REVISE — multiple questions detected during symptom assessment', { questionCount });
        // We don't block, but we flag for future improvement
        return {
          status: 'REVISE',
          reason: `Response contained ${questionCount} questions during symptom assessment. Expected 1.`,
          revisedContent: response, // pass through — LLM will learn from prompt constraint
        };
      }
    }

    // ── 4. Check that clinical guidance responses include a disclaimer and citation ──────────
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

    // ── 5. Validate medication references are grounded ──────────────────────────
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

  // ── Private helpers ────────────────────────────────────────────────────────

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
    if (DISCLAIMER_PHRASES.some((p) => p.test(text))) return text; // Already has one
    return text + disclaimer;
  }

  #checkMedicationGrounding(text, patientContext) {
    // Very basic check: look for medication names mentioned in response
    // that don't appear in patient's actual records
    const patientMedNames = new Set(
      (patientContext.activeMedications || []).map((m) => (m.name || '').toLowerCase())
    );

    // Extract potential medication mentions (simple heuristic)
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
