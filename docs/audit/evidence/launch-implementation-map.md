# Hisabche Launch Implementation Map (Scopes A–H)

Date: 2026-10-26T21:07:00+01:00

## Scope A — N-30: Remove Unsafe Generic Sync Deletion

- **Files & Symbols**:
  - `backend/src/routes/sync.routes.ts`: `POST /api/sync/push`
  - `backend/src/services/sync.service.ts`: `SyncService.push`, `SyncService.execute` (:501-512)
  - `packages/validation/src/schemas/sync-protocol.schema.ts`: `syncOperationSchema`, `syncMutationSchema`
- **Authorization & Isolation**:
  - `authenticate`, `requireWorkspaceContext`
  - Deletion via generic sync must be rejected with stable error code `forbidden`.
- **Database & Entities**:
  - Tables: `invoices`, `customers`, `products`, `warehouses`, `transactions`, `time_entries`, etc.
  - `sync_mutations` records rejection idempotently.
- **Tests**:
  - `backend/src/__tests__/sync-delete-authority.test.ts` (6 tests: finalized invoice, customer/product with stock, seller token, cross-tenant, ledger/movements/balances/change_log untouched, idempotency).
  - `backend/src/__tests__/sync-invariants.test.ts` (:641-658 updated).

---

## Scope B — N-18 & N-31: Enforce Workspace Isolation

- **Files & Symbols**:
  - Workflows: `backend/src/routes/workflow.routes.ts`, `backend/src/services/workflow.service.ts` (`getWorkflow`, `updateWorkflow`, `deleteWorkflow`, `startWorkflow`, `getInstance`, `performAction`).
  - Project Members: `backend/src/routes/project.routes.ts`, `backend/src/services/project.service.ts` (`listMembers`, `addMember`, `removeMember`).
- **Authorization & Isolation**:
  - Workspace derived exclusively from `request.tenancy.workspaceId`.
  - Workflows query filtered by `.eq('id', id).eq('workspace_id', workspaceId)`.
  - Project members checked via parent project: `projects` filtered by `.eq('id', projectId).eq('workspace_id', workspaceId)`.
  - Foreign workspace resources return 404 (never 403, preventing existence leaks).
  - Cache keys scoped: `workflow:${workspaceId}:${id}`, `workflow:instance:${workspaceId}:${id}`.
  - Cache invalidation scoped to caller's workspace.
- **Tests**:
  - `backend/src/__tests__/workflow-tenancy-isolation.test.ts`
  - `backend/src/__tests__/project-members-tenancy.test.ts`

---

## Scope C — N-20: Fix Confirmed Typecheck Error

- **Files & Symbols**:
  - `packages/ui/src/components/ui/invoices/invoice-returns-dialog.tsx`: line 44.
  - Export: `toIsoDay` from `@hisabche/formatting` (`packages/formatting/src/dates.ts:111`).
- **Fix**:
  - Add `import { toIsoDay } from '@hisabche/formatting'`.
- **Verification**:
  - `cd packages/ui && npx tsc --noEmit` -> 0 errors.
  - `cd packages/app-shell && npx tsc --noEmit` -> 0 errors.
  - `cd apps/web && npx tsc --noEmit` -> 0 errors.
  - `cd apps/desktop && npx tsc --noEmit` -> 0 errors.
  - `cd apps/admin && npx tsc --noEmit` -> 0 errors.

---

## Scope D — N-17 & N-01: Complete Invoice Returns End-to-End

- **Files & Symbols**:
  - Route: `backend/src/routes/invoice-return.routes.ts` (`POST /api/invoices/:id/returns`).
  - Service: `backend/src/services/sales/invoice-return.service.ts`.
  - Domain math: `packages/validation/src/schemas/returns.domain.ts` (`calculateReturnDocument`, `ReturnReason`).
  - Table: `invoice_items` (real table with `quantity`, `unit_price` major, `discount`, `total_price`), `invoice_returns`, `invoice_return_lines`.
  - Offline engine: `packages/local-engine/src/routes/invoice-returns.ts`.
  - UI Component: `packages/ui/src/components/ui/invoices/invoice-returns-dialog.tsx` mounted in `packages/ui/src/components/ui/invoice-detail/containers/invoice-detail-container.tsx`.
- **Accounting & Inventory Reversal**:
  - Reverses sales revenue and tax proportionally based on returned items.
  - Restocks inventory at original cost into the specified warehouse if `restockChoice === 'restock'`.
  - Scrapped items reverse revenue without restoring warehouse stock.
  - Idempotency key per return (`returnNumber` + `invoiceId`).
- **Translation**:
  - Locale keys added in `packages/i18n/messages/{fa,af,en}/common.json`.
- **Tests**:
  - `backend/src/__tests__/reverse-sales-return.test.ts`.

---

## Scope E — N-44: Repair Sync Push Contract Across Clients

- **Files & Symbols**:
  - `packages/validation/src/schemas/sync-protocol.schema.ts`: `syncPushRequestSchema`.
  - Senders: `packages/app-shell/src/features/sync/sync-engine.ts`, `apps/mobile/src/features/offline/sync-runner.ts`, `packages/api/src/lib/offline-queue.ts`.
- **Fix**:
  - Ensure client push senders reliably include stable `deviceId` and `batchId` (generated once per batch attempt, stable across retries).
  - Schema supports graceful fallback if client omitted them.
- **Tests**:
  - `packages/api/src/__tests__/sync-push-contract.test.ts`.

---

## Scope F — N-36: Guarantee Sync Cursor Correctness

- **Files & Symbols**:
  - `backend/src/services/sync.service.ts`: `pull`.
  - Database table: `sync_change_log`.
- **Fix**:
  - Protect against concurrent transactions committing out-of-sequence by applying a bounded lookback horizon or safe transaction isolation so uncommitted changes are not missed by a cursor jump.
- **Tests**:
  - `backend/src/__tests__/sync-cursor-concurrency.test.ts`.

---

## Scope G — N-37: Fix Tax Calculation Reliability and Posting Policy

- **Files & Symbols**:
  - `backend/src/services/tax/tax.domain.ts`.
  - `backend/src/services/invoice.service.ts`.
- **Fix**:
  - Tax calculation is reliably awaited; failure surfaces appropriately.
  - Header totals, discounts, and tax line amounts remain strictly consistent.
  - Isolate accounting posting policy question for owner decision.
- **Tests**:
  - `backend/src/__tests__/tax-calculation-consistency.test.ts`.

---

## Scope H — N-19: Close Confirmed Authorization Gaps

- **Files & Symbols**:
  - `backend/src/routes/warehouse.routes.ts`: enforce `warehouse.write` on create/update/delete.
  - `backend/src/routes/migration.routes.ts`: enforce `system.configure` or owner role on cloud migration.
  - `backend/src/routes/notification.routes.ts`: mark-as-read strictly scoped to authenticated `userId`.
- **Tests**:
  - `backend/src/__tests__/capability-elevation-guards.test.ts`.
