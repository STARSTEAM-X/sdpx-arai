-- Sprint 3 — เก็บคำตอบของนักศึกษาต่อคู่ประเมิน (US-07, US-08, US-09)
--
-- สร้างตอน US-07 ทั้งที่ยังไม่มีใครเขียนลงตารางนี้เลย เพราะ AC ของ US-07 บังคับว่า
-- ต้องเห็นความคืบหน้า "ทำไปแล้ว N จาก M" — นับจากแถวที่ status = SUBMITTED
-- ถ้ารอสร้างตอน US-08 คำสั่ง query ของ US-07 จะอ้างตารางที่ไม่มีอยู่จริง
--
-- revision history (เก็บทุกเวอร์ชันตอน re-submit) เป็นของ US-09 — ยังไม่ทำตอนนี้
-- เพราะยังไม่มี endpoint ไหนเขียนลงตารางนี้เลยด้วยซ้ำ

ALTER TABLE assignment
    ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE TABLE IF NOT EXISTS comparison (
    id                 uuid PRIMARY KEY,
    -- 1 pair_assignment มีคำตอบ "ปัจจุบัน" ได้แถวเดียวเท่านั้น
    pair_assignment_id uuid        NOT NULL UNIQUE
                                    REFERENCES pair_assignment (id) ON DELETE CASCADE,
    evaluator_user_id  uuid        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    -- NULL ได้ตอนยังไม่เคยเลือกอะไรเลย (แถวจะยังไม่ถูกสร้างจนกว่าจะเลือกครั้งแรกก็ได้
    -- แต่เผื่อ NULL ไว้เพราะ autosave อาจสร้างแถวเปล่าไว้ก่อนตาม implementation ของ US-08)
    choice             int         CHECK (choice IS NULL OR choice BETWEEN 1 AND 6),
    status             text        NOT NULL DEFAULT 'DRAFT'
                                    CHECK (status IN ('DRAFT', 'SUBMITTED', 'EXCLUDED')),
    saved_at           timestamptz NOT NULL DEFAULT now(),
    submitted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_comparison_evaluator ON comparison (evaluator_user_id);
