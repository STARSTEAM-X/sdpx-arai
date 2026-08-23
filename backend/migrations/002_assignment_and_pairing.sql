-- Sprint 2 — assignment, criteria และ pair assignment (US-04, US-05, US-06)
--
-- migration นี้ทำสองเรื่องพร้อมกัน:
-- 1. ยก "กลุ่ม" จาก text ใน classroom_member ขึ้นเป็นตารางของตัวเองตาม ERD
-- 2. เพิ่มตารางฝั่ง assignment ทั้งชุด
--
-- ข้อ 1 จำเป็นเพราะ pair_assignment.item_a_id ต้องอ้างถึง "กลุ่ม" ได้ด้วย FK
-- ถ้ายังเก็บกลุ่มเป็น text ซ้ำ ๆ ในทุกแถวของสมาชิก จะไม่มี id ให้อ้าง
-- และการเปลี่ยนชื่อกลุ่มจะต้องไล่แก้ทุกแถวโดยไม่มีอะไรรับประกันว่าครบ

-- ---------- กลุ่ม ----------

CREATE TABLE IF NOT EXISTS group_entity (
    id           uuid PRIMARY KEY,
    classroom_id uuid        NOT NULL REFERENCES classroom (id) ON DELETE CASCADE,
    name         text        NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    -- ชื่อกลุ่มซ้ำกันข้าม classroom ได้ แต่ภายในห้องเดียวกันต้องไม่ซ้ำ
    UNIQUE (classroom_id, name)
);

-- ย้ายข้อมูลจาก group_name เดิมขึ้นตารางใหม่ ก่อนจะเพิ่ม FK
INSERT INTO group_entity (id, classroom_id, name)
SELECT gen_random_uuid(), m.classroom_id, m.group_name
FROM classroom_member m
WHERE m.group_name IS NOT NULL
GROUP BY m.classroom_id, m.group_name
ON CONFLICT (classroom_id, name) DO NOTHING;

ALTER TABLE classroom_member
    ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES group_entity (id) ON DELETE SET NULL;

UPDATE classroom_member m
SET group_id = g.id
FROM group_entity g
WHERE g.classroom_id = m.classroom_id
  AND g.name = m.group_name
  AND m.group_id IS NULL;

-- คง group_name ไว้เป็น denormalized copy โดยตั้งใจ
-- การอ่าน roster เป็น query ที่เรียกทุกครั้งที่เปิดหน้า และต้องการแค่ชื่อกลุ่ม
-- การ join ทุกครั้งเพื่อได้ text สั้น ๆ ไม่คุ้ม ส่วน group_id มีไว้ให้ pairing อ้าง
-- ทั้งสองคอลัมน์ถูกเขียนพร้อมกันเสมอใน replace_roster() จึงไม่หลุดจากกัน

CREATE INDEX IF NOT EXISTS idx_member_group ON classroom_member (group_id);

-- ---------- Assignment ----------

