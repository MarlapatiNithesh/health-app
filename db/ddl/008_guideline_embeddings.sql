CREATE TABLE IF NOT EXISTS guideline_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name TEXT NOT NULL,
    title TEXT NOT NULL,
    section TEXT,
    content_text TEXT NOT NULL,
    embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guideline_embedding ON guideline_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
