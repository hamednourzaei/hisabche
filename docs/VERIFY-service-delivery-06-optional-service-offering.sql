-- ============================================================================
-- Verification query for docs/service-delivery-06-optional-service-offering-migration.sql
-- Status: PENDING HUMAN CONFIRMATION
--
-- Run in Supabase SQL Editor after applying docs/service-delivery-06-optional-service-offering-migration.sql.
-- ============================================================================

-- 1. Verify service_offering_id is nullable
SELECT
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'service_delivery_sessions'
  AND column_name = 'service_offering_id';
-- Expected: is_nullable = 'YES'

-- 2. Verify constraint chk_service_delivery_has_service is validated
SELECT
  conname,
  convalidated
FROM pg_constraint
WHERE conrelid = 'public.service_delivery_sessions'::regclass
  AND conname = 'chk_service_delivery_has_service';
-- Expected: conname = 'chk_service_delivery_has_service', convalidated = true
