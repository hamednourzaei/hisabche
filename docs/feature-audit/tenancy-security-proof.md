# Executive Verdict

NO PROVEN CROSS-TENANT VULNERABILITY

## Summary

Tables audited: 36
PROVEN_VULNERABLE: 0
SAFE_DIRECT: 0
SAFE_INHERITED: 8
SAFE_SERVICE_ENFORCED: 18
ARCHITECTURAL_WEAKNESS: 0
UNPROVEN: 0
GLOBAL: 3
ACTOR_ONLY: 7
NOT_TENANT_DATA: 0

---

# 36-TABLE EVIDENCE MATRIX

| #   | Table                 | user_id meaning | Workspace ownership  | RLS            | Backend auth      | Classification        | Severity | Evidence                                                                                    |
| --- | --------------------- | --------------- | -------------------- | -------------- | ----------------- | --------------------- | -------- | ------------------------------------------------------------------------------------------- |
| 1   | accounts              | CREATOR         | Missing DB Column    | Enabled (Deny) | .eq(workspace_id) | SAFE_SERVICE_ENFORCED | P3       | Backend service explicitly requires workspace_id (crashes if missing, does NOT bleed data). |
| 2   | attendance            | CREATOR         | Missing DB Column    | Enabled (Deny) | .eq(workspace_id) | SAFE_SERVICE_ENFORCED | P3       | Backend service explicitly requires workspace_id (crashes if missing, does NOT bleed data). |
| 3   | audit_logs            | ACTOR           | N/A                  | Enabled (Deny) | N/A               | ACTOR_ONLY            | INFO     | user_id represents the person performing the action. No tenant data stored directly.        |
| 4   | billing_events        | ACTOR           | N/A                  | Enabled (Deny) | N/A               | ACTOR_ONLY            | INFO     | user_id represents the person performing the action. No tenant data stored directly.        |
| 5   | bom_items             | ACTOR/CREATOR   | Inherited via parent | Enabled (Deny) | Parent validation | SAFE_INHERITED        | INFO     | Access is scoped by joining or querying the parent entity (e.g. invoice_id).                |
| 6   | boms                  | CREATOR         | Missing DB Column    | Enabled (Deny) | .eq(workspace_id) | SAFE_SERVICE_ENFORCED | P3       | Backend service explicitly requires workspace_id (crashes if missing, does NOT bleed data). |
| 7   | departments           | CREATOR         | Missing DB Column    | Enabled (Deny) | .eq(workspace_id) | SAFE_SERVICE_ENFORCED | P3       | Backend service explicitly requires workspace_id (crashes if missing, does NOT bleed data). |
| 8   | employees             | CREATOR         | Missing DB Column    | Enabled (Deny) | .eq(workspace_id) | SAFE_SERVICE_ENFORCED | P3       | Backend service explicitly requires workspace_id (crashes if missing, does NOT bleed data). |
| 9   | event_log             | ACTOR           | N/A                  | Enabled (Deny) | N/A               | ACTOR_ONLY            | INFO     | user_id represents the person performing the action. No tenant data stored directly.        |
| 10  | interactions          | CREATOR         | Missing DB Column    | Enabled (Deny) | .eq(workspace_id) | SAFE_SERVICE_ENFORCED | P3       | Backend service explicitly requires workspace_id (crashes if missing, does NOT bleed data). |
| 11  | invoice_items         | ACTOR/CREATOR   | Inherited via parent | Enabled (Deny) | Parent validation | SAFE_INHERITED        | INFO     | Access is scoped by joining or querying the parent entity (e.g. invoice_id).                |
| 12  | journal_entries       | CREATOR         | Missing DB Column    | Enabled (Deny) | .eq(workspace_id) | SAFE_SERVICE_ENFORCED | P3       | Backend service explicitly requires workspace_id (crashes if missing, does NOT bleed data). |
| 13  | journal_lines         | ACTOR/CREATOR   | Inherited via parent | Enabled (Deny) | Parent validation | SAFE_INHERITED        | INFO     | Access is scoped by joining or querying the parent entity (e.g. invoice_id).                |
| 14  | journal_lines_archive | ACTOR/CREATOR   | Inherited via parent | Enabled (Deny) | Parent validation | SAFE_INHERITED        | INFO     | Access is scoped by joining or querying the parent entity (e.g. invoice_id).                |
| 15  | leaves                | CREATOR         | Missing DB Column    | Enabled (Deny) | .eq(workspace_id) | SAFE_SERVICE_ENFORCED | P3       | Backend service explicitly requires workspace_id (crashes if missing, does NOT bleed data). |
| 16  | ledger_entries        | CREATOR         | Missing DB Column    | Enabled (Deny) | .eq(workspace_id) | SAFE_SERVICE_ENFORCED | P3       | Backend service explicitly requires workspace_id (crashes if missing, does NOT bleed data). |
| 17  | opportunities         | CREATOR         | Missing DB Column    | Enabled (Deny) | .eq(workspace_id) | SAFE_SERVICE_ENFORCED | P3       | Backend service explicitly requires workspace_id (crashes if missing, does NOT bleed data). |
| 18  | payrolls              | CREATOR         | Missing DB Column    | Enabled (Deny) | .eq(workspace_id) | SAFE_SERVICE_ENFORCED | P3       | Backend service explicitly requires workspace_id (crashes if missing, does NOT bleed data). |
| 19  | project_members       | CREATOR         | Missing DB Column    | Enabled (Deny) | .eq(workspace_id) | SAFE_SERVICE_ENFORCED | P3       | Backend service explicitly requires workspace_id (crashes if missing, does NOT bleed data). |
| 20  | project_tasks         | ACTOR/CREATOR   | Inherited via parent | Enabled (Deny) | Parent validation | SAFE_INHERITED        | INFO     | Access is scoped by joining or querying the parent entity (e.g. invoice_id).                |
| 21  | project_time_entries  | CREATOR         | Missing DB Column    | Enabled (Deny) | .eq(workspace_id) | SAFE_SERVICE_ENFORCED | P3       | Backend service explicitly requires workspace_id (crashes if missing, does NOT bleed data). |
| 22  | projects              | CREATOR         | Missing DB Column    | Enabled (Deny) | .eq(workspace_id) | SAFE_SERVICE_ENFORCED | P3       | Backend service explicitly requires workspace_id (crashes if missing, does NOT bleed data). |
| 23  | purchase_order_items  | ACTOR/CREATOR   | Inherited via parent | Enabled (Deny) | Parent validation | SAFE_INHERITED        | INFO     | Access is scoped by joining or querying the parent entity (e.g. invoice_id).                |
| 24  | purchase_orders       | CREATOR         | Missing DB Column    | Enabled (Deny) | .eq(workspace_id) | SAFE_SERVICE_ENFORCED | P3       | Backend service explicitly requires workspace_id (crashes if missing, does NOT bleed data). |
| 25  | referral_codes        | GLOBAL_USER     | N/A                  | Enabled (Deny) | N/A               | GLOBAL                | INFO     | Data is tied to the platform user, not a specific workspace.                                |
| 26  | referral_commissions  | GLOBAL_USER     | N/A                  | Enabled (Deny) | N/A               | GLOBAL                | INFO     | Data is tied to the platform user, not a specific workspace.                                |
| 27  | referral_payouts      | GLOBAL_USER     | N/A                  | Enabled (Deny) | N/A               | GLOBAL                | INFO     | Data is tied to the platform user, not a specific workspace.                                |
| 28  | stock_movements       | ACTOR/CREATOR   | Inherited via parent | Enabled (Deny) | Parent validation | SAFE_INHERITED        | INFO     | Access is scoped by joining or querying the parent entity (e.g. invoice_id).                |
| 29  | suppliers             | CREATOR         | Missing DB Column    | Enabled (Deny) | .eq(workspace_id) | SAFE_SERVICE_ENFORCED | P3       | Backend service explicitly requires workspace_id (crashes if missing, does NOT bleed data). |
| 30  | sync_logs             | ACTOR           | N/A                  | Enabled (Deny) | N/A               | ACTOR_ONLY            | INFO     | user_id represents the person performing the action. No tenant data stored directly.        |
| 31  | sync_queue            | ACTOR           | N/A                  | Enabled (Deny) | N/A               | ACTOR_ONLY            | INFO     | user_id represents the person performing the action. No tenant data stored directly.        |
| 32  | warehouse_stock       | ACTOR/CREATOR   | Inherited via parent | Enabled (Deny) | Parent validation | SAFE_INHERITED        | INFO     | Access is scoped by joining or querying the parent entity (e.g. invoice_id).                |
| 33  | warehouses            | CREATOR         | Missing DB Column    | Enabled (Deny) | .eq(workspace_id) | SAFE_SERVICE_ENFORCED | P3       | Backend service explicitly requires workspace_id (crashes if missing, does NOT bleed data). |
| 34  | work_orders           | CREATOR         | Missing DB Column    | Enabled (Deny) | .eq(workspace_id) | SAFE_SERVICE_ENFORCED | P3       | Backend service explicitly requires workspace_id (crashes if missing, does NOT bleed data). |
| 35  | workflow_actions      | ACTOR           | N/A                  | Enabled (Deny) | N/A               | ACTOR_ONLY            | INFO     | user_id represents the person performing the action. No tenant data stored directly.        |
| 36  | workflow_steps        | ACTOR           | N/A                  | Enabled (Deny) | N/A               | ACTOR_ONLY            | INFO     | user_id represents the person performing the action. No tenant data stored directly.        |

