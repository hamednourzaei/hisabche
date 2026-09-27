# Hisabche — Product Documentation

## Product Vision

Hisabche is an accounting and business-management platform for small and
medium businesses (SMBs). It replaces paper ledgers and mental math with
structured records for sales, purchases, inventory, customers, and suppliers.
The core promise: **the business ledger, available offline and across
devices** — a shop owner can sell, invoice, and track stock even when the
internet is down, and everything reconciles once connectivity returns.

Hisabche is **offline-first**: every supported platform keeps a local
database and queues writes when offline, then syncs to the shared cloud
backend. None of the platforms require a persistent connection to do daily
work.

Product principles:

- **Offline-first** — local DB is the primary store; network sync is the merge.
- **Simple enough for one merchant, strong enough for a team** — roles, permissions
  and approval workflows for multi-user companies.
- **Multi-currency, local-first** — default currency is `AFN` (Afghan afghani);
  exchange rates are a first-class table.
- **Multi-platform from one codebase** — shared UI, store, validation, auth,
  API and DB packages are consumed by web, desktop, and mobile clients.

## Problem It Solves

- Paper-ledger merchants lose product stock and customer debt history.
- Existing tools require a permanent internet connection, which retail in
  Afghanistan and similar markets cannot rely on.
- Excel/paper workflows don't enforce accounting rules: totals drift, stock
  goes negative, unpaid invoices are forgotten.
- Multi-store owners cannot see one truth across locations or devices,
  and cannot control what a cashier is allowed to do.
- Owners need receipts (paper / PDF) and follow-up on who owes what.

## Target Users

- Retail shop owners and cashiers (primary).
- Wholesale/trade businesses that buy from suppliers and sell to customers
  (credit and partial payments).
- Small companies with a team that needs role-based permissions and invoice
  approval workflows.

## Merchidentifier Personas

1. **Owner / Manager** — full control (`owner` role). Owns the business,
   sees reports, manages permissions, benefits, and approvals.
2. **Cashier** — records sales quickly. Can create invoices (`record.create`),
   but cannot delete them (`record.delete` requires `owner`).
3. **Bookkeeper / Admin** — `admin`. Can invite members, manage customers,
   products, and reconcile transactions.
4. **Viewer / Auditor** — `viewer` can only read records.

## Supported Platforms

| Platform        | Stack                                       | Status                           |
| --------------- | ------------------------------------------- | -------------------------------- |
| Web             | Next.js 16 (App Router) — `apps/web`        | Production                       |
| Windows Desktop | Electron 31 + React (Vite) — `apps/desktop` | Production / currently hardening |
| iOS             | Expo (React Native) — `apps/mobile`         | In development                   |
| Android         | Expo (React Native) — `apps/mobile`         | In development                   |

## Core Modules

### Accounting

Invoices (sale/purchase), transactions, receipts and payments. The full
accounting features are served by the backend (`accounting.routes.ts`,
`invoice.routes.ts`, `transaction.routes.ts`).

### Inventory

Products (with `sku`, `barcode`, category, buy/sell/wholesale prices, stock
levels) and `inventory_movement` ledger (each stock change is a movement
row). Warehouse management exists on the backend and web (`warehouse.routes.ts`).

### Customers

A `customers` table with phone/email/address, opening balance, and a
workspace-scoped relation.

### Suppliers

Suppliers drive purchase invoices (`invoices.type = 'purchase'` via
`supplier_id`) and purchasing workflows (`purchasing.routes.ts`).

### Invoices

Sale and purchase invoices with line items (`invoice_items`), taxes,
discounts, partial payments, and PDF export. Invoices can also be shared via
a public link (`public-invoice/[token]`).

### Reports / Analytics

Aggregated dashboards and analytics exposed by `analytics.routes.ts`;
per-route HTTP caching via `cache.middleware.ts`.

### Permissions

