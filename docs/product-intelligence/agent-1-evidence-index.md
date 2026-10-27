# Hisabche Product Intelligence Evidence Index

Audit Date: 2026-10-26
Auditor: Agent 1
Index Scope: Concrete file citations, symbols, routes, and tests backing every audited product capability.

---

## 1. Multi-Tenancy, Setup & Governance (CAP-01, CAP-02)

- Backend Service: backend/src/services/workspace.service.ts (WorkspaceService), backend/src/services/tenancy.service.ts (TenancyService)
- API Routes: backend/src/routes/workspace.routes.ts, backend/src/routes/branch.routes.ts, backend/src/routes/permission.routes.ts
- Database Migrations: docs/workspace-role-capabilities-migration.sql, docs/workspace-members-rls-migration.sql, docs/branch-migration.sql
- UI Hubs: packages/ui/src/components/ui/workspace/, packages/ui/src/components/ui/branch/, packages/ui/src/components/ui/permissions/
- Verification Tests: backend/src/**tests**/workspace.pg.test.ts, backend/src/**tests**/admin-02-security.pg.test.ts

---

## 2. Invoicing, POS & Sales Engine (CAP-05, CAP-06)

- Backend Service: backend/src/services/invoice.service.ts (InvoiceService), backend/src/services/pos/
- API Routes: backend/src/routes/invoice.routes.ts, backend/src/routes/pos.routes.ts, backend/src/routes/invoice-return.routes.ts
- Local Engine Routes: packages/local-engine/src/routes/invoices.ts, packages/local-engine/src/routes/till.ts
- Database Tables: invoices, invoice_items, pos_sessions, pos_orders, pos_cash_movements
- UI Containers: packages/ui/src/components/ui/invoices/containers/invoices-container.tsx, packages/ui/src/components/ui/till/containers/till-container.tsx
- Verification Tests: backend/src/**tests**/reversal-ledger.test.ts, packages/local-engine/src/**tests**/invoices.test.ts

---

## 3. Costing, Inventory & Warehouses (CAP-04, CAP-08, CAP-09, CAP-10)

- Costing Services: backend/src/services/inventory-costing/fifo-avco.domain.ts, backend/src/services/warehouse.service.ts
- API Routes: backend/src/routes/inventory-costing.routes.ts, backend/src/routes/warehouse.routes.ts, backend/src/routes/product.routes.ts
- Local Engine Costing: packages/local-engine/src/routes/costing.ts, packages/local-engine/src/routes/cost-layers.ts
- Database Migrations: docs/accounting-core-migration.sql, docs/cycle-count-migration.sql
- UI Containers: packages/ui/src/components/ui/warehouse/containers/Warehouse-container.tsx, warehouse-tabs-container.tsx
- Verification Tests: backend/src/**tests**/cost-unknown-is-not-zero.test.ts, packages/ui/src/**tests**/warehouse-hub.test.tsx

---

## 4. Accounting, Double-Entry Ledger & Multi-Currency (CAP-11, CAP-12)

- Backend Service: backend/src/services/accounting/accounting.service.ts, backend/src/services/currency/
- Domain Logic: backend/src/services/accounting/profit-report.domain.ts, backend/src/services/accounting/invoice-posting.domain.ts
- API Routes: backend/src/routes/accounting.routes.ts, backend/src/routes/currencies.routes.ts, backend/src/routes/metal-rates.routes.ts
- UI Tabs: packages/ui/src/components/ui/accounting/tabs/JournalTab.tsx, BalanceSheetTab.tsx, IncomeStatementTab.tsx
- Verification Tests: backend/src/**tests**/reversal-ledger.test.ts, packages/ui/src/**tests**/no-hardcoded-currency.test.ts

---

## 5. Offline Engine, Sync Protocol & Local SQLite (CAP-15, CAP-20)

- Local Engine Router: packages/local-engine/src/router.ts (handles 38 local domain endpoints)
- Local SQLite Schemas: packages/app-bridge/src/local-schema.ts (35 tables), local-sales-schema.ts (10 tables), local-books-schema.ts (3 tables), local-universal-core-schema.ts (8 tables)
- Client Sync Engine: packages/app-shell/src/features/sync/sync-engine.ts, use-sync.ts
- Backend Sync Routes: backend/src/routes/sync.routes.ts, backend/src/routes/sync-stream.routes.ts
- Verification Tests: packages/local-engine/src/**tests**/router.test.ts, packages/sync/src/**tests**/stream-client.test.ts

---

## 6. Manufacturing, HR, Automation & Platform (CAP-13, CAP-14, CAP-17, CAP-18, CAP-21, CAP-22)

- Manufacturing: backend/src/services/manufacturing.service.ts, packages/ui/src/components/ui/manufacturing/containers/manufacturing-container.tsx
- HR & Payroll: backend/src/services/human-resources.service.ts, attendance.routes.ts, team-and-payroll/
- Automation & Approvals: backend/src/services/workflow/, backend/src/services/automation/, approvals-container.tsx
- Developer & MCP: backend/src/routes/developer.routes.ts, mcp.routes.ts, odata.routes.ts
- Audit & Reliability: backend/src/services/audit.service.ts, core-divergence.service.ts, core-divergence-alarm.service.ts
- Verification Tests: backend/src/**tests**/manufacturing.test.ts, attendance-02.pg.test.ts, core-divergence.pg.test.ts
