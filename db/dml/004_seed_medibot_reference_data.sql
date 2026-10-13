INSERT INTO members (
  id, phone, phone_e164, phone_verified, phone_verified_at,
  full_name, dob, gender,
  status, health_consent_at, health_consent_version,
  created_at, updated_at
)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '+15555550199',
  '+15555550199',
  TRUE,
  NOW(),
  'Alex Mercer',
  '1985-06-15',
  'male',
  'active',
  NOW(),
  'v1.0',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  health_consent_at = EXCLUDED.health_consent_at,
  status = EXCLUDED.status;

INSERT INTO patients (
  id, sex_at_birth, blood_group, preferred_language,
  emergency_contact, preferences, lifestyle, goals,
  created_at, updated_at
)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'male',
  'O+',
  'en-IN',
  '{"name": "Sarah Mercer", "relationship": "Spouse", "phone": "+15555550198"}'::jsonb,
  '{"notifications": true, "ai_triage_enabled": true, "language": "en"}'::jsonb,
  '{"smoking": "never", "alcohol": "occasional"}'::jsonb,
  '[{"type": "blood_pressure", "target": "120/80"}]'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  emergency_contact = EXCLUDED.emergency_contact,
  preferences = EXCLUDED.preferences;

INSERT INTO member_consents (member_id, scope, granted, granted_at)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'data_access', TRUE, NOW()),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'document_upload', TRUE, NOW()),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'wearable_sync', TRUE, NOW()),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ai_processing', TRUE, NOW())
ON CONFLICT (member_id, scope) DO UPDATE SET
  granted = EXCLUDED.granted,
  granted_at = EXCLUDED.granted_at;

INSERT INTO provenance (id, source_type, source_date, confidence, created_at)
VALUES (
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
  'manual_entry',
  NOW(),
  1.0,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO clinical_records (
  id, patient_id, record_type, name, code, code_system,
  status, severity, start_at, provenance_id, source,
  verification_status, verified_at, created_at, updated_at
)
VALUES (
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'condition',
  'Essential (primary) hypertension',
  'I10',
  'icd10',
  'active',
  'moderate',
  '2024-01-10 00:00:00+00',
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
  'manual',
  'patient_confirmed',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO clinical_records (
  id, patient_id, record_type, name, code, code_system,
  status, dose, frequency, route, start_at, provenance_id, source,
  verification_status, verified_at, created_at, updated_at
)
VALUES (
  'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d44',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'medication',
  'Lisinopril 10 MG Oral Tablet',
  '314076',
  'rxnorm',
  'active',
  '10 mg',
  'daily',
  'oral',
  '2024-01-15 00:00:00+00',
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
  'manual',
  'patient_confirmed',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO clinical_records (
  id, patient_id, record_type, name, code, code_system,
  status, severity, details, start_at, provenance_id, source,
  verification_status, verified_at, created_at, updated_at
)
VALUES (
  'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e55',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'allergy',
  'Penicillin',
  '7980',
  'rxnorm',
  'active',
  'severe',
  '{"reaction": "Hives and facial swelling", "verificationStatus": "confirmed"}'::jsonb,
  '2018-04-20 00:00:00+00',
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
  'manual',
  'patient_confirmed',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO health_events (patient_id, event_type, summary, structured_data, provenance_id, event_time)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'diagnosis', 'Documented condition: Essential hypertension', '{"name": "Essential hypertension", "code": "I10"}'::jsonb, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2024-01-10 00:00:00+00'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'medication_start', 'Prescribed Lisinopril 10mg daily', '{"drug": "Lisinopril", "dose": "10mg"}'::jsonb, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2024-01-15 00:00:00+00')
ON CONFLICT DO NOTHING;
