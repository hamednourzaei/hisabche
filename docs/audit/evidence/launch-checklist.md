# Launch Checklist — Bounded Launch-Critical Scope (A–H)

Date: 2026-10-26  
Status: **IMPLEMENTED_NOT_LIVE_VERIFIED**  
Decision: **NO — DO NOT FREEZE (Ledger remains UNFROZEN until live Supabase verification and owner decisions)**

---

## Scope A (N-30): Generic Sync Delete Roadblock

- **Problem:** Generic client push mutations could delete records across tenant entities without business domain validation or authorization.
- **Fix:** In `backend/src/services/sync.service.ts`, reject `delete` operations in `applyMutations` with `SyncError('forbidden', 'Generic sync deletions are disabled. Use explicit domain endpoints.')`. Preserved pull deletions so clients receive server-tombstoned entities.
- **Tests Verified:**
  - `backend/src/__tests__/sync-delete-authority.test.ts` (6 passed)
  - `backend/src/__tests__/sync-invariants.test.ts` (29 passed)
  - `backend/src/__tests__/sync-security.test.ts` (23 passed)
- **Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`

---

## Scope B (N-18 & N-31): Workflow & Project Multi-Tenancy Isolation

- **Problem:** Workflows allowed cross-tenant read/update/delete via missing `workspace_id` scoping in `workflow.service.ts`. Project members, tasks, and time entries lacked tenant ownership checks before mutations.
- **Fix:**
  - `backend/src/services/workflow.service.ts`: Enforced `workspace_id` filter on all lookups, updates, and deletes (`assertWorkflowOwned`). Updated `workflow.routes.ts` to scope cache keys by workspace ID.
  - `backend/src/services/project.service.ts`: Implemented `assertProjectOwned` checking `projects.workspace_id == ctx.workspaceId` before any member, task, or time entry operation, throwing `NotFoundError('Project')` to prevent tenant enumeration.
- **Tests Verified:**
  - `backend/src/__tests__/workflow-tenancy-isolation.test.ts` (6 passed)
  - `backend/src/__tests__/project-members-tenancy.test.ts` (8 passed)
- **Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`

---

## Scope C (N-20): UI Typecheck Error TS2304

- **Problem:** Missing `toIsoDay` import in `packages/ui/src/components/ui/invoices/invoice-returns-dialog.tsx` caused type-check failures across UI, app-shell, web, and desktop.
- **Fix:** Imported `toIsoDay` from `@hisabche/formatting`.
- **Typecheck Verified:**
  - `packages/ui`: `npx tsc --noEmit` -> 0 errors.
  - `packages/app-shell`: `npx tsc --noEmit` -> 0 errors.
  - `apps/web`: `npx tsc --noEmit` -> 0 errors.
  - `apps/desktop`: `npx tsc --noEmit` -> 0 errors.
- **Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`

---

## Scope D (N-17 & N-01): Sales Invoice Return Wiring & Restocking

- **Problem:** `InvoiceReturnService` queried non-existent `invoice_lines` with major unit arithmetic, lacked restocking to inventory, and lacked UI mounting.
- **Fix:**
  - `backend/src/services/sales/invoice-return.service.ts`: Reads from real `invoice_items` table, converts major currency amounts (`unit_price`, `total_price`) to minor units using `fractionDigits(currency)`, queries prior returns to prevent over-returns with `calculateReturnDocument`, and creates restocking `stock_movements`.
  - `packages/ui/src/components/ui/invoice-detail/containers/invoice-detail-container.tsx`: Mounted `InvoiceReturnsDialog`.
  - `packages/ui/src/components/ui/invoice-detail/invoice-sidebar.tsx`: Added Return action with `RotateCcw` icon.
  - Added i18n keys in `fa`, `af`, `en` in `packages/i18n/messages/{fa,af,en}/common.json`.
- **Tests & Typecheck Verified:**
  - `backend/src/__tests__/reverse-sales-return.test.ts` (4 passed)
  - `packages/ui`: `npx tsc --noEmit` -> 0 errors.
- **Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`

---

## Scope E (N-44): Sync Push Contract Repair

- **Problem:** Push endpoint schema required `deviceId` and `batchId`, but real clients (`sync-engine.ts`, `sync-runner.ts`) submitted `{mutations}` only, causing 400 errors.
- **Fix:**
  - `packages/validation/src/schemas/sync-protocol.schema.ts`: Provided reliable default generators for `deviceId` and `batchId` if omitted by legacy callers.
  - `packages/app-shell/src/features/sync/sync-engine.ts`: Explicitly provides `deviceId` and `batchId` UUID.
  - `apps/mobile/src/features/offline/sync-runner.ts`: Explicitly provides `deviceId` and `batchId` UUID.
- **Tests Verified:**
  - `packages/api/src/__tests__/sync-push-contract.test.ts` (5 passed)
- **Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`

---

## Scope F (N-36): Safe Contiguous Sync Cursor Progression

- **Problem:** Monotonic version IDs from `BIGSERIAL` can commit out of order during concurrent transactions. Advancing cursor to max version skips uncommitted lower versions.
- **Fix:** In `backend/src/services/sync.service.ts`, implemented contiguous cursor tracking with an in-flight safety horizon (10 seconds). The cursor advances over contiguous versions or gaps only after the safety window expires, preventing clients from skipping rows.
- **Tests Verified:**
  - `backend/src/__tests__/sync-cursor-concurrency.test.ts` (4 passed)
- **Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`

---

## Scope G (N-37): Tax Calculation & Ledger Policy Isolation

- **Problem:** `this.applyTax` in `backend/src/services/invoice.service.ts` was not awaited; tax return reporting needed consistency checks; ledger posting policy needed explicit accounting definition.
- **Fix:**
  - Awaited `this.applyTax(ctx, invoice.id, data)` in `invoice.service.ts`.
  - Added test validating invoice tax calculation consistency and tax return summary aggregation.
  - Formulated formal accounting ledger policy questions for the owner regarding net revenue vs tax payable posting.
- **Tests Verified:**
  - `backend/src/__tests__/tax-calculation-consistency.test.ts` (2 passed)
- **Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`

---

## Scope H (N-19): Sensitive Route Capabilities & User Notification Isolation

- **Problem:** Sensitive endpoints (warehouse config, cloud migration, offline billing) lacked required capabilities; notification `mark-read` lacked user ID filter.
- **Fix:**
  - `backend/src/routes/warehouse.routes.ts`: Added `requireCapability('inventory.configure')` on mutating endpoints.
  - `backend/src/routes/cloud-migration.routes.ts`: Added `requireCapability('data.import')` on migration job endpoints.
  - `backend/src/routes/billing.routes.ts`: Added `requireCapability('workspace.manage')` on offline license operations.
  - `backend/src/services/notification.service.ts` & `backend/src/routes/notification.routes.ts`: Scoped `markAsRead` by `userId`.
- **Tests Verified:**
  - `backend/src/__tests__/capability-elevation-guards.test.ts` (4 passed)
  - `backend/src/__tests__/developer-platform.test.ts` (84 passed)
- **Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`
