# HISABCHE — SYNC INTEGRITY VERIFICATION REPORT (PHASE 0 GATE)

**Evaluation Date:** 2026-10-27  
**Test Harness:** Vitest (Backend Unit & Pg Projects), Jest (App-Shell & Mobile)  
**Monorepo Root:** `C:\Users\hamed\Desktop\hisabche`

---

## 1. Scenario Coverage & Layer Breakdown (Scenarios A–H)

The synchronization system is validated across distinct architectural layers. Where end-to-end multi-device interaction requires both the backend service and a real PostgreSQL database communicating via HTTP/PostgREST, those end-to-end scenarios are honestly classified as `NOT_COVERED` due to the lack of an integrated PostgREST harness. The underlying database guarantees, service-level validations, and client retry engines are individually implemented and tested as documented below:

| Scenario                                  | Layer                     | Implementation & Test Location                                                                                                                          | Status                               |
| :---------------------------------------- | :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------- |
| **A: Oversell on Last Stock Unit**        | **End-to-End Integrated** | _Requires PostgREST + live DB harness (service + DB together)_                                                                                          | `NOT_COVERED`                        |
|                                           | **Database Guarantee**    | `backend/src/__tests__/sync-scenarios.pg.test.ts` (`version guard is atomic`)                                                                           | `BLOCKED_EXTERNAL` (Linux P0 Gate)   |
|                                           | **Service Unit**          | `backend/src/__tests__/sync-invariants.test.ts` (`(a) version-guarded UPDATE matches 0 rows`)                                                           | `VERIFIED_COMPLETE`                  |
|                                           | **Client Logic**          | `packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts` (Scenario A)                                                                    | `VERIFIED_COMPLETE` (Fake transport) |
| **B: Multi-Device Convergence**           | **End-to-End Integrated** | _Requires multi-device live integration harness_                                                                                                        | `NOT_COVERED`                        |
|                                           | **Database Guarantee**    | `backend/src/__tests__/sync-scenarios.pg.test.ts` (Guarantees 1 & 4)                                                                                    | `BLOCKED_EXTERNAL` (Linux P0 Gate)   |
|                                           | **Service Unit**          | `backend/src/__tests__/sync-invariants.test.ts` (Monotonic cursor tests)                                                                                | `VERIFIED_COMPLETE`                  |
|                                           | **Client Logic**          | `packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts` (Scenario B)                                                                    | `VERIFIED_COMPLETE` (Fake transport) |
| **C: Invoice Aggregate Conflict**         | **End-to-End Integrated** | _Requires PostgREST + live DB harness_                                                                                                                  | `NOT_COVERED`                        |
|                                           | **Database Guarantee**    | `backend/src/__tests__/sync-scenarios.pg.test.ts` (Guarantee 1)                                                                                         | `BLOCKED_EXTERNAL` (Linux P0 Gate)   |
|                                           | **Service Unit**          | `backend/src/__tests__/sync-invariants.test.ts` (Invoice finalized immutability)                                                                        | `VERIFIED_COMPLETE`                  |
|                                           | **Client Logic**          | `packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts` (Scenario C)                                                                    | `VERIFIED_COMPLETE` (Fake transport) |
| **D: Network Cut Mid-Push**               | **Database Guarantee**    | `backend/src/__tests__/sync-scenarios.pg.test.ts` (Guarantee 3)                                                                                         | `BLOCKED_EXTERNAL` (Linux P0 Gate)   |
|                                           | **Service Unit**          | `backend/src/__tests__/sync-invariants.test.ts` (`(b) replaying same mutationId`)                                                                       | `VERIFIED_COMPLETE`                  |
|                                           | **Client Logic**          | `packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts` (Scenario D)<br>`apps/mobile/src/__tests__/sync-scenarios.test.ts` (Scenario D) | `VERIFIED_COMPLETE` (Fake transport) |
| **E: Batch Retry Safety**                 | **Database Guarantee**    | `backend/src/__tests__/sync-scenarios.pg.test.ts` (Guarantee 3)                                                                                         | `BLOCKED_EXTERNAL` (Linux P0 Gate)   |
|                                           | **Service Unit**          | `backend/src/__tests__/sync-invariants.test.ts` (`(c) duplicated batch handling`)                                                                       | `VERIFIED_COMPLETE`                  |
|                                           | **Client Logic**          | `packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts` (Scenario E)<br>`apps/mobile/src/__tests__/sync-scenarios.test.ts` (Scenario E) | `VERIFIED_COMPLETE` (Fake transport) |
| **F: Duplicate Route & Delete Refusal**   | **Database Guarantee**    | `backend/src/__tests__/sync-scenarios.pg.test.ts` (Guarantee 3)                                                                                         | `BLOCKED_EXTERNAL` (Linux P0 Gate)   |
|                                           | **Service Unit**          | `backend/src/__tests__/sync-invariants.test.ts` (`(d) delete rejected` & `(e) no log written`)                                                          | `VERIFIED_COMPLETE`                  |
|                                           | **Client Logic**          | `packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts` (Scenario F)<br>`apps/mobile/src/__tests__/sync-scenarios.test.ts` (Scenario F) | `VERIFIED_COMPLETE` (Fake transport) |
| **G: Commit Horizon Cursor**              | **Database Guarantee**    | `backend/src/__tests__/sync-scenarios.pg.test.ts` (Guarantee 2: in-flight isolation)<br>`backend/src/__tests__/sync-cursor-concurrency.pg.test.ts`      | `BLOCKED_EXTERNAL` (Linux P0 Gate)   |
|                                           | **Service Unit**          | `backend/src/__tests__/sync-invariants.test.ts` (Keyset cursor order)                                                                                   | `VERIFIED_COMPLETE`                  |
|                                           | **Client Logic**          | `packages/app-shell/src/features/sync/__tests__/sync-pull.test.ts`                                                                                      | `VERIFIED_COMPLETE` (Fake transport) |
| **H: Stale Reconnect Past Prune Horizon** | **Database Guarantee**    | _Prune retention job_                                                                                                                                   | `NOT_COVERED`                        |
|                                           | **Service Unit**          | `backend/src/__tests__/sync-invariants.test.ts` (`isBehindHorizon signals mustRehydrate`)                                                               | `VERIFIED_COMPLETE`                  |
|                                           | **Client Logic**          | `packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts` (Scenario H)                                                                    | `VERIFIED_COMPLETE` (Fake transport) |

