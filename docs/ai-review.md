# AI Review - WS-07 Preparation

## Target

`backend/app/daily_scoring.py`: `run_due_recomputes`

## Static review findings

- **Medium, measurement required:** the initial query groups all published/open/closed assignments and computes each assignment's most recent interim score before Python filters due work. As assignment history grows, this query may dominate the scheduled run. Verify with `EXPLAIN (ANALYZE, BUFFERS)` against representative staging data and record the row count and duration.
- **Medium, measurement required:** each due assignment is then handled with a separate transaction, advisory-lock query, and repository lookup. This is an N-per-due-assignment database round-trip pattern. It may be acceptable for the current dataset; measure the number of due assignments, query time, and lock contention before proposing batching.
- **Low, observability gap:** the worker logs a failure traceback but does not emit a structured event with assignment-level timing or a stable run correlation ID. A future change could add a scheduled-run ID and durations without logging student identifiers.

No performance measurements were available during this review. These are hypotheses for WS-07 measurement, not confirmed production bottlenecks. No code was changed as a result of this review.
