# ADR-0002: PostgreSQL Job Claims & Advisory Locks for Background Workers

- **Status:** Accepted
- **Date:** 2026-11-12

## Context

Scaling `hisabche-api` horizontally (`numInstances >= 2`) must not duplicate cron jobs, accrual reversals, or scheduled report dispatches. Using Supavisor transaction pooling forbids session-level `pg_advisory_lock` on pooled connections.

## Decision

Isolate background work into a dedicated `PROCESS_ROLE=worker` process (`backend/src/runtime/start-worker.ts`). Leader election and job claiming use either direct session connections (`backend/src/db/admin.ts`) for `pg_try_advisory_lock` or row-level `FOR UPDATE SKIP LOCKED` job claims in PostgreSQL.

## Consequences

- **Positive:** Safe horizontal scaling of `api` instances without duplicate cron execution; zero reliance on Redis for correctness.
- **Negative:** Worker requires a direct/session connection or job-claim table when running multiple worker replicas.
