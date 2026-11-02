-- ============================================================================
-- VERIFY: docs/service-delivery-02-atomic-migration.sql
-- Read-only. One row: every has_* / no_* / *_only / *_append_only column must be true; the legacy_* counts are information (old rows are counted, never rewritten).
-- Status: PENDING HUMAN CONFIRMATION (not run by the assistant on any production database).
-- ============================================================================
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'service_delivery_sessions'
             AND column_name = 'settlement_reason')                                           AS has_settlement_reason,
  (SELECT COUNT(*) FROM pg_constraint
    WHERE conname IN ('chk_service_delivery_free_has_reason',
                      'chk_service_delivery_invoice_has_invoice',
                      'chk_service_delivery_credit_has_entry')) = 3                           AS has_three_checks,
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
           AND indexname = 'uq_pkg_credit_service_consume')                                   AS has_one_consume_index,
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
           AND indexname = 'uq_pkg_credit_service_reversal')                                  AS has_one_reversal_index,
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'service_delivery_deliver')             AS has_deliver_function,
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'service_delivery_cancel')              AS has_cancel_function,
  -- the deliver function is for the server only: neither anon nor authenticated may call it
  -- (the cancel function's signature changed in migration 03: its privileges are checked by VERIFY-service-delivery-03.sql)
  NOT has_function_privilege('anon', 'public.service_delivery_deliver(uuid, uuid, text, uuid, numeric, uuid, text, uuid, timestamptz)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.service_delivery_deliver(uuid, uuid, text, uuid, numeric, uuid, text, uuid, timestamptz)', 'EXECUTE') AS functions_server_only,
  EXISTS (SELECT 1 FROM pg_trigger
           WHERE tgname = 'trg_prevent_package_credit_ledger_mutation' AND NOT tgisinternal)  AS ledger_is_append_only,
  -- no session was ever consumed twice (would also have blocked the unique index)
  NOT EXISTS (SELECT 1 FROM public.package_credit_ledger
               WHERE source_document_type = 'service_delivery' AND entry_type = 'CONSUME' AND deleted_at IS NULL
               GROUP BY workspace_id, source_document_id HAVING COUNT(*) > 1)                 AS no_double_consume,
  -- old rows that break the new rules are COUNTED here, not rewritten (the checks are NOT VALID)
  (SELECT COUNT(*) FROM public.service_delivery_sessions
    WHERE status = 'delivered' AND settlement_method = 'package_credit' AND package_credit_id IS NULL) AS legacy_delivered_without_credit,
  (SELECT COUNT(*) FROM public.service_delivery_sessions
    WHERE status = 'delivered' AND settlement_method = 'invoice' AND invoice_id IS NULL)       AS legacy_delivered_without_invoice,
  (SELECT COUNT(*) FROM public.service_delivery_sessions
    WHERE status = 'delivered' AND settlement_method = 'complementary'
      AND (settlement_reason IS NULL OR length(btrim(settlement_reason)) = 0))                 AS legacy_free_without_reason;
