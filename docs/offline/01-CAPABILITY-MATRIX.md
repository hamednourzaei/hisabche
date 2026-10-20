# Hisabche Offline Edition — Phase 1 Capability Matrix

> **Phase 1 is an audit. No product code was changed to produce this document.**
> Every claim below is traceable to a file in this repository and to a command
> recorded in §0.4. Where a fact could not be established in this phase it says
> so instead of guessing.

Programme: `docs/offline/OFFLINE-EDITION-PROMPT.md` (the owner's ten-phase spec).
This file is the Gate 1 artefact. Nothing in Phase 2 may start until the owner
approves the **L / C split** in §5.

---

## 0. Gate 1 — what was measured

### 0.1 Route coverage

`packages/app-shell/src/app/app.tsx` is the authoritative route list. Measured
on 19 Oct 2026:

| Measurement                                                | Value   | Command                                                                                                                |
| ---------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `path:` occurrences                                        | **71**  | `(Select-String -Path packages\app-shell\src\app\app.tsx -Pattern "path:" \| Measure-Object).Count`                    |
| index routes                                               | **1**   | counted `index: true`                                                                                                  |
| **total route entries**                                    | **72**  | 71 + 1                                                                                                                 |
| rendered screens                                           | **35**  | 34 `path:` pages + 1 index                                                                                             |
| redirect-only entries                                      | **36**  | 34 inline `<Navigate>` + 2 legacy id-carrying components (`LegacyInvoiceRedirect`, `LegacyEmployeeRedirect`)           |
| layout path                                                | **1**   | `path: '/'` → `RequireAuth` + `AppShell`                                                                               |
| `<Navigate>` elements                                      | **36**  | includes the two legacy id-carrying redirects                                                                          |
| `lazy(() => import(…))` pages                              | **34**  | `/login` is a static import                                                                                            |
| hook rows in Appendix A                                    | **443** | 34 sections; 429 on the 32 `path:` pages + 15 on the index screen − 1 duplicate row merged                             |
| `@hisabche/api` hook mounts on the 32 `path:` pages        | **429** | generator over `screens.ts`, §0.4                                                                                      |
| distinct hook export names                                 | **311** | 307 on the 32 `path:` pages + 4 index-only (`useDashboardKPIs`, `useDashboardSales`, `useActivities`, `useAIInsights`) |
| distinct method+path strings reachable from a page         | **308** | 300 via hooks + 8 direct `fetch`/`apiClient` calls                                                                     |
| distinct sync endpoints in `sync-center` / the sync engine | **15**  | §Appendix A `sync-center` block; 2 of them (`POST /customers`, `POST /products`) also appear on a page                 |
| distinct method+path strings in the whole document         | **321** | 308 page + 15 sync − 2 shared                                                                                          |
| backend route files                                        | **89**  | `backend/src/routes/*.ts`, all 89 register at least one handler                                                        |
| backend handler registrations                              | **717** | 711 `fastify.get/post/put/patch/delete` + 1 `fastify.options` + 5 `server.*` (`system-metrics.routes.ts`)              |

**Every one of the 72 route entries appears in §3.** 35 are screens, 36 are
redirects, 1 is the authenticated layout. There is no route in `app.tsx` that
this document does not list.

The matrix is grouped as a tree (§4): one row per **capability**, not per route,
because a route such as `/warehouse/:id` carries 38 distinct endpoints and
calling that one "row" would hide exactly the decisions Phase 2 needs.

### 0.2 What "covered" means here

For every capability row §4 gives the eight fields the spec asks for:

`Current implementation` · `Actual files` · `Current dependency` ·
`Why server is required` · `Can become local` · `Required refactor` ·
`Risk` · `Test required`

and the wiring columns:

`Page / route` · `Hook` · `Method + path` · `Backend service + Postgres function` ·
`Writes which tables` · `Rule files` · `Class`

`Writes which tables` is **service-level**: the set of tables that service file
writes anywhere, measured by scanning `.from('…')` followed by
`.insert|.upsert|.update|.delete`. It is not a per-endpoint trace. Per-endpoint
table attribution is Phase 2 work and is called out where it matters.

### 0.3 Class vocabulary

| Class   | Meaning                                                                                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L**   | Runs entirely on the device. No server needed for the operation itself.                                                                                                                                   |
| **L\*** | Becomes local **after a named rule is extracted** from the backend into `packages/validation` (or another shared, dependency-free module) and re-implemented on the device. The rule is named in the row. |
| **C**   | Needs a server by nature: invitations, other members, multi-device, cloud backup, public storefront, webhooks, AI provider, email/SMS, OAuth, billing.                                                    |
| **X**   | Not in the Offline Edition. The reason is stated per row.                                                                                                                                                 |

### 0.4 How to re-run the measurement

The mapping in §Appendix A was generated, not transcribed. The generators live
outside the repository (they are throwaway analysis scripts, and Phase 1 may not
add code). To reproduce:

1. Parse `packages/ui/src/screens.ts` for `export { X } from './path'`.
2. Parse `app.tsx` for `lazy(() => import('@/…'))` to map route → app-shell page.
3. Walk each page's local imports four levels deep, collecting every named
   import from `@hisabche/api`, every `apiClient.get|post|put|patch|delete`
   literal, every `fetch(\`${BASE_URL}…\`)`, and every `bridge().x` call.
4. Resolve each `@hisabche/api` name through `packages/api/src/hooks/index.ts`
   to its hook file, then slice that file by top-level `export function` /
   `export const` boundaries and read the `apiClient` calls inside each slice.

Step 4 is why the table can say `useInvoices → GET /invoices` rather than
`invoices.ts → 7 endpoints`.

### 0.5 Gate 1 checklist

| Gate 1 requirement                                                         | Status                                                                                                                                               |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Matrix covers 100% of routes (`grep -c "path:"` = rows)                    | **Met** — 71 `path:` + 1 index = 72 rows in §3                                                                                                       |
| Every hook mounted is listed with its endpoint                             | **Met** — 443 hook rows, §Appendix A                                                                                                                 |
| Every endpoint those hooks call is listed                                  | **Met** — 308 distinct page strings, §Appendix A                                                                                                     |
| Every place the shell needs the network **to start**                       | **Met** — §6                                                                                                                                         |
| Windows and Android start-up network calls, device-DB tables, IPC messages | **Met** — §7                                                                                                                                         |
| Owner reviews and approves the L/C split                                   | **APPROVED 19 Oct 2026** with three amendments — §5.1; the owner also answered the three open questions — §5.2                                       |
| No code changed                                                            | **Met** — from this phase `git status` adds only `docs/offline/` and the `.claude/` phase record (§8), plus 32 pre-existing unrelated entries (§8.1) |

---

## 1. What the product is today, in one page

Hisabche on Windows and Android is **an online application with an offline
fallback**, not an offline application. Precisely:

- The UI is the same shared bundle on web, Windows and Android
  (`packages/ui` → `packages/app-shell` → Electron renderer / Expo WebView).
- There is a device database (`packages/app-bridge/src/local-schema.ts`,
  `SCHEMA_VERSION = 2`) with ten tables, reached over IPC on Windows and over a
  WebView bridge on Android.
- **Only one write can be queued while offline: creating an invoice.**
  `packages/api/src/lib/offline-queue.ts` declares `entity: 'invoice'`,
  `operation: 'create'` as the _entire_ offline write surface, and
  `submitInvoice()` in `packages/api/src/hooks/invoices.ts` is the only caller.
- The device database is filled by a **pull** (`/sync/snapshot` +
  `/sync/pull`) that covers exactly three entities: `customer`, `product`,
  `invoice` (`sync-engine.ts`, `DELTA_ENTITIES`).
- Every other screen — products, customers, payments, accounting, till,
  manufacturing, payroll, reports — is a thin client over REST. With no network
  those screens render whatever React Query happens to have in memory or in
  `localStorage`, which is a **cache**, not a database: it has no rows for a
  screen never opened this session, no integrity, and no query surface.

That is the central gap this programme closes. §4 states, capability by
capability, what has to move.

### 1.1 The three device facts that decide most of §4

1. **The device database is a cache, not a ledger.** It stores money as `REAL`
   (`local-schema.ts`: `subtotal REAL`, `total REAL`, `buy_price REAL`).
   The product's money rule is integer minor units (`AGENTS.md` §1.3). A local
   write that computes a total in `REAL` and later posts it to a ledger that
   stores integers is a rounding bug waiting for its first customer.
2. **No local rule engine exists.** Every derived number — line total, invoice
   total, tax, discount, stock movement, cost layer, journal line — is computed
   on the server. The device stores the server's answer verbatim
   (`FROM_LOG` in `sync-engine.ts` copies `subtotal`, `tax_total`, `total`,
   `paid_amount` as received).
3. **Only `invoice`/`customer`/`product` are pulled.** A local invoice screen
   that needs a payment, a cost layer, a warehouse quantity or a currency rate
   has nothing to read.

---

## 2. Backend surface reached from the desktop/mobile shell

89 route files, 711 handlers. The shell touches a subset; the ones that matter
for offline are these, with the Postgres function each write goes through.

| Area                 | Route file                                                              | Service                                                     | Postgres function                                                                                                    |
| -------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Invoices             | `backend/src/routes/invoice.routes.ts`                                  | `services/invoice.service.ts`                               | `invoice_write_document`, `get_next_invoice_number`                                                                  |
| Invoice PDF          | `backend/src/routes/invoice-pdf.routes.ts`                              | inline (`@react-pdf/renderer` + Supabase Storage)           | —                                                                                                                    |
| Payments             | `backend/src/routes/payments.routes.ts`                                 | `services/payments/*`                                       | `payments_record`, `payments_record_keyed`, `payments_record_with_fee`, `payments_record_at_till`, `payments_cancel` |
| Accounting           | `backend/src/routes/accounting.routes.ts`                               | `services/accounting/*`                                     | `accounting_post_journal_entry`, `accounting_trial_balance`                                                          |
| Costing              | `backend/src/routes/inventory-costing.routes.ts`                        | `services/inventory-costing/*`                              | `inventory_consume_layers`, `inventory_receive_layer`, `inventory_release_consumption`, `inventory_valuation`        |
| Products             | `backend/src/routes/product.routes.ts`                                  | `services/product.service.ts`                               | —                                                                                                                    |
| Warehouses           | `backend/src/routes/warehouse.routes.ts`                                | `services/warehouse.service.ts`                             | `warehouse_transfer_stock`, `warehouse_transfer_stock_keyed`                                                         |
| Warehouse map        | `backend/src/routes/warehouse-map.routes.ts`                            | `services/inventory/warehouse-map.service.ts`               | `storage_place_stock`, `storage_auto_shelve_invoice`                                                                 |
| Customers            | `backend/src/routes/customer.routes.ts`                                 | `services/customer.service.ts`                              | `customer_invoice_roles`                                                                                             |
| Cycle count          | `backend/src/routes/cycle-count.routes.ts`                              | `services/inventory/cycle-count.service.ts`                 | — (direct `stock_movements` insert)                                                                                  |
| Till / POS           | `backend/src/routes/pos.routes.ts`                                      | `services/pos/pos.service.ts`                               | `pos_record_order`                                                                                                   |
| Manufacturing        | `backend/src/routes/manufacturing.routes.ts`                            | `services/manufacturing.service.ts`                         | `manufacturing_save_bom`, `manufacturing_complete`, `manufacturing_report`                                           |
| Sync                 | `backend/src/routes/sync.routes.ts`                                     | `services/sync.service.ts`                                  | — (`sync_mutations` table)                                                                                           |
| Sync stream          | `backend/src/routes/sync-stream.routes.ts`                              | `services/sync-stream`                                      | — (WebSocket)                                                                                                        |
| Installments         | `backend/src/routes/installments.routes.ts`                             | `services/commerce/installment.service.ts`                  | `installments_save`                                                                                                  |
| Payroll / attendance | `backend/src/routes/attendance*.routes.ts`, `human-resources.routes.ts` | `services/payroll/*`, `services/human-resources.service.ts` | `attendance_*`                                                                                                       |

Rule files that Phase 2 must extract, with the symbol and its location:

| Rule                                                                                                                  | File:line                                                                                                                                                                                               | What it decides                                                  |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `computeItemTotal`, `computeInvoiceMoney`                                                                             | `packages/validation/src/schemas/invoice.schema.ts:157`                                                                                                                                                 | **Already shared.** Line total, subtotal, discount, tax, total.  |
| `stockEditWarehouse`                                                                                                  | `backend/src/services/inventory/warehouse-summary.domain.ts:219`                                                                                                                                        | Which warehouse a product-page stock edit lands in.              |
| `checkAssign`                                                                                                         | `backend/src/services/inventory/warehouse-summary.domain.ts:191`                                                                                                                                        | Refuses assigning more unassigned stock than exists.             |
| `warehouseOverview`, `warehouseProducts`                                                                              | `backend/src/services/inventory/warehouse-summary.domain.ts:106,142`                                                                                                                                    | Per-warehouse stat cards.                                        |
| `planConsumption`, `fifoOrder`, `mayIssue`, `onHand`, `stockValue`, `averageUnitCost`, `grossProfit`, `lastKnownCost` | `backend/src/services/inventory-costing/costing.domain.ts:111,70,178,77,82,92,196,165`                                                                                                                  | FIFO/AVCO consumption, whether a sale may issue, cost of goods.  |
| `settlesInCurrency`                                                                                                   | `backend/src/services/payments/payments.domain.ts:61`                                                                                                                                                   | A payment may only settle an invoice in the same currency.       |
| `partyBalancesByCurrency`, `summarizePartyByCurrency`                                                                 | `backend/src/services/payments/payments.domain.ts:305,508`                                                                                                                                              | Customer/supplier balance **per currency**; never summed across. |
| `paymentPosting`                                                                                                      | `backend/src/services/payments/payments.domain.ts:690`                                                                                                                                                  | Allocation, FX gain/loss, what the journal entry looks like.     |
| `buildProfitReport`                                                                                                   | `backend/src/services/accounting/profit-report.domain.ts:185`                                                                                                                                           | Profit, margin, `costStatus` (unknown ≠ zero).                   |
| `baseCurrencyOf`, `describeBaseCurrency`, `setBaseCurrency`                                                           | `backend/src/services/base-currency.ts`                                                                                                                                                                 | The books currency; changeable only while the books are empty.   |
| invoice create pipeline                                                                                               | `backend/src/services/invoice.service.ts:793` (`create`), `1719` (`reverseEffects`), `2727` (`applyTax`), `2815` (`applyCosting`), `2925` (`createAccountingEntries`), `3343` (`generateInvoiceNumber`) | Numbering, stock, costing, ledger, reversal.                     |

---

## 3. Route inventory — all 72 entries as audited

Legend: **S** = rendered screen · **R** = redirect · **L** = layout (authenticated shell).

> **Changed in Phase 2 (19 Oct 2026):** the duplicate `inventory` redirect
> (rows 41 and 69 here / BUG-129) was removed — one line, the first declaration
> stays. `app.tsx` now declares **70** `path:` keys + 1 index = **71** route
> entries, and `route-parity.test.ts` now fails if any path is declared twice.
> The inventory below is the state as audited, which is why both rows appear.

| #   | path                                 | Kind                                            | Page module                                                                     | Class                                                                                                                          |
| --- | ------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `/login`                             | S                                               | `features/auth/login-page.tsx`                                                  | **C** (auth is a server fact)                                                                                                  |
| 2   | `/` (index)                          | S                                               | `features/dashboard/dashboard-page.tsx` → `DashboardContainer`                  | **L\*** (see §4.1)                                                                                                             |
| 3   | `dashboard`                          | R → `/`                                         | `<Navigate>`                                                                    | —                                                                                                                              |
| 4   | `/` (layout)                         | L                                               | `RequireAuth` + `AppShell`                                                      | **C** at start (§6)                                                                                                            |
| 5   | `invoices`                           | S                                               | `features/sales/invoices-page.tsx` → `SalesHubContainer`                        | **L\***                                                                                                                        |
| 6   | `invoices/new`                       | S                                               | `features/sales/invoice-builder-page.tsx` → `InvoiceBuilderContainer`           | **L\***                                                                                                                        |
| 7   | `invoices/new/preview`               | S                                               | `features/sales/invoice-preview-page.tsx` → `InvoicePreviewContainer`           | **L\***                                                                                                                        |
| 8   | `invoices/:id`                       | S                                               | `features/sales/invoice-detail-page.tsx` → `InvoiceDetailContainer`             | **L\***                                                                                                                        |
| 9   | `warehouse`                          | S                                               | `features/inventory/products-page.tsx` → `WarehouseTabsContainer`               | **L\***                                                                                                                        |
| 10  | `warehouse/:id`                      | S                                               | `features/inventory/product-detail-page.tsx` → `ProductDetailContainer`         | **L\***                                                                                                                        |
| 11  | `customers`                          | S                                               | `features/crm/customers-page.tsx` → `CustomersHubContainer`                     | **L**                                                                                                                          |
| 12  | `customers/:id`                      | S                                               | `features/crm/customer-detail-page.tsx` → `CustomerDetailContainer`             | **L\***                                                                                                                        |
| 13  | `accounting`                         | S                                               | `features/accounting/accounting-page.tsx` → `AccountingPage`                    | **L\***                                                                                                                        |
| 14  | `activities`                         | S                                               | `features/activity/activities-page.tsx` → `ActivitiesPage`                      | **L\*** (the feed row is written by the server today; the local engine must write it through `ActivityService.createActivity`) |
| 15  | `sync-center`                        | S                                               | `features/sync/sync-page.tsx` (shell-owned)                                     | **L**                                                                                                                          |
| 16  | `settings`                           | S                                               | `features/settings/settings-page.tsx` + `SettingsHubContainer`                  | **L\***                                                                                                                        |
| 17  | `approvals`                          | S                                               | `features/approvals/approvals-page.tsx` → `ApprovalsHubContainer`               | **C** (another person must act)                                                                                                |
| 18  | `developers`                         | S                                               | `features/developers/developers-page.tsx` → `DevelopersContainer`               | **C**                                                                                                                          |
| 19  | `marketplace`                        | S                                               | `features/marketplace/marketplace-page.tsx` → `MarketplaceContainer`            | **C**                                                                                                                          |
| 20  | `billing`                            | S                                               | `features/billing/billing-page.tsx` → `BillingHubContainer`                     | **C**                                                                                                                          |
| 21  | `market-seller`                      | S                                               | `features/market/market-seller-page.tsx` → `MarketSellerContainer`              | **C**                                                                                                                          |
| 22  | `analysis`                           | S                                               | `features/analysis/analysis-page.tsx` → `AnalysisContainer`                     | **L\***                                                                                                                        |
| 23  | `onboarding`                         | S                                               | `features/onboarding/onboarding-page.tsx` → `OnboardingContainer`               | **L**                                                                                                                          |
| 24  | `manufacturing`                      | S                                               | `features/manufacturing/manufacturing-page.tsx` → `ManufacturingContainer`      | **C** (v1 — owner's Gate-1 amendment; revisit after Gate 7)                                                                    |
| 25  | `assistant`                          | S                                               | `features/ai/assistant-page.tsx` → `AiAssistantContainer`                       | **C**                                                                                                                          |
| 26  | `operations`                         | S                                               | `features/inventory-ops/operations-page.tsx` → `InventoryOpsContainer`          | **L\***                                                                                                                        |
| 27  | `stock-count`                        | S                                               | `features/cycle-count/stock-count-page.tsx` → `CycleCountContainer`             | **L\***                                                                                                                        |
| 28  | `team-and-payroll`                   | S                                               | `features/team-and-payroll/tap-page.tsx` → `TeamAndPayrollContainer`            | **L\***                                                                                                                        |
| 29  | `team-and-payroll/:id`               | S                                               | `features/human-resources/employee-detail-page.tsx` → `EmployeeDetailContainer` | **L\***                                                                                                                        |
| 30  | `audit`                              | S                                               | `features/audit/audit-page.tsx` → `AuditContainer`                              | **L\***                                                                                                                        |
| 31  | `till`                               | S                                               | `features/finance/till-page.tsx` → `TillContainer`                              | **L\***                                                                                                                        |
| 32  | `data-and-sync`                      | S                                               | `features/sync/data-and-sync-page.tsx` → `DataHubContainer`                     | **L**                                                                                                                          |
| 33  | `governance`                         | S                                               | `features/permissions/governance-page.tsx` → `GovernanceHubContainer`           | **C**                                                                                                                          |
| 34  | `public-task/:token`                 | S                                               | `features/public/public-task-page.tsx` → `PublicTaskContainer`                  | **X**                                                                                                                          |
| 35  | `public-invoice/:token`              | S                                               | `features/public/public-invoice-page.tsx` → `PublicInvoiceContainer`            | **X**                                                                                                                          |
| 36  | `portal/:token`                      | S                                               | `features/public/public-portal-page.tsx` → `PublicPortalContainer`              | **X**                                                                                                                          |
| 37  | `my-attendance/:token`               | S                                               | `features/public/attendance-self-page.tsx` → `AttendanceSelfContainer`          | **X**                                                                                                                          |
| 38  | `sales`                              | R → `/invoices`                                 | `<Navigate>`                                                                    | —                                                                                                                              |
| 39  | `sales/new`                          | R → `/invoices/new`                             | `<Navigate>`                                                                    | —                                                                                                                              |
| 40  | `sales/:id`                          | R → `/invoices/:id`                             | `LegacyInvoiceRedirect`                                                         | —                                                                                                                              |
| 41  | `inventory`                          | R → `/warehouse`                                | `<Navigate>`                                                                    | —                                                                                                                              |
| 42  | `sync`                               | R → `/sync-center`                              | `<Navigate>`                                                                    | —                                                                                                                              |
| 43  | `human-resources/:id`                | R → `/team-and-payroll/:id`                     | `LegacyEmployeeRedirect`                                                        | —                                                                                                                              |
| 44  | `quick-invoice`                      | R → `/invoices/new`                             | `<Navigate>`                                                                    | —                                                                                                                              |
| 45  | `orders`                             | R → `/settings`                                 | `<Navigate>`                                                                    | —                                                                                                                              |
| 46  | `crm`                                | R → `/customers?tab=outreach`                   | `<Navigate>`                                                                    | —                                                                                                                              |
| 47  | `sales-followup`                     | R → `/customers?tab=outreach`                   | `<Navigate>`                                                                    | —                                                                                                                              |
| 48  | `tasks`                              | R → `/customers?tab=outreach`                   | `<Navigate>`                                                                    | —                                                                                                                              |
| 49  | `campaigns`                          | R → `/customers?tab=outreach&view=campaigns`    | `<Navigate>`                                                                    | —                                                                                                                              |
| 50  | `customer-list`                      | R → `/customers`                                | `<Navigate>`                                                                    | —                                                                                                                              |
| 51  | `product-list`                       | R → `/warehouse?tab=products`                   | `<Navigate>`                                                                    | —                                                                                                                              |
| 52  | `expiry`                             | R → `/warehouse?tab=expiry`                     | `<Navigate>`                                                                    | —                                                                                                                              |
| 53  | `human-resources`                    | R → `/team-and-payroll`                         | `<Navigate>`                                                                    | —                                                                                                                              |
| 54  | `timesheets`                         | R → `/team-and-payroll?tab=pay&view=timesheets` | `<Navigate>`                                                                    | —                                                                                                                              |
| 55  | `permissions`                        | R → `/governance?tab=permissions`               | `<Navigate>`                                                                    | —                                                                                                                              |
| 56  | `purchasing`                         | R → `/invoices?type=purchase`                   | `<Navigate>`                                                                    | —                                                                                                                              |
| 57  | `promotions`                         | R → `/invoices?tab=pricing`                     | `<Navigate>`                                                                    | —                                                                                                                              |
| 58  | `bank`                               | R → `/accounting?tab=treasury`                  | `<Navigate>`                                                                    | —                                                                                                                              |
| 59  | `assets`                             | R → `/accounting?tab=treasury&view=assets`      | `<Navigate>`                                                                    | —                                                                                                                              |
| 60  | `budgets`                            | R → `/accounting?tab=reports&view=budgets`      | `<Navigate>`                                                                    | —                                                                                                                              |
| 61  | `workflow-templates`                 | R → `/approvals?tab=workflows`                  | `<Navigate>`                                                                    | —                                                                                                                              |
| 62  | `conflicts`                          | R → `/data-and-sync?tab=details&view=conflicts` | `<Navigate>`                                                                    | —                                                                                                                              |
| 63  | `data-migration`                     | R → `/data-and-sync?tab=details&view=migration` | `<Navigate>`                                                                    | —                                                                                                                              |
| 64  | `wallet`                             | R → `/billing?tab=money`                        | `<Navigate>`                                                                    | —                                                                                                                              |
| 65  | `referrals`                          | R → `/billing?tab=money&view=referrals`         | `<Navigate>`                                                                    | —                                                                                                                              |
| 66  | `accounting-workspace`               | R → `/accounting`                               | `<Navigate>`                                                                    | —                                                                                                                              |
| 67  | `sales-workspace`                    | R → `/invoices`                                 | `<Navigate>`                                                                    | —                                                                                                                              |
| 68  | `inventory-workspace`                | R → `/warehouse`                                | `<Navigate>`                                                                    | —                                                                                                                              |
| 69  | `inventory` (second entry, same key) | R → `/warehouse`                                | `<Navigate>`                                                                    | —                                                                                                                              |
| 70  | `people-workspace`                   | R → `/team-and-payroll`                         | `<Navigate>`                                                                    | —                                                                                                                              |
| 71  | `workflow`                           | R → `/approvals?tab=workflows`                  | `<Navigate>`                                                                    | —                                                                                                                              |
| 72  | `*`                                  | R → `/`                                         | `<Navigate>`                                                                    | —                                                                                                                              |

> **Finding F1-01 — duplicate route key.** `inventory` is declared twice
> (`app.tsx:148` and `app.tsx:193`) in the same `children` array. React Router
> takes the first match, so today it is harmless, but it is dead code and the
> route-parity guard does not catch it. Phase 2 should delete one; **Phase 1
> does not touch it** because Phase 1 changes no code.

---

## 4. Capability matrix

Read each area as: a **wiring table** (where the data comes from) followed by a
**detail table** (what has to change). Rows are capabilities, not routes.

Class column repeats §0.3. "L\*" rows always name the rule that must be
extracted before the capability can run on the device.

### 4.1 Dashboard

| Capability           | Route | Hook                                                                           | Method + path                                                    | Service                                      | Writes                                | Rules                                                                    | Class   |
| -------------------- | ----- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------ | ------- |
| KPI tiles            | `/`   | `useDashboardKPIs`                                                             | `GET /analytics/dashboard`                                       | `services/analytics.service.ts`              | —                                     | `analytics/dashboard-visibility.domain.ts`                               | **L\*** |
| Sales chart          | `/`   | `useDashboardSales`                                                            | `GET /analytics/sales`                                           | `services/analytics.service.ts`              | —                                     | —                                                                        | **L\*** |
| Recent activity      | `/`   | `useActivities`                                                                | `GET /v1/activities`                                             | `services/activity.service.ts`               | `activities`                          | `ActivityService.createActivity` (to extract from `activity.service.ts`) | **L\*** |
| Work queue           | `/`   | `useConflicts`, `useWorkflowInstances`                                         | `GET /conflicts`, `GET /v1/workflows/instances`                  | `services/conflict/*`, `services/workflow/*` | `sync_conflicts`                      | `workflow/approval.domain.ts`                                            | **L\*** |
| AI insight card      | `/`   | `useAIInsights`, `useAiAvailability`, `useAskAi`                               | `GET /ai/insights`, `GET /ai/quota`, `POST /ai/ask`              | `services/ai/*`                              | `ai_query_log`                        | —                                                                        | **C**   |
| Manufacturing card   | `/`   | `useManufacturingReport`                                                       | `GET /manufacturing/report`                                      | `services/manufacturing.service.ts`          | —                                     | `manufacturing_report` (PG)                                              | **C**   |
| Currency rate dialog | `/`   | `useCustomUnits`, `useExchangeRates`, `useSetCustomUnit`, `useSetExchangeRate` | `GET/PUT /finance/currency/units`, `GET /finance/currency/rates` | `services/currency/*`                        | `custom_unit_rates`, `exchange_rates` | `currency/revaluation.domain.ts`                                         | **L\*** |

| Capability           | Current implementation                                                                            | Actual files                                                                                   | Current dependency                     | Why server is required                                                     | Can become local                                                                                                                                              | Required refactor                                                                                                       | Risk                                                                                                                                                                       | Test required                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| KPI tiles            | Server aggregates the whole workspace per date range; the device renders the numbers it receives. | `packages/ui/src/hooks/dashboard/use-dashboard-data.ts`, `packages/api/src/hooks/analytics.ts` | Live REST + `useRealtime` invalidation | It reads invoices, payments, purchases and stock the device does not hold. | **after extracting** an aggregation rule over the local invoice/payment tables                                                                                | Move the aggregation out of SQL into a pure function that takes rows; feed it the device's rows.                        | **High** — a KPI computed over a partial device dataset is a _wrong number_, not an empty one. Must render «cannot be calculated» unless the device holds the full period. | Two currencies; a period whose invoices are only partly on the device must show unknown, not a smaller total.                      |
| Sales chart          | Same                                                                                              | same                                                                                           | same                                   | same                                                                       | **after extracting** the same aggregation                                                                                                                     | same                                                                                                                    | same                                                                                                                                                                       | same                                                                                                                               |
| Recent activity      | `GET /v1/activities` paged list; `useRealtime` on `notifications`.                                | `packages/api/src/hooks/activity.ts`                                                           | REST + Realtime                        | Activity is generated by every member, on every device.                    | **after extracting** `ActivityService.createActivity` — the row shape, the actor name fallback and the importance default are a rule, not a server capability | Device needs an `activity` table and, on each local write, one append through the extracted rule.                       | Medium — activity written locally and then replayed must not duplicate.                                                                                                    | Local write → one activity row, not two after sync; two currencies in the metadata.                                                |
| Work queue           | Reads `sync_conflicts` and open workflow instances.                                               | `packages/ui/src/components/ui/work-queue/containers/work-queue-container.tsx`                 | REST                                   | Conflicts are by definition a _multi-device_ fact.                         | **after extracting** the conflict-resolution rule                                                                                                             | Conflicts can be _created_ locally; resolving them needs the other side.                                                | Low                                                                                                                                                                        | A conflict created offline appears once, after sync.                                                                               |
| AI insight card      | Provider call on the server.                                                                      | `packages/api/src/hooks/ai-chat.ts`                                                            | REST + AI provider                     | Needs an API key and a provider.                                           | **no**                                                                                                                                                        | —                                                                                                                       | —                                                                                                                                                                          | —                                                                                                                                  |
| Manufacturing card   | `manufacturing_report` PG function.                                                               | `packages/api/src/hooks/manufacturing.ts`                                                      | REST                                   | Report is aggregated over all runs.                                        | **no — C in v1** (owner's Gate-1 amendment)                                                                                                                   | The manufacturing rule set is not extracted in v1; the card renders the notice «برای این عملیات به اینترنت نیاز دارید». | Medium                                                                                                                                                                     | Nothing offline; the notice appears instead of a number. Two currencies in the fixture that proves it never shows a partial total. |
| Currency rate dialog | `exchange_rates` table, per `rate_date`.                                                          | `packages/api/src/hooks/currency-rates.ts`                                                     | REST                                   | Rates are a shared workspace fact.                                         | **yes** — device can hold today's rates and write new ones into the queue                                                                                     | Add `exchange_rate` to the device schema.                                                                               | **High** — a missing rate must stay `null`; `rateOn` already returns null and the UI says so. Preserve that.                                                               | A pair with no rate shows «no rate», never `1`.                                                                                    |

**L/C decision for §4.1:** dashboard is **L\***, the AI card is **C**, and — per the
owner's Gate-1 amendment of 19 Oct 2026 — the manufacturing card is **C** too
(manufacturing is server-only in v1). The owner accepts that an offline dashboard
may say «cannot be calculated» rather than show a number computed from partial
data.

### 4.2 Invoices

| Capability                        | Route                                  | Hook                                                                      | Method + path                                                       | Service                                        | Writes                                                                                                                                   | Rules                                                                                                                                                | Class   |
| --------------------------------- | -------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Invoice list                      | `invoices`                             | `useInvoices`                                                             | `GET /invoices`                                                     | `services/invoice.service.ts`                  | —                                                                                                                                        | `invoices/invoice-list-summary.domain.ts`                                                                                                            | **L\*** |
| Invoice detail                    | `invoices/:id`                         | `useInvoice`                                                              | `GET /invoices/:id`                                                 | `services/invoice.service.ts`                  | —                                                                                                                                        | —                                                                                                                                                    | **L\*** |
| Related documents                 | `invoices/:id`                         | `useInvoiceRelated`                                                       | `GET /invoices/:id/related`                                         | `services/invoices/invoice-related.service.ts` | —                                                                                                                                        | —                                                                                                                                                    | **L\*** |
| Create invoice (draft → finalize) | `invoices/new`, `invoices/new/preview` | `useCreateInvoice` (`submitInvoice`)                                      | `POST /invoices`                                                    | `services/invoice.service.ts` `create`         | `invoices`, `invoice_items`, `invoice_item_details`, `invoice_tax_lines`, `stock_movements`, `stock_serials`, `products`, `time_entries` | `computeInvoiceMoney` (shared), `invoice_write_document` (PG), `get_next_invoice_number` (PG), `applyTax`, `applyCosting`, `createAccountingEntries` | **L\*** |
| Edit invoice                      | `invoices/:id`                         | `useUpdateInvoice`                                                        | `PATCH /invoices/:id`                                               | `services/invoice.service.ts`                  | same                                                                                                                                     | `reverseEffects` + `invoice_write_document`                                                                                                          | **L\*** |
| Delete invoice                    | `invoices`                             | `useDeleteInvoice`                                                        | `DELETE /invoices/:id`                                              | `services/invoice.service.ts`                  | same                                                                                                                                     | `reverseEffects`, `invoices/stock-reversal.domain.ts`                                                                                                | **L\*** |
| Number the invoice                | —                                      | (server, inside `create`)                                                 | —                                                                   | `invoice.service.ts:3343`                      | —                                                                                                                                        | `get_next_invoice_number` (PG `nextval`)                                                                                                             | **L\*** |
| Print / PDF                       | `invoices/:id`                         | direct `apiClient.get('/invoices/:id/pdf')`                               | `GET /invoices/:id/pdf`                                             | `routes/invoice-pdf.routes.ts`                 | —                                                                                                                                        | `@react-pdf/renderer`                                                                                                                                | **L\*** |
| Record payment                    | `invoices/:id`, `customers/:id`        | `useRecordPayment`                                                        | `POST /payments`                                                    | `services/payments/payments.service.ts`        | `payments`                                                                                                                               | `settlesInCurrency`, `paymentPosting`, `payments_record*` (PG)                                                                                       | **L\*** |
| Cancel payment                    | `invoices/:id`                         | `useCancelPayment`                                                        | `POST /payments/:id/cancel`                                         | same                                           | `payments`                                                                                                                               | `payments_cancel` (PG)                                                                                                                               | **L\*** |
| Installment plan                  | `invoices/:id`                         | `useInstallmentPlan`, `useSaveInstallmentPlan`, `useClearInstallmentPlan` | `GET/PUT/DELETE /invoices/:id/installments`                         | `services/commerce/installment.service.ts`     | —                                                                                                                                        | `installments_save` (PG), `commerce/installment.domain.ts`                                                                                           | **L\*** |
| Late fee                          | `invoices/:id`                         | `useLateFeePreview`, `useAssessLateFee`, `useSaveLateFeePolicy`           | `GET/POST /invoices/:id/late-fees`, `PUT /late-fees/policy`         | `services/commerce/late-fee.service.ts`        | `late_fee_assessments`, `late_fee_policies`                                                                                              | —                                                                                                                                                    | **L\*** |
| Post to ledger                    | `invoices/:id`                         | `usePostInvoiceToLedger`, `usePostUnpostedInvoices`                       | `POST /invoices/:id/post-to-ledger`, `POST /invoices/post-unposted` | `services/accounting/*`                        | `journal_entries`, `journal_lines`                                                                                                       | `accounting_post_journal_entry` (PG), `invoice-posting.domain.ts`                                                                                    | **L\*** |
| Recurring invoice                 | `invoices/new/preview`                 | `useCreateRecurringInvoice`                                               | `POST /automations/recurring-invoice`                               | `services/automation/*`                        | `automations`                                                                                                                            | `automation/schedule.domain.ts`                                                                                                                      | **C**   |
| Approval on an invoice            | `invoices/:id`                         | `usePerformWorkflowAction`                                                | `POST /v1/workflows/instances/:id/action`                           | `services/workflow/*`                          | —                                                                                                                                        | `workflow/approval-gate.domain.ts`                                                                                                                   | **C**   |

| Capability         | Current implementation                                                                                                                                                                                                                                      | Actual files                                                                                                                                 | Current dependency                          | Why server is required                                                           | Can become local                                                                                                                                                                                                        | Required refactor                                                                                                                                                                                                                                                                                                   | Risk                                                                                                                                                                                                                                                                                                    | Test required                                                                                                                                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invoice list       | Server pages and filters; `useInvoices` reads `GET /invoices`. Offline it falls back to `getOfflineQueue().readRows('invoice', …)`, which returns **device rows only for the three pulled entities**.                                                       | `packages/api/src/hooks/invoices.ts:95`, `packages/ui/src/components/ui/invoices/**`, `packages/api/src/lib/offline-queue.ts`                | REST; device cache for the offline fallback | Server owns the list's totals, filters and pagination.                           | **after extracting** `invoice-list-summary.domain.ts`                                                                                                                                                                   | Local query over a real `invoice` table with the same filter semantics; the summary must be computed, not stored.                                                                                                                                                                                                   | **Medium** — an offline list that silently drops the unpulled tail reads as «you have fewer invoices than you do».                                                                                                                                                                                      | Device holds 3 invoices of 5 → the list shows 3 **and says** it is showing a partial set. Two currencies.                                                                                                                                                            |
| Invoice detail     | `GET /invoices/:id`.                                                                                                                                                                                                                                        | `packages/ui/src/components/ui/invoice-detail/**`                                                                                            | REST                                        | Detail includes lines, payments, ledger evidence, workflow state.                | **after extracting** the detail assembly                                                                                                                                                                                | Needs `invoice_item` (already local), `payment_allocations`, `cost_consumptions` locally.                                                                                                                                                                                                                           | **High** — a detail page missing its payments shows an invoice as unpaid.                                                                                                                                                                                                                               | Open an invoice with a payment, offline: `paid_amount` and the payment list must agree.                                                                                                                                                                              |
| **Create invoice** | `submitInvoice()` queues **only** `entity:'invoice'`, `operation:'create'`, and only when `idempotencyKey` exists and `isOffline()` is true. The payload is the raw client input. The server does numbering, stock, costing and ledger **when it arrives**. | `packages/api/src/hooks/invoices.ts:175`, `packages/api/src/lib/offline-queue.ts`, `packages/app-shell/src/features/sync/sync-engine.ts:450` | REST + device queue                         | The server derives every number and moves stock.                                 | **after extracting** all of: `computeInvoiceMoney` (already shared), `applyTax`, `applyCosting`/`planConsumption`, `generateInvoiceNumber`, `createAccountingEntries`, plus a local `invoice_write_document` equivalent | 1. Money must move to integer minor units on the device (schema is `REAL`). 2. Numbering must become a device-reserved range, not `nextval`. 3. Stock and cost must be applied at queue time, not at push time, or two offline sales oversell. 4. The ledger entry must be derived locally and posted idempotently. | **Critical.** Today an offline invoice is a _pending request_, not a posted document: its stock is not moved, its cost is not consumed, its number does not exist. If the business sells the same unit twice offline, the second sale is refused hours later at push time, after the customer has left. | (a) Two offline sales of the last unit: the second must be refused **on the device**. (b) An offline invoice's total equals the online total for the same input, to the minor unit. (c) Two currencies. (d) Same `Idempotency-Key` pushed twice creates one invoice. |
| Edit invoice       | `PATCH /invoices/:id`; the server reverses the old effects and re-applies.                                                                                                                                                                                  | `packages/api/src/hooks/invoices.ts:253`                                                                                                     | REST                                        | `reverseEffects` + `invoice_write_document` in one transaction.                  | **after extracting** `reverseEffects`                                                                                                                                                                                   | Local reversal is a compensating set of rows, not a `DELETE`. Requires local `stock_movements` and `cost_consumptions`.                                                                                                                                                                                             | **Critical** — an edit that reverses stock locally but not on the server (or vice versa) makes two truths.                                                                                                                                                                                              | Edit a sale from 10 units to 4, offline: stock +6, cost released proportionally, ledger reversed. Balances asserted, not row counts.                                                                                                                                 |
| Delete invoice     | `DELETE /invoices/:id`, soft or hard per server rule.                                                                                                                                                                                                       | `packages/api/src/hooks/invoices.ts:292`                                                                                                     | REST                                        | Must reverse stock, cost and ledger atomically.                                  | **after extracting** `reverseEffects` + `invoices/stock-reversal.domain.ts`                                                                                                                                             | Same as edit, plus a tombstone the pull can carry.                                                                                                                                                                                                                                                                  | **Critical**                                                                                                                                                                                                                                                                                            | Delete offline → balances return to the pre-invoice state, and the deletion survives a sync.                                                                                                                                                                         |
| Number the invoice | `supabase.rpc('get_next_invoice_number')`, falling back to a timestamp+random string when the RPC fails (`invoice.service.ts:3345-3351`).                                                                                                                   | `backend/src/services/invoice.service.ts:3343`, `docs/missing-rpcs-migration.sql:37`                                                         | PG sequence                                 | A sequence is a server-global monotonic counter.                                 | **after extracting** a numbering rule                                                                                                                                                                                   | Device must reserve a block (e.g. `OFF-<device>-<n>`) at sync time and never collide; the fallback random number must not be used offline.                                                                                                                                                                          | **High** — two devices numbering offline both produce `INV-000123`.                                                                                                                                                                                                                                     | Two devices each create 3 offline invoices → 6 distinct numbers; no duplicate after push.                                                                                                                                                                            |
| Print / PDF        | Server renders a React-PDF document and caches it in Supabase Storage; the renderer downloads a blob.                                                                                                                                                       | `packages/ui/src/components/ui/invoice-detail/InvoicePDFDownload.tsx`, `backend/src/routes/invoice-pdf.routes.ts`                            | REST + Supabase Storage                     | Rendering uses server fonts and a storage cache.                                 | **yes** — the desktop already has `print.html` over IPC and Android has a WebView print path                                                                                                                            | Render the same `InvoiceDocument` to HTML on the device and call `bridge().print.html`. PDF _file_ export is the only part that needs work.                                                                                                                                                                         | Medium — two renderers (PDF server-side, HTML device-side) can drift visually.                                                                                                                                                                                                                          | Print the same invoice online and offline; the printed totals must be identical.                                                                                                                                                                                     |
| Record payment     | `POST /payments` → `payments_record*` PG function; `settlesInCurrency` refuses a cross-currency settlement; `paymentPosting` books FX gain/loss.                                                                                                            | `packages/api/src/hooks/payments.ts`, `backend/src/services/payments/*`                                                                      | REST + PG function                          | Multi-table atomic write (payment + allocations + invoice outstanding + ledger). | **after extracting** `settlesInCurrency`, `paymentPosting`, `partyBalancesByCurrency`                                                                                                                                   | Needs local `payments`, `payment_allocations`, and per-currency balances.                                                                                                                                                                                                                                           | **Critical** — a payment recorded offline against an invoice that a _second_ device already settled is a double payment.                                                                                                                                                                                | Pay an invoice offline; sync; the invoice is settled once. Two currencies: a USD payment cannot settle an AFN invoice, even offline.                                                                                                                                 |
| Cancel payment     | `POST /payments/:id/cancel` → `payments_cancel`.                                                                                                                                                                                                            | same                                                                                                                                         | REST + PG                                   | Reversal.                                                                        | **after extracting** `paymentPosting`                                                                                                                                                                                   | Local compensating rows.                                                                                                                                                                                                                                                                                            | High                                                                                                                                                                                                                                                                                                    | Cancel offline → invoice returns to unpaid; balances asserted.                                                                                                                                                                                                       |
| Installment plan   | `installments_save` PG function.                                                                                                                                                                                                                            | `packages/api/src/hooks/installments.ts`, `services/commerce/installment.service.ts`                                                         | REST + PG                                   | Schedule generation is a rule over money and dates.                              | **after extracting** `commerce/installment.domain.ts`                                                                                                                                                                   | Local schedule table.                                                                                                                                                                                                                                                                                               | Medium                                                                                                                                                                                                                                                                                                  | A 3-installment plan sums exactly to the invoice total in minor units.                                                                                                                                                                                               |
| Late fee           | Policy + assessment, stored server-side.                                                                                                                                                                                                                    | `packages/api/src/hooks/late-fees.ts`                                                                                                        | REST                                        | Depends on «today», which is a server-set time zone.                             | **after extracting** the assessment rule + a device time zone                                                                                                                                                           | Needs the workspace time zone locally (`GET /workplace/time-zone`).                                                                                                                                                                                                                                                 | Medium                                                                                                                                                                                                                                                                                                  | A late fee assessed offline uses the **workspace** zone, not the device's.                                                                                                                                                                                           |
| Post to ledger     | `POST /invoices/:id/post-to-ledger` → `accounting_post_journal_entry`.                                                                                                                                                                                      | `packages/api/src/hooks/invoices.ts:329`, `backend/src/services/accounting/accounting.repository.ts`                                         | REST + PG                                   | Journal entry must be balanced and numbered.                                     | **after extracting** `invoice-posting.domain.ts` + `accounting_post_journal_entry`                                                                                                                                      | Local journal tables and a local balance check.                                                                                                                                                                                                                                                                     | **High** — an unbalanced local entry is worse than no entry.                                                                                                                                                                                                                                            | A posted invoice's entry balances to zero in every currency.                                                                                                                                                                                                         |
| Recurring invoice  | Automation engine, server-scheduled.                                                                                                                                                                                                                        | `packages/api/src/hooks/automations.ts`                                                                                                      | REST + scheduler                            | Runs when the app is closed.                                                     | **no**                                                                                                                                                                                                                  | —                                                                                                                                                                                                                                                                                                                   | —                                                                                                                                                                                                                                                                                                       | —                                                                                                                                                                                                                                                                    |
| Approval           | Workflow instance state lives on the server and is shared.                                                                                                                                                                                                  | `packages/api/src/hooks/use-workflow.ts`                                                                                                     | REST                                        | Another person must act.                                                         | **no**                                                                                                                                                                                                                  | —                                                                                                                                                                                                                                                                                                                   | —                                                                                                                                                                                                                                                                                                       | —                                                                                                                                                                                                                                                                    |

**L/C decision for §4.2:** everything except recurring invoices and workflow
approval is **L\***, and the create/edit/delete path is the single most important
piece of the whole programme. Phase 2 cannot honestly claim «offline invoicing»
until stock, cost, number and ledger are decided at queue time.

### 4.3 Inventory — products, stock, warehouses

| Capability                    | Route                            | Hook                                                                                                             | Method + path                                                                                                                             | Service                                                                     | Writes                                            | Rules                                                                                | Class                                                          |
| ----------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Product list                  | `warehouse`                      | `useProducts`, `useProductCategories`                                                                            | `GET /products`, `GET /products/categories`                                                                                               | `services/product.service.ts`                                               | —                                                 | —                                                                                    | **L**                                                          |
| Product detail                | `warehouse/:id`                  | `useProduct`, `useProductJourney`                                                                                | `GET /products/:id`, `GET /accounting/evidence/products/:id`                                                                              | `services/product.service.ts`, `services/accounting/evidence.domain.ts`     | —                                                 | —                                                                                    | **L\***                                                        |
| Create / edit product         | `warehouse`, `warehouse/:id`     | `useCreateProduct`, `useUpdateProduct`, `useDeleteProduct`                                                       | `POST/PATCH/DELETE /products`                                                                                                             | `services/product.service.ts`                                               | `products`, `stock_movements`, `product_barcodes` | `inventory/stock-summary.domain.ts`                                                  | **L\***                                                        |
| Opening stock / stock edit    | `warehouse/:id`                  | `useUpdateProduct`                                                                                               | `PATCH /products/:id`                                                                                                                     | `services/product.service.ts`                                               | `products`, `stock_movements`                     | `stockEditWarehouse`                                                                 | **L\***                                                        |
| Barcodes                      | `warehouse/:id`                  | `useProductBarcodes`, `useAddProductBarcode`, `useRemoveProductBarcode`                                          | `GET/POST/DELETE /products/:id/barcodes`                                                                                                  | `services/product.service.ts`                                               | `product_barcodes`                                | —                                                                                    | **L**                                                          |
| Barcode lookup                | `invoices/new`                   | `lookupProductByBarcode`                                                                                         | `GET /products/by-barcode/:code`                                                                                                          | `services/product.service.ts`                                               | —                                                 | ambiguity rule (`BARCODE_AMBIGUOUS`)                                                 | **L** — already answered by the device first (`findByBarcode`) |
| Product images                | `warehouse/:id`                  | `useProductImages`, `useAddProductImage`, …                                                                      | `GET/POST/PUT/PATCH/DELETE /products/:id/images`                                                                                          | `services/product-images/*`                                                 | `product_images`                                  | —                                                                                    | **L** (binary storage is C)                                    |
| Units                         | `warehouse`, `warehouse/:id`     | `useUnits`, `useCreateUnit`, `useProductUnits`                                                                   | `GET/POST /units`, `GET/PUT /products/:id/units`                                                                                          | `services/inventory/units.service.ts`                                       | `custom_units`                                    | `inventory/unit-conversion.domain.ts`                                                | **L\***                                                        |
| Warehouse overview            | `warehouse`, `stock-count`       | `useWarehouseOverview`                                                                                           | `GET /warehouses/overview`                                                                                                                | `services/warehouse.service.ts`                                             | —                                                 | `warehouseOverview`, `unassignedQuantities`                                          | **L\***                                                        |
| Warehouse detail              | `warehouse/:id`, `stock-count`   | `useWarehouseDetail`                                                                                             | `GET /warehouses/:id/detail`                                                                                                              | `services/warehouse.service.ts`                                             | —                                                 | `warehouseProducts`                                                                  | **L\***                                                        |
| Create / edit warehouse       | `warehouse`                      | `useCreateWarehouse`, `useUpdateWarehouse`                                                                       | `POST/PATCH /warehouses`                                                                                                                  | `services/warehouse.service.ts`                                             | `warehouses`                                      | —                                                                                    | **L**                                                          |
| Transfer stock                | `warehouse`                      | `useTransferStock`                                                                                               | `POST /stock-transfers`                                                                                                                   | `services/warehouse.service.ts`                                             | `stock_movements`, `warehouse_stock`              | `warehouse/transfer.domain.ts`, `warehouse_transfer_stock_keyed` (PG)                | **L\***                                                        |
| Assign unassigned stock       | `warehouse`, `warehouse/:id`     | `useAssignWarehouseStock`                                                                                        | `POST /warehouses/:id/assign`                                                                                                             | `services/warehouse.service.ts`                                             | `stock_movements`, `warehouse_stock`              | `checkAssign`                                                                        | **L\***                                                        |
| Stock placement               | `warehouse`                      | `useStockPlacement`                                                                                              | `GET /warehouses/placement`                                                                                                               | `services/inventory/warehouse-map.service.ts`                               | —                                                 | —                                                                                    | **L**                                                          |
| Storage locations             | `warehouse/:id`                  | `useWarehouseMap`, `useCreateStorageLocation`, `usePlaceStock`, `useMoveProductPlacement`, `useSetAutoShelf`     | `GET /warehouses/:id/map`, `POST /warehouses/:id/locations`, `POST /storage-locations/:id/place`, `PUT /storage-locations/:id/auto-shelf` | `services/inventory/warehouse-map.service.ts`                               | `storage_locations`, `storage_auto_shelves`       | `storage_place_stock`, `storage_auto_shelve_invoice` (PG), `warehouse-map.domain.ts` | **L\***                                                        |
| Stock history                 | `warehouse/:id`                  | `useStockHistory`                                                                                                | `GET /products/:id/stock-history`                                                                                                         | `services/inventory/stock-history.service.ts`                               | —                                                 | —                                                                                    | **L**                                                          |
| Expiry batches                | `warehouse/:id`                  | `useBatches`, `useReceiveBatch`, `useUpdateBatchDates`                                                           | `GET/POST/PATCH /operations/batches`                                                                                                      | `services/traceability/*`                                                   | —                                                 | `traceability/lot.domain.ts`                                                         | **L\***                                                        |
| Costing method                | `warehouse`                      | `useInventorySettings`, `useSetCostingMethod`                                                                    | `GET/PUT /inventory/settings`                                                                                                             | `services/inventory-costing/*`                                              | `inventory_settings`                              | `costing.domain.ts`                                                                  | **L\***                                                        |
| Product notes / custom fields | `warehouse/:id`, `customers/:id` | `useEntityNotes`, `useAddEntityNote`, `useCustomFieldRecord`, `useSaveCustomFieldValues`, `useDefineCustomField` | `GET/POST /notes`, `GET/PUT /custom-fields/:entity/:id/values`, `POST /custom-fields/:entity`                                             | `services/notes.service.ts`, `services/extensions/custom-fields.service.ts` | `custom_field_definitions`, `custom_field_values` | `extensions/extension.domain.ts`                                                     | **L**                                                          |
| Manufacture from product      | `warehouse/:id`                  | `useProduce`                                                                                                     | `POST /manufacturing/produce`                                                                                                             | `services/manufacturing.service.ts`                                         | —                                                 | `manufacturing_complete` (PG)                                                        | **C**                                                          |

| Capability              | Current implementation                                                                                                  | Actual files                                                                            | Current dependency | Why server is required                                   | Can become local                                                                                   | Required refactor                                                                               | Risk                                                                                                                                   | Test required                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Product list / detail   | `GET /products` with server filters; device has a `product` table with `quantity`, `buy_price`, `sell_price` as `REAL`. | `packages/api/src/hooks/products.ts`, `packages/app-bridge/src/local-schema.ts:16`      | REST; device cache | Server computes stock and cost.                          | **yes** for identity fields; **after extracting** `inventory/stock-summary.domain.ts` for quantity | Money columns must become integer minor units; quantity must not be `REAL` for countable units. | **High** — `REAL` money on the device and integer money on the server is a permanent rounding disagreement.                            | Write 0.1 + 0.2 on the device, post, read back: identical to the server's value.                             |
| Create / edit product   | `POST/PATCH /products`; server writes `stock_movements` for an opening stock.                                           | `packages/api/src/hooks/products.ts`                                                    | REST               | Opening stock must become a movement, not a column edit. | **after extracting** `stockEditWarehouse`                                                          | Local movement insert with the same warehouse rule.                                             | **High** — the file's own comment records this exact bug: an edit with no warehouse made the product say 20 and the warehouse say -10. | Edit stock with two warehouses present → the movement names one; with none → names none.                     |
| Barcode lookup          | Device asked first (`findByBarcode`), network second.                                                                   | `packages/api/src/lib/offline-queue.ts`, `packages/api/src/hooks/products.ts`           | Device + REST      | Ambiguity must be detected across the _whole_ catalogue. | **yes**                                                                                            | None — already correct.                                                                         | Low                                                                                                                                    | Two products share a barcode → device reports ambiguous, does not pick one.                                  |
| Transfer stock          | `POST /stock-transfers` → `warehouse_transfer_stock_keyed` with an idempotency key.                                     | `packages/api/src/hooks/warehouses.ts:216`, `backend/src/services/warehouse.service.ts` | REST + PG          | Two rows must move atomically.                           | **after extracting** `warehouse/transfer.domain.ts`                                                | Local two-sided movement inside one device transaction.                                         | High — a half transfer loses stock.                                                                                                    | Transfer 5 units offline; both warehouses and the total are correct after sync; replay does not double-move. |
| Assign unassigned stock | `POST /warehouses/:id/assign`, capped by `checkAssign`.                                                                 | `packages/api/src/hooks/warehouses.ts:188`                                              | REST               | Cap depends on the true unassigned total.                | **after extracting** `checkAssign`                                                                 | Local cap from local rows.                                                                      | High                                                                                                                                   | Assign more than unassigned → refused **on the device**.                                                     |
| Storage locations       | `storage_place_stock` PG function.                                                                                      | `packages/api/src/hooks/warehouse-map.ts`                                               | REST + PG          | Placement is a capacity/occupancy rule.                  | **after extracting** `warehouse-map.domain.ts`                                                     | Local placement table.                                                                          | Medium                                                                                                                                 | Place into a full location → refused.                                                                        |
| Costing method          | `GET/PUT /inventory/settings`; the method decides every later cost.                                                     | `packages/api/src/hooks/inventory-operations.ts`                                        | REST               | Changing it mid-history is a server decision.            | **yes** to read; **no** to change offline                                                          | Store the method locally; changing it needs the server.                                         | **High** — a device using FIFO while the server uses AVCO produces two costs for one sale.                                             | Method read offline equals the server's; a change while offline is refused.                                  |
| Expiry batches          | `operations/batches` CRUD.                                                                                              | `packages/api/src/hooks/expiry.ts`                                                      | REST               | Batch identity is workspace-wide.                        | **after extracting** `traceability/lot.domain.ts`                                                  | Local batch table.                                                                              | Medium                                                                                                                                 | Receiving a batch offline and selling from it moves the right batch.                                         |

**L/C decision for §4.3:** products, stock, transfers, placement, batches and
costing **settings** are all **L\***. Nothing in inventory needs a server by
nature except images (binary storage) and the catalogue's cross-device truth.

### 4.4 Customers

| Capability               | Route                        | Hook                                                                                                         | Method + path                                                                                  | Service                                                       | Writes                          | Rules                                                          | Class                                |
| ------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------- | ------------------------------------ |
| Customer list            | `customers`                  | `useCustomers`                                                                                               | `GET /customers`                                                                               | `services/customer.service.ts`                                | —                               | —                                                              | **L**                                |
| Customer detail          | `customers/:id`              | `useCustomer`, `useCustomerProfile`                                                                          | `GET /customers/:id`, `GET /customers/:id/profile`                                             | `services/customer.service.ts`, `services/customer-profile/*` | —                               | `customer-profile/customer-profile.domain.ts`                  | **L\***                              |
| Create / edit customer   | `customers`, `customers/:id` | `useCreateCustomer`, `useUpdateCustomer`                                                                     | `POST/PATCH /customers`                                                                        | `services/customer.service.ts`                                | `customers`, `transactions`     | —                                                              | **L**                                |
| Customer accounting      | `customers/:id`              | `useCustomerAccounting`, `usePartySummary`, `usePartyLedger`, `usePartyActivity`                             | `GET /customers/:id/accounting`, `GET /payments/summary\|ledger\|activity/:partyType/:partyId` | `services/payments/*`, `services/customer.service.ts`         | —                               | `partyBalancesByCurrency`, `accounting/party-ledger.domain.ts` | **L\***                              |
| Customer risk / insights | `customers/:id`              | `useCustomerRisk`, `useCustomerInsights`                                                                     | `GET /analysis/customers/:id/risk`, `GET /customers/:id/insights`                              | `services/customers/customer-risk.domain.ts`                  | —                               | `customers/customer-risk.domain.ts`, `customers/nps.domain.ts` | **L\***                              |
| CRM panel                | `customers`                  | `useCustomerCrm`, `useSupplierSearch`                                                                        | `GET /crm/customers/:id`, `GET /suppliers`                                                     | `services/crm/*`                                              | `interactions`, `opportunities` | `crm/crm.domain.ts`                                            | **L**                                |
| Terms                    | `customers/:id`              | `useUpdateCustomerTerms`                                                                                     | `PATCH /customers/:id/terms`                                                                   | `services/customer-profile/*`                                 | `customers`                     | —                                                              | **L**                                |
| Documents                | `customers/:id`              | `useCustomerDocuments`, `useUploadCustomerDocument`, `fetchCustomerDocumentUrl`, `useRemoveCustomerDocument` | `GET/POST/DELETE /customers/:id/documents`                                                     | `services/customer-profile/*`                                 | `customer_documents`            | —                                                              | **C** (binary storage + signed URLs) |
| Portal link              | `customers/:id`              | `useCustomerPortalLinks`, `useCreatePortalLink`, `useRevokePortalLink`                                       | `GET/POST /customers/:id/portal-links`                                                         | `services/customer-portal/*`                                  | `customer_portal_links`         | —                                                              | **C** (a link another device opens)  |

| Capability             | Current implementation                                                                             | Actual files                                                                                     | Current dependency  | Why server is required           | Can become local                                                           | Required refactor                                              | Risk                                                                                                                         | Test required                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------- | -------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Customer list / detail | `customers` is pulled to the device (`DELTA_ENTITIES`), with `version` for optimistic concurrency. | `packages/app-shell/src/features/sync/sync-engine.ts:111`, `packages/api/src/hooks/customers.ts` | REST + device table | Cross-device identity.           | **yes**                                                                    | None — already the best-covered entity.                        | Low                                                                                                                          | An offline edit carries `version`; a stale edit is refused with a conflict, not silently lost.       |
| Customer accounting    | Per-currency balances computed by `partyBalancesByCurrency`.                                       | `packages/api/src/hooks/payments.ts`, `backend/src/services/payments/payments.domain.ts:305`     | REST                | Needs every payment and invoice. | **after extracting** `partyBalancesByCurrency`, `summarizePartyByCurrency` | Local payments + allocations.                                  | **Critical** — the file's rule is «never sum money across currencies». A local total that adds AFN to USD is a wrong number. | A customer with an AFN invoice and a USD payment shows **two** balances; no combined total is drawn. |
| Risk / insights        | Server-side scoring.                                                                               | `packages/api/src/hooks/analysis.ts`                                                             | REST                | Scoring reads all history.       | **after extracting** the scoring rule                                      | Local history only → must say «based on local data» or refuse. | Medium                                                                                                                       | Fewer local invoices than exist → the score must be labelled partial, not shown as fact.             |
| CRM                    | `interactions`/`opportunities` tables.                                                             | `packages/api/src/hooks/crm.ts`                                                                  | REST                | Shared with other members.       | **yes**                                                                    | Local tables.                                                  | Low                                                                                                                          | Two offline interactions sync as two, not one.                                                       |
| Documents              | Supabase Storage + signed URL.                                                                     | `packages/api/src/hooks/customer-profile.ts`                                                     | REST + storage      | Binary object store.             | **no**                                                                     | —                                                              | —                                                                                                                            | —                                                                                                    |
| Portal link            | Public token, opened by the customer.                                                              | `packages/api/src/hooks/customer-portal.ts`                                                      | REST                | Must resolve from any browser.   | **no**                                                                     | —                                                              | —                                                                                                                            | —                                                                                                    |

**L/C decision for §4.4:** customers are **L**; accounting and risk are **L\***
with a hard per-currency rule; documents and portal links are **C**.

### 4.5 Accounting

| Capability                       | Route                                         | Hook                                                      | Method + path                                                                    | Service                                       | Writes                                   | Rules                                                      | Class   |
| -------------------------------- | --------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------- | ------- |
| Chart of accounts                | `accounting`                                  | `useAccounts`, `useCreateAccount`                         | `GET/POST /accounting/accounts`                                                  | `services/accounting/*`                       | `accounts`                               | `accounting.domain.ts`                                     | **L\*** |
| Journal entries                  | `accounting`                                  | `useJournalEntries`, `useCreateJournalEntry`              | `GET/POST /accounting/journal`                                                   | same                                          | `journal_entries`                        | `accounting_post_journal_entry` (PG)                       | **L\*** |
| Trial balance                    | `accounting`                                  | `useTrialBalance`                                         | `GET /accounting/trial-balance`                                                  | same                                          | —                                        | `accounting_trial_balance` (PG)                            | **L\*** |
| Balance sheet / income statement | `accounting`                                  | `useBalanceSheet`, `useIncomeStatement`                   | `GET /accounting/balance-sheet`, `GET /accounting/income-statement`              | same                                          | —                                        | `accounting.domain.ts`                                     | **L\*** |
| Profit report                    | `accounting`                                  | `useProfitReportsByCurrency`                              | `GET /accounting/profit-report/by-currency`                                      | `services/accounting/profit-report.domain.ts` | —                                        | `buildProfitReport`, `costStatus`                          | **L\*** |
| General ledger                   | `accounting`                                  | `useGeneralLedger`                                        | `GET /accounting/general-ledger`                                                 | same                                          | —                                        | `party-ledger.domain.ts`                                   | **L\*** |
| Evidence / journey               | `accounting`, `invoices/:id`, `warehouse/:id` | `useInvoiceEvidence`, `useProductJourney`                 | `GET /accounting/evidence/invoices/:id`, `GET /accounting/evidence/products/:id` | `services/accounting/evidence.domain.ts`      | —                                        | `evidence.domain.ts`                                       | **L\*** |
| Unvalued stock                   | `accounting`                                  | `useUnvaluedStock`, `useValueUnvaluedStock`               | `GET /inventory/unvalued`, `POST /inventory/unvalued/value`                      | `services/inventory-costing/*`                | `cost_layers`                            | `unvalued-stock.domain.ts`, `inventory_receive_layer` (PG) | **L\*** |
| Financing                        | `accounting`                                  | `useLoanFacilities`, `useInvestmentHoldings`, + mutations | `GET/POST/PATCH /financing/facilities\|holdings`                                 | `services/financing/*`                        | `loan_facilities`, `investment_holdings` | `financing/working-capital.domain.ts`                      | **L**   |
| Month-end / year-end             | `accounting`                                  | `useRunMonthEnd`, `useCreateMonthEndAutomation`           | `POST /accounting/month-end`, `POST /automations/month-end`                      | `services/accounting/month-end.service.ts`    | `journal_entries`                        | `month-end.domain.ts`, `year-end.domain.ts`                | **L\*** |
| Period lock                      | — (no hook on this page)                      | —                                                         | `GET/PUT /accounting/period-lock`                                                | `services/accounting/*`                       | `accounting_period_locks`                | —                                                          | **C**   |

| Capability        | Current implementation                                             | Actual files                                                                                          | Current dependency | Why server is required        | Can become local                                                          | Required refactor                                      | Risk                                                                                                                              | Test required                                                                              |
| ----------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Chart of accounts | `accounts` table, server-scoped.                                   | `packages/api/src/hooks/accounting.ts`                                                                | REST               | Shared reference data.        | **yes**                                                                   | Pull `accounts` to the device.                         | Low                                                                                                                               | An offline journal entry can only name a pulled account.                                   |
| Journal entries   | `accounting_post_journal_entry` validates balance and period lock. | same                                                                                                  | REST + PG          | Atomic balanced write.        | **after extracting** `accounting.domain.ts` + a local balance check       | Local journal tables and a local «must balance» guard. | **High**                                                                                                                          | An unbalanced entry is refused locally, exactly as the server refuses it.                  |
| Trial balance     | `accounting_trial_balance` PG.                                     | same                                                                                                  | REST + PG          | Aggregation over all lines.   | **after extracting** the aggregation                                      | Local aggregation.                                     | High — partial data → wrong balance. Must refuse, not show a smaller total.                                                       | Device holds 2 of 5 entries → trial balance says «incomplete», not a number.               |
| Profit report     | `buildProfitReport` + `costStatus`.                                | `packages/api/src/hooks/accounting.ts`, `backend/src/services/accounting/profit-report.domain.ts:185` | REST               | Needs cost layers.            | **after extracting** `buildProfitReport`                                  | Local cost layers.                                     | **Critical** — `AGENTS.md` §3: unknown cost is not zero. `costStatus` already encodes that; a local implementation must carry it. | A sale whose cost layer is missing shows margin **unknown**, never `100%`. Two currencies. |
| Unvalued stock    | Lists products with no cost layer; `POST …/value` creates layers.  | `packages/api/src/hooks/evidence.ts`                                                                  | REST + PG          | Cost layers are server state. | **after extracting** `unvalued-stock.domain.ts`                           | Local `cost_layers`.                                   | High                                                                                                                              | Valuing stock offline then syncing does not double-create layers.                          |
| Month-end         | Server job.                                                        | `packages/api/src/hooks/automations.ts`                                                               | REST + scheduler   | Runs unattended.              | **no** to schedule; **after extracting** the posting rule to run manually | Manual month-end on the device.                        | Medium                                                                                                                            | Manual month-end offline produces the same entries as the server's.                        |

**L/C decision for §4.5:** all accounting is **L\***. The period lock and any
scheduled close stay **C**.

### 4.6 Till (POS)

| Capability                 | Route        | Hook                                   | Method + path                                                        | Service                       | Writes                     | Rules                                                   | Class   |
| -------------------------- | ------------ | -------------------------------------- | -------------------------------------------------------------------- | ----------------------------- | -------------------------- | ------------------------------------------------------- | ------- |
| Current session            | `till`       | `useCurrentSession`, `useOpenSessions` | `GET /pos/sessions/current`, `GET /pos/sessions/open`                | `services/pos/pos.service.ts` | —                          | `pos/pos.domain.ts`                                     | **L\*** |
| Open / close session       | `till`       | `useOpenSession`, `useCloseSession`    | `POST /pos/sessions`, `POST /pos/sessions/:id/close`                 | same                          | `pos_sessions`             | `pos.domain.ts`                                         | **L\*** |
| Cash movement              | `till`       | `useRecordCashMovement`                | `POST /pos/sessions/:id/cash`                                        | same                          | `pos_cash_movements`       | `pos.domain.ts`                                         | **L\*** |
| Record order               | `till`       | `useRecordOrder` (via container)       | `POST /pos/sessions/:id/orders`                                      | same                          | `pos_orders`               | `pos_record_order` (PG), `pos/negative-stock.domain.ts` | **L\*** |
| Opening capital            | `till`       | `useRecordOpeningCapital`              | `POST /pos/opening-capital`                                          | same                          | `payments`, `pos_sessions` | `payments_record_at_till` (PG)                          | **L\*** |
| Session ledger / cash flow | `till`       | `useSessionLedger`, `useCashFlow`      | `GET /pos/sessions/:id/ledger`, `GET /pos/cash-flow`                 | same                          | —                          | `pos.domain.ts`                                         | **L\*** |
| Till labels                | `till`       | `useTillLabels`, `useSetTillLabel`     | `GET /pos/sessions/labels`, `PATCH /pos/sessions/:id/label`          | same                          | `pos_sessions`             | —                                                       | **L**   |
| Suspend / resume / remove  | `till`       | `useSetTillSuspended`, `useRemoveTill` | `POST /pos/sessions/:id/suspend\|resume`, `DELETE /pos/sessions/:id` | same                          | `pos_sessions`             | —                                                       | **L\*** |
| Shift history              | `operations` | `useShiftHistory`                      | `GET /pos/sessions/history`                                          | same                          | —                          | —                                                       | **L**   |

| Capability                      | Current implementation                                                                        | Actual files                                                                    | Current dependency | Why server is required    | Can become local                                                                                             | Required refactor                                                                           | Risk                                                                                                                            | Test required                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Record order**                | `pos_record_order` PG function: order + invoice + payment + cash movement in one transaction. | `packages/api/src/hooks/till.ts`, `backend/src/services/pos/pos.service.ts:645` | REST + PG          | Multi-table atomic write. | **after extracting** `pos/pos.domain.ts`, `pos/negative-stock.domain.ts`, and the invoice rule set from §4.2 | A till sale **is** an invoice; it must reuse the same local invoice path, not a second one. | **Critical** — a till that works offline but numbers invoices differently from the invoice screen creates two numbering truths. | A till sale and an invoice-screen sale offline produce numbers from the same reserved range, and one stock movement each. |
| Session open / close            | `pos_sessions` rows with totals computed from movements.                                      | same                                                                            | REST               | Totals are aggregated.    | **after extracting** the session totals rule                                                                 | Local aggregation over local movements.                                                     | High — a close total that disagrees with the drawer is the one number a cashier trusts.                                         | Open, 3 cash sales, 1 refund, close offline → the counted total equals the sum of local movements.                        |
| Cash movement / opening capital | `payments_record_at_till` for capital.                                                        | same                                                                            | REST + PG          | Ledger posting.           | **after extracting** `paymentPosting`                                                                        | Reuse the local payment path.                                                               | High                                                                                                                            | Opening capital offline appears in the ledger exactly once after sync.                                                    |

**L/C decision for §4.6:** the till is **L\*** and must share the invoice path.

### 4.7 Manufacturing

| Capability            | Route                            | Hook                                                     | Method + path                        | Service                             | Writes        | Rules                         | Class |
| --------------------- | -------------------------------- | -------------------------------------------------------- | ------------------------------------ | ----------------------------------- | ------------- | ----------------------------- | ----- |
| BOM list              | `manufacturing`                  | `useBOMs`                                                | `GET /boms`                          | `services/manufacturing.service.ts` | —             | `manufacturing_save_bom` (PG) | **C** |
| Production definition | `manufacturing`, `warehouse/:id` | `useProductionDefinition`, `useSaveProductionDefinition` | `GET/PUT /manufacturing/definitions` | same                                | —             | `manufacturing_save_bom` (PG) | **C** |
| Produce               | `manufacturing`, `warehouse/:id` | `useProduce`                                             | `POST /manufacturing/produce`        | same                                | `work_orders` | `manufacturing_complete` (PG) | **C** |
| Production runs       | `manufacturing`, `warehouse/:id` | `useProductionRuns`, `useProductionRun`                  | `GET /manufacturing/runs`            | same                                | —             | `manufacturing_report` (PG)   | **C** |
| Work orders           | `manufacturing`                  | `useWorkOrders`, `useCreateWorkOrder`                    | `GET/POST /work-orders`              | same                                | `work_orders` | —                             | **C** |
| Manufacturing report  | `manufacturing`                  | `useManufacturingReport`                                 | `GET /manufacturing/report`          | same                                | —             | `manufacturing_report` (PG)   | **C** |

| Capability | Current implementation                                                                                       | Actual files                                                                               | Current dependency | Why server is required  | Can become local                            | Required refactor                                                                                                 | Risk                                                                                                                                                                                  | Test required                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------ | ----------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Produce    | `manufacturing_complete`: consumes components (with cost layers) and receives the finished good, atomically. | `packages/api/src/hooks/manufacturing.ts`, `backend/src/services/manufacturing.service.ts` | REST + PG          | Multi-row stock + cost. | **no — C in v1** (owner's Gate-1 amendment) | Not extracted in v1. The action shows «برای این عملیات به اینترنت نیاز دارید» and does not attempt a local write. | **High if it were extracted** — a production run whose component cost is unknown must produce an **unknown** finished cost, not zero. That is exactly why it waits for a later phase. | After Gate 7: produce 1 unit from 3 components, one without a cost layer → finished cost unknown, components still consumed. |
| Report     | `manufacturing_report` PG.                                                                                   | same                                                                                       | REST + PG          | Aggregation.            | **no — C in v1**                            | Not extracted in v1; the page shows the notice.                                                                   | Medium                                                                                                                                                                                | After Gate 7: partial local runs → report marked incomplete.                                                                 |

**L/C decision for §4.7 — amended by the owner on 19 Oct 2026:** manufacturing is
**C** in the first offline edition. Its logic lives inside the Postgres functions
(`manufacturing_complete`, `manufacturing_report`, `manufacturing_save_bom`) and
moving it to the device is a project of its own that has nothing to do with the
core of selling and stock. The page and its actions stay exactly as they are and
show «برای این عملیات به اینترنت نیاز دارید» (Phase 7). **Revisit after Gate 7**,
when the core is proven.

### 4.8 Stock count

| Capability          | Route         | Hook                              | Method + path                                | Service                                     | Writes                                        | Rules                                     | Class   |
| ------------------- | ------------- | --------------------------------- | -------------------------------------------- | ------------------------------------------- | --------------------------------------------- | ----------------------------------------- | ------- |
| Count list / detail | `stock-count` | `useCycleCounts`, `useCycleCount` | `GET /cycle-counts`, `GET /cycle-counts/:id` | `services/inventory/cycle-count.service.ts` | —                                             | `inventory-costing/stock-count.domain.ts` | **L\*** |
| Create count        | `stock-count` | `useCreateCycleCount`             | `POST /cycle-counts`                         | same                                        | `cycle_counts`, `cycle_count_lines`           | `stock-count.domain.ts`                   | **L\*** |
| Record a line       | `stock-count` | `useRecordCount`                  | `POST /cycle-counts/:id/lines`               | same                                        | `cycle_count_lines`                           | `stock-count.domain.ts`                   | **L\*** |
| Complete count      | `stock-count` | `useCompleteCycleCount`           | `POST /cycle-counts/:id/complete`            | same                                        | `stock_movements`, `products`, `cycle_counts` | `stock-count.domain.ts`                   | **L\*** |
| Cancel count        | `stock-count` | `useCancelCycleCount`             | `POST /cycle-counts/:id/cancel`              | same                                        | `cycle_counts`                                | —                                         | **L**   |

| Capability     | Current implementation                                                                                   | Actual files                                                | Current dependency | Why server is required | Can become local                             | Required refactor                                                                                                                                       | Risk                                                                                                  | Test required                                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------ | ---------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete count | Writes one `stock_movements` row per difference and updates `products`, in a loop (not one PG function). | `backend/src/services/inventory/cycle-count.service.ts:206` | REST               | Multi-row write.       | **after extracting** `stock-count.domain.ts` | One local transaction; today's server path is a loop of inserts, which is the compensating-write shape `AGENTS.md` §1.4 forbids for multi-table writes. | **High** — a count completed offline while another device sells must not silently overwrite the sale. | Count says 10, device thinks 8, server thinks 9 → after sync the movement is +1 relative to the server's 9, and the conflict is reported, not hidden. |

**L/C decision for §4.8:** **L\***.

### 4.9 Team and payroll

| Capability                      | Route                            | Hook                                                                                                                                                                                                        | Method + path                                                                                        | Service                                               | Writes                                                   | Rules                                       | Class                              |
| ------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------- | ---------------------------------- |
| Employee list / detail          | `team-and-payroll`, `…/:id`      | `useEmployees`, `useEmployee`                                                                                                                                                                               | `GET /employees`, `GET /employees/:id`                                                               | `services/human-resources.service.ts`                 | —                                                        | —                                           | **L**                              |
| Create / edit / delete employee | same                             | `useCreateEmployee`, `useUpdateEmployee`, `useDeleteEmployee`                                                                                                                                               | `POST/PATCH/DELETE /employees`                                                                       | same                                                  | `employees`                                              | —                                           | **L**                              |
| Attendance sheet                | `team-and-payroll`               | `useAttendanceSheet`, `useMarkAttendance`                                                                                                                                                                   | `GET/PUT /attendance-sheet`                                                                          | `services/payroll/attendance.service.ts`              | `attendance`                                             | `attendance/attendance.domain.ts`           | **L\***                            |
| Shifts                          | `team-and-payroll`               | `useWorkShifts`, `useCreateWorkShift`, `useSetWorkShiftActive`, `useAssignShift`, `useCancelShiftAssignment`, `useShiftPlan`                                                                                | `GET/POST/PATCH /shifts`, `GET/POST /shift-assignments`                                              | same                                                  | `shifts`, `shift_assignments`                            | —                                           | **L**                              |
| Leaves                          | `…/:id`                          | `useLeaves`, `useCreateLeave`, `useDecideLeave`                                                                                                                                                             | `GET/POST /leaves`, `PATCH /leaves/:id`                                                              | same                                                  | `leaves`                                                 | —                                           | **L**                              |
| Payroll                         | `…/:id`                          | `usePayrolls`, `useCreatePayroll`, `useSettlePayroll`                                                                                                                                                       | `GET/POST /payrolls`, `PATCH /payrolls/:id`                                                          | same                                                  | `payrolls`                                               | `payroll/payroll-ledger.domain.ts`          | **L\***                            |
| Permission matrix               | `team-and-payroll`, `governance` | `usePermissionMatrix`, `useAssignProfile`, `useSetPermissionCell`, `useCreateCustomRole`, `useDeleteCustomRole`, `useRoleMembers`                                                                           | `GET/PUT /permissions/matrix`, `POST /permissions/profiles/assign`, `POST/DELETE /permissions/roles` | `services/authorization/permission-matrix.service.ts` | `role_permissions`, `roles`, `user_roles`                | `authorization/authorization.domain.ts`     | **C**                              |
| Attendance devices              | `team-and-payroll`               | `useAttendanceDevices`, `useRegisterAttendanceDevice`, `useRevokeAttendanceDevice`, `useDeviceIdentities`, `useMapDeviceIdentity`, `useUnmatchedDeviceUsers`, `useHeldDeviceDays`, `useAcceptHeldDeviceDay` | `GET/POST/DELETE /attendance-devices`, `PUT /attendance-devices/:id/identities`                      | `services/attendance-devices/*`                       | `attendance_terminals`, `attendance_terminal_identities` | `attendance-devices/device-event.domain.ts` | **C** (a second physical device)   |
| Attendance links                | `team-and-payroll`               | `useAttendanceLink`, `useCreateAttendanceLink`, `useRevokeAttendanceLink`, `useAttendanceSubmissions`, `useDecideAttendanceSubmission`, `useForgetAttendancePhone`                                          | `GET/POST/DELETE /attendance-links`, `GET/POST /attendance-submissions`                              | `services/payroll/attendance-link.service.ts`         | —                                                        | `payroll/attendance-link.domain.ts`         | **C** (a phone opens a public URL) |
| Member management               | `team-and-payroll`               | `useWorkspaceMembers`, `useCreateMemberDirect`                                                                                                                                                              | `GET /workspaces/:id/members`, `POST /workspaces/:id/members/direct`                                 | `services/workspace.service.ts`                       | `workspace_members`                                      | —                                           | **C**                              |

| Capability                 | Current implementation                                                        | Actual files                                                                          | Current dependency         | Why server is required                   | Can become local                                                           | Required refactor                                            | Risk                                                                                                    | Test required                                                                              |
| -------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Employees                  | `employees` table; the device has an `employee` table that **nothing pulls**. | `packages/api/src/hooks/employees.ts`, `packages/app-bridge/src/local-schema.ts:119`  | REST                       | Shared HR record.                        | **yes**                                                                    | Add `employee` to the pull set; it is already in the schema. | Medium — an unused table that looks like coverage is worse than none.                                   | An employee created offline survives a sync and appears on the other device.               |
| Attendance                 | `GET/PUT /attendance-sheet`; time zone comes from `GET /workplace/time-zone`. | `packages/api/src/hooks/attendance.ts`                                                | REST + workspace time zone | «Today» is a workspace decision.         | **after extracting** `attendance/attendance.domain.ts` + a local time zone | Store the workspace zone locally.                            | **High** — a mark filed at 23:50 in Kabul but computed in the device's UTC zone lands on the wrong day. | Mark attendance offline at the day boundary in a non-UTC workspace zone → the correct day. |
| Payroll                    | `POST /payrolls` + `payroll-ledger.domain.ts`.                                | `packages/api/src/hooks/payroll.ts`                                                   | REST                       | Posts to the ledger.                     | **after extracting** `payroll-ledger.domain.ts`                            | Local ledger path from §4.5.                                 | High                                                                                                    | Payroll run offline posts one balanced entry per employee.                                 |
| Permissions / roles        | Server-side capability list; `useMyCapabilities` gates every route.           | `packages/api/src/hooks/permission-matrix.ts`, `backend/src/services/authorization/*` | REST                       | Authority must not be a device decision. | **no**                                                                     | —                                                            | —                                                                                                       | —                                                                                          |
| Attendance devices / links | Second physical device / public URL.                                          | `packages/api/src/hooks/attendance-devices.ts`, `attendance-links.ts`                 | REST                       | By nature multi-device.                  | **no**                                                                     | —                                                            | —                                                                                                       | —                                                                                          |

**L/C decision for §4.9:** HR records, attendance, shifts, leaves and payroll are
**L\***; permissions, devices, links and members are **C**.

### 4.10 Settings, onboarding, sync, data

| Capability                   | Route                    | Hook                                                                                                                                                                             | Method + path                                                                                                              | Service                                            | Writes           | Rules                                                                    | Class                                 |
| ---------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------- | ------------------------------------------------------------------------ | ------------------------------------- |
| Books currency               | `settings`, `onboarding` | `useBaseCurrency`, `useSetBaseCurrency`                                                                                                                                          | `GET/PUT /finance/currency/base`                                                                                           | `services/base-currency.ts`                        | `workspaces`     | `baseCurrencyOf`, `describeBaseCurrency`, `setBaseCurrency`              | **L\***                               |
| Workspace time zone          | `settings`               | `useWorkplaceTimeZones`, `useSetWorkspaceTimeZone`, `useSetBranchTimeZone`                                                                                                       | `GET/PUT /workplace/time-zone`                                                                                             | `services/workplace-time-zone`                     | —                | —                                                                        | **L\***                               |
| Workspace profile            | `settings`               | `useWorkspaces`, `useUpdateWorkspace`                                                                                                                                            | `GET/PATCH /workspaces`                                                                                                    | `services/workspace.service.ts`                    | `workspaces`     | —                                                                        | **L**                                 |
| Business stamp               | `settings`               | `BusinessStampSection` (workspace hooks)                                                                                                                                         | `PATCH /workspaces/:id`                                                                                                    | same                                               | `workspaces`     | —                                                                        | **C** (image upload)                  |
| Hardware (printers, scanner) | `settings`               | `HardwareSection` (device only)                                                                                                                                                  | —                                                                                                                          | —                                                  | —                | —                                                                        | **L**                                 |
| Currencies list              | `onboarding`             | `useCurrencies`                                                                                                                                                                  | `GET /currencies`                                                                                                          | `services/currency/currencies.service.ts`          | —                | —                                                                        | **L**                                 |
| Backup                       | `settings`               | `useWorkspaceBackup`, `useDownloadWorkspaceBackup`                                                                                                                               | `GET /workspaces/backup`                                                                                                   | `services/workspace/backup.service.ts`             | —                | `portability/snapshot.domain.ts`                                         | **C**                                 |
| Sync queue                   | `sync-center`            | `useSyncQueue`, `useSyncStatus` (shell-owned)                                                                                                                                    | `bridge().db.queue()`                                                                                                      | `packages/app-shell/src/features/sync/use-sync.ts` | `sync_queue`     | `app-bridge/outbox-stage`, `push-order`                                  | **L**                                 |
| Sync push / pull             | `sync-center`            | `runSync` (shell-owned)                                                                                                                                                          | `POST /sync/push`, `GET /sync/pull`, `GET /sync/snapshot`, `GET /sync/cursor`                                              | `services/sync.service.ts`                         | `sync_mutations` | `sync-overview.domain.ts`                                                | **C** (the server side of sync)       |
| Sync overview                | `data-and-sync`          | `useSyncOverview`, `useDuplicateCounts`                                                                                                                                          | `GET /sync/overview`, `GET /intelligence/duplicates/:entity`                                                               | `services/sync-overview.domain.ts`                 | —                | —                                                                        | **C**                                 |
| Conflicts                    | `data-and-sync`          | `useConflicts`                                                                                                                                                                   | `GET /conflicts`                                                                                                           | `services/conflict/*`                              | `sync_conflicts` | `conflict/conflict.domain.ts`                                            | **C**                                 |
| Data migration               | `data-and-sync`          | `useMigrations`                                                                                                                                                                  | `GET /migrations`                                                                                                          | `services/migration/*`                             | `migration_jobs` | `migration/*.domain.ts`                                                  | **C** (reads files, calls the server) |
| Activities                   | `activities`             | `useInfiniteActivities`, `useActivityFilterCounts`, `useUnreadActivityCount`, `useMarkAllActivitiesAsRead`                                                                       | `GET /v1/activities`, `GET /v1/activities/counts`, `GET /v1/activities/unread-count`, `PATCH /v1/activities/mark-all-read` | `services/activity.service.ts`                     | `activities`     | `ActivityService.createActivity` (to extract from `activity.service.ts`) | **L\***                               |
| Audit trail                  | `audit`, `customers/:id` | `useAuditTrail`, `useRecordHistory`                                                                                                                                              | `GET /audit/workspace`                                                                                                     | `services/audit.service.ts`                        | `audit_logs`     | `AuditService.log` (to extract from `audit.service.ts`)                  | **L\***                               |
| Approvals / workflows        | `approvals`              | `useWorkflows`, `useWorkflowInstances`, `usePerformWorkflowAction`                                                                                                               | `GET /v1/workflows`, `GET /v1/workflows/instances`, `POST /v1/workflows/instances/:id/action`                              | `services/workflow/*`                              | —                | `workflow/approval.domain.ts`, `approval-gate.domain.ts`                 | **C**                                 |
| Analysis                     | `analysis`               | `useBreakEven`, `useCohorts`, `useCollectionsWorklist`, `usePeerBenchmark`, `useSupplierAnalysis`, `useWorkingCapital`, `useReportCatalog`, `useReportRun`, `useSavedReports`, … | `GET /analysis/*`, `GET /custom-reports/*`, `GET /report-dashboards`                                                       | `services/analysis/*`, `services/reporting/*`      | —                | `analytics/*.domain.ts`, `collections/collections.domain.ts`             | **L\***                               |
| Peer benchmark               | `analysis`               | `usePeerBenchmark`                                                                                                                                                               | `GET /analysis/benchmark`                                                                                                  | `services/analytics/benchmark.service.ts`          | —                | `benchmark_sale_counts` (PG)                                             | **C** (aggregates other businesses)   |

| Capability          | Current implementation                                                                                                                                                  | Actual files                                                                        | Current dependency | Why server is required                           | Can become local                                                                             | Required refactor                                                         | Risk                                                                                                                                                                                                 | Test required                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Books currency      | One stored value per workspace; `setBaseCurrency` refuses unless role is `owner`, the currency is supported, and `changeable` is true (no invoice/payment/journal yet). | `backend/src/services/base-currency.ts`, `packages/api/src/hooks/currency-rates.ts` | REST               | It is the workspace's single truth.              | **yes** to read; **no** to change offline                                                    | Device must store it and treat a local change as an error until it syncs. | **Critical** — `AGENTS.md` §3: no hardcoded currency. The device schema already defaults `currency TEXT NOT NULL DEFAULT 'AFN'` (`local-schema.ts:64`) — that is a hardcoded currency on the device. | A toman business's offline invoice carries TOMAN, not AFN.                                    |
| Workspace time zone | `workplace/time-zone`.                                                                                                                                                  | `packages/api/src/hooks/workplace-time-zone.ts`                                     | REST               | «Today» is a workspace fact.                     | **yes**                                                                                      | Store locally.                                                            | High (see attendance).                                                                                                                                                                               | A date written offline matches the server's date in the workspace zone.                       |
| Backup              | Server builds the archive.                                                                                                                                              | `packages/api/src/hooks/backup.ts`                                                  | REST               | Cross-device snapshot.                           | **no**                                                                                       | —                                                                         | —                                                                                                                                                                                                    | —                                                                                             |
| Sync queue          | `useSyncQueue` polls `bridge().db.queue()` every 5 s; `runSync` drains with a push gate and per-entry idempotency.                                                      | `packages/app-shell/src/features/sync/use-sync.ts:15`, `sync-engine.ts:556`         | Device + REST      | The push target is the server.                   | **yes** (already local)                                                                      | None.                                                                     | Low                                                                                                                                                                                                  | Queue survives an app restart mid-drain; an entry never goes before the create it references. |
| Conflicts           | `sync_conflicts` rows created by `POST /sync/push` when `expectedVersion` mismatches.                                                                                   | `packages/api/src/hooks/conflicts.ts`                                               | REST               | The other side of the conflict is on the server. | **no** to resolve; **yes** to display                                                        | Local conflict list can be cached.                                        | Medium                                                                                                                                                                                               | A conflict is visible offline (cached) and resolvable only when online.                       |
| Audit trail         | `audit_logs` written by every service.                                                                                                                                  | `packages/api/src/hooks/audit-trail.ts`                                             | REST               | Records other members' actions.                  | **after extracting** `AuditService.log` — which action maps to which audited field is a rule | Local audit rows for local actions, written through the extracted rule.   | Medium                                                                                                                                                                                               | A local action appends exactly one audit row, not one per sync attempt.                       |
| Analysis            | Server aggregates.                                                                                                                                                      | `packages/api/src/hooks/analysis.ts`, `custom-reports.ts`                           | REST               | Needs all history.                               | **after extracting** each rule                                                               | Per-report extraction; several are not worth it.                          | Medium                                                                                                                                                                                               | Each report either computes from complete local data or refuses.                              |
| Peer benchmark      | Aggregates **other** businesses.                                                                                                                                        | `packages/api/src/hooks/analysis.ts`                                                | REST               | Impossible locally.                              | **no**                                                                                       | —                                                                         | —                                                                                                                                                                                                    | —                                                                                             |

**L/C decision for §4.10:** settings, activities, audit, analysis are **L/L\***;
backup, sync, conflicts, migration, benchmark, approvals are **C**.

### 4.11 Pages that are **C** or **X** by nature

| Route                   | Why **C** (needs a server)                                                                                                                                             | Why **X** (not in the offline edition) |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `developers`            | OAuth apps, webhooks, API keys, sandbox workspaces — all addressed by third parties.                                                                                   | —                                      |
| `manufacturing`         | Approved **C** for v1 (owner, 19 Oct 2026): BOM, production and the manufacturing report live in Postgres functions and are not part of the core of selling and stock. | —                                      |
| `marketplace`           | Lists apps published by other people.                                                                                                                                  | —                                      |
| `billing`               | Subscriptions, wallet, upgrade requests, trial status.                                                                                                                 | —                                      |
| `market-seller`         | A public storefront another device visits.                                                                                                                             | —                                      |
| `assistant`             | AI provider calls (`POST /ai/ask`, `/ingest/read`, `/ai/translate`).                                                                                                   | —                                      |
| `governance`            | Capabilities, roles, SoD — authority is never a device decision.                                                                                                       | —                                      |
| `approvals`             | Another person must act.                                                                                                                                               | —                                      |
| `public-task/:token`    | A public link; the token resolves on the server.                                                                                                                       | —                                      |
| `public-invoice/:token` | Same.                                                                                                                                                                  | —                                      |
| `portal/:token`         | Same.                                                                                                                                                                  | —                                      |
| `my-attendance/:token`  | Same — and it is opened on the _employee's_ phone, not the business's device.                                                                                          | —                                      |
| `login`                 | Auth is a server fact.                                                                                                                                                 | —                                      |

> The four `public-*` / `portal` / `my-attendance` routes call `fetch()` directly
> against `NEXT_PUBLIC_API_URL` (default `https://api.hisabche.com/api`),
> **bypassing `apiClient`** — no token, no workspace header, no offline queue.
> They are the only routes in the shell that do not go through `@hisabche/api`.
> Classifying them **X** is a product decision for the owner, not a technical
> one: they are pages a _customer or employee_ opens, and they cannot work on a
> device that holds no data for that token.

**No route is class X for a technical reason.** Every X above is X because the
page is addressed by someone who is not the business's device. If the owner wants
any of them in the offline edition, they become **C** with a stated limitation,
not L.

---

## 5. The L / C split — **approved by the owner on 19 Oct 2026, with three amendments**

| Class            | Screens | Routes                                                                                                                                                                                                                                                                       |
| ---------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L**            | **4**   | `customers`, `sync-center`, `onboarding`, `data-and-sync`                                                                                                                                                                                                                    |
| **L\***          | **18**  | `/` (index), `invoices`, `invoices/new`, `invoices/new/preview`, `invoices/:id`, `warehouse`, `warehouse/:id`, `customers/:id`, `accounting`, `activities`, `settings`, `analysis`, `operations`, `stock-count`, `team-and-payroll`, `team-and-payroll/:id`, `audit`, `till` |
| **C**            | **9**   | `/login`, `approvals`, `developers`, `marketplace`, `billing`, `market-seller`, `assistant`, `governance`, `manufacturing` _(amendment 1: C in v1, revisit after Gate 7)_                                                                                                    |
| **X**            | **4**   | `public-task/:token`, `public-invoice/:token`, `portal/:token`, `my-attendance/:token`                                                                                                                                                                                       |
| **R** (redirect) | **36**  | §3 rows 3, 38–72                                                                                                                                                                                                                                                             |
| **L** (layout)   | **1**   | `/` — `RequireAuth` + `AppShell`; **C at start** (§6)                                                                                                                                                                                                                        |

4 + 18 + 9 + 4 = **35 rendered screens**, plus 36 redirects and 1 layout = **72 route entries as audited**. (Amendment 2
moved `activities` from **L** to **L\***; amendment 1 moved `manufacturing` from **L\*** to **C**; Phase 2
then removed the duplicate `inventory` redirect, so the live router is 35 redirects / **71 entries**.)
The per-capability classes inside each screen are in §4; a screen classed L\* may contain an
individual **C** capability and those are called out in §4.10.

### 5.1 The three amendments the owner made when approving

1. **`manufacturing` moves to C for v1** — its rule lives inside the Postgres
   functions and moving it to the device has nothing to do with the core of
   selling and stock. The page stays and shows «نیاز به اینترنت» at the action.
   Revisit after Gate 7. (Applied in §4.7 and §4.1.)
2. **`activities` and `audit` are L\*, not L.** The feed is not a read of data the
   device already has: the _server_ writes the activity row and the audit row on
   every invoice and payment. A local engine has to write them itself, through
   the same rule — `ActivityService.createActivity` (`activity.service.ts`) and
   `AuditService.log` (`audit.service.ts`). Both are now named as rules to
   extract. (Applied in §4.1 and §4.10.)
3. **The lesson counter in `CLAUDE.md` was stale** — it said `۱–۱۸۵` while
   `.claude/lessons-learned.md` already held 190. Corrected to `۱–۱۹۰` for the
   amendment, then to `۱–۱۹۳` when this session appended lessons 191–193.

### 5.2 The three questions — answered by the owner, 19 Oct 2026

1. **«Offline» means «the business runs with no internet»**, not «one queued
   invoice». Scope of the first offline edition: invoice create / edit / cancel,
   stock, payments, ledger and the till — the four extractions of §4.2, §4.3,
   §4.5 and §4.6.
2. **Device money becomes integer minor units**, like the server:
   `SCHEMA_VERSION` 2 → 3. Existing rows are converted with the currency's
   `FRACTION_DIGITS`, and the conversion is proven by a test on a real copy of a
   device database — **every currency's sum identical before and after**. The
   `'AFN'` column default is dropped: the currency comes from
   `local_workspace.base_currency`.
3. **The invoice is numbered on the device, at the moment it is recorded**: the
   offline edition is one device, so it owns a sequence of its own
   (`invoice_counter`, incremented in the same transaction that records the
   invoice). A printed receipt always carries a number. **No reserved range is
   built** — that belongs to a multi-device edition and is not built. When the
   device is connected to the cloud (Phase 8) the local number is kept as
   `external_number` and the server assigns its own `invoice_number`.
4. **The duplicate `inventory` redirect is removed in Phase 2** — **done,
   19 Oct 2026:** one line deleted, and `route-parity.test.ts` gained a test
   that counts path declarations (a `Set` cannot see a duplicate). 35 tests in
   that file pass. (§3 rows 41/69, BUG-129.)

**Gate 1 is approved. Phase 2 is open.** (A second Gate-1 item the owner carried
forward: the `CLAUDE.md` lesson counter, §5.1 amendment 3.)

---

## 6. Every place the shell needs the network **to start**

This is the section that decides whether «open the app in a shop with no
internet» works at all. Today it does not.

### 6.1 Startup chain, in order

| #   | Step                                                                                                                                     | File                                                                                               | What happens with no network                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `bridge()` registered, offline queue registered, printer host registered, camera registered                                              | `packages/app-shell/src/app/providers.tsx:24-70`                                                   | Works — all local.                                                                                                                                                                                    |
| 2   | `useLoadWorkspace()` → `fetchWorkspace(userId)` → `GET /workspaces`                                                                      | `providers.tsx:132`, `packages/store/src/slices/workspace.slice.ts:94`                             | **Fails.** `workspaceId` stays null. Nothing downstream works: realtime subscribes to nothing, the sync engine runs with a null workspace, the device cache has no owner.                             |
| 3   | `usePersistedQueryCache` → `cache.setOwner(cacheOwner(userId, workspaceId))`                                                             | `providers.tsx:102-119`                                                                            | Runs with a null workspace → the saved cache is filed under the wrong owner and may be discarded.                                                                                                     |
| 4   | `RequireAuth` reads `isAuthenticated` from the persisted session                                                                         | `features/auth/require-auth.tsx`                                                                   | Works — the session is on disk.                                                                                                                                                                       |
| 5   | `AppShell` → `useMyCapabilities()` → `GET /governance/my-capabilities`                                                                   | `components/layout/app-shell.tsx:56`                                                               | **Fails.** `access` is `undefined`, so `isRouteDenied` sees no blocked modules and **every route renders**. That is a security-shaped failure: offline, the UI shows pages the role does not include. |
| 6   | `useSubscriptionLocked()` → `GET /billing/subscription`                                                                                  | `app-shell.tsx:53`                                                                                 | **Fails.** `data?.access?.expired` is `undefined` → not locked → every page renders.                                                                                                                  |
| 7   | `BookCurrencySync` → `GET /finance/currency/base`                                                                                        | `app-shell.tsx:109`, `packages/ui/src/components/ui/book-currency-sync.tsx`                        | **Fails.** `useCurrencyStore.primaryCurrency` keeps whatever the device last stored — which is `AFN` from the store's built-in default on a fresh install. A toman business sees AFN amounts.         |
| 8   | `SandboxNotice` → `GET /developer/sandbox`                                                                                               | `app-shell.tsx:108`                                                                                | Fails silently (renders nothing). Acceptable.                                                                                                                                                         |
| 9   | `useWorkspaceCache(workspaceId)` → `bridge().db.setWorkspace()`                                                                          | `app-shell.tsx:68`, `use-sync.ts:115`                                                              | Skipped (null workspace) → the device cache is never pointed at this workspace, so it shows the previous business's rows.                                                                             |
| 10  | `useBackgroundSync(workspaceId)` → `runSync` → `GET /sync/cursor`, `/sync/snapshot`, `/sync/pull`, and a WebSocket to `/api/sync/stream` | `app-shell.tsx:69`, `use-sync.ts:79`, `sync-engine.ts:424`                                         | **Fails**, then retries on a 60 s interval and on `online`. The stream fails and reconnects with backoff (1 s → 60 s). Degrades to «stale», not «broken».                                             |
| 11  | Notification hooks (`useNotifications`, `useUnreadCount`)                                                                                | `packages/api/src/hooks/notifications.ts`                                                          | Fail; `useRealtime` subscribes to a channel that cannot connect.                                                                                                                                      |
| 12  | Token readiness: `useAuthReady` waits on `tokenReady`, `client.ts` waits up to `TOKEN_READY_TIMEOUT_MS = 2000` ms                        | `packages/api/src/hooks/useAuthReady.ts`, `packages/api/src/lib/client.ts`, `lib/tokenProvider.ts` | Works — the token is on disk. But every query that waits for it then fails with a network error.                                                                                                      |
| 13  | Desktop only: `app.info()` → `databaseReady`                                                                                             | `features/settings/settings-page.tsx:46`                                                           | Works — local IPC.                                                                                                                                                                                    |
| 14  | Desktop only: update check (`app:checkUpdates`) is **not** called at startup                                                             | `electron/main/index.ts`, `electron/main/services/updater.ts`                                      | Good — verified: no auto-check on boot.                                                                                                                                                               |

### 6.2 The three that must be fixed first

1. **`useLoadWorkspace`.** A workspace must be remembered on the device and
   usable without the network. Today a cold start with no network has no
   workspace at all.
2. **`useMyCapabilities` and `useSubscriptionLocked`.** Both fail _open_. Offline,
   the shell must use the last known capability set and subscription state, and
   must fail **closed** if there is no stored answer.
3. **`BookCurrencySync`.** The device's display currency must come from a stored
   workspace value, never from the store's built-in default.

---

## 7. Platform sections — Windows and Android

### 7.1 Network calls at start, per platform

| Platform | Call                                                          | Where                                                              | Offline result                                   |
| -------- | ------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| Both     | `GET /workspaces`                                             | `workspace.slice.ts:94`                                            | no workspace                                     |
| Both     | `GET /governance/my-capabilities`                             | `app-shell.tsx:56`                                                 | no gating                                        |
| Both     | `GET /billing/subscription`                                   | `app-shell.tsx:53`                                                 | no lock                                          |
| Both     | `GET /finance/currency/base`                                  | `book-currency-sync.tsx`                                           | stale/AFN                                        |
| Both     | `GET /developer/sandbox`                                      | `sandbox-notice.tsx`                                               | nothing drawn                                    |
| Both     | `GET /sync/cursor` then `/sync/snapshot` ×3 then `/sync/pull` | `sync-engine.ts:308-414`                                           | no pull; cursor unchanged                        |
| Both     | `WS /api/sync/stream`                                         | `sync-engine.ts:424`                                               | reconnect with backoff                           |
| Both     | `GET /v1/notifications/unread-count`                          | `notifications.ts`                                                 | badge absent                                     |
| Android  | `POST /devices` (push token registration)                     | `apps/mobile/src/features/notifications/use-push-registration.ts`  | retried later                                    |
| Android  | `GET /api/public/cms/globals/:locale`                         | `apps/mobile/src/shared/lib/cms-remote-content.ts:26`              | fails; host strings are local                    |
| Android  | outbox drain at start                                         | `apps/mobile/src/host/use-host-services.ts` (`runSync()` on mount) | fails, retried on NetInfo reconnect / foreground |
| Windows  | no auto update check on boot                                  | verified in `electron/main/index.ts`                               | —                                                |
| Windows  | `db:query`, `db:queue`, `app:info` over IPC                   | local                                                              | work                                             |

### 7.2 Device database — current tables

`packages/app-bridge/src/local-schema.ts`, `SCHEMA_VERSION = 2`:

| Table                | Money columns                                                                                                                      | Pulled?                                   | Written locally?           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------- |
| `product`            | `buy_price REAL`, `sell_price REAL`                                                                                                | **yes** (`/sync/snapshot` + `/sync/pull`) | product edits, stock edits |
| `customer`           | `opening_balance REAL`                                                                                                             | **yes**                                   | customer edits             |
| `invoice`            | `subtotal REAL`, `discount_total REAL`, `tax_total REAL`, `total REAL`, `paid_amount REAL`; `currency TEXT NOT NULL DEFAULT 'AFN'` | **yes**                                   | invoice create (queued)    |
| `invoice_item`       | `unit_price REAL`, `discount REAL`, `total_price REAL`                                                                             | **yes** (nested in invoice rows)          | invoice create (queued)    |
| `transaction`        | `amount REAL`, `currency TEXT NOT NULL DEFAULT 'AFN'`                                                                              | **no**                                    | nothing today              |
| `inventory_movement` | —                                                                                                                                  | **no**                                    | nothing today              |
| `employee`           | `salary REAL`                                                                                                                      | **no**                                    | nothing today              |
| `sync_queue`         | —                                                                                                                                  | —                                         | every queued write         |
| `sync_cursor`        | —                                                                                                                                  | —                                         | cursor per entity          |
| `meta`               | —                                                                                                                                  | —                                         | schema metadata            |

Three findings:

- **F1-02 — money is `REAL` on the device and integer minor units on the
  server.** Every local total is a different number from the server's. This is
  the single largest correctness risk in the programme and it is a _schema_
  change (`SCHEMA_VERSION` 3), not a UI change.
- **F1-03 — two tables default `currency` to `'AFN'`.** `AGENTS.md` §3 forbids a
  hardcoded currency; the device schema violates it in two places. It is masked
  today only because nothing writes those tables locally except a queued invoice
  that carries the user's chosen currency.
- **F1-04 — `transaction`, `inventory_movement` and `employee` exist, are never
  pulled, and are never written.** They look like offline coverage in the schema
  and provide none. Phase 2 must either fill them or delete them; leaving them is
  the «fake data» shape `AGENTS.md` §0.10 forbids.

### 7.3 IPC / bridge messages

`packages/app-bridge/src/contract.ts` — one contract, two hosts
(Electron `ipcMain.handle` / React Native WebView RPC).

| Channel                                     | Payload                                                             | Purpose                                              | Offline     |
| ------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- | ----------- |
| `secure:get`                                | `{ key }`                                                           | read a stored secret                                 | local       |
| `secure:set`                                | `{ key, value }`                                                    | write a stored secret                                | local       |
| `secure:delete`                             | `{ key }`                                                           | remove a secret                                      | local       |
| `db:query`                                  | `{ table, search?, where?, orderBy?, direction?, limit?, offset? }` | read device rows                                     | local       |
| `db:upsertMany`                             | `{ table, rows[] }`                                                 | write device rows                                    | local       |
| `db:removeMany`                             | `{ table, ids[] }`                                                  | remove server-deleted rows, keeping `dirty = 1`      | local       |
| `db:enqueue`                                | `{ entity, operation, clientId, payload }`                          | queue an offline write                               | local       |
| `db:queue`                                  | —                                                                   | read the queue                                       | local       |
| `db:resolveQueue`                           | `{ clientId, status, error? }`                                      | mark an entry done/failed                            | local       |
| `db:setWorkspace`                           | `{ workspaceId }`                                                   | point the cache at a workspace, purge another's rows | local       |
| `print:html`                                | `{ html, landscape?, silent?, deviceName?, pageWidthMm?, copies? }` | print a document                                     | local       |
| `print:escpos`                              | `{ data, deviceName? }`                                             | thermal receipt                                      | local       |
| `print:listPrinters`                        | —                                                                   | enumerate printers                                   | local       |
| `file:export`                               | `{ suggestedName, content, encoding?, filters? }`                   | save a file                                          | local       |
| `file:import`                               | `{ extensions[] }`                                                  | open a file                                          | local       |
| `window:control`                            | `{ action }`                                                        | minimize/maximize/close                              | local       |
| `app:info`                                  | —                                                                   | `{ version, platform, locale, databaseReady }`       | local       |
| `app:checkUpdates`                          | —                                                                   | update check                                         | **network** |
| `app:downloadUpdate`                        | —                                                                   | download installer                                   | **network** |
| `app:installUpdate`                         | —                                                                   | quit and install                                     | local       |
| `http:request`                              | `{ url, method, headers?, body?, bodyBytes?, responseType? }`       | main-process HTTP proxy (CORS-free)                  | **network** |
| `app:updateStatus` (event, main → renderer) | `UpdateStatus`                                                      | download progress                                    | —           |
| `barcode.scan` (optional, Android only)     | —                                                                   | camera scan                                          | local       |

Every handler is gated by `authenticateAndAuthorize(capability, localOnly)`;
`db:setWorkspace` requires `record.delete` because it can discard the cached
dataset. **The capability for every local IPC call comes from the server's
capability list** — which means an offline app that never fetched
`/governance/my-capabilities` cannot authorize a local write. That is the second
half of §6.2 item 2.

---

## 8. What Phase 1 did not do

- **No code was changed.** From this phase `git status` adds `docs/offline/` and the
  `.claude/` phase record only. The working tree already contained 32 unrelated
  entries before Phase 1 began (§8.1); none were touched.
- **No migration was written.** Three schema changes are _identified_ (§5 items
  1–3, F1-02, F1-03) and none were implemented.
- **No endpoint was re-attributed to a table per-endpoint.** §4's `Writes` column
  is service-level, as stated in §0.2.
- **No test was written.** Every row's `Test required` is a specification for
  Phase 2, not an existing test.
- **No build, no lint run, no test run** — Phase 1 adds no code, so there is
  nothing to verify beyond the file scope.

### 8.1 Pre-existing working-tree state (not mine)

`git status --porcelain` before Phase 1 listed 32 entries (25 modified, 4 deleted,
3 untracked), including modified
`backend/src/services/banking/banking.service.ts`,
`backend/src/services/event-log.service.ts`, the three
`packages/i18n/messages/*/common.json`, several `packages/ui` components and
tests, a deleted `packages/api/src/hooks/snapshots.ts`, and three untracked test/
helper files. Those belong to the owner's in-flight work and were neither read for
decisions nor modified.

---

## Appendix A — every route, every hook, every endpoint

`(no request)` on a hook means its request is issued by a helper the extractor could not follow through the hook body; the endpoint is listed in the row below it or under the same container. Nothing here is inferred: every path below appears literally in `packages/api/src/hooks/*.ts`.

### `/` (index) — dashboard

The index route renders `DashboardContainer` through
`packages/app-shell/src/features/dashboard/dashboard-page.tsx`. Its hooks live in
`packages/ui/src/hooks/dashboard/use-dashboard-data.ts` plus the container itself.

| Hook                     | Hook file           | Method + path                     |
| ------------------------ | ------------------- | --------------------------------- |
| `useDashboardKPIs`       | `analytics.ts`      | `GET /analytics/dashboard`        |
| `useDashboardSales`      | `analytics.ts`      | `GET /analytics/sales`            |
| `useActivities`          | `activity.ts`       | `GET /v1/activities`              |
| `useConflicts`           | `conflicts.ts`      | `GET /conflicts`                  |
| `useWorkflowInstances`   | `use-workflow.ts`   | `GET /v1/workflows/instances`     |
| `useAIInsights`          | `ai-chat.ts`        | `GET /ai/insights`                |
| `useAiAvailability`      | `ai-chat.ts`        | `GET /ai/quota`                   |
| `useAskAi`               | `ai-chat.ts`        | `POST /ai/ask`                    |
| `useManufacturingReport` | `manufacturing.ts`  | `GET /manufacturing/report`       |
| `useMyCapabilities`      | `governance.ts`     | `GET /governance/my-capabilities` |
| `useCustomUnits`         | `currency-rates.ts` | `GET /finance/currency/units`     |
| `useExchangeRates`       | `currency-rates.ts` | `GET /finance/currency/rates`     |
| `useSetCustomUnit`       | `currency-rates.ts` | `PUT /finance/currency/units`     |
| `useSetExchangeRate`     | `currency-rates.ts` | `PUT /finance/currency/rates`     |
| `useRealtime`            | `useRealtime.ts`    | — (subscription, no request)      |

### `invoices`

| Hook                   | Hook file        | Method + path                     |
| ---------------------- | ---------------- | --------------------------------- |
| `useAutomationRuns`    | `automations.ts` | `GET /automations/${id}/runs`     |
| `useAutomations`       | `automations.ts` | `GET /automations`                |
| `useBranches`          | `branches.ts`    | `GET /branches`                   |
| `useDeleteInvoice`     | `invoices.ts`    | `DELETE /invoices/${id}`          |
| `useInvoices`          | `invoices.ts`    | `GET /invoices`                   |
| `useMyCapabilities`    | `governance.ts`  | `GET /governance/my-capabilities` |
| `useRemoveAutomation`  | `automations.ts` | `DELETE /automations/${id}`       |
| `useRunAutomationNow`  | `automations.ts` | `POST /automations/${id}/run`     |
| `useUpdateAutomation`  | `automations.ts` | `PATCH /automations/${id}`        |
| `useWarehouseOverview` | `warehouses.ts`  | —                                 |

### `invoices/new`

| Hook                     | Hook file             | Method + path                                             |
| ------------------------ | --------------------- | --------------------------------------------------------- |
| `lookupProductByBarcode` | `products.ts`         | `GET /products/by-barcode/${encodeURIComponent(barcode)}` |
| `rateOn`                 | `currency-rates.ts`   | —                                                         |
| `useBaseCurrency`        | `currency-rates.ts`   | `GET /finance/currency/base`                              |
| `useBranches`            | `branches.ts`         | `GET /branches`                                           |
| `useCreateCustomer`      | `customers.ts`        | `POST /customers`                                         |
| `useCustomUnits`         | `currency-rates.ts`   | `GET /finance/currency/units`                             |
| `useCustomerProfile`     | `customer-profile.ts` | `GET /customers/${customerId}/profile`                    |
| `useCustomers`           | `customers.ts`        | `GET /customers`                                          |
| `useExchangeRates`       | `currency-rates.ts`   | `GET /finance/currency/rates`                             |
| `useProducts`            | `products.ts`         | `GET /products`                                           |
| `useProductsByIds`       | `products.ts`         | `GET /products/${id}`                                     |
| `useSetCustomUnit`       | `currency-rates.ts`   | `PUT /finance/currency/units`                             |
| `useSetExchangeRate`     | `currency-rates.ts`   | `PUT /finance/currency/rates`                             |
| `useStockPlacement`      | `warehouses.ts`       | —                                                         |

### `invoices/new/preview`

| Hook                        | Hook file           | Method + path                         |
| --------------------------- | ------------------- | ------------------------------------- |
| `useBaseCurrency`           | `currency-rates.ts` | `GET /finance/currency/base`          |
| `useCreateInvoice`          | `invoices.ts`       | —                                     |
| `useCreateRecurringInvoice` | `automations.ts`    | `POST /automations/recurring-invoice` |
| `useCustomUnits`            | `currency-rates.ts` | `GET /finance/currency/units`         |
| `useOpenSessions`           | `till.ts`           | `GET /pos/sessions/open`              |
| `useProductsByIds`          | `products.ts`       | `GET /products/${id}`                 |
| `useSetCustomUnit`          | `currency-rates.ts` | `PUT /finance/currency/units`         |
| `useSetExchangeRate`        | `currency-rates.ts` | `PUT /finance/currency/rates`         |
| `useTillLabels`             | `till.ts`           | `GET /pos/sessions/labels`            |
| `useWorkspaces`             | `workspace.ts`      | `GET /workspaces`                     |

### `invoices/:id`

| Hook                        | Hook file            | Method + path                                       |
| --------------------------- | -------------------- | --------------------------------------------------- |
| `useAssessLateFee`          | `late-fees.ts`       | `POST /invoices/${invoiceId}/late-fees`             |
| `useBaseCurrency`           | `currency-rates.ts`  | `GET /finance/currency/base`                        |
| `useCancelPayment`          | `payments.ts`        | `POST /payments/${paymentId}/cancel`                |
| `useClearInstallmentPlan`   | `installments.ts`    | `DELETE /invoices/${invoiceId}/installments`        |
| `useCostInvoice`            | `evidence.ts`        | `POST /invoices/${invoiceId}/cost`                  |
| `useInstallmentPlan`        | `installments.ts`    | `GET /invoices/${invoiceId}/installments`           |
| `useInvoice`                | `invoices.ts`        | `GET /invoices/${id}`                               |
| `useInvoiceEvidence`        | `evidence.ts`        | `GET /accounting/evidence/invoices/${invoiceId}`    |
| `useInvoiceRelated`         | `invoice-related.ts` | `GET /invoices/${invoiceId}/related`                |
| `useLateFeePreview`         | `late-fees.ts`       | `GET /invoices/${invoiceId}/late-fees`              |
| `useOpenSessions`           | `till.ts`            | `GET /pos/sessions/open`                            |
| `usePerformWorkflowAction`  | `use-workflow.ts`    | `POST /v1/workflows/instances/${instanceId}/action` |
| `usePostInvoiceToLedger`    | `invoices.ts`        | `POST /invoices/${id}/post-to-ledger`               |
| `useRecordHistory`          | `audit-trail.ts`     | `GET /audit/workspace/${entityType}/${entityId}`    |
| `useRecordPayment`          | `payments.ts`        | `POST /payments`                                    |
| `useSaveInstallmentPlan`    | `installments.ts`    | `PUT /invoices/${invoiceId}/installments`           |
| `useSaveLateFeePolicy`      | `late-fees.ts`       | `PUT /late-fees/policy`                             |
| `useSubscription`           | `billing.ts`         | `GET /billing/subscription`                         |
| `useTillLabels`             | `till.ts`            | `GET /pos/sessions/labels`                          |
| `useWorkflow`               | `use-workflow.ts`    | `GET /v1/workflows/${id}`                           |
| `useWorkflowInstance`       | `use-workflow.ts`    | `GET /v1/workflows/instances`                       |
| `useWorkflowInstanceDetail` | `use-workflow.ts`    | `GET /v1/workflows/instances/${id}`                 |
| `useWorkspaces`             | `workspace.ts`       | `GET /workspaces`                                   |
| _(direct call, no hook)_    | —                    | `GET /invoices/${invoiceId}/pdf`                    |

### `warehouse`

| Hook                       | Hook file                 | Method + path                                                                                                    |
| -------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `productKeys`              | `products.ts`             | —                                                                                                                |
| `useAssignWarehouseStock`  | `warehouses.ts`           | `POST /warehouses/${warehouseId}/assign`                                                                         |
| `useBaseCurrency`          | `currency-rates.ts`       | `GET /finance/currency/base`                                                                                     |
| `useBranches`              | `branches.ts`             | `GET /branches`                                                                                                  |
| `useCreateBranch`          | `branches.ts`             | `POST /branches`                                                                                                 |
| `useCreateProduct`         | `products.ts`             | `POST /products`                                                                                                 |
| `useCreateStorageLocation` | `warehouse-map.ts`        | `POST /warehouses/${target ?? warehouseId}/locations`                                                            |
| `useCreateUnit`            | `units.ts`                | `POST /units`                                                                                                    |
| `useCreateWarehouse`       | `warehouses.ts`           | `POST /warehouses`                                                                                               |
| `useCustomUnits`           | `currency-rates.ts`       | `GET /finance/currency/units`                                                                                    |
| `useDeleteProduct`         | `products.ts`             | `DELETE /products/${id}`                                                                                         |
| `useExchangeRates`         | `currency-rates.ts`       | `GET /finance/currency/rates`                                                                                    |
| `useInventorySettings`     | `inventory-operations.ts` | `GET /inventory/settings`                                                                                        |
| `useMoveProductPlacement`  | `warehouse-map.ts`        | `POST /storage-locations/${input.fromLocationId}/place`<br>`POST /storage-locations/${input.toLocationId}/place` |
| `useMyCapabilities`        | `governance.ts`           | `GET /governance/my-capabilities`                                                                                |
| `usePlaceStock`            | `warehouse-map.ts`        | `POST /storage-locations/${input.locationId}/place`                                                              |
| `useProductCategories`     | `products.ts`             | `GET /products/categories`                                                                                       |
| `useProducts`              | `products.ts`             | `GET /products`                                                                                                  |
| `useRealtime`              | `useRealtime.ts`          | —                                                                                                                |
| `useReceiveBatch`          | `expiry.ts`               | `POST /operations/batches`                                                                                       |
| `useSetAutoShelf`          | `warehouse-map.ts`        | `PUT /storage-locations/${input.locationId}/auto-shelf`                                                          |
| `useSetCostingMethod`      | `inventory-operations.ts` | `PUT /inventory/settings`                                                                                        |
| `useSetCustomUnit`         | `currency-rates.ts`       | `PUT /finance/currency/units`                                                                                    |
| `useSetExchangeRate`       | `currency-rates.ts`       | `PUT /finance/currency/rates`                                                                                    |
| `useStockHistory`          | `stock-history.ts`        | `GET /products/${productId}/stock-history`                                                                       |
| `useStockPlacement`        | `warehouses.ts`           | —                                                                                                                |
| `useTransferStock`         | `warehouses.ts`           | `POST /stock-transfers`                                                                                          |
| `useUnits`                 | `units.ts`                | `GET /units`                                                                                                     |
| `useUpdateProduct`         | `products.ts`             | `PATCH /products/${id}`                                                                                          |
| `useUpdateStorageLocation` | `warehouse-map.ts`        | `PATCH /storage-locations/${id}`                                                                                 |
| `useUpdateWarehouse`       | `warehouses.ts`           | `PATCH /warehouses/${input.id}`                                                                                  |
| `useWarehouseDetail`       | `warehouses.ts`           | —                                                                                                                |
| `useWarehouseMap`          | `warehouse-map.ts`        | —                                                                                                                |
| `useWarehouseOverview`     | `warehouses.ts`           | —                                                                                                                |

### `warehouse/:id`

| Hook                           | Hook file          | Method + path                                                                                                    |
| ------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `PRODUCT_IMAGE_LIMIT`          | `products.ts`      | —                                                                                                                |
| `useAddEntityNote`             | `notes.ts`         | `POST /notes`                                                                                                    |
| `useAddProductBarcode`         | `products.ts`      | `POST /products/${productId}/barcodes`                                                                           |
| `useAddProductImage`           | `products.ts`      | `POST /products/${productId}/images`                                                                             |
| `useAssignWarehouseStock`      | `warehouses.ts`    | `POST /warehouses/${warehouseId}/assign`                                                                         |
| `useBatches`                   | `expiry.ts`        | `GET /operations/batches`                                                                                        |
| `useBranches`                  | `branches.ts`      | `GET /branches`                                                                                                  |
| `useCreateBranch`              | `branches.ts`      | `POST /branches`                                                                                                 |
| `useCreateProduct`             | `products.ts`      | `POST /products`                                                                                                 |
| `useCreateStorageLocation`     | `warehouse-map.ts` | `POST /warehouses/${target ?? warehouseId}/locations`                                                            |
| `useCreateWarehouse`           | `warehouses.ts`    | `POST /warehouses`                                                                                               |
| `useCustomFieldRecord`         | `custom-fields.ts` | `GET /custom-fields/${entity}/${entityId}/values`                                                                |
| `useDefineCustomField`         | `custom-fields.ts` | `POST /custom-fields/${entity}`                                                                                  |
| `useDeleteProduct`             | `products.ts`      | `DELETE /products/${id}`                                                                                         |
| `useEntityNotes`               | `notes.ts`         | `GET /notes`                                                                                                     |
| `useMoveProductPlacement`      | `warehouse-map.ts` | `POST /storage-locations/${input.fromLocationId}/place`<br>`POST /storage-locations/${input.toLocationId}/place` |
| `useMyCapabilities`            | `governance.ts`    | `GET /governance/my-capabilities`                                                                                |
| `useProduce`                   | `manufacturing.ts` | `POST /manufacturing/produce`                                                                                    |
| `useProduct`                   | `products.ts`      | `GET /products/${id}`                                                                                            |
| `useProductBarcodes`           | `products.ts`      | `GET /products/${productId}/barcodes`                                                                            |
| `useProductCategories`         | `products.ts`      | `GET /products/categories`                                                                                       |
| `useProductImages`             | `products.ts`      | `GET /products/${productId}/images`                                                                              |
| `useProductJourney`            | `evidence.ts`      | `GET /accounting/evidence/products/${productId}`                                                                 |
| `useProductStorageLocations`   | `warehouse-map.ts` | —                                                                                                                |
| `useProductWarehouseBreakdown` | `warehouses.ts`    | —                                                                                                                |
| `useProductionDefinition`      | `manufacturing.ts` | `GET /manufacturing/definitions/${productId}`                                                                    |
| `useProductionRun`             | `manufacturing.ts` | `GET /manufacturing/runs/${id}`                                                                                  |
| `useProductionRuns`            | `manufacturing.ts` | `GET /manufacturing/runs`                                                                                        |
| `useProducts`                  | `products.ts`      | `GET /products`                                                                                                  |
| `useRemoveProductBarcode`      | `products.ts`      | `DELETE /products/${productId}/barcodes/${barcodeId}`                                                            |
| `useRemoveProductImage`        | `products.ts`      | `DELETE /products/${productId}/images/${imageId}`                                                                |
| `useReorderProductImages`      | `products.ts`      | `PUT /products/${productId}/images/order`                                                                        |
| `useSaveCustomFieldValues`     | `custom-fields.ts` | `PUT /custom-fields/${entity}/${entityId}/values`                                                                |
| `useSaveProductionDefinition`  | `manufacturing.ts` | `PUT /manufacturing/definitions`                                                                                 |
| `useSetCustomFieldActive`      | `custom-fields.ts` | `PATCH /custom-fields/definitions/${input.id}/active`                                                            |
| `useSetProductImageAlt`        | `products.ts`      | `PATCH /products/${productId}/images/${input.imageId}`                                                           |
| `useStockHistory`              | `stock-history.ts` | `GET /products/${productId}/stock-history`                                                                       |
| `useStockPlacement`            | `warehouses.ts`    | —                                                                                                                |
| `useUnits`                     | `units.ts`         | `GET /units`                                                                                                     |
| `useUpdateBatchDates`          | `expiry.ts`        | `PATCH /operations/batches/${batchId}`                                                                           |
| `useUpdateProduct`             | `products.ts`      | `PATCH /products/${id}`                                                                                          |
| `useWarehouseMap`              | `warehouse-map.ts` | —                                                                                                                |
| `useWarehouseOverview`         | `warehouses.ts`    | —                                                                                                                |

### `customers`

| Hook                | Hook file           | Method + path                     |
| ------------------- | ------------------- | --------------------------------- |
| `useBaseCurrency`   | `currency-rates.ts` | `GET /finance/currency/base`      |
| `useCreateCustomer` | `customers.ts`      | `POST /customers`                 |
| `useCreateInvoice`  | `invoices.ts`       | —                                 |
| `useCustomers`      | `customers.ts`      | `GET /customers`                  |
| `useInvoices`       | `invoices.ts`       | `GET /invoices`                   |
| `useMyCapabilities` | `governance.ts`     | `GET /governance/my-capabilities` |
| `useRecordPayment`  | `payments.ts`       | `POST /payments`                  |

### `customers/:id`

| Hook                        | Hook file             | Method + path                                              |
| --------------------------- | --------------------- | ---------------------------------------------------------- |
| `fetchCustomerDocumentUrl`  | `customer-profile.ts` | `GET /customers/${customerId}/documents/${documentId}/url` |
| `useAddEntityNote`          | `notes.ts`            | `POST /notes`                                              |
| `useCreatePortalLink`       | `customer-portal.ts`  | `POST /customers/${customerId}/portal-links`               |
| `useCustomFieldRecord`      | `custom-fields.ts`    | `GET /custom-fields/${entity}/${entityId}/values`          |
| `useCustomer`               | `customers.ts`        | `GET /customers/${id}`                                     |
| `useCustomerAccounting`     | `customer-profile.ts` | `GET /customers/${customerId}/accounting`                  |
| `useCustomerCrm`            | `crm.ts`              | `GET /crm/customers/${customerId}`                         |
| `useCustomerDocuments`      | `customer-profile.ts` | `GET /customers/${customerId}/documents`                   |
| `useCustomerInsights`       | `customer-profile.ts` | `GET /customers/${customerId}/insights`                    |
| `useCustomerPortalLinks`    | `customer-portal.ts`  | `GET /customers/${customerId}/portal-links`                |
| `useCustomerProfile`        | `customer-profile.ts` | `GET /customers/${customerId}/profile`                     |
| `useCustomerRisk`           | `analysis.ts`         | `GET /analysis/customers/${customerId}/risk`               |
| `useDefineCustomField`      | `custom-fields.ts`    | `POST /custom-fields/${entity}`                            |
| `useEntityNotes`            | `notes.ts`            | `GET /notes`                                               |
| `useInvoices`               | `invoices.ts`         | `GET /invoices`                                            |
| `useOpenInvoices`           | `payments.ts`         | `GET /payments/open-invoices/${partyType}/${partyId}`      |
| `useOpenSessions`           | `till.ts`             | `GET /pos/sessions/open`                                   |
| `usePartyActivity`          | `payments.ts`         | `GET /payments/activity/${partyType}/${partyId}`           |
| `usePartyLedger`            | `payments.ts`         | `GET /payments/ledger/${partyType}/${partyId}`             |
| `usePartySummary`           | `payments.ts`         | `GET /payments/summary/${partyType}/${partyId}`            |
| `usePayments`               | `payments.ts`         | `GET /payments`                                            |
| `usePostInvoiceToLedger`    | `invoices.ts`         | `POST /invoices/${id}/post-to-ledger`                      |
| `useRecordHistory`          | `audit-trail.ts`      | `GET /audit/workspace/${entityType}/${entityId}`           |
| `useRecordPayment`          | `payments.ts`         | `POST /payments`                                           |
| `useRemoveCustomerDocument` | `customer-profile.ts` | `DELETE /customers/${customerId}/documents/${documentId}`  |
| `useRevokePortalLink`       | `customer-portal.ts`  | `DELETE /customer-portal-links/${linkId}`                  |
| `useSaveCustomFieldValues`  | `custom-fields.ts`    | `PUT /custom-fields/${entity}/${entityId}/values`          |
| `useSetCustomFieldActive`   | `custom-fields.ts`    | `PATCH /custom-fields/definitions/${input.id}/active`      |
| `useSupplierSearch`         | `customer-profile.ts` | `GET /suppliers`                                           |
| `useTillLabels`             | `till.ts`             | `GET /pos/sessions/labels`                                 |
| `useUpdateCustomerTerms`    | `customer-profile.ts` | `PATCH /customers/${customerId}/terms`                     |
| `useUploadCustomerDocument` | `customer-profile.ts` | `POST /customers/${customerId}/documents`                  |

### `accounting`

| Hook                          | Hook file        | Method + path                                    |
| ----------------------------- | ---------------- | ------------------------------------------------ |
| `useAccounts`                 | `accounting.ts`  | `GET /accounting/accounts`                       |
| `useAutomations`              | `automations.ts` | `GET /automations`                               |
| `useBalanceSheet`             | `accounting.ts`  | `GET /accounting/balance-sheet`                  |
| `useBranches`                 | `branches.ts`    | `GET /branches`                                  |
| `useCreateAccount`            | `accounting.ts`  | `POST /accounting/accounts`                      |
| `useCreateInvestmentHolding`  | `financing.ts`   | `POST /financing/holdings`                       |
| `useCreateJournalEntry`       | `accounting.ts`  | `POST /accounting/journal`                       |
| `useCreateLoanFacility`       | `financing.ts`   | `POST /financing/facilities`                     |
| `useCreateMonthEndAutomation` | `automations.ts` | `POST /automations/month-end`                    |
| `useGeneralLedger`            | `accounting.ts`  | `GET /accounting/general-ledger`                 |
| `useIncomeStatement`          | `accounting.ts`  | `GET /accounting/income-statement`               |
| `useInvestmentHoldings`       | `financing.ts`   | `GET /financing/holdings`                        |
| `useJournalEntries`           | `accounting.ts`  | `GET /accounting/journal`                        |
| `useLoanFacilities`           | `financing.ts`   | `GET /financing/facilities`                      |
| `useMyCapabilities`           | `governance.ts`  | `GET /governance/my-capabilities`                |
| `usePostUnpostedInvoices`     | `invoices.ts`    | `POST /invoices/post-unposted`                   |
| `useProfitReportsByCurrency`  | `accounting.ts`  | `GET /accounting/profit-report/by-currency`      |
| `useRemoveAutomation`         | `automations.ts` | `DELETE /automations/${id}`                      |
| `useRunMonthEnd`              | `automations.ts` | `POST /accounting/month-end`                     |
| `useSetLoanFacilityActive`    | `financing.ts`   | `PATCH /financing/facilities/${input.id}/active` |
| `useTrialBalance`             | `accounting.ts`  | `GET /accounting/trial-balance`                  |
| `useUnvaluedStock`            | `evidence.ts`    | `GET /inventory/unvalued`                        |
| `useUpdateAutomation`         | `automations.ts` | `PATCH /automations/${id}`                       |
| `useUpdateInvestmentHolding`  | `financing.ts`   | `PATCH /financing/holdings/${id}`                |
| `useValueUnvaluedStock`       | `evidence.ts`    | `POST /inventory/unvalued/value`                 |

### `activities`

| Hook                         | Hook file                       | Method + path                            |
| ---------------------------- | ------------------------------- | ---------------------------------------- |
| `useActivityFilterCounts`    | `activity.ts`                   | `GET /v1/activities/counts`              |
| `useAuditTrail`              | `audit-trail.ts`                | `GET /audit/workspace`                   |
| `useBranches`                | `branches.ts`                   | `GET /branches`                          |
| `useInfiniteActivities`      | `activity.ts`                   | `GET /v1/activities`                     |
| `useMarkAllActivitiesAsRead` | `useMarkAllActivitiesAsRead.ts` | `PATCH /v1/activities/mark-all-read`     |
| `useUnreadActivityCount`     | `useActivities.ts`              | `GET /v1/activities/unread-count`        |
| `useUnreadCount`             | `activity.ts`                   | `GET /v1/activities/unread-count`        |
| `useUnreadCount`             | `notifications.ts`              | `GET /v1/notifications/unread-count`     |
| `useWorkspaceMembers`        | `workspace.ts`                  | `GET /workspaces/${workspaceId}/members` |

### `settings`

| Hook                      | Hook file                | Method + path                                             |
| ------------------------- | ------------------------ | --------------------------------------------------------- |
| `lookupProductByBarcode`  | `products.ts`            | `GET /products/by-barcode/${encodeURIComponent(barcode)}` |
| `useBaseCurrency`         | `currency-rates.ts`      | `GET /finance/currency/base`                              |
| `useMyCapabilities`       | `governance.ts`          | `GET /governance/my-capabilities`                         |
| `useSetBaseCurrency`      | `currency-rates.ts`      | `PUT /finance/currency/base`                              |
| `useSetBranchTimeZone`    | `workplace-time-zone.ts` | `PUT /workplace/branches/${input.branchId}/time-zone`     |
| `useSetWorkspaceTimeZone` | `workplace-time-zone.ts` | `PUT /workplace/time-zone`                                |
| `useUpdateWorkspace`      | `workspace.ts`           | `PATCH /workspaces/${id}`                                 |
| `useWorkplaceTimeZones`   | `workplace-time-zone.ts` | `GET /workplace/time-zone`                                |
| `useWorkspaceBackup`      | `backup.ts`              | `GET /workspaces/backup`                                  |
| `useWorkspaces`           | `workspace.ts`           | `GET /workspaces`                                         |

### `approvals`

| Hook                        | Hook file         | Method + path                                       |
| --------------------------- | ----------------- | --------------------------------------------------- |
| `useMyCapabilities`         | `governance.ts`   | `GET /governance/my-capabilities`                   |
| `usePerformWorkflowAction`  | `use-workflow.ts` | `POST /v1/workflows/instances/${instanceId}/action` |
| `useWorkflow`               | `use-workflow.ts` | `GET /v1/workflows/${id}`                           |
| `useWorkflowInstanceDetail` | `use-workflow.ts` | `GET /v1/workflows/instances/${id}`                 |
| `useWorkflowInstances`      | `use-workflow.ts` | `GET /v1/workflows/instances`                       |
| `useWorkflows`              | `use-workflow.ts` | `GET /v1/workflows`                                 |

### `developers`

| Hook                        | Hook file        | Method + path                                                                     |
| --------------------------- | ---------------- | --------------------------------------------------------------------------------- |
| `mcpEndpointUrl`            | `ai-requests.ts` | —                                                                                 |
| `useAddAppScreenshot`       | `oauth.ts`       | `POST /developer/apps/${input.appId}/screenshots`                                 |
| `useAiActionRequests`       | `ai-requests.ts` | `GET /ai-requests`                                                                |
| `useApiKeyUsage`            | `developer.ts`   | `GET /developer/keys/${keyId}/usage`                                              |
| `useAppScreenshots`         | `oauth.ts`       | `GET /developer/apps/${appId}/screenshots`                                        |
| `useAppStats`               | `oauth.ts`       | `GET /developer/apps/${appId}/stats`                                              |
| `useAppUpdatePreview`       | `oauth.ts`       | `GET /developer/installed-apps/${installationId}/update`                          |
| `useAppVersions`            | `oauth.ts`       | `GET /developer/apps/${appId}/versions`                                           |
| `useApplyAppUpdate`         | `oauth.ts`       | `POST /developer/installed-apps/${installationId}/update`                         |
| `useCreateOAuthApp`         | `oauth.ts`       | `POST /developer/apps`                                                            |
| `useCreateSandbox`          | `sandbox.ts`     | `POST /developer/sandbox`                                                         |
| `useCreateWebhookEndpoint`  | `developer.ts`   | `POST /developer/webhooks`                                                        |
| `useDecideAiActionRequest`  | `ai-requests.ts` | `POST /ai-requests/${input.id}/approve`<br>`POST /ai-requests/${input.id}/reject` |
| `useDeleteOAuthApp`         | `oauth.ts`       | `DELETE /developer/apps/${id}`                                                    |
| `useDeleteWebhookEndpoint`  | `developer.ts`   | `DELETE /developer/webhooks/${id}`                                                |
| `useDeveloperCatalog`       | `developer.ts`   | `GET /developer/catalog`                                                          |
| `useInstalledApps`          | `oauth.ts`       | `GET /developer/installed-apps`                                                   |
| `useOAuthApps`              | `oauth.ts`       | `GET /developer/apps`                                                             |
| `usePublisherProfile`       | `oauth.ts`       | `GET /developer/publisher`                                                        |
| `useRemoveAppScreenshot`    | `oauth.ts`       | `DELETE /developer/apps/${input.appId}/screenshots/${input.screenshotId}`         |
| `useReplayWebhook`          | `developer.ts`   | `POST /developer/webhooks/${id}/replay`                                           |
| `useResetSandbox`           | `sandbox.ts`     | `POST /developer/sandbox/reset`                                                   |
| `useRetryWebhookDelivery`   | `developer.ts`   | `POST /developer/deliveries/${id}/retry`                                          |
| `useRotateAppWebhookSecret` | `oauth.ts`       | `POST /developer/apps/${id}/webhook-secret`                                       |
| `useRotateOAuthSecret`      | `oauth.ts`       | `POST /developer/apps/${id}/rotate-secret`                                        |
| `useRotateWebhookSecret`    | `developer.ts`   | `POST /developer/webhooks/${id}/rotate-secret`                                    |
| `useSandboxStatus`          | `sandbox.ts`     | `GET /developer/sandbox`                                                          |
| `useSavePublisherProfile`   | `oauth.ts`       | `PUT /developer/publisher`                                                        |
| `useSaveStorefrontSettings` | `orders.ts`      | `PUT /storefront/settings`                                                        |
| `useSendWebhookTest`        | `developer.ts`   | `POST /developer/webhooks/${id}/test`                                             |
| `useStorefrontSettings`     | `orders.ts`      | `GET /storefront/settings`                                                        |
| `useSubmitAppVersion`       | `oauth.ts`       | `POST /developer/apps/${input.appId}/versions`                                    |
| `useUninstallApp`           | `oauth.ts`       | `POST /developer/installed-apps/${installationId}/uninstall`                      |
| `useUpdateOAuthApp`         | `oauth.ts`       | `PATCH /developer/apps/${input.id}`                                               |
| `useUpdateWebhookEndpoint`  | `developer.ts`   | `PATCH /developer/webhooks/${id}`                                                 |
| `useUploadAppImage`         | `oauth.ts`       | `POST /developer/apps/${input.appId}/images`                                      |
| `useWebhookDeliveries`      | `developer.ts`   | `GET /developer/webhooks/${endpointId}/deliveries`                                |
| `useWebhookEndpoints`       | `developer.ts`   | `GET /developer/webhooks`                                                         |

### `marketplace`

| Hook                 | Hook file  | Method + path                                  |
| -------------------- | ---------- | ---------------------------------------------- |
| `useDeleteAppReview` | `oauth.ts` | `DELETE /marketplace/apps/${appId}/review`     |
| `useMarketplaceApp`  | `oauth.ts` | `GET /marketplace/apps/${app}`                 |
| `useMarketplaceApps` | `oauth.ts` | `GET /marketplace/apps`                        |
| `useReportApp`       | `oauth.ts` | `POST /marketplace/apps/${input.appId}/report` |
| `useSaveAppReview`   | `oauth.ts` | `PUT /marketplace/apps/${input.appId}/review`  |

### `billing`

| Hook                      | Hook file       | Method + path                                        |
| ------------------------- | --------------- | ---------------------------------------------------- |
| `useCancelSubscription`   | `billing.ts`    | `POST /billing/cancel`                               |
| `useCancelUpgradeRequest` | `billing.ts`    | `POST /billing/upgrade-requests/${requestId}/cancel` |
| `useMyCapabilities`       | `governance.ts` | `GET /governance/my-capabilities`                    |
| `usePayUpgradeFromWallet` | `wallet.ts`     | `POST /wallet/pay-upgrade`                           |
| `usePlans`                | `billing.ts`    | `GET /billing/plans`                                 |
| `useSubscription`         | `billing.ts`    | `GET /billing/subscription`                          |
| `useTrialStatus`          | `billing.ts`    | `GET /billing/trial-status`                          |
| `useUpgrade`              | `billing.ts`    | `POST /billing/upgrade`                              |
| `useUpgradeRequests`      | `billing.ts`    | `GET /billing/upgrade-requests`                      |
| `useUsage`                | `billing.ts`    | `GET /billing/usage`                                 |
| `useWallet`               | `wallet.ts`     | `GET /wallet`                                        |

### `market-seller`

| Hook                         | Hook file        | Method + path                                           |
| ---------------------------- | ---------------- | ------------------------------------------------------- |
| `useCreateSavedView`         | `saved-views.ts` | `POST /saved-views`                                     |
| `useDeleteMarketListing`     | `market.ts`      | `DELETE /market/listings/${id}`                         |
| `useMarketSeller`            | `market.ts`      | `GET /market/seller`                                    |
| `useProducts`                | `products.ts`    | `GET /products`                                         |
| `useRemoveSavedView`         | `saved-views.ts` | `DELETE /saved-views/${id}`                             |
| `useSaveMarketListing`       | `market.ts`      | `PUT /market/listings/${id}`<br>`POST /market/listings` |
| `useSaveMarketSellerProfile` | `market.ts`      | `PUT /market/seller`                                    |
| `useSavedViews`              | `saved-views.ts` | `GET /saved-views`                                      |
| `useUpdateSavedView`         | `saved-views.ts` | `PATCH /saved-views/${id}`                              |

### `analysis`

| Hook                       | Hook file           | Method + path                           |
| -------------------------- | ------------------- | --------------------------------------- |
| `useBreakEven`             | `analysis.ts`       | `GET /analysis/break-even`              |
| `useCohorts`               | `analysis.ts`       | `GET /analysis/cohorts`                 |
| `useCollectionsWorklist`   | `analysis.ts`       | `GET /analysis/collections`             |
| `useCreateSavedView`       | `saved-views.ts`    | `POST /saved-views`                     |
| `usePeerBenchmark`         | `analysis.ts`       | `GET /analysis/benchmark`               |
| `useRemoveSavedView`       | `saved-views.ts`    | `DELETE /saved-views/${id}`             |
| `useReportCatalog`         | `custom-reports.ts` | `GET /custom-reports/catalog`           |
| `useReportDashboards`      | `custom-reports.ts` | `GET /report-dashboards`                |
| `useReportRun`             | `custom-reports.ts` | `GET /custom-reports/${id}/run`         |
| `useRetireReport`          | `custom-reports.ts` | `PATCH /custom-reports/${id}/retire`    |
| `useRetireReportDashboard` | `custom-reports.ts` | `PATCH /report-dashboards/${id}/retire` |
| `useSaveReport`            | `custom-reports.ts` | `POST /custom-reports`                  |
| `useSaveReportDashboard`   | `custom-reports.ts` | `POST /report-dashboards`               |
| `useSavedReports`          | `custom-reports.ts` | `GET /custom-reports`                   |
| `useSavedViews`            | `saved-views.ts`    | `GET /saved-views`                      |
| `useSupplierAnalysis`      | `analysis.ts`       | `GET /analysis/suppliers`               |
| `useUpdateSavedView`       | `saved-views.ts`    | `PATCH /saved-views/${id}`              |
| `useWorkingCapital`        | `analysis.ts`       | `GET /analysis/working-capital`         |

### `onboarding`

| Hook                 | Hook file           | Method + path                |
| -------------------- | ------------------- | ---------------------------- |
| `useCurrencies`      | `currencies.ts`     | `GET /currencies`            |
| `useSetBaseCurrency` | `currency-rates.ts` | `PUT /finance/currency/base` |

### `manufacturing`

| Hook                          | Hook file          | Method + path                                         |
| ----------------------------- | ------------------ | ----------------------------------------------------- |
| `useBOMs`                     | `manufacturing.ts` | `GET /boms`                                           |
| `useBranches`                 | `branches.ts`      | `GET /branches`                                       |
| `useCreateBranch`             | `branches.ts`      | `POST /branches`                                      |
| `useCreateProduct`            | `products.ts`      | `POST /products`                                      |
| `useCreateStorageLocation`    | `warehouse-map.ts` | `POST /warehouses/${target ?? warehouseId}/locations` |
| `useCreateWarehouse`          | `warehouses.ts`    | `POST /warehouses`                                    |
| `useCreateWorkOrder`          | `manufacturing.ts` | `POST /work-orders`                                   |
| `useManufacturingReport`      | `manufacturing.ts` | `GET /manufacturing/report`                           |
| `useMyCapabilities`           | `governance.ts`    | `GET /governance/my-capabilities`                     |
| `useProduce`                  | `manufacturing.ts` | `POST /manufacturing/produce`                         |
| `useProductionDefinition`     | `manufacturing.ts` | `GET /manufacturing/definitions/${productId}`         |
| `useProductionRun`            | `manufacturing.ts` | `GET /manufacturing/runs/${id}`                       |
| `useProductionRuns`           | `manufacturing.ts` | `GET /manufacturing/runs`                             |
| `useProducts`                 | `products.ts`      | `GET /products`                                       |
| `useSaveProductionDefinition` | `manufacturing.ts` | `PUT /manufacturing/definitions`                      |
| `useStockPlacement`           | `warehouses.ts`    | —                                                     |
| `useUnits`                    | `units.ts`         | `GET /units`                                          |
| `useWarehouseMap`             | `warehouse-map.ts` | —                                                     |
| `useWarehouseOverview`        | `warehouses.ts`    | —                                                     |
| `useWorkOrders`               | `manufacturing.ts` | `GET /work-orders`                                    |

### `assistant`

| Hook                        | Hook file             | Method + path                                                                     |
| --------------------------- | --------------------- | --------------------------------------------------------------------------------- |
| `useAiActionRequests`       | `ai-requests.ts`      | `GET /ai-requests`                                                                |
| `useAiAvailability`         | `ai-chat.ts`          | `GET /ai/quota`                                                                   |
| `useAiPipelineSettings`     | `ai-pipeline.ts`      | `GET /ai/pipeline/settings`                                                       |
| `useAnswerAiPipelineRun`    | `ai-pipeline.ts`      | `POST /ai/pipeline/runs/${input.runId}/answers`                                   |
| `useAskAi`                  | `ai-chat.ts`          | `POST /ai/ask`                                                                    |
| `useCancelAiPipelineRun`    | `ai-pipeline.ts`      | `POST /ai/pipeline/runs/${runId}/cancel`                                          |
| `useConfirmDocument`        | `ingest.ts`           | `POST /ingest/confirm`                                                            |
| `useDecideAiActionRequest`  | `ai-requests.ts`      | `POST /ai-requests/${input.id}/approve`<br>`POST /ai-requests/${input.id}/reject` |
| `useReadDocument`           | `ingest.ts`           | `POST /ingest/read`                                                               |
| `useSaveAiPipelineSettings` | `ai-pipeline.ts`      | `PUT /ai/pipeline/settings`                                                       |
| `useStartAiPipelineRun`     | `ai-pipeline.ts`      | `POST /ai/pipeline/runs`                                                          |
| `useSupplierSearch`         | `customer-profile.ts` | `GET /suppliers`                                                                  |
| `useTranslateDocument`      | `ai-chat.ts`          | `POST /ai/translate`                                                              |

### `operations`

| Hook                    | Hook file                 | Method + path                           |
| ----------------------- | ------------------------- | --------------------------------------- |
| `useCashForecast`       | `inventory-operations.ts` | `GET /intelligence/cash-forecast`       |
| `useDeadStock`          | `inventory-operations.ts` | `GET /inventory/dead-stock`             |
| `useReorderSuggestions` | `inventory-operations.ts` | `GET /inventory/reorder-suggestions`    |
| `useShiftHistory`       | `inventory-operations.ts` | `GET /pos/sessions/history`             |
| `useStaleOpportunities` | `inventory-operations.ts` | `GET /intelligence/stale-opportunities` |

### `stock-count`

| Hook                    | Hook file                 | Method + path                            |
| ----------------------- | ------------------------- | ---------------------------------------- |
| `useCancelCycleCount`   | `inventory-operations.ts` | `POST /cycle-counts/${countId}/cancel`   |
| `useCompleteCycleCount` | `inventory-operations.ts` | `POST /cycle-counts/${countId}/complete` |
| `useCreateCycleCount`   | `inventory-operations.ts` | `POST /cycle-counts`                     |
| `useCycleCount`         | `inventory-operations.ts` | `GET /cycle-counts/${countId}`           |
| `useCycleCounts`        | `inventory-operations.ts` | `GET /cycle-counts`                      |
| `useProducts`           | `products.ts`             | `GET /products`                          |
| `useRecordCount`        | `inventory-operations.ts` | `POST /cycle-counts/${countId}/lines`    |
| `useWarehouseDetail`    | `warehouses.ts`           | —                                        |
| `useWarehouseOverview`  | `warehouses.ts`           | —                                        |

### `team-and-payroll`

| Hook                            | Hook file                | Method + path                                          |
| ------------------------------- | ------------------------ | ------------------------------------------------------ |
| `useAcceptHeldDeviceDay`        | `attendance-devices.ts`  | `POST /attendance-devices/held/accept`                 |
| `useAssignProfile`              | `permission-matrix.ts`   | `POST /permissions/profiles/assign`                    |
| `useAssignShift`                | `attendance.ts`          | `POST /shift-assignments`                              |
| `useAttendanceDevices`          | `attendance-devices.ts`  | `GET /attendance-devices`                              |
| `useAttendanceLink`             | `attendance-links.ts`    | `GET /attendance-links`                                |
| `useAttendanceSheet`            | `attendance.ts`          | `GET /attendance-sheet`                                |
| `useAttendanceSubmissions`      | `attendance-links.ts`    | `GET /attendance-submissions`                          |
| `useBranchTree`                 | `branches.ts`            | `GET /branches/tree`                                   |
| `useBranches`                   | `branches.ts`            | `GET /branches`                                        |
| `useCancelShiftAssignment`      | `attendance.ts`          | `POST /shift-assignments/${input.id}/cancel`           |
| `useCreateAttendanceLink`       | `attendance-links.ts`    | `POST /attendance-links`                               |
| `useCreateBranch`               | `branches.ts`            | `POST /branches`                                       |
| `useCreateEmployee`             | `employees.ts`           | `POST /employees`                                      |
| `useCreateMemberDirect`         | `workspace.ts`           | `POST /workspaces/${workspaceId}/members/direct`       |
| `useCreateWorkShift`            | `attendance.ts`          | `POST /shifts`                                         |
| `useDecideAttendanceSubmission` | `attendance-links.ts`    | `POST /attendance-submissions/${input.id}/decision`    |
| `useDeleteEmployee`             | `employees.ts`           | `DELETE /employees/${id}`                              |
| `useDeviceIdentities`           | `attendance-devices.ts`  | `GET /attendance-devices/${deviceId}/identities`       |
| `useEmployees`                  | `employees.ts`           | `GET /employees`                                       |
| `useForgetAttendancePhone`      | `attendance-links.ts`    | `DELETE /attendance-links/phone/${employeeId}`         |
| `useHeldDeviceDays`             | `attendance-devices.ts`  | `GET /attendance-devices/held`                         |
| `useMapDeviceIdentity`          | `attendance-devices.ts`  | `PUT /attendance-devices/${input.deviceId}/identities` |
| `useMarkAttendance`             | `attendance.ts`          | `PUT /attendance-sheet`                                |
| `useMyCapabilities`             | `governance.ts`          | `GET /governance/my-capabilities`                      |
| `usePermissionMatrix`           | `permission-matrix.ts`   | `GET /permissions/matrix`                              |
| `useRegisterAttendanceDevice`   | `attendance-devices.ts`  | `POST /attendance-devices`                             |
| `useRevokeAttendanceDevice`     | `attendance-devices.ts`  | `DELETE /attendance-devices/${deviceId}`               |
| `useRevokeAttendanceLink`       | `attendance-links.ts`    | `DELETE /attendance-links/${input.id}`                 |
| `useSetWorkShiftActive`         | `attendance.ts`          | `PATCH /shifts/${input.id}/active`                     |
| `useShiftPlan`                  | `attendance.ts`          | `GET /shift-assignments`                               |
| `useUnmatchedDeviceUsers`       | `attendance-devices.ts`  | `GET /attendance-devices/${deviceId}/unmatched`        |
| `useWorkShifts`                 | `attendance.ts`          | `GET /shifts`                                          |
| `useWorkplaceTimeZones`         | `workplace-time-zone.ts` | `GET /workplace/time-zone`                             |
| `useWorkspaces`                 | `workspace.ts`           | `GET /workspaces`                                      |

### `team-and-payroll/:id`

| Hook                | Hook file        | Method + path                                    |
| ------------------- | ---------------- | ------------------------------------------------ |
| `useCreateLeave`    | `leaves.ts`      | `POST /leaves`                                   |
| `useCreatePayroll`  | `payroll.ts`     | `POST /payrolls`                                 |
| `useDecideLeave`    | `leaves.ts`      | `PATCH /leaves/${input.id}`                      |
| `useEmployee`       | `employees.ts`   | `GET /employees/${id}`                           |
| `useLeaves`         | `leaves.ts`      | `GET /leaves`                                    |
| `usePayrolls`       | `payroll.ts`     | `GET /payrolls`                                  |
| `useRecordHistory`  | `audit-trail.ts` | `GET /audit/workspace/${entityType}/${entityId}` |
| `useSettlePayroll`  | `payroll.ts`     | `PATCH /payrolls/${values.id}`                   |
| `useUpdateEmployee` | `employees.ts`   | `PATCH /employees/${id}`                         |

### `audit`

| Hook                  | Hook file        | Method + path                            |
| --------------------- | ---------------- | ---------------------------------------- |
| `useAuditTrail`       | `audit-trail.ts` | `GET /audit/workspace`                   |
| `useBranches`         | `branches.ts`    | `GET /branches`                          |
| `useWorkspaceMembers` | `workspace.ts`   | `GET /workspaces/${workspaceId}/members` |

### `till`

| Hook                      | Hook file           | Method + path                                                                         |
| ------------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| `useBaseCurrency`         | `currency-rates.ts` | `GET /finance/currency/base`                                                          |
| `useCashFlow`             | `till.ts`           | `GET /pos/cash-flow`                                                                  |
| `useCloseSession`         | `till.ts`           | `POST /pos/sessions/${sessionId}/close`                                               |
| `useCurrentSession`       | `till.ts`           | `GET /pos/sessions/current`                                                           |
| `useOpenSession`          | `till.ts`           | `POST /pos/sessions`                                                                  |
| `useOpenSessions`         | `till.ts`           | `GET /pos/sessions/open`                                                              |
| `useRecordCashMovement`   | `till.ts`           | `POST /pos/sessions/${sessionId}/cash`                                                |
| `useRecordOpeningCapital` | `till.ts`           | `POST /pos/opening-capital`                                                           |
| `useRemoveTill`           | `till.ts`           | `DELETE /pos/sessions/${sessionId}`                                                   |
| `useSession`              | `till.ts`           | `GET /pos/sessions/${sessionId}`                                                      |
| `useSessionLedger`        | `till.ts`           | `GET /pos/sessions/${sessionId}/ledger`                                               |
| `useSetTillLabel`         | `till.ts`           | `PATCH /pos/sessions/${sessionId}/label`                                              |
| `useSetTillSuspended`     | `till.ts`           | `POST /pos/sessions/${sessionId}/suspend`<br>`POST /pos/sessions/${sessionId}/resume` |
| `useTillLabels`           | `till.ts`           | `GET /pos/sessions/labels`                                                            |

### `data-and-sync`

| Hook                 | Hook file          | Method + path                                                    |
| -------------------- | ------------------ | ---------------------------------------------------------------- |
| `useConflicts`       | `conflicts.ts`     | `GET /conflicts`                                                 |
| `useDuplicateCounts` | `sync-overview.ts` | —                                                                |
| `useMigrations`      | `migrations.ts`    | `GET /migrations`                                                |
| `useMyCapabilities`  | `governance.ts`    | `GET /governance/my-capabilities`                                |
| `useSyncOverview`    | `sync-overview.ts` | `GET /sync/overview`<br>`GET /intelligence/duplicates/${entity}` |

### `governance`

| Hook                        | Hook file              | Method + path                                       |
| --------------------------- | ---------------------- | --------------------------------------------------- |
| `useCreateCustomRole`       | `permission-matrix.ts` | `POST /permissions/roles`                           |
| `useDeleteCustomRole`       | `permission-matrix.ts` | `DELETE /permissions/roles/${roleId}`               |
| `usePerformWorkflowAction`  | `use-workflow.ts`      | `POST /v1/workflows/instances/${instanceId}/action` |
| `usePermissionMatrix`       | `permission-matrix.ts` | `GET /permissions/matrix`                           |
| `useRoleMembers`            | `permission-matrix.ts` | `GET /permissions/roles/${roleId}/members`          |
| `useSetPermissionCell`      | `permission-matrix.ts` | `PUT /permissions/matrix/cell`                      |
| `useWorkflow`               | `use-workflow.ts`      | `GET /v1/workflows/${id}`                           |
| `useWorkflowInstanceDetail` | `use-workflow.ts`      | `GET /v1/workflows/instances/${id}`                 |
| `useWorkflowInstances`      | `use-workflow.ts`      | `GET /v1/workflows/instances`                       |
| `useWorkflows`              | `use-workflow.ts`      | `GET /v1/workflows`                                 |

### `public-task/:token`

| Hook                     | Hook file | Method + path                                          |
| ------------------------ | --------- | ------------------------------------------------------ |
| _(direct call, no hook)_ | —         | `GET(baseUrl) /public/tasks/${token}`                  |
| _(direct call, no hook)_ | —         | `GET(baseUrl) /public/tasks/${token}/customer-outcome` |
| _(direct call, no hook)_ | —         | `GET(baseUrl) /public/tasks/${token}/status`           |

### `public-invoice/:token`

| Hook                     | Hook file | Method + path                            |
| ------------------------ | --------- | ---------------------------------------- |
| _(direct call, no hook)_ | —         | `GET(baseUrl) /public/invoices/${token}` |

### `portal/:token`

| Hook                     | Hook file | Method + path                          |
| ------------------------ | --------- | -------------------------------------- |
| _(direct call, no hook)_ | —         | `GET(baseUrl) /public/portal/${token}` |

### `my-attendance/:token`

| Hook                     | Hook file | Method + path                                    |
| ------------------------ | --------- | ------------------------------------------------ |
| _(direct call, no hook)_ | —         | `GET(baseUrl) /public/attendance/${token}`       |
| _(direct call, no hook)_ | —         | `GET(baseUrl) /public/attendance/${token}/phone` |

### `sync-center`

This page is **shell-owned** (`packages/app-shell/src/features/sync/sync-page.tsx`), not a shared
container, so it mounts no `@hisabche/api` hook. Its data path is the device bridge plus the sync
engine:

| Call                                                                                                     | Where                                                         | Purpose                                                            |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `bridge().db.queue()`                                                                                    | `features/sync/use-sync.ts:18`                                | the pending queue, polled every 5 s                                |
| `bridge().db.resolveQueue(clientId, 'done' \| 'failed', error?)`                                         | `sync-engine.ts:582,601`                                      | mark an entry sent or failed                                       |
| `GET /sync/cursor`                                                                                       | `sync-engine.ts:313`                                          | the change-log head before a rebuild                               |
| `GET /sync/snapshot?entity=&limit=&after=`                                                               | `sync-engine.ts:293`                                          | full rebuild, three entities, keyset-paged                         |
| `GET /sync/pull?cursor=&limit=`                                                                          | `sync-engine.ts:385`                                          | incremental change log                                             |
| `POST /sync/push`                                                                                        | `sync-engine.ts:521`                                          | one versioned mutation, `expectedVersion` included                 |
| `POST /invoices` / `PATCH /invoices/:id` / `DELETE /invoices/:id`                                        | `sync-engine.ts:475-483`                                      | a queued invoice goes through the domain route, not the row writer |
| `POST /customers`, `PATCH /customers/:id`, `POST /products`, `PATCH /products/:id`, `POST /transactions` | `sync-engine.ts:439-444`                                      | queued rows for the non-financial entities                         |
| `WS /api/sync/stream`                                                                                    | `sync-engine.ts:424` via `packages/sync/src/stream-client.ts` | wake-up only; carries no data                                      |
| `POST /sync/lease` / `DELETE /sync/lease`                                                                | `backend/src/routes/sync.routes.ts`                           | single-writer lease (not called from this page)                    |

The page also renders the outbox stage (`outbox-stage.ts`) from in-memory state, so «sending» is only
true while this process sends.

---

**Counted:** 34 appendix sections = 29 pages that mount at least one hook + the 4 public
token pages (which call `fetch()` directly and mount no hook) + the shell-owned `sync-center`.
The remaining rendered page, `/login`, calls `POST /auth/login|refresh|validate|logout`
directly and has no section here; it is row 1 of §3.
443 hook rows, 311 distinct hook names, 308 distinct page method+path strings, plus the
shell-owned `sync-center` bridge path above (15 distinct sync endpoints, 2 shared with a page).
