# GATE-08 — Sync audit

Status: **PASS for the audit (trace complete, defects recorded)**; behaviour was **not executed** (no database; the Postgres tests cannot start here, see GATE-04). Every statement below is from reading code or tests.

## 1. Two editions, one engine

|                                          | Offline edition                                                                 | Cloud edition                                                                                                                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source of truth                          | the device SQLite database (`packages/local-engine`)                            | Postgres (Supabase)                                                                                                                                                                                                           |
| Cloud peer                               | none (`client.ts`: "there is no server to sync to")                             | yes                                                                                                                                                                                                                           |
| Writes while offline                     | every `available` matrix row runs on the engine                                 | **invoice creation only**: `localRequest` writes invoice, lines, stock, party balance and an outbox row in one SQLite transaction (`routes/invoices.ts:480-`, header `x-hisabche-queue`); every other write needs the network |
| Moving offline-edition data to the cloud | one-time migration (`cloud-migration` + `local-engine/src/export`, 18 sections) | —                                                                                                                                                                                                                             |

N-13 of the first audit ("generic request queue for new entities") stays **rejected**: the new tables belong to the offline edition only and have no sync path (N-16).

## 2. The trace

| Stage                | Mechanism                                                                                                                                                                                                                 | Evidence                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Local write          | engine route inside a SQLite transaction                                                                                                                                                                                  | `local-engine/src/routes/*.ts`; `offline-invoice-outbox.test.ts`                  |
| Outbox               | desktop `sync_queue` table / mobile outbox; row = clientId, entity, operation, payload, attempts, status; owner-stamped (`outbox-owner.ts`)                                                                               | `sync-engine.ts` header and `QueueEntry`                                          |
| Push route           | `routeFor` decides by financial effect: financial entities, every create and every delete go to the **domain** route (`POST /invoices` etc.); only descriptive updates of known entities go to `/sync/push` ("versioned") | `app-bridge/src/push-routing.ts:89-115`                                           |
| Push idempotency     | domain road: `Idempotency-Key = clientId`; sync road: `mutation_id` primary key in `sync_mutations`, replay returns the recorded outcome                                                                                  | `sync.service.ts:395-410, 443-465`                                                |
| Retries              | `MAX_ATTEMPTS = 5` on the client; server error codes carry `retryable`; retryable failures are not recorded so the retry can succeed                                                                                      | `sync-engine.ts`; `sync.service.ts:420-445`                                       |
| Server write         | closed set of 9 entities, allow-listed columns, financial fields refused with `FINANCIAL_FIELD_NOT_WRITABLE`                                                                                                              | `sync.service.ts:59-146, 322-360`                                                 |
| Versioning           | trigger `sync_bump_version` increments `version` on invoices, customers, products; client sends `expectedVersion` (optional)                                                                                              | `docs/sync-engine-migration.sql:157-275`                                          |
| Change log           | trigger writes `sync_change_log` in the same transaction as the row; `sync_version` is `BIGSERIAL`                                                                                                                        | `sync-engine-migration.sql:99-215`                                                |
| Pull                 | `WHERE sync_version > cursor ORDER BY sync_version LIMIT n+1`; `mustRehydrate` when the cursor is behind the pruned horizon; snapshot endpoint walks ids                                                                  | `sync.service.ts:~690-860`                                                        |
| Echo skip            | `origin_device` excluded on pull; cursor still advances                                                                                                                                                                   | `sync.service.ts pull`                                                            |
| Deletes              | log entry operation `delete`, data `null`; client removes by id                                                                                                                                                           | `sync-invariants.test.ts:640-660`                                                 |
| Local reconciliation | `FROM_LOG[entity]` mapping; `upsertMany` / `removeMany`                                                                                                                                                                   | `sync-engine.ts:376-480`                                                          |
| Conflicts            | stale `expectedVersion` → refusal + `conflicts.record` (both versions kept); non-financial fields auto-merge; financial → review; resolution needs `ledger.reverse` (owner) and is audited with reason and actor          | `conflict.domain.ts`, `conflict.service.ts:437-480`, `conflict.routes.ts:100-103` |
| Wake-up              | WebSocket stream carries no data                                                                                                                                                                                          | `sync-stream.routes.ts`                                                           |

## 3. Questions in the protocol