CREATE TABLE IF NOT EXISTS assignment (
    id                      uuid PRIMARY KEY,
    classroom_id            uuid        NOT NULL REFERENCES classroom (id) ON DELETE CASCADE,
    name                    text        NOT NULL,
    description             text,
    artifact_url            text,
    -- numeric ไม่ใช่ float — คะแนนที่คลาดหลักทศนิยมคือคะแนนที่เถียงกันไม่จบ (DR-04)
    group_max_score         numeric     NOT NULL DEFAULT 0 CHECK (group_max_score >= 0),
    -- 0 แปลว่าไม่มีการประเมินรายบุคคล ระบบจะไม่สร้าง pair ฝั่งนั้นเลย (FR-ASSIGN-07)
    individual_max_score    numeric     NOT NULL DEFAULT 0 CHECK (individual_max_score >= 0),
    group_deadline_utc      timestamptz NOT NULL,
    individual_deadline_utc timestamptz,
    target_coverage         int         NOT NULL DEFAULT 5  CHECK (target_coverage BETWEEN 1 AND 20),
    max_workload            int         NOT NULL DEFAULT 8  CHECK (max_workload BETWEEN 1 AND 30),
    -- เก็บ seed ที่ใช้จริงไว้ เพื่อ generate ซ้ำแล้วได้ผลเดิม (FR-PAIR-09)
    -- null จนกว่าจะ publish ครั้งแรก
    pairing_seed            bigint,
    status                  text        NOT NULL DEFAULT 'DRAFT'
                            CHECK (status IN ('DRAFT', 'PUBLISHED', 'OPEN', 'CLOSED', 'FINALIZED', 'ARCHIVED')),
    created_by              uuid        NOT NULL REFERENCES app_user (id),
    created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_classroom ON assignment (classroom_id);

CREATE TABLE IF NOT EXISTS criterion (
    id            uuid    PRIMARY KEY,
    assignment_id uuid    NOT NULL REFERENCES assignment (id) ON DELETE CASCADE,
    side          text    NOT NULL CHECK (side IN ('GROUP', 'INDIVIDUAL')),
    name          text    NOT NULL,
    -- ผลรวมต่อ side ต้องเป็น 100 — บังคับตอน publish ไม่ใช่ตอนสร้าง
    -- เพราะ DRAFT คืองานที่ยังทำไม่เสร็จ การบังคับตั้งแต่แรกจะห้ามคนเซฟงานค้างไว้
    weight_pct    numeric NOT NULL CHECK (weight_pct >= 0 AND weight_pct <= 100),
    display_order int     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_criterion_assignment ON criterion (assignment_id);

-- ---------- Pair assignment ----------

CREATE TABLE IF NOT EXISTS pair_assignment (
    id                   uuid PRIMARY KEY,
    assignment_id        uuid NOT NULL REFERENCES assignment (id) ON DELETE CASCADE,
    criterion_id         uuid NOT NULL REFERENCES criterion (id) ON DELETE CASCADE,
    side                 text NOT NULL CHECK (side IN ('GROUP', 'INDIVIDUAL')),
    -- ชี้ไป group_entity เมื่อ side = GROUP และชี้ไป app_user เมื่อ side = INDIVIDUAL
    -- จึงใส่ FK ตรง ๆ ไม่ได้ ต้องอาศัย CHECK ด้านล่างกันคู่ที่ไม่มีความหมายแทน
    item_a_id            uuid NOT NULL,
    item_b_id            uuid NOT NULL,
    evaluator_user_id    uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    -- ต้องเป็น item_a หรือ item_b ตัวใดตัวหนึ่ง — บันทึกว่า evaluator เห็นอะไรอยู่ซ้าย (D8)
    display_left_item_id uuid NOT NULL,
    generation           int  NOT NULL DEFAULT 1,
    source               text NOT NULL DEFAULT 'AUTO' CHECK (source IN ('AUTO', 'INSTRUCTOR_EXTRA')),
    created_at           timestamptz NOT NULL DEFAULT now(),

    -- P9 — ไม่มีคู่ไหนเทียบกับตัวเอง
    CONSTRAINT pair_items_differ CHECK (item_a_id <> item_b_id),
    CONSTRAINT display_left_is_one_of_the_items
        CHECK (display_left_item_id IN (item_a_id, item_b_id)),
    -- P4 — evaluator คนเดิมต้องไม่ได้รับ pair เดิมซ้ำภายใน criterion เดียวกัน
    -- บังคับที่ระดับ database ด้วย ไม่ใช่แค่ในโค้ด เพราะกฎนี้ต้องจริงเสมอ
    -- ไม่ว่าจะมีใครเขียนเส้นทางใหม่เข้ามาในอนาคตหรือไม่
    CONSTRAINT no_duplicate_pair_per_evaluator
        UNIQUE (criterion_id, evaluator_user_id, item_a_id, item_b_id)
);

CREATE INDEX IF NOT EXISTS idx_pair_assignment ON pair_assignment (assignment_id);
CREATE INDEX IF NOT EXISTS idx_pair_evaluator ON pair_assignment (evaluator_user_id, assignment_id);
