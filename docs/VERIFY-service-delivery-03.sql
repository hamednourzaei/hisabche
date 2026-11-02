-- ============================================================================
-- VERIFY: docs/service-delivery-03-cancellation-reason-migration.sql
-- Read-only. One row: every has_* / only_* / *_only column must be true; the legacy_* count is information
-- (old cancelled rows are counted, never rewritten).
-- Status: PENDING HUMAN CONFIRMATION (not run by the assistant on any production database).
-- ============================================================================
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'service_delivery_sessions'
             AND column_name = 'cancellation_reason')                                         AS has_cancellation_reason,
  EXISTS (SELECT 1 FROM pg_constraint
           WHERE conname = 'chk_service_delivery_cancelled_has_reason')                       AS has_reason_check,
  -- exactly ONE cancel function, the 4-argument one (the 3-argument one would cancel without a reason)
  (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'service_delivery_cancel') = 1                 AS only_one_cancel_function,
  to_regprocedure('public.service_delivery_cancel(uuid, uuid, uuid, text)') IS NOT NULL       AS has_four_argument_cancel,
  NOT has_function_privilege('anon', 'public.service_delivery_cancel(uuid, uuid, uuid, text)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.service_delivery_cancel(uuid, uuid, uuid, text)', 'EXECUTE')
                                                                                              AS cancel_server_only,
  (SELECT COUNT(*) FROM public.service_delivery_sessions
    WHERE status = 'cancelled'
      AND (cancellation_reason IS NULL OR length(btrim(cancellation_reason)) = 0))            AS legacy_cancelled_without_reason;
