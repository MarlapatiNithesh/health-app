BEGIN;

CREATE TABLE IF NOT EXISTS phone_verification_sessions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id             UUID REFERENCES members(id) ON DELETE SET NULL,
    phone_e164            TEXT NOT NULL,
    channel               TEXT NOT NULL DEFAULT 'sms'
                            CHECK (channel IN ('sms', 'whatsapp', 'call')),
    status                TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'verified', 'canceled', 'expired', 'failed')),
    verify_attempts       INT NOT NULL DEFAULT 0,
    max_verify_attempts   INT NOT NULL DEFAULT 5,
    resend_count          INT NOT NULL DEFAULT 0,
    max_resend_count      INT NOT NULL DEFAULT 3,
    request_ip            TEXT,
    user_agent            TEXT,
    provider_message_id   TEXT,
    expires_at            TIMESTAMPTZ NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pvs_phone_status ON phone_verification_sessions (phone_e164, status);
CREATE INDEX IF NOT EXISTS idx_pvs_expires_at ON phone_verification_sessions (expires_at);

COMMIT;
