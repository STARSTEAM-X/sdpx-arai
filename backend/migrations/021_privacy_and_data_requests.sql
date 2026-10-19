-- Figma ST03/J01b/C02/T02: ประกาศความเป็นส่วนตัวแสดงครั้งแรกที่เข้าสู่ระบบจนกว่าผู้ใช้จะกดรับทราบ
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS privacy_acknowledged_at timestamptz;

-- Figma ST07/T12/T12b: คำขอสำเนาข้อมูลของตัวเอง (PDPA มาตรา 30) — เก็บเป็นประวัติ ไม่ลบทับ
CREATE TABLE IF NOT EXISTS data_copy_request (
    id           bigserial PRIMARY KEY,
    user_id      uuid        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    requested_at timestamptz NOT NULL DEFAULT now(),
    status       text        NOT NULL DEFAULT 'IN_PROGRESS'
                 CHECK (status IN ('IN_PROGRESS', 'SENT'))
);

CREATE INDEX IF NOT EXISTS data_copy_request_user_idx ON data_copy_request (user_id, requested_at DESC);
