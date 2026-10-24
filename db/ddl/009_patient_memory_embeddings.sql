-- Migration: 009_patient_memory_embeddings
-- Description: Creates a table to store vector embeddings of past conversation summaries for semantic recall.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS patient_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    summary_text TEXT NOT NULL,
    embedding vector(384), -- Using 384 dimensions for all-MiniLM-L6-v2
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS patient_memory_embedding_idx ON patient_memory USING hnsw (embedding vector_cosine_ops);

-- Index for filtering by patient
CREATE INDEX IF NOT EXISTS patient_memory_patient_idx ON patient_memory (patient_id);
