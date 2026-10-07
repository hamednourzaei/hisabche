### FEATURE: Workspace/Tenancy
WHERE: backend/src/services/tenancy.service.ts
DOES: Enforces strict data and API isolation boundaries across tenants
TEST GAP: End-to-end production environment test (Blocked by deployment state)

### FEATURE: Invoices
WHERE: backend/src/routes/invoices.ts
DOES: Persists financial operations within authorized tenant bounds
TEST GAP: End-to-end user workflow
