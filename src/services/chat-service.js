/**
 * ChatService / ClinicalOrchestratorService
 *
 * LangChain and LangGraph powered MediBot Clinical Engine.
 * Integrates:
 *  - LangGraph StateGraph (multi-stage triage, adaptive questioning, critic loop)
 *  - LangChain ChatModel with Clinical Tools
 *  - LangChain Postgres VectorStore & Embeddings RAG
 *  - Dynamic Prompt Ingestion
 *  - Red-flag Emergency Detection
 *  - Clinical Priority Engine & Safety Guardrails
 */

import { logger } from '../logger.js';
import { MediBotService } from '../medibot/services/medibot-service.js';
import { SymptomPriorityService } from './symptom-priority-service.js';
import { ResponseSafetyValidator } from './response-safety-validator.js';
import { globalGeminiClient } from '../integrations/gemini-client.js';

export class ChatService {
  constructor({
    encounterRepo,
    clinicalRepo,
    documentRepo,
    clinicalRulesService,
    llmService,
    geminiClient = globalGeminiClient,
    symptomPriorityService = null,
    responseSafetyValidator = null,
    pool = null,
    chatModel = null,
    embeddings = null,
  }) {
    this.encounterRepo = encounterRepo;
    this.clinicalRepo = clinicalRepo;
    this.documentRepo = documentRepo;
    this.clinicalRulesService = clinicalRulesService;
    this.llmService = llmService;
    this.geminiClient = geminiClient;
    this.pool = pool || clinicalRepo?.pool || documentRepo?.pool || encounterRepo?.pool || null;

    this.symptomPriorityService = symptomPriorityService || new SymptomPriorityService();
    this.responseSafetyValidator = responseSafetyValidator || new ResponseSafetyValidator();

    // Initialize LangGraph / LangChain MediBot Service
    this.mediBotService = new MediBotService({
      encounterRepo: this.encounterRepo,
      clinicalRepo: this.clinicalRepo,
      documentRepo: this.documentRepo,
      clinicalRulesService: this.clinicalRulesService,
      llmService: this.llmService,
      symptomPriorityService: this.symptomPriorityService,
      responseSafetyValidator: this.responseSafetyValidator,
      pool: this.pool,
      chatModel,
      embeddings,
    });
  }

  /**
   * Main chat triage handler powered by LangGraph StateGraph execution.
   */
  async handleChatMessage({
    patientId,
    encounterId = null,
    message,
    intent = null,
    onProgress = null,
  }) {
    return await this.mediBotService.handleChatMessage({
      patientId,
      encounterId,
      message,
      intent,
      onProgress,
    });
  }

  /**
   * RAG Query endpoint powered by LangChain Embeddings & VectorStore.
   */
  async queryRAG(patientId, queryText) {
    return await this.mediBotService.queryRAG(patientId, queryText);
  }
}

export const ClinicalOrchestratorService = ChatService;
export default ChatService;
