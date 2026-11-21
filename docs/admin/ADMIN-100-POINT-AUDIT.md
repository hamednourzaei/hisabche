# ADMIN 100-POINT AUDIT — Unified Core Observability Mission

Baseline: branch `main`, HEAD `4edfb5910386d396e3a50c88c37b3960e8a74d44` (recorded 21 Nov 2026).
Working tree at baseline: HSTS fix in `apps/admin` (3 files, pre-existing user work — preserved) + untracked `.claude/settings.local.json`.
Code Intelligence: `PARTIALLY_STALE` (indexed `aa1d0896` ≠ HEAD `4edfb591`) — limitation recorded; targeted disk search used instead. No index rebuild performed (not approved).

Status legend: `PASS` · `FAIL` · `NOT_VERIFIED` · `NOT_APPLICABLE`.
Every FAIL is a Finding below. Post-fix statuses live in `ADMIN-100-POINT-IMPLEMENTATION-COVERAGE.md`.

## Summary (pre-fix)

| Status         | Count |
| -------------- | ----: |
| PASS           |    65 |
| FAIL           |    27 |
| NOT_VERIFIED   |     3 |
| NOT_APPLICABLE |     5 |
| P0 open        |     0 |
| P1 findings    |     7 |
| P2 findings    |     9 |

## Group A — Visual design & design system

| #   | Criterion                         | Status | Evidence                                                                                            |
| --- | --------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| 1   | Hub design consistency            | PASS   | All hubs use `HubTabs`/`TabSections` (`operations-client.tsx:47-113`); guard `v63-insights.test.ts` |
| 2   | Shared design tokens              | PASS   | Scan of `apps/admin/app` + `components`: 0 hex colors                                               |
| 3   | Semantic colors                   | PASS   | Badge variants + `hsl(var(--color-primary))` (`monitor-panel.tsx:492`)                              |
| 4   | Title/text hierarchy              | PASS   | `CardTitle`/`CardDescription` pattern throughout                                                    |
| 5   | Table readability                 | PASS   | Shared `DataTable`, `tabular-nums`, mono ids                                                        |
| 6   | Admin density                     | PASS   | Compact KPI grids, dense tables                                                                     |
| 7   | Card/panel/sheet/dialog coherence | PASS   | `StepUpDialog` for every sensitive op; `Sheet` for details                                          |
| 8   | Icons/buttons coherence           | PASS   | lucide + shared `Button` variants                                                                   |
| 9   | Light/dark behavior               | PASS   | Token-only styling; no hardcoded theme values                                                       |
| 10  | No decorative noise               | PASS   | Monitor screen is functional, no ornament                                                           |

## Group B — Page architecture & navigation

| #   | Criterion                       | Status | Evidence                                                                                      |
| --- | ------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| 11  | Hub structure                   | PASS   | 8 hubs; operations = health/monitor/servers/jobs/announcements                                |
| 12  | Internal paths                  | PASS   | `v63-insights.test.ts` asserts hook paths ↔ declared backend routes                           |
| 13  | Active navigation               | PASS   | `useHubTab` (`operations-client.tsx:43`)                                                      |
| 14  | Query state in URL              | PASS   | `?tab=` / `?view=` via `useHubTab`/`useHubSection`                                            |
| 15  | Browser back/forward            | PASS   | URL-driven tabs                                                                               |
| 16  | Discoverability                 | PASS   | Monitor is a tab of Operations; wall tokens managed in place                                  |
| 17  | Permission/navigation alignment | PASS   | `adminRoute(permission)` chain; permission matrix reads enforced catalogue                    |
| 18  | Orphan routes                   | PASS   | `hubs-and-redirects.test.ts` guard                                                            |
| 19  | Duplicate pages/ops             | PASS   | Servers tab reuses `ServersClient`; no parallel monitor page                                  |
| 20  | Locale preserved on navigation  | PASS   | Every `router.push/replace` in admin carries `/${locale}` prefix (verified all 13 call sites) |

## Group C — Tables & data management

