-- ============================================
-- docs/VERIFY-payment-gateway-events-01.sql
--
-- Read-only verification for docs/payment-gateway-events-01-migration.sql
-- Status: Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================

SELECT
  to_regclass('public.payment_gateway_events') AS table_exists,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.payment_gateway_events'::regclass) AS rls_enabled;

SELECT polname, cmd
FROM pg_policy
WHERE polrelid = 'public.payment_gateway_events'::regclass
ORDER BY polname;
