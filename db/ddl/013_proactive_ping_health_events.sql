-- Migration 013: Add proactive_ping to health_events check constraint
BEGIN;

ALTER TABLE health_events DROP CONSTRAINT IF EXISTS health_events_event_type_check;

ALTER TABLE health_events ADD CONSTRAINT health_events_event_type_check 
  CHECK (event_type IN (
    'diagnosis','symptom','lab_result',
    'medication_start','medication_stop',
    'prescription','doctor_visit','surgery',
    'hospitalization','vital','wearable_event',
    'lifestyle_event','allergy','chat_summary',
    'proactive_ping'
  ));

COMMIT;
