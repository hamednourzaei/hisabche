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
