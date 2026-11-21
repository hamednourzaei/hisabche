# Core Metrics Registry — ownership & metric contract

The ONE typed registry is code: `backend/src/services/monitoring/core-registry.ts`.
This document is its human-readable contract (mission §5.2, F-15). A core is the
observability identity of an EXISTING service — not a new module.

## Attribution rules

1. A route template belongs to exactly ONE core (longest claimed prefix wins).
2. Operation groups are a CLOSED enum: `read / create / update / delete / action / other`.
3. No dynamic labels, no per-entity metrics, no ids, no URLs, no PII.
4. A new route without a registry entry fails the guard test
   (`monitoring-core-registry.test.ts` runs every declared template through
   `coreForRoute`); a new action verb is a registry edit, never a runtime label.
5. Metric key space is bounded: cores × groups × instances × minutes.

## The cores (26)

SLO defaults: `DEFAULT` P95≤800ms/err≤1% · `WRITE` 1500ms/1% · `HEAVY` 3000ms/2%.

| Core             | Group        | Owner (real path under backend/src)                                         | SLO                      | Measurable today                                                   |
| ---------------- | ------------ | --------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------ |
| auth             | identity     | services/auth                                                               | 600ms/0.5%               | traffic, latency, errors, inflight, dep-wait                       |
| tenancy          | identity     | workspace.service + tenancy.service + branch                                | DEFAULT                  | same                                                               |
| permissions      | identity     | permission.service + authorization                                          | DEFAULT                  | same                                                               |
| sales            | commerce     | invoice.service + sales + orders + order-deposit                            | WRITE                    | same                                                               |
| payments         | commerce     | services/payments                                                           | WRITE                    | same                                                               |
| pos              | commerce     | services/pos                                                                | WRITE                    | same                                                               |
| crm              | commerce     | customer.service + crm + customer-profile                                   | DEFAULT                  | same                                                               |
| purchasing       | commerce     | purchasing.service + supplier                                               | WRITE                    | same                                                               |
| pricing          | commerce     | pricing + promotions + price-lists                                          | DEFAULT                  | same                                                               |
| accounting       | finance      | services/accounting (ledger.postDocument)                                   | WRITE                    | same                                                               |
| tax              | finance      | services/tax                                                                | DEFAULT                  | same                                                               |
| costing          | finance      | services/inventory-costing                                                  | HEAVY                    | same                                                               |
| finance          | finance      | banking + financing + exchange + currency                                   | WRITE                    | same                                                               |
| inventory        | operations   | warehouse.service + inventory + product.service                             | WRITE                    | same                                                               |
| manufacturing    | industry     | manufacturing.service + roll-cutting                                        | HEAVY                    | same                                                               |
| service-delivery | industry     | service-delivery + repair + salon                                           | WRITE                    | same                                                               |
| projects         | operations   | project.service                                                             | DEFAULT                  | same                                                               |
| hr               | people       | human-resources.service + payroll + attendance                              | WRITE                    | same                                                               |
| sync             | sync         | sync.service + sync-stream + conflict                                       | 2000ms/2%                | traffic + open sync sockets (instance gauge)                       |
| offline          | sync         | offline-license.service + cloud-migration                                   | HEAVY                    | traffic                                                            |
| reporting        | intelligence | analytics.service + analysis + reporting                                    | HEAVY                    | traffic                                                            |
| ai               | intelligence | ai.service + ai/pipeline + mcp + ingest                                     | 8000ms/5%                | traffic                                                            |
| notifications    | platform     | notification.service + email-outbox + messaging                             | DEFAULT                  | traffic                                                            |
| jobs             | platform     | scheduler + distributed-work + automation + workflow                        | 2000ms/2%, queue cap 100 | traffic + **exact queue gauges**: pending/processing/stuck/retries |
| verticals        | industry     | contracts + quality + transport + agriculture + gold/metal                  | WRITE                    | traffic                                                            |
| platform         | platform     | admin + billing + package-credits + developer + oauth + market + cms + blog | DEFAULT                  | traffic; also the attribution fallback (audited)                   |

## Metric contract per core

Measured at the request boundary (every core): operation/success/error/client-error
counts, duration sum/max + fixed histogram (→P50/P95/P99 estimates), timeout count
(408/504), inflight max (begin/end paired, ghost-safe via raw `close`), concurrency
max, dependency wait (wall time with a Supabase call open; NULL when uninstrumented).

Measured by gauge (cores with a queue — `jobs` today): queue depth, processing,
stuck (lease-expired), retries spent. Exact `count:'exact'` reads, once per closed
minute. NULL on failure — never zero.

**UNKNOWN contract**: a core with no measurable component renders status UNKNOWN
with a reason (`no operations in window` / `no measurable component`). It is never
dropped from the ranking and never shown «healthy at 0».

**Not measurable per module (by design)**: CPU, memory, event-loop — these are
process/instance metrics (`instance_metrics_minute`), shown separately. A logical
core's pressure never fabricates a CPU share (mission §5.4).

## Pressure formula

`pressure-v1` — see `UNIFIED-CORE-MONITORING-ARCHITECTURE.md` §2 and
`core-pressure.domain.ts`. Weights/thresholds are documented constants in the
registry, not hidden tuning. The UI labels the composite score and shows each
component's measured share (coverage).

## Alert metrics (metric_alert_rules.metric)

Infrastructure (core_id NULL): `cpu_percent`, `memory_percent`,
`event_loop_p99_ms`, `db_connections_percent`, `http_5xx_percent`,
`replication_lag_seconds`.

Core (core_id `*` or a concrete id): `core_pressure`, `core_p95_ms`,
`core_error_percent`, `core_queue_depth`. Default seeded rule: `core_pressure > 70`
for 5 min, critical, wildcard. Specific-core rules override the wildcard.
Events: one open event per (rule, core) — DB partial unique index; cooldown via
`cooldown_minutes`; raise/resolve audited; GET never notifies.
