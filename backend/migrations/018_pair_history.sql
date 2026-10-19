-- Unpublish preserves submitted answers and their criteria instead of cascading deletes.
ALTER TABLE assignment ADD COLUMN generation integer NOT NULL DEFAULT 1 CHECK (generation > 0);
ALTER TABLE pair_assignment ADD COLUMN retired_at timestamptz;
ALTER TABLE criterion ADD COLUMN retired_at timestamptz;
ALTER TABLE score_override ADD COLUMN retired_at timestamptz;
ALTER TABLE pair_assignment DROP CONSTRAINT no_duplicate_pair_per_evaluator;
CREATE UNIQUE INDEX no_duplicate_active_pair_per_evaluator
    ON pair_assignment (criterion_id, evaluator_user_id, item_a_id, item_b_id)
    WHERE retired_at IS NULL;
