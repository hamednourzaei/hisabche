#!/usr/bin/env bash
# Render start for the backend service. No pnpm needed: the workspace install
# already linked tsx into backend/node_modules/.bin.
set -euo pipefail

cd "$(dirname "$0")/backend"

exec ./node_modules/.bin/tsx src/index.ts
