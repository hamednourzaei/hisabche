-- ============================================================================
-- Verification: docs/VERIFY-invoice-return-01.sql
-- Name: Post-migration verification for invoice_return_create
-- Phase: Universal Core / Launch Critical
-- Date: 2026-10-26
-- ============================================================================

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'invoice_return_create';

SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('invoice_returns', 'invoice_return_lines');

-- The function must not read a column invoice_items does not have, and must
-- name stock_movements.type (NOT NULL, no default). Run this block on its own:
-- the SQL editor shows only the last result. Expected: both columns TRUE.
SELECT
  position('v_item.warehouse_id' in pg_get_functiondef(p.oid)) = 0 AS no_invoice_item_warehouse_read,
  position('workspace_id, user_id, product_id, type, quantity' in pg_get_functiondef(p.oid)) > 0 AS restock_names_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'invoice_return_create';
