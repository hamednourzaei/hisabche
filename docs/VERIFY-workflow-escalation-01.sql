-- ============================================================================
-- VERIFY — docs/workflow-escalation-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'column ' || t.tbl || '.' || t.col AS check, EXISTS (
         SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema = 'public' AND c.table_name = t.tbl AND c.column_name = t.col
       ) AS ok
  FROM (VALUES
    ('workflows', 'escalate_after_hours'), ('workflows', 'escalate_to_role'),
    ('workflows', 'escalate_max_times'),
    ('workflow_instances', 'escalated_role'), ('workflow_instances', 'escalations'),
    ('workflow_instances', 'escalated_at'), ('workflow_instances', 'escalated_step'),
    ('workflow_escalations', 'outcome')
  ) AS t (tbl, col)

UNION ALL
SELECT 'RLS enabled on workflow_escalations', (
  SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'workflow_escalations'
)

UNION ALL
SELECT 'clients cannot read workflow_escalations', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'workflow_escalations'
     AND grantee IN ('anon', 'authenticated')
)

UNION ALL
SELECT 'an escalation is recorded once (unique index)', EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'workflow_escalations_once'
)

UNION ALL
SELECT 'a policy is both fields or neither (constraint)', EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'workflows_escalation_check'
)

UNION ALL
-- Off by default: running the migration must not have switched anything on.
SELECT 'no workflow has half a policy', NOT EXISTS (
  SELECT 1 FROM public.workflows
   WHERE (escalate_after_hours IS NULL) <> (escalate_to_role IS NULL)
);
