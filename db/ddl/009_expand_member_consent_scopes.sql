-- Keep the database consent scopes aligned with the member consent API and UI.
ALTER TABLE member_consents
  DROP CONSTRAINT IF EXISTS member_consents_scope_check;

ALTER TABLE member_consents
  ADD CONSTRAINT member_consents_scope_check
  CHECK (scope IN (
    'data_access',
    'document_upload',
    'wearable_sync',
    'ai_processing',
    'health_data',
    'tos',
    'privacy_policy'
  ));
