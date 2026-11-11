# HISABCHE V59 — PREFLIGHT AUDIT & LOCAL RECONCILIATION

**Date:** 2026-11-11  
**Branch:** `main` (`...origin/main`)  
**Remote Baseline Referenced in Prompt:** `b30f259c5a9a1123fc65c69300678cc878b160e8` (V58: stock reservations/ATP + bin transfers, manufacturing ledger posting, leave accrual engine + payslip PDF, signed payment webhook)  
**Local `HEAD`:** `71b08dfb3709d47502c7fee9703f38a5c8675c6c` (`V58: leave accrual + payslip UI wiring, warehouse holds/reservations UI & API hooks, HR schemas, i18n (fa/af/en)`)  
**`NEXT_VERSION`:** `V59`  
**Execution Model Override Note:** Per mission §0.1 ("DURING IMPLEMENTATION (Sections 1–10): RUN NOTHING THAT VERIFIES"), test, typecheck, lint, PostgreSQL test, and index-rebuild runs are deferred to the single final verification pass (Section 11). This temporarily overrides the per-slice test/typecheck instruction in `AGENTS.md`, while preserving all other `AGENTS.md` rules (no commit/push/reset, no live DDL, no `.env*`, no unrequested edits to unrelated files).  
**Code Intelligence Status at Start:** `PARTIALLY_STALE` (`scripts/code-intel.mjs status` — indexed at `738e82a9`, current HEAD `71b08dfb`; 2,017 files, 19,246 symbols, 74,055 relationships, 3 file cycles). Fallback used where needed: `git grep -n`.

---

## 1. Local Git Reconciliation & Working-Tree State

