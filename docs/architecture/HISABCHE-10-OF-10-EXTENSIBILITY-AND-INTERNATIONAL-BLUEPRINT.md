# HISABCHE — 10/10 COMPLETION, POST-10/10 EXTENSIBILITY & INTERNATIONALIZATION BLUEPRINT

**Repository:** `hamednourzaei/hisabche`  
**Architectural Principle:** Strict Single-Core Integrity (`AGENTS.md` §2 — "One of everything — extend, never duplicate")  
**Purpose:** Provide the concrete engineering design to close all remaining gaps to **10/10 across every pillar**, make every core extensible without creating parallel engines, outcompete regional and global alternatives without falling into their architectural traps, and prepare Hisabche cleanly for international expansion.

---

## 1. Competitor Landscape Synthesis (Grounded in Repository Intelligence)

Based on [agent-2-competitor-landscape.md](../product-intelligence/agent-2-competitor-landscape.md), [REDTEAM-COMPETITOR-VERIFICATION.md](../product-intelligence/REDTEAM-COMPETITOR-VERIFICATION.md), and [V70-COMPETITOR-GAPS.md](V70-COMPETITOR-GAPS.md):

| Tier                         | Competitors                                      | Where Competitors Win Today                                                                                                                                | Competitor Traps (`DO_NOT_IMITATE`)                                                                                                                              | Hisabche Structural Moat                                                                                                                                                   |
| :--------------------------- | :----------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Global Cloud SaaS**        | QuickBooks Online, Xero, Zoho Books              | Open-banking bank feeds + matching rules (`G23`/`G24`), statutory tax engines (GST/ZATCA/VAT), SSO/GDPR (`G89`/`G93`), ecosystem app stores                | Mandatory broadband on every save (`>5 Mbps`); Intuit's synthetic base-currency coercion breaking multi-currency cash bazaars; zero Jalali/Dari RTL              | Real SQLite local engine (`1.83 ms` offline invoice latency), native per-currency ledger derivation (`partyBalancesByCurrency`), Solar Hijri + Dari/Persian/English parity |
| **Global Open/Mid ERP**      | Odoo, ERPNext, Dynamics 365                      | MRP (`G53`), complex multi-warehouse pick/pack/ship (`G59`), dynamic custom doctypes without core forks, multi-company consolidation (`G80`)               | Odoo Web POS IndexedDB degrades above 10k SKUs; ERPNext/Dynamics have heavy ops/implementation burden (`$50–$100/user/mo` or complex Python/MariaDB ops)         | Lightweight TypeScript monorepo, compiled Fastify backend + Electron desktop + Expo Android sharing one `packages/ui` & `packages/validation` domain core                  |
| **Hospitality & Retail POS** | Toast, Square, Shopify POS, Lightspeed           | Table maps (`G07`), Kitchen Display Systems (`G08`), split bills (`G06`), native offline receipt/gift cards (`G01`/`G02`), Z-reports (`G31`)               | Toast/Square offline card risk & 24h expiry; Shopify POS Pro `$89/mo/location` + mandatory e-commerce plan                                                       | Zero-hardware-dongle licensing, portable per-user encrypted SQLite partitions (`per-user-partition.ts`) safe on shared shop tills                                          |
| **Regional Incumbents**      | Sepidar, Holoo, RayanAfzar / Afghan Sarrafi apps | Certified Iranian Moadian & VAT (`G33`/`G34`), mature cheque/promissory note books (`G26`), biometric attendance (`G38`), Hawala multi-currency settlement | Sepidar locked to Windows SQL Server + Iran-only tax schema; Holoo bound to fragile USB hardware dongles + 1990s UI; Afghan VB/Access apps corrupt on power loss | ACID SQLite + PostgreSQL double-entry ledger, modern multi-platform apps, zero-dongle cryptographic session tokens                                                         |

### Prioritized High-ROI Competitor Gaps from the 60-Gap Catalog (`V70-COMPETITOR-GAPS.md`)

