import { logger } from '../logger.js';

/**
 * SymptomPriorityService
 *
 * Implements the Clinical Priority Table from Phase 5 of the MediBot implementation plan.
 * Determines the NEXT highest-priority uncollected symptom field for each symptom type.
 * This drives the one-question-per-turn adaptive questioning loop.
 *
 * Rules:
 *  - Priority tables are clinician-ordered (most diagnostically important fields first)
 *  - The LLM is NEVER allowed to decide which field to ask about next
 *  - This service always returns the single next field, or null when assessment is complete
 */

// ── Clinical Priority Tables ───────────────────────────────────────────────────
// Each array is ordered: index 0 = highest clinical priority
const SYMPTOM_PRIORITY_TABLE = {
  chest_pain: [
    'radiation',        // Arm/jaw/back radiation is the #1 differentiator for cardiac
    'associatedSymptoms', // Breathlessness, sweating, nausea
    'severity',         // 0-10 scale
    'character',        // Sharp / dull / pressure / squeezing
    'onset',            // Sudden vs gradual
    'aggravatingFactors', // Exertion, deep breath
    'relievingFactors', // Rest, GTN, position
    'duration',         // Seconds vs minutes vs hours
    'location',         // Precordial, epigastric
  ],
  headache: [
    'severity',
    'character',        // Throbbing / pressure / sudden thunderclap
    'location',         // Unilateral, bilateral, occipital
    'onset',            // Sudden "thunderclap" is red flag
    'duration',
    'associatedSymptoms', // Visual changes, nausea, fever, neck stiffness
    'radiation',        // Neck
    'aggravatingFactors', // Light, sound, bending
    'relievingFactors', // Rest, dark room
  ],
  abdominal_pain: [
    'location',         // RUQ, LUQ, RLQ, LLQ, periumbilical, diffuse
    'severity',
    'character',        // Crampy / constant / colicky / burning
    'onset',
    'duration',
    'associatedSymptoms', // Nausea, vomiting, fever, diarrhoea, constipation
    'radiation',        // Back, shoulder tip
    'aggravatingFactors', // Eating, movement
    'relievingFactors', // Fasting, antacids, position
  ],
  back_pain: [
    'location',         // Lumbar, thoracic, cervical
    'radiation',        // Sciatica pattern, groin
    'severity',
    'onset',
    'character',        // Dull ache / sharp / electric
    'aggravatingFactors', // Movement, bending, lifting
    'relievingFactors', // Rest, position
    'associatedSymptoms', // Numbness, weakness, bladder/bowel changes
    'duration',
  ],
  breathlessness: [
    'onset',            // Sudden vs gradual
    'severity',
    'associatedSymptoms', // Chest pain, wheeze, cough, ankle swelling
    'aggravatingFactors', // Exertion, lying flat
    'relievingFactors', // Sitting up, bronchodilators
    'character',        // Wheeze / stridor / no wheeze
    'duration',
    'radiation',
    'location',
  ],
  fever: [
    'severity',         // Temperature reading if known
    'duration',
    'onset',
    'associatedSymptoms', // Rigors, headache, rash, cough, dysuria, sore throat
    'character',        // Continuous / intermittent / night sweats
    'location',
    'aggravatingFactors',
    'relievingFactors',
    'radiation',
  ],
  cough: [
    'character',        // Dry / productive / barking / whooping
    'duration',
    'onset',
    'associatedSymptoms', // Haemoptysis, fever, breathlessness, wheeze, weight loss
    'aggravatingFactors', // Cold air, lying down, eating
    'relievingFactors',
    'severity',
    'location',
    'radiation',
  ],
  dizziness: [
    'character',        // Vertigo (room spinning) vs presyncope (lightheaded)
    'onset',
    'duration',         // Seconds / minutes / constant
    'associatedSymptoms', // Tinnitus, hearing loss, nausea, palpitations, vision changes
    'aggravatingFactors', // Head movements, standing up, turning
    'relievingFactors',
    'severity',
    'location',
    'radiation',
  ],
  joint_pain: [
    'location',         // Which joint(s)
    'onset',
    'character',        // Hot / swollen / stiff / clicking
    'severity',
    'duration',
    'associatedSymptoms', // Rash, fever, eye changes, skin changes
    'aggravatingFactors', // Movement, morning stiffness
    'relievingFactors',
    'radiation',
  ],
  hypoglycemia: [
    'associatedSymptoms', // Sweating, shaking, confusion, palpitations (CRITICAL)
    'onset',            // How fast did it happen?
    'severity',         // Loss of consciousness?
    'relievingFactors', // Did eating sugar help?
    'duration',         // How long did the episode last?
    'aggravatingFactors', // Missed meal, extra insulin, exercise
  ],
  hyperglycemia: [
    'associatedSymptoms', // Thirst (polydipsia), frequent urination (polyuria), blurred vision
    'onset',            // Gradual vs sudden
    'severity',         // Current glucose reading if known
    'duration',
    'aggravatingFactors', // Missed medication, illness/infection
    'relievingFactors',
  ],
  diabetic_neuropathy: [
    'location',         // Feet, hands, bilateral vs unilateral
    'character',        // Tingling, burning, numbness, sharp pain
    'severity',
    'onset',            // Gradual
    'duration',
    'associatedSymptoms', // Foot ulcers, skin changes, weakness
    'aggravatingFactors', // Nighttime, touch
    'relievingFactors',
    'radiation',
  ],
  default: [
    'severity',
    'duration',
    'onset',
    'character',
    'location',
    'radiation',
    'associatedSymptoms',
    'aggravatingFactors',
    'relievingFactors',
  ],
};

