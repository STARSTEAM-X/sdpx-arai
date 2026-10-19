CREATE TABLE appeal (
    id uuid PRIMARY KEY,
    assignment_id uuid NOT NULL REFERENCES assignment(id),
    student_user_id uuid NOT NULL REFERENCES app_user(id),
    message text NOT NULL CHECK (char_length(message) BETWEEN 30 AND 5000),
    status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'REJECTED')),
    resolution text,
    resolved_by uuid REFERENCES app_user(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    UNIQUE (assignment_id, student_user_id)
);
CREATE INDEX appeal_assignment_created_idx ON appeal (assignment_id, created_at DESC);
