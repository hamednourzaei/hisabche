-- ============================================================================
-- VERIFY workspace access RPC 02 — read-only. Run after the migration.
-- Expect one row with ok = true.
-- ============================================================================

SELECT
  -- The function returns the custom role key.
  position('custom_role' in pg_get_functiondef('public.resolve_workspace_access(uuid, uuid)'::regprocedure)) > 0
    AS returns_custom_role,
  -- …and only a role owned by the chosen workspace can be it.
  position('r.workspace_id = $1' in pg_get_functiondef('public.resolve_workspace_access(uuid, uuid)'::regprocedure)) > 0
    AS only_own_workspace_roles,
  NOT has_function_privilege('anon', 'public.resolve_workspace_access(uuid, uuid)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.resolve_workspace_access(uuid, uuid)', 'EXECUTE')
    AS clients_cannot_call,
  has_function_privilege('service_role', 'public.resolve_workspace_access(uuid, uuid)', 'EXECUTE')
    AS backend_can_call,
  -- How many roles businesses have made, and how many people hold one — for the
  -- record; neither is a pass/fail condition.
  (SELECT count(*) FROM public.roles WHERE workspace_id IS NOT NULL) AS custom_roles,
  (SELECT count(*) FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
    WHERE r.workspace_id IS NOT NULL AND r.workspace_id = ur.workspace_id) AS people_holding_one,
  (
    position('custom_role' in pg_get_functiondef('public.resolve_workspace_access(uuid, uuid)'::regprocedure)) > 0
    AND position('r.workspace_id = $1' in pg_get_functiondef('public.resolve_workspace_access(uuid, uuid)'::regprocedure)) > 0
    AND NOT has_function_privilege('anon', 'public.resolve_workspace_access(uuid, uuid)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.resolve_workspace_access(uuid, uuid)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.resolve_workspace_access(uuid, uuid)', 'EXECUTE')
  ) AS ok;
