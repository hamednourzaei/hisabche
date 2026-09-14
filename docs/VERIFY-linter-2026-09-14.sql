-- docs/VERIFY-linter-2026-09-14.sql
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
SELECT 'product_units_replace search_path pinned' AS check,
       EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.product_units_replace(uuid, uuid, jsonb)')
               AND proconfig::text LIKE '%search_path=%') AS ok
UNION ALL
SELECT 'budget_revisions_immutable search_path pinned',
       EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.budget_revisions_immutable()')
               AND proconfig::text LIKE '%search_path=%')
UNION ALL
SELECT 'no RLS helper left in public',
       to_regprocedure('public.auth_workspace_ids()') IS NULL
       AND to_regprocedure('public.auth_owned_workspace_ids()') IS NULL
       AND to_regprocedure('public.is_workspace_member(uuid, uuid)') IS NULL
UNION ALL
SELECT 'helpers exist in private',
       to_regprocedure('private.auth_workspace_ids()') IS NOT NULL
       AND to_regprocedure('private.auth_owned_workspace_ids()') IS NOT NULL
       AND to_regprocedure('private.is_workspace_member(uuid, uuid)') IS NOT NULL
UNION ALL
SELECT 'authenticated can still execute helpers (policies)',
       has_function_privilege('authenticated', 'private.auth_workspace_ids()', 'EXECUTE')
       AND has_function_privilege('authenticated', 'private.is_workspace_member(uuid, uuid)', 'EXECUTE')
       AND has_function_privilege('authenticated', 'private.auth_owned_workspace_ids()', 'EXECUTE')
UNION ALL
SELECT 'anon cannot execute helpers',
       NOT has_function_privilege('anon', 'private.auth_workspace_ids()', 'EXECUTE')
UNION ALL
SELECT 'policies still reference helpers (count > 0)',
       (SELECT count(*) FROM pg_policies
         WHERE qual ~ 'auth_workspace_ids|is_workspace_member|auth_owned_workspace_ids'
            OR with_check ~ 'auth_workspace_ids|is_workspace_member|auth_owned_workspace_ids') > 0;
