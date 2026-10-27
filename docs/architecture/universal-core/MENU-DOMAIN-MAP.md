# Menu domain map — every destination, what it already holds, where new work must land

Built 2026-10-26 by opening the navigation contract (`packages/ui-contract/src/navigation.ts`), each hub container, the hub i18n trees, the backend services/routes, the local-engine routes and the offline matrix, and by running `node scripts/audit-unwired-routes.mjs` (808 routes, 106 with no client caller). Purpose: before anyone writes anything, find the owner of the concept. **A concept that already has an owner is extended there; it is never rebuilt.**

Conventions that decide where code lives: a menu destination = a hub (`PageHub`/`HubTabs`: `?tab=` + one `SegmentedControl` `?view=`). A feature that shares data with a page becomes a **tab or section of that hub**, not a route (CLAUDE.md §0.6). Rule → `packages/validation/src/schemas/<x>.domain.ts`; service → `backend/src/services/<domain>/`; route → `backend/src/routes/<domain>.routes.ts`; engine → `packages/local-engine/src/routes/<domain>.ts` + `packages/app-bridge/src/local-schema.ts`; hook → `packages/api/src/hooks/<domain>.ts`; UI → `packages/ui/src/components/ui/<domain>/`; matrix row → `packages/validation/src/schemas/offline-endpoint-matrix.ts`; i18n ×3 → `packages/i18n/messages`.

## 0. The 18 destinations

