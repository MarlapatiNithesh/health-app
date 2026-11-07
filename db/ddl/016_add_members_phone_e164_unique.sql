DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_members_phone_e164'
    ) THEN
        ALTER TABLE members ADD CONSTRAINT uq_members_phone_e164 UNIQUE (phone_e164);
    END IF;
END $$;
