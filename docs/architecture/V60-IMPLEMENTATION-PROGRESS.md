# HISABCHE V60 — IMPLEMENTATION PROGRESS

**Start Date:** 2026-11-11  
**Baseline:** Commit `71b08dfb3709d47502c7fee9703f38a5c8675c6c` + uncommitted V59 / V59.1 tree  
**Execution Rule (§1):** Implement Phase 0 and Slices 1–12 in strict order WITHOUT running tests/tsc/eslint/builds until §12.

---

## Progress Tracker

### Phase 0 — Static Reconcile & Preflight (`COMPLETED`)

- Inspected `git status --short`, `pnpm code-intel status`, `node scripts/audit-unwired-routes.mjs` (`932` routes, `716` client paths, `124` unwired), `business-capabilities.ts`, `industry-profiles.ts`, `operational-dna.ts`, `OPERATIONAL-DNA-MATRIX.md`, and V59 architecture docs.
- Created `docs/architecture/V60-PREFLIGHT-AUDIT.md` with re-verified `F1–F13`, grouped unwired-route decisions, engine map, V59.1 guard-cleanup inventory, and §9 `NEEDS_OWNER_DECISION` safe defaults.

### Slice 1 — One Operating-Questions Model (`COMPLETED`)

- Removed the duplicate `yes/no/unknown` + `single/multiple/unknown` definitions in `packages/validation/src/schemas/industry-profiles.ts` and derived `operatingCharacteristicsSchema` from `operatingAnswersSchema.pick(...)` + `characteristicsFromAnswers()` in `operational-dna.ts`.
- Exported `yesNoSchema`, `locationScopeSchema`, `LocationScope` in `operational-dna.ts` and `characteristicsFromAnswers` in `packages/validation/src/index.ts`.
- Added round-trip and source-guard tests in `packages/validation/src/__tests__/industry-profiles.test.ts` (asserting no second `z.enum(['yes', 'no', 'unknown'])` outside `operational-dna.ts`).
- Tests written (not yet run per §1). Risks: none.

### Slice 2 — Deeper DNA, Backward Compatible (`COMPLETED`)

- Extended `packages/validation/src/schemas/operational-dna.ts` with 6 optional axes (Axes 10–15: `pricingBasis`, `assetCustody`, `executionSite`, `recurrence`, `approvalDepth`, `regulatedDomain`) + `effectiveDnaAxes()` normalizing missing axes to `UNRESOLVED` (never guessing defaults).
- Added 5 adaptive yes/no questions (`holdsCustomerAssets`, `rentsOutAssets`, `worksAtCustomerSite`, `billsRecurring`, `needsApprovals`), updated `operatingQuestionsFor()`, `inferOperationalDna()`, `setupGapsOf()` (`REGULATED_DOMAIN_COMPLIANCE` + `*_UNRESOLVED` gaps), and `ModuleActivationSignals` / `resolveCapabilityPlan()` in `business-capabilities.ts`.
- Verified Postgres storage (`docs/operational-profile-01-migration.sql` uses `jsonb` < 4096 bytes) and SQLite V23 storage (`local_workspace.operational_dna TEXT` via `packages/local-engine/src/routes/workspace-profile.ts`) accept new optional axes with zero migration needed.
- Fixed UI guard issues (`packages/ui/src/components/ui/onboarding/operating-questions.tsx` inline Persian text removed; `packages/ui/src/lib/menu/dna-menu-suggestion.ts` `tradeKey` identifier renamed to `selectedIndustry`).
- Updated `docs/architecture/OPERATIONAL-DNA-MATRIX.md` to 15 axes; added tests in `packages/validation/src/__tests__/operational-dna.test.ts` (legacy compat, new axes, `regulatedDomain` compliance-only rule, 8-family adaptive question sets) and `packages/local-engine/src/__tests__/workspace-profile.test.ts` (SQLite round-trip).
- Tests written (not yet run per §1). Risks: ensure all new `onboarding.operating.questions.*`, `onboarding.operating.gaps.*`, and `common.staff` / `common.item` i18n keys are synced across `fa/af/en` in pre-§12 sweep.

### Slice 3 — Capability Registry v2 & Honesty Guard (`COMPLETED`)

