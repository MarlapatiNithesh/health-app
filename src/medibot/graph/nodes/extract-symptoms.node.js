/**
 * LangGraph Node: Extract Symptoms
 * Classifies user intent and extracts structured clinical symptom attributes,
 * persisting updates to the active encounter.
 */

import { SYMPTOM_EXTRACTION_PROMPT } from '../../prompts/prompt-templates.js';
import { medibotConfig } from '../../config/medibot-config.js';
import { logger } from '../../../logger.js';

export function createExtractSymptomsNode({ encounterRepo, llmService, symptomPriorityService }) {
  const SEVERITY_REGEX = /\b([0-9]|10)\s*(?:\/10|out of 10)\b|\bseverity (?:is )?([0-9]|10)\b/i;
  const DURATION_REGEX = /\b(\d+)\s*(days?|weeks?|months?|hours?|minutes?)\b/i;

  return async function extractSymptomsNode(state) {
    state.onProgress?.('Running clinical triage and symptom classification...');

    const { patientId, encounterId, userMessage } = state;
    const currentSymptomState = state.symptomState || {};

    // 1. Intent Classification
    let intent = state.intent;
    if (!intent) {
      for (const item of medibotConfig.intentMapping) {
        if (item.regex.test(userMessage)) {
          intent = item.intent;
          break;
        }
      }
      if (!intent) intent = 'out_of_scope';
    }

    const isSymptomIntent = intent === 'symptom_report' ||
      symptomPriorityService?.isSymptomReport?.(userMessage) ||
      !!currentSymptomState?.primarySymptom;

    let updatedSymptomState = { ...currentSymptomState };

    if (isSymptomIntent) {
      let extracted = {};

      // Attempt LLM structured extraction if available
      try {
        if (llmService?.generateJsonExtraction) {
          extracted = await llmService.generateJsonExtraction(userMessage, currentSymptomState);
        } else {
          // Fallback parsing via prompt formatting
          const prompt = await SYMPTOM_EXTRACTION_PROMPT.format({
            existingStateJson: JSON.stringify(currentSymptomState),
            userMessage,
          });
          if (llmService?.generateCompletion) {
            const rawRes = await llmService.generateCompletion({ messages: [{ role: 'user', content: prompt }] });
            const cleaned = (rawRes.content || '{}').replace(/```json|```/g, '').trim();
            extracted = JSON.parse(cleaned);
          }
        }
      } catch (err) {
        logger.debug('Structured LLM extraction fallback to regex', { error: err.message });
      }

      // Regex / keyword fallbacks for primarySymptom, severity & duration
      if (!extracted.primarySymptom && symptomPriorityService?.normaliseSymptom) {
        const norm = symptomPriorityService.normaliseSymptom(userMessage);
        if (norm && norm !== 'default') {
          extracted.primarySymptom = norm;
        }
      }
      if (!extracted.severity) {
        const sevMatch = SEVERITY_REGEX.exec(userMessage);
        if (sevMatch) {
          extracted.severity = parseInt(sevMatch[1] || sevMatch[2], 10);
        } else if (/\bmild\b/i.test(userMessage)) {
          extracted.severity = 3;
        } else if (/\bmoderate\b/i.test(userMessage)) {
          extracted.severity = 5;
        } else if (/\bsevere\b/i.test(userMessage)) {
          extracted.severity = 8;
        } else if (/\bworst\b/i.test(userMessage)) {
          extracted.severity = 10;
        }
      }
      if (!extracted.duration) {
        const durMatch = DURATION_REGEX.exec(userMessage);
        if (durMatch) {
          extracted.duration = `${durMatch[1]} ${durMatch[2]}`;
        } else if (/\b(since morning|since this morning)\b/i.test(userMessage)) {
          extracted.duration = 'since morning';
        } else if (/\b(few hours|a few hours|couple hours)\b/i.test(userMessage)) {
          extracted.duration = 'a few hours';
        } else if (/\b(all day|today)\b/i.test(userMessage)) {
          extracted.duration = '1 day';
        }
      }

      // SOCRATES heuristic fallbacks for character, onset, aggravating, relieving & associated
      if (!extracted.character) {
        if (/\b(throbbing|pulsating|pounding)\b/i.test(userMessage)) extracted.character = 'throbbing';
        else if (/\b(sharp|stabbing|knife-like)\b/i.test(userMessage)) extracted.character = 'sharp';
        else if (/\b(dull|aching|pressure|tightness|heavy)\b/i.test(userMessage)) extracted.character = 'dull pressure';
        else if (/\b(burning|hot|searing)\b/i.test(userMessage)) extracted.character = 'burning';
        else if (/\b(cramp|colicky|spasm)\b/i.test(userMessage)) extracted.character = 'cramping';
      }

      if (!extracted.onset) {
        if (/\b(sudden|abrupt|out of nowhere|instant)\b/i.test(userMessage)) extracted.onset = 'sudden';
        else if (/\b(gradual|slowly|over time|built up)\b/i.test(userMessage)) extracted.onset = 'gradual';
      }

      if (!extracted.aggravatingFactors) {
        if (/\b(light|sunlight|bright)\b/i.test(userMessage)) extracted.aggravatingFactors = 'bright light';
        else if (/\b(sound|noise|loud)\b/i.test(userMessage)) extracted.aggravatingFactors = 'loud sounds';
        else if (/\b(movement|walking|bending|exertion)\b/i.test(userMessage)) extracted.aggravatingFactors = 'movement / exertion';
      }

      if (!extracted.relievingFactors) {
        if (/\b(dark room|lying down|rest|sleep)\b/i.test(userMessage)) extracted.relievingFactors = 'rest in dark room';
        else if (/\b(water|hydration)\b/i.test(userMessage)) extracted.relievingFactors = 'hydration';
      }

      if (!extracted.associatedSymptoms || extracted.associatedSymptoms.length === 0) {
        const found = [];
        if (/\b(nausea|nauseous|queasy|vomit)\b/i.test(userMessage)) found.push('nausea');
        if (/\b(dizzy|dizziness|lightheaded)\b/i.test(userMessage)) found.push('dizziness');
        if (/\b(fever|chills|shivering)\b/i.test(userMessage)) found.push('fever');
        if (/\b(photophobia|light sensitivity|sensitive to light)\b/i.test(userMessage)) found.push('sensitivity to light');
        if (found.length > 0) extracted.associatedSymptoms = found;
      }

      // Merge newly extracted fields
      for (const [key, val] of Object.entries(extracted || {})) {
        if (val !== null && val !== undefined && val !== '') {
          updatedSymptomState[key] = val;
        }
      }

      // Persist merged symptom state
      if (Object.keys(extracted || {}).length > 0 && encounterRepo?.upsertSymptomState) {
        await encounterRepo.upsertSymptomState(encounterId, patientId, updatedSymptomState).catch(() => {});
      }
    }

    return {
      intent,
      isSymptomIntent,
      symptomState: updatedSymptomState,
    };
  };
}
