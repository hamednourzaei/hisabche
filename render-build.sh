#!/usr/bin/env bash
# Render build for the backend service.
# Kept as a script because Render's dashboard build-command field truncates
# long commands. Render's image has a read-only /usr/bin, so corepack cannot
# link pnpm — `npx -y pnpm@<version>` runs it from the npx cache instead.
set -euo pipefail

cd "$(dirname "$0")"

PNPM=(npx -y pnpm@11.9.0)

"${PNPM[@]}" install --frozen-lockfile
"${PNPM[@]}" --filter @hisabche/backend exec drizzle-kit generate
