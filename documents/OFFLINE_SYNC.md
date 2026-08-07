# Hisabche — Offline & Sync

> Offline-first is the core product promise. Every platform writes to a
> local store first and reconciles with the cloud when connectivity allows.

## Data Flow (device → server)

```
User creates invoice
        │
        ▼
Local store (SQLite / WatermelonDb)
        │  writes are immediate, app usable offline
        ▼
sync_queue (pending rows)
        │  worker drains when online
        ▼
POST /api/sync/push   (create / update / delete per user+workspace)
        │
        ▼
Server (Postgres)     ── conflict resolver ──►  resolved
        │
        ▼
GET /api/sync/pull    (incremental, since sync_cursor)
        ▼
Local store           (authoritative pull overwrites local copy)
```

## 1. Local Databases

### Desktop — SQLite (better-sqlite3), main process

`apps/desktop/electron/main/db/schema.ts` (`SCHEMA_VERSION = 1`).

Tables: `product, customer, invoice, invoice_item, transaction,
inventory_movement, employee` + `sync_queue, sync_cursor, meta`.

Every data table carries:

- `updated_at` — cursor for incremental pull.
- `dirty` (0/1) — 1 while a local change is still queued for push.

Sync markers: `sync_cursor(entity, last_pulled_at)` and
`meta(key, value)`.

### Web / Mobile — WatermelonDb

`packages/db/src/` — `SQLiteAdapter({ jsi: true })`, models
`Invoice, Product, Customer` (`models/`), schema in `schema/`.
`performSync()` = `syncDatabase(database)` (push + pull).
Web entry: `packages/offline/database.web.ts`.

## 2. Sync Queue

### Web — server-persisted queue (`packages/db/src/sync-queue.ts`)

Items written to Supabase `sync_queue` table:

```
{ id, userId, entityType, entityId?, action: create|update|delete,
  payload, status: pending|processing|completed|failed,
  priority (0–10, default 5), retryCount, maxRetries (default 3),
  errorMessage?, createdAt, processedAt? }
```

`SyncQueue` drains in batches of 10; mirrors state to `@hisabche/store`
sync slice (`addPending`, `setSyncing`, `setLastSynced`);
UI: web `/sync-center`.

### Desktop — local queue + IPC

- `db:enqueue` pushes a local row/op into `sync_queue` (with `attempts`,
  `status`, `last_error`).
- Worker resolves the queue (`db:resolveQueue`) when online,
  `db:query` for reads, `db:upsertMany` for pulls.
- Queue indexed by `(status, created_at)`.

## 3. Pull / Push Protocol

### Push (`POST /api/sync/push`)

- Receives a batch of queue items (create/update/delete) for
  `{ userId, workspaceId }`.
- Applies each op to the server tables; deletes remove rows by id + `user_id`.
- Returns per-item status so the client can mark rows complete/failed.

### Pull (`GET /api/sync/pull`)

- `?table=product&since=<ISO>` → rows with `updated_at > since`
  for that user/workspace.
- Client stores `last_pulled_at` per entity in `sync_cursor`.
- On the desktop, a pulled row **overwrites its local copy verbatim**
  (server ids stay the primary key locally).

## 4. Conflict Handling

### Required strategy (accounting-grade: server authoritative for money)

For an accounting system, **client_wins is wrong** for financial records:
a stale offline client could overwrite server-confirmed totals (Debt,
stock, invoice amounts). Therefore default resolution by **record class**:

| Record class                                                                    | Default rule    | Why                                                                                                  |
| ------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| **Financial / final** (invoice, completed payment, transaction, stock movement) | **SERVER_WINS** | server is source of truth once a record is confirmed; never let a stale client overwrite money/stock |
| **Draft / working** (draft invoice, unsaved cart, customer edit-in-progress)    | **CLIENT_WINS** | the client's newest local edit wins; harmless pre-commit edits                                       |

- `syncConfigSchema.conflictStrategy` still permits
  `client_wins | server_wins | last_write_wins | manual` — but the
  **project default must be `server_wins` for financial entities**, and the
  web `SyncQueue` default of `client_wins` is a **known gap** to be migrated
  (documented in AI_RULES.md — this is not optional for ledger tables).
- Because server ids are reused locally, the pull path is idempotent
  (server copy replaces local, a single id per row).
- Desktop dirty flag prevents a pulled overwrite from clobbering a
  _pending_ local change: **dirty rows must be pushed before** a competing
  pull for the same id is applied. On conflict between a dirty local write
  and the incoming server row:
  - if the record is **financial/final** → server row wins (discard/flag the
    local push, log conflict for manual review);
  - if **draft** → keep local, re-enqueue.
- Queue retries with `attempts`/`retryCount`; permanent-failed items keep
  `last_error` for manual resolution (no automatic merge beyond
  override).

## 5. Retry Strategy

| Param               | Default (schema)                                  | Note                                |
| ------------------- | ------------------------------------------------- | ----------------------------------- |
| `maxRetries`        | 3                                                 | `retryCount` increments per attempt |
| `batchSize`         | 10                                                | items per push round                |
| `syncIntervalMs`    | 30000                                             | min 5000; poll time                 |
| `syncOnWifiOnly`    | false                                             | bandwidth guard                     |
| `syncOnBatteryOnly` | false                                             | power guard                         |
| `autoSync`          | true                                              | toggle                              |
| `conflictStrategy`  | `server_wins` (financial) / `client_wins` (draft) | see §4                              |

Web `SyncQueue` uses `maxRetries = 3`, batch 10. Stuck "processing" rows
are re-queued on restart (in-progress items flagged failed).

## 6. Event / Realtime

- **Passive**: `@hisabche/api` supabase realtime
  (`packages/api/src/supabase/realtime.ts`) pushes changes to open clients.
- **Web hooks**: `useRealtime`, `useRealtimeActivities`,
  `useOfflineActivities`.
- **Desktop**: no websocket realtime — refresh/pull-only. Realtime is a
  web/mobile nicety.

## 7. Conflict Resolving Open Issues

- **Dependency ordering**: creates referencing another pending create
  (invoice → items) need the parent id first; the queue must keep
  dependencies visible (not just status).
- **Dirty pull clobber:** edge case risk when id conflict; current rule is
  push-dirty-then-pull.

## better-sqlite3 native rebuild

`better-sqlite3` is a native module; on Windows desktop builds use
`electron-builder install-app-deps` to rebuild for Electron's Node ABI
(see RELEASE_PROCESS.md).

## Not Guaranteed By Repo

- Real server-side **conflict merge** for the record-class model above is
  **not implemented**. Current code is largely override/`client_wins`; the
  server-authoritative rule is the _target_ contract — implement it in the
  sync engine + per-route domain checks, not silently skip.
- Semantic domain conflicts (e.g. two sales decrementing the same stock)
  are not data-layer resolved; they must be handled at the domain layer per
  route.
- WatermelonDb pull/push hookups for all entity types: web/mobile models
  cover Invoice, Product, Customer only; other entities are server-direct.
