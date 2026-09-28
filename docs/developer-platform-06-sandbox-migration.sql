-- ============================================================================
-- DEVELOPER PLATFORM 06 — sandbox workspaces.
-- Additive, idempotent, re-runnable. Needs only the base schema (workspaces,
-- workspace_members).
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then docs/VERIFY-developer-platform-06.sql.
-- Status: PENDING HUMAN CONFIRMATION.
--
-- THE MODEL — a sandbox IS a workspace (G2)
--
--   A developer testing an integration needs somewhere whose invoices, stock
--   and ledger are not the real books. A sandbox is an ordinary workspace
--   with `is_sandbox = true` and `sandbox_of` pointing at the business it
--   belongs to. Because it is its own workspace_id, every existing boundary
--   isolates it already: RLS, API keys (a key belongs to ONE workspace),
--   webhooks, OAuth installations, the per-key rate limit. Nothing new has to
--   learn the word «sandbox» to keep test data out of the real books.
--
--   One sandbox per (business, person): each manager tests in their own, and
--   is its owner. A sandbox cannot have a sandbox.
--
-- WHAT IT IS NOT
--
--   Not a copy of the real books — it starts empty. Copying real customers
--   into a test space would put real people's data where test keys reach it.
--
-- ONE STATEMENT, NOT TWO REQUESTS
--
--   The workspace row and the owner's membership are written by one function
--   (create_sandbox_workspace), in one transaction. supabase-js has no
--   transactions, and a compensating DELETE is forbidden (CLAUDE.md §1.4).
-- ============================================================================

BEGIN;

ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS is_sandbox boolean NOT NULL DEFAULT false;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS sandbox_of uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_sandbox_of_fkey') THEN
    -- The real business deleted → the sandbox stays a sandbox (is_sandbox is
    -- kept), it only loses its pointer. It never turns into real books.
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_sandbox_of_fkey
      FOREIGN KEY (sandbox_of) REFERENCES public.workspaces(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_sandbox_shape') THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_sandbox_shape
      CHECK ((sandbox_of IS NULL OR is_sandbox) AND sandbox_of IS DISTINCT FROM id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_one_sandbox_per_owner
  ON public.workspaces (sandbox_of, owner_id)
  WHERE sandbox_of IS NOT NULL;

-- ─── A workspace never changes sides ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.workspaces_sandbox_is_permanent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_sandbox IS DISTINCT FROM OLD.is_sandbox THEN
    RAISE EXCEPTION 'SANDBOX_FLAG_IS_PERMANENT' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspaces_sandbox_is_permanent_trg ON public.workspaces;
CREATE TRIGGER workspaces_sandbox_is_permanent_trg
  BEFORE UPDATE OF is_sandbox ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.workspaces_sandbox_is_permanent();

-- ─── Create (or return) this person's sandbox of this business ──────────────

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

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_id, p_user, 'owner');

  RETURN QUERY SELECT v_id, v_name, true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sandbox_workspace(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_sandbox_workspace(uuid, uuid) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- Stop new sandboxes, keep existing ones (they are ordinary workspaces):
--   REVOKE EXECUTE ON FUNCTION public.create_sandbox_workspace(uuid, uuid) FROM service_role;
--
-- Remove the feature. ⚠️ Existing sandboxes then look like real workspaces —
-- list them first and decide with their owners:
--   SELECT id, name, owner_id, sandbox_of FROM public.workspaces WHERE is_sandbox;
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.create_sandbox_workspace(uuid, uuid);
--   DROP TRIGGER IF EXISTS workspaces_sandbox_is_permanent_trg ON public.workspaces;
--   DROP FUNCTION IF EXISTS public.workspaces_sandbox_is_permanent();
--   DROP INDEX IF EXISTS public.workspaces_one_sandbox_per_owner;
--   ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_sandbox_shape;
--   ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_sandbox_of_fkey;
--   ALTER TABLE public.workspaces DROP COLUMN IF EXISTS sandbox_of;
--   ALTER TABLE public.workspaces DROP COLUMN IF EXISTS is_sandbox;
--   COMMIT;
-- ============================================================================
