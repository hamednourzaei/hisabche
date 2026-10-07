### FEATURE: Sync/Offline
WHERE: packages/sync
DOES: Handles outbox, queues, and wire protocol
RUNTIME EVIDENCE: 40 Executed, 40 Passed
GAP: Concurrent conflict tests

### FEATURE: Tenancy
WHERE: backend
DOES: Isolates data per workspace
RUNTIME EVIDENCE: 4330 Executed, 4323 Passed
GAP: Production parity (backend undeployed)
