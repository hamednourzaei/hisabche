# Hisabche — Independent Gap Discovery Report (Phase 2)

- **Scope:** Full dependency-graph expansion from every file modified across Phase 1 (`payments`, `payment-webhook`, `accounting/cross-core-reconcile`, `project.routes`, `admin-ops.routes`, `admin-control-plane.service`, `escalation.routes`, `workspace.routes`, `ai.service`, `apps/admin/components/ops/*`, `packages/api/src/hooks/extended-capabilities.ts`, `invoice-drafts-button.tsx`, `scripts/migrations/generate-registry.mjs`).
- **Algorithms Executed:** Contract-to-Implementation (A), Money Dimensional Analysis (B), Tenant/Auth Matrix (C), Transaction Failure-Injection (D), State-Machine Verification (E), Migration Drift (F), Test Quality (G), UI Semantic Consistency (I), Operational Observability (J).

## Additional Gaps Discovered & Fixed During Phase 2

1. **`GET /api/payments/gateway-reconciliation` Unit Mixing (`P1`, Fixed):** `payments.routes.ts` previously summed `Number(p.amount)` (major units) directly into `capturedMinor` / `declinedMinor` / `voidedMinor` alongside `fee_minor` (minor units). Converted to `majorToMinor(p.amount, cur)`.
2. **`POST /api/payments/gateway/webhook/:provider` Replayed `event_id` Payload Tampering (`P1`, Fixed):** `apply_payment_gateway_event` in `fake-supabase.ts` & migration `03` lacked `payload_sha256` conflict rejection on replayed `event_id`. Added `GATEWAY_EVENT_PAYLOAD_CONFLICT`.
3. **`POST /api/admin/ops/change-orders/:id/decide` Over-Privileged Permission (`P1`, Fixed):** `OPS` role could decide tenant project budgets via `operations.jobs.run`. Added dedicated `projects.change_orders.decide` permission (`SUPER` only).
4. **Admin Financial Integrity Panel Stale Cross-Workspace Report (`P2`, Fixed):** `admin-financial-integrity-panel.tsx` retained the previous workspace's reconcile report when `workspaceId` input changed. Cleared `report` and `errorMessage` on workspace input change.
5. **Admin Gateway Events Raw Enum & Unscaled Minor Units (`P2`, Fixed):** `admin-gateway-events-panel.tsx` rendered raw English `processing_status` and unscaled `amount_minor` integers. Added localized labels (`fa`/`af`/`en`) and `FRACTION_DIGITS` scaling.
6. **Admin Devices Panel Wrong Metric (`P2`, Fixed):** `admin-devices-ops-panel.tsx` displayed `fleet.health.activeDevices` under `pendingReviews`. Changed to count actual `pending_review` / `pending` devices.
7. **Restore Preview `BROKEN_FOREIGN_KEY` on Failed Parent Query (`P1`, Fixed):** `workspace.routes.ts` pushed unresolved FK candidates into `brokenForeignKeys` even when the parent DB query failed. Added `failedTargetTables` guard plus mutually exclusive `CREATE` / `SKIP` / `REJECT` row sets and UUID format check.
8. **Migration Generator Suffix & Rollback Misclassification (`P1`, Fixed):** `scripts/migrations/generate-registry.mjs` missed `-02-any-unit`, `-02-rpc`, `-03-atomic`, `-03-atomic-sla` dependency chains and scanned `-- Rollback:` comments for `DROP`. Fixed regex, root-file linking, DAG cycle check, and rollback stripping.
9. **AI Service Overpayment Negative-Debt Offset & Silent Foreign-Currency Drop (`P1`, Fixed):** `ai.service.ts` subtracted overpayments (`total - paid_amount < 0`) from other customers' debts and silently omitted foreign currencies. Clamped per-invoice debt to `>= 0`, surfaced `foreignCurrenciesExcluded` / `foreignDebtCurrencies`, and checked Supabase query `.error`.

## Remaining Uncertainty / Owner Decisions

- `NEEDS_OWNER_DECISION`: Whether `admin-control-plane` list endpoints (`support-tickets`, `gateway-events`, `change-orders`) should transition to cursor-based pagination once rows exceed 100/page (currently bounded at `limit <= 100`).
- **Environment Blocker:** Embedded PostgreSQL (`*.pg.test.ts`) could not execute in the elevated Windows shell (`assertPostgresCanStart -> elevated`); real SQL execution of the new `03`/`04` migrations must run on Linux CI or a non-elevated shell.
