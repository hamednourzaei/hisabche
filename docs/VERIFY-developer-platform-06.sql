-- ============================================================================
-- VERIFY — docs/developer-platform-06-sandbox-migration.sql
-- Read-only. Every row must read ok = true. Until a human reports the result:
-- PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'columns' AS check,
       (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'workspaces'
           AND column_name IN ('is_sandbox', 'sandbox_of')) = 2 AS ok
UNION ALL
SELECT 'every sandbox has its owner as a member (created atomically)',
       NOT EXISTS (SELECT 1 FROM public.workspaces w
                    WHERE w.is_sandbox
                      AND NOT EXISTS (SELECT 1 FROM public.workspace_members m
                                       WHERE m.workspace_id = w.id AND m.user_id = w.owner_id))
UNION ALL
SELECT 'shape constraint and foreign key',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_sandbox_shape')
   AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_sandbox_of_fkey' AND confdeltype = 'n')
UNION ALL
SELECT 'one sandbox per business and person',
       to_regclass('public.workspaces_one_sandbox_per_owner') IS NOT NULL
UNION ALL
SELECT 'the flag is permanent',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'workspaces_sandbox_is_permanent_trg' AND NOT tgisinternal)
UNION ALL
SELECT 'create function present and not callable by clients',
       to_regprocedure('public.create_sandbox_workspace(uuid, uuid)') IS NOT NULL
   AND NOT has_function_privilege('authenticated', 'public.create_sandbox_workspace(uuid, uuid)', 'EXECUTE')
   AND NOT has_function_privilege('anon', 'public.create_sandbox_workspace(uuid, uuid)', 'EXECUTE');
