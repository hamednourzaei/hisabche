# Unified Core Monitoring — Architecture

Mission: 100-point Admin audit + unified core observability (21 Nov 2026).
Baseline HEAD `4edfb591`, branch `main`. This document describes what was BUILT;
execution evidence lives in `ADMIN-100-POINT-IMPLEMENTATION-COVERAGE.md`.

## 1. One collector, one registry, one flush authority

```
request boundary (index.ts onRequest/onResponse)
        │  observe(RouteHit)            beginOperation/endOperation (per core)
        ▼
RouteMetricsCollector  ── the ONLY in-memory metrics authority (route-metrics.ts)
        │  buckets: route×method×status×minute  AND  core×group×minute×instance
        │  flushClosedMinutes(): once per closed minute, idempotent UPSERT
        ▼
supabaseMetricsSink ── request_metrics_minute / core_metrics_minute /
                       core_gauges_minute / db_metrics_minute / instance_metrics_minute
        ▲
sampleCoreGauges() (core-gauges.ts): job queue exact counts + admin_db_vitals,
once per flush — never per request, never per viewer.
```

- **Attribution**: `coreForRoute()` (core-registry.ts) maps every Fastify route
  TEMPLATE to exactly ONE core — longest claimed prefix wins; unclaimed →
  `platform`. A guard test runs every declared route template through it.
- **Operation groups**: closed enum `read/create/update/delete/action/other`.
  POST verbs come from a closed, reviewed verb set — no dynamic labels, no ids.
- **Cardinality bound**: cores (26) × groups (6) × instances × minutes.
- **No per-request DB write.** Observations accumulate in memory; one batched
  UPSERT per table per minute. A restart mid-minute cannot double-count
  (UPSERT on minute+key).
- **Pre-migration degradation**: until `admin-core-monitoring-01` is applied,
  core-table writes are dropped for that minute (caught, never fatal) and the
  existing infrastructure monitoring keeps working. No fake rows.

## 2. Core Pressure — `pressure-v1` (core-pressure.domain.ts)

Pure, versioned, fully unit-tested. Components normalized 0..1:

| Component      | Weight | Normalization                       | Null when               |
| -------------- | -----: | ----------------------------------- | ----------------------- |
| latency        |   0.35 | P95 / core SLO target               | no observations         |
| errors         |   0.30 | 5xx% / core error budget            | no traffic              |
| queue          |   0.15 | depth / declared capacity           | no gauge or no capacity |
| retryTimeout   |   0.10 | (retries+timeouts)/ops vs 5% budget | no traffic              |
| dependencyWait |   0.10 | mean DB wait / (SLO×0.5)            | uninstrumented          |

`pressure = 100 × Σ(w·c) / Σ(w of PRESENT components)` — weights renormalize
over what is actually measured. Nothing measurable → `null` + status UNKNOWN +
reason. Thresholds: <40 healthy · 40–69 warning · ≥70 critical (registry constants).

**Percentiles are conservative bucket estimates** (fixed histogram
<50/<100/<250/<500/<1000/≥1000 ms). The open bucket carries `atLeast: true`;
the UI renders «≥ 1000 ms», never a fabricated exact value.

**CPU is never attributed per module.** Instance/process CPU stays separate
(mission §5.4); a logical core's pressure is latency/throughput/queue/retry/wait.

## 3. Storage & history (docs/admin-core-monitoring-01-migration.sql)

Additive, idempotent, RLS + service-role-only, SECURITY DEFINER + pinned
search_path. Extends `admin-monitoring-01`; does not replace it.

- `core_metrics_minute` — per core×group×minute×instance (7-day retention).
- `core_metrics_hour` — 90-day rollup; histograms merged element-wise;
  `queue_depth_max` from the minute gauges. Idempotent UPSERT keyed by hour.
- `core_gauges_minute`, `db_metrics_minute` — nullable gauges (NULL = UNKNOWN).
- `instance_metrics_minute` + `rss_bytes`, `process_role` (additive columns).
- `metric_alert_rules` + `core_id` (NULL=infra, `*`=every core, id=override),
  `cooldown_minutes`, extended metric CHECK, UNIQUE(metric, core_id)
  NULLS NOT DISTINCT (PG15+).
- `metric_alert_events` — raised/resolved history with sanitized evidence.
  **Partial unique index `(rule_id, core_id) WHERE resolved_at IS NULL` IS the
  deduplication** — two concurrent evaluators cannot raise one alert twice.
- RPCs: `admin_core_monitor_snapshot(p_since, p_until)` (window aggregates +
  latest gauges + 24 h instance lookback + latest DB row),
  `admin_core_monitor_series(core, since, unit)`,
  `admin_core_monitor_rollup_hour`, `admin_core_monitor_prune`.
- Rollup/prune run inside the EXISTING hourly `monitor-rollup` scheduler tick —
  no second timer. Missing RPCs (PGRST202) skip the core half gracefully.

**Gaps stay gaps**: a bucket with no row is absent from the series, never
zero-filled. Retention: minutes 7 d, hours 90 d (same contract as monitoring-01).

## 4. Reads (monitoring.service.ts — extended, not duplicated)

- `coreSnapshot()` — every registered core, measured or UNKNOWN; trend =
  pressure delta vs the previous 5-minute window (two bounded RPC reads).
- `coreSeries(coreId, range)` — 1h/24h/7d/**30d**/90d; unknown core → 404.
- `alertEvents(limit)` — raised AND resolved history.
- `evaluateAlerts()` — ONE evaluator: infra rules keep the streak cache; core
  rules add persisted events (raise/resolve), cooldown via `last_notified_at`,
  audit via the existing `AdminSecurityService`. **GET (notify:false) never
  writes an event or sends email.** Specific-core rules override the wildcard.

## 5. Real-time

See `ADMIN-REALTIME-RELIABILITY.md`. Summary: authenticated SSE
`GET /api/admin/monitor/stream` behind `operations.monitor.read`; ONE shared
10 s sampler for all subscribers (cap 20 → 503); fetch-based client with
Authorization header (never a URL token), backoff+jitter reconnect, heartbeat
watchdog, declared fallback polling; events land in the React Query cache.

## 6. UI (operations › monitor — same tab, no new hub)

System overview (shared `KpiCard`/`KpiGrid`) · core pressure ranking (shared
`DataTable`, search + group filter, pressure-desc, UNKNOWN visible) · core
detail `Sheet` (owner, SLO, pressure breakdown with measured-vs-composite,
history) · shared `TrendChart` (recharts via the existing `ChartContainer`,
lazy-loaded, gaps preserved) · instances online AND offline with role/lastSeen ·
database vitals · alert rules + event history · wall tokens (unchanged contract).
Bytes via `@hisabche/formatting` (null → UNKNOWN). i18n complete in fa/af/en.

## 7. Known limitations (honest, not hidden)

1. **Migration pending human confirmation** — core tables/RPCs do not exist on
   the live DB until applied; until then core reads degrade (UNKNOWN/error
   branch), infra monitoring is unaffected.
2. **Route-boundary attribution** misses intra-request sub-operations; internal
   engines (jobs) are measured by exact-count gauges instead. Documented trade-off.
3. **Cross-instance live push is minute-granular** (DB-aggregated). Sub-minute
   cross-instance broadcast would need Redis pub/sub that `cacheService` lacks —
   limitation recorded, not faked.
4. **Queue wait time** is not recorded per job yet (`queue_wait_total_ms` NULL);
   queue depth trend is the signal.
5. Local embedded-Postgres execution is blocked on this Windows machine
   (error 1314, filtered admin token) — PG suites run in CI.
