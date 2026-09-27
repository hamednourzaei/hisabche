# Hisabche — Offline & Sync

> Rewritten 27 Sep 2026 (request #153). The previous version described a push
> that took a table name and a WatermelonDB layer on web/mobile; neither exists.
> This file describes the code as it is. Guards named here fail if it drifts.

## 0. The one rule

**PostgreSQL is the source of truth. Everything else is a copy or a signal.**
A device reads from its local copy and writes through an outbox; the server
decides. A WebSocket only says _when_ to look — never _what_ is true.

## 1. Where data lives on each platform

| Platform           | Local store                                                                                           | Sync                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Windows (Electron) | SQLite (better-sqlite3) in the main process, reached over IPC (`@hisabche/app-bridge` contract)       | pull by change-log cursor + push from `sync_queue` — `packages/app-shell/src/features/sync/sync-engine.ts` |
| Android (Expo)     | SQLite (expo-sqlite) in the native host, same contract and same schema (`app-bridge/local-schema.ts`) | push from the same queue shape — `apps/mobile/src/features/offline/sync-runner.ts` (no pull yet)           |
| Web                | none (persisted React Query cache only)                                                               | online only; a write without network fails there                                                           |

`packages/sync` is the shared **protocol** layer: the binary codec
(`@hisabche/sync/wire`) and the wake-up client (`@hisabche/sync/stream`).
`packages/db` / `packages/offline` (WatermelonDB) were never imported by any app
and were deleted.

## 2. Reading: the change log

Every write to `products`, `customers`, `invoices`, `transactions`,
`time_entries` is recorded by a database trigger into `sync_change_log`
(`workspace_id`, monotonic `sync_version`, entity, operation, version) **in the
same transaction** (`docs/sync-engine-migration.sql`). That includes writes made
through the domain routes (an invoice issued on the web), not only sync pushes.

| Endpoint                                           | Purpose                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET /api/sync/cursor`                             | the workspace head                                                                               |
| `GET /api/sync/pull?cursor=N&limit=L`              | changes after N, in order, with the row data (lean columns: `PULL_COLUMNS` in `sync.service.ts`) |
| `GET /api/sync/snapshot?entity=E&after=ID&limit=L` | a full rebuild, keyset by id, **with `version`**                                                 |
| `WS /api/sync/stream`                              | wake-up only: `CURSOR {cursor}` when the head moves                                              |

Invariants (tests: `sync-invariants.test.ts`, `sync-pull.test.ts`):

- The client advances its cursor **only after** a page is committed locally.
- A failed database read is an **error** (HTTP 500), never an empty page and
  never `data: null` (which clients read as a delete). P0, 27 Sep 2026.
- `mustRehydrate` when the cursor has fallen off the pruned log → snapshot.
- A rebuild reads the head **before** walking the snapshot, so a change made
  during it is pulled again, not missed; a failed page records no cursor.
- Desktop stores `version` from every row; an offline edit sends it back as
  `expectedVersion`. (Before the snapshot endpoint, rows came from REST lists
  without a version and every offline edit conflicted.)

## 3. Writing: the outbox

- Each queued write has a `clientId` generated once and resent unchanged.
- **Money goes through the domain routes** (`/api/invoices`, `/api/transactions`,
  …) with `Idempotency-Key: clientId`; `routeFor` (`app-bridge/push-routing.ts`)
  sends only descriptive edits (a customer's phone) to `POST /api/sync/push`,
  whose `WRITABLE` allow-list refuses financial fields.
- **Order**: an entry that refers to the id of a create still in the queue waits
  for it (`app-bridge/push-order.ts`) — a failed customer create keeps its
  invoice _waiting_, not permanently failed.
- A retryable failure (network, 5xx, 408, 429) stays queued; a permanent 4xx is
  marked failed and shown on the sync page for the person to resolve.
- "Done" means the server **committed** it: the domain routes answer after the
  database transaction, never before.

## 4. Wire format: Hisabche Sync Binary (HSB)

`Content-Type` / `Accept: application/x-hisabche-sync`. JSON stays the default;
a client opts in. Frame: `'H' 'S' version opcode u32LE-length body`. Values:
tagged, little-endian, varint integers, UUIDs as 16 bytes, and a per-frame
string table (each key and repeated value is spelled once). The pull page is
positional (TL-style): `[nextCursor, flags, [[syncVersion, type, id, op, version, data]…]]`.

Measured on a 500-row page (`packages/sync/src/__tests__/wire-codec.test.ts`):

|                                      | JSON    | HSB            |
| ------------------------------------ | ------- | -------------- |
| raw                                  | 232 KB  | 71 KB (−69%)   |
| gzip                                 | 15.7 KB | 13.8 KB (−12%) |
| brotli q4                            | 14.9 KB | 13.1 KB (−12%) |
| CPU per round-trip, with compression | ~4.3 ms | ~6.0 ms        |

Honest reading: on the wire, after compression, HSB saves ~12%; raw it saves
69% (memory, and uncompressed WebSocket frames). JS encoding costs more CPU than
V8's native JSON. Responses are compressed with brotli (quality 4) or gzip.

## 5. Concurrency

`backend/src/utils/concurrency-safety-map.ts` lists every money/stock route and
what protects it (idempotency key, one Postgres function, conditional update,
unique index, lease), with evidence the guard test checks. Known gaps are
written there, not hidden.

## 6. Not done yet

- Android pulls nothing (push only); it would use the same snapshot + pull.
- Invoice line items are not mirrored on the device (the header is).
- `sync_change_log` on production: confirm with
  `select to_regclass('public.sync_change_log');` — if NULL, desktop takes a
  snapshot on every sync (correct, slower).