1. **Tier 1 (Immediate Commercial Unlock — Retail, F&B & Wholesale):**
   - `G31` Till Z-Report & Shift Reconciliation (`pos_sessions` extension)
   - `G01` / `G02` Gift Cards & Store Credit (booked via liability account roles, settled by `PaymentsService`)
   - `G54` / `G55` Recipe BOM & Wastage Tracking (feeding canonical `inventory_consume_layers` with explicit loss reason)
   - `G06` / `G07` / `G08` Hospitality Split Bill, Table Map UI & Multi-Printer / KDS routing over existing `order_deposits` & `app-bridge` ESC/POS drivers
2. **Tier 2 (Regional Finance & Supply Chain Depth):**
   - `G23` / `G24` Bank Statement Import + Deterministic Matching Rules (extending `finance/bank/` backend core)
   - `G26` / `G29` Structured Cheque/Promissory Maturity Ledger & Petty Cash (`payments` sub-type + GL liability/clearing accounts)
   - `G60` Barcode Label Studio (`till.labels` / `@hisabche/formatting` + desktop print bridge)
3. **Tier 3 (Enterprise & Cross-Border):**
   - `G33` / `G34` Pluggable E-Invoicing / VAT Adapters (Moadian, ZATCA, EU VAT)
   - `G80` Multi-Company / Branch Consolidated Statements (`journal_lines` + elimination dimension)
   - `G89` / `G92` / `G93` OIDC/SAML SSO, Regional Data Residency & GDPR DSAR export/erasure

---

## 2. Exact Engineering Path from Current State → True 10/10

To move every pillar honestly to **10/10** under [EVALUATION-GATES.md](../audit/EVALUATION-GATES.md):

### Pillar A: Database Referential Integrity & Accounting Parity (7–8/10 → 10/10)

Current documented gaps in [.claude/accounting-integrity/00-SPEC.md](../../.claude/accounting-integrity/00-SPEC.md) and [.claude/db-integrity/00-SPEC.md](../../.claude/db-integrity/00-SPEC.md):

1. **Per-Line Warehouse Attribution for COGS (`O4`):** Add optional `warehouse_id UUID REFERENCES warehouses(id)` to `invoice_items` (additive `NOT VALID` FK -> backfill -> `VALIDATE`) and pass `line.warehouseId` into `inventory_consume_layers`, preserving weighted/FIFO accuracy per warehouse.
2. **Audit-Clean Opening Balances & Inventory Adjustments (`O1`, `O5`):**
   - Add `'opening_equity'` to `accounts.role` CHECK constraint (`docs/db-integrity-02-migration.sql` + `VERIFY-*` + `*.pg.test.ts`).
   - Route opening stock, manual adjustments, inter-warehouse transfers, and production outputs through canonical `InventoryCostingService` layer write + `AccountingService.postDocument` (`Dr Inventory / Cr Opening Equity` or `Dr/Cr Stock Variance`).
3. **Source ID Type Consistency (`O6` / `N1`):** Fix `repost.service.ts:232` to derive deterministic UUIDv5 (`source_id UUID`) or store compound trace metadata in `journal_entries.metadata` rather than pushing composite strings into `uuid` column.
4. **Full Migration Verification Parity:** Close the **120** migrations lacking `VERIFY-*.sql` and **109** lacking `*.pg.test.ts` ([MIGRATIONS-PENDING.md](../MIGRATIONS-PENDING.md)) via automated CI check requiring every `docs/*-migration.sql` to pair with `VERIFY-*` and a real-Postgres idempotency test.
5. **Timezone Standardization (`N5` / `F3`):** Convert all 66 `timestamp without time zone` columns across 29 tables (starting with `workspace_invites.expires_at` and `payrolls.payment_date`) to `TIMESTAMPTZ` in additive phase 8 migration after explicit UTC baseline probe (`FINDING`).

### Pillar B: Official 10/10 Industry Sellability & Zero-Gap Verification (6.5/10 → 10/10)

