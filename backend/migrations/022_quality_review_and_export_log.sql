-- Figma J28/J28b: อาจารย์เปิดดูคำตอบของผู้ประเมินที่มีสัญญาณแล้ว แต่ตัดสินใจเก็บไว้ ("ดูแล้ว · เก็บไว้")
-- เก็บแยกจาก assignment_exclusion เพราะการดูไม่ได้เปลี่ยนคะแนน และไม่ต้องมีเหตุผล
CREATE TABLE IF NOT EXISTS quality_review (
    assignment_id     uuid        NOT NULL REFERENCES assignment (id) ON DELETE CASCADE,
    evaluator_user_id uuid        NOT NULL REFERENCES app_user (id),
    reviewed_by       uuid        NOT NULL REFERENCES app_user (id),
    reviewed_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (assignment_id, evaluator_user_id)
);

-- Figma J36/S10: ประวัติการส่งออกรายงานของแต่ละงาน — append-only ไม่เก็บตัวไฟล์
CREATE TABLE IF NOT EXISTS export_log (
    id            bigserial   PRIMARY KEY,
    assignment_id uuid        NOT NULL REFERENCES assignment (id) ON DELETE CASCADE,
    actor_user_id uuid        NOT NULL REFERENCES app_user (id),
    actor_role    text        NOT NULL,
    format        text        NOT NULL CHECK (format IN ('XLSX', 'CSV')),
    reports       text[]      NOT NULL CHECK (cardinality(reports) > 0),
    identified    boolean     NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS export_log_assignment_idx ON export_log (assignment_id, created_at DESC);