| #   | Menu id (route)                  | Hub structure (tab → sections)                                                                                                                                           | UI folder                                                                      | Backend                                                                                      | Engine route                                                                                                    |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | `today` (/dashboard)             | cards: stats, chart, funnel, insights, business health, recent invoices, activities, work queue                                                                          | `dashboard/`                                                                   | `reporting/dashboard.service`, `insights/`                                                   | `dashboard.ts`, `insights.ts`                                                                                   |
| 2   | `get-paid` (/invoices)           | **invoices** (list, builder `/invoices/new`, detail, recurring) · **pricing** (promotions, price lists)                                                                  | `invoices/`, `invoice-builder/`, `invoice-detail/`, `promotions/`              | `invoice.service`, `invoices/`, `commerce/{price-list,promotion,installment,late-fee}`       | `invoices.ts`, `pricing.ts`, `installments.ts`                                                                  |
| 3   | `stock` (/warehouse)             | **stock** → warehouses · products · reorder · deadStock · shelfMap; **expiry** (batches, serials)                                                                        | `warehouse/`, `warehouse-detail/`, `expiry/`, `inventory-ops/`, `cycle-count/` | `product.service`, `warehouse.service`, `inventory/*`, `inventory-costing/`, `traceability/` | `products.ts`, `warehouses.ts`, `shelves.ts`, `transfers.ts`, `units.ts`, `stock-insights.ts`, `cost-layers.ts` |
| 4   | `money` (/accounting)            | **books** → accounts · journal · monthEnd; **treasury** → bank · assets · financing; **reports** → trialBalance · balanceSheet · incomeStatement · budgets               | `accounting/`, `bank/`, `assets/`, `budgets/`                                  | `accounting/*`, `banking/`, `assets/`, `budgeting/`, `tax/`, `dimensions/`, `currency/`      | `accounting.ts`, `local-ledger.ts`, `budgets.ts`, `exchange-rates.ts`                                           |
| 5   | `buyers` (/customers)            | **customers** (list, profile, credit, CRM panel) · **outreach** → followUp · campaigns · stale                                                                           | `customers/`, `crm/`, `campaigns/`                                             | `customer.service`, `customer-profile/`, `crm/`, `campaigns/`, `supplier/`                   | `customers.ts`                                                                                                  |
| 6   | `approvals`                      | **requests** · **workflows**                                                                                                                                             | `workflow/`                                                                    | `workflow/*`, `workflow.service`                                                             | —                                                                                                               |
| 7   | `till` (/till)                   | sessions, cash in/out, settlements, ledger                                                                                                                               | `till/`                                                                        | `pos/`, `payments/`                                                                          | `till.ts`                                                                                                       |
| 8   | `coworkers` (/team-and-payroll)  | **team** → employees · branches; **pay** → attendance · timesheets (+ payroll, leave, shifts, devices)                                                                   | `team-and-payroll/`, `human-resources/`                                        | `payroll/`, `attendance*/`, `human-resources.service`, `timesheets/`, `branch/`              | `employees.ts`, `payroll.ts`, `attendance.ts`, `branches.ts`                                                    |
| 9   | `production` (/manufacturing)    | boms · workOrders · history · report                                                                                                                                     | `manufacturing/`                                                               | `manufacturing.service`                                                                      | — (online-only)                                                                                                 |
| 10  | `analysis` (/analysis)           | money → collections · suppliers · breakEven · cohorts · workingCapital; market → benchmark; reports → report builder, dashboards                                         | `analysis/`                                                                    | `analysis/`, `reporting/`, `custom-reports.routes`                                           | `analysis.ts`, `reports.ts`, `report-sources.ts`                                                                |
| 11  | `governance` (/governance)       | overview · members · permissions · approvals · SoD · audit                                                                                                               | `governance/`, `permissions/`, `audit/`                                        | `authorization/`, `permission.service`, `audit.service`                                      | —                                                                                                               |
| 12  | `settings` (/settings)           | **general** (language, business info, industry profile, book currency, time zone, credit-limit mode, metal unit, hardware) · **integrations** → developers · marketplace | `settings/`, `developers/`, `marketplace/`                                     | `workspace/`, `developer/`, `connectors/`, `oauth/`                                          | `workspace.ts`, `me.ts`                                                                                         |
| 13  | `data-and-sync` (/data-and-sync) | **overview** (status) · **details** → sync · conflicts · migration                                                                                                       | `data-and-sync/`, `conflicts/`, `data-migration/`                              | `conflict/`, `migration/`, `portability/`, `cloud-migration/`, `sync.service`                | `import.ts`, `backup.ts`                                                                                        |
| 14  | `sync` (/sync-center)            | device outbox, backup download                                                                                                                                           | `sync-center/`                                                                 | `sync*`, `workspace/backup.service`                                                          | `backup.ts`                                                                                                     |
| 15  | `events` (/activities)           | personal activity feed                                                                                                                                                   | `activity/`                                                                    | `activity.service`                                                                           | `feed.ts`                                                                                                       |
| 16  | `billing` (/billing)             | **plan** · **money** → wallet · referrals                                                                                                                                | `billing/`, `wallet/`, `referrals/`                                            | `billing.service`, `wallet/`, `referral/`                                                    | —                                                                                                               |
| 17  | `market-seller` (/market-seller) | seller listings                                                                                                                                                          | `market/`                                                                      | `market/`                                                                                    | —                                                                                                               |
| 18  | `assistant` (/assistant)         | chat + tools: action pipeline, document read, translate                                                                                                                  | `ai/`                                                                          | `ai/`, `ingest/`, `mcp/`                                                                     | —                                                                                                               |

Not in the menu but real routes: `/stock-count` (cycle count — its page and container exist, no hub mounts it), `/operations` (reorder, dead stock, shift history, cash forecast, stale opportunities), `/developers`, `/marketplace`, `/onboarding`. Public/non-menu: storefront, customer portal, public invoice, attendance link.

## 1. Domain by domain — what exists (verified in code) and the duplicate traps

### 1 · Today

Exists: KPI stats, sales chart/funnel, AI insights, business-health panel, work queue, activity list. Cash forecast and stale opportunities live under `/operations`.
Traps: do not add a "report" card that recomputes profit — `AccountingService.getProfitReport` is the only source. Cards link; they do not calculate.

### 2 · Sales (`get-paid`)

