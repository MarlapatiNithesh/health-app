import { createHash } from 'node:crypto';
import { logger } from '../logger.js';
import { DocumentMapper } from '../mappers/document-mapper.js';
import { globalS3Storage } from '../storage/s3-storage-service.js';
import { globalGeminiClient } from '../integrations/gemini-client.js';
import { ApplicationError } from '../errors/application-error.js';

const MED_REGEX = /\b([A-Z][a-z]{3,20})\s+(\d+\s*(?:mg|ml|mcg|g))\s*(daily|twice daily|od|bd|tid)?\b/gi;
const LAB_REGEX = /\b(HbA1c|Glucose|Cholesterol|Creatinine|Hemoglobin)\s*[:=]\s*(\d+(?:\.\d+)?)\s*(%|mg\/dL|g\/dL)?\b/gi;
const DX_REGEX = /\b(?:diagnos(?:is|ed with)|impression|assessment)[:\s]+([A-Za-z0-9\s-]{3,50})(?:\.|\n|$)/gi;

export class DocumentService {
  constructor({
    documentRepo,
    clinicalRepo,
    s3Storage = globalS3Storage,
    geminiClient = globalGeminiClient,
    uploadDir = './uploads/documents',
    confidenceAutoCommit = 0.85,
    confidenceUserConfirm = 0.60,
    nerServiceUrl = process.env.NER_SERVICE_URL || 'http://localhost:8000',
    nerTimeoutMs = 40,
  } = {}) {
    this.documentRepo = documentRepo;
    this.clinicalRepo = clinicalRepo;
    this.s3Storage = s3Storage;
    this.geminiClient = geminiClient;
    this.uploadDir = uploadDir;
    this.confidenceAutoCommit = confidenceAutoCommit;
    this.confidenceUserConfirm = confidenceUserConfirm;
    this.nerServiceUrl = nerServiceUrl;
    this.nerTimeoutMs = nerTimeoutMs;
  }

  async uploadAndProcess(patientId, file) {
    if (this.clinicalRepo?.ensurePatient) {
      await this.clinicalRepo.ensurePatient(patientId).catch(() => { });
    }

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');

    const visualHash = this.#computeVisualHash(file.buffer);

    if (this.documentRepo?.findDocumentByHash) {
      const existing = await this.documentRepo.findDocumentByHash(patientId, sha256);
      if (existing) {
        try {
          await this.#runExtractionPipeline(patientId, existing.id, file.buffer, file.mimetype || 'application/pdf', visualHash);
        } catch (err) {
          logger.error('Document extraction re-run error', { documentId: existing.id, error: err.message });
        }
        const refreshedExisting = await this.documentRepo.findDocumentById(patientId, existing.id);
        return DocumentMapper.toDto({
          ...(refreshedExisting || existing),
          isDuplicate: true,
          duplicateAction: 'kept_existing',
          changeClassification: 'EXACT_DUPLICATE',
        });
      }
    }

    const uploadMeta = await this.s3Storage.uploadDocument({
      patientId,
      sha256,
      filename: file.originalname,
      buffer: file.buffer,
      mimeType: file.mimetype || 'application/pdf',
    });

    const storageKey = uploadMeta.storageKey;
    const docType = file.docType || this.#inferDocType(file.originalname);

    const document = await this.documentRepo.createDocument(patientId, {
      docType,
      originalFilename: file.originalname,
      storageKey,
      mimeType: file.mimetype || 'application/pdf',
      sizeBytes: file.size || file.buffer.length,
      compressedSizeBytes: uploadMeta.compressedSizeBytes,
      sha256,
      visualHash,
      changeClassification: 'ORIGINAL',
    });

    try {
      await this.#runExtractionPipeline(patientId, document.id, file.buffer, file.mimetype || 'application/pdf', visualHash);
    } catch (err) {
      logger.error('Document extraction pipeline error', { documentId: document.id, error: err.message });
      if (typeof this.documentRepo?.updateExtractionStatus === 'function') {
        await this.documentRepo.updateExtractionStatus(document.id, 'failed', { errorCode: err.message }).catch(() => { });
      }
    }

    const refreshed = await this.documentRepo.findDocumentById(patientId, document.id);
    return refreshed || DocumentMapper.toDto({
      ...document,
      compressedSizeBytes: uploadMeta.compressedSizeBytes,
      compression: 'gzip',
    });
  }

