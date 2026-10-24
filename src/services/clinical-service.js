import { ApplicationError } from '../errors/application-error.js';
import { ClinicalRecordMapper, PatientMapper, HealthEventMapper, ClinicalTriageMapper } from '../mappers/index.js';

const NSAID_SET = new Set([
  'ibuprofen', 'naproxen', 'diclofenac', 'aspirin', 'nsaid', 'meloxicam',
  'celecoxib', 'ketorolac', 'indomethacin', 'piroxicam', 'etodolac',
]);

const HYPERTENSION_KEYWORDS = ['hypertension', 'high blood pressure', 'elevated bp'];
const KIDNEY_KEYWORDS = ['kidney', 'renal', 'nephro', 'ckd', 'esrd'];

const KNOWN_INTERACTION_RULES = [
  { drugA: 'nsaid', drugB: 'lisinopril', severity: 'CAUTION', reason: 'NSAIDs may diminish the antihypertensive effect of Lisinopril and increase renal risk.' },
  { drugA: 'nsaid', drugB: 'ramipril', severity: 'CAUTION', reason: 'NSAIDs may diminish the antihypertensive effect of ACE inhibitors.' },
  { drugA: 'nsaid', drugB: 'enalapril', severity: 'CAUTION', reason: 'NSAIDs may diminish the antihypertensive effect of ACE inhibitors.' },
  { drugA: 'nsaid', drugB: 'warfarin', severity: 'UNSAFE', reason: 'Concomitant use substantially increases risk of severe gastrointestinal bleeding.' },
  { drugA: 'aspirin', drugB: 'warfarin', severity: 'UNSAFE', reason: 'High risk of severe bleeding and hemorrhage.' },
  { drugA: 'sildenafil', drugB: 'nitroglycerin', severity: 'UNSAFE', reason: 'Life-threatening hypotension: severe cardiovascular collapse risk.' },
  { drugA: 'potassium', drugB: 'lisinopril', severity: 'UNSAFE', reason: 'High risk of severe hyperkalemia and cardiac arrhythmias.' },
  { drugA: 'methotrexate', drugB: 'ibuprofen', severity: 'UNSAFE', reason: 'Decreased methotrexate clearance causing toxicity.' },
];

const fdaInteractionCache = new Map();

/**
 * Unified ClinicalService
 * Combines Clinical Records Management (Profiles, Diagnoses, Medications, Allergies, Labs, Timeline)
 * and Clinical Rules & Safety Triage (Drug-Drug Interactions, Contraindications, OpenFDA queries).
 */
export class ClinicalService {
  constructor(clinicalRepo = null, {
    openFdaBaseUrl = 'https://api.fda.gov/drug/label.json',
    openFdaEnabled = false,
    fetchTimeoutMs = 25,
  } = {}) {
    this.clinicalRepo = clinicalRepo;
    this.openFdaBaseUrl = openFdaBaseUrl;
    this.openFdaEnabled = openFdaEnabled;
    this.fetchTimeoutMs = fetchTimeoutMs;
  }

  // ─────────────────────────────────────────────────────────────
  // 1. PATIENT PROFILE & 360 CONTEXT
  // ─────────────────────────────────────────────────────────────

  async getProfile(patientId) {
    let patient = await this.clinicalRepo.findPatientById(patientId);
    if (!patient) {
      await this.clinicalRepo.ensurePatient(patientId);
      patient = await this.clinicalRepo.findPatientById(patientId);
    }
    if (!patient) {
      throw new ApplicationError('Patient record not found', 404, 'not_found');
    }
    return PatientMapper.toDto(patient);
  }

  async updateProfile(patientId, updateData = {}) {
    await this.clinicalRepo.ensurePatient(patientId);
    const updated = await this.clinicalRepo.updatePatient(patientId, updateData || {});
    return PatientMapper.toDto(updated);
  }

  async getPatientContext(patientId) {
    return this.clinicalRepo.getPatientContext(patientId);
  }

  async getTimeline(patientId, limit = 50) {
    const timeline = await this.clinicalRepo.getTimeline(patientId, limit);
    return timeline.map(HealthEventMapper.toTimelineDto);
  }

  async getConsent(memberId, scope) {
    return this.clinicalRepo.getConsent(memberId, scope);
  }

  async setConsent(memberId, scope, granted) {
    return this.clinicalRepo.setConsent(memberId, scope, granted);
  }

  // ─────────────────────────────────────────────────────────────
  // 2. CLINICAL RECORDS (CONDITIONS, MEDS, ALLERGIES, LABS)
  // ─────────────────────────────────────────────────────────────

  async getConditions(patientId) {
    const records = await this.clinicalRepo.findClinicalRecords(patientId, 'condition');
    return ClinicalRecordMapper.toDtoList(records);
  }

