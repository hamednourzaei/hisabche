-- ============================================================================
-- role-permissions-atomic-01 — change a role and its permission set in ONE
-- transaction (audit F-06, 8 Nov 2026).
--
-- WHY: PermissionService.updateRole made three separate calls — update the
-- role, DELETE every role_permissions row, INSERT the new set — and checked
-- none of their errors. A failure after the DELETE left the role with NO
-- permissions, silently (CLAUDE.md rule 4).
--
-- WHAT: role_update_with_permissions(role, set_name, name, set_description,
-- description, permission ids or NULL = leave the set alone). The whole set is
-- replaced inside the function; any failure rolls all of it back. Unknown role
-- ⇒ ROLE_NOT_FOUND. Platform-wide roles only — the route is platform-admin.
--
-- Additive, idempotent, safe to run twice.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.role_update_with_permissions(
  p_role_id uuid,
  p_set_name boolean,
  p_name text,
  p_set_description boolean,
  p_description text,
  p_permission_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  UPDATE roles
     SET name        = CASE WHEN p_set_name THEN p_name ELSE name END,
         description = CASE WHEN p_set_description THEN p_description ELSE description END,
         updated_at  = now()
   WHERE id = p_role_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROLE_NOT_FOUND';
  END IF;

  IF p_permission_ids IS NOT NULL THEN
    DELETE FROM role_permissions WHERE role_id = p_role_id;
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT p_role_id, pid FROM (SELECT DISTINCT unnest(p_permission_ids) AS pid) ids;
  END IF;
END
$fn$;

REVOKE ALL ON FUNCTION public.role_update_with_permissions(uuid, boolean, text, boolean, text, uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.role_update_with_permissions(uuid, boolean, text, boolean, text, uuid[])
  TO service_role;

COMMENT ON FUNCTION public.role_update_with_permissions(uuid, boolean, text, boolean, text, uuid[])
  IS 'role-permissions-atomic-01:rev1';

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION (the service falls back to a checked sequence, with a log):
-- ============================================================================
/*
DROP FUNCTION IF EXISTS public.role_update_with_permissions(uuid, boolean, text, boolean, text, uuid[]);
*/
