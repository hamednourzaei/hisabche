-- ============================================================================
-- VERIFY — docs/manufacturing-01-migration.sql
-- Read-only. Run after the migration; every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'column ' || t.tbl || '.' || t.col AS check, EXISTS (
         SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema = 'public' AND c.table_name = t.tbl AND c.column_name = t.col
       ) AS ok
  FROM (VALUES
    ('boms', 'columns'), ('boms', 'unit_cost'), ('boms', 'labor_cost_input'),
    ('boms', 'supersedes_bom_id'), ('boms', 'notes'),
    ('bom_items', 'kind'), ('bom_items', 'label'), ('bom_items', 'line_total'),
    ('bom_items', 'cells'), ('bom_items', 'position'),
    ('work_orders', 'bom_version'), ('work_orders', 'calculated_total'),
    ('work_orders', 'override_total'), ('work_orders', 'override_reason'),
    ('work_orders', 'total_cost'), ('work_orders', 'actual_material_cost'),
    ('work_orders', 'add_to_inventory'), ('work_orders', 'warehouse_id'),
    ('work_orders', 'idempotency_key'), ('work_orders', 'produced_on'),
    ('work_order_lines', 'actual_cost'), ('work_order_lines', 'quantity_per_unit')
  ) AS t (tbl, col)

UNION ALL
SELECT 'work_orders.quantity is numeric', (
  SELECT data_type = 'numeric' FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'work_orders' AND column_name = 'quantity'
)

UNION ALL
SELECT 'work_order_lines has RLS on', (
  SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'work_order_lines'
)

UNION ALL
SELECT 'work_order_lines not granted to anon/authenticated', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'work_order_lines'
     AND grantee IN ('anon', 'authenticated')
)

UNION ALL
SELECT 'unique index work_orders_idempotency_key', EXISTS (
  SELECT 1 FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'work_orders_idempotency_key'
)

UNION ALL
SELECT 'function ' || f.name || ' exists', EXISTS (
         SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = f.name
       )
  FROM (VALUES ('manufacturing_save_bom'), ('manufacturing_complete'), ('manufacturing_report'),
               ('inventory_consume_layers'), ('inventory_receive_layer')) AS f (name)

UNION ALL
SELECT 'function ' || f.name || ' not executable by anon/authenticated', NOT (
         has_function_privilege('anon', p.oid, 'EXECUTE')
         OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
       )
  FROM (VALUES ('manufacturing_save_bom'), ('manufacturing_complete'), ('manufacturing_report')) AS f (name)
  JOIN pg_proc p ON p.proname = f.name
  JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'

UNION ALL
-- Not a failure when false: it reports rows written before workspaces existed.
SELECT 'no manufacturing row without a workspace (informational)', NOT EXISTS (
  SELECT 1 FROM public.boms WHERE workspace_id IS NULL
  UNION ALL SELECT 1 FROM public.work_orders WHERE workspace_id IS NULL
);
