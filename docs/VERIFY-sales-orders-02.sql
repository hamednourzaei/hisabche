-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- Run in Supabase SQL Editor after docs/sales-orders-02-migration.sql

SELECT
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_order_deliveries') AS deliveries_table_ok,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_order_delivery_lines') AS delivery_lines_table_ok,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales_order_items' AND column_name = 'delivered_quantity') AS delivered_qty_col_ok,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'quote_expires_at') AS quote_expires_col_ok,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'deliver_sales_order_partial') AS deliver_rpc_ok;
