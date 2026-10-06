-- ============================================================================
-- VERIFY — docs/ai-pipeline-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'table ai_pipeline_settings exists' AS check, to_regclass('public.ai_pipeline_settings') IS NOT NULL AS ok

UNION ALL
SELECT 'table ai_pipeline_runs exists', to_regclass('public.ai_pipeline_runs') IS NOT NULL

UNION ALL
SELECT 'table ai_pipeline_steps exists', to_regclass('public.ai_pipeline_steps') IS NOT NULL

UNION ALL
SELECT 'RLS enabled on all three tables', (
  SELECT count(*) = 3 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relrowsecurity
     AND c.relname IN ('ai_pipeline_settings', 'ai_pipeline_runs', 'ai_pipeline_steps')
)

UNION ALL
SELECT 'clients cannot touch the pipeline tables', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name IN ('ai_pipeline_settings', 'ai_pipeline_runs', 'ai_pipeline_steps')
     AND grantee IN ('anon', 'authenticated')
)

UNION ALL
SELECT 'the backend role cannot DELETE a run', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'ai_pipeline_runs'
     AND grantee = 'service_role' AND privilege_type = 'DELETE'
)

UNION ALL
SELECT 'the backend role can only read and add steps', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'ai_pipeline_steps'
     AND grantee = 'service_role' AND privilege_type NOT IN ('SELECT', 'INSERT')
)

UNION ALL
SELECT 'runs move forward only (trigger)', EXISTS (
  SELECT 1 FROM pg_trigger
   WHERE tgrelid = 'public.ai_pipeline_runs'::regclass
     AND tgname = 'ai_pipeline_runs_forward_only_trg'
)

UNION ALL
SELECT 'steps are append-only (trigger)', EXISTS (
  SELECT 1 FROM pg_trigger
   WHERE tgrelid = 'public.ai_pipeline_steps'::regclass
     AND tgname = 'ai_pipeline_steps_append_only_trg'
)

UNION ALL
SELECT 'an approved run names who approved it (constraint)', EXISTS (
  SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public.ai_pipeline_runs'::regclass
     AND conname = 'ai_pipeline_runs_approval_has_approver'
)

UNION ALL
SELECT 'the switch is off unless somebody turned it on', (
  SELECT column_default = 'false' FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'ai_pipeline_settings' AND column_name = 'enabled'
)

UNION ALL
SELECT 'auto-approval is off unless somebody turned it on', (
  SELECT column_default = 'false' FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'ai_pipeline_settings'
     AND column_name = 'auto_approve_non_financial'
)

UNION ALL
SELECT 'no executed run lacks an approver', NOT EXISTS (
  SELECT 1 FROM public.ai_pipeline_runs
   WHERE status IN ('approved', 'executed', 'needs_review') AND approved_by IS NULL
)

UNION ALL
SELECT 'no dry run was ever approved', NOT EXISTS (
  SELECT 1 FROM public.ai_pipeline_runs
   WHERE dry_run AND status IN ('approved', 'executed', 'failed', 'needs_review') AND approved_by IS NOT NULL
);
