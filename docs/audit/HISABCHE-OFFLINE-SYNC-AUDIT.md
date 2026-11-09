# Hisabche — Offline and Sync Audit

Audit date 2026-11-08, commit `b546d5df`. Read-only. Local tests run this session: `packages/local-engine` vitest 73 files / 513 tests, exit 0. No device, emulator or two-device scenario was run → nothing here is VERIFIED_COMPLETE.

## 1. Architecture (FACT)

| Piece                     | Location                                                                                                                                                                                            | Notes                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Local API engine          | `packages/local-engine/src/router.ts`, 50 route modules in `src/routes/`                                                                                                                            | answers the same paths as the server on the device   |
| Local SQLite schema       | `packages/app-bridge/src/local-schema.ts`, `local-sales-schema.ts`, `local-books-schema.ts`, `local-universal-core-schema.ts`, migrations `local-migrations.ts`                                     | 62 distinct `CREATE TABLE IF NOT EXISTS` names       |
| Windows host              | `apps/desktop/electron/main/db/database.ts`, `services/local-api.ts`, IPC `ipc/register.ts`                                                                                                         | better-sqlite3                                       |
| Android host              | `apps/mobile/src/host/local-db.ts`, `local-api.ts`, `migrate-legacy-outbox.ts`                                                                                                                      | WebView RPC `packages/app-bridge/src/webview-rpc.ts` |
| Outbox                    | `sync_queue` table `packages/app-bridge/src/local-schema.ts:680-696` (client_id, entity, operation, payload, attempts, status, last_error, **user_id, workspace_id**)                               | NULL owner = never sent on a guess (`:689-693`)      |
| Routing                   | `packages/app-bridge/src/push-routing.ts:39-44` — `invoice`, `invoice_item`, `transaction`, `inventory_movement` + money fields (`:52+`) go to domain routes; descriptive edits to `/api/sync/push` |                                                      |
| Sync engine               | `packages/app-shell/src/features/sync/sync-engine.ts` (`/sync/push` at `:992`), `outbox-stage.ts:29-37` (rejected/exhausted → needs a person)                                                       |                                                      |
| Server push               | `backend/src/routes/sync.routes.ts:108` → `backend/src/services/sync.service.ts`                                                                                                                    |                                                      |
| Server stream             | `backend/src/routes/sync-stream.routes.ts:68`, client `packages/sync/src/stream-client.ts`                                                                                                          |                                                      |
| Conflicts                 | `backend/src/routes/conflict.routes.ts` (`/api/conflicts`, resolve at `:99-101`); UI `data-and-sync?tab=details&view=conflicts`                                                                     |                                                      |
| Offline capability matrix | `packages/validation/src/schemas/offline-endpoint-matrix.ts` — literal counts: `available` 196, `online_required` 322, `not_supported` 18 (each includes one type literal)                          | ≈195 endpoints run on device                         |

## 2. Financial overwrite protections (FACT)

1. Generic push can write only allow-listed descriptive columns: invoice `id, notes, reference, due_date`; transaction `id, notes`; warehouse/branch/exchange_rate/product_stock **none** (`services/sync.service.ts:132-160`).
2. Deposit entities are refused on the generic road (`:462-466,684`).
3. Optimistic concurrency for 11 versioned entities (`:101-115`); stale version → `version_conflict` filed, not overwritten (`:754,792`).
4. Per-mutation capability check (`:673`).
5. Offline invoices get a temporary `OFF-<device>-<seq>` id; the official number comes from server `nextval` on commit (`packages/local-engine/src/routes/invoices.ts:559-575`; server `services/invoice.service.ts:4143`).
6. Period-lock check on device before saving (`invoices.ts:557`).

## 3. Risks and gaps

| ID   | Severity           | Evidence                                                                    | Observation                                                                                                                                                                                                                                                       |
| ---- | ------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-01 | Medium             | `services/sync.service.ts:95-99,148`                                        | `transaction` has no version column; its `notes` updates are last-write-wins. Money columns are not writable, so the loss is limited to notes.                                                                                                                    |
| S-02 | Medium (INFERENCE) | `packages/local-engine/src/routes/invoices.ts:573-575`                      | The local engine accepts a caller-supplied `invoiceNumber` before falling back to the temporary id. If any client path passes a number, the device shows a number the server never issued. Not traced further.                                                    |
| S-03 | Medium             | `backend/src/middleware/workspace.middleware.ts:117` + `sync.routes.ts:110` | After subscription expiry `/api/sync/push` is a write behind the 402 lock; queued offline sales stay on the device until renewal. Correct for billing, but the device must surface it (not verified).                                                             |
| S-04 | Medium             | `services/invoice.service.ts:1322-1398`                                     | Domain replay of an offline invoice runs the same non-atomic chain (write → tax → costing → ledger). A ledger failure returns 500 after stock moved; the device will retry with the same idempotency key. Recovery route exists (`routes/invoice.routes.ts:322`). |
| S-05 | Low                | `scripts/check-schema-drift.mjs` cannot see local schema                    | Local SQLite vs server column drift is guarded only by tests such as `apps/mobile/src/host/__tests__/android-parity.test.ts`, `order-deposit-parity.test.ts`; no generated diff exists.                                                                           |
| S-06 | Info               | brief                                                                       | Android release build and `*.pg.test.ts` cannot run on this machine → no end-to-end offline→online proof was possible. BLOCKED_EXTERNAL.                                                                                                                          |

## 4. Status

Offline engine + outbox + routing: IMPLEMENTED_NOT_LIVE_VERIFIED. Two-device conflict and replay after expiry: NOT verified (no harness run).

## 5. Recommendations

1. Run the mobile `sync-scenarios.test.ts` and desktop jest suites in CI on every PR (desktop is excluded from CI `test` at `.github/workflows/ci.yml:37`).
2. Add a version column to `transactions` or drop `notes` from the generic road.
3. Remove the caller-supplied invoice number branch on device unless a documented caller needs it.
