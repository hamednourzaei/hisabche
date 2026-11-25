# Workflow 6 — Implementation, Regression & Release Validation

**Default Profile:** `STANDARD` or `CRITICAL`

## Safe Implementation Loop (Every Feature or Fix)

1. **Scope & Index:** Define target files via `CODEBASE_MAP.md` / `pnpm code-intel` (`AGENTS.md §0.6`).
2. **Existing Engine Check:** Confirm extension target in `AGENTS.md §2` ("One of everything").
3. **Assign One Write Owner:** Designate **exactly one** implementer agent per file/module group; reviewers remain `read-only`.
4. **Smallest Correct Change:** `Minimal Change Engineer` or domain specialist writes clean, `any`-free code respecting `exactOptionalPropertyTypes` and logical RTL CSS.
5. **Run Verification (`--maxWorkers=8`):** Execute unit/HTTP/contract tests + `tsc` + `eslint` **after** final edit.
6. **Independent Diff Review:** `Code Reviewer` (plus `Security Auditor` or `Financial Controller` on sensitive areas) inspects `git diff` against `AGENTS.md`.
7. **Regression & Ledger Check:** Execute `workflows/regression-testing/WORKFLOW.md`.
8. **Release Validation:** `Reality Checker` audits 5-Layer Integrity (`EVIDENCE-STANDARD.md`) and outputs verified status + open human blockers (migrations, secret rotations, manual builds).