// Maps symptom keywords to priority table keys
const SYMPTOM_KEYWORD_MAP = [
  { key: 'chest_pain',     patterns: ['chest pain', 'chest ache', 'chest tight', 'chest pressure', 'heart', 'cardiac'] },
  { key: 'headache',       patterns: ['headache', 'head pain', 'migraine', 'head ache', 'head hurts', 'skull'] },
  { key: 'abdominal_pain', patterns: ['stomach', 'abdomen', 'abdominal', 'belly', 'tummy', 'gut', 'bowel'] },
  { key: 'back_pain',      patterns: ['back pain', 'backache', 'lumbar', 'spine', 'back ache', 'back hurts'] },
  { key: 'breathlessness', patterns: ['breath', 'breathless', 'dyspnea', 'shortness', 'wheeze', 'asthma'] },
  { key: 'fever',          patterns: ['fever', 'temperature', 'febrile', 'chills', 'rigor'] },
  { key: 'cough',          patterns: ['cough', 'coughing'] },
  { key: 'dizziness',      patterns: ['dizzy', 'dizziness', 'vertigo', 'lightheaded', 'faint', 'spinning'] },
  { key: 'joint_pain',     patterns: ['joint', 'knee', 'hip', 'shoulder', 'wrist', 'ankle', 'arthritis', 'rheumat'] },
  { key: 'hypoglycemia',   patterns: ['shaking', 'sweating', 'hypo', 'low blood sugar', 'low sugar', 'confused', 'faint'] },
  { key: 'hyperglycemia',  patterns: ['thirsty', 'thirst', 'urination', 'peeing a lot', 'high blood sugar', 'high sugar', 'blurry vision', 'blurred vision'] },
  { key: 'diabetic_neuropathy', patterns: ['tingling', 'numb', 'numbness', 'burning feet', 'foot pain', 'pins and needles'] },
];

// Human-readable labels for each field (used in LLM prompt instructions)
export const FIELD_LABELS = {
  primarySymptom:     'the main symptom the patient is experiencing',
  severity:           'how severe the symptom is (0 = none, 10 = worst imaginable)',
  duration:           'how long the symptom has been present',
  onset:              'how the symptom started (sudden or gradual)',
  character:          'what the symptom feels like (e.g. sharp, dull, throbbing, pressure)',
  location:           'exactly where in the body the symptom is felt',
  radiation:          'whether the symptom spreads or radiates to another area',
  aggravatingFactors: 'anything that makes the symptom worse',
  relievingFactors:   'anything that makes the symptom better',
  associatedSymptoms: 'any other symptoms occurring alongside the main one',
};

// Natural question templates per field (LLM can use or rephrase naturally)
export const FIELD_QUESTION_TEMPLATES = {
  primarySymptom:     'What is the main symptom you are experiencing today?',
  severity:           'On a scale from 0 to 10, where 0 is no discomfort and 10 is the worst you have felt, how severe is it right now?',
  duration:           'How long have you been experiencing this? (e.g. a few hours, 2 days, a week)',
  onset:              'Did this come on suddenly, or did it develop gradually over time?',
  character:          'Can you describe what it feels like? (e.g. sharp, dull, throbbing, pressure, burning)',
  location:           'Can you point to exactly where you feel it?',
  radiation:          'Does the discomfort spread or radiate anywhere else in your body?',
  aggravatingFactors: 'Is there anything that makes it worse — such as movement, eating, breathing deeply, or stress?',
  relievingFactors:   'Is there anything that makes it better — such as rest, a particular position, or any medication?',
  associatedSymptoms: 'Are you experiencing any other symptoms alongside this — such as nausea, fever, dizziness, or shortness of breath?',
};

