# Hisabche V60 — Universal Business Discovery & Composition Implementation Report

**Status:** Pending §12 single final verification pass.

## 1. Architecture Summary (Slices 1–12)

1. **Slice 1 — Single Operating-Questions Model:** `operatingCharacteristicsSchema` in `packages/validation/src/schemas/industry-profiles.ts` is now a strict derived projection of `operatingAnswersSchema` via `characteristicsFromAnswers()`.
2. **Slice 2 — 15-Axis Operational DNA:** `packages/validation/src/schemas/operational-dna.ts` extended with backward-compatible optional axes 10–15 (`pricingBasis`, `assetCustody`, `executionSite`, `recurrence`, `approvalDepth`, `regulatedDomain`) + `effectiveDnaAxes()` + compliance gap detection (`REGULATED_DOMAIN_COMPLIANCE`) without retail defaults.
3. **Slice 3 — Capability Registry v2 & Honesty Guard:** Added `ENGINE_KEYS` + `ENGINES` in `packages/validation/src/schemas/business-capabilities.ts`, expanded `CAPABILITY_KEYS` to 38 capabilities, corrected F2 (`recipe_bom` -> `'partial'`), linked F3 (`length_pricing`, `volume_pricing`, `area_pricing`, `roll_cutting`), and enforced disk/test/offline-matrix checks in `capability-has-consumer.test.ts`.
4. **Slice 4 — Problem Profiles (P1–P10) & Composition Algorithm:** Created `packages/validation/src/schemas/business-problems.ts` (`problemsOf`, `requirementsOf`, `composeBusinessSolution`) proving composition for 25 families + unseen `"film-equipment rental"` + `'other'` zero-retail guarantee.
5. **Slice 5 — Three-Level Industry Status:** Updated `scripts/industry/coverage-data.mjs` + `generate-coverage-table.mjs` to output `docs/architecture/universal-core/INDUSTRY-SUPPORT-LEVELS.csv` (`registered`, `profiled`, `workflowComplete`), asserting `workflowComplete => profiled => registered`.
6. **Slice 6 — Wire Unwired Engines & Eliminate Split Features:**
   - Wired all 7 `orders.routes.ts` endpoints (`SalesOrdersContainer` inside `SalesHubContainer` `?tab=orders`).
   - Consolidated `transport.routes.ts` to canonical URLs matching `universal-core.ts` hooks + added `POST /api/deliveries/notes/:id/pod` and `POST /api/deliveries/courier/:id/settle-cod` (settled via `PaymentsService`) + wired into `SalesOrdersContainer?view=delivery`.
   - Wired `project.routes.ts` (`members`, `time-entries`, `POST /api/projects/:id/bill` via `InvoiceService.create`) into `TimesheetsContainer`.
   - Wired `POST /api/package-credits/grant`, `PATCH /api/work-orders/:id`, `POST /api/invoices/:id/exchange`.
   - Fixed the 4 pre-V60 split features without touching `OFFLINE_ENGINE` feature keys.
7. **Slice 7 — Resource & Capacity Engine (P3):** Generalized `RESOURCE_KINDS`, created `resource-capacity.ts` (`overlaps`, `freeSlots`, `utilization`), `docs/resource-capacity-01-migration.sql` (`btree_gist` `EXCLUDE USING gist`), `SalonService` + `salonRoutes` + `packages/api/src/hooks/business-packs.ts` + `SalonSections`.
8. **Slice 8 — Cost Objects & True Profit (P7):** Added `buildCostObjectProfitReport()` delegating 100% of profit math to `buildProfitReport()` + `GET /api/accounting/profit-report/cost-objects` + UI guard against duplicate profit formulas.
9. **Slice 9 — Contracts & Recurring Obligations (P6):** Created `docs/contracts-01-migration.sql` (`contracts`, `contract_obligations` with `UNIQUE (contract_id, kind, period_key)`), `ContractsService` (billing via `InvoiceService.create`, deposits held as liability, lease return releasing bookings via Slice 7 + `routeReturnConditionDisposition`), `contractsRoutes`, and API hooks.
10. **Slice 10 — Procurement Planning & Three-Way Match (P5):** Created `packages/validation/src/schemas/procurement-match.ts`, `PurchasingService#createDraftPurchaseOrdersFromSuggestions` / `evaluateThreeWayMatchForPo` (gating payment via `approval-gate.domain.ts`) / `getSupplierScorecard` (`scoreSupplier`), HTTP routes, API hooks, and `OpsReorderSection` UI.
11. **Slice 11 — Quality Events & Warranty Claims Chain (P9):** Created `docs/quality-events-01-migration.sql` (append-only `quality_events` with DB immutability trigger + `warranty_claims`), `QualityService` (quarantine movement via `WarehouseService.transferStock`; expired claim refusal `WARRANTY_EXPIRED`), HTTP routes, API hooks, and `WarrantiesSection` UI.
12. **Slice 12 — Owner Command Center (P10):** Extended `forecast.domain.ts` (`insufficient_data` / `projectedCashMinor: null`, never `0`), `dashboard-visibility.domain.ts` (`filterCommandAlertsByVisibility`), `DashboardRegistry.ts` (`COMMAND_CENTER_ALERTS` / `resolveCommandCenterAlerts`), and `OwnerCommandCenterSection` mounted in `DashboardContainer`.

## 2. Database Migrations (NOT RUN — Pending Human Confirmation)

1. `docs/resource-capacity-01-migration.sql` + `docs/VERIFY-resource-capacity-01.sql` — `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`
2. `docs/contracts-01-migration.sql` + `docs/VERIFY-contracts-01.sql` — `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`
3. `docs/quality-events-01-migration.sql` + `docs/VERIFY-quality-events-01.sql` — `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`

## 3. Tagged `NEEDS_OWNER_DECISION` Safe Defaults (§9)

- Livestock / agriculture UI: kept `planned` without new UI.
- Healthcare clinical records / prescriptions: marked `unsupported` + `REGULATED_DOMAIN_COMPLIANCE` setup gap; nothing medical built.
- Hotel room nights: `room_nights` kept `planned`; rooms modeled as `service_resources`.
- Cost-object overhead allocation: `not_allocated` (`'overhead not allocated'`) until owner sets an allocation key.
- Contract SLA breach: flagged only (`sla_breached_at`, obligation `'breached'`), never auto-penalized.
- AI free-text business discovery: not built.
- Fleet optimization: `planned`; dispatch trips & POD only.

## 4. Verification Results (§12)

To be populated immediately after §12 runs.