Exists: invoice create/edit/cancel/reverse (`reverseEffects`), idempotency, multi-currency with frozen `exchangeRate`, tax freeze (`TaxService.computeAndFreeze`), recurring invoices (automation `recurring_invoice`), installments, late fees, price lists, promotions (`quotePrice`, `priceListPricing`), invoice PDF, public invoice link, warehouse/branch on invoice, weight multiplier column.
Traps: **sale/purchase are the only document types** — a return is _not_ a third type; build returns as a document that references the original and goes through the existing reversal machinery. Orders (`/api/orders*`, 7 routes) have **no client caller** — they are API-only for developers; do not attach new UI to them as if they were a menu feature. Never add a second price engine.

### 3 · Stock

Exists: warehouses, shelves + auto-shelving + capacity, shelf map, transfers with in-transit state, product units + conversion (`product_units`, `toBaseQuantity`), **multi-barcode with a unit per barcode** (`product_barcodes.unit`), product images, costing method (FIFO / weighted average), cost layers, opening stock as movement, reorder suggestions, dead stock, expiry batches and report, **serial/batch tables** (`stock_batches`, `stock_serials` with `invoice_id`/`sold_on`), cycle count service + route + UI.
Traps: serials/batches/barcodes already have tables — never add `product_serials`, `pack_barcodes`, `vehicle_units`. `/stock-count` is a route that shares data with the stock page → mount it as a **section of the stock hub** (CLAUDE.md §0.6) instead of leaving it orphaned or building another count screen. `GET /api/products/low-stock` has no caller — it duplicates reorder; do not add another low-stock widget.

### 4 · Money (accounting)

Exists: chart of accounts, journal (post/reverse), trial balance, balance sheet, income statement, **cash-flow report** (`/cash-flow`), general ledger with drill-down, **period lock** (company + branch, audited), **month-end package**, **year-end plan/close**, **FX revaluation** (`/currency/revalue`), depreciation, fixed assets, bank statements + reconciliation + categorisation + **learned match bonus**, budgets with distribution and variance, dimensions (analytic tags with requirements), tax components/rules/preview/freeze/drift/return, financing (loans), costing repost.
Traps: **do not add a lock, close, revaluation, cash-flow, or tax module** — extend `setPeriodLock` (hard lock), `TaxService` (offline), the existing reports. `/cash-flow`, `/tax/return`, `snapshots` have no or thin UI: check the hook and the section list (`ACCOUNTING_*_SECTIONS`) before assuming a screen exists — a section may be missing for an endpoint that exists.

### 5 · Buyers (customers)

Exists: customer CRUD, balances by currency, credit **limit** and payment terms (`customer-profile`, display only), documents, supplier link (`customer_invoice_roles`), CRM interactions/opportunities/tasks, follow-up, campaigns, stale opportunities, portal link.
Traps: credit **enforcement** goes in `InvoiceService` calling `creditControl` — not a new "credit" module. CRM data is read only through `services/crm`.

### 6 · Approvals · 11 · Governance

Exists: workflow templates, approval gates, escalation policies, compensation, SoD rules, strict/warn/off governance mode, member module blocks, custom roles, audit log with screen.
Traps: expense claims, three-way-match exceptions, period reopen, large payments **all route through the existing approval gate** — no private approval flag on a new table.

### 7 · Till

Exists: sessions, cash in/out with reason, settlements, ledger, close with counted cash, abandoned sessions, per-currency. Payment can name a till (`pos_session_id`).
Traps: COD, deposits and expense cash-outs use till/payments services; none gets its own cash balance.

### 8 · Team

Exists: employees, branches tree, attendance (sheet, links, devices, holds), shifts, timesheets (billable, linked to invoices), payroll with outcomes, leave.
Traps: driver pay and commission are **payroll lines**; "expense claim reimbursement" is a payroll/payments outcome. No second pay engine.

### 9 · Production

Exists: BoM (versioned), production orders, history snapshots, report; cost via `computeProductionCost`; online-only, no WIP ledger.
Traps: a kit is a **BoM kind**, not a product-bundle table.

### 10 · Analysis

Exists: collections, supplier intelligence, break-even, cohorts, working capital, report builder, dashboard builder, peer benchmark, saved views.
Traps: scheduled report delivery reuses saved views + `email-outbox` + the scheduler; a BI/OData endpoint reads `reporting/dataset.domain`.

