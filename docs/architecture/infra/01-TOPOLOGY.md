# 01 — Runtime Topology & Connection Architecture

## Process Roles (`backend/src/runtime/role.ts`)

| Role     | Entrypoint                            | Responsibilities                                                                        | Horizontal Scaling                                    |
| -------- | ------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `api`    | `backend/src/runtime/start-api.ts`    | Fastify HTTP server, auth, tenancy, read/write endpoints, `/ready`, `/metrics`          | Safe (`numInstances >= 2`)                            |
| `worker` | `backend/src/runtime/start-worker.ts` | Background jobs, scheduled reports, accrual reversals, outbox dispatch, sandbox restore | Single active leader via Postgres job/advisory claims |
| `all`    | `backend/src/index.ts` (dev/default)  | Combined API + background timers for single-node / local dev                            | Single instance only                                  |

## Database Endpoints (`backend/src/db/`)

1. **`primary.ts`**: Read-write Supabase/Postgres client used for all mutations and read-after-write consistency.
2. **`replica.ts`**: Optional read-only replica (`DATABASE_REPLICA_URL`). Only used for heavy analytical reads (`routing.ts`) when `replicaLagMs <= REPLICA_MAX_LAG_MS`.
3. **`admin.ts`**: Direct/session Postgres connection (`DATABASE_DIRECT_URL` / port `5432`) for migrations, `pg_advisory_lock`, and maintenance tasks. Never used by hot HTTP paths.
4. **`routing.ts`**: Decides `primary` vs `replica` per query intent and monitors replica lag; automatically falls back to `primary` on lag or error.

## Pooler Safety Rules

- Transaction pooler connections (`prepare: false`) must NEVER hold session-level state (`SET LOCAL` only inside a transaction, never `SET`, no `LISTEN/NOTIFY`, no session `pg_advisory_lock`).
- Worker leader election uses explicit session/direct connections or row-level Postgres `FOR UPDATE SKIP LOCKED` job claims (`ADR-0002`).
- Statement and lock timeouts are enforced at the role level (`docs/role-timeouts-01-migration.sql`).

## Graceful Shutdown (`backend/src/runtime/shutdown.ts`)

On `SIGTERM` / `SIGINT`:

1. Mark `/ready` as `503` (drain load balancer).
2. Stop accepting new HTTP requests (`server.close()`).
3. Wait up to `SHUTDOWN_GRACE_MS` (default 15,000 ms) for inflight requests and active DB transactions.
4. Close DB pools and exit `0`.
