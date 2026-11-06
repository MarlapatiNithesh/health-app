import { logger } from '../logger.js';

export class MedicationRepository {
  constructor(pool) {
    this.pool = pool;
  }

  // ── 1. Medication Schedules ──────────────────────────────────────────────

  async createSchedule({
    patientId,
    medicationName,
    dosage,
    form = 'tablet',
    frequency = 'once_daily',
    scheduledTimes = ['08:00:00'],
    withFood = false,
    emptyStomach = false,
    source = 'manual_entry',
    isActive = true,
  }) {
    const { rows } = await this.pool.query(
      `INSERT INTO medication_schedules (
        patient_id, medication_name, dosage, form, frequency,
        scheduled_times, with_food, empty_stomach, source, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        patientId,
        medicationName,
        dosage,
        form,
        frequency,
        scheduledTimes,
        withFood,
        emptyStomach,
        source,
        isActive,
      ]
    );
    return rows[0];
  }

  async getActiveSchedules(patientId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM medication_schedules
       WHERE patient_id = $1 AND is_active = true
       ORDER BY medication_name ASC`,
      [patientId]
    );
    return rows;
  }

  async findScheduleById(scheduleId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM medication_schedules WHERE id = $1`,
      [scheduleId]
    );
    return rows[0] || null;
  }

  async deactivateSchedule(scheduleId) {
    const { rows } = await this.pool.query(
      `UPDATE medication_schedules
       SET is_active = false, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [scheduleId]
    );
    return rows[0] || null;
  }

  // ── 2. Medication Intake Logs ─────────────────────────────────────────────

  async createIntakeLog({
    scheduleId = null,
    patientId,
    medicationName,
    doseTaken,
    scheduledTime,
    takenAt = new Date(),
    status = 'taken',
    escalationCount = 0,
    ocrVerified = false,
    ocrConfidence = null,
    ocrExtractedText = null,
    ocrImageUrl = null,
    mismatchWarning = null,
  }) {
    const { rows } = await this.pool.query(
      `INSERT INTO medication_intake_logs (
        schedule_id, patient_id, medication_name, dose_taken, scheduled_time,
        taken_at, status, escalation_count, ocr_verified, ocr_confidence,
        ocr_extracted_text, ocr_image_url, mismatch_warning
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        scheduleId,
        patientId,
        medicationName,
        doseTaken,
        scheduledTime,
        takenAt,
        status,
        escalationCount,
        ocrVerified,
        ocrConfidence,
        ocrExtractedText,
        ocrImageUrl,
        mismatchWarning,
      ]
    );
    return rows[0];
  }

  async updateIntakeLog(id, updates) {
    const fields = [];
    const values = [id];
    let idx = 2;

    const allowed = [
      ['status', 'status'],
      ['takenAt', 'taken_at'],
      ['escalationCount', 'escalation_count'],
      ['ocrVerified', 'ocr_verified'],
      ['ocrConfidence', 'ocr_confidence'],
      ['ocrExtractedText', 'ocr_extracted_text'],
      ['ocrImageUrl', 'ocr_image_url'],
      ['mismatchWarning', 'mismatch_warning'],
    ];

    for (const [camel, snake] of allowed) {
      if (updates[camel] !== undefined) {
        fields.push(`${snake} = $${idx++}`);
        values.push(updates[camel]);
      }
    }

    if (fields.length === 0) return null;

    const query = `UPDATE medication_intake_logs SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
    const { rows } = await this.pool.query(query, values);
    return rows[0] || null;
  }

  async getRecentIntakeLogs(patientId, limit = 20) {
    const { rows } = await this.pool.query(
      `SELECT * FROM medication_intake_logs
       WHERE patient_id = $1
       ORDER BY scheduled_time DESC
       LIMIT $2`,
      [patientId, limit]
    );
    return rows;
  }

  async findPendingIntake(patientId, scheduleId, targetDateStr) {
    const { rows } = await this.pool.query(
      `SELECT * FROM medication_intake_logs
       WHERE patient_id = $1 AND schedule_id = $2
         AND scheduled_time::date = $3::date
       ORDER BY scheduled_time DESC
       LIMIT 1`,
      [patientId, scheduleId, targetDateStr]
    );
    return rows[0] || null;
  }

  // ── 3. Telemetry Anomaly Events ──────────────────────────────────────────

  async recordTelemetryAnomaly({
    patientId,
    metricType,
    metricValue,
    metricUnit,
    severity,
    llmTriageAssessment = {},
    actionProtocolDispatched,
    notificationId = null,
  }) {
    const { rows } = await this.pool.query(
      `INSERT INTO telemetry_anomaly_events (
        patient_id, metric_type, metric_value, metric_unit, severity,
        llm_triage_assessment, action_protocol_dispatched, notification_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        patientId,
        metricType,
        metricValue,
        metricUnit,
        severity,
        JSON.stringify(llmTriageAssessment),
        actionProtocolDispatched,
        notificationId,
      ]
    );
    return rows[0];
  }

  async getTodayAnomalies(patientId, dateStr = new Date().toISOString().slice(0, 10)) {
    const { rows } = await this.pool.query(
      `SELECT * FROM telemetry_anomaly_events
       WHERE patient_id = $1 AND created_at::date = $2::date
       ORDER BY created_at DESC`,
      [patientId, dateStr]
    );
    return rows;
  }

  // ── 4. Daily Metabolic Logs ──────────────────────────────────────────────

  async upsertMetabolicLog({
    patientId,
    logDate,
    bmrKcal,
    activeBurnKcal = 0,
    totalTdeeKcal,
    caloriesConsumedKcal = 0,
    targetActiveBurnKcal = 500,
    remainingBurnKcal = null,
    waterIntakeMl = 0,
    hydrationTargetMl = 2500,
    mealsLogged = [],
    anomaliesOccurred = false,
  }) {
    const { rows } = await this.pool.query(
      `INSERT INTO daily_metabolic_logs (
        patient_id, log_date, bmr_kcal, active_burn_kcal, total_tdee_kcal,
        calories_consumed_kcal, target_active_burn_kcal, remaining_burn_kcal,
        water_intake_ml, hydration_target_ml, meals_logged, anomalies_occurred, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
      ON CONFLICT (patient_id, log_date) DO UPDATE SET
        bmr_kcal = EXCLUDED.bmr_kcal,
        active_burn_kcal = EXCLUDED.active_burn_kcal,
        total_tdee_kcal = EXCLUDED.total_tdee_kcal,
        calories_consumed_kcal = EXCLUDED.calories_consumed_kcal,
        target_active_burn_kcal = EXCLUDED.target_active_burn_kcal,
        remaining_burn_kcal = EXCLUDED.remaining_burn_kcal,
        water_intake_ml = EXCLUDED.water_intake_ml,
        hydration_target_ml = EXCLUDED.hydration_target_ml,
        meals_logged = EXCLUDED.meals_logged,
        anomalies_occurred = EXCLUDED.anomalies_occurred,
        updated_at = now()
      RETURNING *`,
      [
        patientId,
        logDate,
        bmrKcal,
        activeBurnKcal,
        totalTdeeKcal,
        caloriesConsumedKcal,
        targetActiveBurnKcal,
        remainingBurnKcal,
        waterIntakeMl,
        hydrationTargetMl,
        JSON.stringify(mealsLogged),
        anomaliesOccurred,
      ]
    );
    return rows[0];
  }

  async getMetabolicLog(patientId, logDate) {
    const { rows } = await this.pool.query(
      `SELECT * FROM daily_metabolic_logs
       WHERE patient_id = $1 AND log_date = $2`,
      [patientId, logDate]
    );
    return rows[0] || null;
  }
}
