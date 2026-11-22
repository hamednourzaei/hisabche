# Hisabche — Remediation Verify

**Date:** 22 Nov 2026
**Working tree:** uncommitted; the owner commits. `git status --short` at the end of the work:
**43 modified, 1 deleted, 11 untracked** (some modified files carry earlier work from the same
working tree; the files changed by this remediation are listed in the Persian hand-off).
**No commit, push, reset, stash, checkout, build, or dependency change was made.**

---

## 1. Status by dimension

| Dimension        | Status                          | Note                                                        |
| ---------------- | ------------------------------- | ----------------------------------------------------------- |
| Implementation   | `IMPLEMENTED_NOT_LIVE_VERIFIED` | invoices/advances, roles, gates, session settlement, events |
| Automated tests  | `IMPLEMENTED_NOT_LIVE_VERIFIED` | unit/source/mock tests pass; no live DB                     |
| Runtime / device | `PENDING_HUMAN_CONFIRMATION`    | no browser, Windows or Android run                          |
| Production       | `PENDING_HUMAN_CONFIRMATION`    | no live database or deployed server touched                 |
| Harness / MCP    | `IMPLEMENTED_NOT_LIVE_VERIFIED` | code-intel CLI + MCP smoke-tested earlier                   |
| Index freshness  | `STALE AFTER CHANGES`           | last refresh `FRESH` at HEAD `2ad548ae`; files edited since |

All mandate items previously marked incomplete have now been implemented:

- Session participants, subject switch, and free-text session type (`HISABCHE-CROSS-DOMAIN-INTEGRITY-AUDIT.md` §6.3) — implemented with migration `service-delivery-05` and UI/sync wiring.
- Mutation event gaps across Repair, Salon, Customers, Products, Contracts, and Deposits (`HISABCHE-MUTATION-EVENT-COVERAGE.md` §2) — wired with `logBusinessEvent`.

---

## 2. Commands and measured totals

### 2.1 Code intelligence

| Command                                                     | Result                                                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `node scripts/code-intel.mjs update` (earlier in this task) | `INCREMENTAL_UPDATE (FRESH)` · files 2,237 · symbols 21,679 · relationships 86,079 · HEAD `2ad548ae` |
| `node scripts/code-intel-mcp.mjs` smoke test                | status answered                                                                                      |

The index is **not** current for the edits made after that refresh. It was not rebuilt, because the
`graphify` interpreter it was built with no longer exists on this machine and the remaining install
is the forbidden one.

### 2.2 TypeScript

| Package               | Command            | Result       |
| --------------------- | ------------------ | ------------ |
| `packages/validation` | `npx tsc --noEmit` | **0 errors** |
| `packages/ui`         | `npx tsc --noEmit` | **0 errors** |
| `backend`             | `npx tsc --noEmit` | **0 errors** |
| `packages/api`        | `npx tsc --noEmit` | **0 errors** |
| `apps/web`            | `npx tsc --noEmit` | **0 errors** |

### 2.3 Tests

| Suite                                         | Command                                                                                                   | Result                                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Validation (full)                             | `npx vitest run` in `packages/validation`                                                                 | **103 files passed · 1,254 tests passed**                                            |
| UI (full, after the final guard-test updates) | `npx vitest run` in `packages/ui`                                                                         | **237 passed · 1 skipped (238 files) · 2,916 passed · 2 skipped**                    |
| UI (targeted invoice)                         | `invoice-unified-table` + `sales-hub` + `branch-and-warehouse-places`                                     | **3 files · 48 tests passed**                                                        |
| Backend — deposit liability                   | `npx vitest run src/__tests__/order-deposit-liability.test.ts`                                            | **9 passed**                                                                         |
| Backend — service delivery                    | `src/__tests__/service-delivery-http.test.ts` + `service-delivery.test.ts` + `v61-audit-services.test.ts` | **2 files · 27 passed** (third path absent)                                          |
| Backend — profile/contracts/repair/salon      | the group named in §2.4                                                                                   | **5 files passed · 37 tests passed · 12 skipped**; 3 Postgres suites failed to start |

### 2.4 The Postgres failure (environment, not the change)

```
FATAL: could not create shared memory segment: error code 1314
DETAIL: Failed system call was CreateFileMapping(
  size=150994944, name=Global/PostgreSQL:.../.pgtest/hisabche-pg-...)
```

