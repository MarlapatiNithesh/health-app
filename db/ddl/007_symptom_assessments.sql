CREATE TABLE IF NOT EXISTS symptom_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    primary_symptom TEXT NOT NULL,
    state JSONB NOT NULL DEFAULT '{}',
    risk_assessed BOOLEAN DEFAULT FALSE,
    risk_level TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by session and patient
CREATE INDEX IF NOT EXISTS symptom_assessments_session_idx ON symptom_assessments(session_id);
CREATE INDEX IF NOT EXISTS symptom_assessments_patient_idx ON symptom_assessments(patient_id);
