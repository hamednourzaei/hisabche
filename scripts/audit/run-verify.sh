#!/usr/bin/env bash
# Read-only verification runner for the audit. Runs each command, records exit code and the tail of output.
# Sequential on purpose: tree-reading guard tests time out when suites run in parallel.
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$ROOT/docs/audit/verify-logs}"
mkdir -p "$OUT"
export NODE_OPTIONS=--max-old-space-size=6144
run() {
  local name="$1" dir="$2"; shift 2
  local log="$OUT/$name.log"
  ( cd "$ROOT/$dir" && "$@" ) >"$log" 2>&1
  local code=$?
  echo "$name|$dir|$*|exit=$code" >>"$OUT/_summary.txt"
}
: >"$OUT/_summary.txt"
run tsc-validation packages/validation npx tsc --noEmit
run tsc-api packages/api npx tsc --noEmit
run tsc-ui packages/ui npx tsc --noEmit
run tsc-local-engine packages/local-engine npx tsc --noEmit
run tsc-app-bridge packages/app-bridge npx tsc --noEmit
run tsc-app-shell packages/app-shell npx tsc --noEmit
run tsc-formatting packages/formatting npx tsc --noEmit
run tsc-backend backend npx tsc --noEmit
run tsc-web apps/web npx tsc --noEmit
run tsc-desktop apps/desktop npx tsc --noEmit
run tsc-mobile apps/mobile npx tsc --noEmit
run tsc-admin apps/admin npx tsc --noEmit
run vitest-api packages/api npx vitest run
run vitest-formatting packages/formatting npx vitest run
run vitest-app-bridge packages/app-bridge npx vitest run
run vitest-app-shell packages/app-shell npx vitest run
run vitest-validation packages/validation npx vitest run
run vitest-local-engine packages/local-engine npx vitest run
run vitest-ui packages/ui npx vitest run --reporter=default
run vitest-backend backend npx vitest run src/__tests__ --exclude "**/*.pg.test.ts"
run jest-desktop apps/desktop npx jest
run jest-mobile apps/mobile npx jest
echo done >"$OUT/_done"
