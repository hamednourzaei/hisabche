-- docs/VERIFY-workspace-role-capabilities.sql
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
SELECT 'table exists' AS check,
       to_regclass('public.workspace_role_capabilities') IS NOT NULL AS ok
UNION ALL
SELECT 'RLS enabled',
       COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.workspace_role_capabilities')), false)
UNION ALL
SELECT 'no write policy for authenticated',
       NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'workspace_role_capabilities'
                     AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL'))
UNION ALL
SELECT 'owner lock check exists',
       EXISTS (SELECT 1 FROM pg_constraint
               WHERE conname = 'workspace_role_capabilities_owner_lock_check')
UNION ALL
-- Read through a string so this file also runs (and says false above)
-- before the migration exists, instead of failing with 42P01.
SELECT 'no owner row revokes a locked capability',
       CASE WHEN to_regclass('public.workspace_role_capabilities') IS NULL THEN false
            ELSE (xpath('/row/n/text()', query_to_xml(
                   'SELECT count(*) AS n FROM public.workspace_role_capabilities
                     WHERE role = ''owner'' AND granted = false
                       AND capability IN (''member.manage'', ''workspace.manage'')',
                   false, true, '')))[1]::text = '0'
       END;
