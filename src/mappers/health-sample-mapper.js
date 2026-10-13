export class HealthSampleMapper {
  static toSyncResponseDto({ accepted = 0, duplicates = 0, received = 0, noData = false, syncedAt = null } = {}) {
    return {
      accepted,
      duplicates,
      received,
      noData,
      syncedAt: syncedAt || new Date().toISOString(),
    };
  }

  static toPhoneConnectionDto(conn) {
    if (!conn) return null;
    return {
      id: conn.id,
      userId: conn.userId || conn.memberId || conn.member_id,
      memberId: conn.memberId || conn.userId || conn.member_id,
      provider: conn.provider,
      status: conn.status,
      deviceId: conn.deviceId ?? null,
      hardwareId: conn.hardwareId ?? null,
      platform: conn.platform ?? null,
      permissions: Array.isArray(conn.permissions) ? conn.permissions : [],
      syncCursor: conn.syncCursor ?? null,
      lastSyncAt: conn.lastSyncAt || conn.last_sync_at || null,
      createdAt: conn.createdAt || conn.created_at,
      updatedAt: conn.updatedAt || conn.updated_at,
    };
  }

  static toDailySummaryDto(reconciled) {
    return reconciled;
  }
}
