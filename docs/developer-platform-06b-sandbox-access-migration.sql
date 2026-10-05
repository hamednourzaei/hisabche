-- ============================================================================
-- Developer platform 06b — a sandbox its owner can actually open
--
-- Reported on the live site (5 Oct 2026): pressing «محیط آزمایشی» moved the
-- owner into the sandbox and EVERY request answered 403. The data looked
-- «zeroed», and the notice with the way back did not render, because it too
-- is read through a request that was refused.
--
-- Cause: create_sandbox_workspace (migration 06) inserted the owner's
-- membership WITHOUT has_access and relied on the column default. The
-- authorization path (resolve_workspace_access, tenancy.service) requires
-- has_access = true. On a database where that default went missing — the same
-- drift docs/FIX-403.sql was written for — the sandbox owner's membership has
-- has_access NULL/false: a member the server lists and then refuses.
--
-- This migration:
--   1. re-creates the function with has_access = true written EXPLICITLY, and
--      repairs the membership when the sandbox already exists (so pressing the
--      button again heals a broken one);
--   2. repairs every existing sandbox owner membership.
--
-- Not a guess about a person (§12): the row repaired is «the owner of a sandbox
-- may open their own sandbox», which the function was written to create. No
-- other membership is touched, and a SUSPENDED membership is left suspended.
--
-- Additive, idempotent, re-runnable. Changes no table shape.
--
-- Rollback / mitigation: re-run docs/developer-platform-06-sandbox-migration.sql
-- to restore the previous function body. The repaired rows need no rollback —
-- has_access = true on a sandbox's own owner is the intended state.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.create_sandbox_workspace(p_parent uuid, p_user uuid)
RETURNS TABLE (id uuid, name text, created boolean)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_parent public.workspaces%ROWTYPE;
  v_id     uuid;
  v_name   text;
BEGIN
  -- Serialises two concurrent requests for the same business.
  SELECT * INTO v_parent FROM public.workspaces w WHERE w.id = p_parent FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SANDBOX_PARENT_NOT_FOUND' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_parent.is_sandbox THEN
    RAISE EXCEPTION 'SANDBOX_OF_SANDBOX' USING ERRCODE = 'check_violation';
  END IF;
  -- The backend checked workspace.manage; this is the floor under it.
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members m
     WHERE m.workspace_id = p_parent AND m.user_id = p_user
  ) THEN
    RAISE EXCEPTION 'SANDBOX_NOT_MEMBER' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT w.id, w.name INTO v_id, v_name
    FROM public.workspaces w
   WHERE w.sandbox_of = p_parent AND w.owner_id = p_user;
  IF FOUND THEN
    -- An existing sandbox whose owner cannot open it is healed here, so the
    -- same button that broke it mends it. A suspension is somebody's decision
    -- and stays.
    UPDATE public.workspace_members m
       SET has_access = true
     WHERE m.workspace_id = v_id AND m.user_id = p_user
       AND m.has_access IS DISTINCT FROM true;
    RETURN QUERY SELECT v_id, v_name, false;
    RETURN;
  END IF;

  v_name := left(v_parent.name, 80) || ' (sandbox)';
  INSERT INTO public.workspaces (name, slug, owner_id, is_sandbox, sandbox_of)
  VALUES (
    v_name,
    v_parent.slug || '-sandbox-' || left(replace(gen_random_uuid()::text, '-', ''), 8),
    p_user,
    true,
    p_parent
  )
  RETURNING workspaces.id INTO v_id;

  -- has_access is written, never left to the column default: the default has
  -- gone missing on a live database before (docs/FIX-403.sql).
  INSERT INTO public.workspace_members (workspace_id, user_id, role, has_access)
  VALUES (v_id, p_user, 'owner', true);

  RETURN QUERY SELECT v_id, v_name, true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sandbox_workspace(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_sandbox_workspace(uuid, uuid) TO service_role;

-- Every sandbox that already exists: its own owner may open it.
UPDATE public.workspace_members m
   SET has_access = true
  FROM public.workspaces w
 WHERE w.id = m.workspace_id
   AND w.is_sandbox
   AND m.user_id = w.owner_id
   AND m.has_access IS DISTINCT FROM true;

COMMIT;

NOTIFY pgrst, 'reload schema';
