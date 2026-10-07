# Database Schema Verification

| Table Name | Primary Key | Workspace Scoped? | User Scoped? | Migration Location | Status |
|---|---|---|---|---|---|
| workspaces | id (uuid) | N/A (Tenant Root) | No | 0000_loose_bishop.sql | VERIFIED |
| customers | id (uuid) | YES (workspace_id) | YES (user_id) | 0000 / 0001 | VERIFIED |
| invoices | id (uuid) | YES (workspace_id) | YES (user_id) | 0000 / 0001 | VERIFIED |
| invoice_items | id (uuid) | Implicit (invoice_id) | No | 0000 / 0002 | VERIFIED |
| invoice_item_details | id (uuid) | Implicit (invoice_item_id) | No | 0002_steep_black_crow | VERIFIED |
| products | id (uuid) | YES (workspace_id) | YES (user_id) | 0000 / 0001 | VERIFIED |
| transactions | id (uuid) | YES (workspace_id) | YES (user_id) | 0000 / 0001 | VERIFIED |
| workflows | id (uuid) | YES (workspace_id) | No | 0000_loose_bishop.sql | VERIFIED |
| departments | id (uuid) | Implicit / Tenant | YES (user_id) | base-schema-migration.sql | VERIFIED |
| employees | id (uuid) | Implicit / Tenant | YES (user_id) | base-schema-migration.sql | VERIFIED |
| attendance | id (uuid) | YES (workspace_id) | YES (user_id) | attendance-01-migration.sql | VERIFIED |
| payrolls | id (uuid) | YES (workspace_id) | YES (user_id) | phase-j-04-payroll-ledger | VERIFIED |