| #   | Criterion                   | Status         | Evidence                                                                                  |
| --- | --------------------------- | -------------- | ----------------------------------------------------------------------------------------- |
| 21  | DataTable consistency       | PASS           | Every monitor list is the shared `DataTable`                                              |
| 22  | Sort                        | PASS           | `sortValue` on columns                                                                    |
| 23  | Filter                      | PASS           | Existing tables use `TableFilterSelect`; core ranking filter arrives with F-01 fix        |
| 24  | Real search                 | FAIL           | **F-16** — monitor has no search (cores/routes/instances)                                 |
| 25  | Server pagination at volume | NOT_VERIFIED   | Monitor lists are small aggregates; jobs list volume not load-tested                      |
| 26  | Bulk actions                | NOT_APPLICABLE | Monitor is read-only; token revoke is per-row by design                                   |
| 27  | Column management           | PASS           | `showFrom`/`locked` + `useTableState`                                                     |
| 28  | Export                      | NOT_APPLICABLE | No export surface on monitor (internal aggregates)                                        |
| 29  | Virtualization              | NOT_APPLICABLE | Lists ≤ dozens of rows; `@tanstack/react-virtual` available in `@hisabche/ui` when needed |
| 30  | Mobile tables               | PASS           | `DataTable` card mode < 768px (repo convention, 18 Oct)                                   |

## Group D — Forms & workflow

| #   | Criterion                     | Status         | Evidence                                                                               |
| --- | ----------------------------- | -------------- | -------------------------------------------------------------------------------------- |
| 31  | Validation                    | PASS           | Server Zod (`admin-monitor.routes.ts:48-59`); client numeric guard on threshold        |
| 32  | React Hook Form               | NOT_APPLICABLE | Monitor forms are 1–3 field inline edits; RHF used by complex admin forms              |
| 33  | Shared Zod validation         | PASS           | `alertBody`/`wallTokenBody` Zod on the route                                           |
| 34  | No duplicate submit           | PASS           | `StepUpDialog` `isSubmitting` + `busy` disable (`step-up-dialog.tsx:62,100,162`)       |
| 35  | Loading in operations         | PASS           | `busy ? t('app.loading')` in dialog; skeletons for lists                               |
| 36  | API error in form             | PASS           | Dialog catch → inline error (`step-up-dialog.tsx:92-95`)                               |
| 37  | Success feedback              | PASS           | Token shown once; alert edit closes dialog + invalidates cache (value visibly changes) |
| 38  | Destructive confirmation      | PASS           | Revoke/token/alert all through `StepUpDialog`                                          |
| 39  | Keyboard support              | PASS           | Radix dialog, labeled inputs, `sr-only` labels                                         |
| 40  | Form state on transient error | PASS           | Draft kept; dialog stays open on failure                                               |

## Group E — Accessibility & i18n

| #   | Criterion                    | Status | Evidence                                                                                                   |
| --- | ---------------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| 41  | Focus standard               | PASS   | Radix primitives                                                                                           |
| 42  | Tab/arrow keys               | PASS   | Radix dialog/select                                                                                        |
| 43  | Accessible dialog/sheet      | PASS   | `AlertDialog`/`Sheet` shared                                                                               |
| 44  | ARIA                         | PASS   | `role="img"` + aria-label on chart; `aria-label` on retry                                                  |
| 45  | Contrast                     | PASS   | Semantic tokens                                                                                            |
| 46  | RTL fa                       | PASS   | Logical classes only (scan: 0 physical `ml-/mr-/left-/right-`)                                             |
| 47  | RTL af                       | PASS   | Same surface; Dari glossary convention                                                                     |
| 48  | LTR en                       | PASS   | `dir="ltr"` on mono values/ids                                                                             |
| 49  | Date/number/bytes formatting | FAIL   | **F-12** — local `formatBytes` (`monitor-panel.tsx:62-72`) duplicates `@hisabche/formatting` `formatBytes` |
| 50  | Complete translations        | PASS   | `admin.operations.monitor`: 89 keys in fa, af AND en (verified)                                            |

## Group F — Real-time & freshness

