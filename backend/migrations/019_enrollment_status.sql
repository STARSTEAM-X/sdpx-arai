-- Enrollment belongs to a classroom, not the person's account in other classrooms.
ALTER TABLE classroom_member ADD COLUMN enrollment_status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (enrollment_status IN ('ACTIVE', 'WITHDRAWN'));
