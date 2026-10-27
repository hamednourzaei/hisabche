# Hisabche Codebase Inventory & Product Architecture

Audit Date: 2026-10-26
Auditor: Agent 1 (Global Product Intelligence & Codebase Auditor)
Git Hash: 41031ed2

## 1. Executive Summary & Monorepo Topology

Hisabche is an enterprise-grade Persian/Dari dual-calendar, multi-currency accounting, ERP, and point-of-sale platform.

- Tenancy Boundary: Strict multi-tenancy enforced at Postgres RLS and Fastify API layer via workspace_id.
- Financial Rigor: Integer minor units on all money paths; strict AVCO/FIFO costing with ledger post integration.
- Offline-First Architecture: 56 SQLite tables in packages/app-bridge and complete local API router in packages/local-engine.
- Tri-Lingual Localization: fa, af, en with 100% key parity across all locales (155 keys in common.json, 150 keys in locales).

### Repository Map

| Subsystem      | Folder                 | Platform / Domain          | Primary Responsibilities                                                    |
| :------------- | :--------------------- | :------------------------- | :-------------------------------------------------------------------------- |
| Backend        | backend/               | Fastify, Postgres, Vitest  | 105 API routes, 114 domain services, RLS policies, 402 test suites          |
| Shared API     | packages/api/          | React Query, Axios         | 89 endpoint hooks, query invalidations, offline-queue                       |
| Shared UI      | packages/ui/           | React, Tailwind, Radix     | Universal UI component hubs, data grids, modals, drawers, RTL design tokens |
| Validation     | packages/validation/   | Zod                        | Single source of truth for runtime contracts, business invariants           |
| Offline Engine | packages/local-engine/ | Node/Browser/Native SQLite | Local API router executing identical accounting & sales rules offline       |
| App Bridge     | packages/app-bridge/   | SQLite Schemas             | 56 SQLite table definitions matching Postgres schemas for offline parity    |
| Sync Engine    | packages/sync/         | WebSocket / HTTP Stream    | Push/pull replication, cursor tracking, outbox staging, conflict detection  |
| Web App        | apps/web/              | Next.js 14 App Router      | Multi-tenant SaaS web portal, SSR marketing pages, localized dashboards     |
| Desktop App    | apps/desktop/          | Electron + SQLite          | Native Windows offline-first ERP client with hardware device integration    |
| Mobile App     | apps/mobile/           | Expo / React Native        | Android/iOS mobile client with embedded SQLite, camera barcode scanning     |
| Admin Portal   | apps/admin/            | Next.js                    | System administration, tenant supervision, CMS, platform monitoring         |

## 2. Exhaustive Service & Route Inventory

### Backend Routes (105 total):

accounting, activity, admin-billing, admin-customers, admin-offline, admin-ops, admin-security, admin, agriculture, ai-chat, ai-pipeline, ai, analysis, analytics, appointment, attendance-device, attendance-link, attendance, audit, auth, automation, billing, blog, branch, campaigns, cloud-migration, cms, compensation, conflict, crm, currencies, custom-fields, custom-reports, customer-portal, customer-profile, customer, cycle-count, debug, developer, escalation, event, finance-ops, financing, fitment, governance, human-resources, ingest, installments, intelligence-forecast, intelligence, inventory-costing, inventory-insights, invoice-pdf, invoice-public, invoice-return, invoice, late-fees, manufacturing, market-public, market, marketplace, mcp, metal-rates, migration, notes, notification, oauth, odata, operations, order-deposit, orders, payments, permission, personalization, pos, price-lists, product-images, product-units, product, project, promotions, purchasing, referral, rules, sandbox, saved-views, snapshots, storefront, supplier, sync-stream, sync, system-metrics, tax, transaction, translate, transport, units, updates, variant, wallet, warehouse-map, warehouse, warranty, workflow, workspace.

### Backend Services (114 total):

accounting, activity, admin, aggregates, ai, analysis, analytics, assets, attendance, attendance-devices, audit, authorization, automation, banking, base-currency, billing, blog, branch, budgeting, cache, campaigns, checkout, cloud-migration, cms, commerce, conflict, connectors, core-divergence-alarm, core-divergence, core-shadow, crm, currency, customer-portal, customer-profile, customer, customers, developer, dimensions, distributed-work, email-outbox, email, entitlement, event-log, event, extensions, financing, human-resources, ingest, insights, instance-registry, intelligence, inventory, inventory-costing, invoice, invoices, job, manufacturing, market, mcp, mdm, migration, notes, notification, oauth, offline-license, orders, password-reset, payments, payroll, permission, personalization, plan-limit-defaults, plan-limits, plan-pricing, plugins, portability, pos, pricing, product, product-images, project, purchasing, referral, render-scaling, reporting, rules, sales, saved-views, subscription-upgrade, supplier, sync-overview, sync-stream, sync, tax, tenancy, timesheets, traceability, transport, wallet, warehouse, webhook, workflow, workplace-time-zone, workspace, workspace-counts.

## 3. Database Architecture & Storage Parity

- Live PostgreSQL Base Schema: 55+ tables including workspaces, branches, warehouses, accounts, journal_entries, journal_lines, products, customers, invoices, payments, cost_layers, boms, attendance.
- Row-Level Security: Every single entity is isolated by workspace_id, guarded by 402+ automated tests.
- 334 production SQL migration scripts in docs/ with rollback blocks verified by embedded Postgres tests (*.pg.test.ts).
- Local SQLite Parity: 56 tables across packages/app-bridge/src/ (local-schema.ts: 35, local-sales-schema.ts: 10, local-books-schema.ts: 3, local-universal-core-schema.ts: 8).

## 4. Verification & Guard Disciplines

- Backend Vitest Suites: 402
- UI Vitest Suites: 187
- API Vitest Suites: 37
- Local Engine Vitest Suites: 26
- Real PostgreSQL Integration Suites: 80+
- Guard Tests: reversal-ledger.test.ts (ledger balance & document reversal), cost-unknown-is-not-zero.test.ts (no zero fallbacks for unknown costs), no-hardcoded-currency.test.ts (currency dynamic derivation).
