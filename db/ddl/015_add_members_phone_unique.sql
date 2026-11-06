DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_members_phone'
    ) THEN
        ALTER TABLE members ADD CONSTRAINT uq_members_phone UNIQUE (phone);
    END IF;
END $$;

