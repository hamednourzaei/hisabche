-- VERIFY for docs/workspace-access-rpc-migration.sql — read-only.
-- Expected: every row's `ok` is true.

-- 1. The function exists, with a fixed search_path.
SELECT 'function exists, search_path fixed' AS check,
       (p.proconfig::text LIKE '%search_path=public, pg_temp%') AS ok
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'resolve_workspace_access';

-- 2. Clients cannot call it (it takes a user id as a parameter).
SELECT 'anon cannot execute' AS check,
       NOT has_function_privilege('anon', 'public.resolve_workspace_access(uuid, uuid)', 'EXECUTE') AS ok
UNION ALL
SELECT 'authenticated cannot execute',
       NOT has_function_privilege('authenticated', 'public.resolve_workspace_access(uuid, uuid)', 'EXECUTE')
UNION ALL
SELECT 'service_role can execute',
       has_function_privilege('service_role', 'public.resolve_workspace_access(uuid, uuid)', 'EXECUTE');

-- 3. It agrees with the table for a real member (the oldest active membership).
WITH m AS (
  SELECT user_id, workspace_id FROM workspace_members
   WHERE has_access = true AND suspended_at IS NULL
   ORDER BY joined_at LIMIT 1
)
SELECT 'memberships match workspace_members' AS check,
       jsonb_array_length(public.resolve_workspace_access(m.user_id, m.workspace_id) -> 'memberships')
         = (SELECT count(*) FROM workspace_members w
             WHERE w.user_id = m.user_id AND w.has_access = true AND w.suspended_at IS NULL) AS ok
  FROM m
UNION ALL
SELECT 'requested workspace is chosen',
       (public.resolve_workspace_access(m.user_id, m.workspace_id) ->> 'workspace_id')::uuid = m.workspace_id
  FROM m
UNION ALL
-- A workspace the user is not a member of is never chosen (random uuid).
SELECT 'non-member workspace is refused',
       (public.resolve_workspace_access(m.user_id, gen_random_uuid()) ->> 'workspace_id') IS NULL
  FROM m;
