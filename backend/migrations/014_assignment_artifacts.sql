-- An artifact belongs to a real group in the assignment's classroom.
CREATE TABLE IF NOT EXISTS assignment_artifact (
    assignment_id uuid NOT NULL REFERENCES assignment(id) ON DELETE CASCADE,
    group_id uuid NOT NULL REFERENCES group_entity(id) ON DELETE CASCADE,
    url text NOT NULL,
    PRIMARY KEY (assignment_id, group_id)
);
