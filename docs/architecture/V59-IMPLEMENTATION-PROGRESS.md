# HISABCHE V59 — IMPLEMENTATION PROGRESS

**Started:** 2026-11-11  
**Baseline HEAD:** `71b08dfb3709d47502c7fee9703f38a5c8675c6c`  
**Execution Model:** Single final verification (Section 11). Zero test/typecheck/lint runs during Slices 1–8.

---

## Slice 0 — Phase 0 Local Reconciliation & Preflight Audit

- **Status:** COMPLETED (static)
- **Files created:**
  - `docs/architecture/V59-PREFLIGHT-AUDIT.md`
  - `docs/architecture/V59-IMPLEMENTATION-PROGRESS.md`
- **Key findings:** Local HEAD `71b08dfb` is ahead of remote `b30f259c`. Seven working-tree files + three untracked audit files preserved. Four `operational-dna` / presentation / vocabulary gaps, plus concrete domain gaps in all 6 trades verified directly from source.
- **Next slice:** Slice 1 — Foundations (W1, W2, W3, W4, W6) + Mandatory Static Review Gate.

## Slice 1 — Foundations (W1 Vocabulary, W2 DNA & Presentation Profile, W3 Independence, W4 Start Screens, W6 Local Persistence)

- **Status:** IMPLEMENTED_NOT_LIVE_VERIFIED (pending Section 11 verification; Mandatory Static Review Gate completed cleanly)
- **Files changed / added:**
  - `packages/validation/src/schemas/business-capabilities.ts` (added `resolveCapabilityPlan`, `evaluateFeatureAccess`)
  - `packages/validation/src/schemas/operational-dna.ts` (extended `workforceModelEnum` with `UNRESOLVED`, added `staffArrangementEnum`, `SALON_MULTI_STAFF`, extended `terminologyProfileSchema` + declarative `presentationProfileSchema`, delegated `resolveDnaCapabilities` to `resolveCapabilityPlan`, stopped guessing `HOURLY_STAFF` from `hasStaff=yes`)
  - `packages/validation/src/schemas/feature-registry.ts` & `packages/validation/src/schemas/offline-endpoint-matrix.ts` (added local `settings.operational_profile_edit` and enabled `/workspace/*profile*` offline routes)
  - `packages/validation/src/index.ts` (exported new W1–W4 functions/types)
  - `packages/app-bridge/src/local-schema.ts` & `packages/app-bridge/src/local-migrations.ts` (SQLite `SCHEMA_VERSION = 23` + `V23_OPERATIONAL_PROFILE`)
  - `packages/local-engine/src/routes/workspace-profile.ts` & `packages/local-engine/src/index.ts` (offline versioned operational DNA + onboarding progress persistence with `OPERATIONAL_PROFILE_CHANGED` 409 check)
  - `packages/ui/src/hooks/use-terminology.ts` (added `useTerminology()` hook with `DNA -> trade -> generic -> locale` fallback)
  - `packages/ui/src/components/ui/add-product-modal.tsx`, `onboarding/operating-questions.tsx`, `dashboard/DashboardRegistry.ts`, `dashboard/containers/dashboard-container.tsx`, `lib/menu/dna-menu-suggestion.ts`
  - `packages/i18n/messages/{fa,af,en}/common.json` (added W1/W2/W4 keys across all 3 locales with 0 new drift)
- **Tests written (not yet run):**
  - `packages/validation/src/__tests__/operational-dna.test.ts` (updated + `UNRESOLVED` workforce test)
  - `packages/validation/src/__tests__/foundation-w1-w4.test.ts`
  - `packages/local-engine/src/__tests__/workspace-profile.test.ts`
  - `packages/ui/src/__tests__/foundation-role-start-and-terminology.test.ts`
- **Static Review Gate Findings:** Public signatures preserved; zero import cycles (`business-capabilities.ts` imports nothing above it); `serverFeatures` count (77) and `ALWAYS_WITH_A_WRITE` guards respected; `UNRESOLVED` never falls back to retail.
- **Next slice:** Slice 2 — Clothing Trade (8.1).

