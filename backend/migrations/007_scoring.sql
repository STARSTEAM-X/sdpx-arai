-- US-13/US-16 — เก็บผลคำนวณคะแนนและรองรับ finalize
--
-- คอลัมน์ config พวกนี้อยู่ใน assignment table ตาม PRD §11.1 (assignment) แต่ตกหล่นตอน
-- migration 002 เพราะตอนนั้นยังไม่มี scoring engine ให้ใช้ค่าพวกนี้ — เพิ่มตอนนี้พร้อมกับ
-- ตารางที่เขียนถึงมันจริงเป็นครั้งแรก

ALTER TABLE assignment
    ADD COLUMN IF NOT EXISTS instructor_weight     numeric(4,2)  NOT NULL DEFAULT 1.0
                                                    CHECK (instructor_weight >= 0),
    ADD COLUMN IF NOT EXISTS min_comparisons       int           NOT NULL DEFAULT 3
                                                    CHECK (min_comparisons >= 1),
    ADD COLUMN IF NOT EXISTS score_floor           numeric(4,3)  NOT NULL DEFAULT 0.600,
    ADD COLUMN IF NOT EXISTS score_ceiling         numeric(4,3)  NOT NULL DEFAULT 1.000,
    ADD COLUMN IF NOT EXISTS completion_threshold  numeric(4,3)  NOT NULL DEFAULT 0.900,
    ADD COLUMN IF NOT EXISTS finalized_at          timestamptz;

DO $$ BEGIN
    ALTER TABLE assignment ADD CONSTRAINT score_floor_lt_ceiling CHECK (score_floor < score_ceiling);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- คะแนนที่คำนวณได้ต่อ item ต่อเกณฑ์ — is_final = false คือ "ชั่วคราว" (FR-SCORE-07)
-- ผลจาก :recompute เขียนทับแถว is_final=false ได้เรื่อย ๆ แต่แถว is_final=true ห้ามแก้ตรง ๆ
-- (S7, DR-03) แก้ได้ผ่าน score_override เท่านั้น
CREATE TABLE IF NOT EXISTS computed_score (
    id                    uuid          PRIMARY KEY,
    assignment_id         uuid          NOT NULL REFERENCES assignment (id) ON DELETE CASCADE,
    criterion_id          uuid          NOT NULL REFERENCES criterion (id) ON DELETE CASCADE,
    side                  text          NOT NULL CHECK (side IN ('GROUP', 'INDIVIDUAL')),
    item_id               uuid          NOT NULL,
    comparison_count      int           NOT NULL DEFAULT 0,
    quality_index         numeric(10,9),
    score_ratio           numeric(10,9),
    weighted_score        numeric(10,4) NOT NULL,
    flags                 text[]        NOT NULL DEFAULT '{}',
    is_final              bool          NOT NULL DEFAULT false,
    formula_version       text          NOT NULL DEFAULT 'v2.0',
    computed_at           timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (assignment_id, criterion_id, item_id, is_final)
);

CREATE INDEX IF NOT EXISTS idx_computed_score_assignment ON computed_score (assignment_id);

-- แก้คะแนนที่ finalize แล้วต้องผ่านตรงนี้เท่านั้น — reason เป็น NOT NULL ตั้งแต่ระดับ database
-- ไม่ใช่แค่ validate ฝั่ง API (กัน endpoint ใหม่ในอนาคตเผลอข้ามการบังคับเหตุผล)
CREATE TABLE IF NOT EXISTS score_override (
    id              uuid        PRIMARY KEY,
    assignment_id   uuid        NOT NULL REFERENCES assignment (id) ON DELETE CASCADE,
    side            text        NOT NULL CHECK (side IN ('GROUP', 'INDIVIDUAL')),
    item_id         uuid        NOT NULL,
    criterion_id    uuid        REFERENCES criterion (id) ON DELETE SET NULL,
    original_value  numeric(10,4) NOT NULL,
    override_value  numeric(10,4) NOT NULL,
    reason          text        NOT NULL CHECK (btrim(reason) <> ''),
    created_by      uuid        NOT NULL REFERENCES app_user (id),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_override_assignment ON score_override (assignment_id);