- Extended `packages/validation/src/schemas/business-capabilities.ts`:
  - Added `ENGINE_KEYS` (20 canonical engines) + `ENGINES` registry recording `service`, `localEngine`, `clientHook`, `uiHost`, `matrixFeature`, and `offlineStatus` from real disk paths and `offline-endpoint-matrix.ts`.
  - Extended `CAPABILITY_KEYS` from 13 to 38 capabilities (adding all 24 V60 Slice 3 capabilities + `tiered_pricing`), added `engine: EngineKey | null` on `CapabilityDefinition`.
  - Fixed F2 (`recipe_bom` upgraded from `planned` to `partial` with `production_bom` BOM evidence and `SERVER_ONLY_NO_OFFLINE_ENGINE`) and F3 (`length_pricing`, `volume_pricing`, `area_pricing`, `roll_cutting` linked honestly to `measurement.domain.ts`, `area-dimension.domain.ts`, and `roll-batch.domain.ts` as `partial`).
  - Extended `resolveCapabilityPlan()` to map V60 Slice 2/3 orthogonal signals cleanly.
- Exported `ENGINES`, `ENGINE_KEYS`, `type EngineKey`, `type EngineDefinition`, `type EngineOfflineStatus` in `packages/validation/src/index.ts`.
- Extended existing honesty guards (`packages/validation/src/__tests__/capability-has-consumer.test.ts` and `capability-composition.test.ts`) to assert all 4 V60 rules: disk `sources`, disk `tests`, non-null engine `clientHook` + `uiHost` on disk, `OFFLINE_ENDPOINT_MATRIX` rows for `available`, and non-empty `limitations` for `partial`.
- Tests written (not yet run per §1). Risks: `node scripts/generate-capability-matrix-csv.mjs` and `node scripts/industry/generate-industry-diff.mjs` must be run in §12; `capabilities.<key>.label` + `.limitation.*` keys queued for pre-§12 3-way i18n sweep.

### Slice 4 — Problem Profile P1–P10 & Composition Algorithm (`COMPLETED`)

- Created `packages/validation/src/schemas/business-problems.ts` with `BUSINESS_PROBLEMS` (`P1–P10`), `PROBLEM_RULES`, pure step functions `problemsOf(dna)`, `requirementsOf(dna)`, and `composeBusinessSolution()` -> `CompositionPlan` delegating to the ONE `resolveCapabilityPlan()` + `resolvePresentationProfile()` while filtering planned/unsupported items out of live menus/quickActions.
- Fixed `industry-profiles.ts` (`inventoryRelevant === true`) so `'other'` / unknown operational profiles never fall back to stock/retail modules.
- Re-exported `./schemas/business-problems` in `packages/validation/src/index.ts`.
- Wrote `packages/validation/src/__tests__/business-composition.test.ts` testing all 25 family fixtures + `"film-equipment rental"` unseen case + `'other'` zero-retail-fallback + `regulatedDomain` compliance gap without medical capability.
- `NEEDS_OWNER_DECISION`: AI free-text business discovery (`services/ai/pipeline`) NOT built in V60 per §9 safe default.
- Tests written (not yet run per §1). Risks: none.

### Slice 5 — Three-Level Industry Status (`COMPLETED`)

- Extended `scripts/industry/coverage-data.mjs` with `INDUSTRY_ACCEPTANCE_TESTS` (mapping real E2E HTTP/integration tests per trade) and `scripts/industry/generate-coverage-table.mjs` to compute three honest statuses per `IndustryKey` (`registered`, `profiled`, `workflowComplete`) and emit `docs/architecture/universal-core/INDUSTRY-SUPPORT-LEVELS.csv` alongside `INDUSTRY-SUPPORT-MATRIX.md`.
- Enforced `workflowComplete => profiled => registered` + disk existence of all cited test files in `generate-coverage-table.mjs` and `packages/validation/src/__tests__/industry-coverage-table.test.ts`.
- Extended `packages/ui/src/__tests__/industry-support-note.test.ts` to cover `'other'`, `'courier'`, `'freightTransport'` and assert honest generic support copy without specialized over-promises (`landing-claims.test.ts` verified intact).
- Tests written (not yet run per §1); `node scripts/industry/generate-coverage-table.mjs` queued for §12. Risks: none.

### Slice 6 — Wire or Classify Unwired Engines (`COMPLETED`)