| Question                        | Answer                                                                                                   | Basis                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Idempotency                     | **Yes**, two independent mechanisms                                                                      | above                                  |
| Retries                         | **Yes**, bounded; permanent 4xx not retried                                                              | `isPermanent` in `sync-engine.ts`      |
| Ordering                        | per-device FIFO outbox; server orders pull by `sync_version`. **Commit-order hazard** (N-36)             | below                                  |
| Duplicate prevention            | **Yes** (`mutation_id` PK; `23505` treated as already applied)                                           | `sync.service.ts:530`                  |
| Versioning                      | **Yes**, but the check is not atomic (N-35)                                                              | below                                  |
| Conflicts / resolution          | **Yes**: both versions preserved; financial divergence never auto-resolved; authorised, audited decision | `conflict.domain.ts` header            |
| Deletes                         | **Raw delete through `/sync/push`** with only a workspace check (N-30)                                   | below                                  |
| Financial aggregates            | invoices/payments are not written through the row road; they go through domain routes                    | `WRITABLE` and `push-routing.ts`       |
| Recovery                        | `mustRehydrate` full snapshot; failed conflict filing is swallowed on purpose                            | `sync.service.ts`                      |
| Offline-created invoice         | engine write + outbox in one transaction; pushed to `POST /invoices` with the same Idempotency-Key       | `routes/invoices.ts`, `sync-engine.ts` |
| Offline payment (cloud edition) | **not queued**: needs the network                                                                        | `offline-queue.ts` types               |
| Inventory movement offline      | offline edition only; stock changes are inside the invoice transaction in the cloud edition              |                                        |
| Customers, products             | descriptive updates via versioned road; create via domain route                                          | `push-routing.ts`                      |
| Warehouses                      | read-only for devices (`WRITABLE.warehouse = []`) — except delete (N-30)                                 | `sync.service.ts:129-134, 503-512`     |
| Returns                         | no sync path (N-16); and the return itself has no effect (N-01)                                          |                                        |

## 4. Defects found in this gate

**N-30 — `POST /api/sync/push` with `operation: 'delete'` deletes rows of any of the 9 entities with only a workspace check.** `SyncService.execute` handles `delete` before `pickWritable`; `assertOwned` checks the workspace; there is no per-entity authorization, no finalized-invoice test (that exists only on the update path, `sync.service.ts:547`), no ledger reversal, no stock return. The repository's own test `sync-invariants.test.ts:640-660` pushes an invoice delete and expects it to be applied and to appear in the change log; I found no trigger in `docs/*.sql` that blocks deleting an invoice, customer, product, warehouse, branch, exchange rate or stock row. The desktop client never sends such a delete (it routes deletes to the domain), so this is reachable by a direct HTTP call from any workspace member (including a seller; `invoice.delete` is owner-only in the REST path). Priority P0, class SECURITY/ACCOUNTING. Basis: code and an existing test; **not** executed against a database.

**N-35 — optimistic concurrency is checked, then written, in two statements.** `execute` reads the row, compares `expectedVersion`, then `UPDATE … WHERE id AND workspace_id` — the version is not in the WHERE clause. The bump trigger increments the version but does not check the old one. Two concurrent pushes with the same expected version both pass. Limited to allow-listed descriptive columns. P2.

**N-36 — pull cursor and commit order.** `sync_version` is `BIGSERIAL` taken when the log row is inserted, and a client advances its cursor to the highest value it read. A transaction that took a lower value but commits later than one that took a higher value is skipped by every client that already advanced past it, until a full rehydrate. The migration comment calls the value "gapless-enough"; I found no safe-horizon or in-flight guard (`rg horizon|xmin|snapshot` in the service). Probability depends on concurrent writers in one workspace; never reproduced here. P1 (silent data loss class), SYNC.

**N-38 — conflict resolution writes the resolved row straight to the table.** `writeBack` updates all keys except five, for entities including `invoice`, `payment`, `journal_entry`, `product` (quantity, prices), with no movement, no ledger repost. Reachable only through an owner's manual resolution of an open conflict; conflict sources enumerated: stale sync write (descriptive fields) and `recordStockBreach` from invoice creation. P2.

N-16 (new offline-edition tables have no path to the cloud) stands.

## 5. Tests that exist (not executed against a database in this audit; unit-level ones passed in the backend suite)

`sync-invariants`, `sync-security`, `sync-writable-is-descriptive`, `sync-pull-columns`, `sync-binary-http`, `sync-stream`, `sync-overview`, `conflict-auto-merge`, `offline-conflict-rules`, `offline-pos-conflict`, `offline-invoice-sync`, `offline-invoice-gap`, `offline-contract`, `sync-conflicts-forward.pg`, `offline-invoice-outbox` (engine). They use fake tables; the single `*.pg` sync test could not run.

## 6. Not done

No two-device or crash-recovery run; no check of the mobile outbox implementation (React Native) beyond the shared contract; no read of `conflict.service.ts` lines outside `resolve` and `record`.