1. **Unblock Real PostgreSQL Execution (`P1`):** Provision PostgreSQL 17 / healthy native binaries (or Linux CI runner / `PGLITE_DIR`) to run all **186** `backend/src/__tests__/*.pg.test.ts` + all 4 `journey-industries-{1..4}.pg.test.ts` specs.
2. **Execute Playwright 67-Trade Journey (`P2`):** Run `apps/web/e2e/journey-industries.spec.ts` against the real Fastify + PostgreSQL journey server on a clean committed tree (`run-acceptance.mjs`), moving `POSTGRES_JOURNEY` and `BROWSER_JOURNEY` from `0/67` to measured coverage.
3. **Wire Remaining Capabilities (`UNWIRED`):** Connect screens for the `14` currently documented unwired hooks in [unwired-capability-hooks.test.ts](../../packages/ui/src/__tests__/unwired-capability-hooks.test.ts) (appointments, crop cycles, group session participants UI, vehicle fitments, warranty claim trigger) and restore controlled user-initiated snapshot import (`restorable` flow with double-entry re-verification).

### Pillar C: Runtime HA, Dockerization & Edge Operations (6/10 → 10/10)

1. **Container & Edge Packaging:** Add canonical multi-stage `Dockerfile` (API + worker + web/admin) and local HA `docker-compose.yml` (Primary PG + Standby Streaming Replica + PgBouncer + Redis + Nginx mounting `infra/nginx/hisabche.conf`) so HA failover and `scripts/dr-restore-drill.mjs` run reproducibly offline/locally.
2. **Live Nginx Control-Plane Bridge:** Pair existing persisted Postgres controls (`platform.nginx_infrastructure_settings` via `AdminOps` Step-Up) with either an authenticated sidecar reloader / `nginx -s reload` config generator OR `njs`/Lua/upstream dynamic header consumption so toggling rate limit / cache bypass / maintenance mode propagates cleanly both at L7 edge and inside Fastify runtime.
3. **Multi-Instance Rate Budget & Pressure Sync:** Ensure `adminRateLimitHook` and global Fastify rate limits share Redis state across all nodes cleanly while respecting live updates from `adminInfrastructureService`.

---

## 3. Post-10/10 Architecture: Making Every Core Extensible (Zero Parallel Engines)

Once at 10/10, Hisabche avoids turning into a monolithic tangle by using **Ports, Typed Extensions & Declarative Registries** around its single canonical cores — **never** creating a second ledger, inventory engine, or UI table:

1. **Accounting Core Extension (`AccountingService` + `LedgerPort`):**
   - _Mechanism:_ Keep `journal_entries` + `journal_lines` immutable and strictly balanced at the DB trigger level. Add **Account Role Registration** + **Structured Dimensions (`cost_center_id`, `project_id`, `branch_id`, `department_id`)** + **Subledger Reconciliation Hooks**.
   - _Rule:_ New vertical documents (cheques `G26`, gift cards `G01`, payroll provisions `G36`, repair deposits) never touch SQL tables directly; they register a pure mapping function `(DomainEvent) => PostingLines[]` validated by `validateEntryLines` (`packages/validation/src/schemas/accounting.domain.ts`).
2. **Invoicing & Trade Document Core (`InvoiceService` + Domain Plugins):**
   - _Mechanism:_ Extend `invoice_item_details` JSONB/typed sidecar + pre/post validation hooks keyed by **Trade DNA Capability** (`variants`, `serials`, `batches`, `roll_cutting`, `repair_ticket`, `table_service`, `gold_purity`) inside `packages/validation/src/schemas/universal-core/`.
   - _Rule:_ One `InvoiceService.create` pipeline executes in deterministic stages: `Parse & Validate Lines` -> `Resolve Pricing/Discounts` -> `Consume/Reserve Stock Layers` -> `Derive Taxes` -> `Build Document Write RPC` -> `Post Double-Entry Journal`. New industries plug into stage handlers without copying `InvoiceService`.
