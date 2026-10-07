# Continuation Index

## Autonomous Campaign Continuation
- Blocker Investigated: `ERROR: 42P01: relation "human_resources" does not exist`
- Root Cause Identified: The database schema does NOT have and should NOT have a table named `human_resources`. The Human Resources domain is implemented through normalized relational tables: `departments`, `employees`, `attendance`, `payrolls`, and `leaves`. Any query executing against `human_resources` was querying a non-existent monolithic table name.
- Database Infrastructure Verified: `embedded-postgres` (PostgreSQL 17.10) runs locally on Windows without issues.
- Real Postgres Integration Tests Executed:
  - `attendance.pg.test.ts` (3 passed)
  - `workspace-access.pg.test.ts` (5 passed)
  - `invoice-write-document.pg.test.ts` (20 passed)
  - `stock-transfer-keyed.pg.test.ts` (7 passed)
  - Total DB-backed tests executed: **35**, 100% PASS.
- Key Properties Verified at the Database Layer:
  - Multi-tenant write isolation (cross-workspace invoice mutation rejected with P0002 / INVOICE_NOT_FOUND)
  - Optimistic concurrency locking (stale invoice edit rejected with 40001 INVOICE_VERSION_CONFLICT)
  - Finalization locking (finalized invoice locked against line edits with 55000 INVOICE_FINALIZED)
  - Transaction atomicity (malformed document lines trigger full rollback)
  - Keyed submit idempotency (replay attacks blocked with 23505 duplicate key)
  - Warehouse stock transfer isolation & validation (insufficient stock rejected, transfer ID conflicts prevented)
