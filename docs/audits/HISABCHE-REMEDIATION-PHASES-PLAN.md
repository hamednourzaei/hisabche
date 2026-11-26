# Hisabche — Phased Engineering Remediation, Gap Discovery & Quality Enforcement Plan

> **Mission:** Autonomous remediation of confirmed audit defects, independent gap discovery across dependency graphs, permanent engineering rules in `AGENTS.md` and `CLAUDE.md`, automated quality gates, and multi-layer verification.
>
> **Mandatory 8-Step Development Algorithm:**
> `Discover` -> `Model` -> `Define Invariants` -> `Reproduce` -> `Implement` -> `Verify` -> `Adversarial Review` -> `Prevent`

---

## Phase 0 — Repository Discovery & Baseline

- Inspect `HEAD`, git history relative to audited commit `f884673fa148cc699d23818ff9725b5ddb0c6604`, working tree (`git status --short`, `git diff --stat`), `AGENTS.md`, `CLAUDE.md`, `docs/MIGRATIONS-REGISTRY.json`, `docs/MIGRATIONS-PENDING.md`, and `pnpm code-intel prepare`.
- Distinguish already-fixed items, reproducible findings, obsolete items, and `NEEDS_OWNER_DECISION` items.
- **Deliverable:** `docs/audits/HISABCHE-ENGINEERING-REMEDIATION-BASELINE.md` + `PROGRESS.md`.

---

## Phase 1 — Fix All Previously Identified Defects (Workstreams A–J)

### Workstream A — Payment Security & Processor State (`P0`)

- Files: `backend/src/routes/payments.routes.ts`, `backend/src/routes/payment-webhook.routes.ts`, payment services/repositories, `docs/payment-gateway-events-02-rpc-migration.sql`, tests.
- Enforce trust boundary: `/payments/:id/processor-state` must reject unverified final states (`captured`, `declined`, `voided`) from ordinary `payment.record` callers; require trusted HMAC webhook or explicit audited admin override capability.
- Atomic state + event writes, genuine replay idempotency, provenance metadata (`signature_verified`, actor/reason), and settlement reconciliation distinction.
- Tests: forged capture rejected, valid HMAC webhook accepted, invalid signature rejected, replay idempotent, concurrent transitions, rollback on event/state failure, unauthorized override rejected.

### Workstream B — Accounting & Cross-Core Reconciliation (`P0/P1`)

- Files: `backend/src/services/accounting/cross-core-reconcile.ts`, accounting schemas/services, invoice/payment/order-deposit services, currency definitions.
- Dimensional audit of all money fields (`Minor`, `minor`, `amount_minor`, `debit`, `credit`, `amount`, `allocated`, `unallocated`).
- Fix decimal journal interpretation, multi-decimal currencies (USD/AFN/IRT/XAU), `*Minor` major-unit mismatches, deposit vs payment unit comparisons, cross-currency grouping/conversion, `advanceLiabilityMismatch`, actual debit/credit amount checks, missing pending invoice postings, overpayments/partial allocations.
- Tests: USD, AFN, IRT, XAU (3 decimals), large safe-integer bounds, cross-currency deposit/payment, partial/full advances, overpayments, wrong-amount existing journal, balanced decimal journal, unbalanced journal.

### Workstream C — Migration Registry & Execution Order (`P1`)

- Files: `docs/MIGRATIONS-REGISTRY.json`, `docs/MIGRATIONS-PENDING.md`, migration SQLs (`budget-currency*`, `project-change-orders*`, `support-tickets*`, `payment-gateway-events*`), `backend/src/__tests__/v100-hardening-migrations.pg.test.ts`, migration ledger tests.
- Validate/fix dependency declarations, ordering, `VERIFY-*` and `*.pg.test.ts` links, `budget-currency-02` USD default preservation, `fx_rate` constraint safety, and build/extend automated migration consistency checker (no cycles, all files registered, all deps ordered).

### Workstream D — Project Change Orders & Budget Governance (`P1`)

- Files: `backend/src/routes/project.routes.ts`, `backend/src/routes/admin-ops.routes.ts`, `backend/src/services/admin/admin-control-plane.service.ts`, `packages/api/src/hooks/extended-capabilities.ts`, `backend/src/domains/admin-rbac.domain.ts`, migrations/tests.
- Fix idempotency race, explicit DB replay result (remove `Date.now() - created_at > 500ms` heuristic), atomic budget+change-order mutation, dedicated budget approval capability (not `operations.jobs.run`), workspace base currency fallback, failed lookup error propagation, `expected_version` concurrency guard, TanStack Query invalidation, and audit records.

### Workstream E — Support Tickets & SLA (`P1`)

- Files: `docs/support-tickets-03-atomic-sla-migration.sql`, `backend/src/routes/escalation.routes.ts`, support services, `fake-supabase.ts`, support PG tests.
- Idempotent `escalated` transition (no repeated `escalation_level` increment or duplicate events), atomic ticket+event and assignment+event, collision-resistant ticket codes, real notification delivery state (`sent`/`failed`/retry via existing worker/outbox), system actor attribution, SQL/fake parity.

