export class HealthEventMapper {
  static toDto(row) {
    if (!row) return null;
    return {
      id: row.id,
      patientId: row.patientId || row.patient_id,
      sessionId: row.sessionId || row.session_id || null,
      eventType: row.eventType || row.event_type,
      eventTime: row.eventTime || row.event_time,
      summary: row.summary,
      structuredData: typeof row.structuredData === 'string'
        ? JSON.parse(row.structuredData)
        : (row.structuredData || row.structured_data || {}),
      provenanceId: row.provenanceId || row.provenance_id || null,
      createdAt: row.createdAt || row.created_at,
    };
  }

  static toTimelineDto(row) {
    if (!row) return null;
    return {
      patientId: row.patientId || row.patient_id,
      eventTime: row.eventTime || row.event_time,
      eventType: row.eventType || row.event_type,
      summary: row.summary,
      refId: row.refId || row.ref_id || null,
    };
  }
}
