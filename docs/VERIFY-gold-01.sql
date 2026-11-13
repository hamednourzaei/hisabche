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

-- V61 audit (12 Nov 2026): clients are locked out — RLS on, no policy, and
-- neither anon nor authenticated holds any privilege. Expect ok = true.
SELECT 'clients_locked' AS check_name,
       bool_and(c.relrowsecurity)
       AND NOT bool_or(
             has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
          OR has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE'))
       AND NOT EXISTS (
             SELECT 1 FROM pg_policies p
              WHERE p.schemaname = 'public' AND p.tablename = ANY (ARRAY['gold_operations', 'gold_location_reconciliations']))
       AND count(*) = 2 AS ok
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('gold_operations', 'gold_location_reconciliations');
