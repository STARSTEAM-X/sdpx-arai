# WS-06 / WS-07 External Setup

These settings are outside the repository and must be configured by a repository or Render administrator.

## GitHub Environments

Create `staging` and `production` environments.

Configure the `staging` environment:

- Secret `RENDER_STAGING_API_DEPLOY_HOOK`
- Secret `RENDER_STAGING_WEB_DEPLOY_HOOK`
- Secret `PERF_ACCESS_TOKEN`: bearer session for a dedicated staging account with classroom access. Session tokens expire after the configured session TTL and must be rotated before expiry.
- Variables `STAGING_API_URL` and `STAGING_WEB_URL`: origins without trailing slashes

Configure the `production` environment:

- Secrets `RENDER_PRODUCTION_API_DEPLOY_HOOK` and `RENDER_PRODUCTION_WEB_DEPLOY_HOOK`
- Variables `PRODUCTION_API_URL` and `PRODUCTION_WEB_URL`: origins without trailing slashes
- Required reviewers enabled

Enable secret scanning under repository security settings. Do not put URLs or other non-secret configuration in Actions secrets.

`render.yaml` now defines separate `develop` staging and `main` production web/API services, with a separate Postgres database for each. Apply/sync the Blueprint in Render and verify that existing staging resources are matched to `paireval-web` / `paireval-api` / `paireval-db` rather than replaced. Create deploy hooks for all four services and copy each hook only into its matching GitHub environment secret. Confirm the production API points to `paireval-production-db`; never point the staging and production hooks at the same service.

Both databases currently use Render's free plan to match the existing workshop setup. Render free Postgres expires after 30 days; select an appropriate paid plan before treating the production database as a long-lived environment.

## Performance Gate Data

1. Sign in to the staging app as a dedicated performance-test account.
2. Put that account's bearer session in the staging environment secret `PERF_ACCESS_TOKEN`; never commit or log it. Refresh it before its expiry.
3. Ensure the account can access at least one classroom. The script chooses the first classroom returned to that account and reads its assignments; it does not create or delete data.
4. Configure `STAGING_API_URL` to the backend origin. The CI performance job runs after the staging health check.

## Branch Rules and Evidence

For `main`, require a pull request, at least one review, up-to-date branches, and passing CI checks (`static-checks`, `typecheck-build`, `test-frontend`, `test-backend`, `integration`, and `e2e`). Block force pushes. Test the rule with a deliberately failing test on a disposable branch/PR, capture the blocked merge state in `docs/screenshots/`, then close the PR without merging.

After successful Actions runs, record the run URL and measured job durations in `docs/loop-metrics.md`. Do not fill measurement fields until the run has happened. Branch protection, Actions runs, secret scanning, and screenshot evidence must be configured or captured on GitHub/Render; they cannot be produced from this workspace alone.