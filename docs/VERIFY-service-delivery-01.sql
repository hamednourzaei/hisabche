-- ============================================================================
-- Verification Queries for docs/service-delivery-01-migration.sql
-- Status: PENDING HUMAN CONFIRMATION
-- ============================================================================

-- 1. Verify table exists and has expected columns
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'service_delivery_sessions'
ORDER BY ordinal_position;

-- 2. Verify RLS is enabled
SELECT
    relname AS table_name,
    relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname = 'service_delivery_sessions';

-- 3. Verify indexes exist
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'service_delivery_sessions';

-- 4. Verify RLS policy
SELECT
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'service_delivery_sessions';
