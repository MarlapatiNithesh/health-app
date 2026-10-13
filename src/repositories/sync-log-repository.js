export class SyncLogRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async claimWebhookEvent({ memberId, provider, dataType, eventType, idempotencyKey, rawPayload }, client = this.pool) {
    const sql = `
      INSERT INTO sync_logs (
        member_id, provider, data_type, source, event_type,
        idempotency_key, raw_payload, status, next_retry_at
      )
      VALUES ($1, $2, $3, 'webhook', $4, $5, $6, 'pending', now() + interval '5 minutes')
      ON CONFLICT (idempotency_key) WHERE source = 'webhook'
      DO UPDATE SET
        retry_count = sync_logs.retry_count + 1,
        status = 'pending',
        next_retry_at = now() + interval '5 minutes',
        updated_at = now()
      WHERE sync_logs.status IN ('failed', 'pending')
        AND sync_logs.updated_at < now() - interval '2 minutes'
      RETURNING id, retry_count`;

    const result = await client.query(sql, [
      memberId || null,
      provider,
      dataType || 'other',
      eventType,
      idempotencyKey,
      rawPayload ? JSON.stringify(rawPayload) : null,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return {
      id: result.rows[0].id,
      retryCount: result.rows[0].retry_count || 0,
    };
  }

  async completeWebhookEvent(id, {
    status = 'success',
    recordsSaved = 0,
    recordsRead = 0,
    errorMessage = null,
    durationMs = 0,
    response = null,
  } = {}, client = this.pool) {
    const sql = `
      UPDATE sync_logs
      SET status = $1,
          records_saved = $2,
          records_read = $3,
          error_message = $4,
          duration_ms = $5,
          response = $6,
          completed_at = now(),
          updated_at = now()
      WHERE id = $7
      RETURNING id`;

    const result = await client.query(sql, [
      status,
      recordsSaved,
      recordsRead,
      errorMessage,
      durationMs,
      response ? JSON.stringify(response) : null,
      id,
    ]);
    return result.rows[0] ?? null;
  }

  async failWebhookEvent(id, {
    errorMessage,
    durationMs = 0,
    retryCount = 0,
  }, client = this.pool) {
    const nextRetrySeconds = Math.min(3600, Math.pow(2, retryCount) * 60);
    const status = retryCount >= 8 ? 'dead' : 'failed';

    const sql = `
      UPDATE sync_logs
      SET status = $1,
          retry_count = retry_count + 1,
          next_retry_at = now() + ($2 || ' seconds')::interval,
          error_message = $3,
          duration_ms = $4,
          updated_at = now()
      WHERE id = $5
      RETURNING id, status, retry_count`;

    const result = await client.query(sql, [
      status,
      String(nextRetrySeconds),
      errorMessage,
      durationMs,
      id,
    ]);
    return result.rows[0] ?? null;
  }

  async getRetryableWebhookLogs(limit = 50, client = this.pool) {
    const sql = `
      SELECT id, member_id, provider, data_type, event_type, idempotency_key, raw_payload, retry_count
      FROM sync_logs
      WHERE status IN ('pending', 'failed')
        AND next_retry_at <= now()
        AND retry_count < 8
        AND source = 'webhook'
      ORDER BY next_retry_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED`;

    const result = await client.query(sql, [limit]);
    return result.rows;
  }

  async purgeOldSyncPayloads(retentionDays = 30, client = this.pool) {
    const sql = `
      UPDATE sync_logs
      SET raw_payload = NULL,
          updated_at = now()
      WHERE created_at < now() - ($1 || ' days')::interval
        AND raw_payload IS NOT NULL`;

    const result = await client.query(sql, [String(retentionDays)]);
    return result.rowCount;
  }
}