// Minimum fields required for completeness gate
const REQUIRED_FIELDS = new Set(['severity', 'duration', 'onset', 'character']);

export class SymptomPriorityService {
  /**
   * Normalise the reported symptom name to a priority table key.
   */
  normaliseSymptom(symptomName = '') {
    if (!symptomName) return 'default';
    const lower = symptomName.toLowerCase().trim();
    for (const { key, patterns } of SYMPTOM_KEYWORD_MAP) {
      if (patterns.some((p) => lower.includes(p))) return key;
    }
    return 'default';
  }

  /**
   * Get the ordered priority list for a symptom.
   */
  getPriorityList(symptomName) {
    const key = this.normaliseSymptom(symptomName);
    return SYMPTOM_PRIORITY_TABLE[key] || SYMPTOM_PRIORITY_TABLE.default;
  }

  /**
   * Determine the next highest-priority uncollected field.
   * Returns null when all high-priority fields have been collected (assessment complete).
   */
  getNextField(symptomState = {}) {
    // If we don't even know the primary symptom yet, that's the first question
    if (!symptomState.primarySymptom) return 'primarySymptom';

    const priorityList = this.getPriorityList(symptomState.primarySymptom);

    for (const field of priorityList) {
      const val = symptomState[field];
      const isEmpty = val === null || val === undefined || val === '' ||
        (Array.isArray(val) && val.length === 0);
      if (isEmpty) return field;
    }

    return null; // All fields collected — assessment complete
  }

  /**
   * Check whether the required minimum fields have been collected
   * (even if not all optional fields are done).
   */
  isMinimumComplete(symptomState = {}) {
    if (!symptomState.primarySymptom) return false;
    return [...REQUIRED_FIELDS].every((f) => {
      const val = symptomState[f];
      return val !== null && val !== undefined && val !== '';
    });
  }

  /**
   * Check whether all priority fields for this symptom have been collected.
   */
  isFullyComplete(symptomState = {}) {
    return this.getNextField(symptomState) === null;
  }

  /**
   * Build the adaptive questioning instruction block for the system prompt.
   * Tells the LLM exactly what to ask about in this turn.
   */
  buildSymptomAssessmentBlock(symptomState = {}) {
    if (!symptomState || Object.keys(symptomState).length === 0) return '';

    const nextField = this.getNextField(symptomState);
    const collectedFields = Object.entries(symptomState)
      .filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
      .map(([k, v]) => `  • ${FIELD_LABELS[k] || k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('\n');

    const lines = [
      '════════════════════════════════════════════════════════════════════════════════',
      'ACTIVE SYMPTOM ASSESSMENT (Doctor-Patient Adaptive Questioning)',
      `Primary Symptom: ${symptomState.primarySymptom || 'Not yet determined'}`,
    ];

    if (collectedFields) {
      lines.push('', 'Information collected so far:', collectedFields);
    }

    if (nextField) {
      const template = FIELD_QUESTION_TEMPLATES[nextField] || `Please ask about: ${nextField}`;
      lines.push(
        '',
        `NEXT REQUIRED FIELD: "${nextField}"`,
        `What this field means: ${FIELD_LABELS[nextField] || nextField}`,
        `Suggested question template: "${template}"`,
        '',
        '⚠️  CRITICAL INSTRUCTION FOR THIS TURN:',
        `You MUST ask EXACTLY ONE question to determine the patient's "${FIELD_LABELS[nextField] || nextField}".`,
        'Do NOT ask about any other symptom field.',
        'Do NOT provide a diagnosis, clinical conclusion, or treatment recommendation yet.',
        'Do NOT bundle multiple questions into one response.',
        'Phrase the question warmly and naturally, like a caring doctor.',
        'You may briefly acknowledge what the patient just told you before asking.',
      );
    } else {
      lines.push(
        '',
        'STATUS: All required symptom fields collected.',
        'INSTRUCTION: Proceed to provide personalised informational guidance.',
        'Ground your guidance in the patient\'s records and symptom assessment above.',
        'Include a clear recommendation to consult a healthcare professional.',
        'Cite sources where available.',
        'Do NOT provide a definitive diagnosis.',
      );
    }

