# V61 Survivable Infrastructure Implementation Plan

Ordered execution of slices C.4.1 → C.4.11:

| Slice      | Goal                                                         | Key Files                                                                                     | Tests                                                  | Flags / Rollback                                           |
| ---------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| **C.4.1**  | Process roles (`api \| worker \| all`)                       | `backend/src/runtime/{role,start-api,start-worker,shutdown}.ts`, `backend/src/index.ts`       | `role-startup.test.ts`                                 | `ROLE=all` default; unset `ROLE` rolls back                |
| **C.4.2**  | Primary vs replica DB routing                                | `backend/src/db/{primary,replica,admin,routing,index}.ts`                                     | `db-routing-guard.test.ts`, `replica-fallback.test.ts` | `SUPABASE_REPLICA_URL` unset = falls back to primary       |
| **C.4.3**  | Pooler-safe `postgres.js` + role timeouts                    | `docs/role-timeouts-01-migration.sql`, `VERIFY-role-timeouts-01.sql`                          | `pooler-advisory-lock-guard.test.ts`                   | `prepare: false`; human-applied `ALTER ROLE`               |
| **C.4.4**  | Load shedding & backpressure                                 | `backend/src/runtime/pressure.ts` (`monitorEventLoopDelay`)                                   | `pressure-shedding.test.ts`                            | Threshold env vars; `LOAD_SHEDDING_ENABLED=false` rollback |
| **C.4.5**  | Explicit `serviceMode` (`normal \| read_only \| degraded`)   | `backend/src/runtime/service-mode.ts`                                                         | `service-mode-guard.test.ts`                           | `SERVICE_READ_ONLY` pre-write guard; UI offline banner     |
| **C.4.6**  | Timeouts, idempotent retries, circuit breaker                | `backend/src/runtime/breaker.ts`                                                              | `breaker.test.ts`                                      | Per-dependency breaker config                              |
| **C.4.7**  | Redis strictly optional                                      | `backend/src/services/cache.service.ts`, rate-limit error guard                               | `resilience/redis-down.test.ts`                        | Automatic memory fallback                                  |
| **C.4.8**  | Observability (`/metrics`, structured logs, SLOs, OTel note) | `backend/src/routes/system-metrics.routes.ts`, `docs/architecture/infra/03-SLO.md`            | `system-metrics.test.ts`                               | Additive telemetry                                         |
| **C.4.9**  | Chaos tests, k6 scripts, runbooks                            | `backend/src/__tests__/resilience/*.test.ts`, `scripts/resilience/*.js`, `docs/runbooks/*.md` | Resilience suite                                       | Drills are owner-run on staging only                       |
| **C.4.10** | Deadlock & hot-row discipline                                | `docs/architecture/infra/LOCK-ORDER.md`                                                       | `lock-order-guard.test.ts`                             | Static SQL/RPC order verification                          |
| **C.4.11** | Backups, monthly restore-to-sandbox, infra docs & ADRs       | `docs/architecture/infra/{00-OVERVIEW..04-CAPACITY}.md`, `adr/ADR-0001..0005.md`              | Sandbox restore test (B.2.24)                          | PITR = `BLOCKED_EXTERNAL` (Supabase plan)                  |

## Owner Actions Required Outside Repo

1. **Co-locate API & DB region** (Oregon Render ↔ Sydney Supabase).
2. **Enable Supabase HA, PITR, and Read Replica.**
3. **Render:** Add `worker` service (`ROLE=worker`) and set API `numInstances: 2` (in `render.yaml`, human-applied).
4. **Run `docs/role-timeouts-01-migration.sql`** by hand on Postgres.
5. **Execute `docs/runbooks/failover-drill.md`** on staging and record RTO/RPO.
