# Commit validation · 2026-10-19

Scope: accumulated Figma redesign implementation plus the subsequent image
restoration, notification dropdown, banner alignment, required course/semester
fields, removal of the active-classroom badge, and the two-way gap list.

Fresh checks before committing:

- Backend Ruff: passed.
- Frontend lint: exit 0, existing warnings remain; no new lint suppression.
- Frontend typecheck and production build: passed.
- OpenAPI lint: passed, no errors/warnings.
- Backend unit/API tests: 439 passed, 32 integration tests deselected, 3.35s.
- Frontend unit tests: 29 passed, 233ms Vitest duration.
- Combined sequential unit loop: 5.28s.

The backend unit command uses process-local `ENVIRONMENT=test`.
An initial run inherited production configuration and failed collection; a
sandboxed rerun stalled and was stopped. The unrestricted test run completed
successfully. Frontend TEMP/TMP points to `.local/image-tests-tmp` to avoid the
Windows sandbox temporary-file rename issue. No service configuration changed.

The integration/E2E/axe results in earlier reports are historical evidence from
the earlier redesign checkpoint, not fresh runs of these final working files.
`verification.json` and `source-files.json` retain that checkpoint and its hashes;
do not interpret them as hashes or visual baselines of the final commit.
The subsequent small UI changes have the browser checks recorded in
`NOTIFICATION_DROPDOWN.md`, `IMAGE_RESTORATION.md` and the conversation.
The E2E classroom page object now fills the newly required course/semester fields;
the full E2E suite was not rerun for this commit operation.

The original four commits were subsequently regrouped into the exact twelve
Conventional Commit titles requested by the user (auth, frontend, classrooms,
assignments, evaluation, scoring, appeals, notifications, UI, assets, E2E, docs).
The application source tree is identical to the validated four-commit snapshot.
That original history is retained in `codex/figma-frontend-before-12-commits`.
Unrelated performance outputs and `docs/project-file-guide.md` are excluded.
No environment files, temporary tools, dependencies, or credentials are staged.