  async addCondition(patientId, { name, code, status, severity, onsetDate } = {}) {
    if (!name) {
      throw new ApplicationError('Condition name is required', 400, 'validation_error');
    }

    const provenance = await this.clinicalRepo.createProvenance({
      sourceType: 'user_input',
      confidence: 1.0,
    });

    const record = await this.clinicalRepo.createClinicalRecord(patientId, {
      recordType: 'condition',
      name,
      code,
      codeSystem: 'icd10',
      status: status || 'active',
      severity,
      startAt: onsetDate ? new Date(onsetDate) : new Date(),
      provenanceId: provenance.id,
      source: 'manual',
    });

    await this.clinicalRepo.createHealthEvent(patientId, {
      eventType: 'diagnosis',
      summary: `Condition documented: ${name}`,
      structuredData: { name, code, status },
      provenanceId: provenance.id,
    });

    return ClinicalRecordMapper.toDto(record);
  }

  async getMedications(patientId) {
    const records = await this.clinicalRepo.findClinicalRecords(patientId, 'medication');
    return ClinicalRecordMapper.toDtoList(records);
  }

  async addMedication(patientId, { name, rxnormCode, dose, frequency, route, startedAt } = {}) {
    if (!name) {
      throw new ApplicationError('Medication name is required', 400, 'validation_error');
    }

    const provenance = await this.clinicalRepo.createProvenance({
      sourceType: 'user_input',
      confidence: 1.0,
    });

    const record = await this.clinicalRepo.createClinicalRecord(patientId, {
      recordType: 'medication',
      name,
      code: rxnormCode,
      codeSystem: 'rxnorm',
      dose,
      frequency,
      route,
      status: 'active',
      startAt: startedAt ? new Date(startedAt) : new Date(),
      provenanceId: provenance.id,
      source: 'manual',
    });

    await this.clinicalRepo.createHealthEvent(patientId, {
      eventType: 'medication_start',
      summary: `Medication started: ${name} ${dose || ''}`.trim(),
      structuredData: { drug: name, dose, frequency },
      provenanceId: provenance.id,
    });

    return ClinicalRecordMapper.toDto(record);
  }

  async getAllergies(patientId) {
    const records = await this.clinicalRepo.findClinicalRecords(patientId, 'allergy');
    return ClinicalRecordMapper.toDtoList(records);
  }

  async addAllergy(patientId, { substance, name, reaction, severity, verificationStatus = 'patient_confirmed' } = {}) {
    const allergen = substance || name;
    if (!allergen) {
      throw new ApplicationError('Allergy substance is required', 400, 'validation_error');
    }

    const provenance = await this.clinicalRepo.createProvenance({
      sourceType: 'user_input',
      confidence: 1.0,
    });

    const record = await this.clinicalRepo.createClinicalRecord(patientId, {
      recordType: 'allergy',
      name: allergen,
      severity,
      details: { reaction, verificationStatus },
      verificationStatus,
      startAt: new Date(),
      provenanceId: provenance.id,
      source: 'manual',
    });

    await this.clinicalRepo.createHealthEvent(patientId, {
      eventType: 'allergy',
      summary: `Allergy reported: ${allergen} (${reaction || 'reaction unstated'})`,
      structuredData: { substance: allergen, reaction, severity },
      provenanceId: provenance.id,
    });

    return ClinicalRecordMapper.toDto(record);
  }

  async getLabs(patientId) {
    const records = await this.clinicalRepo.findClinicalRecords(patientId, 'lab_result');
    return ClinicalRecordMapper.toDtoList(records);
  }

  async addLab(patientId, { testName, name, loincCode, value, unit, interpretation, collectedAt } = {}) {
    const test = testName || name;
    if (!test) {
      throw new ApplicationError('Lab test name is required', 400, 'validation_error');
    }

    const provenance = await this.clinicalRepo.createProvenance({
      sourceType: 'user_input',
      confidence: 1.0,
    });

    const record = await this.clinicalRepo.createClinicalRecord(patientId, {
      recordType: 'lab_result',
      name: test,
      code: loincCode,
      codeSystem: 'loinc',
      valueNum: typeof value === 'number' ? value : parseFloat(value) || null,
      valueText: typeof value === 'string' ? value : String(value ?? ''),
      unit,
      interpretation,
      startAt: collectedAt ? new Date(collectedAt) : new Date(),
      provenanceId: provenance.id,
      source: 'manual',
    });

    await this.clinicalRepo.createHealthEvent(patientId, {
      eventType: 'lab_result',
      summary: `Lab result: ${test} = ${value} ${unit || ''}`.trim(),
      structuredData: { testName: test, value, unit, interpretation },
      provenanceId: provenance.id,
    });

    return ClinicalRecordMapper.toDto(record);
  }

  // ─────────────────────────────────────────────────────────────
  // 3. CLINICAL TRIAGE, DRUG INTERACTIONS & SAFETY CHECKS
  // ─────────────────────────────────────────────────────────────

