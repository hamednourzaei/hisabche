# 03 — Service Level Objectives (SLOs)

| SLI                                                                                                                         | Target (30-day rolling)                    | Error Budget                | Measurement Source                                                          |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------- | --------------------------------------------------------------------------- |
| **API Availability** (non-5xx on `/api/*` excluding client 4xx and intentional 503 load-shedding during declared incidents) | `99.9%`                                    | `43.2 min / month`          | `/metrics` HTTP status counters                                             |
| **Core POS / Invoice Create Latency (p95)**                                                                                 | `< 450 ms`                                 | `< 5%` requests over budget | Structured `perf: true` logs (`totalMs`)                                    |
| **Core POS / Invoice Create Latency (p99)**                                                                                 | `< 1200 ms`                                | `< 1%` requests over budget | Structured `perf: true` logs (`totalMs`)                                    |
| **Sync Push Reliability (`/api/sync/push`)**                                                                                | `99.95%` idempotent success                | `21.6 min / month`          | `/metrics` + `sync_audit`                                                   |
| **Analytical Reports Latency (p95)**                                                                                        | `< 2500 ms`                                | `< 5%` requests over budget | `/metrics` + `dbMs`                                                         |
| **RPO (Recovery Point Objective)**                                                                                          | `<= 5 minutes` (with Supabase PITR)        | —                           | Supabase PITR status                                                        |
| **RTO (Recovery Time Objective)**                                                                                           | `<= 30 minutes` (sandbox/failover restore) | —                           | Monthly [restore-to-sandbox.md](../../runbooks/restore-to-sandbox.md) drill |

## Alerting Thresholds

- **Page immediately:** 5xx rate `> 1%` for 5 minutes OR `/ready` returning `503` for `> 2 minutes` OR `serviceMode === 'read_only'`.
- **Warn / Investigate:** `eventLoopDelayMs > 150ms` sustained for 3 minutes OR circuit breaker `OPEN` for `> 5 minutes`.
