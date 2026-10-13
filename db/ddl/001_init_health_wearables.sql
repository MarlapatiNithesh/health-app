BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS members (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone                 TEXT UNIQUE NOT NULL,
    phone_e164            TEXT,
    phone_verified        BOOLEAN NOT NULL DEFAULT false,
    phone_verified_at     TIMESTAMPTZ,
    status                TEXT NOT NULL DEFAULT 'pending_verification'
                            CHECK (status IN ('pending_verification','active','suspended',
                                              'deletion_requested','deleted')),
    deletion_reason       TEXT,
    deletion_at           TIMESTAMPTZ,
    full_name             TEXT CHECK (char_length(full_name) <= 200),
    dob                   DATE CHECK (dob <= CURRENT_DATE),
    gender                TEXT,
    height_cm             NUMERIC(5,2) CHECK (height_cm BETWEEN 50 AND 300),
    weight_kg             NUMERIC(5,2) CHECK (weight_kg BETWEEN 1 AND 500),
    insurance_tier        TEXT NOT NULL DEFAULT 'bronze'
                            CHECK (insurance_tier IN ('bronze','silver','gold','platinum','standard')),
    wellness_score        NUMERIC(5,2) DEFAULT 0 CHECK (wellness_score BETWEEN 0 AND 100),
    wellness_updated_at   TIMESTAMPTZ,
    ow_user_id            TEXT,
    timezone              TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    health_consent_at     TIMESTAMPTZ,
    health_consent_version TEXT,
    last_login_at         TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_members_phone_e164 ON members (phone_e164)
  WHERE phone_e164 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_members_status ON members (status)
  WHERE status IN ('active','pending_verification');
CREATE UNIQUE INDEX IF NOT EXISTS uq_members_ow_user_id ON members (ow_user_id)
  WHERE ow_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS member_biometric_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  height_cm       NUMERIC(5,2),
  weight_kg       NUMERIC(5,2),
  weight_trend    TEXT CHECK (weight_trend IN ('gain','loss','unchanged','initial')),
  changed_fields  TEXT[] NOT NULL DEFAULT '{}',
  change_source   TEXT NOT NULL DEFAULT 'profile_update'
                    CHECK (change_source IN ('profile_update','wearable_sync','initial','manual')),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mbh_member ON member_biometric_history (member_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS wearable_links (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,
  connection_type  TEXT NOT NULL DEFAULT 'oauth'
                     CHECK (connection_type IN ('oauth','phone_sdk','manual')),
  status           TEXT NOT NULL DEFAULT 'disconnected'
                     CHECK (status IN ('disconnected','connecting','connected','syncing',
                                       'token_expired','error')),
  model            TEXT,
  battery_pct      SMALLINT CHECK (battery_pct BETWEEN 0 AND 100),
  metrics_provided TEXT[] NOT NULL DEFAULT '{}',
  metadata         JSONB NOT NULL DEFAULT '{}',
  sync_cursor      TEXT,
  connected_at     TIMESTAMPTZ,
  disconnected_at  TIMESTAMPTZ,
  last_sync_at     TIMESTAMPTZ,
  last_data_at     TIMESTAMPTZ,
  error_detail     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_wearable UNIQUE (member_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_wearable_member ON wearable_links (member_id);
CREATE INDEX IF NOT EXISTS idx_wearable_status ON wearable_links (member_id, status)
  WHERE status IN ('connected','syncing');

CREATE TABLE IF NOT EXISTS timeseries (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id        UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    provider         TEXT NOT NULL,
    device_key       TEXT NOT NULL DEFAULT '',
    source_record_id TEXT,
    metric_type      TEXT NOT NULL,
    aggregation      TEXT NOT NULL DEFAULT 'instant'
                       CHECK (aggregation IN ('instant','interval','daily_total')),
    recorded_at      TIMESTAMPTZ NOT NULL,
    ended_at         TIMESTAMPTZ,
    local_date       DATE,
    value            DOUBLE PRECISION NOT NULL,
    unit             TEXT NOT NULL,
    quality_flag     TEXT CHECK (quality_flag IN ('good','suspect','poor')),
    metadata         JSONB NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_timeseries_times CHECK (ended_at IS NULL OR ended_at >= recorded_at),
    CONSTRAINT uq_timeseries UNIQUE (member_id, provider, device_key, metric_type, aggregation, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_timeseries_member_metric ON timeseries
  (member_id, metric_type, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeseries_member_day ON timeseries
  (member_id, local_date, metric_type);
CREATE INDEX IF NOT EXISTS idx_timeseries_provider ON timeseries
  (member_id, provider, recorded_at DESC);

CREATE OR REPLACE FUNCTION timeseries_fill_local_date() RETURNS trigger AS $$
DECLARE tz TEXT;
BEGIN
  IF NEW.local_date IS NULL THEN
    SELECT timezone INTO tz FROM members WHERE id = NEW.member_id;
    BEGIN
      NEW.local_date := (NEW.recorded_at AT TIME ZONE COALESCE(NULLIF(tz, ''), 'UTC'))::date;
    EXCEPTION WHEN OTHERS THEN
      NEW.local_date := (NEW.recorded_at AT TIME ZONE 'UTC')::date;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_timeseries_local_date ON timeseries;
CREATE TRIGGER trg_timeseries_local_date
  BEFORE INSERT OR UPDATE ON timeseries
  FOR EACH ROW EXECUTE FUNCTION timeseries_fill_local_date();

CREATE TABLE IF NOT EXISTS workouts (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id            UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    provider             TEXT NOT NULL,
    source_record_id     TEXT NOT NULL,
    activity_type        TEXT NOT NULL,
    label                TEXT,
    started_at           TIMESTAMPTZ NOT NULL,
    ended_at             TIMESTAMPTZ,
    duration_secs        INT CHECK (duration_secs >= 0),
    moving_time_secs     INT CHECK (moving_time_secs >= 0),
    distance_m           NUMERIC(10,2) CHECK (distance_m >= 0),
    steps_count          INT CHECK (steps_count >= 0),
    energy_burned_kcal   NUMERIC(8,2) CHECK (energy_burned_kcal >= 0),
    heart_rate_avg       INT,
    heart_rate_max       INT,
    heart_rate_min       INT,
    average_speed        NUMERIC(8,3),
    max_speed            NUMERIC(8,3),
    average_cadence      INT,
    average_watts        NUMERIC(8,2),
    max_watts            NUMERIC(8,2),
    total_elevation_gain NUMERIC(8,2),
    elev_high            NUMERIC(8,2),
    elev_low             NUMERIC(8,2),
    intensity            TEXT,
    entry_source         TEXT,
    hr_zones             JSONB NOT NULL DEFAULT '{}',
    power_zones          JSONB NOT NULL DEFAULT '{}',
    segments             JSONB NOT NULL DEFAULT '[]',
    metadata             JSONB NOT NULL DEFAULT '{}',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_workout_times CHECK (ended_at IS NULL OR ended_at >= started_at),
    CONSTRAINT uq_workouts_source UNIQUE (member_id, provider, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_workouts_member ON workouts (member_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workouts_type ON workouts (member_id, activity_type, started_at DESC);

CREATE TABLE IF NOT EXISTS sleep_sessions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id                   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    provider                    TEXT NOT NULL,
    source_record_id            TEXT NOT NULL,
    started_at                  TIMESTAMPTZ NOT NULL,
    ended_at                    TIMESTAMPTZ NOT NULL,
    sleep_total_duration_mins   INT CHECK (sleep_total_duration_mins >= 0),
    sleep_time_in_bed_minutes   INT CHECK (sleep_time_in_bed_minutes >= 0),
    sleep_rem_minutes           INT CHECK (sleep_rem_minutes >= 0),
    sleep_deep_minutes          INT CHECK (sleep_deep_minutes >= 0),
    sleep_light_minutes         INT CHECK (sleep_light_minutes >= 0),
    sleep_awake_minutes         INT CHECK (sleep_awake_minutes >= 0),
    sleep_efficiency_score      NUMERIC(5,2) CHECK (sleep_efficiency_score BETWEEN 0 AND 100),
    is_nap                      BOOLEAN NOT NULL DEFAULT false,
    sleep_stages                JSONB NOT NULL DEFAULT '[]',
    metadata                    JSONB NOT NULL DEFAULT '{}',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_sleep_times CHECK (ended_at > started_at),
    CONSTRAINT uq_sleep_source UNIQUE (member_id, provider, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_sleep_member ON sleep_sessions (member_id, started_at DESC);

CREATE TABLE IF NOT EXISTS womens_health (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id                   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    provider                    TEXT NOT NULL,
    source_record_id            TEXT NOT NULL,
    current_phase               TEXT,
    current_phase_type          TEXT,
    cycle_length                INT CHECK (cycle_length > 0),
    day_in_cycle                INT CHECK (day_in_cycle > 0),
    period_length               INT CHECK (period_length > 0),
    days_until_next_phase       INT,
    length_of_current_phase     INT,
    predicted_cycle_length      INT,
    is_predicted_cycle          BOOLEAN NOT NULL DEFAULT false,
    has_specified_cycle_length  BOOLEAN NOT NULL DEFAULT false,
    has_specified_period_length BOOLEAN NOT NULL DEFAULT false,
    fertile_window_start        DATE,
    length_of_fertile_window    INT,
    last_updated_at             TIMESTAMPTZ,
    pregnancy_snapshot          JSONB NOT NULL DEFAULT '{}',
    metadata                    JSONB NOT NULL DEFAULT '{}',
    recorded_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_womens_health_source UNIQUE (member_id, provider, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_womens_health_member ON womens_health (member_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS health_scores (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    provider       TEXT NOT NULL,
    source_record_id TEXT,
    score_type     TEXT NOT NULL CHECK (score_type IN
                     ('readiness','recovery','sleep','activity','stress',
                      'strain','body_battery','overall')),
    score          NUMERIC(5,2) CHECK (score BETWEEN 0 AND 100),
    qualifier      TEXT,
    components     JSONB NOT NULL DEFAULT '{}',
    trend          TEXT CHECK (trend IN ('up','stable','down')),
    calculated_at  TIMESTAMPTZ NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_health_scores UNIQUE (member_id, provider, score_type, calculated_at)
);

CREATE INDEX IF NOT EXISTS idx_health_scores_type ON health_scores
  (member_id, score_type, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_scores_latest ON health_scores
  (member_id, score_type, calculated_at DESC)
  INCLUDE (score, qualifier, trend);

CREATE TABLE IF NOT EXISTS sync_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id       UUID REFERENCES members(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,
    data_type       TEXT NOT NULL CHECK (data_type IN
                      ('timeseries','workout','sleep','womens_health',
                       'health_scores','connection','other')),
    source          TEXT CHECK (source IN ('webhook','phone','poll','manual')),
    event_type      TEXT,
    idempotency_key TEXT,
    batch_id        UUID,
    records_read    INT NOT NULL DEFAULT 0,
    records_saved   INT NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
                      ('pending','success','partial','failed','dead')),
    error_message   TEXT,
    duration_ms     INT,
    response        JSONB,
    raw_payload     JSONB,
    retry_count     INT NOT NULL DEFAULT 0,
    next_retry_at   TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_sync_idempotency UNIQUE (member_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_member ON sync_logs (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs (status, next_retry_at)
  WHERE status IN ('pending','failed');
CREATE UNIQUE INDEX IF NOT EXISTS uq_sync_webhook_msg ON sync_logs (idempotency_key)
  WHERE source = 'webhook';

CREATE TABLE IF NOT EXISTS metric_reference (
  metric_type    TEXT PRIMARY KEY,
  category       TEXT NOT NULL,
  canonical_unit TEXT NOT NULL,
  accepted_units TEXT[] NOT NULL DEFAULT '{}',
  min_value      DOUBLE PRECISION,
  max_value      DOUBLE PRECISION,
  description    TEXT NOT NULL
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['members','wearable_links','workouts','sleep_sessions',
                            'womens_health','health_scores','sync_logs'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

COMMIT;