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

| File                                                               | Purpose                                                                                                          | Status                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `docs/service-delivery-04-settlement-undecided-migration.sql`      | session settlement defaults to `undecided`; no implicit package credit at booking                                | **PENDING HUMAN CONFIRMATION** |
| `docs/VERIFY-service-delivery-04-settlement-undecided.sql`         | read-only verification of the default and existing rows                                                          | **PENDING HUMAN CONFIRMATION** |
| `docs/service-delivery-06-optional-service-offering-migration.sql` | makes `service_product_id` nullable in `service_sessions` and ensures fallback `service_name`                    | **PENDING HUMAN CONFIRMATION** |
| `docs/VERIFY-service-delivery-06-optional-service-offering.sql`    | read-only verification of `service_sessions` nullability and constraints                                         | **PENDING HUMAN CONFIRMATION** |
| `docs/advances-04-party-identity-migration.sql`                    | adds `supplier_id` to `order_deposits`, relaxes `customer_id` NOT NULL, backfills pre_purchase, adds party check | **PENDING HUMAN CONFIRMATION** |
| `docs/VERIFY-advances-04-party-identity.sql`                       | read-only verification of columns, constraints, foreign keys and data consistency                                | **PENDING HUMAN CONFIRMATION** |
| `docs/FINDING-advances-party-identity.sql`                         | read-only audit finding query reporting mismatched pre_purchase rows                                             | **PENDING HUMAN CONFIRMATION** |

All migrations are idempotent, additive, tenant-safe and include down-migration rollback blocks. No DDL was executed against the live Supabase database. All status values remain `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.

Order for the owner:

1. Run `FINDING-advances-party-identity.sql` to inspect existing pre_purchase records.
2. Run `advances-04-party-identity-migration.sql` on a staging copy, followed by `VERIFY-advances-04-party-identity.sql`.
3. Run `service-delivery-06-optional-service-offering-migration.sql` followed by `VERIFY-service-delivery-06-optional-service-offering.sql`.
4. Run `service-delivery-04-settlement-undecided-migration.sql` followed by `VERIFY-service-delivery-04-settlement-undecided.sql`.
5. Only then run them on production, after the updated backend code is deployed.

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

---

## 6. Completion pass — 23 Nov 2026

Everything below was run in this session; the totals are what the commands printed.

| Command                                                                                                                                         | Result                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `backend && npx tsc --noEmit`                                                                                                                   | exit 0                                                  |
| `packages/ui && npx tsc --noEmit`                                                                                                               | exit 0                                                  |
| `packages/validation && npx tsc --noEmit`                                                                                                       | exit 0                                                  |
| backend WP-12 group (12 files)                                                                                                                  | **12 files / 124 tests passed**                         |
| backend D-item group (`invoice-seller`, `invoice-credit-limit`, `party-summary`, `concurrency-safety-map`, `reversal-ledger`, service delivery) | **6 files / 121 tests passed**                          |
| `packages/ui` invoice + session group (4 files)                                                                                                 | **4 files / 42 tests passed**                           |
| `packages/ui` recurring-purchase guard                                                                                                          | **1 failed** with the fix undone, **1 passed** restored |
| `packages/validation` service-delivery domain (2 files)                                                                                         | **2 files / 37 tests passed**                           |
| `.pgtest/run-advances-05-manual.mjs` (PostgreSQL 18.4)                                                                                          | **11 passed, 0 failed**                                 |
| `.pgtest/run-stock-02-manual.mjs` (PostgreSQL 18.4)                                                                                             | **17 passed, 0 failed**                                 |
| `.pgtest/audit-rpc-security.mjs`                                                                                                                | 10 callable / 2 trigger / **0 failing** a control       |
| `node scripts/migrations/pending-ledger.mjs`                                                                                                    | 302 migrations · 183 with VERIFY · 193 with a PG test   |
| `npx eslint` on every changed source file                                                                                                       | 0 errors                                                |

Two defects found by this pass and fixed:

1. **Recurring purchase template carried the supplier in `customerId`**
   (`invoice-preview-container.tsx:411`). The invoice itself mapped a purchase to `supplierId`; the
   template payload did not, and `z.record(z.unknown())` hid it from the compiler. Guarded by
   `packages/ui/src/__tests__/recurring-purchase-party.test.ts`, proven red without the fix.
2. **`stock_available` ignored the tenant and the four stock functions had no `service_role` grant**
   (`docs/stock-reservations-01-migration.sql`). Fixed by
   `docs/stock-reservations-02-grants-and-scope-migration.sql`; proven on PostgreSQL 18.4 that
   `service_role` is refused with 42501 before it, and that another workspace's warehouse answers 0
   after it.

One alignment, no behaviour change: the employee-session/package refusal used
`SETTLEMENT_PACKAGE_REQUIRES_CUSTOMER`; the owner's decision names `SETTLEMENT_CUSTOMER_REQUIRED`, so
both the server and the device domain use the decision's token, now covered by
`service-delivery-settlement.domain.test.ts`.

Still blocked, unchanged: every `*.pg.test.ts` through `embedded-postgres` 17.10 (shared-memory error
1314), `graphify-out` (removed interpreter), and all live-database verification. No commit, push, reset,
stash, checkout, build or dependency change was made.