## Slice 2 — Clothing Trade (8.1)

- **Status:** IMPLEMENTED_NOT_LIVE_VERIFIED (pending Section 11 verification)
- **Files changed / added:**
  - `packages/validation/src/schemas/universal-core/variants.domain.ts` (added `checkVariantAtpAvailability` combining variant stock + active unexpired holds, and `summarizeVariantStockReport` grouping by size/colour/brand with null-safe unknown margins)
  - `packages/validation/src/schemas/universal-core/return-disposition.domain.ts` & `packages/validation/src/index.ts` (added `routeReturnConditionDisposition` for sellable/quarantine/scrap routing without bypassing `stock.adjust`)
- **Tests written (not yet run):**
  - `packages/validation/src/__tests__/clothing-workflow.test.ts`
- **Next slice:** Slice 3 — Salon Trade (8.2).

## Slice 3 — Salon Trade (8.2)

- **Status:** IMPLEMENTED_NOT_LIVE_VERIFIED (pending Section 11 verification)
- **Files changed / added:**
  - `packages/validation/src/schemas/salon.ts` (added `allocateCommissionShares` refusing ambiguous multi-provider splits with `COMMISSION_MULTI_PROVIDER_ALLOCATION_REQUIRED`, plus `summarizeSalonOperations` with null-safe unknown service profit)
  - `packages/validation/src/schemas/universal-core/service-delivery.domain.ts` (added `canonicalSessionStageLabelKey` preserving canonical `chk_service_delivery_status` DB enum)
  - `backend/src/services/salon/salon.service.ts` & `backend/src/routes/salon.routes.ts` & `packages/validation/src/schemas/offline-endpoint-matrix.ts` (added `myCommission` / `GET /api/provider-commissions/my` so stylists view only own commission lines without accessing others' pay/rates)
  - `packages/ui/src/components/ui/business-packs/salon-sections.tsx` (gated rate editor behind `payroll.write`)
- **Tests written (not yet run):**
  - `packages/validation/src/__tests__/salon-workflow.test.ts`
  - `backend/src/__tests__/salon-commission-access.test.ts`
- **Next slice:** Slice 4 — Mobile Shop Trade (8.3).

## Slice 4 — Mobile Shop Trade (8.3)

- **Status:** IMPLEMENTED_NOT_LIVE_VERIFIED (pending Section 11 verification)
- **Files changed / added:**
  - `packages/validation/src/schemas/universal-core/serial-batch.domain.ts` (added `reserved`/`scrapped` statuses, `reservedForCustomerId` enforcement in `validateSerialSale`, `parseBulkImeis`, `routeReturnedSerial`, and `resolveOfflineSerialSyncConflict` producing `PENDING_REVIEW`)
  - `backend/src/services/traceability/traceability.service.ts` (workspace-wide IMEI uniqueness on `receiveSerials`, reservation-aware sale assignment in `assignSerialsToSale`)
  - `packages/local-engine/src/routes/serials.ts` (workspace-wide IMEI uniqueness check offline)
  - `packages/ui/src/components/ui/invoices/warranties-section.tsx` & `warehouse-detail-container.tsx` (Warranty → Repair Ticket handoff action)
- **Tests written (not yet run):**
  - `packages/validation/src/__tests__/mobile-imei-workflow.test.ts`
  - `packages/local-engine/src/__tests__/serial-imei-parity.test.ts`
- **Next slice:** Slice 5 — Repair Shop Trade (8.4).

## Slice 5 — Repair Shop Trade (8.4)

- **Status:** IMPLEMENTED_NOT_LIVE_VERIFIED (pending Section 11 verification; offline matrix stays `online_required` honestly)
- **Files changed / added:**
  - `packages/validation/src/schemas/repair-tickets.ts` (added `repairDisplayStage`, `canConsumePartsOnRepair`, `repairPartReservationInput`, `splitRepairInvoiceRevenue`, `summarizeRepairMetrics` preserving canonical DB `REPAIR_STATUSES`)
- **Tests written (not yet run):**
  - `packages/validation/src/__tests__/repair-workflow.test.ts`
- **Next slice:** Slice 6 — Gold Trade (8.5).

## Slice 6 — Gold Trade (8.5)

- **Status:** IMPLEMENTED_NOT_LIVE_VERIFIED (pending Section 11 verification; `gold_purity` & `making_charges` kept `partial` until DB snapshot columns exist per owner honesty gate)
- **Files changed / added:**
  - `packages/validation/src/schemas/universal-core/gold-jewellery.domain.ts` (added integer milligram weights, `validateGoldItemWeights`, `LockedMetalRateSnapshot`, BigInt `priceGoldLineWithSnapshot`, `planSecondHandGoldPurchase`, `recordGoldMeltScrapMovement`, `summarizeGoldReportByKarat`, `reconcileGoldLocationWeights`)
  - `packages/validation/src/schemas/pricing.ts` (added `quoteGoldItemPrice` wiring gold snapshot pricing through unified `quotePrice` / `applyPrice` pipeline)
- **Tests written (not yet run):**
  - `packages/validation/src/__tests__/gold-workflow.test.ts`
- **Next slice:** Slice 7 — Currency Exchange Trade (8.6) incl. additive migration + VERIFY + PG test.

## Slice 7 — Currency Exchange Trade (8.6)

- **Status:** IMPLEMENTED_NOT_LIVE_VERIFIED (pending Section 11 verification; offline remittances & FX trades stay `online_required`, offline short-sell conflict rule routes to `PENDING_REVIEW`; live Supabase DDL not executed)
- **Files changed / added:**
  - `packages/validation/src/schemas/currency-exchange.ts` (added `crossExchangeAtRates`, `fxCashboxReconcileSchema`, `reconcileCurrencyCashbox`, `resolveOfflineFxConflict`, `summarizeExchangeOperations`)
  - `docs/exchange-02-migration.sql` & `docs/VERIFY-exchange-02.sql` (idempotent `fx_cashbox_reconciliations` + `fx_reconcile_cashbox` RPC with `pg_advisory_xact_lock`, RLS, `REVOKE ALL`, `GRANT SELECT` / `GRANT EXECUTE`, `ROLLBACK` block; Status: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`)
  - `backend/src/services/exchange/exchange.service.ts` & `backend/src/routes/exchange.routes.ts` (added `GET /api/fx/reconciliations` and `POST /api/fx/reconciliations`)
  - `backend/src/utils/concurrency-safety-map.ts` & `backend/src/__tests__/reversal-ledger.test.ts` & `packages/validation/src/schemas/offline-endpoint-matrix.ts` (registered concurrency mechanisms, reversal ledger entry, and offline matrix rows)
  - `packages/api/src/hooks/business-packs.ts` (`FxCashboxReconciliation`, `useFxReconciliations`, `useReconcileFxCashbox`)
  - `packages/ui/src/components/ui/business-packs/exchange-section.tsx` (per-currency physical cashbox reconciliation panel + table inside `PositionsView`)
  - `packages/i18n/messages/{fa,af,en}/common.json` (added `repairs.createFromWarranty` + `exchange.*` reconciliation keys across all 3 locales)
- **Tests written (not yet run):**
  - `packages/validation/src/__tests__/exchange-workflow.test.ts`
  - `backend/src/__tests__/exchange-02.pg.test.ts`
- **Next slice:** Slice 8 — Documentation Closure & Preparation for Section 11 Single Final Verification.

## Slice 8 — Documentation Closure & Section 11 Single Final Verification

- **Status:** COMPLETED (`VERIFIED_WITH_LIMITATIONS` — unit/UI/local-engine/backend-unit/validation suites green; `pg` suite blocked on missing `initdb.exe` binary; live DB not touched)
- **Files created / updated:**
  - `scripts/industry/coverage-data.mjs` (added `UNIVERSAL_GOLD_SNAPSHOT`, set honest `PARTIALLY_SUPPORTED` for `goldPurity` & `makingCharges`)
  - `docs/architecture/capability-matrix.csv` & `docs/architecture/universal-core/INDUSTRY-COVERAGE-TABLE.{md,csv}` (regenerated via repo scripts)
  - `docs/architecture/V59-TERMINOLOGY-CONSUMER-INVENTORY.md`
  - `docs/architecture/V59-TRADE-ACCEPTANCE-MATRIX.md`
  - `docs/architecture/V59-UNIVERSAL-BUSINESS-IMPLEMENTATION-REPORT.md`
  - `docs/architecture/OPERATIONAL-DNA-MATRIX.md`, `ARCHETYPE-COVERAGE-MATRIX.md`, `CROSS-PLATFORM-SHARED-CORE.md` (appended V59 reconciliation addenda)
- **Section 11 V7 Fixes Applied & Verified:**
  - Fixed `packages/validation/src/schemas/operational-dna.ts` (`resolveTerminologyProfile` priority for trade vocabulary vs generic preset defaults + `UNRESOLVED` protection)
  - Fixed `packages/app-bridge/src/local-migrations.ts` (`V23_OPERATIONAL_PROFILE` guards `CREATE TABLE IF NOT EXISTS local_workspace` before `ALTER TABLE` for standalone v19–v22 test DB compatibility)
  - Added `useMyCommissionReport` in `packages/api/src/hooks/business-packs.ts` matching `GET /provider-commissions/my` in `offline-matrix-guard.test.ts`
  - Refactored `SalonService.myCommission` in `backend/src/services/salon/salon.service.ts` to filter by `.eq('workspace_id', ctx.workspaceId)` only in SQL and match `user_id` in TypeScript (`tenancy-static-guard.test.ts` compliance)
  - Classified `POST /api/fx/reconciliations` as `inert` in `backend/src/__tests__/reversal-ledger.test.ts` (`{ proven: 9, unproven: 22, none: 23, inert: 18 }`)

---

## V59.1 — Completion Pass (Static Phase 0 Audit & Ordered Gap Closure)

### Phase 0 — Re-verification of V59 Claims Against Source

- **Foundations & i18n parity:**
  - `[VERIFIED packages/i18n/messages/{fa,af,en}/common.json]` Baseline had `fa = 10477`, `af = 10477`, `en = 10470` due to 7+1 pre-existing `landing.security.badge.*` keys (`af`/`fa`/`en` divergence). Fixed upfront to exact 3-way parity (`10478 / 10478 / 10478`).
  - `[VERIFIED packages/ui/src/hooks/use-terminology.ts:useTerminology]` Hook exists and is wired in `packages/ui/src/components/ui/add-product-modal.tsx:useTerminology`, while `V59-TERMINOLOGY-CONSUMER-INVENTORY.md` listed `DashboardContainer`, `DashboardRegistry`, `OperatingQuestions`, `DnaMenuSuggestion`, etc. which do not yet call `useTerminology()` directly. **GAP → Item 7.**
- **8.6 Exchange (`exchange-02-migration.sql`, `currency-exchange.ts`, `exchange.service.ts`):**
  - `[VERIFIED docs/exchange-01-migration.sql:fx_trade_create,fx_trade_void,remittance_move]` Trades, voids, and remittance payouts do NOT post to the general ledger (`accounting_post_journal_entry`), have no agent settlement table/RPC/endpoint, and offline sell-short `resolveOfflineFxConflict` (`packages/validation/src/schemas/currency-exchange.ts:resolveOfflineFxConflict`) has no sync/route consumer. **GAP → Item 1.**
- **8.5 Gold (`gold-jewellery.domain.ts`, `pricing.ts`):**
  - `[VERIFIED packages/validation/src/schemas/universal-core/gold-jewellery.domain.ts:priceGoldLineWithSnapshot,planSecondHandGoldPurchase,recordGoldMeltScrapMovement,reconcileGoldLocationWeights]` Pure functions exist, `[VERIFIED packages/validation/src/schemas/pricing.ts:quoteGoldItemPrice]` exists, `[VERIFIED docs/architecture/universal-core/INDUSTRY-COVERAGE-TABLE.md:goldPurity]` shows `PARTIALLY_SUPPORTED`, and invoice-line DB snapshot columns, Sales › pricing gold board, KYC second-hand purchase, melt/scrap, and showcase/safe reconciliation routes+UI have no callers. **GAP → Item 2.**
- **8.1 Clothing (`variants.domain.ts`, `return-disposition.domain.ts`):**
  - `[VERIFIED packages/validation/src/schemas/universal-core/variants.domain.ts:checkVariantAtpAvailability,summarizeVariantStockReport]` & `[VERIFIED packages/validation/src/schemas/universal-core/return-disposition.domain.ts:routeReturnConditionDisposition]` have NO UI or backend callers (`variant-stock-panel.tsx`, invoice variant picker, return/exchange, transfer receipt discrepancy, variant reports). **GAP → Item 3.**
- **8.2 Salon (`salon.ts`, `salon.service.ts`, `salon.routes.ts`):**
  - `[VERIFIED backend/src/routes/salon.routes.ts:/api/provider-commissions/my]` & `[VERIFIED packages/api/src/hooks/business-packs.ts:useMyCommissionReport]` exist, but `useMyCommissionReport` has no UI caller; `service-delivery.domain.ts` lacks `checked_in`/`in_progress`; `summarizeSalonOperations` (`salon.ts`) has no dashboard widget consumer; no concurrent PG double-booking test exists. **GAP → Item 4.**
- **8.3 Mobile (`serial-batch.domain.ts`, `traceability.service.ts`, `local-engine/routes/serials.ts`):**
  - `[VERIFIED packages/validation/src/schemas/universal-core/serial-batch.domain.ts:parseBulkImeis,routeReturnedSerial]` have NO UI/route callers; receiving form lacks bulk paste/scan; reservation expiry/release race & IMEI return financial reversal are unwired. **GAP → Item 5.**
- **8.4 Repair (`repair-tickets.ts`, `repair-ticket.service.ts`):**
  - `[VERIFIED packages/validation/src/schemas/repair-tickets.ts:canConsumePartsOnRepair,repairPartReservationInput,splitRepairInvoiceRevenue]` have NO backend/UI callers; final bill creation & local-engine illegal transition refusal are missing. **GAP → Item 6.**

### Item 1 — Exchange → Ledger (`COMPLETED — awaiting Section 11 verification & human migration`)

- **Migration & Verification:** `docs/exchange-03-migration.sql`, `docs/VERIFY-exchange-03.sql`, `backend/src/__tests__/exchange-03.pg.test.ts` (adds `fx_vault` role in `accounts_role_check`, `pending_review` trade state, `fx_agent_settlements` table with RLS, and atomic Postgres RPCs `fx_trade_create_with_ledger`, `fx_trade_resolve_pending_review`, `fx_trade_void_with_ledger`, `remittance_payout_with_ledger`, `fx_agent_settle` calling `public.accounting_post_journal_entry`). Status: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.
- **Shared Validation & Hooks:** `packages/validation/src/schemas/{accounting.schema.ts,standard-accounts.ts,currency-exchange.ts,offline-endpoint-matrix.ts}`, `packages/api/src/hooks/business-packs.ts` (`useResolveFxTradeReview`, `useFxAgentSettlements`, `useSettleFxAgent`).
- **Backend & HTTP:** `backend/src/services/accounting/ledger.port.ts`, `backend/src/services/exchange/exchange.service.ts`, `backend/src/routes/exchange.routes.ts`, `backend/src/utils/concurrency-safety-map.ts`, `backend/src/__tests__/rls-coverage.test.ts`, `backend/src/__tests__/v59-1-exchange-gl-http.test.ts`.
- **UI & i18n:** `packages/ui/src/components/ui/business-packs/exchange-section.tsx` (GL status indicator, `pending_review` Approve/Reject UI, agent settlement form & ledger-linked banner), `packages/ui/src/lib/accounting/account-name.ts`, `packages/i18n/messages/{fa,af,en}/common.json` (replaced "outside the GL" copy in `exchange.*` and `docs.currency-exchange.positions.body2`).

### Item 2 — Gold & Jewellery (`COMPLETED — awaiting Section 11 verification & human migration`)

- **Migration & Verification:** `docs/gold-01-migration.sql`, `docs/VERIFY-gold-01.sql`, `backend/src/__tests__/gold-01.pg.test.ts` (adds `metal_rate_24k_minor`, `metal_purity_karat`, `metal_net_weight_mg`, `making_charge_minor`, `metal_rate_captured_at`, `metal_rate_captured_by` on `invoice_items`, plus `gold_operations` & `gold_location_reconciliations` tables + idempotent RPCs). Status: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.
- **Pricing & Invoice Pipeline:** `packages/validation/src/schemas/universal-core/gold-jewellery.domain.ts` (`goldLineSnapshotSchema`, operation schemas), `pricing.ts` (`quoteGoldItemPrice` + `applyPrice` carrying `goldSnapshot`), `invoice.schema.ts`, `invoice-grid.ts`, `packages/store/src/slices/invoice-draft.slice.ts` (`setRowGoldSnapshot`), `packages/ui/src/hooks/invoices/{use-promotion-pricer.ts,use-picker-rows.ts}`, `packages/ui/src/components/ui/invoice-builder/containers/invoice-builder-container.tsx`, `backend/src/services/invoice.service.ts` (`withDerivedLineTotals` + `buildItemRows`).
- **Rate Board & Gold Operations:** `backend/src/services/pricing/metal-rates.service.ts`, `backend/src/routes/metal-rates.routes.ts`, `packages/api/src/hooks/universal-core.ts`, `packages/ui/src/components/ui/promotions/{gold-rate-board-panel.tsx,promotions-container.tsx}` (Sales › pricing `goldRates` tab), `packages/ui/src/__tests__/unwired-capability-hooks.test.ts`.
- **Tests Written (not yet run):** `packages/validation/src/__tests__/gold-snapshot-pricing.test.ts`, `backend/src/__tests__/v59-1-gold-routes-http.test.ts`, `backend/src/__tests__/gold-01.pg.test.ts` (`goldPurity` & `makingCharges` remain `PARTIALLY_SUPPORTED` until verified).

### Item 3 — Clothing (`COMPLETED — awaiting Section 11 verification`)

- **ATP Variant Availability:** `backend/src/services/product/variant.service.ts` (`activeReservations`), `packages/api/src/hooks/business-packs.ts` (`VariantStockView.reservations`), `packages/ui/src/components/ui/business-packs/variant-stock-panel.tsx` & `packages/ui/src/components/ui/invoice-builder/row-variant-picker.tsx` (wired `checkVariantAtpAvailability`).
- **Condition-Routed Return & Exchange:** `backend/src/routes/invoice-return.routes.ts` (`POST /api/invoices/:id/returns` & `POST /api/invoices/:id/exchange` routing exact variant condition via `routeReturnConditionDisposition` -> `InvoiceReturnService.createReturn` + `InvoiceService.create`), `backend/src/utils/concurrency-safety-map.ts`, `packages/validation/src/schemas/offline-endpoint-matrix.ts`.
- **Transfer Receipt Discrepancy:** `backend/src/routes/warehouse.routes.ts`, `backend/src/services/warehouse/transfer.service.ts` (`receivedLines` validation & discrepancy notes), `packages/api/src/hooks/business-packs.ts`, `packages/ui/src/components/ui/business-packs/transfer-requests-section.tsx`.
- **Size / Colour / Brand Report Owner:** `backend/src/services/accounting/{accounting.service.ts,accounting.repository.ts}` (`getVariantStockReport` calling `summarizeVariantStockReport`), `backend/src/routes/accounting.routes.ts` (`GET /profit-report/variants`), `packages/api/src/hooks/accounting.ts` (`useVariantAttributeReport`), `packages/ui/src/components/ui/accounting/tabs/IncomeStatementTab.tsx`.
- **Tests Written (not yet run):** `backend/src/__tests__/v59-1-clothing-routes-http.test.ts`.

### Item 4 — Salon (`COMPLETED — awaiting Section 11 verification & human migration`)

- **Migration & Verification:** `docs/salon-02-migration.sql`, `docs/VERIFY-salon-02.sql`, `backend/src/__tests__/salon-02.pg.test.ts` (adds `'checked_in'` status, append-only `service_delivery_status_audit` + trigger with RLS, concurrent practitioner advisory lock guard `service_sessions_practitioner_guard`, `service_delivery_move_status` RPC). Status: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.
- **Workflow, Sync & UI:** `packages/validation/src/schemas/universal-core/service-delivery.domain.ts` (`checked_in` -> `in_progress`, `canonicalSessionStageLabelKey`), `packages/ui/src/components/ui/service-delivery/{service-delivery-model.ts,service-delivery-view.tsx}`, `packages/app-shell/src/features/sync/sync-engine.ts`, `packages/local-engine/src/routes/service-delivery.ts` + `packages/app-bridge/src/{local-schema.ts,local-universal-core-schema.ts,local-migrations.ts}` (`V24_SERVICE_STATUS_AUDIT`), `backend/src/services/service-delivery/service-delivery.service.ts` (`logBusinessEvent` transition audit).
- **Commission & Dashboard:** `packages/api/src/hooks/business-packs.ts` + `packages/ui/src/components/ui/business-packs/salon-sections.tsx` (`CommissionSection` stylist self-commission `useMyCommissionReport` + team/my `SegmentedControl`), `packages/ui/src/components/ui/dashboard/{salon-operations-card.tsx,containers/dashboard-container.tsx}` (`SalonOperationsCard` wired to `summarizeSalonOperations`).
- **Tests Written (not yet run):** `packages/validation/src/__tests__/session-status-move.domain.test.ts`, `packages/local-engine/src/__tests__/service-session-status-move.test.ts`, `backend/src/__tests__/salon-02.pg.test.ts`, `backend/src/__tests__/rls-coverage.test.ts`.

### Item 5 — Mobile & Serialized Devices (`COMPLETED — awaiting Section 11 verification & human migration`)

- **Migration & Verification:** `docs/mobile-serial-01-migration.sql`, `docs/VERIFY-mobile-serial-01.sql`, `backend/src/__tests__/mobile-serial-01.pg.test.ts` (adds `reserved_until` expiry column on `stock_serials` + atomic `serial_hold_with_expiry` & `serial_release_expired_holds` RPCs). Status: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.
- **Bulk Paste, Expiry & Financial Return Reversal:**
  - `packages/validation/src/schemas/{repair-tickets.ts,offline-endpoint-matrix.ts}` (`serialHoldSchema` expiry fields, `serialReturnSchema`).
  - `backend/src/services/traceability/{lot.domain.ts,traceability.service.ts}` (`holdSerial` with atomic expiry RPC + CAS fallback, `releaseExpiredHolds`, expired-hold release inside `assignSerialsToSale`, `returnSoldSerial` triggering `InvoiceReturnService.createReturn` + `routeReturnedSerial`).
  - `backend/src/routes/{operations.routes.ts,invoice-return.routes.ts}` (`POST /api/operations/serials/holds/release-expired`, `POST /api/operations/serials/:id/return`, `serialNumbers` routing on `POST /api/invoices/:id/returns`).
  - `packages/api/src/hooks/{expiry.ts,business-packs.ts}`, `packages/ui/src/components/ui/warehouse-detail/product-serials-panel.tsx` (wired `parseBulkImeis` duplicate detection in receiving form, hold duration picker + expiry release button, sold IMEI return-to-reversal button).
- **Tests Written (not yet run):** `backend/src/__tests__/mobile-serial-01.pg.test.ts`, `backend/src/__tests__/v59-1-mobile-serials-http.test.ts`.

### Item 6 — Repair Tickets & Spare Parts (`COMPLETED — awaiting Section 11 verification & human migration`)

- **Migration & Verification:** `docs/repair-parts-01-migration.sql`, `docs/VERIFY-repair-parts-01.sql`, `backend/src/__tests__/repair-parts-01.pg.test.ts`, `backend/src/__tests__/rls-coverage.test.ts` (adds `customer_approved` columns on `repair_tickets` + RLS-protected `repair_ticket_parts` table). Status: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.
- **Spare Parts, Billing & Parity:**
  - `packages/validation/src/schemas/{repair-tickets.ts,offline-endpoint-matrix.ts}` (`repairPartReserveSchema`, `repairBillCreateSchema`).
  - `backend/src/services/repair/repair-ticket.service.ts` + `backend/src/routes/repair.routes.ts` (`approve`, `addPart` via `repairPartReservationInput` + `ReservationService.reserve`, `consumePart` gated by `canConsumePartsOnRepair` settling reservation + calling `costing.recordIssue`, `releasePart`, `createFinalBill` calling `InvoiceService.create` + `splitRepairInvoiceRevenue` without double-deducting stock).
  - `backend/src/utils/concurrency-safety-map.ts`, `packages/api/src/hooks/business-packs.ts`, `packages/ui/src/components/ui/business-packs/{repair-tickets-section.tsx,repair-ticket-work-panel.tsx}` (`RepairTicketWorkPanel`).
  - `packages/app-bridge/src/{local-schema.ts,local-universal-core-schema.ts,local-migrations.ts}` (`V25_REPAIR_TICKETS`) + `packages/local-engine/src/{index.ts,services/repair-transitions.ts}` (`applyLocalRepairTransition`, `assertLocalRepairCanConsumeParts`).
- **Tests Written (not yet run):** `backend/src/__tests__/repair-parts-01.pg.test.ts`, `backend/src/__tests__/v59-1-repair-routes-http.test.ts`, `packages/local-engine/src/__tests__/repair-transition-parity.test.ts`.

### Item 7 — Foundations & Documentation Closure (`COMPLETED — entering Section 11 single verification pass`)

- **Terminology Rollout (`useTerminology()` / `resolveTerminologyProfile`):** Rolled out across all 5 inventoried surfaces in `docs/architecture/V59-TERMINOLOGY-CONSUMER-INVENTORY.md` (`AddProductModal`, `DashboardContainer`, `DashboardRegistry`, `OperatingQuestions`, `DnaMenuSuggestion`).
- **Tests Written (not yet run):**
  - `backend/src/__tests__/v59-1-role-archetype-refusal.test.ts` (Role × Archetype HTTP 403 `CAPABILITY_REQUIRED` enforcement through real `requireCapability`)
  - `packages/local-engine/src/__tests__/v59-1-golden-parity.test.ts` (Gold snapshot pricing, Salon check-in/audit, Mobile bulk IMEI + RMA routing, Repair transition parity)
  - `backend/src/__tests__/v59-1-two-device-replay.test.ts` (Two-device offline FX sell-short -> `pending_review`, idempotent replay, duplicate IMEI offline conflict)
- **i18n 3-Way Parity:** Synced all Item 2–7 UI keys (`fa = 10579`, `af = 10579`, `en = 10579`, 0 diffs).
- **Documentation Sync:** Updated `SUBSCRIPTION-TO-WORKSPACE-LIFECYCLE.md`, `V59-TERMINOLOGY-CONSUMER-INVENTORY.md`, `V59-TRADE-ACCEPTANCE-MATRIX.md`, `reversal-ledger.test.ts`. Next: run Section 11 verification once and record final observed results in `V59-UNIVERSAL-BUSINESS-IMPLEMENTATION-REPORT.md`.
