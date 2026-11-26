-- ============================================
-- docs/VERIFY-payment-gateway-events-02.sql
-- Post-migration verification for payment-gateway-events-02-rpc-migration.sql.
-- Status target after human execution: Post-migration verification query generated - PENDING HUMAN CONFIRMATION.
-- ============================================

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payment_gateway_events'
  AND column_name IN (
    'event_id', 'event_type', 'amount_minor', 'currency',
    'payload_sha256', 'processing_status', 'delivery_attempts', 'last_error'
  )
ORDER BY column_name;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'payment_gateway_events'
  AND indexname IN (
    'idx_payment_gateway_events_ws_event_id',
    'idx_payment_gateway_events_ws_ref_state'
  )
ORDER BY indexname;

SELECT proname, prosecdef, proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'apply_payment_gateway_event';
