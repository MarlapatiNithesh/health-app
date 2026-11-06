/**
 * MediBot Postgres VectorStore
 * Extends LangChain VectorStore base class.
 * Connects directly to PostgreSQL tables (clinical_embeddings, guideline_embeddings, patient_memory)
 * using pgvector cosine distance (<=>) or fallback mathematical similarity.
 */

import { VectorStore } from '@langchain/core/vectorstores';
import { Document } from '@langchain/core/documents';
import { MediBotEmbeddings } from './embeddings.js';
import { logger } from '../../logger.js';

const toVectorLiteral = (v) => (Array.isArray(v) ? `[${v.join(',')}]` : String(v));

export class PostgresPgVectorStore extends VectorStore {
  constructor(embeddings, options = {}) {
    super(embeddings || new MediBotEmbeddings(), options);
    this.pool = options.pool || null;
    this.tableName = options.tableName || 'clinical_embeddings';
    this.hasVectorCache = null;
  }

  _vectorstoreType() {
    return 'postgres_pgvector';
  }

  async #hasVectorType() {
    if (this.hasVectorCache !== null) return this.hasVectorCache;
    if (!this.pool) {
      this.hasVectorCache = false;
      return false;
    }
    try {
      const res = await this.pool.query(
        `SELECT 1 FROM pg_type WHERE typname = 'vector' LIMIT 1;`
      );
      this.hasVectorCache = res.rowCount > 0;
    } catch {
      this.hasVectorCache = false;
    }
    return this.hasVectorCache;
  }

  /**
   * Add vectors and documents to the PostgreSQL store.
   */
  async addVectors(vectors, documents) {
    if (!this.pool) return [];
    const hasVector = await this.#hasVectorType();
    const ids = [];

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const vector = vectors[i];
      const patientId = doc.metadata?.patientId || null;
      const documentId = doc.metadata?.documentId || null;
      const pageNumber = doc.metadata?.pageNumber || 1;
      const section = doc.metadata?.section || 'General';

      if (this.tableName === 'clinical_embeddings') {
        const sql = hasVector
          ? `INSERT INTO clinical_embeddings (
              patient_id, document_id, page_number, section, content_text, embedding
            ) VALUES ($1, $2, $3, $4, $5, $6::vector) RETURNING id`
          : `INSERT INTO clinical_embeddings (
              patient_id, document_id, page_number, section, content_text, embedding
            ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`;
        const res = await this.pool.query(sql, [
          patientId,
          documentId,
          pageNumber,
          section,
          doc.pageContent,
          toVectorLiteral(vector),
        ]);
        ids.push(res.rows[0].id);
      } else if (this.tableName === 'guideline_embeddings') {
        const sql = hasVector
          ? `INSERT INTO guideline_embeddings (
              source_name, title, section, content_text, embedding
            ) VALUES ($1, $2, $3, $4, $5::vector) RETURNING id`
          : `INSERT INTO guideline_embeddings (
              source_name, title, section, content_text, embedding
            ) VALUES ($1, $2, $3, $4, $5) RETURNING id`;
        const res = await this.pool.query(sql, [
          doc.metadata?.sourceName || 'Clinical Guidelines',
          doc.metadata?.title || 'General Guideline',
          section,
          doc.pageContent,
          toVectorLiteral(vector),
        ]);
        ids.push(res.rows[0].id);
      }
    }

    return ids;
  }

  /**
   * Similarity search given a vector.
   */
  async similaritySearchVectorWithScore(queryEmbedding, k = 5, filter = {}) {
    if (!this.pool) return [];
    const hasVector = await this.#hasVectorType();
    const patientId = filter.patientId || null;

    if (this.tableName === 'clinical_embeddings') {
      if (hasVector) {
        const query = patientId
          ? `SELECT id, document_id AS "documentId", page_number AS "pageNumber", section, content_text AS "contentText",
                    1 - (embedding <=> $2::vector) AS similarity
               FROM clinical_embeddings
              WHERE patient_id = $1
              ORDER BY embedding <=> $2::vector ASC
              LIMIT $3`
          : `SELECT id, document_id AS "documentId", page_number AS "pageNumber", section, content_text AS "contentText",
                    1 - (embedding <=> $1::vector) AS similarity
               FROM clinical_embeddings
              ORDER BY embedding <=> $1::vector ASC
              LIMIT $2`;
        const params = patientId
          ? [patientId, toVectorLiteral(queryEmbedding), k]
          : [toVectorLiteral(queryEmbedding), k];
        const res = await this.pool.query(query, params);
        return res.rows.map((row) => [
          new Document({
            pageContent: row.contentText,
            metadata: {
              id: row.id,
              documentId: row.documentId,
              pageNumber: row.pageNumber,
              section: row.section,
            },
          }),
          Number(row.similarity),
        ]);
      } else {
        // Fallback without pgvector
        const query = patientId
          ? `SELECT id, document_id AS "documentId", page_number AS "pageNumber", section, content_text AS "contentText", embedding
               FROM clinical_embeddings
              WHERE patient_id = $1
              ORDER BY created_at DESC LIMIT 50`
          : `SELECT id, document_id AS "documentId", page_number AS "pageNumber", section, content_text AS "contentText", embedding
               FROM clinical_embeddings
              ORDER BY created_at DESC LIMIT 50`;
        const params = patientId ? [patientId] : [];
        const res = await this.pool.query(query, params);
        return this.#computeCosineRankings(res.rows, queryEmbedding, k);
      }
    } else if (this.tableName === 'guideline_embeddings') {
      if (hasVector) {
        const res = await this.pool.query(
          `SELECT id, source_name AS "sourceName", title, section, content_text AS "contentText",
                  1 - (embedding <=> $1::vector) AS similarity
             FROM guideline_embeddings
            ORDER BY embedding <=> $1::vector ASC
            LIMIT $2`,
          [toVectorLiteral(queryEmbedding), k]
        );
        return res.rows.map((row) => [
          new Document({
            pageContent: row.contentText,
            metadata: {
              id: row.id,
              sourceName: row.sourceName,
              title: row.title,
              section: row.section,
            },
          }),
          Number(row.similarity),
        ]);
      } else {
        const res = await this.pool.query(
          `SELECT id, source_name AS "sourceName", title, section, content_text AS "contentText", embedding
             FROM guideline_embeddings
            ORDER BY created_at DESC LIMIT 50`
        );
        return this.#computeCosineRankings(res.rows, queryEmbedding, k);
      }
    }

    return [];
  }

  #computeCosineRankings(rows, queryEmbedding, k) {
    const target = Array.isArray(queryEmbedding) ? queryEmbedding : Array.from(queryEmbedding || []);
    const scored = rows.map((row) => {
      const emb = row.embedding;
      let sim = 0.5;
      if (Array.isArray(emb) && target.length > 0) {
        let dot = 0, normA = 0, normB = 0;
        const len = Math.min(emb.length, target.length);
        for (let i = 0; i < len; i++) {
          dot += emb[i] * target[i];
          normA += emb[i] * emb[i];
          normB += target[i] * target[i];
        }
        if (normA > 0 && normB > 0) {
          sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
        }
      }
      return [
        new Document({
          pageContent: row.contentText,
          metadata: {
            id: row.id,
            documentId: row.documentId,
            pageNumber: row.pageNumber,
            section: row.section,
            title: row.title,
            sourceName: row.sourceName,
          },
        }),
        Number(sim.toFixed(4)),
      ];
    });

    scored.sort((a, b) => b[1] - a[1]);
    return scored.slice(0, k);
  }
}

