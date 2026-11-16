-- ============================================================================
-- FINDING — what docs/sales-orders-02-migration.sql needs, and what is present.
-- Read-only (SELECT only). One result set; every row should say present = true
-- before running sales-orders-02.
-- ============================================================================
SELECT item, needed_from, present
FROM (VALUES
  (1, 'table api_keys',                        'developer-platform-migration.sql',            to_regclass('public.api_keys') IS NOT NULL),
  (2, 'function enqueue_webhook_event',        'developer-platform-migration.sql',            to_regprocedure('public.enqueue_webhook_event(uuid, uuid, text, jsonb)') IS NOT NULL),
  (3, 'table sales_orders',                    'developer-platform-03-commerce-migration.sql', to_regclass('public.sales_orders') IS NOT NULL),
  (4, 'table sales_order_items',               'developer-platform-03-commerce-migration.sql', to_regclass('public.sales_order_items') IS NOT NULL),
  (5, 'function emit_sales_order_event',       'developer-platform-03-commerce-migration.sql',
      EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'emit_sales_order_event')),
  (6, 'table stock_reservations',              'stock-reservations-01-migration.sql',          to_regclass('public.stock_reservations') IS NOT NULL),
  (7, 'function stock_reserve',                'stock-reservations-01-migration.sql',
      EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'stock_reserve')),
  (8, 'function stock_release_reservation',    'stock-reservations-01-migration.sql',
      EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'stock_release_reservation')),
  (9, 'function stock_settle_reservation',     'stock-reservations-01-migration.sql',
      EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'stock_settle_reservation')),
  (10, 'table warehouse_stock',                'base-schema-migration.sql',                    to_regclass('public.warehouse_stock') IS NOT NULL)
) AS t(n, item, needed_from, present)
ORDER BY n;
