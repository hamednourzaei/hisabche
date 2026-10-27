#!/usr/bin/env bash
# Read-only: eslint on every changed or untracked ts/tsx file, from each package's own directory.
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/docs/audit/verify-logs"
mkdir -p "$OUT"
cd "$ROOT"
git status --short --untracked-files=all | awk '{print $2}' | grep -E '\.(ts|tsx)$' | sort -u > "$OUT/_changed-ts.txt"
: > "$OUT/_lint-summary.txt"
for pkg in backend packages/validation packages/api packages/ui packages/local-engine packages/app-bridge packages/app-shell packages/formatting packages/i18n packages/ui-contract apps/web apps/desktop apps/mobile apps/admin; do
  files=$(grep -E "^$pkg/" "$OUT/_changed-ts.txt" | sed "s#^$pkg/##" | tr '\n' ' ')
  [ -z "$files" ] && continue
  count=$(echo $files | wc -w)
  ( cd "$ROOT/$pkg" && npx eslint $files ) > "$OUT/lint-$(echo $pkg | tr '/' '-').log" 2>&1
  echo "$pkg|files=$count|exit=$?" >> "$OUT/_lint-summary.txt"
done
echo done > "$OUT/_lint-done"