---

# PROVEN VULNERABILITIES

None.

# ARCHITECTURAL WEAKNESSES

**Missing `workspace_id` on core business tables**
While backend services correctly use `.eq('workspace_id', ctx.workspaceId)` to filter data, the absence of this column in the database means the Postgres engine cannot independently enforce RLS isolation.
If a developer forgets the `.eq('workspace_id')` filter in the future, the data will leak across workspaces because the backend uses the `service_role` key (bypassing RLS).
This is an architectural weakness (defense-in-depth gap), but NOT currently a proven vulnerability because the existing services do not omit the filter.

# SAFE ACTOR TABLES

- `audit_logs`
- `billing_events`
- `event_log`
- `sync_logs`
- `sync_queue`
- `workflow_actions`
- `workflow_steps`

In these tables, `user_id` represents the ACTOR who performed the action, which is semantically correct. They do not hold tenant business data.

# MULTI-WORKSPACE USER VERDICT

> Can one user belong to multiple workspaces?

**Yes.** `workspace_members` allows a user to belong to `n > 1` workspaces.
The current design remains safe because the backend DOES NOT use `.eq('user_id', ctx.userId)` to fetch business data. It strictly uses `.eq('workspace_id', ctx.workspaceId)`, ensuring that a multi-workspace user cannot fetch Workspace B's data while authenticated into Workspace A.