| #   | Criterion                           | Status         | Evidence                                                                                                |
| --- | ----------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------- |
| 51  | Last-update time visible            | FAIL           | **F-04** — no last-updated/last-event indicator                                                         |
| 52  | Live vs stale detection             | FAIL           | **F-04**                                                                                                |
| 53  | Disconnect handling                 | FAIL           | **F-04** — polling hides transport state                                                                |
| 54  | Auto reconnect                      | FAIL           | **F-04** — no stream; SSE removed 12 Nov (no consumer)                                                  |
| 55  | No duplicate subscriptions          | NOT_APPLICABLE | No subscriptions today; guarded in the new stream design                                                |
| 56  | No race conditions                  | PASS           | `sharedSnapshot` single-flight (`admin-monitor.routes.ts:96-106`)                                       |
| 57  | Live data ↔ React Query cache       | FAIL           | **F-05** — `useAdminMonitorSeries` `staleTime:60s`, no refetch → stale history beside live totals       |
| 58  | Precise invalidation after mutation | PASS           | `invalidateQueries(['admin','monitor'])`                                                                |
| 59  | Changes without manual refresh      | FAIL           | **F-05** — overview polls, history does not                                                             |
| 60  | Unavailable data shown clearly      | FAIL           | **F-11** — series `isError` ignored → failed read renders as «no history» (`monitor-panel.tsx:102,475`) |

## Group G — Performance & reliability

| #   | Criterion                      | Status       | Evidence                                                                                                       |
| --- | ------------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------- |
| 61  | Unnecessary requests           | PASS         | One shared 10s snapshot for N viewers                                                                          |
| 62  | N+1                            | PASS         | One-round-trip RPC aggregates                                                                                  |
| 63  | Duplicate fetch                | PASS         | RQ dedupe + single-flight                                                                                      |
| 64  | Extra re-renders               | NOT_VERIFIED | No profiler run (no production build allowed)                                                                  |
| 65  | Memory & cleanup               | PASS         | No long-lived subscriptions today; new stream cleanup is tested                                                |
| 66  | Concurrent requests            | PASS         | Shared promise; failed sample not cached                                                                       |
| 67  | Bundle & lazy loading          | NOT_VERIFIED | Build not run (owner rule); monitor panel is one hub tab                                                       |
| 68  | Chart/table cost               | FAIL         | **F-06** — div-bar chart, no tooltip/axis/exact values; Recharts `ChartContainer` exported but unused in admin |
| 69  | Heavy queries                  | PASS         | Indexed minute tables; SUM totals; LIMIT only on display lists                                                 |
| 70  | Load & multi-instance behavior | FAIL         | **F-09/F-10** — offline instances invisible; workers/jobs absent from monitor                                  |

## Group H — Security & permissions

| #   | Criterion                      | Status | Evidence                                                                                 |
| --- | ------------------------------ | ------ | ---------------------------------------------------------------------------------------- |
| 71  | Authentication                 | PASS   | `adminRoute` = authenticate → platformAdminGuard → permission                            |
| 72  | Authorization                  | PASS   | `operations.monitor.read/write` enforced server-side                                     |
| 73  | Backend permission checks      | PASS   | `admin-rbac.middleware.ts:99-145`                                                        |
| 74  | Step-up                        | PASS   | Writes require fresh TOTP (`requireAdminStepUp`)                                         |
| 75  | No unauthorized metrics access | PASS   | `/metrics` admin-guarded; wall = aggregates only                                         |
| 76  | Stream access restriction      | PASS   | Public stream capped (`MAX_STREAMS=20`); admin stream returns with auth + cap (F-04 fix) |
| 77  | No token disclosure            | PASS   | Wall token hashed, shown once, header-only (never URL)                                   |
| 78  | No PII in metrics              | PASS   | Hashed ids, route templates; `admin-monitoring-01.pg.test.ts` asserts no PII columns     |
| 79  | Audit log of sensitive ops     | PASS   | Security events: alert breach, token create/revoke, step-up refusal                      |
| 80  | Rate limit                     | PASS   | Global 300/min signed-in, 100/min anonymous; wall token verify                           |

## Group I — Architecture & observability