3. **Inventory Costing Core (`InventoryCostingService`):**
   - _Mechanism:_ Polymorphic valuation strategy interface (`FIFO`, `AVCO`, `SpecificSerial/VIN`, `BatchFEFO`) resolved per product/workspace inside `backend/src/services/inventory-costing/`, all backed by the same `cost_layers` + `cost_consumptions` conservation invariant (`remaining_qty <= received_qty`).
4. **Offline Sync Core (`packages/local-engine` + `packages/app-bridge`):**
   - _Mechanism:_ Every online-only (`C`) feature moving to offline (`L`) follows one checklist: (a) shared pure calculation in `@hisabche/validation`, (b) additive migration in `local-migrations.ts` + `local-schema.ts`, (c) table added to `localTableSchema`, (d) route handler in `packages/local-engine`, (e) `offline-endpoint-matrix.ts` row flipped from `online_required` to `available` (`offline-matrix-consistency.test.ts` enforces zero drift automatically).
5. **Client Hardware & Integration Adapters (`packages/app-bridge` + `TaxAuthorityPort`):**
   - _Mechanism:_ Define clean typed ports in `packages/app-bridge` / `backend/src/ports/`:
     - `FiscalPrinterPort` / `ScalePort` (ESC/POS Ethernet/USB/Bluetooth + serial weight protocol)
     - `BankFeedPort` / `PaymentGatewayPort`
     - `StorageProvider` (`backend/src/storage/storage-adapter.ts`)
     - `TaxClearancePort` (e-invoicing adapters per country)
6. **UI Extension Contract (`packages/ui` + `packages/ui-contract`):**
   - _Mechanism:_ New vertical panels render inside existing hubs (`PageHub` / `HubTabs` + `TabSections` + `DataTable`) driven by `resolveOperationalDna` capabilities (`useActionAvailability`), never spawning orphan top-level routes or duplicate tables.

---

## 4. Internationalization & Global Expansion Architecture (Fitted to Current Monorepo)

Expanding beyond Iran (`fa-IR`) and Afghanistan (`fa-AF`) into GCC (UAE, KSA), Turkey, Central Asia (Tajikistan/Uzbekistan), Europe, and North America leverages Hisabche's existing clean monorepo boundaries (`packages/i18n`, `packages/formatting`, `packages/validation`, `backend`, `packages/ui`) via **five concrete upgrades**:

