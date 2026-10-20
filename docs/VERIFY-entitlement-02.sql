-- ============================================================================
-- docs/VERIFY-entitlement-02.sql
-- Verification queries for docs/entitlement-02-migration.sql
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================================================

-- 1. Verify offline_licenses columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'offline_licenses'
  AND column_name IN ('status', 'banned_at', 'ban_reason', 'transfer_count', 'transfer_year')
ORDER BY column_name;

-- 2. Verify devices columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'devices'
  AND column_name IN ('license_id', 'seat', 'stable_id', 'public_key', 'ip_address', 'is_active')
ORDER BY column_name;

-- 3. Verify license_logs table and append-only trigger exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'license_logs';

SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'license_logs_append_only';

-- 4. Verify license_review_queue table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'license_review_queue';

-- 5. Verify RLS is enabled on new tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('license_logs', 'license_review_queue');

-- 6. Verify subscription_events allows licence_banned and licence_unbanned
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.subscription_events'::regclass
  AND contype = 'c';
