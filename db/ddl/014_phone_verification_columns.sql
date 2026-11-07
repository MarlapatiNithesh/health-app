ALTER TABLE phone_verification_sessions ADD COLUMN IF NOT EXISTS max_verify_attempts INT NOT NULL DEFAULT 5;
ALTER TABLE phone_verification_sessions ADD COLUMN IF NOT EXISTS max_resend_count INT NOT NULL DEFAULT 3;
ALTER TABLE phone_verification_sessions ALTER COLUMN request_ip TYPE TEXT;

