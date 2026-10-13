-- Migration: 011_patient_memory_embeddings
-- Description: Creates a table to store embeddings of past conversation summaries for semantic recall.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    CREATE TABLE IF NOT EXISTS patient_memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        encounter_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        summary_text TEXT NOT NULL,
        embedding vector(384),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    BEGIN
      CREATE INDEX IF NOT EXISTS patient_memory_embedding_idx ON patient_memory USING hnsw (embedding vector_cosine_ops);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  ELSE
    CREATE TABLE IF NOT EXISTS patient_memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        encounter_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        summary_text TEXT NOT NULL,
        embedding double precision[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS patient_memory_patient_idx ON patient_memory (patient_id);
