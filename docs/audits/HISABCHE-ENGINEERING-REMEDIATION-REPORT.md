# Hisabche — Engineering Remediation Report

- **Start `HEAD`:** `0e74320d778e8898c4b8cd6fd520c04dcee51028` (`fixed adminpanel 28`)
- **Audited Reference Commit:** `f884673fa148cc699d23818ff9725b5ddb0c6604` (`fixed adminpanel 26`, verified ancestor of `HEAD`)
- **Status:** `IMPLEMENTED_NOT_FULLY_VERIFIED` (Unit, HTTP `app.inject()`, TypeScript, ESLint, and registry gates verified; `*.pg.test.ts` real-Postgres execution blocked on elevated Windows shell; live Supabase DDL requires human execution).

## Summary of Remediations (Workstreams A–J + Phase 2 Discoveries)

1. **Payment Security & Telemetry (A, F):** Enforced final-state trust boundary on `POST /api/payments/:id/processor-state` via `transition_payment_processor_state` (`FOR UPDATE`, `idempotencyKey`, `adminOverride` + `payment.cancel`/`workspace.manage` + audit log), fixed `reconcile-settlement` so unverified captures and `pending_capture` never report `reconciled: true`, converted `gateway-reconciliation` totals via `majorToMinor`, and logged `rejected_signature` / `failed` telemetry in `payment-webhook.routes.ts`.
2. **Accounting & Cross-Core Reconciliation (B):** Created `backend/src/utils/money-units.ts` (`majorToMinor` using `@hisabche/formatting` `FRACTION_DIGITS`), converted all invoice/payment/allocation/journal amounts to integer minor units, grouped ledger debits/credits per currency, verified actual posted amounts (`JOURNAL_AMOUNT_MISMATCH`), included eligible pending invoices, and fixed `advanceLiabilityMismatch` to measure per-deposit variance.
3. **Migration Registry & Order (C):** Fixed `scripts/migrations/generate-registry.mjs` suffix regex, root-file linking, DAG cycle check, and `-- Rollback:` stripping; fixed `docs/budget-currency-02-any-unit-migration.sql` default and `budgets_fx_check`; regenerated `MIGRATIONS-REGISTRY.json` and `MIGRATIONS-PENDING.md`.
4. **Project Change Orders & Governance (D):** Added `docs/project-change-orders-04-idempotent-lock-migration.sql` (`create_project_change_order_v2` locking `projects FOR UPDATE` before idempotency check, explicit `replay`), removed `500ms` heuristic in `project.routes.ts`, added `projects.change_orders.decide` RBAC permission (`SUPER` only), and added TanStack Query invalidation to `useCreateChangeOrder` / `useDecideChangeOrder`.
5. **Support Tickets & SLA (E):** Fixed `support-tickets-03` (`escalated` idempotency, system actor `NULL`, `sent`/`failed` `notification_status`), added `support-tickets-04` (`create_support_ticket_atomic`, `assign_support_ticket_atomic`), and collision-resistant ticket codes in `escalation.routes.ts`.
6. **Restore Preview (G):** Enforced mutually exclusive `CREATE`/`SKIP`/`REJECT` row sets, UUID validation before DB queries, `isKnownCurrencyCode`, minor-unit field checks, and `failedTargetTables` guard against false `BROKEN_FOREIGN_KEY` errors.
7. **Admin UI, Drafts & AI Reporting (H, I, J):** Fixed `pendingReviews` metric (`admin-devices-ops-panel.tsx`), cleared stale reconcile report on workspace change (`admin-financial-integrity-panel.tsx`), localized status & scaled `amount_minor` (`admin-gateway-events-panel.tsx`), preserved cached drafts on background refetch error (`invoice-drafts-button.tsx`), clamped negative overpayment debt & reported excluded currencies (`ai.service.ts`), and updated `concurrency-safety-map.ts`.

## New Additive Migrations Requiring Human Application

1. `docs/payment-gateway-events-03-atomic-internal-migration.sql` (`docs/VERIFY-payment-gateway-events-03.sql`) — **PENDING HUMAN CONFIRMATION**
2. `docs/project-change-orders-04-idempotent-lock-migration.sql` (`docs/VERIFY-project-change-orders-04.sql`) — **PENDING HUMAN CONFIRMATION**
3. `docs/support-tickets-04-atomic-create-assign-migration.sql` (`docs/VERIFY-support-tickets-04.sql`) — **PENDING HUMAN CONFIRMATION**
4. Updated: `docs/budget-currency-02-any-unit-migration.sql`, `docs/support-tickets-03-atomic-sla-migration.sql` — **PENDING HUMAN CONFIRMATION**
