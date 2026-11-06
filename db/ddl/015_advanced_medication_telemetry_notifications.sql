-- Migration 015: Advanced Medication Chronotherapy, OCR Verification, Telemetry Anomaly & Metabolic Pacing

BEGIN;

CREATE TABLE IF NOT EXISTS medication_schedules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  medication_name   TEXT NOT NULL,
  dosage            TEXT NOT NULL,
  form              TEXT DEFAULT 'tablet',
  frequency         TEXT NOT NULL, -- 'once_daily', 'twice_daily', 'thrice_daily', 'four_times_daily', 'as_needed'
  scheduled_times   TIME[] NOT NULL, -- e.g. ['08:00:00', '20:00:00']
  with_food         BOOLEAN DEFAULT false,
  empty_stomach     BOOLEAN DEFAULT false,
  source            TEXT NOT NULL DEFAULT 'prescribed' CHECK (source IN ('prescribed', 'manual_entry', 'ocr_extracted')),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_schedules_patient ON medication_schedules (patient_id, is_active);

CREATE TABLE IF NOT EXISTS medication_intake_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id        UUID REFERENCES medication_schedules(id) ON DELETE SET NULL,
  patient_id         UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  medication_name    TEXT NOT NULL,
  dose_taken         TEXT NOT NULL,
  scheduled_time     TIMESTAMPTZ NOT NULL,
  taken_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  status             TEXT NOT NULL CHECK (status IN ('taken', 'skipped', 'late', 'escalated', 'pending')),
  escalation_count   INT DEFAULT 0,
  ocr_verified       BOOLEAN DEFAULT false,
  ocr_confidence     NUMERIC(5,2),
  ocr_extracted_text TEXT,
  ocr_image_url      TEXT,
  mismatch_warning   TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_intake_patient_sched ON medication_intake_logs (patient_id, scheduled_time DESC);

CREATE TABLE IF NOT EXISTS telemetry_anomaly_events (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id                 UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  metric_type                TEXT NOT NULL, -- 'glucose', 'bp', 'heart_rate', 'spo2', 'hydration'
  metric_value               NUMERIC NOT NULL,
  metric_unit                TEXT NOT NULL,
  severity                   TEXT NOT NULL CHECK (severity IN ('moderate', 'high', 'critical')),
  llm_triage_assessment      JSONB NOT NULL DEFAULT '{}',
  action_protocol_dispatched TEXT NOT NULL,
  notification_id            UUID REFERENCES notifications(id) ON DELETE SET NULL,
  resolved_at                TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_anomaly_patient ON telemetry_anomaly_events (patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS daily_metabolic_logs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id              UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  log_date                DATE NOT NULL,
  bmr_kcal                INT NOT NULL,
  active_burn_kcal        INT DEFAULT 0,
  total_tdee_kcal         INT NOT NULL,
  calories_consumed_kcal  INT DEFAULT 0,
  target_active_burn_kcal INT DEFAULT 500,
  remaining_burn_kcal     INT,
  water_intake_ml         INT DEFAULT 0,
  hydration_target_ml     INT DEFAULT 2500,
  meals_logged            JSONB DEFAULT '[]',
  anomalies_occurred      BOOLEAN DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_patient_daily_metabolic UNIQUE (patient_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_metabolic_patient_date ON daily_metabolic_logs (patient_id, log_date DESC);

COMMIT;
