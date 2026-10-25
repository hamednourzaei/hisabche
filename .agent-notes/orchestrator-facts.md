# Orchestrator fact sheet — verified against code (25 Oct 2026)

Used only to audit the two sales documents. Every line names its proof.

## Platforms actually built

| Platform      | Proof                                                                                                                                         | Status               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Web (browser) | `apps/web` Next.js app, 66 pages under `app/[lang]`                                                                                           | shipped              |
| Windows       | `apps/desktop`, Electron; `docs/offline/ALWAYS-LOCAL-RUN-LOG.md` records `dist/Hisabche-0.0.1-setup.exe` (78,706,352 bytes) built 21 Oct 2026 | shipped              |
| Android       | `apps/mobile`, Expo; same run log records `app-release.apk` (106,213,783 bytes)                                                               | shipped              |
| iOS           | `apps/mobile/eas.json` / app.json only; no iOS artifact in the run log                                                                        | UNCLEAR / not proven |

## Offline — the exact shape (do not generalise)

- Browser has **no** offline write queue: `packages/api/src/lib/offline-queue.ts` header says
  "The browser has no such queue".
- Windows/Android queue **only** invoice creation: `OfflineQueue.enqueue` accepts
  `entity: 'invoice'`, `operation: 'create'` only; the only caller is
  `packages/api/src/hooks/invoices.ts:253`.
- Device can read products, customers, invoices, warehouses, branches, rates, stock:
  `packages/app-shell/src/features/sync/sync-engine.ts` (`DELTA_ENTITIES`) and
  `docs/offline/ALWAYS-LOCAL-DECISIONS.md` A11/A12.
- Ledger and payments are **not** replicated to the device on purpose:
  `docs/offline/ALWAYS-LOCAL-DECISIONS.md` C4.
- Separate **offline edition**: local-only, licence code required,
  `packages/app-shell/src/features/auth/offline-licence-screen.tsx`, plan `OFFLINE` in
  `packages/validation/src/schemas/feature-registry.ts`.
- Plan registry marks execution per feature (`local` / `server` / `hybrid`) — the authoritative
  "works offline?" table.

## Plans and trial

- Plans: `FREE`, `OFFLINE`, `ONLINE_500`, `ONLINE_1000`, `ONLINE_1500`
  (`packages/validation/src/schemas/feature-registry.ts`).
- Prices exist in a code comment only; the landing page reads live prices from
  `GET /api/billing/plans` (`packages/ui/src/components/ui/landing/pricing-scene.tsx`).
  **No price may be written in the sales docs.**
- Free plan defaults: 50 lifetime invoices, 1 user, 20 AI/month
  (`backend/src/services/plan-limit-defaults.ts`) — configurable by admin
  (`docs/plan-limits-migration.sql`). Describe as a ceiling, not a promise of a number.
- Trial: `TRIAL_DAYS = 7` (`backend/src/services/billing.service.ts:126`); status endpoint
  `GET /billing/subscription` returns `trial` (`backend/src/routes/billing.routes.ts:119`).
- Signup asks name, business name, email, password — no card step found in
  `packages/ui/src/components/ui/auth/AuthShell.tsx` (`SignupForm`). "No card" is
  therefore _likely_ true but should be phrased as "ثبت‌نام رایگان" unless proven end-to-end.

## Core capabilities (screen + route)

| Capability                                 | Screen                                                  | Route/service                                                                                         |
| ------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Invoices, sale/purchase                    | `apps/web/.../invoices/*`, app-shell `features/sales/*` | `backend/src/routes/invoice.routes.ts`, `services/invoice.service.ts`                                 |
| Payments + allocation                      | `till`, invoice detail                                  | `payments.routes.ts`, `services/payments/payments.domain.ts`                                          |
| Cash drawer / POS                          | `till`                                                  | `pos.routes.ts`, `services/pos/pos.service.ts`                                                        |
| Stock, warehouses, transfer                | `warehouse`, `operations`                               | `warehouse.routes.ts`, `services/warehouse.service.ts`                                                |
| Stock count                                | `stock-count`                                           | `cycle-count.routes.ts`                                                                               |
| FIFO/AVCO costing                          | product/invoice                                         | `services/inventory-costing/costing.domain.ts`                                                        |
| Double-entry, trial balance, balance sheet | `accounting`                                            | `accounting.routes.ts`, `services/accounting/accounting.reports.ts`                                   |
| Profit per invoice, unknown ≠ zero         | invoice/reports                                         | `services/accounting/profit-report.domain.ts`                                                         |
| Month-end close                            | `accounting`                                            | `services/accounting/month-end.domain.ts`                                                             |
| Installments, late fees                    | invoice/customer                                        | `installments.routes.ts`, `late-fees.routes.ts`                                                       |
| Multi-currency + XAU/XAG gram              | invoice/settings                                        | `packages/validation/src/schemas/common.schema.ts:130`, `:218` (`gram`)                               |
| Manufacturing (BOM, work orders)           | `manufacturing`                                         | `manufacturing.routes.ts`                                                                             |
| Payroll, attendance, shifts, leaves        | `team-and-payroll`                                      | `human-resources.routes.ts`, `attendance.routes.ts`                                                   |
| Roles owner/manager/seller                 | `governance`                                            | `services/authorization/authorization.domain.ts:36`                                                   |
| Audit trail                                | `audit`                                                 | `audit.routes.ts`, `services/audit.service.ts`                                                        |
| Backup file + CSV export                   | `settings`, `data-and-sync`                             | `packages/ui/src/components/ui/settings/settings-page.tsx:565+`, `backend/src/routes/audit.routes.ts` |
| AI assistant (quota)                       | `assistant`                                             | `ai.routes.ts`, `services/ai/ai-quota.service.ts`                                                     |
| Customer portal / public invoice link      | public pages                                            | `invoice-public.routes.ts`, `customer-portal.routes.ts`                                               |
| Marketplace / storefront                   | `marketplace`, `market-seller`                          | `marketplace.routes.ts`, `storefront.routes.ts`                                                       |
| Barcode scan (mobile)                      | mobile host                                             | `apps/mobile/src/host/camera-scan.ts`                                                                 |
| Receipt printing (Windows)                 | till/invoice                                            | `apps/desktop/electron/main/services/printing.ts` (`printEscPos`, `printHtml`)                        |
| Branches                                   | settings/branch                                         | `branch.routes.ts`                                                                                    |
| Analysis (who owes, break-even)            | `analysis`                                              | `analysis.routes.ts`, `services/analytics/break-even.domain.ts`                                       |

## Known limits to state honestly

- Offline: invoice creation + device reads only; payments/ledger need the server.
- Offline edition: one user, no AI (`plan-limit-defaults.ts` OFFLINE: users 1, aiMonthly 0),
  licence code from support.
- Manufacturing, marketplace, storefront, AI, bank import, developer keys: cloud only
  (`feature-registry.ts`).
- Plan ceilings are configurable; do not print numbers as fixed.
- iOS not proven.
- No claim of encryption, certification, uptime or data residency — nothing in the repo
  states it in customer terms.