    lines.push('════════════════════════════════════════════════════════════════════════════════');
    return lines.join('\n');
  }

  /**
   * Determine whether the current message is likely a symptom report
   * (so we know whether to activate the symptom assessment flow).
   */
  isSymptomReport(text = '') {
    const lower = text.toLowerCase();
    const symptomKeywords = [
      'pain', 'ache', 'hurt', 'fever', 'cough', 'breathless', 'dizzy',
      'nausea', 'vomit', 'swelling', 'rash', 'bleeding', 'chest', 'headache',
      'migraine', 'fatigue', 'tired', 'weak', 'palpitation', 'shortness',
      'sore', 'discharge', 'itching', 'burning', 'cramp', 'spasm',
    ];
    return symptomKeywords.some((kw) => lower.includes(kw));
  }

  /**
   * Perform the final risk assessment once the symptom state is complete.
   * Returns { riskLevel, triggeredRules, summary }
   */
  assessRisk(symptomState = {}, patientContext = {}) {
    const rules = [];
    let riskLevel = 'low';

    const s = symptomState;
    const conditions = (patientContext.activeConditions || []).map((c) => (c.name || '').toLowerCase());
    const meds = (patientContext.activeMedications || []).map((m) => (m.name || '').toLowerCase());

    // Cardiac red flags
    if ((s.primarySymptom || '').toLowerCase().includes('chest')) {
      if (s.radiation && /arm|jaw|shoulder|back/i.test(String(s.radiation))) {
        riskLevel = 'high';
        rules.push('chest_pain_with_radiation — possible ACS');
      }
      if (s.associatedSymptoms && Array.isArray(s.associatedSymptoms) &&
          s.associatedSymptoms.some((sym) => /breath|sweat|nausea/i.test(sym))) {
        riskLevel = 'high';
        rules.push('chest_pain_with_systemic_symptoms — possible ACS');
      }
    }

    // Neurological red flags
    if ((s.primarySymptom || '').toLowerCase().includes('head')) {
      if (s.onset && /sudden|thunder|worst.*life/i.test(String(s.onset))) {
        riskLevel = 'high';
        rules.push('sudden_onset_headache — exclude SAH');
      }
      if (s.associatedSymptoms && Array.isArray(s.associatedSymptoms) &&
          s.associatedSymptoms.some((sym) => /vision|speech|weakness|numb|neck.*stiff/i.test(sym))) {
        if (riskLevel !== 'high') riskLevel = 'medium';
        rules.push('headache_with_neurological_signs — clinical evaluation required');
      }
    }

    // Severity-based escalation
    const sev = Number(s.severity);
    if (sev >= 9) {
      if (riskLevel !== 'high') riskLevel = 'medium';
      rules.push(`very_high_severity_${sev} — clinical evaluation warranted`);
    }

    // Chronic condition context
    if (conditions.some((c) => /diabet/i.test(c))) {
      if ((s.primarySymptom || '').toLowerCase().includes('chest')) {
        rules.push('diabetic_patient_with_chest_pain — atypical presentation possible');
        riskLevel = 'high';
      }
      
      // Hypoglycemia check
      if (this.normaliseSymptom(s.primarySymptom) === 'hypoglycemia') {
        if (s.associatedSymptoms && Array.isArray(s.associatedSymptoms) && s.associatedSymptoms.some(sym => /confus|faint|pass/i.test(sym))) {
          rules.push('severe_hypoglycemia_with_cns_symptoms — immediate medical attention required');
          riskLevel = 'high';
        } else if (riskLevel !== 'high') {
          riskLevel = 'medium';
          rules.push('symptomatic_hypoglycemia — fast-acting carbs required');
        }
      }

      // Neuropathy check
      if (this.normaliseSymptom(s.primarySymptom) === 'diabetic_neuropathy') {
        if (s.associatedSymptoms && Array.isArray(s.associatedSymptoms) && s.associatedSymptoms.some(sym => /ulcer|wound|black|color/i.test(sym))) {
          rules.push('neuropathy_with_potential_ulceration — urgent podiatry/medical review');
          riskLevel = 'high';
        }
      }
    }

    const symptomType = this.normaliseSymptom(s.primarySymptom);
    let summary = '';
    if (riskLevel === 'high') {
      summary = `High-risk ${s.primarySymptom || 'symptom'} assessment. Immediate clinical evaluation recommended. Rules triggered: ${rules.join('; ')}.`;
    } else if (riskLevel === 'medium') {
      summary = `Moderate-risk ${s.primarySymptom || 'symptom'} assessment. Medical review within 24 hours advisable.`;
    } else {
      summary = `Low-risk ${s.primarySymptom || 'symptom'} assessment. Monitor symptoms and seek care if worsening.`;
    }

    logger.debug('SymptomPriorityService.assessRisk', { riskLevel, rules, symptomType });
    return { riskLevel, triggeredRules: rules, summary, symptomType };
  }
}

export default SymptomPriorityService;