| #   | Criterion                     | Status | Evidence                                                                                          |
| --- | ----------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| 81  | Single core registry          | FAIL   | **F-01** — no core registry; monitoring is route/instance-only                                    |
| 82  | Metric ownership              | FAIL   | **F-15** — no registry/doc naming owners                                                          |
| 83  | All real cores covered        | FAIL   | **F-01** — 0 of ~22 business cores individually observable                                        |
| 84  | All instances covered         | FAIL   | **F-09** — only instances with a minute row in last 10 min; no offline/lastSeen; no process role  |
| 85  | Workers & background jobs     | FAIL   | **F-10** — job queue/failures/stuck only in jobs tab; `getStats` uses `count:'estimated'`         |
| 86  | Core latency                  | FAIL   | **F-02** — no per-core P50/P95/P99                                                                |
| 87  | Core error rate               | FAIL   | **F-02**                                                                                          |
| 88  | Queue & concurrency           | FAIL   | **F-02** — inflight only at instance level                                                        |
| 89  | History & retention           | FAIL   | **F-03** — no core time-series; no 30d range; infra retention (7d/90d) exists                     |
| 90  | Alerts & bottleneck detection | FAIL   | **F-08** — 6 infra rules only; no per-core thresholds, no alert events/history, no cause evidence |

## Group J — Libraries, tests, maintenance

| #   | Criterion                         | Status | Evidence                                                                                         |
| --- | --------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| 91  | Shared UI usage                   | FAIL   | **F-13** — local `Kpi` div instead of shared `KpiCard`/`KpiGrid`                                 |
| 92  | DataTable usage                   | PASS   | Shared everywhere                                                                                |
| 93  | Existing chart library            | FAIL   | **F-06** — Recharts available, unused in admin                                                   |
| 94  | TanStack Query usage              | PASS   | Correct keys/invalidation (staleness counted under F-05)                                         |
| 95  | Command palette                   | PASS   | `command-palette.tsx` mounted in `dashboard-layout.tsx`                                          |
| 96  | Radix interactions                | PASS   | Dialog/Sheet/Select via shared primitives                                                        |
| 97  | Shared formatting                 | FAIL   | **F-12**                                                                                         |
| 98  | No duplicated utilities/hooks     | FAIL   | **F-12/F-13**                                                                                    |
| 99  | Unit/integration/UI test coverage | FAIL   | **F-19** — backend collector/wall/PG tests exist; zero frontend monitor tests, zero stream tests |
| 100 | Documentation & runbook           | FAIL   | **F-15** — no monitoring architecture/registry/realtime docs                                     |

## Findings

