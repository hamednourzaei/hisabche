# Feature Summaries

### FEATURE: Workspace Tenancy
WHERE: backend/src/middleware/workspace.middleware.ts, db-schema
DOES: Isolates most core tables by workspace_id.
TEST GAP: 29 tables still rely on user_id, completely untested for multi-owner conflict.

### FEATURE: Admin Memberships
WHERE: backend/src/routes/admin.routes.ts, apps/web/app/[lang]/workspaces
DOES: Allows platform admins to manage workspace members and roles.
TEST GAP: Browser behavior and role change mutations against real data are untested.

### FEATURE: Sync Engine
WHERE: packages/sync/src, backend/src/services/sync.service.ts
DOES: Pulls data via HTTP cursor and receives wakeup signals via WebSocket.
TEST GAP: Offline creation, queue management, and concurrent optimistic conflict resolution on clients.

### FEATURE: Invoices
WHERE: backend/src/services/invoice.service.ts, packages/ui/src/invoices
DOES: Manages lifecycle of sales and purchases.
TEST GAP: Offline invoice creation syncing back to ledger and modifying stock safely.

### FEATURE: Subscriptions
WHERE: backend/src/routes/subscriptions.routes.ts
DOES: Manages tenant subscription limits and payments.
TEST GAP: Expiry filtering and the blocked Subscription->Workspace data migration.
