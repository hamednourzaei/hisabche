-- ============================================================================
-- VERIFY workspace-create-01 — read-only. Every row should be ok = true.
--
-- The last row is a DATA check, not a check of this script: a workspace whose
-- owner is not a member of it was left behind by the old two-step write before
-- this migration. If it is false, run docs/_repair-owner-memberships.sql and
-- run this file again.
-- ============================================================================
SELECT 'function workspace_create_with_owner exists' AS check,
       to_regprocedure('public.workspace_create_with_owner(uuid, text, text, text, text, text, text, text)') IS NOT NULL AS ok
UNION ALL
SELECT 'role anon cannot execute workspace_create_with_owner',
       NOT has_function_privilege('anon',
         'public.workspace_create_with_owner(uuid, text, text, text, text, text, text, text)', 'EXECUTE')
UNION ALL
SELECT 'role authenticated cannot execute workspace_create_with_owner',
       NOT has_function_privilege('authenticated',
         'public.workspace_create_with_owner(uuid, text, text, text, text, text, text, text)', 'EXECUTE')
UNION ALL
SELECT 'role service_role can execute workspace_create_with_owner',
       has_function_privilege('service_role',
         'public.workspace_create_with_owner(uuid, text, text, text, text, text, text, text)', 'EXECUTE')
UNION ALL
SELECT 'function pins search_path',
       EXISTS (
         SELECT 1 FROM pg_proc p
          WHERE p.oid = to_regprocedure('public.workspace_create_with_owner(uuid, text, text, text, text, text, text, text)')
            AND array_to_string(p.proconfig, ',') LIKE '%search_path=public%'
       )
UNION ALL
SELECT 'data: every workspace has its owner as a member (false => run docs/_repair-owner-memberships.sql)',
       NOT EXISTS (
         SELECT 1 FROM public.workspaces w
          WHERE NOT EXISTS (
            SELECT 1 FROM public.workspace_members m
             WHERE m.workspace_id = w.id AND m.user_id = w.owner_id
          )
       );