| Layer                                                                  | Current Capability in Repo                                                                                                                                                                              | Concrete Internationalization Upgrade                                                                                                                                                                                                                                                                                                                                                                        |
| :--------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Multi-Currency Double-Entry (`journal_lines`)**                   | `partyBalancesByCurrency` computes party debts cleanly per currency; however `journal_lines` lacks `transaction_currency` & `transaction_amount` (`DEFECT-CUR-02` in `.claude/db-integrity/00-SPEC.md`) | Extend `journal_lines` with nullable-safe -> required `currency CHAR(3)`, `foreign_amount BIGINT`, `exchange_rate NUMERIC(18,8)` alongside `base_debit` / `base_credit` (books currency), enabling true multi-currency General Ledger, IAS 21 realized/unrealized FX revaluation batches, and intact cash-bazaar balance tracking without synthetic QBO lock-in                                              |
| **2. Pluggable Country Fiscal & Tax Profiles (`TaxJurisdictionPort`)** | Pure VAT/tax rule stubs + `tax_snapshot` JSONB on `invoices`                                                                                                                                            | Introduce workspace `country_code` (ISO 3166-1) + **Fiscal Rule Packs** in `@hisabche/validation` (`IR-VAT`, `AF-BRT`, `AE-VAT-5%`, `SA-ZATCA-Phase2`, `TR-KDV`, `EU-VAT-OSS`, `US-SalesTax`), plus an async outbox adapter `TaxClearancePort` for signed XML/JSON clearance (ZATCA UBL 2.1, Iran Moadian, European PEPPOL) decoupled from real-time POS save                                                |
| **3. Calendar, Numerals & RTL/LTR Engine**                             | `@hisabche/formatting` + `useDateFormat()` support Jalali/Solar Hijri & Arabic-Indic digits; `packages/ui` enforces logical Tailwind properties (`ms-`/`me-`/`ps-`/`pe-`/`text-start`)                  | Keep RTL logical CSS law everywhere so adding Arabic (`ar`), Turkish (`tr`), Urdu (`ur`), Tajik (`tg`), Russian (`ru`), or English (`en`) automatically flips layout direction cleanly via `<html dir>` derived per locale (`rtl` vs `ltr`); introduce explicit workspace calendar setting (`gregorian`, `jalali_ir`, `jalali_af`, `islamic_umalqura`) instead of inferring calendar solely from UI language |
| **4. UTC Backend + Workspace Timezone Policy**                         | `timestamp without time zone` on 66 DB columns creates cross-region drift (`F3` finding); client has `WorkplaceTimeZoneSection`                                                                         | Complete DB migration to `TIMESTAMPTZ` everywhere (`UTC` storage, ISO-8601 on wire), formatting all business day cutoffs (`Shift`, `Till Z-Report`, `Daily Sales Chart`) exclusively against `workspace.time_zone` (`IANA` e.g. `Asia/Kabul`, `Asia/Tehran`, `Asia/Dubai`, `Europe/Berlin`)                                                                                                                  |
| **5. Data Residency, SSO & Compliance (`G89`, `G92`, `G93`)**          | Multi-region DB router (`backend/src/db/routing.ts`), Writer Fencing (`fencing.ts`), Pluggable S3 Storage (`storage-adapter.ts`), Local JWT verifier (`jwt-verifier.ts`)                                | Pair `workspace.home_region` (`ir-thr`, `eu-central`, `me-south`) in control-plane registry so EU/UAE/Iran customer data never crosses borders; layer OIDC/SAML SSO onto existing `auth.middleware.ts`; expose automated GDPR/DSAR anonymization & portable JSON/CSV export (`useExport` + `data.backup` already `alwaysAllowed`)                                                                            |

---

## 5. Phased Execution Checklist & Acceptance Gate

- **Phase 1 (Immediate Working-Tree Hygiene — Zero Red Tests & Zero TS Errors):** Fixed `admin-infrastructure.routes.ts` TS2769, CSS token existence in `infrastructure-toggles-panel.tsx`, `monitor-panel.tsx` font size `<12px`, `GET/POST /suppliers` & `/admin/infrastructure/settings` client `/api/api` 404 bugs, offline endpoint matrix entries, and implemented `POST /suppliers` in `packages/local-engine`.
- **Phase 2 (Nginx Persistence & Runtime Enforcement):** Upgraded `adminInfrastructureService` to persist settings via reserved row `platform.nginx_infrastructure_settings` in `feature_flags`, synced `maintenanceMode` with Fastify `SERVICE_READ_ONLY`, added live runtime headers & rate-limit toggle hooks in `backend/src/index.ts`, and mounted `InfrastructurePanel` cleanly under Operations › Servers in `apps/admin` with `StepUpDialog`.
- **Phase 3 (Database & Ledger Constraints Closure — Next Owner Migration Round):** Execute `FINDING` blocks, run `docs/db-integrity-02-migration.sql` (per-warehouse COGS FK, `opening_equity` role, `journal_lines` FX columns, `TIMESTAMPTZ` conversion), and generate missing `VERIFY-*.sql` + `*.pg.test.ts`.
- **Phase 4 (CI Postgres & Browser Journey Sign-Off):** Commit clean tree, run `node scripts/industry/run-acceptance.mjs --postgres` and `--browser` across all 67 trades.
- **Phase 5 (Global Market Launch Readiness):** Enable country Fiscal Rule Packs (`TaxJurisdictionPort`), multi-printer/KDS hospitality pack, bank feed importers, and Docker/Compose multi-region HA verification.
