-- GAP-03 / PRD §7.9 — บันทึกว่าส่งอีเมลของ notification ไหนให้ใครไปแล้ว
-- event_key เป็นค่าเดียวกับ notification_read จึงส่งซ้ำไม่ได้แม้ worker รันหลายรอบหรือหลาย instance
-- PENDING ค้าง = process ตายระหว่างส่ง · ไม่ส่งซ้ำโดยตั้งใจ (ส่งขาดหนึ่งฉบับดีกว่าส่งซ้ำทั้งห้อง)
CREATE TABLE IF NOT EXISTS email_delivery (
    user_id    uuid        NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    event_key  text        NOT NULL,
    status     text        NOT NULL DEFAULT 'PENDING'
                           CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    attempts   integer     NOT NULL DEFAULT 1,
    last_error text,
    claimed_at timestamptz NOT NULL DEFAULT now(),
    sent_at    timestamptz,
    PRIMARY KEY (user_id, event_key)
);
CREATE INDEX IF NOT EXISTS email_delivery_sent_at_idx ON email_delivery (sent_at) WHERE status = 'SENT';

-- เวลาที่ worker เริ่มส่งครั้งแรก — event ก่อนหน้านี้ไม่ถูกส่งย้อนหลังเมื่อเพิ่งเปิดใช้อีเมล
CREATE TABLE IF NOT EXISTS email_worker_state (
    id         boolean     PRIMARY KEY DEFAULT true CHECK (id),
    started_at timestamptz NOT NULL DEFAULT now()
);
