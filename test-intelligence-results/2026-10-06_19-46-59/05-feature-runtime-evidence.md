### FEATURE: Sync/Offline
WHERE: packages/sync
DOES: Handles outbox, queues, and wire protocol
RUNTIME EVIDENCE: 40 passing integration tests
GAP: Concurrent conflict tests

### FEATURE: Tenancy
WHERE: backend
DOES: Data isolation
RUNTIME EVIDENCE: NONE (Backend suite blocked)
GAP: All runtime evidence missing due to deployment block
