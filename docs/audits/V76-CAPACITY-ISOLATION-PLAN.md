# HISABCHE — V76: AUTONOMOUS CAPACITY, ADAPTIVE SCALE & TENANT ISOLATION ENGINEERING

> **Status:** ACTIVE_EXECUTION  
> **Strategy:** Full Adaptive Scale Testing (All 10 Suites · Adaptive Progression · Production Read-Only Reference · Isolated Benchmark Target · Priority #1: Tenant Isolation)  
> **Governance:** Strictly subordinate to `AGENTS.md` (§0, §0.5, §0.6, §0.7) and `CLAUDE.md`.

---

## Execution Phases

### Phase 1–3 — Discovery, Production Read-Only Safeguards & Isolated Environment Verification

- Inspect existing `admin-monitor.routes.ts`, `system-metrics.routes.ts`, `database-ha.routes.ts`, `apps/admin/`, `packages/ui/`, `packages/api/`, `packages/validation/`.
- Implement `backend/src/services/capacity/safety-guard.ts` (Fail-closed `DENY` default: production hostname/DB rejection, environment allowlist, explicit synthetic credentials check, global kill switch, rate/concurrency caps, non-prod assertion).
- Implement `backend/src/services/capacity/production-discovery.service.ts` (Read-only inspection of existing runtime telemetry: process CPU/RSS/heap/event-loop, DB routing overview, pool/worker telemetry; unavailable external cloud host metrics explicitly reported as `UNKNOWN` / `NOT_EXPOSED`).

### Phase 4–5 — Capacity Domain & Synthetic Dataset/Tenant Generator

- Shared contracts in `packages/validation/src/capacity-intelligence.ts` (Metric schema, Measured/Derived/Estimated/Predicted/Unavailable distinction, 10 suite definitions, Workload profiles, Safety stop triggers, Capacity 3-number model: `measuredCapacity`, `safeCapacity`, `projectedCapacity`).
- Synthetic deterministic seeded dataset & multi-tenant generator in `backend/src/services/capacity/synthetic-generator.ts` (no production data access).

### Phase 6–7 — Adaptive Benchmark Runner & All 10 Benchmark Suites

- `backend/src/services/capacity/adaptive-runner.ts` (Closed/open workload progression, warm-up/cooldown, P50/P90/P95/P99/max latency, RPS, error rate, RSS/heap/CPU/event-loop lag, hard safety stop & safe drain -> `ABORTED` / `SAFETY_STOPPED`).
- All 10 independently executable benchmark suites in `backend/src/services/capacity/suites/`:
  1. `01-cpu-saturation`
  2. `02-ram-capacity`
  3. `03-database-stress`
  4. `04-financial-transactions`
  5. `05-module-performance`
  6. `06-offline-sync`
  7. `07-concurrent-active-users`
  8. `08-large-tenant`
  9. `09-breaking-point-recovery`
  10. `10-full-production-simulation`

### Phase 8–10 — Tenant Isolation, Financial Reconciliation & Capacity Model

- `backend/src/services/capacity/isolation-analyzer.ts` (Noisy-neighbor degradation measurement across large vs small tenants, per-tenant latency/error/queue fairness).
- `backend/src/services/capacity/financial-reconciler.ts` (Double-entry debit=credit, invoice/payment totals, AFN zero-decimal verification).
- `backend/src/services/capacity/capacity-estimator.ts` (Limiting-resource capacity formula, workload-mix profiles, `INSUFFICIENT_BENCHMARK_DATA` when evidence is missing, simulation-only `projectedCapacity`).

### Phase 11–12 — Admin Panel Capacity Intelligence, API, Permissions & Telemetry Persistence

- Migration `docs/capacity-intelligence-01-migration.sql` + `docs/VERIFY-capacity-intelligence-01.sql` (without running against live Supabase!).
- Routes in `backend/src/routes/capacity.routes.ts` (protected by `authenticate` + `requirePlatformAdmin` + step-up / permission checks; benchmark execution guarded by `assertIsolatedBenchmarkEnvironment`).
- Hooks in `packages/api/src/hooks/capacity.ts`.
- Shared UI in `packages/ui/src/components/ui/admin/capacity-intelligence-panel.tsx` + `apps/admin` route + `fa`, `af`, `en` translations.

### Phase 13–15 — Automated Tests, Docs, Skills & End-to-End Verification

- Comprehensive Vitest suites for safety guards, adaptive stop conditions, kill switch, all 10 suites, tenant isolation, financial reconciliation, capacity confidence, and admin authorization.
- Operational docs + knowledge index skill capture + `tsc --noEmit`, `eslint`, `vitest`, `git diff --check`, `pnpm code-intel update`.