- Wired `orders.routes.ts` (all 7 routes + `SalesOrderRow`, `useSalesOrders`, `useCreateSalesOrder`, `useConfirmSalesOrder`, `useCancelSalesOrder`, `useFulfillSalesOrder`, `useInvoiceSalesOrder`) into `SalesHubContainer` (`SALES_HUB_TABS = ['invoices', 'orders', 'pricing']` via `SalesOrdersContainer` + `ROUTE_DOCS_MAP['invoices?tab=orders']` + updated `sales-hub.test.ts`).
- Cleaned up `transport.routes.ts` & `transport.service.ts` (removed 6 duplicate dead route aliases, added Zod validation, added append-only `POST /api/deliveries/notes/:id/pod` via `logBusinessEvent`, and added `POST /api/deliveries/courier/:id/settle-cod` settling through `PaymentsService`), wired into `SalesOrdersContainer` (`?view=delivery`), and updated `unwired-capability-hooks.test.ts`.
- Wired `project.routes.ts` (`members`, `time-entries`, and new `POST /api/projects/:id/bill` calling `TimesheetsService` / `timesheets/billing.domain.ts` -> `InvoiceService.create` + locking `invoice_id`) into `packages/api/src/hooks/projects.ts` + `TimesheetsContainer`/`TimesheetsView`.
- Wired `POST /api/package-credits/grant` (`useGrantPackageCredits` in `PackageGrantsPanel` inside Customers › sessions), `PATCH /api/work-orders/:id` (`useUpdateWorkOrder` in `ManufacturingContainer`/`ManufacturingView`, keeping `completed` refused), and `POST /api/invoices/:id/exchange` (`useExchangeInvoice` in `packages/api/src/hooks/invoices.ts`).
- Fixed the 4 V59.1 `offline-endpoint-matrix.ts` split features (`accounting.variant_report`, `invoice.exchange`, `trade.gold_ledger`, `inventory.serial_returns`) + added all Slice 6 `online_required` rows; updated `cloud-required.test.ts` server count from `77` to `83`.
- Fixed pre-V60 UI guard issues: replaced native `<select>/<option>` in `repair-ticket-work-panel.tsx` with `<SelectField>`, removed hardcoded currency fallbacks in `exchange-section.tsx`.
- `NEEDS_OWNER_DECISION`: `agriculture.routes.ts` (`livestock`) kept internal / `livestock_register` remains `planned`.
- Tests updated (not yet run per §1). Risks: run `generate-capability-matrix-csv.mjs` in §12.

### Slice 7 — Resource & Capacity Engine (`COMPLETED`)

- Extended `RESOURCE_KINDS` in `packages/validation/src/schemas/salon.ts` to cover `chair`, `room`, `bed`, `station`, `equipment`, `table`, `vehicle`, `machine`, `court`.
- Created `packages/validation/src/schemas/resource-capacity.ts` (`overlaps`, `freeSlots`, `utilization`, `resourceBookingCreateSchema`) + `packages/validation/src/__tests__/resource-capacity.test.ts`, exported in `packages/validation/src/index.ts`.
- Created `docs/resource-capacity-01-migration.sql` + `docs/VERIFY-resource-capacity-01.sql` + `backend/src/__tests__/resource-capacity-01.pg.test.ts` (generalized `service_resources`, unified `resource_bookings` table with `tstzrange` + `btree_gist` `EXCLUDE USING gist (workspace_id WITH =, resource_id WITH =, during WITH &&) WHERE (status = 'active')`, tenant guard trigger, RLS `workspace_members` policy). Status: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.
- Wired `SalonService` + `salon.routes.ts` (`GET/POST /api/resource-bookings`, `POST /api/resource-bookings/:id/release`, `GET /api/service-resources/:id/slots`), registered in `concurrency-safety-map.ts`, `reversal-ledger.test.ts`, and `offline-endpoint-matrix.ts`.
- Added client hooks in `packages/api/src/hooks/business-packs.ts` (`useResourceBookings`, `useBookResource`, `useReleaseResourceBooking`, `useResourceSlots`) and slot/booking UI inside `salon-sections.tsx`; upgraded `CAPABILITIES.resource_capacity` to `partial`.
- Tests written (not yet run per §1). Risks: `pg` test requires Linux/macOS binary on this Windows host.

### Slice 8 — Cost Objects & True Profit (`COMPLETED`)