- **Remotes:** `origin` → `https://github.com/hamednourzaei/hisabche.git`
- **Staged changes:** None (`git diff --cached --stat` empty).
- **Pre-existing modified working-tree files (preserved untouched unless explicitly required by a slice's scope):**
  1. `.claude/skills/new-reels/SKILL.md` (+5 lines) — untouched.
  2. `docs/architecture/capability-matrix.csv` — untouched until Slice 8 generator step.
  3. `docs/architecture/industry/INDUSTRY-SUPPORT-MATRIX.md` — untouched until Slice 8.
  4. `docs/architecture/universal-core/INDUSTRY-COVERAGE-TABLE.csv` — untouched until Slice 8.
  5. `docs/architecture/universal-core/INDUSTRY-COVERAGE-TABLE.md` — untouched until Slice 8.
  6. `packages/ui/src/__tests__/product-warehouse-stock.test.ts` (updated locally to assert `/storage-locations/move` atomic V58 bin move).
  7. `packages/validation/src/schemas/offline-endpoint-matrix.ts` (added V58 `online_required` rows for `/leaves/balance`, `/leave-policies*`, `/leaves/accrue`, `/inventory/reservations*`, `/storage-locations/move`, `/hr/payrolls/:x/payslip.pdf`; note: locally removed `POST /operations/batches/plan-issue` and `POST /operations/batches/issue` lines while `packages/local-engine/src/routes/batches.ts` still registers them — recorded as parity mismatch in §7).
- **Pre-existing untracked files (preserved untouched):**
  - `docs/audit/exchange/screenshot-01-login.png`
  - `docs/audit/exchange/screenshot-02-after-login.png`
  - `scripts/audit-login.cjs`
- **Local V58 delta (`b30f259c..71b08dfb`):**
  - Backend: `backend/src/routes/{human-resources,warehouse-map}.routes.ts`, `backend/src/services/{human-resources.service.ts,inventory/warehouse-map.service.ts}`, `backend/src/utils/concurrency-safety-map.ts`, `backend/src/__tests__/reversal-ledger.test.ts`
  - Validation/API: `packages/validation/src/schemas/human-resources.schema.ts`, `packages/api/src/hooks/{inventory-reservations,leaves,warehouse-map}.ts`, `packages/api/src/index.ts`
  - UI/i18n: `packages/ui/src/components/ui/warehouse/holds-section.tsx`, `leave-policy-card.tsx`, `payslip-download.tsx`, `packages/ui/src/__tests__/warehouse-hub.test.ts`, `packages/i18n/messages/{fa,af,en}/common.json`

---

## 2. Re-Verification of Prior & V58 Claims Against Local Source

| Item                                                       | Backend Service / Route                                                                                                                                                                                        | Migration & VERIFY & PG Test                                                                         | Local Engine Parity                                                                                                                                                                                                             | UI Consumer                                                                                      | Local Status                                                                                     |
| :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| **Serial/IMEI tracking & returns**                         | [VERIFIED] `TraceabilityService` + `operations.routes.ts` (`POST /operations/serials`, `/serials/issue`, `/serials/:id/hold`, `GET /serials/holds`); `InvoiceService#releaseClaims` releases serials on cancel | [VERIFIED] `retail-ops-01-migration.sql` + `VERIFY` + pg test                                        | [PARTIAL] `local-engine/src/routes/serials.ts` has list/receive/issue + `invoices.ts` cancel release; **missing** `/operations/serials/:id/hold` and return-condition serial routing                                            | [VERIFIED] `InvoiceSerialsPanel`, `WarrantiesSection`                                            | Implemented online; offline hold/return partial                                                  |
| **Batch / FEFO allocation & restore**                      | [VERIFIED] `TraceabilityService` + `operations.routes.ts` (`/batches/plan-issue`, `/batches/issue`)                                                                                                            | [VERIFIED] `traceability-migration.sql`                                                              | [PARTIAL] `local-engine/src/routes/batches.ts` implements `plan-issue` & `issue` & cancel restore, **but** working tree `offline-endpoint-matrix.ts` dropped those two POST entries (`BATCH_RETURN_RESTORE_MISSING` still open) | [VERIFIED] `ExpiryContainer`, `add-to-warehouse-modal.tsx`                                       | Matrix/local-route mismatch; return batch restore missing                                        |
| **ATP stock reservations**                                 | [VERIFIED] `InventoryReservationService` (`backend/src/services/inventory/reservation.service.ts`) + `inventory-reservations.routes.ts`                                                                        | [VERIFIED] `stock-reservations-01-migration.sql` + `VERIFY` + `stock-reservations-01.pg.test.ts`     | [ABSENT] Explicitly `online_required` in `offline-endpoint-matrix.ts`                                                                                                                                                           | [VERIFIED] `holds-section.tsx` in Warehouse Hub (`?view=holds`), `use-inventory-reservations.ts` | Backend + UI wired; **Invoice/POS sale path not yet enforcing/settling ATP holds automatically** |
| **Bin-to-bin transfers**                                   | [VERIFIED] `warehouse-map.routes.ts` + `warehouse-map.service.ts` (`/storage-locations/move` → `storage_move_stock`)                                                                                           | [VERIFIED] `storage-bin-transfer-01-migration.sql` + `VERIFY` + `storage-bin-transfer-01.pg.test.ts` | [ABSENT] Explicitly `online_required`                                                                                                                                                                                           | [VERIFIED] `useMoveProductPlacement` (`warehouse-map.ts`) + `product-shelf-locations.tsx`        | Wired online                                                                                     |
| **Manufacturing → ledger posting**                         | [VERIFIED] `manufacturing.service.ts:1097` calls `ledger.postDocument`                                                                                                                                         | [VERIFIED] `manufacturing.pg.test.ts`                                                                | [ABSENT] `online_required` (planned C mode)                                                                                                                                                                                     | [VERIFIED] Manufacturing screens                                                                 | Wired online                                                                                     |
| **Leave accrual & balances**                               | [VERIFIED] `human-resources.service.ts` + `human-resources.routes.ts`                                                                                                                                          | [VERIFIED] `leave-policy-01-migration.sql` + `VERIFY` + `leave-policy-01.pg.test.ts`                 | [ABSENT] `online_required` in matrix                                                                                                                                                                                            | [VERIFIED] `leave-policy-card.tsx`, `employee-leave-panel.tsx`                                   | Wired online                                                                                     |
| **Payslip PDF**                                            | [VERIFIED] `payroll-pdf.routes.ts` (`GET /api/hr/payrolls/:id/payslip.pdf`) + `PayslipPDFDocument.tsx`                                                                                                         | N/A (read/render over `payrolls`)                                                                    | [ABSENT] `online_required`                                                                                                                                                                                                      | [VERIFIED] `payslip-download.tsx`                                                                | Wired online                                                                                     |
| **Signed payment webhook**                                 | [VERIFIED] `payment-webhook.routes.ts` (`POST /api/webhooks/stripe` raw body HMAC + replay)                                                                                                                    | N/A (`WebhookService`)                                                                               | N/A (`server`)                                                                                                                                                                                                                  | N/A                                                                                              | Implemented; live Stripe blocked on credentials (`STRIPE_WEBHOOK_SECRET`)                        |
| **Cycle-count sync & Ledger immutability & Schema parity** | [VERIFIED] `cycle-count.routes.ts`, `ledger.port.ts`                                                                                                                                                           | [VERIFIED] `cycle-count-04-migration.sql`, `FINDING-schema-drift-2026-11-08.sql`                     | [VERIFIED] Local tables synced                                                                                                                                                                                                  | [VERIFIED] `StockCountContainer`                                                                 | Verified in local artifacts                                                                      |

---

## 3. Inventory (a): Routes, Navigation Registry & Real Hubs

**Navigation Contract (`packages/ui-contract/src/navigation.ts`):**

- `PRIMARY_CONTRACT`: `today` (`/dashboard`), `get-paid` (`/invoices`), `stock` (`/warehouse`), `money` (`/accounting`), `till` (`/till`)
- `MORE_GROUPS_CONTRACT`:
  - `people`: `buyers` (`/customers`), `coworkers` (`/team-and-payroll`)
  - `work`: `production` (`/manufacturing`), `approvals` (`/approvals`), `market-seller` (`/market-seller` — in `DISABLED_PAGES`), `analysis` (`/analysis`)
  - `system`: `settings` (`/settings`), `events` (`/activities`), `data-and-sync` (`/data-and-sync`), `billing` (`/billing`), `assistant` (`/assistant`), `governance` (`/governance`)
- Disabled pages (`DISABLED_PAGES`): `['/market-seller', '/marketplace']`

**Real Hub / Tab / Sub-Tab Map (`?tab=` and `?view=`):**

1. `/invoices` ([`SalesHubContainer`](packages/ui/src/components/ui/invoices/containers/sales-hub-container.tsx)):
   - Tabs: `invoices` (`InvoicesContainer`), `pricing` (`PromotionsContainer`)
   - Note: `SALES_HUB_TABS` docstring mentions `advances`, real array is `['invoices', 'pricing']` (`invoices/new`, `invoices/:id`, `invoices/new/preview` are dedicated child routes).
2. `/warehouse` ([`WarehouseTabsContainer`](packages/ui/src/components/ui/warehouse/containers/warehouse-tabs-container.tsx)):
   - Tabs: `stock`, `expiry` (`ExpiryContainer`)
   - `stock` sections (`STOCK_SECTIONS`): `warehouses`, `products`, `shelfMap`, `transfers` (`TransferRequestsSection`), `holds` (`HoldsSection`), `reorder`, `deadStock`
3. `/customers` ([`CustomersHubContainer`](packages/ui/src/components/ui/customers/containers/customers-hub-container.tsx)):
   - Tabs: `customers` (sections: `all`, `buyer`, `seller`), `sessions`, `outreach`
   - `sessions` sections (`SESSION_SECTIONS`): `sessions` (`ServiceDeliveryContainer`), `repairs` (`RepairTicketsSection`), `salonSetup` (`SalonSetupSection`), `commission` (`CommissionSection`)
   - `outreach` sections (`OUTREACH_SECTIONS`): `followUp`, `campaigns`, `stale`
4. `/till` ([`TillContainer`](packages/ui/src/components/ui/till/containers/till-container.tsx)):
   - Tabs: `till` (`TillDrawer`), `exchange` (`ExchangeSection`)
   - `exchange` views (`EXCHANGE_VIEWS`): `trades`, `rates`, `positions`, `remittances`
5. `/team-and-payroll` ([`TeamAndPayrollContainer`](packages/ui/src/components/ui/team-and-payroll/containers/team-and-payroll-container.tsx)):
   - Tabs: `team` (`employees`, `branches`), `pay` (`attendance`, `timesheets`); Employee detail & payroll outcomes at `/team-and-payroll/:id`
6. `/settings` ([`SettingsHubContainer`](packages/ui/src/components/ui/settings/settings-hub-container.tsx)):
   - Tabs: `general`, `integrations` (`developers`, `marketplace`)
7. `/accounting`, `/approvals`, `/data-and-sync`, `/billing`, `/analysis`, `/manufacturing`, `/governance`, `/stock-count`, `/operations`, `/sync-center` (device-specific), `/onboarding`.

- App-shell parity (`packages/app-shell/src/app/app.tsx`): mirrors all routes + legacy `<Navigate>` redirects (`sales`, `inventory`, `cash`, `reports`, `team`, `crm`, `bank`, `assets`, `budgets`, etc.).

---

## 4. Inventory (b): Operational DNA Consumer Graph

Verified trace across layers:

1. **Schema & Inference:** `packages/validation/src/schemas/operational-dna.ts` (`operationalDnaSchema`, `ARCHETYPE_PRESETS`, `workforceModelEnum`, `terminologyProfileSchema`, `inferOperationalDna`, `resolveDnaCapabilities`, `operatingQuestionsFor`).
2. **Gaps verified in local source:**
   - **G-DNA-1 (Workforce):** `inferOperationalDna` maps `hasStaff === 'yes' ? ['HOURLY_STAFF'] : ['SOLO_OWNER']` even though `workforceModelEnum` already supports `COMMISSION_PROVIDERS`, `SALARIED_STAFF`, `SHIFT_BASED_STAFF`, `MIXED_WORKFORCE`. There is no inference/question path for commission/salary/shift/mixed/unknown workforce models, and `NAIL_TECH_BEAUTY` preset hardcodes `['SOLO_OWNER']`.
   - **G-DNA-2 (Axis 8 Presentation):** `terminologyProfileSchema` has only 4 keys (`partyLabelKey`, `itemLabelKey`, `transactionLabelKey`, `inventoryLabelKey`) and has **zero** UI consumers (`git grep` shows only `operational-dna.ts` + `operational-dna.test.ts`). Dashboard/navigation/form/report presentation config is not stored declaratively inside Axis 8.
   - **G-DNA-3 (Dual Resolver):** `resolveDnaCapabilities` calls `resolveCoreCapabilities` for capability statuses, but computes `activeModules` in parallel to `resolveBusinessProfile().recommendedModules` instead of deriving cleanly from a unified pure capability/profile resolver.
   - **G-DNA-4 (Offline Profile Sync & Storage):** `backend/src/routes/workspace-profile.routes.ts` & `backend/src/services/workspace-profile.ts` persist `operational_dna` + `operational_dna_version` + `onboarding_progress` online via `workspace_set_operational_dna`, **but** `packages/api/src/hooks/workspace-profile.ts` notes `"Online only: the device engine has no copy of these routes"`. `packages/local-engine` has NO `workspace-profile` route for `/workspace/profile`, `/workspace/operational-profile`, or `/workspace/onboarding-progress`.
   - **G-DNA-5 (UI Consumers):** `onboarding-container.tsx`, `operating-profile-settings.tsx`, `first-value-checklist.tsx`, and `dna-menu-suggestion.ts` consume DNA; `dashboard-container.tsx`, `DashboardRegistry.ts`, and hub containers do **not** yet consume DNA/Role start screen composition.

---

## 5. Inventory (c): Capability Registry Audit (`business-capabilities.ts`)

13 capabilities in `CAPABILITY_KEYS`:

- **`available` (3):** `measurement`, `weight_pricing`, `multi_unit` — shared pure rules, backend services, local engine (`invoices.ts`, `invoice-unit-parity.test.ts`), hooks, UI.
- **`partial` (7):**
  - `batch_expiry` (`limitation: BATCH_RETURN_RESTORE_MISSING`)
  - `variants` (`limitation: COST_LAYERS_ARE_PRODUCT_KEYED`) — NEEDS_OWNER_DECISION (carried from V55 Decision A)
  - `serialized_items` (`limitation: OFFLINE_SERIAL_IDENTITY_MISSING` — **Note:** `serials.ts` v21 already exists locally, but offline serial hold/conflict/return remain gaps)
  - `auto_fitments` (`limitation: CORE_CHARGE_NOT_APPLIED`)
  - `gold_purity` (`limitation: LINE_PRICING_FROM_PURITY_NOT_WIRED` — `gold-jewellery.domain.ts` & `metal-rates` exist, invoice pricing ignores purity)
  - `making_charges` (`limitation: MAKING_CHARGE_NOT_COMPUTED_ON_LINE`)
- **`planned` (3):** `length_pricing`, `volume_pricing`, `recipe_bom`, `table_service` (actually **4** planned keys total: 3 `available` + 6 `partial` + 4 `planned` = 13 total! Let's recount: `measurement`(A), `weight_pricing`(A), `length_pricing`(P), `volume_pricing`(P), `multi_unit`(A), `batch_expiry`(Pa), `recipe_bom`(P), `variants`(Pa), `table_service`(P), `serialized_items`(Pa), `auto_fitments`(Pa), `gold_purity`(Pa), `making_charges`(Pa) → 3 Available, 6 Partial, 4 Planned = 13).
- **W3 Audit:** Entitlement (`feature-registry.ts`, `entitlement-resolver.ts`) and Role Permission (`authorization.domain.ts` `CAPABILITIES`, `requireCapability`) and Business Capability (`business-capabilities.ts`) are structurally independent, **except** there is no shared pure `evaluateFeatureAccess` combiner asserting all three boundaries cleanly across UI + API, and UI hides/locks via `NAV_MODULE` + `useMyCapabilities` inconsistently in business-pack tabs (e.g. `CommissionSection` checks `payroll.read`, which allows manager/owner but has no per-stylist self-commission view, nor reception salary-block guarantee test).

---

## 6. Inventory (d) & (g): Terminology & i18n / Tests Overview

- **i18n structure:** Single namespace file per locale: `packages/i18n/messages/{fa,af,en}/common.json`.
  - Baseline parity check (pre-V59): `fa: 10374` keys, `af: 10374` keys, `en: 10367` keys (pre-existing landing badge mismatch of 1 in `af` and 7 in `en` — do not alter unrelated keys unless needed, add all new V59 keys to all 3 locales).
- **Terminology Consumer Inventory (verified):**
  - Currently `AddProductModal` (`add-product-modal.tsx:283`) is the ONLY component checking `profile.vocabulary.productKey` (`industry.vocabulary.piece/dish/drink`).
  - `operational-dna.ts` defines `terminology.{partyLabelKey,itemLabelKey,transactionLabelKey,inventoryLabelKey}` with **0 UI consumers**.
  - W1 required terms (`offering`, `transaction document`, `storage location`, `controllable quantity`, `operator`, `request/work order`, `procurement cost`, `offer price/rate`, `return/correction`, `cashbox/receipt account`, `operations/performance report`) and the 7 target sentences lack standardized presentation keys and a unified `useTerminology(dna, profile)` hook across UI surfaces.
- **Test Inventory Count (existing files):**
  - `backend/src/__tests__`: 529 test files (incl. pg tests)
  - `packages/ui/src/__tests__`: 196 test files
  - `packages/local-engine/src/__tests__`: 81 test files
  - `packages/validation/src/__tests__`: 63 test files
  - `packages/api/src/__tests__`: 39 test files
  - `apps/mobile/src/__tests__`: 9 test files
  - `apps/desktop/src/__tests__`: 1 test file

---

## 7. Inventory (e) & (f): Six-Trade Seven-Test Gap Matrix & Parity Audit

1. **Clothing (`clothing`):**
   - _Exists:_ `variants.domain.ts`, `product-variants-section.tsx`, `row-variant-picker.tsx`, `variant-stock-panel.tsx`, `TransferRequestsSection`, `HoldsSection`, `purchase-variant-binding-01`.
   - _Verified Gaps:_ Invoice builder / return flow needs explicit condition-aware return routing (`sellable` / `defective` / `unsellable`) bound to `variant_id` + inventory movement types + ATP check option + variant-focused reporting helper/view across model/size/color/location.
2. **Salon (`beautySalon`, 6–7 staff):**
   - _Exists:_ `salon.ts`, `salon.routes.ts`, `salon.service.ts`, `salon-sections.tsx` (`SalonSetupSection`, `CommissionSection`), `service-delivery.domain.ts`, `salon-01-migration.sql` (double-booking DB trigger on `resource_id`), `AppointmentService` + `appointment.routes.ts`.
   - _Verified Gaps:_
     - `service-delivery.domain.ts` lacks explicit `checked_in` intermediate status (currently `scheduled` → `in_progress` acts as check-in, no `checked_in` distinction or explicit salon calendar view & resource-aware creation UI wired into `ServiceDeliveryContainer`).
     - No local engine routes for `/appointments` or `/salon/*` (keep online-only honest in matrix).
     - Multi-provider commission allocation has no explicit allocation schema/guard (needs explicit validation/guard and `NEEDS_OWNER_DECISION` if unconfigured).
     - Reception vs Stylist vs Manager permission boundary needs explicit API enforcement & test coverage (e.g., stylist self-commission summary read without reading others' payroll/salaries).
     - Salon owner metrics (no-shows, resource utilization, service margin, deposit liabilities) missing consolidated domain summary.
3. **Mobile Shop (`mobilePhones`):**
   - _Exists:_ `serial-batch.domain.ts`, `local-engine/src/routes/serials.ts`, `operations.routes.ts` (`/serials`, `/serials/issue`, `/serials/:id/hold`, `/serials/holds`), `WarrantiesSection`, `InvoiceSerialsPanel`.
   - _Verified Gaps:_ Bulk intake / uniqueness messaging, customer hold (`/operations/serials/:id/hold`) enforcement inside `InvoiceService` / `validateSerialSale` (selling a unit `reserved` for someone else vs releasing on sale!), offline serial hold + offline conflict preservation (`PENDING_REVIEW`), return routing of returned IMEI (`sellable` / `repair` / `quarantine`), and seamless Warranty → Repair Ticket handoff button in UI.
4. **Repair Shop (`repairs`, `mechanic`):**
   - _Exists:_ `repair-tickets.ts` (`received`, `diagnosing`, `waiting_parts`, `repairing`, `ready`, `delivered`, `cancelled`), `repair.routes.ts`, `RepairTicketService`, `RepairTicketsSection`.
   - _Verified Gaps:_ Missing explicit diagnostic/customer-approval step (or canonical mapping to `awaiting_diagnosis`/`awaiting_customer_approval`/`testing`), no part-reservation (`ATP`) / part-consumption-on-repair hook, no separated parts vs labor revenue tracking on the linked invoice/summary, no technician time/profit breakdown helper, and `repair-tickets` routes stay `online_required` unless synced safely.
5. **Gold & Jewellery (`jewellery`):**
   - _Exists:_ `gold-jewellery.domain.ts` (`deriveKaratGramRate`, `calculateJewelleryLine`, `calculateOldGoldTradeIn`), `metal-rates.service.ts`, `metal-rates.routes.ts`, `packages/local-engine/src/routes/metal-rates.ts`, `invoice-grid.ts` (`weightGrams`).
   - _Verified Gaps:_
     - `gold-jewellery.domain.ts` functions are **unwired** from `InvoiceService.create`, `invoice-grid.ts`, and `InvoiceBuilderContainer`! Lines do not store locked rate snapshots (`rate_24k_minor_per_gram`, `karat`, `making_charge_type`, `making_charge_value`, `net_weight_grams`), so invoice pricing does not compute `net weight × locked rate × purity factor + making charge` via `quotePrice`/`applyPrice`.
     - No distinct UI/domain flow for supplier weighted purchase, second-hand gold trade-in/purchase (distinct from scrap/melt loss), showcase vs safe location reconciliation, or gold purity/making-charge reports.
6. **Currency Exchange (`currencyExchange`):**
   - _Exists:_ `currency-exchange.ts`, `exchange.routes.ts`, `exchange.service.ts`, `exchange-section.tsx` (in `/till?tab=exchange`), `exchange-01-migration.sql` (`fx_settings`, `fx_rate_board`, `fx_trades`, `remittances`, `remittance_events`).
   - _Verified Gaps:_
     - **Verified in `exchange-01-migration.sql`:** Trades & remittances do NOT post ledger entries (`«Nothing here posts to the general ledger»`) or reconcile per-currency cashboxes.
     - Cross-currency exchange (one foreign currency for another without explicit intermediate step) and agent settlement / per-currency cashbox closure are not yet unified with atomic ledger/cashbox state.
     - No local engine routes for `/fx/*` (online-only today; offline FX trade queue against known local position + `PENDING_REVIEW` conflict policy must be evaluated/implemented carefully).
7. **Backend / Local-Engine Parity Mismatch Found Immediately:**
   - Local working tree removed `'POST /operations/batches/plan-issue'` and `'POST /operations/batches/issue'` from `packages/validation/src/schemas/offline-endpoint-matrix.ts`, even though `packages/local-engine/src/routes/batches.ts` implements them! Will inspect & reconcile carefully without breaking owner's test intent.
   - `apps/desktop/src` and `apps/mobile/src` contain ZERO inline business calculation duplicates (clean thin host adapters).

---

## 8. `NEEDS_OWNER_DECISION` Initial List

1. **[V55 Decision A — carried forward]** Cost layers per product (`cost_layers` keyed `(workspace, product, warehouse)`) vs per variant. Preserving existing behavior; not modifying cost_layers key.
2. **[W2 Unknown DNA retention]** Existing workspaces without DNA stay undeclared (`UNRESOLVED`), never backfilled as retail.
3. **[8.2 Multi-provider commission]** When a single service session involves multiple providers without explicit split percentages configured, default is explicit refusal/single-provider allocation rather than duplicating commission or inventing 50/50 split.
4. **[8.6 Offline FX & Remittance issuance]** Offline remittance issuance stays closed (`online_required` for payout/code verification security); offline FX trades (if enabled locally) queue against last synced position and flag server shortfalls as `PENDING_REVIEW` rather than silent reject/accept.
5. **[8.5 Gold tax/profit & KYC threshold jurisdiction]** Preserve workspace configurable KYC threshold (`null` default) and workspace tax settings without hardcoding country-specific percentages.

---

## 9. V59 Slices & Exit Criteria

- **Slice 1 (Foundations: W1 + W2 + W3 + W4 + W6):** Unified capability/DNA resolver, extended workforce + declarative Axis 8 Presentation Profile, i18n terminology (`fa`/`af`/`en`) + `useTerminology` hook, local-engine profile routes + conflict handling, independent access evaluator (`evaluateFeatureAccess`), role-aware `DashboardRegistry` widgets + role start composition, foundation tests. **Followed by Mandatory Static Review Gate.**
- **Slice 2 (Clothing):** Variant return disposition routing (`sellable`/`defective`/`unsellable`), variant ATP-aware UI/check & variant inventory/margin reporting + parity tests.
- **Slice 3 (Salon):** Checked-in session transition, resource-conflict-aware booking UI, multi-provider guard, stylist self-commission scope vs reception restriction, salon owner dashboard KPIs + tests.
- **Slice 4 (Mobile Shop):** Serial reservation (`reserved`) check in sales/release, bulk IMEI uniqueness + offline conflict `PENDING_REVIEW`, return condition routing, warranty → repair ticket handoff + tests.
- **Slice 5 (Repair Shop):** Extended repair lifecycle + customer diagnosis approval state + ATP part reservation/consumption + parts vs labor invoice separation + repair metrics + tests.
- **Slice 6 (Gold):** Purity + making charge wiring into shared pricing & invoice calculation, immutable rate snapshot, second-hand gold purchase & melt/scrap movement + location/purity reports + tests.
- **Slice 7 (Exchange):** Additive SQL migration (`exchange-02`) + VERIFY + PG test for atomic FX/cashbox/remittance ledger integration (where currency ledger applies) + per-currency cashbox & FX reconciliation + offline FX `PENDING_REVIEW` queue + reports + tests.
- **Slice 8 (Closure):** Coverage generator updates, architecture & QA doc reconciliation, V59 terminology/trade/implementation reports.
- **Section 11 (Final Verification):** Run V1–V9 once, execute fix loop (max 3 rounds), deliver Persian forensic final report.
