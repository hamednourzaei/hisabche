-- ============================================================================
-- VERIFY: docs/service-delivery-04-settlement-undecided-migration.sql
-- Read-only. Run after the migration; nothing here writes.
--
-- Expected:
--   1. column_default = 'undecided'
--   2. one check constraint whose definition names all four values
--   3. every existing settlement_method is one of the four (no row is invalid)
-- ============================================================================

-- 1. The default a new booking receives.
SELECT column_name, column_default, is_nullable, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'service_delivery_sessions'
   AND column_name = 'settlement_method';

-- 2. The constraint as PostgreSQL stores it (must name 'undecided').
SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conrelid = 'public.service_delivery_sessions'::regclass
   AND conname = 'chk_service_delivery_settlement';

-- 3. What the table holds today, and how many rows would break the new check.
SELECT settlement_method, COUNT(*) AS rows
  FROM public.service_delivery_sessions
 GROUP BY settlement_method
 ORDER BY settlement_method;

SELECT COUNT(*) AS rows_outside_allowed_values
  FROM public.service_delivery_sessions
 WHERE settlement_method NOT IN ('undecided', 'package_credit', 'invoice', 'complementary');

-- 4. No delivered session may still be undecided (a delivery always names a method).
SELECT COUNT(*) AS delivered_but_undecided
  FROM public.service_delivery_sessions
 WHERE status = 'delivered' AND settlement_method = 'undecided';
