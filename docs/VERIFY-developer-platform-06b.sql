-- ============================================================================
-- VERIFY developer platform 06b — read-only. Run after the migration.
-- Expect one row with ok = true.
-- ============================================================================

SELECT
  -- The function writes has_access itself.
  position('has_access' in pg_get_functiondef('public.create_sandbox_workspace(uuid, uuid)'::regprocedure)) > 0
    AS function_sets_has_access,
  -- No sandbox is left whose own owner the server would refuse.
  (SELECT count(*)
     FROM public.workspaces w
     JOIN public.workspace_members m ON m.workspace_id = w.id AND m.user_id = w.owner_id
    WHERE w.is_sandbox AND m.has_access IS DISTINCT FROM true) AS sandboxes_owner_refused,
  -- A sandbox with no owner membership at all would be a different fault.
  (SELECT count(*)
     FROM public.workspaces w
    WHERE w.is_sandbox
      AND NOT EXISTS (SELECT 1 FROM public.workspace_members m
                       WHERE m.workspace_id = w.id AND m.user_id = w.owner_id)) AS sandboxes_without_owner_row,
  -- Whether the column default this function used to rely on is there.
  (SELECT column_default IS NOT NULL
     FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workspace_members'
      AND column_name = 'has_access') AS has_access_has_default,
  NOT has_function_privilege('anon', 'public.create_sandbox_workspace(uuid, uuid)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.create_sandbox_workspace(uuid, uuid)', 'EXECUTE')
    AS clients_cannot_call,
  (
    position('has_access' in pg_get_functiondef('public.create_sandbox_workspace(uuid, uuid)'::regprocedure)) > 0
    AND (SELECT count(*)
           FROM public.workspaces w
           JOIN public.workspace_members m ON m.workspace_id = w.id AND m.user_id = w.owner_id
          WHERE w.is_sandbox AND m.has_access IS DISTINCT FROM true) = 0
    AND NOT has_function_privilege('anon', 'public.create_sandbox_workspace(uuid, uuid)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.create_sandbox_workspace(uuid, uuid)', 'EXECUTE')
  ) AS ok;
