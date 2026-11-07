-- ============================================================================
-- workspace-create-01 — a workspace and its owner's membership in ONE transaction
--
-- WHAT IT ADDS
--   One function, public.workspace_create_with_owner(...). It inserts the
--   workspace row and the owner's workspace_members row together and returns
--   the new workspace id. Nothing else changes: no table, no column, no data.
--
-- WHY
--   WorkspaceService.createWorkspace did two separate supabase-js writes
--   (workspaces, then workspace_members). supabase-js has no transactions, so
--   a failed second write left a workspace whose owner was not a member of it:
--   every later request 403, and signup still answered 201 (audit GAP-01/02,
--   docs/product/HISABCHE_WORKFLOW_GAPS_AND_BLOCKERS.md).
--
-- RULES THE DATABASE NOW HOLDS
--   · Both rows, or neither. A failed membership insert rolls the workspace back.
--   · The membership is written explicitly: role 'owner', has_access true,
--     suspended_at NULL — never left to column defaults (they have gone missing
--     on the live database before: docs/FIX-403.sql).
--   · A slug that collides with an existing one (if the live database holds a
--     unique slug) gets a short random suffix instead of failing the signup.
--   · Optional columns from later migrations (stamp_url, base_currency,
--     time_zone) are written only when a value is given, so the function runs
--     on a database that has not run those migrations as long as nobody sends
--     that value.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE
-- Run after: docs/VERIFY-workspace-create-01.sql (every row should be ok = true;
-- see the note on the last row there).
-- Until this runs, the backend falls back to the old two-step write and logs
-- WORKSPACE_ATOMIC_RPC_MISSING on every workspace it creates.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.workspace_create_with_owner(
  p_owner         uuid,
  p_name          text,
  p_slug          text,
  p_description   text DEFAULT NULL,
  p_logo_url      text DEFAULT NULL,
  p_stamp_url     text DEFAULT NULL,
  p_base_currency text DEFAULT NULL,
  p_time_zone     text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id   uuid;
  v_slug text;
BEGIN
  IF p_owner IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_OWNER_REQUIRED' USING ERRCODE = 'not_null_violation';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'WORKSPACE_NAME_REQUIRED' USING ERRCODE = 'check_violation';
  END IF;

  v_slug := COALESCE(NULLIF(btrim(p_slug), ''), lower(regexp_replace(btrim(p_name), '\s+', '-', 'g')));

  BEGIN
    INSERT INTO public.workspaces (name, slug, description, logo_url, owner_id)
    VALUES (p_name, v_slug, p_description, p_logo_url, p_owner)
    RETURNING workspaces.id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO public.workspaces (name, slug, description, logo_url, owner_id)
    VALUES (
      p_name,
      v_slug || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8),
      p_description,
      p_logo_url,
      p_owner
    )
    RETURNING workspaces.id INTO v_id;
  END;

  -- Columns added by later migrations: touched only when a value is given.
  IF p_stamp_url IS NOT NULL THEN
    UPDATE public.workspaces SET stamp_url = p_stamp_url WHERE id = v_id;
  END IF;
  IF p_base_currency IS NOT NULL THEN
    UPDATE public.workspaces SET base_currency = p_base_currency WHERE id = v_id;
  END IF;
  IF p_time_zone IS NOT NULL THEN
    UPDATE public.workspaces SET time_zone = p_time_zone WHERE id = v_id;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, has_access, suspended_at)
  VALUES (v_id, p_owner, 'owner', true, NULL);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.workspace_create_with_owner(uuid, text, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_create_with_owner(uuid, text, text, text, text, text, text, text)
  TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK (manual)
--   DROP FUNCTION IF EXISTS public.workspace_create_with_owner(uuid, text, text, text, text, text, text, text);
--   NOTIFY pgrst, 'reload schema';
-- Nothing is lost: no workspace or membership is touched. The backend goes
-- back to the two-step write (and logs WORKSPACE_ATOMIC_RPC_MISSING).
-- ============================================================================
