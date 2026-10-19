-- One-time production reset requested on 2026-08-25.
-- Keep the schema and schema_migration ledger, but remove every application row.
-- Listing every table explicitly avoids leaving orphaned operational data behind.
TRUNCATE TABLE
    score_snapshot,
    score_override,
    computed_score,
    submission_idempotency_scope,
    submission_idempotency,
    comparison_revision,
    comparison,
    pair_assignment,
    criterion,
    assignment,
    group_entity,
    audit_log,
    classroom_member,
    classroom,
    app_user
RESTART IDENTITY;
