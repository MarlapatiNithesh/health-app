/**
 * MediBot Specialized Retrievers
 * Implements LangChain BaseRetriever concepts for:
 * 1. Dual Clinical Retriever (Patient Lab reports + prescription chunks + documents)
 * 2. Clinical Guideline Retriever (NICE / WHO knowledge)
 * 3. Semantic Memory Retriever (Long-term recalled consultation memories)
 */

import { BaseRetriever } from '@langchain/core/retrievers';
import { Document } from '@langchain/core/documents';
import { PostgresPgVectorStore } from './vector-store.js';
import { MediBotEmbeddings } from './embeddings.js';
import { medibotConfig } from '../config/medibot-config.js';
import { logger } from '../../logger.js';

export class DualClinicalRetriever extends BaseRetriever {
  lc_namespace = ['medibot', 'rag', 'retrievers'];

  constructor(options = {}) {
    super(options);
    this.pool = options.pool;
    this.documentRepo = options.documentRepo;
    this.embeddings = options.embeddings || new MediBotEmbeddings();
    this.vectorStore = new PostgresPgVectorStore(this.embeddings, {
      pool: this.pool,
      tableName: 'clinical_embeddings',
    });
  }

  async _getRelevantDocuments(query, runManager) {
    // Standard LangChain retriever method
    return this.retrieveDualEvidence(null, query);
  }

  /**
   * Retrieves both vector chunks and raw document summaries for a patient.
   */
  async retrieveDualEvidence(patientId, queryText) {
    let vectorChunks = [];
    let documents = [];

    if (!queryText || typeof queryText !== 'string') {
      return { vectorChunks: [], documents: [] };
    }

    try {
      const queryVec = await this.embeddings.embedQuery(queryText);
      const scoredDocs = await this.vectorStore.similaritySearchVectorWithScore(
        queryVec,
        medibotConfig.rag.maxPatientChunks,
        { patientId }
      );
      vectorChunks = scoredDocs.map(([doc, score]) => ({
        id: doc.metadata?.id,
        documentId: doc.metadata?.documentId,
        pageNumber: doc.metadata?.pageNumber,
        section: doc.metadata?.section,
        contentText: doc.pageContent,
        similarity: score,
      }));
    } catch (err) {
      logger.debug('Vector embedding search bypassed in DualClinicalRetriever', { error: err.message });
    }

    if (patientId && this.documentRepo?.listDocuments) {
      try {
        documents = await this.documentRepo.listDocuments(patientId, medibotConfig.rag.maxDocuments);
      } catch (err) {
        logger.debug('Document list retrieval bypassed in DualClinicalRetriever', { error: err.message });
      }
    }

    return { vectorChunks: vectorChunks || [], documents: documents || [] };
  }
}

export class ClinicalGuidelineRetriever extends BaseRetriever {
  lc_namespace = ['medibot', 'rag', 'retrievers'];

  constructor(options = {}) {
    super(options);
    this.pool = options.pool;
    this.embeddings = options.embeddings || new MediBotEmbeddings();
    this.vectorStore = new PostgresPgVectorStore(this.embeddings, {
      pool: this.pool,
      tableName: 'guideline_embeddings',
    });
  }

  async _getRelevantDocuments(query) {
    try {
      const queryVec = await this.embeddings.embedQuery(query);
      const scored = await this.vectorStore.similaritySearchVectorWithScore(
        queryVec,
        medibotConfig.rag.maxGuidelines
      );
      return scored.map(([doc]) => doc);
    } catch (err) {
      logger.debug('ClinicalGuidelineRetriever search error', { error: err.message });
      return [];
    }
  }

  async searchGuidelines(queryText, limit = medibotConfig.rag.maxGuidelines) {
    try {
      const queryVec = await this.embeddings.embedQuery(queryText);
      const scored = await this.vectorStore.similaritySearchVectorWithScore(queryVec, limit);
      return scored.map(([doc, score]) => ({
        id: doc.metadata?.id,
        sourceName: doc.metadata?.sourceName,
        title: doc.metadata?.title,
        section: doc.metadata?.section,
        contentText: doc.pageContent,
        similarity: score,
      }));
    } catch (err) {
      logger.debug('Guideline search failed', { error: err.message });
      return [];
    }
  }
}

export class SemanticMemoryRetriever {
  constructor(options = {}) {
    this.pool = options.pool;
    this.encounterRepo = options.encounterRepo;
    this.embeddings = options.embeddings || new MediBotEmbeddings({ dimension: medibotConfig.embeddings.memoryDimension });
  }

  async retrieveMemory(patientId, queryText, limit = medibotConfig.rag.maxSemanticMemories) {
    if (!patientId || !queryText) return [];

    try {
      const vector = await this.embeddings.embedQuery(queryText);

      if (typeof this.encounterRepo?.searchPatientMemory === 'function') {
        return await this.encounterRepo.searchPatientMemory(patientId, vector, limit);
      }

      if (this.pool) {
        const res = await this.pool.query(
          `SELECT summary_text AS "summaryText" FROM patient_memory WHERE patient_id = $1 ORDER BY created_at DESC LIMIT $2`,
          [patientId, limit]
        ).catch(() => ({ rows: [] }));
        return res.rows.map((r) => r.summaryText);
      }

      return [];
    } catch (err) {
      logger.debug('Semantic memory search bypassed', { error: err.message });
      return [];
    }
  }

  async saveMemory(patientId, encounterId, summary) {
    if (!patientId || !encounterId || !summary) return;
    try {
      const vector = await this.embeddings.embedQuery(summary);
      if (typeof this.encounterRepo?.savePatientMemory === 'function') {
        await this.encounterRepo.savePatientMemory(patientId, encounterId, summary, vector);
      } else if (this.pool) {
        await this.pool.query(
          `INSERT INTO patient_memory (patient_id, encounter_id, summary_text) VALUES ($1, $2, $3)`,
          [patientId, encounterId, summary]
        ).catch(() => {});
      }
    } catch (err) {
      logger.debug('Semantic memory save bypassed', { error: err.message });
    }
  }
}

