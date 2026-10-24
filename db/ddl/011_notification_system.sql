ALTER TABLE members ADD COLUMN IF NOT EXISTS device_tokens JSONB NOT NULL DEFAULT '[]';
ALTER TABLE members ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  category        VARCHAR(60) NOT NULL,
  priority        VARCHAR(20) NOT NULL DEFAULT 'normal',
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  title           TEXT        NOT NULL,
  body            TEXT        NOT NULL,
  image_url       TEXT,
  deep_link       TEXT,
  action_label    TEXT,
  action_url      TEXT,
  source_type     VARCHAR(60),
  source_ref_id   TEXT,
  rules_triggered JSONB,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  idempotency_key TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_notifications_idempotency UNIQUE (member_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_notifications_member_created ON notifications (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status_scheduled ON notifications (status, scheduled_at) WHERE status IN ('pending', 'scheduled', 'deferred');
CREATE INDEX IF NOT EXISTS idx_notifications_category_date ON notifications (member_id, category, created_at);

CREATE OR REPLACE FUNCTION touch_notifications_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION touch_notifications_updated_at();
