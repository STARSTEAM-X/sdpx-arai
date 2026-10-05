#!/usr/bin/env bash
# Compatibility entrypoint; configuration and secret-safe errors live in deploy.py.
set -euo pipefail
exec python3 scripts/ci/deploy.py
