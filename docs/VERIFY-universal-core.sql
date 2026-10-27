-- ============================================================================
-- docs/VERIFY-universal-core.sql
--
-- Read-only verification query for universal-core-migration.sql.
-- Must return ok = true for every check.
-- ============================================================================

SELECT
  'tables_exist' AS check_name,
  count(*) = 15 AS ok,
  count(*) AS observed_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'product_variants',
    'metal_rates',
    'auto_fitments',
    'vehicle_attributes',
    'warranties',
    'invoice_returns',
    'invoice_return_lines',
    'appointments',
    'crop_cycles',
    'livestock_groups',
    'order_deposits',
    'freight_trips',
    'passenger_tickets',
    'courier_deliveries',
    'delivery_notes'
  )

UNION ALL

SELECT
  'credit_limit_mode_column' AS check_name,
  count(*) = 1 AS ok,
  count(*) AS observed_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'workspaces'
  AND column_name = 'credit_limit_mode'

UNION ALL

SELECT
  'rls_enabled_all_tables' AS check_name,
  count(*) = 15 AS ok,
  count(*) AS observed_count
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true
  AND tablename IN (
    'product_variants',
    'metal_rates',
    'auto_fitments',
    'vehicle_attributes',
    'warranties',
    'invoice_returns',
    'invoice_return_lines',
    'appointments',
    'crop_cycles',
    'livestock_groups',
    'order_deposits',
    'freight_trips',
    'passenger_tickets',
    'courier_deliveries',
    'delivery_notes'
  );
