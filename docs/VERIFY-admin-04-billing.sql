-- ==============================================================================
-- docs/VERIFY-admin-04-billing.sql
--
-- Verification script for Step A4 (Monetization & Billing)
-- PENDING HUMAN CONFIRMATION
-- ==============================================================================

-- 1. Check tables exist
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('plan_prices', 'billing_ledger_entries', 'admin_action_requests', 'subscription_history', 'dunning_logs')
ORDER BY table_name;

-- 2. Verify maker-checker constraint
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'public.admin_action_requests'::regclass
  AND conname = 'chk_maker_checker_proposer_ne_approver';

-- 3. Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('plan_prices', 'billing_ledger_entries', 'admin_action_requests', 'subscription_history', 'dunning_logs');