### 12 · Settings (incl. developers)

Exists: industry profile editor, book currency, time zone, **credit-limit mode** section, metal unit, hardware; API keys with scopes, webhooks (CRUD, test, rotate, **replay**), OAuth apps, sandbox, storefront, AI assistants, marketplace.
Traps: no second place to edit the industry; webhook console is a section of **developers**; OpenAPI is `@fastify/swagger` at `/docs`.

### 13/14 · Data & sync

Exists: sync status, outbox, **conflict resolution screen**, migration (xlsx/csv, entity detection, column shapes, invoice and BoM import), backups (`BackupService`), backup download panel; `snapshots` API (compare) with **no UI caller**.
Traps: restore drill and snapshots belong here; do not add a "backup" page elsewhere.

### 15–18 · Events, Billing, Market, Assistant

Exists: personal activity feed; plans, entitlement, wallet, referrals; marketplace listings; AI chat, action pipeline, document read/translate, MCP gateway.
Traps: a connector never writes a financial table; the AI pipeline calls the app's own routes.

## 2. Backend routes with no client caller (do not rebuild — wire or leave)

`orders*` (7), `snapshots*` (3), `audit/export|stats|entity|user`, `analytics/inventory|financial`, `products/low-stock`, `customers/:id/balance`, `departments*`, `attendance` legacy trio, `work-orders PATCH`, `projects*`, `permissions/*`, `ai/query`, plus admin, public-token, oauth, offline-licence and debug routes (public/admin ones are expected). Before building any option, check whether one of these already is its backend.

## 3. Where the 50 options land (hub → tab → section)

