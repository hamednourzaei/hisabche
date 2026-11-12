# 04 — Capacity Planning & Resource Ceilings

## Connection Pool Math

Supabase Transaction Pooler (Supavisor) multiplexes client connections onto Postgres backend processes:

- **API instance (`api`):** max `10` pooled connections per instance (`DB_POOL_MAX=10`). With `numInstances = 2`, steady-state API pool demand is `20` connections.
- **Worker instance (`worker`):** max `5` pooled connections + `2` direct session connections for advisory locks/migrations.
- **Safety Margin:** Keep total max configured connections `< 60%` of Supabase plan's `max_connections` to leave headroom for admin/maintenance and dashboard queries.

## Memory & Event Loop Ceilings (`backend/src/runtime/pressure.ts`)

| Metric             | Default Threshold | Env Override              | Action on Breach         |
| ------------------ | ----------------- | ------------------------- | ------------------------ |
| Event Loop p99 Lag | `250 ms`          | `MAX_EVENT_LOOP_DELAY_MS` | `503 SERVICE_OVERLOADED` |
| V8 Heap Used       | `1.5 GB`          | `MAX_HEAP_USED_BYTES`     | `503 SERVICE_OVERLOADED` |
| Process RSS        | `2.0 GB`          | `MAX_RSS_BYTES`           | `503 SERVICE_OVERLOADED` |

## Query & Lock Timeouts (`docs/role-timeouts-01-migration.sql`)

- `authenticator` / `authenticated` web roles: `statement_timeout = '15s'`, `lock_timeout = '3s'`, `idle_in_transaction_session_timeout = '10s'`.
- Reporting / replica queries: `statement_timeout = '30s'`.

## Scaling Triggers

1. Sustained CPU `> 70%` or `eventLoopDelayMs > 120ms` on `api` -> increase `numInstances` in `render.yaml`.
2. DB `active_connections > 70%` of pooler limit -> enable Read Replica (`DATABASE_REPLICA_URL`) for analytical endpoints.
3. Worker queue lag `> 60s` -> batch size tuning or split heavy cron jobs into off-peak windows.
