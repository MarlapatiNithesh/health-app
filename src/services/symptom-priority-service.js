import { logger } from '../logger.js';

const SYMPTOM_PRIORITY_TABLE = {
  chest_pain: [
    'radiation',        
    'associatedSymptoms', 
    'severity',         
    'character',        
    'onset',            
    'aggravatingFactors', 
    'relievingFactors', 
    'duration',         
    'location',         
  ],
  headache: [
    'severity',
    'character',        
    'location',         
    'onset',            
    'duration',
    'associatedSymptoms', 
    'radiation',        
    'aggravatingFactors', 
    'relievingFactors', 
  ],
  abdominal_pain: [
    'location',         
    'severity',
    'character',        
    'onset',
    'duration',
    'associatedSymptoms', 
    'radiation',        
    'aggravatingFactors', 
    'relievingFactors', 
  ],
  back_pain: [
    'location',         
    'radiation',        
    'severity',
    'onset',
    'character',        
    'aggravatingFactors', 
    'relievingFactors', 
    'associatedSymptoms', 
    'duration',
  ],
  breathlessness: [
    'onset',            
    'severity',
    'associatedSymptoms', 
    'aggravatingFactors', 
    'relievingFactors', 
    'character',        
    'duration',
    'radiation',
    'location',
  ],
  fever: [
    'severity',         
    'duration',
    'onset',
    'associatedSymptoms', 
    'character',        
    'location',
    'aggravatingFactors',
    'relievingFactors',
    'radiation',
  ],
  cough: [
    'character',        
    'duration',
    'onset',
    'associatedSymptoms', 
    'aggravatingFactors', 
    'relievingFactors',
    'severity',
    'location',
    'radiation',
  ],
  dizziness: [
    'character',        
    'onset',
    'duration',         
    'associatedSymptoms', 
    'aggravatingFactors', 
    'relievingFactors',
    'severity',
    'location',
    'radiation',
  ],
  joint_pain: [
    'location',         
    'onset',
    'character',        
    'severity',
    'duration',
    'associatedSymptoms', 
    'aggravatingFactors', 
    'relievingFactors',
    'radiation',
  ],
  hypoglycemia: [
    'associatedSymptoms', 
    'onset',            
    'severity',         
    'relievingFactors', 
    'duration',         
    'aggravatingFactors', 
  ],
  hyperglycemia: [
    'associatedSymptoms', 
    'onset',            
    'severity',         
    'duration',
    'aggravatingFactors', 
    'relievingFactors',
  ],
  diabetic_neuropathy: [
    'location',         
    'character',        
    'duration',
    'onset',            
    'severity',
    'associatedSymptoms', 
    'aggravatingFactors', 
    'relievingFactors',
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

export const FIELD_QUICK_OPTIONS = {
  primarySymptom: [
    'Headache / Migraine',
    'Chest Pain or Pressure',
    'Stomach / Abdominal Pain',
    'Fever & Body Chills',
    'Cough & Cold',
    'Shortness of Breath',
    'Dizziness & Lightheadedness',
  ],
  severity: [
    'Mild (1 - 3 out of 10)',
    'Moderate (4 - 6 out of 10)',
    'Severe (7 - 9 out of 10)',
    'Critical (10 / 10)',
  ],
  duration: [
    'Just started today (few hours)',
    '1 to 2 days',
    'About a week',
    'More than 2 weeks',
  ],
  onset: [
    'Came on suddenly / abruptly',
    'Developed gradually over time',
  ],
  character: [
    'Throbbing or pounding',
    'Dull ache or continuous pressure',
    'Sharp or stabbing',
    'Burning or stinging',
    'Cramping or squeezing tightness',
  ],
  location: [
    'Specific point on one side',
    'All over / generalized',
    'Front / Forehead',
    'Back / Lower region',
  ],
  radiation: [
    'No, stays in one place',
    'Spreads to the arm or shoulder',
    'Spreads to the neck or jaw',
    'Radiates down the leg or back',
  ],
  aggravatingFactors: [
    'Worse with movement or exertion',
    'Worse after eating or drinking',
    'Worse with bright light or noise',
    'No specific trigger identified',
  ],
  relievingFactors: [
    'Improves with rest or lying down',
    'Improves with pain relief medication',
    'Improves with cold or warm pack',
    'Nothing seems to relieve it',
  ],
  associatedSymptoms: [
    'Nausea or vomiting',
    'Fever or chills',
    'Dizziness or fatigue',
    'No other symptoms',
  ],
};

const REQUIRED_FIELDS = new Set(['severity', 'duration', 'onset', 'character']);

export class SymptomPriorityService {

  extractSymptomFromText(text = '', pendingField = null, existingState = {}) {
    if (!text || typeof text !== 'string') return {};
    const lower = text.toLowerCase().trim();
    const extracted = {};

    if (!existingState.primarySymptom || pendingField === 'primarySymptom') {
      for (const { key, patterns } of SYMPTOM_KEYWORD_MAP) {
        if (patterns.some((p) => lower.includes(p))) {
          extracted.primarySymptom = key.replace(/_/g, ' ');
          break;
        }
      }
    }

    const numMatch = lower.match(/\b([0-9]|10)\s*(?:\/10|out of 10)?\b/);
    if (lower.includes('mild') || lower.includes('1 - 3') || lower.includes('1-3')) {
      extracted.severity = 2;
    } else if (lower.includes('moderate') || lower.includes('4 - 6') || lower.includes('4-6')) {
      extracted.severity = 5;
    } else if (lower.includes('severe') || lower.includes('7 - 9') || lower.includes('7-9')) {
      extracted.severity = 8;
    } else if (lower.includes('critical') || lower.includes('worst') || lower.includes('10/10') || lower.includes('10 / 10')) {
      extracted.severity = 10;
    } else if (pendingField === 'severity' && numMatch) {
      extracted.severity = parseInt(numMatch[1], 10);
    } else if (numMatch && (lower.includes('severity') || lower.includes('/10') || lower.includes('scale'))) {
      extracted.severity = parseInt(numMatch[1], 10);
    }

    const durMatch = lower.match(/\b(\d+)\s*(days?|weeks?|months?|hours?|minutes?|years?)\b/);
    if (durMatch) {
      extracted.duration = `${durMatch[1]} ${durMatch[2]}`;
    } else if (lower.includes('today') || lower.includes('few hours') || lower.includes('just started')) {
      extracted.duration = 'few hours';
    } else if (lower.includes('yesterday')) {
      extracted.duration = '1 day';
    } else if (lower.includes('1 to 2 days') || lower.includes('1-2 days') || lower.includes('couple of days') || lower.includes('few days')) {
      extracted.duration = '2 days';
    } else if (lower.includes('week') || lower.includes('about a week')) {
      extracted.duration = '1 week';
    } else if (lower.includes('month')) {
      extracted.duration = '1 month';
    } else if (pendingField === 'duration' && text.length > 1 && text.length < 80) {
      extracted.duration = text.trim();
    }

    if (lower.includes('sudden') || lower.includes('abrupt') || lower.includes('all of a sudden') || lower.includes('fast')) {
      extracted.onset = 'sudden';
    } else if (lower.includes('gradual') || lower.includes('slowly') || lower.includes('over time')) {
      extracted.onset = 'gradual';
    } else if (pendingField === 'onset' && text.length > 1 && text.length < 80) {
      extracted.onset = text.trim();
    }

    if (lower.includes('throb') || lower.includes('pound')) {
      extracted.character = 'throbbing';
    } else if (lower.includes('sharp') || lower.includes('stab')) {
      extracted.character = 'sharp';
    } else if (lower.includes('dull') || lower.includes('ache') || lower.includes('pressure')) {
      extracted.character = 'dull ache';
    } else if (lower.includes('burn') || lower.includes('sting')) {
      extracted.character = 'burning';
    } else if (lower.includes('cramp') || lower.includes('squeeze') || lower.includes('tight')) {
      extracted.character = 'cramping / tightness';
    } else if (pendingField === 'character' && text.length > 1 && text.length < 80) {
      extracted.character = text.trim();
    }

    if (pendingField === 'location' && text.length > 1 && text.length < 80) {
      extracted.location = text.trim();
    } else {
      const locationKeywords = ['left', 'right', 'temple', 'forehead', 'back of head', 'chest', 'stomach', 'belly', 'abdomen', 'lower back', 'shoulder', 'knee', 'neck', 'behind eyes'];
      for (const loc of locationKeywords) {
        if (lower.includes(loc)) {
          extracted.location = loc;
          break;
        }
      }
    }

    if (lower.includes('nowhere') || lower.includes('stays') || lower.includes('no radiation') || lower === 'no' || lower.startsWith('no,')) {
      extracted.radiation = 'none';
    } else if (lower.includes('arm') || lower.includes('jaw') || lower.includes('neck') || lower.includes('back') || lower.includes('leg') || lower.includes('shoulder')) {
      const match = lower.match(/(?:radiat\w+|spread\w+|to\s+the|down\s+the)\s+([a-z\s]+)/) || [null, lower];
      extracted.radiation = match[1]?.trim() || 'radiating';
    } else if (pendingField === 'radiation' && text.length > 1 && text.length < 80) {
      extracted.radiation = text.trim();
    }

    if (pendingField === 'aggravatingFactors' && text.length > 1 && text.length < 100) {
      extracted.aggravatingFactors = text.trim();
    }
    if (pendingField === 'relievingFactors' && text.length > 1 && text.length < 100) {
      extracted.relievingFactors = text.trim();
    }

    if (pendingField && Object.keys(extracted).length === 0 && text.length > 1 && text.length < 90) {
      extracted[pendingField] = text.trim();
    }

    return extracted;
  }

  normaliseSymptom(symptomName = '') {
    if (!symptomName) return 'default';
    const lower = symptomName.toLowerCase().trim();
    for (const { key, patterns } of SYMPTOM_KEYWORD_MAP) {
      if (patterns.some((p) => lower.includes(p))) return key;
    }
    return 'default';
  }

  getPriorityList(symptomName) {
    const key = this.normaliseSymptom(symptomName);
    return SYMPTOM_PRIORITY_TABLE[key] || SYMPTOM_PRIORITY_TABLE.default;
  }

  getNextField(symptomState = {}) {

    if (!symptomState.primarySymptom) return 'primarySymptom';

    const priorityList = this.getPriorityList(symptomState.primarySymptom);

    for (const field of priorityList) {
      const val = symptomState[field];
      const isEmpty = val === null || val === undefined || val === '' ||
        (Array.isArray(val) && val.length === 0);
      if (isEmpty) return field;
    }

    return null; 
  }

  isMinimumComplete(symptomState = {}) {
    if (!symptomState.primarySymptom) return false;
    return [...REQUIRED_FIELDS].every((f) => {
      const val = symptomState[f];
      return val !== null && val !== undefined && val !== '';
    });
  }

  isFullyComplete(symptomState = {}) {
    return this.getNextField(symptomState) === null;
  }

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
      const quickOpts = FIELD_QUICK_OPTIONS[nextField] || [];
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
        '',
        'REQUIRED STRUCTURE FOR THIS TURN:',
        `🎯 **Primary Focus:** Assessing ${symptomState.primarySymptom || 'Reported Symptom'} (${FIELD_LABELS[nextField] || nextField})`,
        '',
        `[Your warm acknowledgment and single question based on: "${template}"]`,
        '',
        '💡 **Follow-up & Feedback Questions:**',
        ...quickOpts.map((opt, i) => `${i + 1}. ${opt}`),
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

  assessRisk(symptomState = {}, patientContext = {}) {
    const rules = [];
    let riskLevel = 'low';

    const s = symptomState;
    const conditions = (patientContext.activeConditions || []).map((c) => (c.name || '').toLowerCase());
    const meds = (patientContext.activeMedications || []).map((m) => (m.name || '').toLowerCase());

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

    const sev = Number(s.severity);
    if (sev >= 9) {
      if (riskLevel !== 'high') riskLevel = 'medium';
      rules.push(`very_high_severity_${sev} — clinical evaluation warranted`);
    }

    if (conditions.some((c) => /diabet/i.test(c))) {
      if ((s.primarySymptom || '').toLowerCase().includes('chest')) {
        rules.push('diabetic_patient_with_chest_pain — atypical presentation possible');
        riskLevel = 'high';
      }
    }

    if (this.normaliseSymptom(s.primarySymptom) === 'hypoglycemia') {
      if (s.associatedSymptoms && Array.isArray(s.associatedSymptoms) && s.associatedSymptoms.some((sym) => /confus|faint|pass/i.test(sym))) {
        riskLevel = 'high';
        rules.push('severe_hypoglycemia_with_cns_symptoms — immediate medical attention required');
      } else if (riskLevel !== 'high') {
        riskLevel = 'medium';
        rules.push('symptomatic_hypoglycemia — fast-acting carbs required');
      }
    }

    if (this.normaliseSymptom(s.primarySymptom) === 'diabetic_neuropathy') {
      if (s.associatedSymptoms && Array.isArray(s.associatedSymptoms) && s.associatedSymptoms.some((sym) => /ulcer|wound|black|color/i.test(sym))) {
        riskLevel = 'high';
        rules.push('neuropathy_with_potential_ulceration — urgent podiatry/medical review');
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

