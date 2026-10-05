#!/usr/bin/env bash
# Read-only verification for a manually triggered staging deploy.
set -euo pipefail
export TARGET_TIER=staging
exec python3 scripts/ci/deploy.py --verify-only
