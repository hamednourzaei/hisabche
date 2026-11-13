-- ============================================
-- docs/VERIFY-exchange-03.sql
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================

SELECT
  EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'accounts_role_check'
       AND pg_get_constraintdef(oid) LIKE '%fx_vault%'
  ) AS fx_vault_role_allowed,
  EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'fx_trades_status'
       AND pg_get_constraintdef(oid) LIKE '%pending_review%'
  ) AS pending_review_status_allowed,
  EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'fx_trades' AND column_name = 'journal_entry_id'
  ) AS fx_trades_journal_column,
  EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'remittances' AND column_name = 'payout_journal_entry_id'
  ) AS remittances_journal_column,
  to_regclass('public.fx_agent_settlements') IS NOT NULL AS settlement_table_exists,
  to_regprocedure('public.fx_trade_create_with_ledger(uuid,uuid,jsonb)') IS NOT NULL AS fn_trade_create,
  to_regprocedure('public.fx_trade_resolve_pending_review(uuid,uuid,text,text,uuid)') IS NOT NULL AS fn_trade_review,
  to_regprocedure('public.fx_trade_void_with_ledger(uuid,uuid,text,uuid)') IS NOT NULL AS fn_trade_void,
  to_regprocedure('public.remittance_payout_with_ledger(uuid,uuid,text,text,text,text,bigint,text,uuid)') IS NOT NULL AS fn_remit_payout,
  to_regprocedure('public.fx_agent_settle(uuid,uuid,jsonb)') IS NOT NULL AS fn_agent_settle,
  NOT has_function_privilege('anon', 'public.fx_trade_create_with_ledger(uuid,uuid,jsonb)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.fx_trade_create_with_ledger(uuid,uuid,jsonb)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.fx_trade_create_with_ledger(uuid,uuid,jsonb)', 'EXECUTE')
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
              WHERE p.schemaname = 'public' AND p.tablename = ANY (ARRAY['fx_agent_settlements']))
       AND count(*) = 1 AS ok
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('fx_agent_settlements');
