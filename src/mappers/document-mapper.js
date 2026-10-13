export class DocumentMapper {
  static toDto(row) {
    if (!row) return null;
    return {
      id: row.id,
      patientId: row.patientId || row.patient_id,
      documentFamilyId: row.documentFamilyId || row.document_family_id || null,
      versionNumber: Number(row.versionNumber || row.version_number || 1),
      docType: row.docType || row.doc_type,
      originalFilename: row.originalFilename || row.original_filename,
      storageKey: row.storageKey || row.storage_key || null,
      mimeType: row.mimeType || row.mime_type,
      sizeBytes: Number(row.sizeBytes || row.size_bytes || 0),
      compressedSizeBytes: row.compressedSizeBytes ? Number(row.compressedSizeBytes) : null,
      compression: row.compression || 'gzip',
      sha256: row.sha256,
      visualHash: row.visualHash || row.visual_hash || null,
      contentTextHash: row.contentTextHash || row.content_text_hash || null,
      contentFingerprint: row.contentFingerprint || row.content_fingerprint || null,
      revisionOf: row.revisionOf || row.revision_of || null,
      changeClassification: row.changeClassification || row.change_classification || 'ORIGINAL',
      diffSummary: typeof row.diffSummary === 'string'
        ? JSON.parse(row.diffSummary)
        : (row.diffSummary || row.diff_summary || {}),
      summary: row.summary || null,
      isDuplicate: Boolean(row.isDuplicate),
      duplicateAction: row.duplicateAction || null,
      extractionStatus: row.extractionStatus || row.extraction_status,
      ocrEngine: row.ocrEngine || row.ocr_engine || null,
      nerModel: row.nerModel || row.ner_model || null,
      errorCode: row.errorCode || row.error_code || null,
      processedAt: row.processedAt || row.processed_at || null,
      uploadedAt: row.uploadedAt || row.uploaded_at || row.created_at,
      createdAt: row.createdAt || row.created_at,
      extractions: Array.isArray(row.extractions)
        ? row.extractions.map(DocumentMapper.toExtractionDto)
        : [],
    };
  }

  static toExtractionDto(row) {
    if (!row) return null;
    return {
      id: row.id,
      documentId: row.documentId || row.document_id,
      patientId: row.patientId || row.patient_id,
      fieldName: row.fieldName || row.field_name,
      rawValue: row.rawValue || row.raw_value,
      normalizedValue: row.normalizedValue || row.normalized_value || null,
      rxnormCode: row.rxnormCode || row.rxnorm_code || null,
      loincCode: row.loincCode || row.loinc_code || null,
      icdCode: row.icdCode || row.icd_code || null,
      confidence: Number(row.confidence),
      pageNumber: Number(row.pageNumber || row.page_number || 1),
      section: row.section || null,
      status: row.status,
      confirmedAt: row.confirmedAt || row.confirmed_at || null,
      createdAt: row.createdAt || row.created_at,
    };
  }
}
