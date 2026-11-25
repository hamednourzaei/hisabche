-- ============================================
-- docs/VERIFY-payment-processor-states-01.sql
--
-- Read-only verification for docs/payment-processor-states-01-migration.sql
-- Status: Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================

SELECT
  to_regclass('public.payment_gateway_states') AS table_exists,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.payment_gateway_states'::regclass) AS rls_enabled;

SELECT polname, cmd
FROM pg_policy
WHERE polrelid = 'public.payment_gateway_states'::regclass
ORDER BY polname;

SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'public.payment_gateway_states'::regclass
ORDER BY conname;
