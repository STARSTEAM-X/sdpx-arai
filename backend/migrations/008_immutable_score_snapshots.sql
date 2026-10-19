-- FR-SCORE-09 / DR-03 — ผลคะแนนสุดท้ายต้องตรวจย้อนหลังได้และห้ามเขียนทับ
-- interim ยังคงมีเพียงชุดล่าสุด แต่ final แต่ละครั้งเป็น batch ใหม่ที่ใช้ computed_at เดียวกัน

ALTER TABLE computed_score
    DROP CONSTRAINT IF EXISTS computed_score_assignment_id_criterion_id_item_id_is_final_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_computed_score_interim
    ON computed_score (assignment_id, criterion_id, item_id)
    WHERE is_final = false;

CREATE INDEX IF NOT EXISTS idx_computed_score_final_batch
    ON computed_score (assignment_id, computed_at DESC)
    WHERE is_final = true;

CREATE TABLE IF NOT EXISTS score_snapshot (
    id               uuid        PRIMARY KEY,
    assignment_id    uuid        NOT NULL REFERENCES assignment (id) ON DELETE CASCADE,
    formula_version  text        NOT NULL,
    input_json       jsonb       NOT NULL,
    output_json      jsonb       NOT NULL,
    created_at       timestamptz NOT NULL,
    UNIQUE (assignment_id, created_at)
);

CREATE INDEX IF NOT EXISTS idx_score_snapshot_assignment
    ON score_snapshot (assignment_id, created_at DESC);
