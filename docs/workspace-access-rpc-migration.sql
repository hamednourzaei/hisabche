-- ============================================================================
-- docs/workspace-access-rpc-migration.sql              (27 Sep 2026)
--
-- ONE round trip for the authorization context of a request.
--
-- WHY
--   Every workspace-scoped request ran, in sequence:
--     1. workspace_members                     (which books may this user open)
--     2. workspace_role_capabilities  ┐ in parallel, but only AFTER 1,
--        workspace_member_module_blocks ┘ because they need the workspace
--   The database answers each in ~0.15 ms (pg_stat_statements), but the API
--   runs in Render's Oregon region and the database in ap-southeast-2, so each
--   hop costs ~150–300 ms of network. Two sequential hops were the floor of
--   every request: /api/invoices?limit=5 took 1.75 s, /api/ai/quota 0.7–3.6 s.
--
--   This function returns all three in one call. The backend applies exactly
--   the same rules to the result (chooseWorkspace, parseOverrides,
--   parseBlocks), and falls back to the old path while this has not been run.
--
-- SAFETY
--   * Additive and idempotent (CREATE OR REPLACE). Changes no table, no data.
--   * Takes a user id as a PARAMETER, so it must never be callable by a
--     client: EXECUTE is revoked from PUBLIC, anon and authenticated and
--     granted to service_role only (the backend's key).
--   * SECURITY INVOKER + fixed search_path (the linter's
--     function_search_path_mutable).
--   * Works before or after the capability / page-block migrations: those
--     tables are looked up with to_regclass and read as "no rows" if absent —
--     the same reading the TypeScript services take.
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.resolve_workspace_access(uuid, uuid);
--   The backend detects the missing function (PGRST202 / 42883) and returns
--   to the previous two-hop path by itself. No deploy needed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_workspace_access(
  p_user_id uuid,
  p_workspace_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_memberships jsonb;
  v_chosen uuid;
  v_count int;
  v_overrides jsonb := '[]'::jsonb;
  v_blocks jsonb := '[]'::jsonb;
BEGIN
  -- Exactly listAuthorizedWorkspaces: active, not suspended, oldest first.
  SELECT coalesce(jsonb_agg(jsonb_build_object('workspace_id', m.workspace_id, 'role', m.role)
                            ORDER BY m.joined_at), '[]'::jsonb),
         count(*)
    INTO v_memberships, v_count
    FROM workspace_members m
   WHERE m.user_id = p_user_id
     AND m.has_access = true
     AND m.suspended_at IS NULL
     AND m.workspace_id IS NOT NULL;

  -- Only a workspace the user is an active member of is ever read below.
  -- The final choice (and its errors) stays in the backend: chooseWorkspace.
  IF p_workspace_id IS NOT NULL THEN
    SELECT m.workspace_id INTO v_chosen
      FROM workspace_members m
     WHERE m.user_id = p_user_id AND m.workspace_id = p_workspace_id
       AND m.has_access = true AND m.suspended_at IS NULL
     LIMIT 1;
  ELSIF v_count = 1 THEN
    v_chosen := (v_memberships -> 0 ->> 'workspace_id')::uuid;
  END IF;

  IF v_chosen IS NOT NULL THEN
    IF to_regclass('public.workspace_role_capabilities') IS NOT NULL THEN
      EXECUTE $q$
        SELECT coalesce(jsonb_agg(jsonb_build_object(
                 'role', role, 'capability', capability, 'granted', granted)), '[]'::jsonb)
          FROM public.workspace_role_capabilities WHERE workspace_id = $1
      $q$ INTO v_overrides USING v_chosen;
    END IF;

    IF to_regclass('public.workspace_member_module_blocks') IS NOT NULL THEN
      EXECUTE $q$
        SELECT coalesce(jsonb_agg(module_key), '[]'::jsonb)
          FROM public.workspace_member_module_blocks
         WHERE workspace_id = $1 AND user_id = $2
      $q$ INTO v_blocks USING v_chosen, p_user_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'memberships', v_memberships,
    'workspace_id', v_chosen,
    'overrides', v_overrides,
    'blocks', v_blocks
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_workspace_access(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_workspace_access(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_workspace_access(uuid, uuid) TO service_role;

-- PostgREST caches the schema; without this the backend keeps getting
-- PGRST202 (and keeps using the old path) until the next reload.
NOTIFY pgrst, 'reload schema';
