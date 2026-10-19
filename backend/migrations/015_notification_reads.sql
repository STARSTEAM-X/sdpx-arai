ALTER TABLE assignment ADD COLUMN IF NOT EXISTS published_at timestamptz;
CREATE TABLE IF NOT EXISTS notification_read (
    user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    event_key text NOT NULL,
    read_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, event_key)
);
