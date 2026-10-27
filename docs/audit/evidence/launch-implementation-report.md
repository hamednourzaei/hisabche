# Bounded Launch Implementation Report

Date: 2026-10-26  
Status: **IMPLEMENTED_NOT_LIVE_VERIFIED**  
Decision: **NO — DO NOT FREEZE (Ledger remains UNFROZEN until live human verification and policy sign-offs)**

---

## 1. Executive Summary

This report concludes the implementation and unit/contract verification for the bounded launch-critical scope (Scopes A through H) identified in the Gap Ledger. All targeted defects have been resolved in the application source code with zero compromises on type-checking, tenancy boundaries, or linting.

No live database DDL was executed. No Git commits, resets, or pushes were performed. Work remains in the local working tree ready for owner review.

---

## 2. Verification Measurements

All numbers reported below were directly measured from the local repository:

### A. TypeScript Typechecks (`tsc --noEmit`)

| Package / Workspace     | Command                                        | Result                |
| ----------------------- | ---------------------------------------------- | --------------------- |
| `backend`               | `cd backend && npx tsc --noEmit`               | **0 errors** (Exit 0) |
| `packages/ui`           | `cd packages/ui && npx tsc --noEmit`           | **0 errors** (Exit 0) |
| `packages/validation`   | `cd packages/validation && npx tsc --noEmit`   | **0 errors** (Exit 0) |
| `packages/api`          | `cd packages/api && npx tsc --noEmit`          | **0 errors** (Exit 0) |
| `packages/local-engine` | `cd packages/local-engine && npx tsc --noEmit` | **0 errors** (Exit 0) |
| `packages/sync`         | `cd packages/sync && npx tsc --noEmit`         | **0 errors** (Exit 0) |
| `packages/app-shell`    | `cd packages/app-shell && npx tsc --noEmit`    | **0 errors** (Exit 0) |
| `apps/web`              | `cd apps/web && npx tsc --noEmit`              | **0 errors** (Exit 0) |
| `apps/desktop`          | `cd apps/desktop && npx tsc --noEmit`          | **0 errors** (Exit 0) |
| `apps/mobile`           | `cd apps/mobile && npx tsc --noEmit`           | **0 errors** (Exit 0) |

### B. ESLint on Modified Files

| Package                 | Files Checked                                                                                                                                            | Result                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `backend`               | `src/services/sales/invoice-return.service.ts`, `src/services/sync.service.ts`, `src/services/invoice.service.ts`, `src/routes/invoice-return.routes.ts` | **0 errors**, 40 warnings (Exit 0) |
| `packages/validation`   | `src/schemas/sync-protocol.schema.ts`, `src/schemas/sync-identity.ts`, `src/schemas/offline-endpoint-matrix.ts`, `src/index.ts`                          | **0 errors**, 0 warnings (Exit 0)  |
| `packages/api`          | `src/hooks/universal-core.ts`                                                                                                                            | **0 errors**, 0 warnings (Exit 0)  |
| `packages/app-shell`    | `src/features/sync/sync-engine.ts`, `src/features/sync/sync-identity.ts`                                                                                 | **0 errors**, 0 warnings (Exit 0)  |
| `packages/local-engine` | `src/index.ts`                                                                                                                                           | **0 errors**, 0 warnings (Exit 0)  |
| `apps/mobile`           | `src/features/offline/sync-runner.ts`                                                                                                                    | **0 errors**, 0 warnings (Exit 0)  |

### C. Vitest Package Results (`vitest run`)

| Test Suite / Package         | Command                                                                          | Result                                                             |
| ---------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `backend` (unit)             | `cd backend && npx vitest run --project unit`                                    | **319 passed**, 4647 tests passed (Exit 0)                         |
| `packages/validation`        | `cd packages/validation && npx vitest run`                                       | **39 passed**, 575 tests passed (Exit 0)                           |
| `packages/ui`                | `cd packages/ui && npx vitest run`                                               | **186 passed** (1 skipped), 2449 tests passed (2 skipped) (Exit 0) |
| `packages/api`               | `cd packages/api && npx vitest run`                                              | **37 passed**, 290 tests passed (Exit 0)                           |
| `packages/local-engine`      | `cd packages/local-engine && npx vitest run`                                     | **26 passed**, 192 tests passed (Exit 0)                           |
| `packages/api` push contract | `cd packages/api && npx vitest run src/__tests__/sync-push-contract.test.ts`     | **9 passed** (Exit 0)                                              |
| `backend` tax resilience     | `cd backend && npx vitest run src/__tests__/tax-calculation-consistency.test.ts` | **3 passed** (Exit 0)                                              |
| `backend` sync concurrency   | `cd backend && npx vitest run src/__tests__/sync-cursor-concurrency.test.ts`     | **4 passed** (Exit 0)                                              |
| `backend` sales return unit  | `cd backend && npx vitest run src/__tests__/reverse-sales-return.test.ts`        | **4 passed** (Exit 0)                                              |
| `backend` unwired capability | `cd backend && npx vitest run src/__tests__/unwired-capability.test.ts`          | **6 passed** (Exit 0)                                              |
| `backend` (pg tests)         | `cd backend && npx vitest run --project pg <files>`                              | Blocked on Windows (OS error 1314). Run on Linux.                  |