| ID   | Severity | Category     | Route                   | File                                                               | Line        | Evidence                                         | Root Cause                                                      | User Impact                                            | Proposed Fix                                                                                                                  | Test                                  | Status (pre) |
| ---- | -------- | ------------ | ----------------------- | ------------------------------------------------------------------ | ----------- | ------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------ |
| F-01 | P1       | I-81/83      | /operations?tab=monitor | backend/src/services/monitoring/route-metrics.ts                   | 140-198     | Collector buckets only route×method×status       | No core dimension in the one collector                          | Owner cannot see which business core is under pressure | Typed core registry + extend the SAME collector with core buckets (no second collector)                                       | core-registry + collector unit tests  | OPEN         |
| F-02 | P1       | I-86/87/88   | same                    | backend/src/services/monitoring/monitoring.service.ts              | 190-217     | Reads are overview/series/dbVitals only          | No per-core latency/error/queue measurement or pressure formula | No bottleneck attribution                              | Core metrics minute/hour + documented pressure-v1 formula; UNKNOWN when unmeasurable                                          | pressure domain + PG tests            | OPEN         |
| F-03 | P1       | I-89         | same                    | docs/admin-monitoring-01-migration.sql                             | 48-128      | Only request/instance tables                     | Core history never modeled                                      | No per-core trend over 1h…90d                          | core_metrics_minute/hour + rollup/prune in additive migration; add 30d range                                                  | admin-core-monitoring-01.pg.test.ts   | OPEN         |
| F-04 | P1       | F-51..54     | same                    | apps/admin/hooks/use-admin-monitor.ts                              | 121-133     | 10s polling; SSE removed 12 Nov (no consumer)    | Stream lacked a real consumer                                   | No live state, no reconnect/stale visibility           | Authenticated SSE `/api/admin/monitor/stream` + real frontend consumer + backoff reconnect + fallback polling + connection UI | stream HTTP tests + client unit tests | OPEN         |
| F-05 | P2       | F-57/59      | same                    | apps/admin/hooks/use-admin-monitor.ts                              | 135-149     | series staleTime 60s, no refetch                 | History query never refreshed                                   | Stale chart beside live totals                         | Stream updates series cache; fallback refetch interval                                                                        | wiring guard + client test            | OPEN         |
| F-06 | P2       | G-68/J-93    | same                    | apps/admin/app/[lang]/(admin)/operations/monitor/monitor-panel.tsx | 482-498     | div bars, slice(-120), title-only                | Recharts wrapper never adopted in admin                         | No tooltip/axis/exact values                           | Shared `TrendChart` on existing `ChartContainer` (recharts already in @hisabche/ui)                                           | ui component test + wiring guard      | OPEN         |
| F-08 | P1       | I-90         | same                    | backend/src/services/monitoring/monitoring.service.ts              | 393-422     | alertValue knows 6 infra metrics only            | No core rules, no event history                                 | Alerts say «system slow», not which core/why           | Extend rules with core_id + core metrics; metric_alert_events (raised/resolved, evidence, cooldown); one evaluator            | alert dedup/resolve unit + PG tests   | OPEN         |
| F-09 | P2       | G-70/I-84    | same                    | docs/admin-monitoring-01-migration.sql                             | 449-464     | DISTINCT ON last 10 min                          | Offline instances vanish                                        | Owner cannot see a dead instance                       | Join heartbeat registry + lastSeen/offline state; process_role column                                                         | multi-instance unit test              | OPEN         |
| F-10 | P2       | G-70/I-85    | /operations?tab=jobs    | backend/src/services/job.service.ts                                | 251-298     | getStats count:'estimated'; jobs outside monitor | No worker/job core metrics                                      | Queue pressure invisible in unified view               | Jobs core: exact counts (pending/processing/failed/stuck) in snapshot + history                                               | jobs metrics unit test                | OPEN         |
| F-11 | P1       | F-60         | same                    | apps/admin/.../monitor-panel.tsx                                   | 102,475-479 | `const { data: series }` ignores isError         | Error and empty collapsed (CLAUDE §7.3)                         | Failed read shows «no history»                         | Separate error branch with retry                                                                                              | wiring guard                          | OPEN         |
| F-12 | P2       | E-49/J-97/98 | same                    | apps/admin/.../monitor-panel.tsx                                   | 62-72       | local formatBytes                                | Shared formatting not used                                      | Inconsistent units/locale                              | Use `@hisabche/formatting` formatBytes (null → UNKNOWN, never 0)                                                              | wiring guard                          | OPEN         |
| F-13 | P2       | J-91/98      | same                    | apps/admin/.../monitor-panel.tsx                                   | 814-824     | local Kpi div                                    | Shared KpiCard not used                                         | Visual drift from product                              | Use `KpiCard`/`KpiGrid`                                                                                                       | wiring guard                          | OPEN         |
| F-15 | P2       | I-82/J-100   | —                       | docs/admin/                                                        | —           | No monitoring docs                               | Documentation never written                                     | No runbook/ownership                                   | 5 mission docs + registry doc                                                                                                 | doc existence guard                   | OPEN         |
| F-16 | P2       | C-24         | same                    | apps/admin/.../monitor-panel.tsx                                   | 96-116      | No search input                                  | Monitor never had searchable entities                           | Cannot find a core/route quickly                       | Core search + group filter in ranking table                                                                                   | wiring guard                          | OPEN         |
| F-19 | P1       | J-99         | —                       | apps/admin/src/**tests**/                                          | —           | No monitor tests                                 | Frontend monitoring untested                                    | Regressions ship silently                              | Stream client unit tests + wiring/i18n guards + backend stream/pressure/collector tests                                       | new suites                            | OPEN         |

Notes:

- No P0 found: authentication, authorization, step-up, PII and token handling are sound (Group H all PASS).
- NOT_VERIFIED items (25, 64, 67) need load/profiling/build evidence that this mission's rules forbid producing locally (no production build); they remain explicitly NOT_VERIFIED, never PASS.
- The job-authority guard already classifies `routes/admin-monitor.routes.ts` as a legitimate SSE sampler location (`job-authority-guard.test.ts:155`), so the stream returns without a new timer authority.
