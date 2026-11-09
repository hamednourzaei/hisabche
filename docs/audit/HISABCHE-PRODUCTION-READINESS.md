# Hisabche — Production Readiness

Audit date 2026-11-08, commit `b546d5df`. Verdict scope: code in the repository. Live production was not inspected.

## 1. Verdict

**CONDITIONAL — IMPLEMENTED_NOT_LIVE_VERIFIED.** The code base type-checks cleanly in 8 workspaces and 8,423 non-DB tests pass. It is not proven against a real database on this machine, several SaaS-lifecycle pieces are partial, and two licensing-integrity issues need an owner decision before selling offline licences.

## 2. Gate table

| Gate                      | Evidence                                                                     | Status                                |
| ------------------------- | ---------------------------------------------------------------------------- | ------------------------------------- |
| Type-check (8 workspaces) | `HISABCHE-TEST-QUALITY-AUDIT.md` rows 1-8                                    | IMPLEMENTED_NOT_LIVE_VERIFIED (green) |
| Unit/contract tests       | 5,240 + 2,670 + 513 passed                                                   | IMPLEMENTED_NOT_LIVE_VERIFIED         |
| Real-Postgres tests       | 106 files not runnable locally                                               | BLOCKED_EXTERNAL                      |
| Live HTTP smoke           | not run                                                                      | NOT_IMPLEMENTED (in this audit)       |
| Tenant isolation          | app-level; no confirmed IDOR; F-03, F-04 open                                | PARTIALLY_IMPLEMENTED                 |
| Offline licence integrity | F-01, F-02                                                                   | NEEDS_OWNER_DECISION                  |
| Subscription lifecycle    | trial email TODO, no renewal reminders, Path A unreachable                   | PARTIALLY_IMPLEMENTED                 |
| Payment gateway           | owner choice                                                                 | BLOCKED_EXTERNAL                      |
| Schema drift gate         | `check-schema-drift.mjs` exit 1                                              | FAILED (tool)                         |
| Pending migrations        | ≥13 listed in CLAUDE.md awaiting run/VERIFY                                  | NEEDS_OWNER_DECISION                  |
| Android release build     | blocked on this machine                                                      | BLOCKED_EXTERNAL                      |
| Unwired/duplicate code    | 122 routes without caller; 10 WRITTEN_NOT_WIRED modules; 3 legacy duplicates | PARTIALLY_IMPLEMENTED                 |

## 3. Critical path to "go" (recommendations)

1. Owner: set `VITE_OFFLINE_LICENSE_PUBLIC_KEY` for Windows/Android builds and make verification fail closed; move the private licence key out of the DB (F-01/F-02).
2. Add capability checks to product-image writes (F-03) and a workspace/membership filter to notifications (F-04).
3. Run pending migrations + VERIFY files and record results; then fix the drift tool.
4. Run the 106 pg tests in CI (Linux) and paste the exit code.
5. One live HTTP smoke on staging: signup → workspace → invoice → payment → return → delete/reverse → trial expiry 402 → renew.
6. Decide each API_ONLY area (orders, transport, cloud migration, snapshots, OData, appointments, livestock).
