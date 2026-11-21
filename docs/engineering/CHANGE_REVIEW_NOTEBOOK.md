# Change Review Notebook — Admin Control Plane / Unified Core Observability (21 Nov 2026)

Mission: `pasted_1795259412245` (100-point audit + unified core monitoring). Baseline HEAD `4edfb591`, branch `main`.
Pre-existing user work preserved: HSTS fix (`apps/admin/next.config.js`, `security-headers.test.ts`, `next-env.d.ts`).
Code-intel: PARTIALLY_STALE — recorded, targeted search used, no rebuild.

## Design decision 1 — One collector, one registry (backend/src/services/monitoring/)

**Current state & root cause.** `RouteMetricsCollector` (route-metrics.ts) is the ONE in-memory metrics authority: observe per request, flush closed minutes, idempotent UPSERT. It has no core dimension, so no business core is observable (F-01/02/03).

**Proposed change.** Add `core-registry.ts` (typed cores extracted from real services/routes, stable ids, owners, bounded operation groups, SLO targets) and EXTEND the same collector with core buckets keyed `coreId×operationGroup×minute×instance`. `coreForRoute()` attributes each route template to exactly ONE core (longest-prefix match; unmatched → `platform`). No second collector, no second sampler, no per-request DB write.

**Alternatives.** (a) Separate CoreMetricsCollector — rejected: mission forbids a second collector; two flush timers = two authorities. (b) Per-service manual instrumentation — rejected for this round: 80+ services, huge blast radius; route boundary IS the operation boundary for API cores, and internal engines (sync/jobs) get snapshot-time exact counts. (c) Do nothing — rejected: the mission's central deliverable.

**Five pre-passes.**

1. Correctness: attribution must be deterministic and total; a route owned by two cores would double-count → longest-prefix + guard test asserting unique ownership and full coverage of route files.
2. Architecture: registry is a pure module importing nothing (no service cycles — CLAUDE trap); collector stays the only flush authority; sink interface extended, not duplicated.
3. Security: core buckets carry NO ids/urls/PII — only core id, operation group, counts, durations. process_role from runtime/role. Same RLS/revoke pattern as admin-monitoring-01.
4. Performance: one extra Map lookup + bucket increment per request (O(1)); flush writes one row per core×group×minute (≤ ~60 rows/min), same batched UPSERT path. Overhead measured in a unit test.
5. Adversarial: what if a route prefix is wrong? Guard test maps EVERY backend route file's declared paths through coreForRoute and asserts none lands in `platform` by accident except genuinely platform routes; what if histogram percentiles lie? They are bucket estimates — API returns `atLeast` flag for the open bucket, UI renders «≥».

**Benefit.** Before: owner sees route traffic only. After: every real core has calls/success/error/P50/P95/P99/inflight/queue/dependency-wait per minute per instance, with UNKNOWN where unmeasurable. Verified by collector/registry unit tests + PG rollup test. Trade-off: route-boundary attribution misses intra-request sub-operations (documented; operation groups stay bounded). Cost of not doing it: the mission's core deliverable does not exist.

## Design decision 2 — Pressure formula (core-pressure.domain.ts)

Pure, versioned `pressure-v1`: weighted normalized components (latency vs SLO 0.35, error vs budget 0.30, queue saturation 0.15, retry/timeout 0.10, dependency wait 0.10). Each component null when its input is unmeasured; weights renormalize over PRESENT components; all null → pressure null + status UNKNOWN + reason. Thresholds: <40 healthy, 40–70 warning, >70 critical (documented, in registry config). Never zero-fill (guard: unknown-is-not-zero pattern). CPU is NEVER attributed per module — process/instance CPU stays separate (mission §5.4). Tests: missing-input matrix, threshold boundaries (`<` not `<=`), renormalization, hand-computed expected values.

## Design decision 3 — Real-time stream (admin-monitor.routes.ts)

Return `GET /api/admin/monitor/stream` BEHIND `adminRoute('operations.monitor.read')` (no token in URL; fetch-based SSE client sends Authorization). One shared sampler timer for all subscribers (already classified by job-authority-guard TIMER_CONSUMERS), started on first subscriber, cleared when none, `onClose` cleanup, MAX cap → 503. Events: snapshot/core.metrics/instance.metrics/database.metrics/alert.raised/alert.resolved/heartbeat/stream.error, versioned `{v:1}`. Data is DB-aggregated across ALL instances (minute granularity) — sub-minute cross-instance push would need Redis pub/sub which cacheService lacks → limitation documented, not faked. Frontend: `MonitorStreamClient` (injectable fetch/timers; backoff+jitter; heartbeat-timeout → stale; fallback polling flag; single subscription) + hook wiring into React Query; polling disabled while connected. The old wall guard (`stream routes are gone`) still passes: unauthenticated inject gets 401, not 200; the guard is REWRITTEN to assert the new decision (auth required), not deleted.

## Design decision 4 — History & alerts (additive migration)

`docs/admin-core-monitoring-01-migration.sql`: core_metrics_minute/hour, metric_alert_events, metric_alert_rules extended (core_id nullable + core metrics in CHECK + unique (metric, core_id) NULLS NOT DISTINCT), instance_metrics_minute.rss_bytes added, rollup/prune/overview/series RPCs for cores. Additive, idempotent, RLS + REVOKE ALL then service_role grant, SECURITY DEFINER + search_path, rollback block. Runs twice in a real embedded Postgres test. Alert evaluator stays ONE (MonitoringService.evaluateAlerts extended): open-event dedup per (rule, core), hourly notify cooldown, resolve on recovery, evidence payload (which component breached), audit via existing AdminSecurityService. GET never sends email (existing invariant kept).

## Design decision 5 — UI on existing primitives

Monitor panel rebuilt IN PLACE (same tab, no new hub/route): KpiCard/KpiGrid (shared), DataTable (shared) for core ranking with search/group filter/range incl. 30d, Sheet for core detail, new shared `TrendChart` in packages/ui on the EXISTING ChartContainer/recharts (no new dependency; admin re-exports it), formatBytes from @hisabche/formatting (null→UNKNOWN), separate error/empty branches, connection badge + last-event/last-sample times, i18n keys in fa/af/en. Tests: stream client unit suite (node), wiring/i18n guards (admin convention), TrendChart render test (packages/ui jsdom).

## Post-implementation review & evidence

Recorded in `docs/admin/ADMIN-100-POINT-IMPLEMENTATION-COVERAGE.md` after the diff exists (five post-passes per component, real test commands + exit codes). No claim of VERIFIED_COMPLETE without live HTTP/DB evidence; migration status stays `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.
