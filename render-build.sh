#!/usr/bin/env bash
# Render build for the backend service.
# Kept as a script because Render's dashboard build-command field truncates
# long commands. Render's image has a read-only /usr/bin, so corepack cannot
# link pnpm — `npx -y pnpm@<version>` runs it from the npx cache instead.
set -euo pipefail

cd "$(dirname "$0")"

npx -y pnpm@11.9.0 install --frozen-lockfile

# Call the binary directly: `pnpm --filter <pkg> exec` maps onto pnpm's
# recursive mode and is rejected by pnpm 11.
cd backend
./node_modules/.bin/drizzle-kit generate
