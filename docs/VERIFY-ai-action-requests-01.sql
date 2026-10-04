-- ============================================================================
-- VERIFY — docs/ai-action-requests-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'table ai_action_requests exists' AS check, to_regclass('public.ai_action_requests') IS NOT NULL AS ok

UNION ALL
SELECT 'RLS enabled on ai_action_requests', (
  SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'ai_action_requests'
)

UNION ALL
SELECT 'clients cannot read ai_action_requests', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'ai_action_requests'
     AND grantee IN ('anon', 'authenticated')
)

UNION ALL
SELECT 'the backend role cannot DELETE a request', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'ai_action_requests'
     AND grantee = 'service_role' AND privilege_type = 'DELETE'
)

UNION ALL
SELECT 'forward-only trigger is in place', EXISTS (
  SELECT 1 FROM pg_trigger
   WHERE tgrelid = 'public.ai_action_requests'::regclass
     AND tgname = 'ai_action_requests_forward_only_trg'
)

UNION ALL
SELECT 'a decided request names who decided it (constraint)', EXISTS (
  SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public.ai_action_requests'::regclass
     AND conname = 'ai_action_requests_decision_has_decider'
)

UNION ALL
SELECT 'no stored request holds a credential-looking argument', NOT EXISTS (
  SELECT 1 FROM public.ai_action_requests
   WHERE arguments::text ~* '(authorization|bearer |api[_-]?key|password)'
);
