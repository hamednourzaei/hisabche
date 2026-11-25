# Hisabche Release Policy & Status Vocabulary

## 1. Mandatory Status Vocabulary

Every deliverable, workflow gate, and final report must classify each item using **only** these exact status labels:

| Status Label                    | Strict Definition (When Allowed)                                                                                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VERIFIED_COMPLETE`             | Implementation complete AND verified through real execution/HTTP/Postgres/browser evidence appropriate to the scope with zero open blockers. _(Requires live verification for runtime/DB/deploy claims.)_ |
| `IMPLEMENTED_NOT_LIVE_VERIFIED` | Code, unit/contract/HTTP tests, typecheck, and lint pass locally after the final edit, but live DB / staging / production runtime / browser verification did not run or is outside sandbox access.        |
| `PARTIALLY_IMPLEMENTED`         | Concrete code/config landed, with named unclosed gaps remaining in scope.                                                                                                                                 |
| `BLOCKED`                       | Stopped by external credentials, hardware/OS privilege (`embedded-postgres` Windows token), missing CLI/host tool (`codex` CLI), or human-only git/infra policy (`Rule 0`). Must name the exact blocker.  |
| `NOT_IMPLEMENTED`               | No implementation evidence exists in repository or harness.                                                                                                                                               |
| `PENDING_HUMAN_CONFIRMATION`    | Owner-executed SQL migration/VERIFY/build/secret-rotation step generated and awaiting human confirmation in live environment.                                                                             |

---

## 2. Reality Checker Veto Authority

The **Reality Checker (`hisabche-reality-checker`)** defaults to `NEEDS WORK` / `IMPLEMENTED_NOT_LIVE_VERIFIED` until all items below are satisfied cleanly:

1. All [QUALITY-GATES.md](./QUALITY-GATES.md) checks pass after the final edit (0 failures).
2. Every P0 security, tenancy, financial balance, and offline integrity invariant holds.
3. No unverified SQL migration is reported as applied.
4. No tracked `.env*` secret exposure or unrotated credential blocker remains hidden.
5. `docs/sales/SELLABLE-INDUSTRIES.md` and `acceptance-results.json` agree cleanly without falsifying browser or PostgreSQL evidence.
