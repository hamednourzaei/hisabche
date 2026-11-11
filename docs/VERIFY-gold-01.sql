-- ============================================
-- docs/VERIFY-gold-01.sql
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================

SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'invoice_items' AND column_name = 'metal_rate_24k_minor'
  ) AS snapshot_rate_column,
  EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'invoice_items' AND column_name = 'metal_purity_karat'
  ) AS snapshot_karat_column,
  EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'invoice_items' AND column_name = 'metal_net_weight_mg'
  ) AS snapshot_weight_column,
  EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'invoice_items' AND column_name = 'making_charge_minor'
  ) AS snapshot_making_column,
  to_regclass('public.gold_operations') IS NOT NULL AS gold_operations_exists,
  to_regclass('public.gold_location_reconciliations') IS NOT NULL AS gold_loc_rec_exists,
  to_regprocedure('public.gold_record_second_hand_purchase(uuid,uuid,jsonb)') IS NOT NULL AS fn_second_hand,
  to_regprocedure('public.gold_record_melt_scrap(uuid,uuid,jsonb)') IS NOT NULL AS fn_melt_scrap,
  to_regprocedure('public.gold_reconcile_location(uuid,uuid,jsonb)') IS NOT NULL AS fn_reconcile_loc,
  NOT has_function_privilege('anon', 'public.gold_record_second_hand_purchase(uuid,uuid,jsonb)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.gold_record_second_hand_purchase(uuid,uuid,jsonb)', 'EXECUTE')
    AS service_only_rpc_privileges;
