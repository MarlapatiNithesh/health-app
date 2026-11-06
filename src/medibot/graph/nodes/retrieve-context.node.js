/**
 * LangGraph Node: Retrieve Context
 * Parallel retrieval of Patient 360 profile, RAG evidence chunks, prior encounters,
 * long-term semantic memory, and emotion analysis.
 */

import { medibotConfig } from '../../config/medibot-config.js';
import { logger } from '../../../logger.js';

export function createRetrieveContextNode({
  clinicalRepo,
  encounterRepo,
  dualRetriever,
  semanticMemoryRetriever,
  llmService,
}) {
  return async function retrieveContextNode(state) {
    state.onProgress?.('Fetching Patient 360 profile, lab results, and medical history...');

    const { patientId, userMessage } = state;

    try {
      const [
        patientContext,
        ragEvidence,
        priorEncounters,
        semanticMemory,
        emotionState,
      ] = await Promise.all([
        clinicalRepo?.getPatientContext ? clinicalRepo.getPatientContext(patientId).catch(() => ({})) : Promise.resolve({}),
        dualRetriever?.retrieveDualEvidence
          ? dualRetriever.retrieveDualEvidence(patientId, userMessage).catch(() => ({ vectorChunks: [], documents: [] }))
          : Promise.resolve({ vectorChunks: [], documents: [] }),
        encounterRepo?.listEncountersByPatient
          ? encounterRepo.listEncountersByPatient(patientId, medibotConfig.conversation.maxPriorEncounters + 1).catch(() => [])
          : Promise.resolve([]),
        semanticMemoryRetriever?.retrieveMemory
          ? semanticMemoryRetriever.retrieveMemory(patientId, userMessage).catch(() => [])
          : Promise.resolve([]),
        llmService?.detectEmotion
          ? llmService.detectEmotion(userMessage).catch(() => null)
          : Promise.resolve(null),
      ]);

      return {
        patientContext: patientContext || {},
        ragEvidence: ragEvidence || { vectorChunks: [], documents: [] },
        priorEncounters: priorEncounters || [],
        semanticMemory: semanticMemory || [],
        emotionState: emotionState || null,
      };
    } catch (err) {
      logger.error('retrieveContextNode encountered error', { error: err.message });
      return {
        patientContext: {},
        ragEvidence: { vectorChunks: [], documents: [] },
        priorEncounters: [],
        semanticMemory: [],
        emotionState: null,
      };
    }
  };
}

