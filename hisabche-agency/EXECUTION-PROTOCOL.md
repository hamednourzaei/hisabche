# Execution Protocol

Follow root [AGENTS.md §0.5 & §0.6](../AGENTS.md) verbatim across every workflow.

## 1. Mode Selection

- **Bug / Failure Mode (`AGENTS.md §0.5` Error-First):**
  `Error/Stack Trace -> Exact File & Line -> Immediate Callers -> Data Contract/Migration -> Targeted Test -> Minimal Root-Cause Fix -> Full Package Gate`
- **Feature / Architecture Change:**
  `Preflight -> Domain Classification -> Existing Engine Lookup (code-intel) -> Dependency Impact -> Single-Owner Implementation -> Multi-Layer Verification -> Postflight`

## 2. Preflight Checklist (Before Any Plan or Edit)

1. Run `git status --short` and check current branch/HEAD (preserve all uncommitted user changes).
2. Check index state (`pnpm code-intel status`); fall back to scoped search if stale, never trust empty index hits alone.
3. Read relevant skill (`hisabche-*`) and verify whether a core helper/component already exists (`AGENTS.md §2`).

## 3. Postflight Checklist (Before Any Agent Claims Done)

1. `git diff --check` (zero trailing whitespace / conflict markers).
2. Confirm only task-scoped files were changed (`git status --short`).
3. Run `tsc --noEmit`, `eslint` on modified files, and relevant tests (`--maxWorkers=8` for Vitest suites) **after** the final edit.
4. Report exact commands, pass/fail/skip counts, and honest status tag ([RELEASE-POLICY.md](./RELEASE-POLICY.md)).
