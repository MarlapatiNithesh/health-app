BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE OR REPLACE FUNCTION block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION current_member_id() RETURNS uuid AS $$
  SELECT nullif(current_setting('app.member_id', true), '')::uuid
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS patients (
  id                    UUID PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  abha_id               TEXT,
  mrn                   TEXT,
  sex_at_birth          TEXT CHECK (sex_at_birth IN ('male','female','intersex','unknown')),
  ethnicity_code        TEXT,
  blood_group           TEXT CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  preferred_language    TEXT NOT NULL DEFAULT 'en-IN',
  notification_channels JSONB NOT NULL DEFAULT '["push"]'
                          CHECK (jsonb_typeof(notification_channels) = 'array'),
  units_system          TEXT NOT NULL DEFAULT 'metric'
                          CHECK (units_system IN ('metric','imperial')),
  privacy_level         TEXT NOT NULL DEFAULT 'standard'
                          CHECK (privacy_level IN ('minimal','standard','full')),
  emergency_contact     JSONB NOT NULL DEFAULT '{}'
                          CHECK (jsonb_typeof(emergency_contact) = 'object'),
  preferences           JSONB NOT NULL DEFAULT '{}'
                          CHECK (jsonb_typeof(preferences) = 'object'),
  lifestyle             JSONB NOT NULL DEFAULT '{}'
                          CHECK (jsonb_typeof(lifestyle) = 'object'),
  goals                 JSONB NOT NULL DEFAULT '[]'
                          CHECK (jsonb_typeof(goals) = 'array'),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_abha ON patients (abha_id) WHERE abha_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_mrn  ON patients (mrn) WHERE mrn IS NOT NULL;

CREATE OR REPLACE FUNCTION check_health_consent() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM members WHERE id = NEW.id AND health_consent_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'health_consent_at must be set on members before creating a patient record'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_patients_require_consent ON patients;
CREATE TRIGGER trg_patients_require_consent
  BEFORE INSERT ON patients FOR EACH ROW EXECUTE FUNCTION check_health_consent();

CREATE OR REPLACE FUNCTION get_or_create_patient(p_member_id UUID) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO patients (id) VALUES (p_member_id) ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_id FROM patients WHERE id = p_member_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS member_consents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  scope      TEXT NOT NULL CHECK (scope IN
               ('data_access','document_upload','wearable_sync','ai_processing')),
  granted    BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_member_consent_scope UNIQUE (member_id, scope),
  CONSTRAINT ck_consent_dates CHECK (
    revoked_at IS NULL OR granted_at IS NULL OR revoked_at >= granted_at
  )
);

CREATE TABLE IF NOT EXISTS provenance (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type      TEXT NOT NULL CHECK (source_type IN
                     ('document','manual_entry','wearable','lab_api','user_input','ai_proposed')),
  source_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
  document_id      UUID,
  page_number      INT CHECK (page_number > 0),
  extraction_model TEXT,
  model_version    TEXT,
  confidence       NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_provenance_immutable') THEN
    CREATE TRIGGER trg_provenance_immutable
      BEFORE UPDATE OR DELETE ON provenance
      FOR EACH ROW EXECUTE FUNCTION block_mutation();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS health_documents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  document_family_id    UUID DEFAULT gen_random_uuid(),
  version_number        INT NOT NULL DEFAULT 1,
  doc_type              TEXT NOT NULL CHECK (doc_type IN
                          ('prescription','lab_report','discharge_summary','imaging','other')),
  original_filename     TEXT NOT NULL,
  storage_key           TEXT NOT NULL,
  mime_type             TEXT NOT NULL CHECK (mime_type IN
                          ('application/pdf','image/png','image/jpeg','image/tiff','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/csv','application/rtf')),
  size_bytes            BIGINT NOT NULL CHECK (size_bytes > 0),
  compressed_size_bytes BIGINT,
  sha256                TEXT NOT NULL,
  visual_hash           TEXT,
  content_text_hash     TEXT,
  content_fingerprint   TEXT,
  revision_of           UUID REFERENCES health_documents(id) ON DELETE SET NULL,
  change_classification TEXT DEFAULT 'ORIGINAL' CHECK (change_classification IN
                          ('ORIGINAL','EXACT_DUPLICATE','VISUAL_CHANGE_ONLY','NEW_VERSION')),
  diff_summary          JSONB DEFAULT '{}',
  summary               TEXT,
  extraction_status     TEXT NOT NULL DEFAULT 'pending' CHECK (extraction_status IN
                          ('pending','processing','done','failed','review_needed')),
  ocr_engine            TEXT,
  ner_model             TEXT,
  error_code            TEXT,
  processed_at          TIMESTAMPTZ,
  uploaded_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  provenance_id         UUID REFERENCES provenance(id) ON DELETE SET NULL,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_document_hash UNIQUE (patient_id, sha256)
);

