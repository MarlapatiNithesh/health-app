export class ClinicalRecordMapper {
  static toDto(row) {
    if (!row) return null;
    return {
      id: row.id,
      patientId: row.patientId || row.patient_id,
      recordType: row.recordType || row.record_type,
      name: row.name,
      code: row.code || null,
      codeSystem: row.codeSystem || row.code_system || null,
      status: row.status || 'active',
      severity: row.severity || null,
      valueNum: row.valueNum ?? row.value_num ?? null,
      valueText: row.valueText || row.value_text || null,
      unit: row.unit || null,
      refLow: row.refLow ?? row.ref_low ?? null,
      refHigh: row.refHigh ?? row.ref_high ?? null,
      interpretation: row.interpretation || null,
      dose: row.dose || null,
      frequency: row.frequency || null,
      route: row.route || null,
      startAt: row.startAt || row.start_at,
      endAt: row.endAt || row.end_at || null,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {}),
      source: row.source || 'manual',
      confidence: row.confidence ?? 1.0,
      verificationStatus: row.verificationStatus || row.verification_status || 'patient_confirmed',
      verifiedAt: row.verifiedAt || row.verified_at || null,
      createdAt: row.createdAt || row.created_at,
    };
  }

  static toDtoList(rows = []) {
    return rows.map((r) => ClinicalRecordMapper.toDto(r));
  }

  static toDomain(dto = {}) {
    return {
      recordType: dto.recordType,
      name: dto.name,
      codeSystem: dto.codeSystem ?? null,
      code: dto.code ?? null,
      status: dto.status ?? 'active',
      severity: dto.severity ?? null,
      valueNum: dto.valueNum ?? null,
      valueText: dto.valueText ?? null,
      unit: dto.unit ?? null,
      refLow: dto.refLow ?? null,
      refHigh: dto.refHigh ?? null,
      interpretation: dto.interpretation ?? null,
      dose: dto.dose ?? null,
      frequency: dto.frequency ?? null,
      route: dto.route ?? null,
      startAt: dto.startAt ?? new Date(),
      endAt: dto.endAt ?? null,
      details: dto.details ?? {},
      source: dto.source ?? 'manual',
      documentId: dto.documentId ?? null,
      provenanceId: dto.provenanceId ?? null,
      confidence: dto.confidence ?? 1.0,
      verificationStatus: dto.verificationStatus ?? 'patient_confirmed',
    };
  }
}
