-- ============================================================================
-- Verification Query: Cost Layers on Stock Transfer
-- File: docs/VERIFY-stock-transfer-02.sql
-- ============================================================================

-- Post-migration verification query executed and confirmed by human on live Supabase: CONFIRMED (PASS)
-- Live confirmation received: has_cost_layer_guard = true, has_payload_mismatch_guard = true, has_cost_layer_lock_guard = true

SELECT
  p.proname,
  (pg_get_functiondef(p.oid) LIKE '%WAREHOUSE_TRANSFER_COST_LAYERS_INSUFFICIENT%') AS has_cost_layer_guard,
  (pg_get_functiondef(p.oid) LIKE '%WAREHOUSE_TRANSFER_PAYLOAD_MISMATCH%') AS has_payload_mismatch_guard,
  (pg_get_functiondef(p.oid) LIKE '%FROM cost_layers%FOR UPDATE%') AS has_cost_layer_lock_guard,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'warehouse_transfer_stock_keyed';
