/**
 * MediBot Service
 * Main facade service powering the MediBot AI engine through LangChain and LangGraph.
 */

import { buildMediBotGraph } from '../graph/medibot-graph.js';
import { MediBotLLMFactory } from '../models/llm-factory.js';
import { MediBotEmbeddings } from '../rag/embeddings.js';
import { PostgresPgVectorStore } from '../rag/vector-store.js';
import { MediBotDocumentChunker } from '../rag/document-chunker.js';
import { DualClinicalRetriever, ClinicalGuidelineRetriever, SemanticMemoryRetriever } from '../rag/retrievers.js';
import { createClinicalTools } from '../tools/clinical-tools.js';
import { SymptomPriorityService } from '../../services/symptom-priority-service.js';
import { ResponseSafetyValidator } from '../../services/response-safety-validator.js';
import { ClinicalTriageMapper } from '../../mappers/clinical-triage-mapper.js';
import { logger } from '../../logger.js';

export class MediBotService {
  constructor(dependencies = {}) {
    this.encounterRepo = dependencies.encounterRepo;
    this.clinicalRepo = dependencies.clinicalRepo;
    this.documentRepo = dependencies.documentRepo;
    this.clinicalRulesService = dependencies.clinicalRulesService;
    this.llmService = dependencies.llmService;
    this.pool = dependencies.pool || null;

    // Triage & Safety Services
    this.symptomPriorityService = dependencies.symptomPriorityService || new SymptomPriorityService();
    this.responseSafetyValidator = dependencies.responseSafetyValidator || new ResponseSafetyValidator();

    // LangChain Models & Embeddings
    this.embeddings = dependencies.embeddings || new MediBotEmbeddings();
    this.chatModel = dependencies.chatModel || MediBotLLMFactory.createChatModel();

    // RAG Pipeline Components
    this.chunker = new MediBotDocumentChunker();
    this.vectorStore = new PostgresPgVectorStore(this.embeddings, {
      pool: this.pool,
      tableName: 'clinical_embeddings',
    });
    this.dualRetriever = new DualClinicalRetriever({
      pool: this.pool,
      documentRepo: this.documentRepo,
      embeddings: this.embeddings,
    });
    this.guidelineRetriever = new ClinicalGuidelineRetriever({
      pool: this.pool,
      embeddings: this.embeddings,
    });
    this.semanticMemoryRetriever = new SemanticMemoryRetriever({
      pool: this.pool,
      encounterRepo: this.encounterRepo,
      embeddings: this.embeddings,
    });

    // Build the LangGraph StateGraph
    this.graph = buildMediBotGraph({
      encounterRepo: this.encounterRepo,
      clinicalRepo: this.clinicalRepo,
      documentRepo: this.documentRepo,
      clinicalRulesService: this.clinicalRulesService,
      symptomPriorityService: this.symptomPriorityService,
      responseSafetyValidator: this.responseSafetyValidator,
      llmService: this.llmService,
      chatModel: this.chatModel,
      tools: createClinicalTools({
        patientId: null,
        clinicalRepo: this.clinicalRepo,
        clinicalRulesService: this.clinicalRulesService,
        guidelineRetriever: this.guidelineRetriever,
      }),
      dualRetriever: this.dualRetriever,
      guidelineRetriever: this.guidelineRetriever,
      semanticMemoryRetriever: this.semanticMemoryRetriever,
    });
  }

  /**
   * Primary entry point for handling chat triage requests (standard & SSE streaming).
   */
  async handleChatMessage({
    patientId,
    encounterId = null,
    message,
    intent = null,
    onProgress = null,
  }) {
    const startTime = Date.now();

    // Step 1: Ensure encounter exists
    const isUuid = encounterId && typeof encounterId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(encounterId);

    let encounter = isUuid
      ? await this.encounterRepo?.findEncounterById?.(encounterId).catch(() => null)
      : null;

    if (!encounter && this.encounterRepo?.createEncounter) {
      encounter = await this.encounterRepo.createEncounter(patientId, {
        intent: intent || 'general_health_question',
      });
      encounterId = encounter.id;
    } else if (encounter) {
      encounterId = encounter.id;
    }

    // Step 2: Persist incoming user message
    if (this.encounterRepo?.appendMessage) {
      await this.encounterRepo.appendMessage(encounterId, patientId, {
        role: 'user',
        content: message,
      });
    }

    // Refresh encounter history
    const refreshedEncounter = this.encounterRepo?.findEncounterById
      ? await this.encounterRepo.findEncounterById(encounterId).catch(() => encounter)
      : encounter;

    const messages = (refreshedEncounter?.messages || [])
      .map((m) => ({ role: m.role, content: m.content }));

    // Prepare initial state for the LangGraph workflow
    const initialState = {
      patientId,
      encounterId,
      userMessage: message,
      messages,
      intent,
      startTime,
      onProgress,
      symptomState: refreshedEncounter?.symptomState || {},
    };

    // Execute the LangGraph StateGraph
    const outputState = await this.graph.invoke(initialState);

    return outputState.resultDto;
  }

  /**
   * Semantic RAG Query endpoint.
   */
  async queryRAG(patientId, queryText, limit = 5) {
    try {
      const scored = await this.vectorStore.similaritySearchVectorWithScore(
        await this.embeddings.embedQuery(queryText),
        limit,
        { patientId }
      );

      const results = scored.map(([doc, score]) => ({
        id: doc.metadata?.id,
        contentText: doc.pageContent,
        similarity: score,
      }));

      const patientContext = this.clinicalRepo?.getPatientContext
        ? await this.clinicalRepo.getPatientContext(patientId).catch(() => null)
        : null;

      const matchingMeds = (patientContext?.activeMedications || []).filter((m) => {
        const name = m?.name || m?.medicationName;
        return name && queryText.toLowerCase().includes(name.toLowerCase());
      });

      const matchingLabs = (patientContext?.recentLabs || []).filter((l) => {
        const name = l?.name || l?.testName;
        return name && queryText.toLowerCase().includes(name.toLowerCase());
      });

      return ClinicalTriageMapper.toRagResponseDto({
        query: queryText,
        results,
        structuredEvidence: {
          medications: matchingMeds,
          labs: matchingLabs,
        },
      });
    } catch (err) {
      logger.error('queryRAG failed', { error: err.message });
      return ClinicalTriageMapper.toRagResponseDto({
        query: queryText,
        results: [],
        structuredEvidence: { medications: [], labs: [] },
      });
    }
  }

  /**
   * Ingest and index document chunks with LangChain embeddings into PostgreSQL.
   */
  async ingestDocument(patientId, documentId, rawText, metadata = {}) {
    const chunks = await this.chunker.chunkText(rawText, {
      patientId,
      documentId,
      ...metadata,
    });

    const docs = chunks.map((c) => ({
      pageContent: `[Document ${documentId}, Page ${c.pageNumber}] ${c.content}`,
      metadata: {
        patientId,
        documentId,
        pageNumber: c.pageNumber,
        section: c.section,
        ...c.metadata,
      },
    }));

    const vectors = await this.embeddings.embedDocuments(docs.map((d) => d.pageContent));
    return await this.vectorStore.addVectors(vectors, docs);
  }
}

