import { withTransaction } from '../database/pool.js';
import { globalCache } from '../cache/cache-manager.js';
import { DocumentMapper } from '../mappers/index.js';

/** Converts a float array or a string literal to a pgvector-compatible string. */
const toVectorLiteral = (v) => (Array.isArray(v) ? `[${v.join(',')}]` : String(v));

export class DocumentRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async createDocument(patientId, {
    docType = 'prescription',
    originalFilename,
    storageKey,
    mimeType,
    sizeBytes,
    sha256,
    documentFamilyId = null,
    versionNumber = 1,
    visualHash = null,
    contentTextHash = null,
    contentFingerprint = null,
    revisionOf = null,
    changeClassification = 'ORIGINAL',
    diffSummary = {},
    summary = null,
    provenanceId = null,
  }) {
    return withTransaction(this.pool, async (client) => {
      await client.query(
        `UPDATE members
            SET health_consent_at = COALESCE(health_consent_at, now()),
                health_consent_version = COALESCE(health_consent_version, '1.0'),
                updated_at = now()
          WHERE id = $1`,
        [patientId]
      ).catch(() => {});
      await client.query(
        `INSERT INTO patients (id, preferred_language, units_system, privacy_level)
         VALUES ($1, 'en-IN', 'metric', 'standard')
         ON CONFLICT (id) DO NOTHING`,
        [patientId]
      ).catch(() => {});

      const res = await client.query(
        `INSERT INTO health_documents (
          patient_id, doc_type, original_filename, storage_key, mime_type,
          size_bytes, sha256, document_family_id, version_number, visual_hash,
          content_text_hash, content_fingerprint, revision_of, change_classification,
          diff_summary, summary, extraction_status, provenance_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          COALESCE($8, gen_random_uuid()), $9, $10, $11, $12, $13, $14,
          $15, $16, 'pending', $17
        )
        RETURNING id, patient_id AS "patientId", doc_type AS "docType",
                  original_filename AS "originalFilename", storage_key AS "storageKey",
                  mime_type AS "mimeType", size_bytes AS "sizeBytes", sha256,
                  document_family_id AS "documentFamilyId", version_number AS "versionNumber",
                  visual_hash AS "visualHash", content_text_hash AS "contentTextHash",
                  content_fingerprint AS "contentFingerprint", revision_of AS "revisionOf",
                  change_classification AS "changeClassification", diff_summary AS "diffSummary",
                  summary, extraction_status AS "extractionStatus", created_at AS "createdAt"`,
        [
          patientId,
          docType,
          originalFilename,
          storageKey,
          mimeType,
          sizeBytes,
          sha256,
          documentFamilyId,
          versionNumber,
          visualHash,
          contentTextHash,
          contentFingerprint,
          revisionOf,
          changeClassification,
          JSON.stringify(diffSummary || {}),
          summary,
          provenanceId,
        ]
      );
      globalCache.invalidatePrefix(`documents:${patientId}`);
      return res.rows[0];
    });
  }

  async findDocumentByHash(patientId, sha256) {
    const res = await this.pool.query(
      `SELECT id, patient_id AS "patientId", doc_type AS "docType",
              original_filename AS "originalFilename", storage_key AS "storageKey",
              mime_type AS "mimeType", size_bytes AS "sizeBytes", sha256,
              document_family_id AS "documentFamilyId", version_number AS "versionNumber",
              visual_hash AS "visualHash", content_text_hash AS "contentTextHash",
              content_fingerprint AS "contentFingerprint", revision_of AS "revisionOf",
              change_classification AS "changeClassification", diff_summary AS "diffSummary",
              summary, extraction_status AS "extractionStatus", created_at AS "createdAt",
              updated_at AS "updatedAt"
         FROM health_documents
        WHERE patient_id = $1 AND sha256 = $2 AND deleted_at IS NULL
        LIMIT 1`,
      [patientId, sha256]
    );
    return res.rows[0] ? DocumentMapper.toDto(res.rows[0]) : null;
  }

  async findNearDuplicateByContent(patientId, textHash) {
    if (!textHash) return null;
    const res = await this.pool.query(
      `SELECT id, patient_id AS "patientId", doc_type AS "docType",
              original_filename AS "originalFilename", storage_key AS "storageKey",
              document_family_id AS "documentFamilyId", version_number AS "versionNumber",
              visual_hash AS "visualHash", content_text_hash AS "contentTextHash",
              content_fingerprint AS "contentFingerprint", revision_of AS "revisionOf",
              change_classification AS "changeClassification",
              extraction_status AS "extractionStatus", created_at AS "createdAt"
         FROM health_documents
        WHERE patient_id = $1 AND deleted_at IS NULL AND (content_text_hash = $2 OR content_fingerprint = $2)
        ORDER BY version_number DESC
        LIMIT 1`,
      [patientId, textHash]
    );
    return res.rows[0] ? DocumentMapper.toDto(res.rows[0]) : null;
  }

  async findDocumentByVisualHash(patientId, visualHash) {
    if (!visualHash) return null;
    const res = await this.pool.query(
      `SELECT id, patient_id AS "patientId", doc_type AS "docType",
              original_filename AS "originalFilename", storage_key AS "storageKey",
              document_family_id AS "documentFamilyId", version_number AS "versionNumber",
              visual_hash AS "visualHash", content_fingerprint AS "contentFingerprint",
              extraction_status AS "extractionStatus", created_at AS "createdAt"
         FROM health_documents
        WHERE patient_id = $1 AND deleted_at IS NULL AND visual_hash = $2
        ORDER BY version_number DESC
        LIMIT 1`,
      [patientId, visualHash]
    );
    return res.rows[0] ? DocumentMapper.toDto(res.rows[0]) : null;
  }

  async findFamilyVersions(patientId, documentFamilyId) {
    const res = await this.pool.query(
      `SELECT id, patient_id AS "patientId", doc_type AS "docType",
              original_filename AS "originalFilename", storage_key AS "storageKey",
              version_number AS "versionNumber", change_classification AS "changeClassification",
              diff_summary AS "diffSummary", summary,
              extraction_status AS "extractionStatus", created_at AS "createdAt"
         FROM health_documents
        WHERE patient_id = $1 AND document_family_id = $2 AND deleted_at IS NULL
        ORDER BY version_number ASC`,
      [patientId, documentFamilyId]
    );
    return res.rows.map(DocumentMapper.toDto);
  }

  async updateContentTextHash(documentId, textHash) {
    const res = await this.pool.query(
      `UPDATE health_documents
          SET content_text_hash = $2,
              content_fingerprint = COALESCE(content_fingerprint, $2),
              updated_at = now()
        WHERE id = $1
        RETURNING id, content_text_hash AS "contentTextHash"`,
      [documentId, textHash]
    );
    return res.rows[0];
  }

  async updateDocumentMetadata(documentId, updates = {}) {
    const sets = [];
    const values = [documentId];
    let idx = 2;

    if (updates.summary !== undefined) {
      sets.push(`summary = $${idx++}`);
      values.push(updates.summary);
    }
    if (updates.diffSummary !== undefined) {
      sets.push(`diff_summary = $${idx++}`);
      values.push(JSON.stringify(updates.diffSummary));
    }
    if (updates.changeClassification !== undefined) {
      sets.push(`change_classification = $${idx++}`);
      values.push(updates.changeClassification);
    }
    if (updates.visualHash !== undefined) {
      sets.push(`visual_hash = $${idx++}`);
      values.push(updates.visualHash);
    }
    if (updates.contentFingerprint !== undefined) {
      sets.push(`content_fingerprint = $${idx++}`);
      values.push(updates.contentFingerprint);
    }

    if (sets.length === 0) return null;
    sets.push('updated_at = now()');

    const res = await this.pool.query(
      `UPDATE health_documents
          SET ${sets.join(', ')}
        WHERE id = $1
        RETURNING id, summary, diff_summary AS "diffSummary", change_classification AS "changeClassification"`,
      values
    );
    return res.rows[0];
  }

  async findDocumentById(patientId, documentId) {
    const cacheKey = `document:${patientId}:${documentId}`;
    return globalCache.coalesce(cacheKey, async () => {
      const docRes = await this.pool.query(
        `SELECT id, patient_id AS "patientId", doc_type AS "docType",
                original_filename AS "originalFilename", storage_key AS "storageKey",
                mime_type AS "mimeType", size_bytes AS "sizeBytes", sha256,
                document_family_id AS "documentFamilyId", version_number AS "versionNumber",
                visual_hash AS "visualHash", content_text_hash AS "contentTextHash",
                content_fingerprint AS "contentFingerprint", revision_of AS "revisionOf",
                change_classification AS "changeClassification", diff_summary AS "diffSummary",
                summary,
                extraction_status AS "extractionStatus", ocr_engine AS "ocrEngine",
                ner_model AS "nerModel", error_code AS "errorCode",
                processed_at AS "processedAt", created_at AS "createdAt"
           FROM health_documents
          WHERE id = $1 AND patient_id = $2 AND deleted_at IS NULL`,
        [documentId, patientId]
      );
      const document = docRes.rows[0];
      if (!document) return null;

      const fieldsRes = await this.pool.query(
        `SELECT id, document_id AS "documentId", field_name AS "fieldName",
                raw_value AS "rawValue", normalized_value AS "normalizedValue",
                rxnorm_code AS "rxnormCode", loinc_code AS "loincCode", icd_code AS "icdCode",
                confidence, page_number AS "pageNumber", section, status, confirmed_at AS "confirmedAt"
           FROM extracted_fields
          WHERE document_id = $1
          ORDER BY page_number ASC, created_at ASC`,
        [documentId]
      );
      document.extractions = fieldsRes.rows;
      return DocumentMapper.toDto(document);
    }, 10_000);
  }

  async listDocuments(patientId, limit = 20) {
    const res = await this.pool.query(
      `SELECT id, patient_id AS "patientId", doc_type AS "docType",
              original_filename AS "originalFilename", storage_key AS "storageKey",
              mime_type AS "mimeType", document_family_id AS "documentFamilyId",
              version_number AS "versionNumber", change_classification AS "changeClassification",
              summary, extraction_status AS "extractionStatus",
              created_at AS "createdAt"
         FROM health_documents
        WHERE patient_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT $2`,
      [patientId, limit]
    );
    return res.rows.map(DocumentMapper.toDto);
  }

  async updateExtractionStatus(documentId, status, { ocrEngine = null, nerModel = null, errorCode = null } = {}) {
    return withTransaction(this.pool, async (client) => {
      const res = await client.query(
        `UPDATE health_documents
            SET extraction_status = $2,
                ocr_engine = COALESCE($3, ocr_engine),
                ner_model = COALESCE($4, ner_model),
                error_code = COALESCE($5, error_code),
                processed_at = CASE WHEN $2 IN ('done', 'review_needed', 'failed') THEN now() ELSE processed_at END,
                updated_at = now()
          WHERE id = $1
          RETURNING id, extraction_status AS "extractionStatus"`,
        [documentId, status, ocrEngine, nerModel, errorCode]
      );
      globalCache.invalidatePrefix(`document:`);
      globalCache.invalidatePrefix(`api:`);
      return res.rows[0];
    });
  }

  async saveExtractedFields(documentId, patientId, fields, provenanceId = null) {
    if (!fields || fields.length === 0) return [];

    return withTransaction(this.pool, async (client) => {
      const inserted = [];
      for (const f of fields) {
        const res = await client.query(
          `INSERT INTO extracted_fields (
            document_id, patient_id, provenance_id, field_name, raw_value,
            normalized_value, rxnorm_code, loinc_code, icd_code, confidence,
            page_number, section, status, confirmed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING id, field_name AS "fieldName", raw_value AS "rawValue",
                    normalized_value AS "normalizedValue", confidence,
                    page_number AS "pageNumber", section, status`,
          [
            documentId,
            patientId,
            provenanceId,
            f.fieldName,
            f.rawValue,
            f.normalizedValue ?? f.rawValue,
            f.rxnormCode ?? null,
            f.loincCode ?? null,
            f.icdCode ?? null,
            f.confidence ?? 0.85,
            f.pageNumber ?? 1,
            f.section ?? null,
            f.status ?? 'pending',
            (f.status ?? 'pending') === 'confirmed' ? (f.confirmedAt ?? new Date()) : null,
          ]
        );
        inserted.push(DocumentMapper.toExtractionDto(res.rows[0]));
      }
      globalCache.invalidatePrefix(`document:`);
      return inserted;
    });
  }

  async updateFieldStatus(fieldId, status) {
    return withTransaction(this.pool, async (client) => {
      const res = await client.query(
        `UPDATE extracted_fields
            SET status = $2,
                confirmed_at = CASE WHEN $2 = 'confirmed' THEN now() ELSE NULL END,
                updated_at = now()
          WHERE id = $1
          RETURNING id, field_name AS "fieldName", status, confirmed_at AS "confirmedAt"`,
        [fieldId, status]
      );
      globalCache.invalidatePrefix(`document:`);
      return res.rows[0] ? DocumentMapper.toExtractionDto(res.rows[0]) : null;
    });
  }

  async #hasVectorType() {
    if (this._hasVector !== undefined) return this._hasVector;
    try {
      const res = await this.pool.query("SELECT 1 FROM pg_type WHERE typname = 'vector'");
      this._hasVector = res.rowCount > 0;
    } catch {
      this._hasVector = false;
    }
    return this._hasVector;
  }

  async storeEmbedding(patientId, { documentId = null, clinicalRecordId = null, healthEventId = null, pageNumber = 1, section = null, contentText, embedding }) {
    const hasVector = await this.#hasVectorType();
    return withTransaction(this.pool, async (client) => {
      const embParam = hasVector
        ? toVectorLiteral(embedding)
        : (Array.isArray(embedding) ? embedding : Array.from(embedding || []));

      const sql = hasVector
        ? `INSERT INTO clinical_embeddings (
            patient_id, document_id, clinical_record_id, health_event_id, page_number, section, content_text, embedding
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
          RETURNING id, patient_id AS "patientId", document_id AS "documentId", page_number AS "pageNumber", section, content_text AS "contentText", created_at AS "createdAt"`
        : `INSERT INTO clinical_embeddings (
            patient_id, document_id, clinical_record_id, health_event_id, page_number, section, content_text, embedding
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, patient_id AS "patientId", document_id AS "documentId", page_number AS "pageNumber", section, content_text AS "contentText", created_at AS "createdAt"`;

      const res = await client.query(sql, [patientId, documentId, clinicalRecordId, healthEventId, pageNumber, section, contentText, embParam]);
      return res.rows[0];
    });
  }

  async searchEmbeddings(patientId, queryEmbedding, limit = 5) {
    const hasVector = await this.#hasVectorType();
    if (hasVector) {
      const res = await this.pool.query(
        `SELECT id, document_id AS "documentId", clinical_record_id AS "clinicalRecordId", health_event_id AS "healthEventId",
                page_number AS "pageNumber", section,
                content_text AS "contentText",
                1 - (embedding <=> $2::vector) AS similarity
           FROM clinical_embeddings
          WHERE patient_id = $1
          ORDER BY embedding <=> $2::vector ASC
          LIMIT $3`,
        [patientId, toVectorLiteral(queryEmbedding), limit]
      );
      return res.rows;
    }

    const res = await this.pool.query(
      `SELECT id, document_id AS "documentId", clinical_record_id AS "clinicalRecordId", health_event_id AS "healthEventId",
              page_number AS "pageNumber", section,
              content_text AS "contentText",
              embedding
         FROM clinical_embeddings
        WHERE patient_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [patientId]
    );

    const target = Array.isArray(queryEmbedding) ? queryEmbedding : Array.from(queryEmbedding || []);
    const withSim = res.rows.map((row) => {
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
      return {
        id: row.id,
        documentId: row.documentId,
        clinicalRecordId: row.clinicalRecordId,
        healthEventId: row.healthEventId,
        pageNumber: row.pageNumber,
        section: row.section,
        contentText: row.contentText,
        similarity: Number(sim.toFixed(4)),
      };
    });

    withSim.sort((a, b) => b.similarity - a.similarity);
    return withSim.slice(0, limit);
  }

  async searchGuidelineEmbeddings(queryEmbedding, limit = 5) {
    const hasVector = await this.#hasVectorType();
    if (hasVector) {
      const res = await this.pool.query(
        `SELECT id, source_name AS "sourceName", title, section,
                content_text AS "contentText",
                1 - (embedding <=> $1::vector) AS similarity
           FROM guideline_embeddings
          ORDER BY embedding <=> $1::vector ASC
          LIMIT $2`,
        [toVectorLiteral(queryEmbedding), limit]
      );
      return res.rows;
    }

    const res = await this.pool.query(
      `SELECT id, source_name AS "sourceName", title, section,
              content_text AS "contentText",
              embedding
         FROM guideline_embeddings
        ORDER BY created_at DESC
        LIMIT 50`
    );

    const target = Array.isArray(queryEmbedding) ? queryEmbedding : Array.from(queryEmbedding || []);
    const withSim = res.rows.map((row) => {
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
      return {
        id: row.id,
        sourceName: row.sourceName,
        title: row.title,
        section: row.section,
        contentText: row.contentText,
        similarity: Number(sim.toFixed(4)),
      };
    });

    withSim.sort((a, b) => b.similarity - a.similarity);
    return withSim.slice(0, limit);
  }
}