Affected: `repair-parts-01.pg.test.ts`, `repair-quality-01.pg.test.ts`, `salon-02.pg.test.ts`.
These suites time out in `beforeAll`; they do not reach a single assertion. Every `*.pg.test.ts` in
this environment has the same limitation. Re-run them on a machine with working shared memory
before treating the migrations as proven.

### 2.5 ESLint (0 errors on every changed source file)

| Package               | Files                                                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend`             | `order-deposit.service.ts`, `service-delivery.service.ts`, `profile-capability.middleware.ts`, `contracts.routes.ts`, `repair.routes.ts`, `salon.routes.ts`, `order-deposit-liability.test.ts` |
| `packages/ui`         | `invoices-view.tsx`, `invoice-row-actions.tsx`, `invoices-container.tsx`, `invoice-list-row.ts`, `invoice-unified-table.test.ts`, `sales-hub.test.ts`, `branch-and-warehouse-places.test.ts`   |
| `packages/validation` | `industry-profiles.ts`, `business-capabilities.ts`, `industry-profiles.test.ts`                                                                                                                |

### 2.6 Generated registries (run so the repo's own guards stay truthful)

| Command                                                | Result                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `node scripts/capability/wiring-matrix.mjs`            | 21 engines · 53 capabilities · wrote `ENGINE-WIRING.csv`    |
| `node scripts/generate-capability-matrix-csv.mjs`      | `rows=689` · wrote `capability-matrix.csv`                  |
| `node scripts/industry/generate-industry-registry.mjs` | 67 industries · wrote `INDUSTRY-REGISTRY.md`                |
| `node scripts/industry/generate-sellable.mjs`          | wrote `sellable-industries.json` / `SELLABLE-INDUSTRIES.md` |
| `node scripts/migrations/pending-ledger.mjs`           | 296 migrations · 177 with VERIFY · 187 with a PG test       |
| `node scripts/api/unused-hooks.mjs`                    | 723 exported hooks · 70 with no consumer                    |

These generators rewrite committed artefacts; their output is part of the working-tree diff and was
not hand-edited.

---

## 3. Database work

| File                                                          | Purpose                                                                           | Status                         |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------ |
| `docs/service-delivery-04-settlement-undecided-migration.sql` | session settlement defaults to `undecided`; no implicit package credit at booking | **PENDING HUMAN CONFIRMATION** |
| `docs/VERIFY-service-delivery-04-settlement-undecided.sql`    | read-only verification of the default and existing rows                           | **PENDING HUMAN CONFIRMATION** |

No other migration was needed for the invoice unification, the role rules or the profile gates: those
read and write existing columns. No DDL was executed against any database. No «PASS» is claimed for
either file.

Order for the owner:

1. Run the migration on a staging copy, then `VERIFY-service-delivery-04-settlement-undecided.sql`.
2. Confirm the reported row counts.
3. Only then run it on production, after the backend that understands `undecided` is deployed.

---

## 4. What this verification does NOT prove

- That the advance row's «قطعی کردن» works against a real ledger with a real chart of accounts. The
  route and the idempotency mechanism are existing code; the new part is the button and its
  permission check.
- That a declared industry profile (e.g. `clothing`) is refused by the API in production. The gate
  is source-verified and mock-tested; no declared workspace was queried.
- That the outbox delivers. The enqueue/claim/complete functions are read, not executed here.
- That Windows and Android render the unified table. No build and no device run were performed.
- That the cross-source pagination limitation is acceptable at real data volume. It is documented, not
  solved.

---

## 5. Tooling blockers (unchanged, recorded so they are not rediscovered)

1. **Embedded Postgres** cannot map its shared memory on this Windows session (error 1314).
2. **graphify** rebuild is blocked: `.graphify_python` points at a removed `Python313\python.exe`,
   `Python312` has no `python.exe`, and the mandated full path is the infected install. The committed
   `graphify-out/` is not refreshed with fabricated data.
3. `fa/common.json` contains duplicate `free`/`FREE` keys, so PowerShell `ConvertFrom-Json` fails.
   JSON edits were made with Node and re-parsed after writing.
4. Git is only reachable through `C:\Program Files\Git\cmd\git.exe` in this shell.