CREATE INDEX IF NOT EXISTS idx_documents_patient ON health_documents
  (patient_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_family ON health_documents
  (patient_id, document_family_id, version_number ASC);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON health_documents
  (patient_id, content_text_hash) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_visual_hash ON health_documents
  (patient_id, visual_hash) WHERE deleted_at IS NULL AND visual_hash IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_provenance_document') THEN
    ALTER TABLE provenance
      ADD CONSTRAINT fk_provenance_document
        FOREIGN KEY (document_id) REFERENCES health_documents(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_provenance_document ON provenance (document_id)
  WHERE document_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS extracted_fields (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID NOT NULL REFERENCES health_documents(id) ON DELETE CASCADE,
  patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  provenance_id    UUID REFERENCES provenance(id) ON DELETE SET NULL,
  field_name       TEXT NOT NULL CHECK (field_name IN (
                     'medication_name','dose','frequency','route',
                     'lab_test','lab_value','lab_unit','lab_reference',
                     'diagnosis','allergy','allergy_reaction','allergy_severity',
                     'doctor_name','hospital_name','date','clinical_finding','other'
                   )),
  raw_value        TEXT NOT NULL,
  normalized_value TEXT,
  rxnorm_code      TEXT,
  loinc_code       TEXT,
  icd_code         TEXT,
  confidence       NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  page_number      INT DEFAULT 1,
  section          TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
                     ('pending','confirmed','rejected','review_needed')),
  confirmed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_ef_confirmed CHECK (status <> 'confirmed' OR confirmed_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_ef_document ON extracted_fields (document_id);
CREATE INDEX IF NOT EXISTS idx_ef_patient  ON extracted_fields (patient_id, field_name);
CREATE INDEX IF NOT EXISTS idx_ef_pending  ON extracted_fields (document_id, status)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS clinical_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  record_type         TEXT NOT NULL CHECK (record_type IN
                        ('condition','allergy','medication','medication_event','lab_result',
                         'symptom','encounter','nutrition','observation','goal')),
  parent_id           UUID REFERENCES clinical_records(id) ON DELETE CASCADE,
  name                TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 300),
  code_system         TEXT CHECK (code_system IN ('icd10','rxnorm','loinc','snomed','other')),
  code                TEXT,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN
                        ('active','inactive','resolved','remission','discontinued','completed',
                         'on_hold','stopped','final','preliminary','amended','corrected',
                         'cancelled','entered_in_error','paused','achieved','abandoned')),
  severity            TEXT CHECK (severity IN
                        ('mild','moderate','severe','life_threatening','critical','unknown')),
  value_num           DOUBLE PRECISION,
  value_text          TEXT,
  unit                TEXT,
  ref_low             DOUBLE PRECISION,
  ref_high            DOUBLE PRECISION,
  interpretation      TEXT CHECK (interpretation IN
                        ('normal','low','high','critical_low','critical_high','abnormal','unknown')),
  dose                TEXT,
  frequency           TEXT,
  route               TEXT CHECK (route IN ('oral','sublingual','topical','iv','im','inhaled','other')),
  start_at            TIMESTAMPTZ NOT NULL,
  end_at              TIMESTAMPTZ,
  details             JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details) = 'object'),
  source              TEXT NOT NULL CHECK (source IN
                        ('manual','document','device','clinician','ai_proposed','import')),
  document_id         UUID REFERENCES health_documents(id) ON DELETE SET NULL,
  source_page         INT CHECK (source_page > 0),
  extraction_model    TEXT,
  confidence          NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
  provenance_id       UUID REFERENCES provenance(id) ON DELETE SET NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending_review' CHECK (verification_status IN
                        ('pending_review','needs_review','patient_confirmed',
                         'clinician_verified','rejected')),
  verified_at         TIMESTAMPTZ,
  dedupe_key          TEXT,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_cr_parent   CHECK ((record_type = 'medication_event') = (parent_id IS NOT NULL)),
  CONSTRAINT ck_cr_dates    CHECK (end_at IS NULL OR end_at >= start_at),
  CONSTRAINT ck_cr_lab      CHECK (record_type <> 'lab_result' OR value_num IS NOT NULL OR value_text IS NOT NULL),
  CONSTRAINT ck_cr_verified CHECK (verification_status NOT IN ('patient_confirmed','clinician_verified')
                                   OR verified_at IS NOT NULL),
  CONSTRAINT ck_cr_document CHECK (source <> 'document' OR document_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cr_dedupe ON clinical_records
  (patient_id, record_type, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cr_patient_type ON clinical_records
  (patient_id, record_type, start_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cr_active ON clinical_records
  (patient_id, record_type, status)
  WHERE deleted_at IS NULL AND status = 'active';

CREATE TABLE IF NOT EXISTS chat_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id         UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  intent             TEXT CHECK (intent IN ('symptom','medication_query','record_query','general')),
  status             TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN
                       ('in_progress','complete','high_risk','abandoned')),
  risk_level         TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
  flagged_for_review BOOLEAN NOT NULL DEFAULT false,
  symptom_state      JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(symptom_state) = 'object'),
  summary            TEXT,
  model_version      TEXT,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at           TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_chat_dates CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_chat_patient ON chat_sessions (patient_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_risk ON chat_sessions (patient_id, risk_level)
  WHERE flagged_for_review = true;

CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content    TEXT NOT NULL,
  meta       JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(meta) = 'object'),
  latency_ms INT CHECK (latency_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_msg_session ON chat_messages (session_id, created_at ASC);

CREATE TABLE IF NOT EXISTS tool_calls (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  tool_name  TEXT NOT NULL,
  arguments  JSONB NOT NULL DEFAULT '{}',
  result     JSONB,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','error')),
  latency_ms INT CHECK (latency_ms >= 0),
  error_msg  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_session ON tool_calls (session_id, created_at ASC);

CREATE TABLE IF NOT EXISTS model_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  model_name    TEXT NOT NULL,
  model_version TEXT,
  prompt_hash   TEXT,
  input_tokens  INT CHECK (input_tokens >= 0),
  output_tokens INT CHECK (output_tokens >= 0),
  latency_ms    INT CHECK (latency_ms >= 0),
  finish_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_runs_session ON model_runs (session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_model_runs_cost ON model_runs (model_name, created_at DESC)
  INCLUDE (input_tokens, output_tokens, latency_ms);

CREATE TABLE IF NOT EXISTS health_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  session_id      UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL CHECK (event_type IN (
                    'diagnosis','symptom','lab_result',
                    'medication_start','medication_stop',
                    'prescription','doctor_visit','surgery',
                    'hospitalization','vital','wearable_event',
                    'lifestyle_event','allergy','chat_summary'
                  )),
  event_time      TIMESTAMPTZ NOT NULL,
  summary         TEXT NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 500),
  structured_data JSONB NOT NULL DEFAULT '{}'
                    CHECK (jsonb_typeof(structured_data) = 'object'),
  provenance_id   UUID REFERENCES provenance(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_he_patient_time ON health_events (patient_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_he_type ON health_events (patient_id, event_type, event_time DESC);

CREATE TABLE IF NOT EXISTS clinical_embeddings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id         UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  document_id        UUID REFERENCES health_documents(id) ON DELETE CASCADE,
  clinical_record_id UUID REFERENCES clinical_records(id) ON DELETE CASCADE,
  health_event_id    UUID REFERENCES health_events(id) ON DELETE CASCADE,
  page_number        INT DEFAULT 1,
  section            TEXT,
  content_text       TEXT NOT NULL,
  embedding          vector(768),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_ce_source CHECK (
    (clinical_record_id IS NOT NULL)::int +
    (health_event_id IS NOT NULL)::int +
    (document_id IS NOT NULL)::int >= 1
  )
);

CREATE INDEX IF NOT EXISTS idx_ce_embedding ON clinical_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 2000);
CREATE INDEX IF NOT EXISTS idx_ce_patient_doc ON clinical_embeddings
  (patient_id, document_id);
CREATE INDEX IF NOT EXISTS idx_ce_document ON clinical_embeddings (document_id)
  WHERE document_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     UUID,
  actor         TEXT NOT NULL,
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   UUID,
  request_id    TEXT,
  ip_address    TEXT,
  user_agent    TEXT,
  resource      TEXT,
  status_code   INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_member ON audit_log (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log (action, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_immutable') THEN
    CREATE TRIGGER trg_audit_immutable
      BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION block_mutation();
  END IF;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['patients','clinical_records','health_documents','chat_sessions',
                            'chat_messages','member_consents','extracted_fields',
                            'tool_calls','model_runs','health_events','clinical_embeddings'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patients' AND policyname = 'p_patients_isolation') THEN
    CREATE POLICY p_patients_isolation ON patients
      USING (id = current_member_id()) WITH CHECK (id = current_member_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'health_documents' AND policyname = 'p_documents_isolation') THEN
    CREATE POLICY p_documents_isolation ON health_documents
      USING (patient_id = current_member_id()) WITH CHECK (patient_id = current_member_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clinical_records' AND policyname = 'p_records_isolation') THEN
    CREATE POLICY p_records_isolation ON clinical_records
      USING (patient_id = current_member_id()) WITH CHECK (patient_id = current_member_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_sessions' AND policyname = 'p_sessions_isolation') THEN
    CREATE POLICY p_sessions_isolation ON chat_sessions
      USING (patient_id = current_member_id()) WITH CHECK (patient_id = current_member_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'p_messages_isolation') THEN
    CREATE POLICY p_messages_isolation ON chat_messages
      USING (session_id IN (SELECT id FROM chat_sessions WHERE patient_id = current_member_id()))
      WITH CHECK (session_id IN (SELECT id FROM chat_sessions WHERE patient_id = current_member_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'member_consents' AND policyname = 'p_member_consents_isolation') THEN
    CREATE POLICY p_member_consents_isolation ON member_consents
      USING (member_id = current_member_id()) WITH CHECK (member_id = current_member_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'extracted_fields' AND policyname = 'p_ef_isolation') THEN
    CREATE POLICY p_ef_isolation ON extracted_fields
      USING (patient_id = current_member_id()) WITH CHECK (patient_id = current_member_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tool_calls' AND policyname = 'p_tool_calls_isolation') THEN
    CREATE POLICY p_tool_calls_isolation ON tool_calls
      USING (session_id IN (SELECT id FROM chat_sessions WHERE patient_id = current_member_id()))
      WITH CHECK (session_id IN (SELECT id FROM chat_sessions WHERE patient_id = current_member_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'model_runs' AND policyname = 'p_model_runs_isolation') THEN
    CREATE POLICY p_model_runs_isolation ON model_runs
      USING (session_id IN (SELECT id FROM chat_sessions WHERE patient_id = current_member_id()))
      WITH CHECK (session_id IN (SELECT id FROM chat_sessions WHERE patient_id = current_member_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'health_events' AND policyname = 'p_health_events_isolation') THEN
    CREATE POLICY p_health_events_isolation ON health_events
      USING (patient_id = current_member_id()) WITH CHECK (patient_id = current_member_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clinical_embeddings' AND policyname = 'p_ce_isolation') THEN
    CREATE POLICY p_ce_isolation ON clinical_embeddings
      USING (patient_id = current_member_id()) WITH CHECK (patient_id = current_member_id());
  END IF;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['patients','clinical_records','health_documents','chat_sessions',
                            'member_consents','extracted_fields'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

CREATE OR REPLACE VIEW v_timeline AS
  SELECT patient_id, start_at AS event_time, record_type::text AS event_type,
         name AS summary, id AS ref_id
    FROM clinical_records WHERE deleted_at IS NULL
  UNION ALL
  SELECT patient_id, started_at AS event_time, 'encounter'::text AS event_type,
         COALESCE(summary, 'Chat encounter (' || intent || ')')::text AS summary,
         id AS ref_id
    FROM chat_sessions
  UNION ALL
  SELECT patient_id, created_at AS event_time, 'document'::text AS event_type,
         ('Document uploaded: ' || original_filename)::text AS summary, id AS ref_id
    FROM health_documents WHERE deleted_at IS NULL;

COMMIT;