- Extended `packages/validation/src/schemas/profit-report.domain.ts` (and re-exported via `backend/src/services/accounting/profit-report.domain.ts` + `packages/validation/src/index.ts`) with `buildCostObjectProfitReport()`, delegating 100% of revenue, direct cost, and profit calculation to the ONE `buildProfitReport()` formula.
- Added `AccountingService#getCostObjectProfitReports()` + `GET /api/accounting/profit-report/cost-objects` (`offline-endpoint-matrix.ts` + `packages/api/src/hooks/accounting.ts#useCostObjectProfitReport`): groups by project/branch/cost-object dimension in one currency without ever converting or inventing overhead (`'overhead not allocated'` when unconfigured; unknown cost yields `grossProfit: null`, `netProfit: null`).
- Added `backend/src/__tests__/profit-by-cost-object.test.ts` (two currencies + unknown cost -> `null` + explicit vs unallocated overhead) and extended `packages/ui/src/__tests__/unknown-is-not-zero.test.ts` with a guard forbidding any `(const|let) profit =` formula outside `profit-report.domain.ts`.
- `NEEDS_OWNER_DECISION`: Overhead allocation key is NOT invented (`overheadPolicyStatus: 'not_allocated'`); requires explicit owner policy before subtracting overhead.
- Tests written (not yet run per §1). Risks: none.

### Slice 9 — Contracts & Recurring Obligations (`COMPLETED`)

- Verified `subscription-order.service.ts` / `customer-profile` model Hisabche SaaS billing plans only.
- Created `docs/contracts-01-migration.sql` + `docs/VERIFY-contracts-01.sql` + `backend/src/__tests__/contracts-01.pg.test.ts` (`contracts` + `contract_obligations` with `UNIQUE (contract_id, kind, period_key)` enforcing max one invoice per period, RLS `workspace_members` policies). Status: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.
- Created `packages/validation/src/schemas/contracts.ts` (`contractBillIdempotencyKey`, `canBillContractPeriod`, `evaluateSlaBreach` flagging SLA without auto-penalizing unless policy exists), exported in `packages/validation/src/index.ts`.
- Created `backend/src/services/contracts/contracts.service.ts` + `backend/src/routes/contracts.routes.ts` (billing via `InvoiceService.create`, deposits held as liability, termination cancelling pending obligations, lease return via `routeReturnConditionDisposition` + Slice 7 `SalonService#releaseResourceBooking`), wired into `backend/src/index.ts`, `feature-registry.ts` (`commerce.contracts`), `offline-endpoint-matrix.ts`, and `packages/api/src/hooks/contracts.ts`.
- Wrote `backend/src/__tests__/contracts-service.test.ts` and upgraded `CAPABILITIES.contracts_recurring` to `partial`.
- Tests written (not yet run per §1). Risks: `cloud-required.test.ts` count will be updated in batch after Slices 10–11.

### Slice 10 — Procurement Planning & Three-Way Match (`COMPLETED`)

- Created `packages/validation/src/schemas/procurement-match.ts` (exported in `packages/validation/src/index.ts`):
  - `planReordersWithPackRounding()` subtracts open PO + reserved qty, rounds positive deficit UP to `purchasePackSize`, and feeds `planDraftPurchaseOrders()` (`requiresHumanApproval: true`, never auto-orders).
  - `evaluateThreeWayMatch()` compares PO vs goods receipt vs supplier invoice by `(productId, variantId)` quantity + minor-unit price, returning structured mismatches (`QTY_SHORT`, `OVER_RECEIPT`, `PRICE_DRIFT`, `VARIANT_MISMATCH`, `UNORDERED_ITEM`, `INVOICE_MISSING`) with `mayApprovePayment: false` on any discrepancy.
  - `buildSupplierScorecard()` delegates strictly to canonical `scoreSupplier()` (`MIN_PURCHASES_FOR_A_SCORE = 3`).
- Extended `PurchasingService` (`createDraftPurchaseOrdersFromSuggestions`, `evaluateThreeWayMatchForPo` gated with `decideApproval` / `mayPostDocument` from `approval-gate.domain.ts`, `getSupplierScorecard`), `purchasingRoutes` (`POST /api/purchase-orders/from-suggestions`, `GET /api/purchase-orders/:id/three-way-match`, `GET /api/suppliers/scorecard`), `concurrency-safety-map.ts`, `reversal-ledger.test.ts`, `feature-registry.ts` (`purchase.three_way_match`), `offline-endpoint-matrix.ts`, `packages/api/src/hooks/purchasing.ts`, and `OpsReorderSection` (`packages/ui/src/components/ui/inventory-ops/inventory-ops-view.tsx`).
- Upgraded `CAPABILITIES.procurement_planning` & `CAPABILITIES.three_way_match` to `partial` (`business-capabilities.ts`) and added `packages/validation/src/__tests__/procurement-match.test.ts`.
- Tests written (not yet run per §1). Risks: `cloud-required.test.ts` server feature count will be aligned in batch after Slice 11.

### Slice 11 — Quality, Warranty & Claims Chain (`COMPLETED`)