---

## 3. Scope Details and Root Cause Resolutions

### Scope A (N-30): Generic Sync Delete Authority

- **Finding:** Client push mutations could issue `delete` operations without entity-level checks, deleting records across tables.
- **Resolution:** `SyncService.applyMutations` intercepts `delete` and returns `SyncError('forbidden', 'Generic sync deletions are disabled. Use explicit domain endpoints.')`. Preserved pull deletes so clients continue to receive tombstones from the server.

### Scope B (N-18 & N-31): Workflow and Project Tenancy Isolation

- **Finding:** Workflow service did not filter updates or deletes by `workspace_id`. Project members, tasks, and time entries lacked pre-mutation tenant ownership assertions.
- **Resolution:**
  - `workflow.service.ts`: All operations enforce `assertWorkflowOwned(ctx.workspaceId, id)`. `workflow.routes.ts` invalidates cache keys using `workflows:${ctx.workspaceId}:*`.
  - `project.service.ts`: Added `assertProjectOwned(ctx.workspaceId, projectId)` throwing `NotFoundError('Project')` to prevent cross-tenant enumeration.

### Scope C (N-20): UI Typecheck Error

- **Finding:** Missing `toIsoDay` import in `invoice-returns-dialog.tsx` caused TS2304 compile errors.
- **Resolution:** Added import from `@hisabche/formatting`.

### Scope D (N-17 & N-01): Sales Invoice Return Wiring & Restocking

- **Finding:** `InvoiceReturnService` referenced undefined table `invoice_lines`, ignored currency scaling, failed to restock items, and lacked UI integration.
- **Resolution:**
  - Updated service to read `invoice_items`, converting major units to minor units via currency fraction digits.
  - Calculated prior return totals per line and validated against original quantities with `calculateReturnDocument`.
  - Added inventory movement entries (`stock_movements`) when `restockChoice === 'restock'`.
  - Mounted `InvoiceReturnsDialog` in `invoice-detail-container.tsx` triggered by `RotateCcw` button in `invoice-sidebar.tsx`.
  - Added localization keys in `fa`, `af`, and `en`.

### Scope E (N-44): Sync Push Contract Repair

- **Finding:** Sync push schema mandated `deviceId` and `batchId`, but clients sent `{mutations}` only, resulting in 400 rejection.
- **Resolution:**
  - Added robust default generators in `syncPushRequestSchema`.
  - Updated both `sync-engine.ts` (app-shell) and `sync-runner.ts` (mobile) to supply valid `deviceId` and `batchId`.

### Scope F (N-36): Safe Contiguous Sync Cursor Progression

- **Finding:** Out-of-order commits on `BIGSERIAL` could cause the sync cursor to jump over in-flight transactions.
- **Resolution:** Implemented safe contiguous cursor algorithm in `sync.service.ts`. Cursors only advance over contiguous sequence blocks or gaps older than the 10-second safety horizon.

### Scope G (N-37): Tax Calculation & Ledger Policy Isolation

- **Finding:** `applyTax` was fire-and-forget; tax return reporting required consistency validation; ledger posting policy was undefined.
- **Resolution:**
  - Awaited `this.applyTax` in `invoice.service.ts` so calculation errors are surfaced.
  - Formulated owner accounting decision items below.

### Scope H (N-19): Sensitive Route Capabilities & Notification User Isolation

- **Finding:** Mutating endpoints in warehouse, cloud migration, and offline billing were not protected by capabilities; notification mark-read lacked user scoping.
- **Resolution:**
  - Added `requireCapability('inventory.configure')` on warehouse mutations.
  - Added `requireCapability('data.import')` on cloud migration endpoints.
  - Added `requireCapability('workspace.manage')` on billing offline license routes.
  - Scoped notification `markAsRead` by `request.userId`.

---

## 4. Owner Accounting & Policy Decisions Required

The code implementation is complete and verified. The following accounting and product policy questions require decision by the owner:

### 1. Tax Accounting Ledger Policy (N-37)

- **Current Behavior:** Invoices calculate tax and maintain tax return reports (`tax_returns`), but general ledger posting currently posts the full amount to Accounts Receivable (`Dr AR`) and Sales (`Cr Revenue`).
- **Owner Decision Needed:**
  1. Should sales invoices post net revenue and tax payable separately (`Dr AR [Total]`, `Cr Sales Revenue [Net]`, `Cr Tax Payable [Tax]`), and purchases post input tax to a recoverable account?
  2. From which date should this take effect, and are already-posted historical invoices re-posted or left unchanged?

### 2. Return Refund Policy (N-01 / N-17)

- **Current Behavior:** Return document creation (`invoice_return_create`) reduces customer accounts receivable (`Cr AR`) and debits sales (`Dr Sales`), restocking inventory and reversing COGS.
- **Owner Decision Needed:**
  1. Does a return give cash/bank payout back to the customer directly, or only customer credit (reducing receivables / generating a customer credit note)? (Current implementation: customer credit only).

### 3. Seller Capability Boundaries

- **Current Behavior:** Roles map to specific granular capabilities in `@hisabche/validation`.
- **Owner Decision Needed:**
  1. What may a seller role do: may sellers create products/warehouses, record cycle counts, create purchase orders, or touch payroll?
