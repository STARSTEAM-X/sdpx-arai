-- US-09 — ส่งคำตอบทั้งชุด
--
-- ทำไมต้องมี comparison_revision: FR-EVAL-06 บังคับว่า submit ซ้ำได้ไม่จำกัดครั้งก่อน deadline
-- และ "เก็บทุกเวอร์ชันไว้" — ตาราง comparison เก็บได้แค่คำตอบ *ปัจจุบัน* แถวเดียวต่อคู่
-- (DR-01 ผูก UNIQUE ไว้แล้ว) การเก็บประวัติต้องแยกตารางต่างหาก ไม่งั้นข้อมูลเก่าหายเงียบ ๆ
-- ทุกครั้งที่ submit ทับ — คนละเรื่องกับ comparison_revision ที่เก็บทุก draft (ยังไม่ทำตอนนี้
-- เพราะ AC ของ US-09 พูดถึงแค่ "submit กี่ครั้ง" ไม่ใช่ "แก้ draft กี่ครั้ง")
--
-- ทำไมต้องมี submission_idempotency: FR-API-02 บังคับให้ POST .../submissions รับ
-- Idempotency-Key แล้วเรียกซ้ำด้วย key เดิมต้องได้ "ผลลัพธ์เดิม" ไม่ใช่แค่ "ไม่พังซ้ำ"
-- ถ้าไม่เก็บ response ที่ตอบไปแล้ว submittedAt ของการเรียกซ้ำจะขยับตามเวลาจริงเสมอ
-- ซึ่งขัดกับนิยามของ idempotency key ตรง ๆ

CREATE TABLE IF NOT EXISTS comparison_revision (
    id            uuid        PRIMARY KEY,
    comparison_id uuid        NOT NULL REFERENCES comparison (id) ON DELETE CASCADE,
    choice        int         NOT NULL CHECK (choice BETWEEN 1 AND 6),
    status        text        NOT NULL,
    revision_no   int         NOT NULL,
    submitted_at  timestamptz NOT NULL,
    UNIQUE (comparison_id, revision_no)
);

CREATE TABLE IF NOT EXISTS submission_idempotency (
    idempotency_key text        PRIMARY KEY,
    response_json   jsonb       NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
