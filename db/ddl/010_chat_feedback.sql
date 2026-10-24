-- Migration: 010_chat_feedback
-- Description: Creates a table to capture patient RLHF (Reinforcement Learning from Human Feedback) data.

CREATE TABLE IF NOT EXISTS chat_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL, -- The specific assistant message being rated
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
    rating TEXT NOT NULL CHECK (rating IN ('thumbs_up', 'thumbs_down')),
    feedback_text TEXT, -- Optional text explaining why they liked/disliked it
    tags TEXT[], -- e.g. ['hallucination', 'unhelpful', 'great_advice']
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_feedback_message_id ON chat_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_patient_id ON chat_feedback(patient_id);
