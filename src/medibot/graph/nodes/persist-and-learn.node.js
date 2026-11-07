/**
 * LangGraph Node: Persist and Learn
 * Persists model runs and assistant messages, triggers background encounter summarization,
 * and embeds consultation summaries into long-term semantic memory.
 */

import { ClinicalTriageMapper } from '../../../mappers/clinical-triage-mapper.js';
import { ENCOUNTER_SUMMARY_PROMPT } from '../../prompts/prompt-templates.js';
import { logger } from '../../../logger.js';

export function createPersistAndLearnNode({
  encounterRepo,
  clinicalRepo,
  semanticMemoryRetriever,
  llmService = null,
  chatModel = null,
}) {
  return async function persistAndLearnNode(state) {
    const {
      patientId,
      encounterId,
      finalResponse,
      startTime,
      modelRunMetrics,
      symptomState,
      nextField,
      assessmentComplete,
      validationResult,
      riskAssessment,
    } = state;

    const latencyMs = Date.now() - (startTime || Date.now());

    let assistantMsg = { id: null };

    try {
      const [, msg] = await Promise.all([
        encounterRepo?.logModelRun?.(encounterId, patientId, {
          modelName: modelRunMetrics?.modelName || 'medibot-clinical-ai',
          modelVersion: modelRunMetrics?.modelVersion || '1.0',
          promptHash: 'sha256',
          inputTokens: modelRunMetrics?.inputTokens || Math.round((finalResponse || '').length / 4),
          outputTokens: modelRunMetrics?.outputTokens || Math.round((finalResponse || '').length / 4),
          latencyMs,
        }),
        encounterRepo?.appendMessage?.(encounterId, patientId, {
          role: 'assistant',
          content: finalResponse,
          latencyMs,
          meta: {
            model: modelRunMetrics?.modelName,
            safetyStatus: validationResult?.status,
            nextField: nextField || null,
            assessmentComplete,
          },
        }),
      ]);
      assistantMsg = msg;
    } catch (err) {
      logger.error('PersistAndLearnNode failed to save message/metrics', { error: err.message });
    }

    // Background summarization & semantic memory storage when assessment is complete
    if (assessmentComplete && !symptomState?.summaryGenerated) {
      summarizeAndStoreMemory({
        encounterId,
        patientId,
        messages: state.messages,
        finalResponse,
        encounterRepo,
        clinicalRepo,
        semanticMemoryRetriever,
        llmService,
        chatModel,
      }).catch((err) => logger.warn('Background summarization failed', { error: err.message }));
    }

    const resultDto = ClinicalTriageMapper.toChatResponseDto({
      encounterId,
      role: 'assistant',
      content: finalResponse,
      riskLevel: riskAssessment?.riskLevel || 'low',
      status: 'in_progress',
      messageId: assistantMsg?.id,
      latencyMs,
      symptomState,
      nextField,
      assessmentComplete,
      riskAssessment,
    });

    return {
      resultDto,
    };
  };
}

async function summarizeAndStoreMemory({
  encounterId,
  patientId,
  messages = [],
  finalResponse,
  encounterRepo,
  clinicalRepo,
  semanticMemoryRetriever,
  llmService,
  chatModel,
}) {
  try {
    const transcript = [
      ...messages.map((m) => `${m.role === 'assistant' ? 'MediBot' : 'Patient'}: ${m.content}`),
      `MediBot: ${finalResponse}`,
    ].join('\n');

    let summary = '';
    if (llmService?.generateSummary) {
      summary = await llmService.generateSummary(transcript);
    } else if (chatModel) {
      const prompt = await ENCOUNTER_SUMMARY_PROMPT.format({ transcript });
      const res = await chatModel.invoke([{ role: 'user', content: prompt }]);
      summary = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
    } else {
      summary = `Encounter consultation completed for symptoms: ${transcript.slice(0, 150)}...`;
    }

    const cleanSummary = summary.slice(0, 500);

    await Promise.all([
      encounterRepo?.updateEncounterStatus?.(encounterId, {
        status: 'complete',
        summary: cleanSummary,
      }),
      clinicalRepo?.createHealthEvent?.(patientId, {
        eventType: 'chat_summary',
        summary: cleanSummary,
        structuredData: { encounterId, source: 'medibot_langgraph_assessment' },
        sessionId: encounterId,
      }).catch(() => {}),
      semanticMemoryRetriever?.saveMemory?.(patientId, encounterId, cleanSummary),
    ]);

    logger.info('MediBot: encounter summarized and stored in semantic memory', { encounterId });
  } catch (err) {
    logger.warn('summarizeAndStoreMemory error', { error: err.message });
  }
}