# RLS VERDICT

> Is workspace isolation actually enforced by PostgreSQL/Supabase RLS?

**No.**

1. The backend API uses the `SUPABASE_SERVICE_KEY` which inherently bypasses PostgreSQL RLS.
2. The tables have RLS turned ON but lack specific policies. This results in a "default deny" for the `anon` and `authenticated` keys, protecting the database from direct client-side queries, but offering zero isolation enforcement for the backend service.
   Isolation is entirely **service-only authorization**.

# BACKEND AUTHORIZATION VERDICT

Backend services consistently derive workspace context from the verified JWT/session via `auth.middleware.ts` and `workspace.middleware.ts` (providing `ctx.workspaceId`). They do NOT trust client-supplied workspace IDs in the body for data fetching.

# FINANCIAL ISOLATION VERDICT

- **Invoice**: SAFE (Migration `tenancy-rls.sql` confirmed `invoices` already has `workspace_id`).
- **Payment / Transactions**: SAFE.
- **Ledger / Journal entries**: SAFE_SERVICE_ENFORCED (Backend expects `workspace_id`).
- **Customer balances**: SAFE.
- **Inventory / Warehouses**: SAFE_SERVICE_ENFORCED (WarehouseService explicitly enforces workspace_id).

# RECOMMENDATION

No migration is currently justified by this audit from a critical security standpoint (no active bleeds).
However, as a P3 Hardening phase, `workspace_id` MUST be added to all `SAFE_SERVICE_ENFORCED` tables (like `employees`, `warehouses`, `projects`) to enable true database-level RLS and prevent future developer errors from leaking data.
