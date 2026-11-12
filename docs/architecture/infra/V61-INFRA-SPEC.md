# V61 Survivable Infrastructure Specification

**The availability promise is: the business never stops (L0), the server degrades predictably (L1→L2), and no money is ever written twice or lost (idempotency + one writer).**

---

## 1. Goals (L0–L3 Availability Model)

| Layer                        | Condition                       | Guaranteed Behaviour                                                                                                                                         | Code Anchor                                                                                                                   |
| ---------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **L0 — Device**              | 90–100% servers/DB unreachable  | Sales, purchases, payments, printing, stock counts, local reports continue on Windows/Android SQLite + outbox                                                | `packages/local-engine`, `packages/app-bridge/src/local-migrations.ts`, `packages/app-shell/src/features/sync/sync-engine.ts` |
| **L1 — Surviving API nodes** | Partial API node loss           | Stateless Fastify nodes drain on `SIGTERM`, `/ready` drops unhealthy nodes behind LB                                                                         | `backend/src/index.ts`, `backend/src/runtime/`                                                                                |
| **L2 — Surviving Database**  | Writer survives or replica-only | With quorum: full R/W; without writer: `serviceMode = read_only` (writes return `503 SERVICE_READ_ONLY`, reads route to replica, clients queue to L0 outbox) | `backend/src/db/`, `backend/src/runtime/service-mode.ts`                                                                      |
| **L3 — Total server outage** | Nothing server-side survives    | Devices continue on L0; reconnect replays idempotently; conflicts become `PENDING_REVIEW`                                                                    | `packages/validation/src/schemas/universal-core/conflict-state.ts`, `Idempotency-Key`                                         |

---

## 2. Non-Goals

- **No multi-master database:** Two writers create unresolvable money conflicts. Single writer + L0 device outbox is the consistency boundary.
- **No BullMQ / second job runtime:** `backend/src/services/distributed-work.ts` (`FOR UPDATE SKIP LOCKED`) is the sole job authority (`job-authority-guard.test.ts`).
- **No Redis distributed locks for correctness:** Money correctness uses Postgres `pg_advisory_xact_lock`, row locks, and `EXCLUDE` constraints. Redis is strictly optional for cache and rate limiting.
- **No `@fastify/under-pressure` / `@opentelemetry/sdk-node` npm install without owner approval:** Use Node built-in `perf_hooks.monitorEventLoopDelay` for backpressure (`runtime/pressure.ts`); design OTel cleanly behind optional hooks (`NEEDS_OWNER_DECISION`).

---

## 3. Current State (Verified)

- Stateless Fastify backend (`backend/src/index.ts`), `/ready` + `SIGTERM`.
- Postgres-backed job runtime (`backend/src/services/distributed-work.ts`).
- DB-head realtime (`backend/src/services/sync-stream.ts`).
- Optional Redis (`backend/src/services/cache.service.ts` with memory fallback).
- Zero session-scoped `pg_advisory_lock(` calls in `docs/*.sql` or `backend/src/`.
- `backend/src/drizzle-schema.ts` is unused dead code (0 imports).
- **Geography bottleneck:** Render API (Oregon) vs Supabase DB (Sydney) — owner must co-locate.

---

## 4. Target Topology by Stage

- **Stage 1 (Launch):** 2 stateless API nodes (co-located with DB) + 1 Worker (`ROLE=worker`) + Managed Postgres Primary + HA Standby + 1 Read Replica + Supavisor (transaction mode for API, session mode for migrations) + Optional Redis + Cloudflare CDN.
- **Stage 2 (Growth):** 3–6 API nodes (autoscaled on CPU + event-loop lag across ≥2 zones) + 2 Workers + Primary + Sync Standby + 2 Read Replicas + 1 Async Cross-Region DR Replica.
- **Stage 3 (Multi-region):** Active/active read API in 2 regions, single writer region; DR promotion runbook for region loss; shard by `workspace_id` (Citus) only when primary saturation is measured.

---

## 5. Risks & Architectural Decisions (ADRs)

- `ADR-0001-one-writer.md` — Single writer + L0 outbox vs multi-master.
- `ADR-0002-postgres-job-claims.md` — Postgres `SKIP LOCKED` vs BullMQ.
- `ADR-0003-redis-optional.md` — Redis strictly optional cache/rate-limit vs hard dependency.
- `ADR-0004-primary-vs-replica-routing.md` — Explicit allow-list + lag fallback.
- `ADR-0005-transaction-pooler-and-lock-order.md` — `prepare: false`, `pg_advisory_xact_lock`, canonical lock order.
