-- FR-API-02 — key เดียวกันใช้ซ้ำได้คนละผู้ใช้/assignment/side โดยไม่ชนกัน
CREATE TABLE IF NOT EXISTS submission_idempotency_scope (
    assignment_id     uuid        NOT NULL REFERENCES assignment (id) ON DELETE CASCADE,
    side              text        NOT NULL CHECK (side IN ('GROUP', 'INDIVIDUAL')),
    evaluator_user_id uuid        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    idempotency_key   text        NOT NULL,
    response_json     jsonb       NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (assignment_id, side, evaluator_user_id, idempotency_key)
);
