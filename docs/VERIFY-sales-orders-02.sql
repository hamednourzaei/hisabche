-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- Run in Supabase SQL Editor after docs/sales-orders-02-migration.sql

SELECT
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_order_deliveries') AS deliveries_table_ok,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_order_delivery_lines') AS delivery_lines_table_ok,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales_order_items' AND column_name = 'delivered_quantity') AS delivered_qty_col_ok,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'quote_expires_at') AS quote_expires_col_ok,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'deliver_sales_order_partial') AS deliver_rpc_ok;

-- V61 audit (12 Nov 2026): clients are locked out — RLS on, no policy, and
-- neither anon nor authenticated holds any privilege. Expect ok = true.
SELECT 'clients_locked' AS check_name,
       bool_and(c.relrowsecurity)
       AND NOT bool_or(
             has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
          OR has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE'))
       AND NOT EXISTS (
             SELECT 1 FROM pg_policies p
              WHERE p.schemaname = 'public' AND p.tablename = ANY (ARRAY['sales_order_deliveries', 'sales_order_delivery_lines']))
       AND count(*) = 2 AS ok
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('sales_order_deliveries', 'sales_order_delivery_lines');