| #         | Option                | Lands in                                                  | Extends / reuses                                             | Never create                     |
| --------- | --------------------- | --------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------- |
| 1         | Hard lock             | Money → books → monthEnd (+ Governance)                   | `setPeriodLock`, `governance.routes`, engine `accounting.ts` | a second lock table              |
| 2         | Consolidation         | Money → reports (group view) + Settings → general (group) | `accounting.reports`                                         | a second ledger                  |
| 3         | Tax offline           | Sales invoice builder; Money → reports                    | `TaxService`, move rules to `packages/validation`            | a second tax calculator          |
| 4         | Deferred revenue      | Money → books (new section `deferrals`)                   | `ledger.postDocument`, automation tick                       | a second posting path            |
| 5         | Three-way match       | Sales invoice builder (purchase type) + Approvals         | `purchasing.domain`, approval gate                           | a match table outside purchasing |
| 6         | Recurring journals    | Money → books → journal                                   | automation `recurring_expense` (declared, not executable)    | a new action name                |
| 7         | Cash flow             | Money → reports (add a section — the endpoint exists)     | `/cash-flow`                                                 | a recomputation                  |
| 8         | Skip                  | —                                                         | budgets + `/operations` cash forecast                        | —                                |
| 9         | Expense claims        | Team → pay (new section `expenses`)                       | approval gate, payments, payroll                             | a private approval               |
| 10        | Learned rules         | Money → treasury → bank                                   | `match-learning`                                             | —                                |
| 11        | Variants              | Stock → stock → products; invoice grid                    | `products`, `product_barcodes`                               | a parallel product table         |
| 12        | Serial/batch at sale  | Sales builder row; Stock → expiry                         | `stock_serials`, `stock_batches`, traceability               | `product_serials`                |
| 13        | Landed cost           | Stock → stock → products (receipt) / purchase invoice     | `inventory-costing`, `repost.domain`                         | a second cost layer              |
| 14        | Kits                  | Production → boms (kind)                                  | BoM                                                          | a bundle table                   |
| 15        | Pack barcodes         | Stock → product barcodes panel                            | `product_barcodes.unit`                                      | `pack_barcodes`                  |
| 16        | Delivery notes        | Sales → invoices (detail)                                 | invoice lines, `transfer` in-transit pattern                 | a delivery stock ledger          |
| 17        | Reorder → draft PO    | Stock → stock → reorder                                   | `ReorderService`, `PurchasingService`                        | a PO table                       |
| 18        | Warranty              | Stock → product (serial) / Sales detail                   | `stock_serials`                                              | stock copy                       |
| 19        | Area pricing          | Sales builder; Settings units                             | `invoice-grid`, `units-seed`                                 | a pricing engine                 |
| 20        | Roll stock            | Stock → expiry (batches) + builder                        | `stock_batches.remainingQty`                                 | a roll table                     |
| 21        | Gold                  | Sales builder; Settings → metal unit                      | `pricing.ts`, invoice grid                                   | a metals ledger                  |
| 22        | Freight trips         | Team/Stock? → **new tab "Transport" under Sales**         | invoices, assets, payroll                                    | trip money fields                |
| 23        | Passenger             | same Transport tab                                        | invoices                                                     | a ticket payment table           |
| 24        | Courier + COD         | same Transport tab; Till                                  | till, payments                                               | COD balance                      |
| 25        | OEM / fitment / core  | Stock → products                                          | `product_barcodes.kind`                                      | an identifier table              |
| 26        | Appointments          | Buyers → outreach                                         | CRM tasks, invoices                                          | a calendar engine                |
| 27        | Agriculture           | Production → (new section)                                | stock movements                                              | a farm ledger                    |
| 28        | Moodian               | Settings → integrations                                   | connectors framework                                         | a service outside `connectors/`  |
| 29        | ARD return            | Money → reports (tax return)                              | `TaxService.getTaxReturn`                                    | a second return                  |
| 30        | Local payments        | Settings → integrations; Billing                          | `checkout.service`, connectors                               | a payment table                  |
| 31        | Conflicts             | Data → details → conflicts                                | exists                                                       | —                                |
| 32        | E2E                   | `apps/desktop/e2e`                                        | 4 tests exist                                                | a second runner                  |
| 33        | Encrypted DB          | Desktop main + app-bridge                                 | `secure-store.ts`                                            | a second key store               |
| 34        | Scheduled reports     | Analysis → reports                                        | saved views, outbox, scheduler                               | a scheduler                      |
| 35        | Drill-through         | Today cards → Money ledger drawer                         | `use-account-drilldown`                                      | a new drawer                     |
| 36        | Management pack       | Analysis → reports                                        | `/aging`, working capital, cash flow, `pdf/`                 | recomputation                    |
| 37        | OData                 | Settings → developers                                     | `reporting/dataset.domain`, API scopes                       | a second API layer               |
| 38        | Export footer         | `packages/formatting`                                     | `toCSV`, `buildXlsx`                                         | a second exporter                |
| 39        | OpenAPI + SDK         | Settings → developers                                     | `@fastify/swagger`                                           | a doc generator                  |
| 40        | Connectors            | Settings → integrations                                   | `services/connectors`                                        | a service per vendor             |
| 41        | Zapier                | external package                                          | OAuth apps, webhooks                                         | a second token system            |
| 42        | Webhook console       | Settings → developers                                     | replay route                                                 | —                                |
| 43        | Accountant mode       | Settings (workspaces)                                     | memberships, `enterWorkspace`                                | a new identity type              |
| 44        | Migration kits        | Data → details → migration                                | `services/migration`                                         | a separate importer              |
| 45–46, 50 | SOC 2 / ISO / pentest | `docs/security/`                                          | audit log, runbooks                                          | —                                |
| 47        | Customer MFA          | Settings → general (security)                             | Supabase AAL2 used by admin                                  | a custom OTP                     |
| 48        | Audit proof           | Governance → audit                                        | `audit.routes`                                               | a second log                     |
| 49        | DR / restore drill    | Data → details; Sync centre                               | `BackupService`, `snapshots`                                 | a second backup                  |

Transport (22–24): the menu has no transport destination. Per the one-hub rule it becomes **a tab of the Sales hub** (it sells freight, tickets and deliveries as invoices), not a new menu item and not a new route.
