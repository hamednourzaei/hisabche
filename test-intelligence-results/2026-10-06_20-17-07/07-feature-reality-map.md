### FEATURE: Tenancy
WHERE: backend/src/services/tenancy.service.ts
DOES: Secures boundaries across multiple businesses
TEST GAP: Production deployment block prevents real DB RLS checks

### FEATURE: Sync
WHERE: packages/sync
DOES: Manages optimistic queues and server conflict resolution
TEST GAP: Real canonical E2E test executing across actual devices

### FEATURE: Financial
WHERE: backend/src/routes/accounting.ts
DOES: Ensures double-entry accuracy across ledgers
TEST GAP: Deep integration with inventory valuation