### Workstream F — Payment Webhook Event Telemetry & Admin UI (`P1/P2`)

- Files: `backend/src/routes/payment-webhook.routes.ts`, `backend/src/routes/payments.routes.ts`, `backend/src/routes/admin-ops.routes.ts`, `backend/src/services/admin/admin-control-plane.service.ts`, `packages/ui/src/components/ui/extended-ops/admin-gateway-events-panel.tsx` (and `apps/admin` ops panel).
- Observable invalid signature telemetry without mutating payment state; distinguish verified, invalid-signature, internal override, replayed, and failed events; align UI filters with DB statuses; scale `amount_minor` by currency precision; accurate local-reconciliation labels; `pending_capture` not marked reconciled; pagination and audit reason persistence.

### Workstream G — Restore Preview & Validation (`P1`)

- Files: `backend/src/routes/workspace.routes.ts` and restore preview tests.
- Exact mutually-exclusive row classification (`CREATE`, `SKIP`, `REJECT`), sum equals input count, valid UUID/workspace/currency/minor-unit validation, dependency query failure reported as incomplete/unavailable (never fake broken FK), preserve disabled restore execution.

### Workstream H — Admin Metrics, UI & Query Reliability (`P2`)

- Files: `admin-*-ops-panel.tsx`, `admin-control-plane.service.ts`, `admin.service.ts`, `invoice-drafts-button.tsx`, `packages/api/src/hooks/extended-capabilities.ts`, `till-loyalty-panel.tsx`, i18n (`fa`, `af`, `en`).
- Semantic metric fixes (Pending Reviews != `activeDevices`), failed queries never render as zero, workspace-change invalidation, full `fa`/`af`/`en` enum localization, bounded-history pagination, stale-while-error preservation in `invoice-drafts-button.tsx`, honest local reconciliation labels.

### Workstream I — AI Financial Reporting & Currency Correctness (`P1`)

- Files: `backend/src/services/ai.service.ts`, `backend/src/plugins/job-scheduler.plugin.ts`.
- Never silently drop or mix foreign currencies; prevent negative-debt overpayment offset; align status filters across periods; attach currency labels & exchange-rate provenance; use authoritative workspace base currency fallback.

### Workstream J — Concurrency & Reversal Coverage (`P1`)

- Files: `backend/src/utils/concurrency-safety-map.ts`, `backend/src/__tests__/reversal-ledger.test.ts`.
- Fix incorrect idempotency declarations, add missing routes (payment webhook, workspace change orders), and make route discovery independent of the map so omitted routes fail the check.

---

## Phase 2 — Independent Gap Discovery Engine

- Expand dependency graphs from modified files (`UI -> Hook -> API -> Route -> Guard -> Service -> Repo -> SQL/RPC -> Table/Trigger -> Audit -> Reconciliation`).
- Execute Algorithms A–J (Contract-to-Implementation, Money Dimensional Analysis, Tenant/Auth Matrix, Transaction Failure Injection, State-Machine Verification, Schema Drift, Test Quality, Offline/Local-First, UI Semantic Consistency, Observability).
- Global pattern sweeps (`Math.round`, `Number(`, `parseFloat`, `amount_minor`, `processor_state`, `signature_verified`, `idempotency`, `Date.now()`, `SECURITY DEFINER`, `workspace_id`, `invalidateQueries`, raw enums).
- **Deliverable:** `docs/audits/HISABCHE-INDEPENDENT-GAP-DISCOVERY.md`.

---

## Phase 3 — Permanent Engineering Rules (`AGENTS.md` & `CLAUDE.md`)

- Preserve existing repo rules and integrate:
  - Pre-implementation 10-step algorithm & Post-implementation 10-step verification algorithm.
  - Permanent financial, security, database, UI, testing rules, and stop conditions.
  - Hard-won project lessons from recent live/audit fixes (storage bucket auto-ensure, ES256 JWKS signing secret derivation, signed `<img>` content URLs bypassing global auth hook only with `sig`, Realtime token+StrictMode settle guards, currency/metal neutrality, SQL self-containment).

---

## Phase 4 — Automated Quality Gates

- Extend existing checkers/tests conservatively for: migration registry & dependency graph, independent route coverage, financial unit boundaries, payment final-state trust boundary, enum localization parity, and query invalidation checks.
- **Deliverable:** `docs/audits/HISABCHE-QUALITY-GATES.md`.

---

## Phase 5 & 6 — Multi-Layer Verification, Final Sweep & Report

- Run unit tests, `*.pg.test.ts` (note environment constraints honestly if elevated Windows shell blocks embedded-postgres), API `app.inject()` integration tests, UI component tests, `tsc --noEmit`, `eslint`, `git diff --check`, `pnpm code-intel update`.
- Repeat Phase 2 discovery sweep on final diff.
- **Deliverables:** Updated `PROGRESS.md` + `docs/audits/HISABCHE-ENGINEERING-REMEDIATION-REPORT.md` + concise evidence-based Persian summary.
