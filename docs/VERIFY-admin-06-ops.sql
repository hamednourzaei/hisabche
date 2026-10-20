-- ==============================================================================
-- docs/VERIFY-admin-06-ops.sql
--
-- Verification script for Step A6 (Product, Operations, Analytics)
-- PENDING HUMAN CONFIRMATION
-- ==============================================================================

-- 1. Check tables exist
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('feature_flags', 'admin_announcements', 'background_jobs')
ORDER BY table_name;

-- 2. Verify constraints
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'public.feature_flags'::regclass;

-- 3. Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('feature_flags', 'admin_announcements', 'background_jobs');
