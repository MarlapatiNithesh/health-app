ALTER TABLE member_consents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  BEGIN
    NEW.updated_at := now();
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
