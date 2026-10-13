export class PatientMapper {
  static toDto(row) {
    if (!row) return null;
    return {
      id: row.id,
      fullName: row.fullName || row.full_name || null,
      dob: row.dob ? new Date(row.dob).toISOString().split('T')[0] : null,
      gender: row.gender || null,
      phone: row.phone || row.phone_e164 || null,
      abhaId: row.abhaId || row.abha_id || null,
      mrn: row.mrn || null,
      bloodGroup: row.bloodGroup || row.blood_group || null,
      preferredLanguage: row.preferredLanguage || row.preferred_language || 'en-IN',
      emergencyContact: typeof row.emergencyContact === 'string'
        ? JSON.parse(row.emergencyContact)
        : (row.emergencyContact || row.emergency_contact || {}),
      preferences: typeof row.preferences === 'string'
        ? JSON.parse(row.preferences)
        : (row.preferences || {}),
      lifestyle: typeof row.lifestyle === 'string'
        ? JSON.parse(row.lifestyle)
        : (row.lifestyle || {}),
      goals: typeof row.goals === 'string'
        ? JSON.parse(row.goals)
        : (row.goals || []),
      notificationChannels: typeof row.notificationChannels === 'string'
        ? JSON.parse(row.notificationChannels)
        : (row.notificationChannels || ['push']),
      unitsSystem: row.unitsSystem || row.units_system || 'metric',
      privacyLevel: row.privacyLevel || row.privacy_level || 'standard',
      createdAt: row.createdAt || row.created_at || null,
      updatedAt: row.updatedAt || row.updated_at || null,
    };
  }

  static toSummaryDto(row) {
    if (!row) return null;
    return {
      id: row.id,
      fullName: row.fullName || row.full_name || null,
      gender: row.gender || null,
      bloodGroup: row.bloodGroup || row.blood_group || null,
      phone: row.phone || row.phone_e164 || null,
    };
  }

  static toDomain(dto = {}) {
    return {
      abhaId: dto.abhaId ?? null,
      mrn: dto.mrn ?? null,
      sexAtBirth: dto.sexAtBirth ?? dto.gender ?? null,
      bloodGroup: dto.bloodGroup ?? null,
      preferredLanguage: dto.preferredLanguage ?? 'en-IN',
      emergencyContact: dto.emergencyContact ?? {},
      preferences: dto.preferences ?? {},
      lifestyle: dto.lifestyle ?? {},
      goals: dto.goals ?? [],
    };
  }
}
