### FEATURE: Workspace Tenancy
WHERE: backend/src/services/tenancy.service.ts & PL/pgSQL
DOES: Isolates data, roles, and mutations strictly per workspace
TEST GAP: Production cloud database verification

### FEATURE: Invoices & Documents
WHERE: backend/src/routes/invoice.routes.ts & invoice_write_document PL/pgSQL
DOES: Enforces atomic document creation, locking, and optimistic versioning
TEST GAP: Browser E2E UI automation

### FEATURE: Accounting & Ledgers
WHERE: backend/src/services/accounting.service.ts
DOES: Enforces double-entry balances and transaction boundaries
TEST GAP: Deep integration with automated tax reporting

### FEATURE: Offline Sync
WHERE: packages/sync & backend/src/routes/sync.routes.ts
DOES: Manages outbox queue, wire codec, and server concurrency checks
TEST GAP: Real mobile hardware sync test

### FEATURE: Inventory & Warehouses
WHERE: backend/src/services/inventory.service.ts & PL/pgSQL
DOES: Validates stock transfers, prevents negative balances, scopes to workspace
TEST GAP: Automated batch tracking lifecycle

### FEATURE: Human Resources & Payroll
WHERE: backend/src/services/human-resources.service.ts
DOES: Manages departments, employees, attendance, and payroll records
TEST GAP: End-to-end tax deduction workflow