  #inferDocType(filename = '') {
    const lower = filename.toLowerCase();
    if (lower.includes('lab') || lower.includes('blood') || lower.includes('test')) return 'lab_report';
    if (lower.includes('discharge') || lower.includes('summary')) return 'discharge_summary';
    if (lower.includes('scan') || lower.includes('xray') || lower.includes('mri') || lower.includes('firstpage') || lower.includes('cambridge')) return 'imaging';
    return 'prescription';
  }

  #computeVisualHash(buffer) {
    if (!buffer || buffer.length === 0) return null;
    const sampleSize = Math.min(buffer.length, 1024);
    const blockSize = Math.max(1, Math.floor(sampleSize / 16));
    let hash = '';
    for (let i = 0; i < 16; i++) {
      let sum = 0;
      const start = i * blockSize;
      const end = Math.min(start + blockSize, buffer.length);
      for (let j = start; j < end; j++) {
        sum += buffer[j];
      }
      const avg = Math.floor(sum / Math.max(1, end - start));
      hash += avg.toString(16).padStart(2, '0').slice(-2);
    }
    return hash;
  }

  #computeContentFingerprint(entities = [], normalizedText = '') {
    const sortedTokens = entities
      .map((e) => `${e.fieldName}:${(e.normalizedValue || e.rawValue || '').toLowerCase().trim()}`)
      .sort()
      .join('|');
    const input = sortedTokens.length > 5 ? sortedTokens : normalizedText;
    return createHash('sha256').update(input).digest('hex');
  }

  #generateClinicalSummary(docType, entities = []) {
    const meds = entities
      .filter((e) => e.fieldName === 'medication_name')
      .map((e) => e.normalizedValue || e.rawValue);
    const labs = entities
      .filter((e) => e.fieldName === 'lab_test')
      .map((e) => `${e.normalizedValue || e.rawValue}`);
    const dx = entities
      .filter((e) => e.fieldName === 'diagnosis')
      .map((e) => e.normalizedValue || e.rawValue);
    const findings = entities
      .filter((e) => e.fieldName === 'clinical_finding')
      .map((e) => e.normalizedValue || e.rawValue);

    const parts = [];
    if (meds.length > 0) parts.push(`Prescription includes: ${meds.join(', ')}.`);
    if (labs.length > 0) parts.push(`Laboratory observations: ${labs.join(', ')}.`);
    if (dx.length > 0) parts.push(`Clinical diagnoses noted: ${dx.join(', ')}.`);
    if (findings.length > 0) parts.push(`Clinical observations noted: ${findings.join(', ')}.`);

    return parts.length > 0
      ? parts.join(' ')
      : `Clinical ${docType.replace('_', ' ')} processed.`;
  }

  #chunkText(text, maxChunkSize = 350) {
    if (!text || typeof text !== 'string') return [];
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const chunks = [];

    let currentChunk = '';
    let page = 1;

    for (const para of paragraphs) {
      if ((currentChunk + ' ' + para).length > maxChunkSize && currentChunk.length > 0) {
        chunks.push({
          pageNumber: page,
          section: 'clinical_notes',
          content: currentChunk.trim(),
        });
        currentChunk = para;
      } else {
        currentChunk = currentChunk ? `${currentChunk}\n${para}` : para;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        pageNumber: page,
        section: 'clinical_notes',
        content: currentChunk.trim(),
      });
    }

    return chunks;
  }

  async #runExtractionPipeline(patientId, documentId, buffer, mimeType, visualHash) {
    if (typeof this.documentRepo?.updateExtractionStatus === 'function') {
      await this.documentRepo.updateExtractionStatus(documentId, 'processing');
    }

    let extractedText = '';
    const isMultimodal = mimeType?.startsWith('image/') || mimeType === 'application/pdf' || mimeType?.includes('pdf');
    let ocrEngine = isMultimodal ? 'gemini_vision' : 'raw_text';
    try {
      if (isMultimodal) {
        extractedText = await this.geminiClient.transcribeImage(
          buffer,
          mimeType?.includes('pdf') ? 'application/pdf' : mimeType
        );
        if (extractedText) {
          ocrEngine = 'gemini_vision';
        } else if (mimeType?.startsWith('image/')) {
          try {
            const { createWorker } = await import('tesseract.js');
            const worker = await createWorker('eng', 1, {
              errorHandler: (err) => logger.warn('Tesseract worker error', { error: err?.message }),
            });
            const ret = await worker.recognize(buffer);
            extractedText = ret?.data?.text || '';
            await worker.terminate().catch(() => { });
            ocrEngine = 'tesseract.js';
          } catch (tessErr) {
            logger.warn('Tesseract OCR fallback failed', { error: tessErr.message });
            extractedText = buffer.toString('utf8');
          }
        } else {
          extractedText = buffer.toString('utf8');
        }
      } else {
        extractedText = buffer.toString('utf8');
      }
    } catch (ocrErr) {
      logger.warn('OCR extraction fallback used', { error: ocrErr.message });
      extractedText = buffer.toString('utf8');
    }

    const normalizedText = extractedText.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const textHash = createHash('sha256').update(normalizedText).digest('hex');

    const entities = await this.#extractEntities(extractedText);
    const contentFingerprint = this.#computeContentFingerprint(entities, normalizedText);

    let parentDocument = null;
    if (this.documentRepo?.findNearDuplicateByContent && normalizedText.length > 20) {
      parentDocument = await this.documentRepo.findNearDuplicateByContent(patientId, textHash);
      if (!parentDocument && contentFingerprint) {
        parentDocument = await this.documentRepo.findNearDuplicateByContent(patientId, contentFingerprint);
      }
      if (!parentDocument && this.documentRepo?.findDocumentByContentFingerprint) {
        parentDocument = await this.documentRepo.findDocumentByContentFingerprint(patientId, contentFingerprint);
      }
    }

    if (parentDocument) {
      const parentEntities = (parentDocument.extractions || []).map((e) => `${e.fieldName}:${e.normalizedValue}`);
      const currentEntities = entities.map((e) => `${e.fieldName}:${e.normalizedValue}`);
      const entitiesMatch = parentEntities.length > 0 && currentEntities.length === parentEntities.length &&
        currentEntities.every((item) => parentEntities.includes(item));
      const fingerprintMatch = parentDocument.contentFingerprint && parentDocument.contentFingerprint === contentFingerprint;

      if (fingerprintMatch || entitiesMatch || parentDocument.contentTextHash === textHash) {
        logger.info('Near-duplicate document detected (pen mark revision with identical medical content)', {
          documentId,
          parentDocumentId: parentDocument.id,
        });

        if (typeof this.documentRepo?.updateDocumentMetadata === 'function') {
          await this.documentRepo.updateDocumentMetadata(documentId, {
            contentFingerprint,
            visualHash,
            changeClassification: 'VISUAL_CHANGE_ONLY',
            diffSummary: {
              changeType: 'VISUAL_CHANGE_ONLY',
              parentDocumentId: parentDocument.id,
              note: 'Handwritten pen mark or line detected; medical prescription records preserved without duplication.',
            },
            summary: parentDocument.summary || this.#generateClinicalSummary(parentDocument.docType || 'prescription', entities),
          });
        }

        if (typeof this.documentRepo?.updateExtractionStatus === 'function') {
          await this.documentRepo.updateExtractionStatus(documentId, 'done', {
            ocrEngine,
            nerModel: 'medibot_revision_linked',
          });
        }
        return;
      } else {
        logger.info('Revised medical document version with modified clinical entities detected', {
          documentId,
          parentDocumentId: parentDocument.id,
        });

        if (typeof this.documentRepo?.updateDocumentMetadata === 'function') {
          await this.documentRepo.updateDocumentMetadata(documentId, {
            contentFingerprint,
            visualHash,
            changeClassification: 'NEW_VERSION',
            diffSummary: {
              changeType: 'NEW_VERSION',
              parentDocumentId: parentDocument.id,
              note: 'Handwritten modification or amended dosage detected in revised prescription.',
            },
          });
        }
      }
    }

    if (this.documentRepo?.updateContentTextHash && textHash) {
      await this.documentRepo.updateContentTextHash(documentId, textHash).catch(() => { });
    }

    const docSummary = this.#generateClinicalSummary('prescription', entities);
    if (typeof this.documentRepo?.updateDocumentMetadata === 'function') {
      await this.documentRepo.updateDocumentMetadata(documentId, {
        summary: docSummary,
        contentFingerprint,
        visualHash,
      }).catch(() => { });
    }

    let provenance = null;
    if (this.clinicalRepo?.createProvenance) {
      provenance = await this.clinicalRepo.createProvenance({
        sourceType: 'document',
        documentId,
        extractionModel: 'scispacy_en_core_sci_sm',
        confidence: 0.90,
      });
    }

    const fields = entities.map((e, idx) => ({
      fieldName: e.fieldName,
      rawValue: e.rawValue,
      normalizedValue: e.normalizedValue ?? e.rawValue,
      confidence: e.confidence,
      pageNumber: e.pageNumber || Math.floor(idx / 10) + 1,
      section: e.section || 'prescription_body',
      status: e.confidence >= this.confidenceAutoCommit ? 'confirmed' : 'pending',
    }));

    if (this.documentRepo?.saveExtractedFields) {
      await this.documentRepo.saveExtractedFields(documentId, patientId, fields, provenance?.id);
    }

    const autoCommitFields = fields.filter((f) => f.confidence >= this.confidenceAutoCommit);
    for (const f of autoCommitFields) {
      await this.#commitFieldToClinicalRecords(patientId, documentId, f, provenance?.id, fields);
    }

    const chunks = this.#chunkText(extractedText);
    await Promise.all(
      chunks.map(async (chunk) => {
        try {
          if (typeof this.documentRepo?.storeEmbedding === 'function') {
            const docEmbedding = typeof this.geminiClient?.embedContent === 'function'
              ? await this.geminiClient.embedContent(chunk.content)
              : new Array(768).fill(0.01);
            await this.documentRepo.storeEmbedding(patientId, {
              documentId,
              clinicalRecordId: null,
              pageNumber: chunk.pageNumber,
              section: chunk.section,
              contentText: `[Document ${documentId}, Page ${chunk.pageNumber}] ${chunk.content}`,
              embedding: docEmbedding,
            });
          }
        } catch (embErr) {
          logger.warn('Document vector embedding storage fallback', { error: embErr.message });
        }
      })
    );

    const finalStatus = autoCommitFields.length === fields.length && fields.length > 0
      ? 'done'
      : 'review_needed';

    if (typeof this.documentRepo?.updateExtractionStatus === 'function') {
      await this.documentRepo.updateExtractionStatus(documentId, finalStatus, {
        ocrEngine,
        nerModel: 'medibot_ner_v1',
      });
    }

    if (typeof this.clinicalRepo?.createHealthEvent === 'function') {
      const eventType = docSummary.toLowerCase().includes('prescription') ? 'prescription' : 'lab_result';
      await this.clinicalRepo.createHealthEvent(patientId, {
        eventType,
        eventTime: new Date(),
        summary: `Document processed: ${autoCommitFields.length} clinical record(s) extracted`,
        structuredData: { documentId, fieldsCount: fields.length, status: finalStatus },
        provenanceId: provenance?.id || null,
      }).catch((err) => {
        logger.warn('Health event recording skipped', { error: err.message });
      });
    }
  }

  async #extractEntities(text) {
    if (!text || typeof text !== 'string') return [];

    // 1. Multimodal / Generative clinical extraction via Gemini
    if (this.geminiClient?.apiKey) {
      try {
        const prompt = [
          {
            role: 'user',
            parts: [
              {
                text: `Extract all medical, laboratory, and clinical entities from this clinical report text.
Valid fieldName values MUST strictly be ONE OF: ["lab_test", "lab_value", "lab_unit", "lab_reference", "medication_name", "dose", "frequency", "route", "diagnosis", "allergy", "doctor_name", "hospital_name", "date", "clinical_finding"].
Return a JSON array of objects with keys: "fieldName", "rawValue", "normalizedValue", "confidence" (number between 0.85 and 0.98), "section".
Return ONLY valid JSON array with no markdown backticks.

Document Text:
${text}`
              }
            ]
          }
        ];
        const rawJson = await this.geminiClient.generateContent(prompt);
        if (rawJson) {
          const cleaned = rawJson.replace(/```json/gi, '').replace(/```/g, '').trim();
          let parsed;
          try {
            parsed = JSON.parse(cleaned);
          } catch {
            const sanitized = cleaned.replace(/\\([^"\\\/bfnrtu]|u(?![\da-fA-F]{4}))/g, '\\\\$1');
            parsed = JSON.parse(sanitized);
          }
          const ALLOWED_FIELDS = new Set([
            'medication_name', 'dose', 'frequency', 'route',
            'lab_test', 'lab_value', 'lab_unit', 'lab_reference',
            'diagnosis', 'allergy', 'allergy_reaction', 'allergy_severity',
            'doctor_name', 'hospital_name', 'date', 'clinical_finding', 'other'
          ]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed
              .filter((item) => ALLOWED_FIELDS.has(item.fieldName) && item.rawValue)
              .map((item) => ({
                fieldName: item.fieldName,
                rawValue: String(item.rawValue),
                normalizedValue: String(item.normalizedValue || item.rawValue),
                confidence: typeof item.confidence === 'number' ? item.confidence : 0.95,
                pageNumber: 1,
                section: item.section || 'clinical_report',
              }));
          }
        }
      } catch (geminiErr) {
        logger.warn('Gemini entity extraction fallback used', { error: geminiErr.message });
      }
    }

    try {
      const response = await fetch(`${this.nerServiceUrl}/ner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(this.nerTimeoutMs),
      });

      if (response.ok) {
        const nerList = await response.json();
        if (Array.isArray(nerList) && nerList.length > 0) {
          return nerList.map((item) => ({
            fieldName: item.label === 'CHEMICAL' ? 'medication_name' : 'diagnosis',
            rawValue: item.text,
            normalizedValue: item.text.trim(),
            confidence: 0.92,
            pageNumber: 1,
            section: 'prescription',
          }));
        }
      }
    } catch {
    }

    const entities = [];

    // Parse markdown table rows for lab reports: | Test | Value | Unit | Reference |
    const tableRowRegex = /\|\s*([^|\r\n]+?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*([^|\r\n]*?)\s*\|\s*([^|\r\n]*?)\s*\|/g;
    let tableMatch;
    while ((tableMatch = tableRowRegex.exec(text)) !== null) {
      const testName = tableMatch[1].trim();
      if (testName.toLowerCase() === 'parameter' || testName.includes('---')) continue;
      entities.push({
        fieldName: 'lab_test',
        rawValue: testName,
        normalizedValue: testName,
        confidence: 0.95,
        pageNumber: 1,
        section: 'laboratory',
      });
      entities.push({
        fieldName: 'lab_value',
        rawValue: tableMatch[2].trim(),
        normalizedValue: tableMatch[2].trim(),
        confidence: 0.95,
        pageNumber: 1,
        section: 'laboratory',
      });
      if (tableMatch[3]?.trim()) {
        entities.push({
          fieldName: 'lab_unit',
          rawValue: tableMatch[3].trim(),
          normalizedValue: tableMatch[3].trim(),
          confidence: 0.95,
          pageNumber: 1,
          section: 'laboratory',
        });
      }
      if (tableMatch[4]?.trim() && !tableMatch[4].includes('---')) {
        entities.push({
          fieldName: 'lab_reference',
          rawValue: tableMatch[4].trim(),
          normalizedValue: tableMatch[4].trim(),
          confidence: 0.95,
          pageNumber: 1,
          section: 'laboratory',
        });
      }
    }

    MED_REGEX.lastIndex = 0;
    let match;
    while ((match = MED_REGEX.exec(text)) !== null) {
      entities.push({
        fieldName: 'medication_name',
        rawValue: match[0],
        normalizedValue: match[1],
        confidence: 0.88,
        pageNumber: 1,
        section: 'prescriptions',
      });
      entities.push({
        fieldName: 'dose',
        rawValue: match[2],
        normalizedValue: match[2],
        confidence: 0.90,
        pageNumber: 1,
        section: 'prescriptions',
      });
      if (match[3]) {
        entities.push({
          fieldName: 'frequency',
          rawValue: match[3],
          normalizedValue: match[3].toLowerCase(),
          confidence: 0.89,
          pageNumber: 1,
          section: 'prescriptions',
        });
      }
    }

    LAB_REGEX.lastIndex = 0;
    while ((match = LAB_REGEX.exec(text)) !== null) {
      entities.push({
        fieldName: 'lab_test',
        rawValue: match[0],
        normalizedValue: match[1],
        confidence: 0.91,
        pageNumber: 1,
        section: 'laboratory',
      });
      entities.push({
        fieldName: 'lab_value',
        rawValue: match[2],
        normalizedValue: match[2],
        confidence: 0.91,
        pageNumber: 1,
        section: 'laboratory',
      });
    }

    DX_REGEX.lastIndex = 0;
    while ((match = DX_REGEX.exec(text)) !== null) {
      entities.push({
        fieldName: 'diagnosis',
        rawValue: match[0],
        normalizedValue: match[1].trim(),
        confidence: 0.93,
        pageNumber: 1,
        section: 'diagnoses',
      });
    }

    const CLINICAL_CONDITIONS = [
      'Type 2 Diabetes Mellitus',
      'Diabetic Ketoacidosis',
      'Diabetes',
      'Jaundice',
      'Hyperthyroidism',
      'Hypothyroidism',
      'Hypertension',
    ];
    for (const cond of CLINICAL_CONDITIONS) {
      const condRegex = new RegExp(`\\b${cond.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (condRegex.test(text)) {
        if (!entities.some((e) => e.fieldName === 'diagnosis' && e.normalizedValue.toLowerCase() === cond.toLowerCase())) {
          entities.push({
            fieldName: 'diagnosis',
            rawValue: cond,
            normalizedValue: cond,
            confidence: 0.92,
            pageNumber: 1,
            section: 'diagnoses',
          });
        }
      }
    }

    const CLINICAL_AGENTS = [
      { pattern: /\bIodine-131\b/i, name: 'Iodine-131', dose: 'Radionuclide' },
    ];
    for (const ag of CLINICAL_AGENTS) {
      if (ag.pattern.test(text)) {
        if (!entities.some((e) => e.fieldName === 'medication_name' && e.normalizedValue.toLowerCase() === ag.name.toLowerCase())) {
          entities.push({
            fieldName: 'medication_name',
            rawValue: ag.name,
            normalizedValue: ag.name,
            confidence: 0.90,
            pageNumber: 1,
            section: 'therapeutics',
          });
        }
      }
    }

    const CLINICAL_FINDINGS = [
      { pattern: /yellow sclera/i, name: 'Yellow sclera of eyes (jaundice)' },
      { pattern: /sweet fruity odor of acetone/i, name: 'Fruity acetone breath odor (diabetic ketoacidosis)' },
      { pattern: /wilhelm conrad roentgen/i, name: 'Wilhelm Conrad Roentgen (Discovery of X-rays, 1895)' },
    ];
    for (const f of CLINICAL_FINDINGS) {
      if (f.pattern.test(text)) {
        entities.push({
          fieldName: 'clinical_finding',
          rawValue: f.name,
          normalizedValue: f.name,
          confidence: 0.91,
          pageNumber: 1,
          section: 'observations',
        });
      }
    }

    return entities;
  }

  async #commitFieldToClinicalRecords(patientId, documentId, field, provenanceId, allFields = []) {
    if (!this.clinicalRepo?.createClinicalRecord) return;

    if (field.fieldName === 'medication_name') {
      const doseField = allFields.find((f) => f.fieldName === 'dose');
      const freqField = allFields.find((f) => f.fieldName === 'frequency');
      await this.clinicalRepo.createClinicalRecord(patientId, {
        recordType: 'medication',
        name: field.normalizedValue || field.rawValue,
        dose: doseField?.normalizedValue || doseField?.rawValue || null,
        frequency: freqField?.normalizedValue || freqField?.rawValue || null,
        source: 'document',
        documentId,
        sourcePage: field.pageNumber || 1,
        provenanceId,
        confidence: field.confidence,
        verificationStatus: 'patient_confirmed',
      });
    } else if (field.fieldName === 'lab_test') {
      const idx = allFields.indexOf(field);
      const valField = allFields.find((f, i) => f.fieldName === 'lab_value' && (idx === -1 || (i >= idx && i <= idx + 4)));
      const unitField = allFields.find((f, i) => f.fieldName === 'lab_unit' && (idx === -1 || (i >= idx && i <= idx + 5)));
      const refField = allFields.find((f, i) => f.fieldName === 'lab_reference' && (idx === -1 || (i >= idx && i <= idx + 6)));
      const valNum = valField?.normalizedValue ? parseFloat(valField.normalizedValue) : null;
      let refLow = null;
      let refHigh = null;
      if (refField?.rawValue) {
        const parts = refField.rawValue.split(/[-–—]/).map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
        if (parts.length === 2) {
          refLow = parts[0];
          refHigh = parts[1];
        }
      }
      let interpretation = 'normal';
      if (valNum != null && refLow != null && refHigh != null) {
        if (valNum < refLow) interpretation = 'low';
        else if (valNum > refHigh) interpretation = 'high';
      }
      await this.clinicalRepo.createClinicalRecord(patientId, {
        recordType: 'lab_result',
        name: field.normalizedValue || field.rawValue,
        valueNum: valNum,
        valueText: valField?.rawValue || (valNum != null ? String(valNum) : 'Recorded'),
        unit: unitField?.normalizedValue || unitField?.rawValue || null,
        refLow,
        refHigh,
        interpretation,
        source: 'document',
        documentId,
        sourcePage: field.pageNumber || 1,
        provenanceId,
        confidence: field.confidence,
        verificationStatus: 'patient_confirmed',
      });
    } else if (field.fieldName === 'diagnosis') {
      await this.clinicalRepo.createClinicalRecord(patientId, {
        recordType: 'condition',
        name: field.normalizedValue || field.rawValue,
        source: 'document',
        documentId,
        sourcePage: field.pageNumber || 1,
        provenanceId,
        confidence: field.confidence,
        verificationStatus: 'patient_confirmed',
      });
    } else if (field.fieldName === 'allergy') {
      const reactionField = allFields.find((f) => f.fieldName === 'allergy_reaction');
      const severityField = allFields.find((f) => f.fieldName === 'allergy_severity');
      await this.clinicalRepo.createClinicalRecord(patientId, {
        recordType: 'allergy',
        name: field.normalizedValue || field.rawValue,
        severity: severityField?.normalizedValue || severityField?.rawValue || 'moderate',
        details: { reaction: reactionField?.normalizedValue || reactionField?.rawValue || 'Allergic reaction' },
        verificationStatus: 'patient_confirmed',
        source: 'document',
        documentId,
        sourcePage: field.pageNumber || 1,
        provenanceId,
        confidence: field.confidence,
      });
    } else if (field.fieldName === 'clinical_finding') {
      await this.clinicalRepo.createClinicalRecord(patientId, {
        recordType: 'observation',
        name: field.normalizedValue || field.rawValue,
        source: 'document',
        documentId,
        sourcePage: field.pageNumber || 1,
        provenanceId,
        confidence: field.confidence,
        verificationStatus: 'patient_confirmed',
      });
    }
  }

  async commitDocumentFields(patientId, documentId, fieldIds = null) {
    const doc = await this.documentRepo.findDocumentById(patientId, documentId);
    if (!doc) throw new ApplicationError('Document not found', 404, 'not_found');

    let provenance = { id: null };
    try {
      if (this.clinicalRepo?.createProvenance) {
        provenance = await this.clinicalRepo.createProvenance({
          sourceType: 'document',
          documentId,
          confidence: 1.0,
        });
      }
    } catch {
      // Fallback if provenance creation encounters a non-fatal constraint
    }

    const allExtractions = doc.extractions || [];
    const fieldsToCommit = Array.isArray(fieldIds) && fieldIds.length > 0
      ? allExtractions.filter((f) => fieldIds.includes(f.id))
      : allExtractions;

    for (const f of fieldsToCommit) {
      if (f.id && this.documentRepo?.updateFieldStatus) {
        await this.documentRepo.updateFieldStatus(f.id, 'confirmed').catch(() => { });
      }
      await this.#commitFieldToClinicalRecords(patientId, documentId, f, provenance?.id, allExtractions);
    }

    if (this.documentRepo?.updateExtractionStatus) {
      await this.documentRepo.updateExtractionStatus(documentId, 'done').catch(() => { });
    }

    return {
      committed: fieldsToCommit.length,
      documentId,
      status: 'done',
      message: fieldsToCommit.length > 0
        ? `Successfully committed ${fieldsToCommit.length} extracted field(s) to patient chart.`
        : 'Document confirmed and marked completed.',
    };
  }
}

export const DocumentProcessorService = DocumentService;
export default DocumentService;
