import { ClinicalTriageMapper } from '../mappers/clinical-triage-mapper.js';

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

export class ClinicalRulesService {
  constructor({
    openFdaBaseUrl = 'https://api.fda.gov/drug/label.json',
    openFdaEnabled = false,
    fetchTimeoutMs = 25,
  } = {}) {
    this.openFdaBaseUrl = openFdaBaseUrl;
    this.openFdaEnabled = openFdaEnabled;
    this.fetchTimeoutMs = fetchTimeoutMs;
  }

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
        } catch {
        }
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
