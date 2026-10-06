-- ============================================================================
-- VERIFY — docs/ai-pipeline-02-one-approval-queue-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'ai_action_requests.run_id exists' AS check, EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'ai_action_requests' AND column_name = 'run_id'
) AS ok

UNION ALL
SELECT 'key_id is nullable (an in-app request has no key)', (
  SELECT is_nullable = 'YES' FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'ai_action_requests' AND column_name = 'key_id'
)

UNION ALL
SELECT 'a request has exactly one origin (constraint)', EXISTS (
  SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public.ai_action_requests'::regclass AND conname = 'ai_action_requests_one_origin'
)

UNION ALL
SELECT 'the risk classes are write, financial, destructive (constraint)', EXISTS (
  SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public.ai_action_requests'::regclass AND conname = 'ai_action_requests_risk_allowed'
)

UNION ALL
SELECT 'the old two-class risk check is gone', NOT EXISTS (
  SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public.ai_action_requests'::regclass AND conname = 'ai_action_requests_risk_check'
)

UNION ALL
SELECT 'a queued plain write is in-app only (constraint)', EXISTS (
  SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public.ai_action_requests'::regclass AND conname = 'ai_action_requests_write_is_in_app'
)

UNION ALL
SELECT 'one request per run (unique index)', EXISTS (
  SELECT 1 FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'ai_action_requests_run_idx' AND indexdef ILIKE '%UNIQUE%'
)

UNION ALL
SELECT 'forward-only trigger is still in place', EXISTS (
  SELECT 1 FROM pg_trigger
   WHERE tgrelid = 'public.ai_action_requests'::regclass
     AND tgname = 'ai_action_requests_forward_only_trg'
)

UNION ALL
SELECT 'the trigger protects the origin too', (
  SELECT prosrc LIKE '%NEW.run_id IS DISTINCT FROM OLD.run_id%'
    FROM pg_proc WHERE proname = 'ai_action_requests_move_forward_only'
)

UNION ALL
SELECT 'the backend role still cannot DELETE a request', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'ai_action_requests'
     AND grantee = 'service_role' AND privilege_type = 'DELETE'
)

UNION ALL
SELECT 'clients still cannot read the queue', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'ai_action_requests'
     AND grantee IN ('anon', 'authenticated')
)

UNION ALL
SELECT 'no request has two origins or none', NOT EXISTS (
  SELECT 1 FROM public.ai_action_requests WHERE (key_id IS NOT NULL) = (run_id IS NOT NULL)
);