---

## 2. Invariant Corrections & Implementations

### 2.1 Version Guard Atomicity in `sync.service.ts`

- **Mechanism:** In `backend/src/services/sync.service.ts` (lines 620–645), update statements include `.eq('version', mutation.expectedVersion)`.
- If zero rows are returned because a concurrent transaction modified the row, the service catches the condition, re-reads the latest row, records a conflict via `fileConflict()`, and throws `SyncError('version_conflict')`.
- **Injection Test:** If the `.eq('version', ...)` check were omitted, a concurrent write would overwrite changes silently. In `backend/src/__tests__/sync-invariants.test.ts:963`, removing the check causes test failure.

### 2.2 Unversioned Entity Support (`transactions`)

- Verification revealed that `transactions` has no `version` column in `docs/base-schema-migration.sql:171`.
- The version check was made conditional via `ENTITIES_WITH_VERSION` in `sync.service.ts` so `transactions` updates safely without causing PostgREST error 42703 (missing column).
- Unit test added in `backend/src/__tests__/sync-invariants.test.ts:1078` passes cleanly.

### 2.3 Commit-Horizon Function (`sync-commit-horizon-migration.sql`)

- Uses PostgreSQL function `sync_pull_changes` with predicate `txid < pg_snapshot_xmin(pg_current_snapshot())` to prevent out-of-order transaction commits from being skipped by pull cursors.
- Guarded by `backend/src/__tests__/sync-scenarios.pg.test.ts` and `sync-cursor-concurrency.pg.test.ts`.

---

## 3. Measured Test Counts (Real Numbers Observed)

| Package / Suite          | Command                                                          | Files Passed | Tests Passed  | Status |
| :----------------------- | :--------------------------------------------------------------- | :----------- | :------------ | :----- |
| **Backend Unit**         | `cd backend && npx vitest run --project unit`                    | 319 / 319    | 4,660 / 4,660 | `PASS` |
| **App Shell TypeScript** | `cd packages/app-shell && npx tsc --noEmit`                      | 0 errors     | N/A           | `PASS` |
| **API Client**           | `cd packages/api && npx tsc --noEmit && npx vitest run`          | 37 / 37      | 290 / 290     | `PASS` |
| **Local Engine**         | `cd packages/local-engine && npx tsc --noEmit && npx vitest run` | 26 / 26      | 192 / 192     | `PASS` |
| **Mobile App**           | `cd apps/mobile && npx tsc --noEmit && npx jest`                 | 17 / 17      | 207 / 207     | `PASS` |
| **Desktop App**          | `cd apps/desktop && npx tsc --noEmit && npx jest`                | 29 / 29      | 275 / 275     | `PASS` |
| **AI Index**             | `node scripts/build-ai-index.mjs`                                | 1872 files   | N/A           | `PASS` |

_Note: The app-shell scenario test is collected and executed through desktop Jest (`apps/desktop/../../packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts`) with 4/4 passing._

---

## 4. Required Pre-Push P0 Linux Command

PostgreSQL embedded tests cannot start on Windows accounts without administrative privileges (error 1314). The entire `*.pg.test.ts` suite represents the P0 launch gate and must be run on Linux before pushing:

```bash
cd backend && npx vitest run --project pg \
  src/__tests__/sync-scenarios.pg.test.ts \
  src/__tests__/sync-cursor-concurrency.pg.test.ts \
  src/__tests__/sync-conflicts-forward.pg.test.ts \
  src/__tests__/invoice-return-01.pg.test.ts
```

---

## 5. Owner Decision Register

1. **Tax Split Policy (N-37):** Confirm round-off distribution policy when proportional tax splits leave a 1-minor-unit remainder.
2. **Cash Refund vs Customer Credit:** Confirm whether sales return defaults to cash refund or store credit in POS offline mode.
3. **Seller Capabilities:** Confirm baseline capability assignments for branch sellers in multi-currency workspaces.
4. **Offline-Edition Returns:** Confirm if mobile offline clients may issue return documents for transactions older than the local operational cache window.
5. **Transfer Service & Scheduled Reports:** Decide whether to wire `transfer.service.ts` and `scheduled-reports.service.ts` into routes or remove them per CLAUDE.md §14.
6. **Cheque Validation Survey (GAP-01):** Validate the 4 merchant workflow questions prior to schema authoring.
7. **Offline-BOM Go / No-Go:** Offline BOM plan prepared (`docs/product-intelligence/OFFLINE-BOM-PLAN.md`); execution gated until Linux PostgreSQL verification is complete.
