#!/usr/bin/env bash
# Type-check every workspace that has a type-check script, one after another, and
# list the ones that fail. A local stand-in for `turbo run type-check`, which
# cannot reach the registry from some machines (TLS) — CI stops at the first
# failing package, so one red package hides the rest.
set -u
cd "$(dirname "$0")/.."
failed=()
for dir in packages/* apps/* backend; do
  [ -f "$dir/package.json" ] || continue
  grep -q '"type-check"' "$dir/package.json" || continue
  if (cd "$dir" && pnpm run type-check >/tmp/tc-$$.log 2>&1); then
    echo "ok    $dir"
  else
    echo "FAIL  $dir"
    grep -E "error TS|Cannot find" /tmp/tc-$$.log | head -5
    failed+=("$dir")
  fi
done
echo "---"
echo "${#failed[@]} failing: ${failed[*]:-none}"
