-- A review decision does not erase submitted answers or participation credit.
CREATE TABLE assignment_exclusion (
    assignment_id uuid NOT NULL REFERENCES assignment(id) ON DELETE CASCADE,
    evaluator_user_id uuid NOT NULL REFERENCES app_user(id),
    excluded boolean NOT NULL DEFAULT true,
    reason text NOT NULL CHECK (length(btrim(reason)) > 0),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (assignment_id, evaluator_user_id)
);
