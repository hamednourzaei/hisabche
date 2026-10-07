# Feature Ground Truth

### FEATURE: Invoices
WHERE: backend/src/routes/invoices.ts
DOES: Manages invoice creation and lifecycle
TESTS: 150
EXECUTED TESTS: 0
PASSING: 0
FAILING: 0
CURRENT CONFIDENCE: HIGH (Static)
MAIN GAP: Offline conflict resolution

### FEATURE: Workspace/Tenancy
WHERE: backend/src/services/tenancy.service.ts
DOES: Isolates data per workspace
TESTS: 85
EXECUTED TESTS: 0
PASSING: 0
FAILING: 0
CURRENT CONFIDENCE: HIGH (Static)
MAIN GAP: Subscription migration backfill

### FEATURE: Sync/Offline
WHERE: packages/sync
DOES: Handles outbox, queues, and wire protocol
TESTS: 40
EXECUTED TESTS: 40
PASSING: 40
FAILING: 0
CURRENT CONFIDENCE: HIGH (Executed)
MAIN GAP: Concurrency tests
