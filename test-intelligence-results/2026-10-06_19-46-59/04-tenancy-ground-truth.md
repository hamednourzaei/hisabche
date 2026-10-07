# Tenancy Ground Truth

| Table | workspace_id | user_id | ownership model | RLS | Foreign Keys | Service Access | Route Access | Risk | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| invoices | yes | no | WORKSPACE_OWNED | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| inventory | yes | no | WORKSPACE_OWNED | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| workspaces | no | yes | SYSTEM | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| employees | no | yes | LEGACY OWNERSHIP | yes | yes | yes | yes | HIGH | VERIFIED | Repository |
| purchase_orders | no | yes | LEGACY OWNERSHIP | yes | yes | yes | yes | HIGH | VERIFIED | Repository |
| boms | no | yes | LEGACY OWNERSHIP | yes | yes | yes | yes | HIGH | VERIFIED | Repository |
| crm_interactions | no | yes | LEGACY OWNERSHIP | yes | yes | yes | yes | HIGH | VERIFIED | Repository |
| accounts | no | yes | LEGACY OWNERSHIP | yes | yes | yes | yes | HIGH | VERIFIED | Repository |
| journal_entries | no | yes | LEGACY OWNERSHIP | yes | yes | yes | yes | HIGH | VERIFIED | Repository |
| warehouses | no | yes | LEGACY OWNERSHIP | yes | yes | yes | yes | HIGH | VERIFIED | Repository |
| transactions | no | yes | LEGACY OWNERSHIP | yes | yes | yes | yes | HIGH | VERIFIED | Repository |
| activities | no | yes | LEGACY OWNERSHIP | yes | yes | yes | yes | HIGH | VERIFIED | Repository |
| users | no | yes | SYSTEM | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| roles | yes | no | WORKSPACE_OWNED | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| pos_sessions | yes | no | WORKSPACE_OWNED | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| stock_movements | yes | no | WORKSPACE_OWNED | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| subscriptions | yes | no | WORKSPACE_OWNED | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| product_images | yes | no | WORKSPACE_OWNED | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| late_fees | yes | no | WORKSPACE_OWNED | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| promotions | yes | no | WORKSPACE_OWNED | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| work_shifts | yes | no | WORKSPACE_OWNED | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| shift_assignments | yes | no | WORKSPACE_OWNED | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| price_lists | yes | no | WORKSPACE_OWNED | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| saved_reports | yes | no | WORKSPACE_OWNED | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| saved_views | yes | no | WORKSPACE_OWNED | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| wallet | yes | no | WORKSPACE_OWNED | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| attendance_credentials | yes | no | WORKSPACE_OWNED | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| manufacturing_orders | yes | no | WORKSPACE_OWNED | yes | yes | yes | yes | LOW | VERIFIED | Repository |
| goods_marketplace | yes | no | WORKSPACE_OWNED | yes | yes | yes | yes | LOW | VERIFIED | Repository |
