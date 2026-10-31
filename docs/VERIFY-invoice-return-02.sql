-- ============================================================================
-- Verification Query: Purchase Return Accounting in invoice_return_create
-- File: docs/VERIFY-invoice-return-02.sql
-- ============================================================================

-- Post-migration verification query executed and confirmed by human on live Supabase: CONFIRMED (PASS)
-- Live confirmation received:
--   has_insufficient_stock_guard = true
--   has_cost_layer_depleted_guard = true
--   has_invoice_line_lock_guard = true
--   has_zero_masking_eliminated = true

SELECT
  p.proname,
  (pg_get_functiondef(p.oid) LIKE '%PURCHASE_RETURN_INSUFFICIENT_STOCK%') AS has_insufficient_stock_guard,
  (pg_get_functiondef(p.oid) LIKE '%PURCHASE_RETURN_COST_LAYER_DEPLETED%') AS has_cost_layer_depleted_guard,
  (pg_get_functiondef(p.oid) LIKE '%public.invoice_items%FOR UPDATE%') AS has_invoice_line_lock_guard,
  (pg_get_functiondef(p.oid) NOT LIKE '%GREATEST(0%') AS has_zero_masking_eliminated,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'invoice_return_create';
