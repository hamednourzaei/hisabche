-- ============================================
-- docs/VERIFY-salon-02.sql
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================

SELECT
  EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_service_delivery_status'
       AND pg_get_constraintdef(oid) LIKE '%checked_in%'
  ) AS checked_in_status_allowed,
  to_regclass('public.service_delivery_status_audit') IS NOT NULL AS audit_table_exists,
  EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'service_sessions_practitioner_guard_trg'
  ) AS practitioner_guard_trigger_exists,
  EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'service_sessions_status_audit_trg'
  ) AS status_audit_trigger_exists,
  to_regprocedure('public.service_delivery_move_status(uuid,uuid,text,uuid)') IS NOT NULL AS fn_move_status,
  NOT has_function_privilege('anon', 'public.service_delivery_move_status(uuid,uuid,text,uuid)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.service_delivery_move_status(uuid,uuid,text,uuid)', 'EXECUTE')
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
              WHERE p.schemaname = 'public' AND p.tablename = ANY (ARRAY['service_delivery_status_audit']))
       AND count(*) = 1 AS ok
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('service_delivery_status_audit');
