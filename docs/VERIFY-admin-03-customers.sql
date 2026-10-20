-- ==============================================================================
-- docs/VERIFY-admin-03-customers.sql
--
-- Verification script for Step A3 (Customers & Support)
-- PENDING HUMAN CONFIRMATION
-- ==============================================================================

-- 1. Check tables exist
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('support_sessions', 'admin_notes', 'admin_data_requests', 'trial_abuse_signals')
ORDER BY table_name;

-- 2. Verify constraints
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'public.admin_data_requests'::regclass;

-- 3. Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('support_sessions', 'admin_notes', 'admin_data_requests', 'trial_abuse_signals');