  async validateDrugAction({ drug, context = {} }) {
    if (!drug) {
      return ClinicalTriageMapper.toSafetyCheckDto({ status: 'SAFE', reasons: [], sources: [], timestamp: new Date().toISOString() });
    }

    const drugLower = String(drug).toLowerCase().trim();
    const isProposedNsaid = NSAID_SET.has(drugLower) || Array.from(NSAID_SET).some((n) => drugLower.includes(n));

    const activeMedications = context.activeMedications || context.medications || [];
    const allergies = context.allergies || [];
    const conditions = context.activeConditions || context.conditions || [];

    const reasons = [];
    const sources = [];
    let status = 'SAFE';

    for (const allergy of allergies) {
      const substance = String(allergy.substance || allergy.name || allergy.drug || '').toLowerCase().trim();
      if (substance && (drugLower.includes(substance) || substance.includes(drugLower))) {
        status = 'UNSAFE';
        reasons.push(`Patient has a documented allergy to ${allergy.substance || allergy.name || allergy.drug}.`);
        sources.push('Patient Profile: Allergies');
      }
    }

    for (const activeMed of activeMedications) {
      const activeMedName = String(activeMed.name || activeMed.drug || '').toLowerCase().trim();
      if (!activeMedName || activeMedName === drugLower) continue;

      let matchedRule = false;
      for (const rule of KNOWN_INTERACTION_RULES) {
        const matchesA = (rule.drugA === 'nsaid' && isProposedNsaid) || drugLower.includes(rule.drugA);
        const matchesB = activeMedName.includes(rule.drugB);
        const reverseMatchesA = (rule.drugA === 'nsaid' && NSAID_SET.has(activeMedName)) || activeMedName.includes(rule.drugA);
        const reverseMatchesB = drugLower.includes(rule.drugB);

        if ((matchesA && matchesB) || (reverseMatchesA && reverseMatchesB)) {
          matchedRule = true;
          if (rule.severity === 'UNSAFE' || status !== 'UNSAFE') {
            status = rule.severity;
          }
          reasons.push(`INTERACTION: ${rule.reason} (${drug} + ${activeMed.name || activeMed.drug})`);
          sources.push('Clinical Pharmacopeia Guidelines');
          break;
        }
      }

      if (matchedRule) continue;

      const pairKey = `${drugLower}:${activeMedName}`;
      if (fdaInteractionCache.has(pairKey)) {
        const cached = fdaInteractionCache.get(pairKey);
        if (cached.hasInteraction) {
          status = 'UNSAFE';
          reasons.push(`SEVERE INTERACTION: OpenFDA warns against combining ${drug} and ${activeMed.name || activeMed.drug}.`);
          sources.push('OpenFDA Drug Interactions Database (cached)');
        }
        continue;
      }

      if (this.openFdaEnabled) {
        try {
          const queryUrl = new URL(this.openFdaBaseUrl);
          queryUrl.searchParams.set('search', `(interactions:"${drugLower}" AND "${activeMedName}")`);
          queryUrl.searchParams.set('limit', '1');

          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), this.fetchTimeoutMs);

          const response = await fetch(queryUrl.toString(), { signal: controller.signal });
          clearTimeout(timer);

          if (response.ok) {
            const data = await response.json();
            const hasInteraction = Boolean(data.results && data.results.length > 0);
            fdaInteractionCache.set(pairKey, { hasInteraction, timestamp: Date.now() });

            if (hasInteraction) {
              status = 'UNSAFE';
              reasons.push(`SEVERE INTERACTION: OpenFDA warns against combining ${drug} and ${activeMed.name || activeMed.drug}.`);
              sources.push('OpenFDA Drug Interactions Database');
            }
          } else {
            fdaInteractionCache.set(pairKey, { hasInteraction: false, timestamp: Date.now() });
          }
        } catch {}
      }
    }

    if (isProposedNsaid) {
      let hasHypertension = false;
      let hasKidneyDisease = false;

      for (const c of conditions) {
        const text = String(c.name || c.display || c.title || '').toLowerCase();
        const code = String(c.code || '');

        if (!hasHypertension && (HYPERTENSION_KEYWORDS.some((kw) => text.includes(kw)) || code.startsWith('I10'))) {
          hasHypertension = true;
        }
        if (!hasKidneyDisease && (KIDNEY_KEYWORDS.some((kw) => text.includes(kw)) || code.startsWith('N18'))) {
          hasKidneyDisease = true;
        }
      }

      if (hasHypertension) {
        if (status !== 'UNSAFE') status = 'CAUTION';
        reasons.push('NSAIDs can elevate blood pressure. Caution advised for patients with Hypertension.');
        sources.push('Clinical Guidelines: Hypertension Management');
      }

      if (hasKidneyDisease) {
        status = 'UNSAFE';
        reasons.push('NSAIDs can worsen renal function. Contraindicated in Chronic Kidney Disease.');
        sources.push('Clinical Guidelines: Nephrology Guidelines');
      }
    }

    return ClinicalTriageMapper.toSafetyCheckDto({
      status,
      reasons,
      sources,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Backwards compatibility delegate for ClinicalRulesService
 */
export class ClinicalRulesService {
  constructor(opts = {}) {
    this.service = new ClinicalService(null, opts);
  }

  validateDrugAction(args) {
    return this.service.validateDrugAction(args);
  }
}

export default ClinicalService;
