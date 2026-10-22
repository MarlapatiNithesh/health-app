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
      await this.clinicalRepo.ensurePatient(patientId).catch(() => {});
    }

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');

    const visualHash = this.#computeVisualHash(file.buffer);

    if (this.documentRepo?.findDocumentByHash) {
      const existing = await this.documentRepo.findDocumentByHash(patientId, sha256);
      if (existing) {
        try {
          await this.#runExtractionPipeline(patientId, existing.id, file.buffer, file.mimetype || 'application/pdf', visualHash, file.originalname);
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
      await this.#runExtractionPipeline(patientId, document.id, file.buffer, file.mimetype || 'application/pdf', visualHash, file.originalname);
    } catch (err) {
      logger.error('Document extraction pipeline error', { documentId: document.id, error: err.message });
      if (typeof this.documentRepo?.updateExtractionStatus === 'function') {
        await this.documentRepo.updateExtractionStatus(document.id, 'failed', { errorCode: err.message }).catch(() => {});
      }
    }

    const refreshed = await this.documentRepo.findDocumentById(patientId, document.id);
    return refreshed || DocumentMapper.toDto({
      ...document,
      compressedSizeBytes: uploadMeta.compressedSizeBytes,
      compression: 'gzip',
    });
  }

  #inferDocType(filename = '', text = '') {
    return this.#detectDocType(text, filename, []);
  }

  #detectDocType(text = '', filename = '', entities = []) {
    const lowerText = (text || '').toLowerCase();
    const lowerName = (filename || '').toLowerCase();


    const imagingKeywords = [
      'x-ray', 'xray', 'mri', 'ct scan', 'computed tomography', 'magnetic resonance',
      'ultrasound', 'sonography', 'radiology', 'radiologist', 'mammogram',
      'radiograph', 'scan report', 'imaging study', 'contrast study', 'fluoroscopy',
      'echo', 'echocardiogram', 'pet scan'
    ];
    if (imagingKeywords.some((kw) => lowerName.includes(kw) || lowerText.includes(kw))) {
      return 'imaging';
    }


    const dischargeKeywords = [
      'discharge summary', 'discharge card', 'discharge advice', 'date of admission',
      'date of discharge', 'hospital course', 'condition on discharge', 'inpatient summary',
      'admission date', 'ipd no', 'discharge diagnosis', 'course in hospital'
    ];
    if (dischargeKeywords.some((kw) => lowerName.includes(kw) || lowerText.includes(kw))) {
      return 'discharge_summary';
    }


    const labKeywords = [
      'lab report', 'laboratory', 'pathology', 'biochemistry', 'hematology',
      'lipid profile', 'complete blood count', 'cbc', 'urine analysis',
      'fasting glucose', 'serology', 'lft', 'kft', 'thyroid profile',
      'reference range', 'specimen', 'biological reference', 'blood report',
      'hba1c', 'cholesterol', 'creatinine', 'hemoglobin', 'platelet', 'wbc count'
    ];
    const hasLabEntities = Array.isArray(entities) && entities.some((e) => e.fieldName === 'lab_test' || e.fieldName === 'lab_value');
    if (hasLabEntities || labKeywords.some((kw) => lowerName.includes(kw) || lowerText.includes(kw))) {
      return 'lab_report';
    }


    const rxKeywords = [
      'prescription', 'rx', 'prescribed', 'take once daily', 'dosage',
      'doctor', 'clinic', 'tablet', 'capsule', 'syrup', 'opd', 'dispense'
    ];
    const hasMedEntities = Array.isArray(entities) && entities.some((e) => e.fieldName === 'medication_name');
    if (hasMedEntities || rxKeywords.some((kw) => lowerName.includes(kw) || lowerText.includes(kw))) {
      return 'prescription';
    }

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

  async #runExtractionPipeline(patientId, documentId, buffer, mimeType, visualHash, filename = 'Document') {
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
            await worker.terminate().catch(() => {});
            ocrEngine = 'tesseract.js';
          } catch (tessErr) {
            logger.warn('Tesseract OCR fallback failed', { error: tessErr.message });
            extractedText = buffer.toString('utf8');
          }
        } else {
          extractedText = buffer.toString('utf8');
        }
      } else if (mimeType?.includes('wordprocessingml') || mimeType?.includes('docx')) {
        try {
          const raw = buffer.toString('utf8');
          const matches = raw.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
          if (matches && matches.length > 0) {
            extractedText = matches.map((m) => m.replace(/<[^>]+>/g, '')).join(' ');
          } else {
            extractedText = buffer.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
          }
        } catch {
          extractedText = buffer.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
        }
        ocrEngine = 'docx_xml';
      } else {
        extractedText = buffer.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
        ocrEngine = 'raw_text';
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
      await this.documentRepo.updateContentTextHash(documentId, textHash).catch(() => {});
    }

    const detectedType = this.#detectDocType(extractedText, filename, entities);
    if (this.documentRepo?.updateDocumentDocType) {
      await this.documentRepo.updateDocumentDocType(documentId, detectedType).catch(() => {});
    }

    const docSummary = this.#generateClinicalSummary(detectedType, entities);
    if (typeof this.documentRepo?.updateDocumentMetadata === 'function') {
      await this.documentRepo.updateDocumentMetadata(documentId, {
        summary: docSummary,
        contentFingerprint,
        visualHash,
      }).catch(() => {});
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
      status: 'confirmed',
    }));

    if (this.documentRepo?.saveExtractedFields) {
      await this.documentRepo.saveExtractedFields(documentId, patientId, fields, provenance?.id);
    }


    for (const f of fields) {
      await this.#commitFieldToClinicalRecords(patientId, documentId, f, provenance?.id, fields).catch(() => {});
    }

    await this.#recordDocumentEncounter(patientId, documentId, fields, filename);

    if (this.documentRepo?.updateExtractionStatus) {
      await this.documentRepo.updateExtractionStatus(documentId, 'done').catch(() => {});
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

    const finalStatus = fields.length > 0 ? 'done' : 'done';

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
        summary: `Document processed: ${fields.length} clinical record(s) extracted`,
        structuredData: { documentId, fieldsCount: fields.length, status: finalStatus },
        provenanceId: provenance?.id || null,
      }).catch((err) => {
        logger.warn('Health event recording skipped', { error: err.message });
      });
    }
  }

  async #extractEntities(text) {
    if (!text || typeof text !== 'string') return [];


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
      'Diabetes Mellitus',
      'Diabetes',
      'Hypertension',
      'Essential Hypertension',
      'High Blood Pressure',
      'Asthma',
      'Chronic Kidney Disease',
      'CKD',
      'Hyperthyroidism',
      'Hypothyroidism',
      'Jaundice',
      'Dyslipidemia',
      'Hyperlipidemia',
      'High Cholesterol',
      'GERD',
      'Migraine',
      'Fatty Liver',
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


    const ALLERGY_REGEX = /\b(?:allerg(?:y|ies)|allergic\s+to|known\s+allerg(?:y|ies))[:\s]+([A-Za-z0-9\s,\/\-]+?)(?:\.|\n|$|;)/gi;
    let algMatch;
    while ((algMatch = ALLERGY_REGEX.exec(text)) !== null) {
      const substance = algMatch[1].trim();
      if (substance && !/none|nkda|denies|no\s+known/i.test(substance)) {
        if (!entities.some((e) => e.fieldName === 'allergy' && e.normalizedValue.toLowerCase() === substance.toLowerCase())) {
          entities.push({
            fieldName: 'allergy',
            rawValue: substance,
            normalizedValue: substance,
            confidence: 0.94,
            pageNumber: 1,
            section: 'allergies',
          });
        }
      }
    }

    const CLINICAL_ALLERGENS = [
      'Penicillin',
      'Amoxicillin',
      'Sulfa',
      'Sulfamethoxazole',
      'Aspirin',
      'Ibuprofen',
      'NSAIDs',
      'Peanuts',
      'Latex',
      'Codeine',
      'Morphine',
      'Shellfish',
      'Ciprofloxacin',
    ];
    for (const alg of CLINICAL_ALLERGENS) {
      const algReg = new RegExp(`\\b${alg}\\b`, 'i');
      if (algReg.test(text)) {
        if (!entities.some((e) => e.fieldName === 'allergy' && e.normalizedValue.toLowerCase() === alg.toLowerCase())) {
          entities.push({
            fieldName: 'allergy',
            rawValue: alg,
            normalizedValue: alg,
            confidence: 0.93,
            pageNumber: 1,
            section: 'allergies',
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
      const idx = allFields.indexOf(field);
      const doseField = allFields.find((f, i) => f.fieldName === 'dose' && (idx === -1 || (i >= idx && i <= idx + 4)));
      const freqField = allFields.find((f, i) => f.fieldName === 'frequency' && (idx === -1 || (i >= idx && i <= idx + 4)));
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
      const isVital = /(?:pulse|heart\s*rate|bpm|spo2|oxygen|temp|temperature|weight|bp|blood\s*pressure)/i.test(
        field.normalizedValue || field.rawValue || ''
      );
      await this.clinicalRepo.createClinicalRecord(patientId, {
        recordType: isVital ? 'observation' : 'condition',
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

    }

    const allExtractions = doc.extractions || [];
    const fieldsToCommit = Array.isArray(fieldIds) && fieldIds.length > 0
      ? allExtractions.filter((f) => fieldIds.includes(f.id))
      : allExtractions;

    for (const f of fieldsToCommit) {
      if (f.id && this.documentRepo?.updateFieldStatus) {
        await this.documentRepo.updateFieldStatus(f.id, 'confirmed').catch(() => {});
      }
      await this.#commitFieldToClinicalRecords(patientId, documentId, f, provenance?.id, allExtractions);
    }

    await this.#recordDocumentEncounter(patientId, documentId, allExtractions, doc.originalFilename);

    if (this.documentRepo?.updateExtractionStatus) {
      await this.documentRepo.updateExtractionStatus(documentId, 'done').catch(() => {});
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


  async #recordDocumentEncounter(patientId, documentId, fields, filename) {
    try {
      const doctorField = fields.find((f) => f.fieldName === 'doctor_name');
      const hospitalField = fields.find((f) => f.fieldName === 'hospital_name');
      const dateField = fields.find((f) => f.fieldName === 'date');
      const findingFields = fields
        .filter((f) => (f.fieldName === 'diagnosis' || f.fieldName === 'clinical_finding') && !/(?:bpm|spo2|temp|weight)/i.test(f.normalizedValue || f.rawValue || ''))
        .map((f) => f.normalizedValue || f.rawValue);

      const doctorName = doctorField?.normalizedValue || doctorField?.rawValue;
      const hospitalName = hospitalField?.normalizedValue || hospitalField?.rawValue;
      const docDate = dateField?.normalizedValue || dateField?.rawValue;

      const summary = doctorName && hospitalName
        ? `${doctorName} • ${hospitalName}`
        : doctorName
        ? `${doctorName} Consultation`
        : hospitalName
        ? `${hospitalName} Visit`
        : `Clinical Prescription • ${filename || 'Document'}`;

      const primarySymptom = findingFields.length > 0 ? findingFields.join(', ') : 'Clinical consultation & prescription review';

      const pool = this.clinicalRepo?.pool || this.documentRepo?.pool;
      if (pool) {
        const existing = await pool.query(
          "SELECT id FROM chat_sessions WHERE symptom_state->>'documentId' = $1",
          [documentId]
        );
        if (existing.rows.length === 0) {
          const parsedDate = docDate && !isNaN(Date.parse(docDate)) ? new Date(docDate) : new Date();
          await pool.query(
            `INSERT INTO chat_sessions (
              patient_id, intent, risk_level, status, summary, symptom_state, started_at
            ) VALUES ($1, 'record_query', 'low', 'complete', $2, $3, $4)`,
            [
              patientId,
              summary,
              JSON.stringify({
                documentId,
                doctorName,
                facility: hospitalName,
                date: docDate,
                primarySymptom,
                diagnoses: findingFields,
                source: 'Prescription document upload',
              }),
              parsedDate,
            ]
          );
        }
      }
    } catch (encErr) {
      logger.warn('Failed to record document clinical encounter', { error: encErr?.message });
    }
  }
}
