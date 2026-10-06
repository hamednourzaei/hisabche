-- ============================================================================
-- Workspace access RPC 02 — the person's CUSTOM ROLE, in the same round trip
--
-- A custom role is a role a business made for itself (roles.workspace_id = that
-- business). Its holder gets exactly what the role grants. The backend already
-- applies this: when resolve_workspace_access does not return `custom_role`, it
-- reads the role with ONE MORE network hop on every request. This migration
-- makes the function return it, so the extra hop goes away.
--
-- WHAT CHANGES: one more key in the JSON the function returns —
--   custom_role: null                              the person holds none
--   custom_role: { id, capabilities: [codes…] }    the one they hold
-- Everything else is byte-for-byte docs/workspace-access-rpc-migration.sql.
--
-- ONLY A ROLE OWNED BY THE CHOSEN WORKSPACE COUNTS. The platform's shared
-- profiles (roles.workspace_id IS NULL) are never returned: they are templates,
-- and no business may shape them. When a person holds several, the most
-- recently assigned wins — one role, deterministically.
--
-- Read-only function. Adds and changes no table. Idempotent, re-runnable.
--
-- ROLLBACK / MITIGATION: re-run docs/workspace-access-rpc-migration.sql. The
-- backend then reads the custom role with its own query again; no access
-- decision changes either way.
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
  v_custom jsonb := NULL;
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

    -- The custom role: owned by THIS workspace, the latest one assigned.
    IF to_regclass('public.user_roles') IS NOT NULL
       AND to_regclass('public.roles') IS NOT NULL
       AND to_regclass('public.role_permissions') IS NOT NULL
       AND to_regclass('public.permissions') IS NOT NULL THEN
      EXECUTE $q$
        SELECT jsonb_build_object(
                 'id', picked.role_id,
                 'capabilities', coalesce((
                   SELECT jsonb_agg(p.code)
                     FROM public.role_permissions rp
                     JOIN public.permissions p ON p.id = rp.permission_id
                    WHERE rp.role_id = picked.role_id), '[]'::jsonb))
          FROM (
            SELECT ur.role_id
              FROM public.user_roles ur
              JOIN public.roles r ON r.id = ur.role_id
             WHERE ur.workspace_id = $1 AND ur.user_id = $2
               AND r.workspace_id = $1
             ORDER BY ur.created_at DESC NULLS LAST, ur.role_id
             LIMIT 1
          ) picked
      $q$ INTO v_custom USING v_chosen, p_user_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'memberships', v_memberships,
    'workspace_id', v_chosen,
    'overrides', v_overrides,
    'blocks', v_blocks,
    -- Always present, so the backend can tell «none» from «did not look».
    'custom_role', v_custom
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_workspace_access(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_workspace_access(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_workspace_access(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