- Created `docs/quality-events-01-migration.sql` + `docs/VERIFY-quality-events-01.sql` + `backend/src/__tests__/quality-events-01.pg.test.ts` (`quality_events` append-only table with `quality_events_immutable_guard` trigger rejecting `UPDATE`/`DELETE` + `warranty_claims` table + RLS `workspace_members` policies). Status: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.
- Created `packages/validation/src/schemas/quality.ts` (`qualityEventCreateSchema`, `warrantyClaimCreateSchema`, `WARRANTY_EXPIRED_CODE`) and exported in `packages/validation/src/index.ts`.
- Created `backend/src/services/quality/quality.service.ts` + `backend/src/routes/quality.routes.ts`: failed inspections move stock via `WarehouseService#transferStock()` to quarantine warehouse; warranty claims verify `isWarrantyActive()` and refuse expired claims with `WARRANTY_EXPIRED`.
- Wired `qualityRoutes` in `backend/src/index.ts`, registered mutating routes in `concurrency-safety-map.ts`, added `operations.quality` (`server`) in `feature-registry.ts` + `offline-endpoint-matrix.ts`, added `packages/api/src/hooks/quality.ts` (`useQualityEvents`, `useRecordQualityEvent`, `useWarrantyClaims`, `useSubmitWarrantyClaim`), wired into `packages/ui/src/components/ui/invoices/warranties-section.tsx`, upgraded `CAPABILITIES.quality_inspection` & `warranty_claims`, and wrote `backend/src/__tests__/quality-warranty-chain.test.ts`.
- Tests written (not yet run per §1). Risks: `cloud-required.test.ts` server count will be updated right after Slice 12.

### Slice 12 — Owner Command Center (P10) (`COMPLETED`)

- Extended `backend/src/services/intelligence/forecast.domain.ts` (`MIN_FORECAST_HISTORY_SAMPLES = 3`, `status: 'ok' | 'insufficient_data'`, `projectedCashMinor: number | null`): too little history yields `insufficient_data` and `null`, never `0` (while keeping existing `sampleSize >= 3` tests passing).
- Extended `backend/src/services/analytics/dashboard-visibility.domain.ts` (`filterCommandAlertsByVisibility`) so the server redacts/hides money alerts when a role lacks `requiredPermission` or its `figureGroup` is in `hidden`.
- Extended `packages/ui/src/components/ui/dashboard/DashboardRegistry.ts` (`COMMAND_CENTER_ALERTS` + `resolveCommandCenterAlerts`) and created `packages/ui/src/components/ui/dashboard/owner-command-center.tsx` mounted in `DashboardContainer`: every widget has a reasonCode, nullable numbers (`insufficient_data` / `unknown`, never `0`), decision hub `href`, strict `capStatus === 'available'` gating, and UI + server permission hiding.
- Updated `CAPABILITIES.owner_forecast` evidence and wrote `backend/src/__tests__/owner-command-center.test.ts` + `packages/ui/src/__tests__/owner-command-center-ui.test.ts`.
- Tests written (not yet run per §1). Risks: none.

### Pre-§12 Acceptance, Guards & i18n Sweep (`COMPLETED`)

- Wrote `backend/src/__tests__/v60-http-families.test.ts` (real Fastify `buildServer()` + `app.inject()` E2E flows across wholesale, consulting, rental, and courier).
- Updated `suggestedOperatingAnswers()` (`operational-dna.ts`), `scripts/industry/coverage-data.mjs`, and `scripts/industry/generate-coverage-table.mjs` so only those 4 verified families rise to `workflowComplete`.
- Created `docs/architecture/V60-FAMILY-ACCEPTANCE-MATRIX.md` & `docs/architecture/V60-UNIVERSAL-BUSINESS-IMPLEMENTATION-REPORT.md`.
- Fixed pre-existing V59.1 guard/mock issues: RLS `ON public.` prefix in 4 V59.1 + 3 V60 SQL migrations (+ V60 tables registered in `rls-coverage.test.ts`), single `computeItemTotalRounded` call in `invoice.service.ts`, `sh-ok-001` idempotency key in `v59-1-gold-routes-http.test.ts`, `checked_in` in `service-delivery-model.test.ts`, and `serverFeatures.length === 86` in `cloud-required.test.ts`.
- Synced all V60 + missing i18n keys across `fa/af/en/common.json` cleanly via `sync-i18n.mjs`.

### §12 — Single Final Verification (`IN PROGRESS`)

- Running §12 generators, `tsc`, ESLint, unit/HTTP tests, and PG probe once.
