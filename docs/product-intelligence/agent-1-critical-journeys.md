# Hisabche Critical User Journeys End-to-End Audit

Audit Date: 2026-10-26
Auditor: Agent 1
Scope: Step-by-step verification of data integrity, ledger balances, costing mechanics, and recovery pipelines across 6 mission-critical enterprise workflows.

---

## Journey 1: Sign-Up/Setup -> Product Creation -> Sale -> Payment -> Financial Reporting

### Flow Specification

1. Workspace Provisioning: User completes signup; workspace created via WorkspaceService.create with chosen base currency (AFN or USD). Default Chart of Accounts is seeded via accounting-core-migration.sql.
2. Product Definition: Product created with unit prices and costing method (FIFO or AVCO). Stored in products table.
3. Sales Order & Invoicing: Cashier creates sale via InvoiceService.create. Line items validated with Zod. Document posted via ledger.port.ts and invoice-posting.domain.ts.
4. Ledger Integration: Automated journal entry generated:
   - Debit: Accounts Receivable (or Cash if immediate settlement)
   - Credit: Sales Revenue
   - Debit: Cost of Goods Sold (COGS derived from cost layers)
   - Credit: Inventory Asset Account
5. Payment Settlement: Payment recorded via PaymentService.create and allocated against invoice. Debit Cash/Bank, Credit Accounts Receivable.
6. Reporting: Balance Sheet (BalanceSheetTab.tsx) and Income Statement reflect real-time figures without page reload via React Query invalidation.

### Codebase Evidence

- Backend Service: backend/src/services/invoice.service.ts & backend/src/services/accounting/invoice-posting.domain.ts
- UI Container: packages/ui/src/components/ui/invoices/containers/invoices-container.tsx
- Guard Verification: Integer minor units enforced; zero-cost prevention verified in backend/src/**tests**/cost-unknown-is-not-zero.test.ts.

---

## Journey 2: Procurement -> Stock Receipt -> Inventory Costing -> Sale

### Flow Specification

1. Purchase Order Execution: Purchase order issued to supplier via PurchasingService.create.
2. Goods Receipt: Stock arrives at warehouse; CostLayerService.createLayer records received quantity and unit buy price into cost_layers.
3. Moving Average (AVCO) / FIFO Calculation: Costing engine (backend/src/services/inventory-costing/fifo-avco.domain.ts) updates weighted average cost or enqueues FIFO layer.
4. Subsequent Sale Depletion: Invoicing calls consumeCostLayers. Oldest layer depleted first (FIFO) or AVCO rate applied. Realized gross margin calculated as (Sale Price - Layer Cost).
5. Costing Ledger Entry: Realized COGS posted to ledger. Never falls back to arbitrary zeros or buy_price defaults.

### Codebase Evidence

- Backend Service: backend/src/services/inventory-costing/
- Local Engine Equivalence: packages/local-engine/src/routes/costing.ts and cost-layers.ts
- Database Tables: cost_layers, cost_consumptions, inventory_movements

---

## Journey 3: Invoice Issuance -> Partial/Full Return -> Inventory/Ledger Restitution

### Flow Specification

1. Return Initiation: Customer returns goods; InvoiceReturnService.createReturn triggered with original invoice reference.
2. Stock Re-incorporation: Returned items inspected and re-entered into inventory movements as TYPE_RETURN. Corresponding cost layer restored or re-added.
3. Credit Note Generation: Credit note issued against customer balance; customer balance adjusted in real-time.
4. Ledger Reversal: Reversing journal entry posted:
   - Debit: Sales Returns / Revenue Adjustment
   - Credit: Accounts Receivable (or Cash Refund)
   - Debit: Inventory Asset Account
   - Credit: Cost of Goods Sold
5. Integrity Guard: backend/src/**tests**/reversal-ledger.test.ts guards against unbalanced reversals and verifies document references.

### Codebase Evidence

- Routes: backend/src/routes/invoice-return.routes.ts
- UI Component: packages/ui/src/components/ui/invoices/invoice-returns-dialog.tsx
- SQLite Schema: packages/app-bridge/src/local-universal-core-schema.ts (invoice_returns, invoice_return_lines)

---

## Journey 4: Offline POS -> Local Write -> Sync Connection -> Conflict Recovery

### Flow Specification

1. Offline Mode Activation: Network disconnects; client switches to packages/local-engine.
2. Local Transactions: POS orders created and stored in local SQLite (local-schema.ts, local-sales-schema.ts). Local ledger entries generated via local-ledger.ts.
3. Outbox Staging: Transactions enqueued into sync_queue with monotonic client sequence numbers and cryptographic payload hashes.
4. Reconnection & Stream Push: Connection restored; SyncEngine pushes batches to /api/sync/push or WebSocket stream (sync-stream.routes.ts).
5. Conflict Resolution: Server detects conflicting edits (e.g. concurrent stock decrements or customer profile updates) using vector timestamps and monotonic clocks. Wins evaluated via deterministic merge policies in backend/src/services/conflict/.
6. Cursor Acknowledgment: Server returns new sync_cursor; local queue marks records synced.

### Codebase Evidence

- App Shell Engine: packages/app-shell/src/features/sync/sync-engine.ts
- Backend Sync Router: backend/src/routes/sync.routes.ts
- Local SQLite Engine: packages/local-engine/src/router.ts

---

## Journey 5: Backup Creation -> Snapshot Extraction -> Disaster Restoration

### Flow Specification

1. Snapshot Creation: Admin or automated cron triggers SnapshotService.createSnapshot.
2. Deterministic Extraction: Tables serialized into encrypted compressed archive (fflate + SHA-256 checksums).
3. Metadata Manifest: Snapshot records schema version, record count per table, and database hash.
4. Restore Pipeline: During disaster recovery, CloudMigrationService validates archive signature and schema compatibility before staging restore in temporary schema.
5. Data Integrity Check: Post-migration validation scripts (docs/VERIFY-*.sql) assert total row counts and double-entry trial balance equilibrium (SUM(debit) == SUM(credit)).

### Codebase Evidence

- Services: backend/src/services/portability/snapshot.service.ts & backend/src/services/migration/
- Local Backup: packages/local-engine/src/routes/backup.ts
- Checksum Guard: packages/local-engine/src/export/checksum.ts

---

## Journey 6: Multi-Tenant Workspace Boundary & Sensitive Action Authorization

### Flow Specification

1. Authentication Token: JWT contains user identity and active tenancy claim.
2. Tenancy Resolution: Fastify pre-handler extracts workspace context into request.tenancy.
3. Authorization Check: Mutating operations require requireCapability(CAPABILITY_NAME). Checks workspace_role_capabilities table.
4. Row-Level Security Enforcement: Supabase/PostgreSQL connection sets request.jwt.claim.workspace_id. Every table query is intercepted by RLS policy workspace_id = auth.jwt()->>workspace_id.
5. Leakage Guard: Attempting to query an ID from another tenant returns 404 Not Found or Empty Result, never leaking existence of foreign records.

### Codebase Evidence

- Route Middleware: backend/src/routes/auth.routes.ts, permission.routes.ts
- Service Boundary: backend/src/services/tenancy.service.ts
- Automated Verification: backend/src/**tests**/workspace.pg.test.ts & 80+ PG security tests.
