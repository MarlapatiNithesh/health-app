/**
 * LangGraph Node: Compose Prompt (Prompt Ingestion)
 * Ingests all structured evidence, medical records, and symptom assessment directives
 * into the comprehensive LangChain Clinical Prompt Template.
 */

import { MediBotPromptIngester } from '../../prompts/prompt-ingester.js';

export function createComposePromptNode() {
  return async function composePromptNode(state) {
    state.onProgress?.('Ingesting clinical prompt & RAG evidence...');

    const systemPrompt = await MediBotPromptIngester.ingestClinicalPrompt({
      patientContext: state.patientContext,
      ragEvidence: state.ragEvidence,
      semanticMemory: state.semanticMemory,
      priorEncounters: state.priorEncounters,
      emotionState: state.emotionState,
      symptomState: state.symptomState,
      nextField: state.nextField,
      isSymptomIntent: state.isSymptomIntent,
      assessmentComplete: state.assessmentComplete,
    });

    return {
      systemPrompt,
    };
  };
}

