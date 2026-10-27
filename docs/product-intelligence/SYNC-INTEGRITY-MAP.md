# HISABCHE — SYNC INTEGRITY ARCHITECTURE & VERIFICATION MAP

**Target Artifact:** Multi-Tier Sync Integrity & Verification Map (Phase 0 Launch Gate)  
**Repository Root:** `C:\Users\hamed\Desktop\hisabche`  
**Evaluation Date:** 2026-10-27

---

## 1. ENTITY_TABLE Version Column Audit (§3.4)

Every table exposed through `ENTITY_TABLE` in `backend/src/services/sync.service.ts` was audited against `docs/*.sql` for the existence of a `version` column maintained by `sync_bump_version()`:

| Protocol Entity | Physical Table    | Migration File & Line                                 | Status & Column Definition                                                                                                                                                          |
| :-------------- | :---------------- | :---------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invoice`       | `invoices`        | `docs/sync-engine-migration.sql:157`                  | `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;`                                                                                                  |
| `customer`      | `customers`       | `docs/sync-engine-migration.sql:173`                  | `ALTER TABLE customers ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;`                                                                                                 |
| `product`       | `products`        | `docs/sync-engine-migration.sql:174`                  | `ALTER TABLE products ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;`                                                                                                  |
| `transaction`   | `transactions`    | `docs/base-schema-migration.sql:171`                  | **LACKS `version` column.** Defined without `version`. Invariant guard in `sync.service.ts` made conditional via `ENTITIES_WITH_VERSION`. Unit-tested in `sync-invariants.test.ts`. |
| `time_entry`    | `time_entries`    | `docs/timesheet-sync-migration.sql:38`                | `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;`                                                                                             |
| `warehouse`     | `warehouses`      | `docs/always-local-operational-pull-migration.sql:49` | `ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;`                                                                                                |
| `branch`        | `branches`        | `docs/always-local-operational-pull-migration.sql:50` | `ALTER TABLE branches ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;`                                                                                                  |
| `exchange_rate` | `exchange_rates`  | `docs/always-local-operational-pull-migration.sql:51` | `ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;`                                                                                            |
| `product_stock` | `warehouse_stock` | `docs/always-local-operational-pull-migration.sql:52` | `ALTER TABLE warehouse_stock ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;`                                                                                           |

---

## 2. Multi-Layer Scenario Verification Matrix (Scenarios A–H)

Verification is classified strictly across three distinct testing tiers:

- **Database Engine Guarantee:** Real PostgreSQL constraints, triggers, and functions (`*.pg.test.ts`).
- **Service Logic:** Authoritative backend service handling conflict logging, leases, and validations with in-memory database stand-in (`sync-invariants.test.ts`).
- **Client Logic:** Real outbox drain, queue transition, and retry logic evaluated against a simulated transport (`sync-scenarios.test.ts`).
- **End-to-End Integrated:** Requires live PostgREST or pg-backed client harness. Where no end-to-end integration harness exists, the end-to-end scenario is marked `NOT_COVERED`.

| Scenario                                | Layer                              | Test File & Name                                                                                                                          | Status                               |
| :-------------------------------------- | :--------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------- |
| **A: Oversell on Last Stock Unit**      | **End-to-End** (Full Service + DB) | _None (Requires PostgREST + live DB harness)_                                                                                             | `NOT_COVERED`                        |
|                                         | **DB Guarantee**                   | `backend/src/__tests__/sync-scenarios.pg.test.ts`<br>`version guard is atomic`                                                            | `BLOCKED_EXTERNAL` (Linux P0 Gate)   |
|                                         | **Service Unit**                   | `backend/src/__tests__/sync-invariants.test.ts`<br>`(a) push whose version-guarded UPDATE matches zero rows files a conflict`             | `VERIFIED_COMPLETE`                  |
|                                         | **Client Logic**                   | `packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts`<br>`Scenario A client outbox handling`                            | `VERIFIED_COMPLETE` (Fake transport) |
| **B: Multi-Device Convergence**         | **End-to-End** (Full Service + DB) | _None (Requires multi-device live integration harness)_                                                                                   | `NOT_COVERED`                        |
|                                         | **DB Guarantee**                   | `backend/src/__tests__/sync-scenarios.pg.test.ts`<br>`Guarantee 1 (atomicity) & 4 (triggers)`                                             | `BLOCKED_EXTERNAL` (Linux P0 Gate)   |
|                                         | **Service Unit**                   | `backend/src/__tests__/sync-invariants.test.ts`<br>`the cursor is monotonic and never skips a change`                                     | `VERIFIED_COMPLETE`                  |
|                                         | **Client Logic**                   | `packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts`<br>`Scenario B convergence logic`                                 | `VERIFIED_COMPLETE` (Fake transport) |
| **C: Invoice Aggregate Conflict**       | **End-to-End** (Full Service + DB) | _None (Requires PostgREST + live DB harness)_                                                                                             | `NOT_COVERED`                        |
|                                         | **DB Guarantee**                   | `backend/src/__tests__/sync-scenarios.pg.test.ts`<br>`Guarantee 1 (version guard atomicity)`                                              | `BLOCKED_EXTERNAL` (Linux P0 Gate)   |
|                                         | **Service Unit**                   | `backend/src/__tests__/sync-invariants.test.ts`<br>`refuses to change the money on a finalized invoice`                                   | `VERIFIED_COMPLETE`                  |
|                                         | **Client Logic**                   | `packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts`<br>`Scenario C aggregate conflict`                                | `VERIFIED_COMPLETE` (Fake transport) |
| **D: Network Cut Mid-Push**             | **DB Guarantee**                   | `backend/src/__tests__/sync-scenarios.pg.test.ts`<br>`mutation idempotency: concurrent INSERT ON CONFLICT DO NOTHING`                     | `BLOCKED_EXTERNAL` (Linux P0 Gate)   |
|                                         | **Service Unit**                   | `backend/src/__tests__/sync-invariants.test.ts`<br>`(b) replaying the same mutationId returns stored result`                              | `VERIFIED_COMPLETE`                  |
|                                         | **Client Logic**                   | `packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts`<br>`Scenario D: network failure preserves outbox`                 | `VERIFIED_COMPLETE` (Fake transport) |
| **E: Batch Retry Safety**               | **DB Guarantee**                   | `backend/src/__tests__/sync-scenarios.pg.test.ts`<br>`Guarantee 3 (mutation idempotency)`                                                 | `BLOCKED_EXTERNAL` (Linux P0 Gate)   |
|                                         | **Service Unit**                   | `backend/src/__tests__/sync-invariants.test.ts`<br>`(c) a duplicated batch with same batchId has exactly one effect`                      | `VERIFIED_COMPLETE`                  |
|                                         | **Client Logic**                   | `packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts`<br>`Scenario E: batch retry clears outbox on 200`                 | `VERIFIED_COMPLETE` (Fake transport) |
| **F: Duplicate Route & Delete Refusal** | **DB Guarantee**                   | `backend/src/__tests__/sync-scenarios.pg.test.ts`<br>`Guarantee 3 (mutation idempotency)`                                                 | `BLOCKED_EXTERNAL` (Linux P0 Gate)   |
|                                         | **Service Unit**                   | `backend/src/__tests__/sync-invariants.test.ts`<br>`(d) delete through /sync/push is rejected & (e) no log written`                       | `VERIFIED_COMPLETE`                  |
|                                         | **Client Logic**                   | `packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts`<br>`Scenario F: delete rejected per N-30 invariant`               | `VERIFIED_COMPLETE` (Fake transport) |
| **G: Commit Horizon Cursor**            | **DB Guarantee**                   | `backend/src/__tests__/sync-scenarios.pg.test.ts`<br>`commit-horizon: uncommitted tx hides concurrent tx from sync_pull_changes`          | `BLOCKED_EXTERNAL` (Linux P0 Gate)   |
|                                         | **DB Interleaved Concurrency**     | `backend/src/__tests__/sync-cursor-concurrency.pg.test.ts`<br>`interleaved two-connection transactions`                                   | `BLOCKED_EXTERNAL` (Linux P0 Gate)   |
|                                         | **Service Unit**                   | `backend/src/__tests__/sync-invariants.test.ts`<br>`returns changes strictly after the cursor, in order`                                  | `VERIFIED_COMPLETE`                  |
|                                         | **Client Logic**                   | `packages/app-shell/src/features/sync/__tests__/sync-pull.test.ts`<br>`cursor watermark tracking`                                         | `VERIFIED_COMPLETE` (Fake transport) |
| **H: Stale Reconnect Past Horizon**     | **DB Guarantee**                   | _Prune cron job simulation_                                                                                                               | `NOT_COVERED`                        |
|                                         | **Service Unit**                   | `backend/src/__tests__/sync-invariants.test.ts`<br>`isBehindHorizon: cursor older than oldest log row signals mustRehydrate`              | `VERIFIED_COMPLETE`                  |
|                                         | **Client Logic**                   | `packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts`<br>`Scenario H: mustRehydrate resets cursor and preserves outbox` | `VERIFIED_COMPLETE` (Fake transport) |

---

## 3. P0 Linux Verification Command

Embedded PostgreSQL cannot bind shared memory or create symbolic links on Windows developer accounts (`error 1314: A required privilege is not held by the client`). The database tests are collected by `backend/vitest.config.mts` in the `pg` project and MUST be run on a Linux container or server:

```bash
cd backend && npx vitest run --project pg \
  src/__tests__/sync-scenarios.pg.test.ts \
  src/__tests__/sync-cursor-concurrency.pg.test.ts \
  src/__tests__/sync-conflicts-forward.pg.test.ts
```