Role-based ACL across all platforms. Roles: `owner > admin > member > viewer`.
Capabilities: `record.read`, `record.create`, `record.update`, `record.delete`,
`member.invite`, `workspace.manage`. Shared contract in
`packages/auth-core/src/permissions.ts`.

### Offline Mode

Desktop and mobile keep a local store — SQLite through `better-sqlite3`
(`apps/desktop/electron/main/db/schema.ts`) and `expo-sqlite`
(`apps/mobile/src/host/local-db.ts`). Web works online through the API. Sync via `/api/sync/pull`
and `/api/sync/push` on the backend, or an Electron `sync_queue` for
Local writes that are pushed in a queue.

## Workflow & Approval Engine (extra feature)

A first-class approval engine is bolted on top of the base modules:

- `workflows` — approval template per `workspace` + `entity_type`.
- `workflow_steps` — ordered steps with a per-step role or user.
- `workflow_instances` — one live approval, tracking current/total step.
- `workflow_actions` — per-step decisions (`approved/rejected/forwarded/cancelled`).

Web screens: `approvals`, `workflow-templates`. Mobile backer: same API.

## Current Implemented Features

- Auth (email/password, password reset, invite accept) via Supabase.
- Multi-workspace + role-based permissions.
- Multi-language — Persian (`fa`), Afghan Persian/Dari terrain, English (`en`),
  possibly more (RTL support).
- Invoices (sale/purchase), line items, discounts, taxes, partial payments.
- Products + inventory movements, min-stock level, search.
- Customers + CRM + sales-follow-up (`sales-followup` route).
- Transactions (sale, purchase, payment, receipt, return).
- Printing: `webkitPrint` in renderer; ESC/POS via `printing.ts` on desktop.
- Public invoice sharing; public task sharing.
- PDF export via `@react-pdf/renderer` (backend + web), `jspdf`/`html2canvas`,
  `html2canvas`.
- Billing (usage/billing routes), notifications, activity logs, audit trails.
- HR, payroll, projects, manufacturing, purchasing, warehouses (modules in backend).
- Sync queue + status UI on web (`sync-center`), desktop offline queue, cloud sync.

## Planned / In this progress

- Detailed financial reports (profitability per product/customer).
- Barcode scan / camera capture on mobile (expo-camera is a dependency).
- Biometric auth on mobile (expo-local-authentication dependency).
- Push notifications (expo-notifications dependency).
- A shared product "direction/plan" lives in `docs/` — see
  `docs/BUSINESS_OS_RESTRUCTURING_ROADMAP.md`, `docs/PRODUCT_FEATURE_MATRIX.md`
  for the full roadmap the product team is following.

> Note: on the monorepo at the time of writing, the mobile app is the least
> started product platform — many mobile features exist only as shared
> packages/stubs.

## Business Logic Overview

1. **Invoice totals** — `total = subtotal − discount_total + tax_total`.
   Line item `total_price = unit_price × quantity − discount`.
2. **Stock** — every inventory change is a `inventory_movement`; product
   `quantity` is the running balance. Stock decreases on `sale`, increases on
   `purchase`/returns.
3. **Payments debt** — `transactions` record `payment`/`receipt` for debts;
   `invoices.paid_amount` trails against `total`.
4. **Currency** — amounts stored as `numeric(12,2)`; `AFN` default. Fixed-rate
   `exchangeRates` table enables conversion.
5. **Approvals** — an entity (invoice, purchase…) can start a `workflow_instance`;
   instance advances through `workflow_steps` as `workflow_actions` are approved;
   final step approvals drive the entity.
6. **Multi-tenancy** — nearly every row is `workspace_id`-constrained; every
   operation from the API filters by workspace. Users are members of a
   workspace via the workspace membership (web `team` page).
7. **Offline-first** — client writes land in the local DB first, a queue
   persists with retries; a worker pushes to `/api/sync/push` and the
   `/api/sync/pull` returns rows changed since the last cursor.
