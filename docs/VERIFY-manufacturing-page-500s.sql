-- ============================================================================
-- docs/VERIFY-manufacturing-page-500s.sql
--
-- READ-ONLY. Confirms, against the live DB, the causes the code fix assumes for
-- GET /api/boms, /api/pos/sessions/current, /api/pos/sessions/abandoned and
-- /api/ai/quota returning 500. Results: PENDING HUMAN CONFIRMATION.
-- ============================================================================

-- Q1. Do the columns each read selects exist? A NULL `present` is a 42703.
WITH expected(table_name, column_name) AS (
  VALUES
    ('boms','id'),('boms','product_id'),('boms','version'),('boms','notes'),
    ('boms','is_active'),('boms','created_at'),('boms','updated_at'),('boms','workspace_id'),
    ('bom_items','id'),('bom_items','bom_id'),('bom_items','raw_material_id'),
    ('bom_items','quantity'),('bom_items','unit_cost'),('bom_items','workspace_id'),
    ('pos_sessions','id'),('pos_sessions','workspace_id'),('pos_sessions','branch_id'),
    ('pos_sessions','status'),('pos_sessions','opening_float_minor'),('pos_sessions','opened_at'),
    ('pos_sessions','opened_by'),('pos_sessions','counted_cash_minor'),('pos_sessions','variance_reason'),
    ('pos_sessions','closed_at'),('pos_sessions','closed_by'),('pos_sessions','was_forced'),
    ('pos_sessions','journal_entry_id'),
    ('pos_sessions','expected_cash_minor'),('pos_sessions','cash_sales_minor'),
    ('pos_sessions','cash_in_minor'),('pos_sessions','cash_out_minor'),('pos_sessions','variance_minor'),
    ('pos_orders','session_id'),('pos_order_payments','order_id'),('pos_cash_movements','session_id'),
    ('ai_query_log','workspace_id'),('ai_query_log','created_at'),
    ('ai_workspace_quota','monthly_limit'),('ai_provider_settings','topup_contact'),
    ('subscriptions','workspace_id'),('subscriptions','created_at')
)
SELECT e.table_name, e.column_name, c.data_type AS present
FROM expected e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = e.table_name AND c.column_name = e.column_name
ORDER BY (c.data_type IS NULL) DESC, e.table_name, e.column_name;

-- Q2. Which migrations the runner recorded (if the ledger exists).
SELECT name FROM schema_migrations
WHERE name ILIKE ANY (ARRAY['%finance-gaps%','%phase-m-01%','%phase-t4%','%phase-o-02%','%phase-t13%'])
ORDER BY name;

-- Q3. FKs the POS contents embed needs (`payments:pos_order_payments`).
--     Zero rows → PGRST200 on /sessions/current as soon as a session is open.
SELECT conrelid::regclass AS table_name, conname, confrelid::regclass AS references
FROM pg_constraint
WHERE contype = 'f'
  AND conrelid::regclass::text IN ('pos_orders','pos_order_payments','pos_cash_movements','boms','bom_items');
