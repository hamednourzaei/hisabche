### FEATURE: Workspace Tenancy
WHERE: backend/src/services/tenancy.service.ts
DOES: Workspace isolation
TEST GAP: End-to-end API-to-DB RLS leak validation

### FEATURE: Sync
WHERE: packages/sync
DOES: Outbox and remote conflict protocol
TEST GAP: Canonical E2E workflow
