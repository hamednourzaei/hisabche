# Six Layer Feature Matrix

| Feature | Unit | Component | Integration | API | E2E | Security/Data |
|---|---|---|---|---|---|---|
| Workspace/Tenancy | WEAK | NONE | STRONG | PARTIAL | NONE | WEAK |
| Invoices | STRONG | GOOD | STRONG | PARTIAL | NONE | NONE |
| Accounting | GOOD | GOOD | GOOD | NONE | NONE | NONE |
| Sync/Offline | WEAK | NONE | STRONG | NONE | NONE | NONE |
| RBAC/Permissions | NONE | NONE | STRONG | WEAK | NONE | NONE |
| Employees | GOOD | GOOD | GOOD | NONE | NONE | NONE |

### FEATURE: Sync/Offline
WHERE: packages/sync
DOES: Handles outbox, queues, and wire protocol
TEST GAP: SECURITY/DATA layer for conflict resolution auditing

### FEATURE: Workspace/Tenancy
WHERE: backend
DOES: Isolates data per workspace
TEST GAP: SECURITY/DATA layer for cross-tenant breach attempts

### FEATURE: Invoices
WHERE: backend/src/routes/invoices.ts
DOES: Manages invoice creation and lifecycle
TEST GAP: API layer authorization and E2E workflow

### FEATURE: Accounting
WHERE: backend/src/routes/accounting.ts
DOES: Ledger entries
TEST GAP: API contract validation
