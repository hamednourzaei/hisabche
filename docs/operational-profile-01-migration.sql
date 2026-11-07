-- ============================================================================
-- docs/operational-profile-01-migration.sql
--
-- V54 Phase 5.2 + 5.3 — the Operational DNA and the onboarding progress of a
-- WORKSPACE, kept on the server (until now both lived only on the device, so a
-- second phone or a cleared browser started from nothing).
--
-- What it adds (additive, idempotent, safe to re-run):
--   1. public.workspaces.operational_dna          jsonb  — the current 8-axis profile
--      public.workspaces.operational_dna_version  int    — 0 = never declared
--      public.workspaces.onboarding_progress      jsonb  — where the wizard stands
--   2. public.workspace_operational_dna_history  — APPEND-ONLY, one row per version
--      (who, when, what). A trigger refuses UPDATE and DELETE.
--   3. public.workspace_set_operational_dna(...)  — the ONLY writer of the DNA:
--      locks the workspace row, checks the version the caller read
--      (OPERATIONAL_PROFILE_CHANGED when someone saved in between), writes the
--      column and the history row in ONE transaction. Saving the same DNA again
--      is a replay: same version, no new history row.
--
-- ⚠️ The DNA decides presentation and which capabilities are SUGGESTED. It
-- changes no role, no permission, no ledger row, no historical document.
--
-- Prerequisite: none (business-profile-01 not required).
-- ⚠️ NOT run by the assistant. Run in the SQL editor, then
--    docs/VERIFY-operational-profile-01.sql.  Status: PENDING HUMAN CONFIRMATION
-- ============================================================================

-- ── 1. Columns ──────────────────────────────────────────────────────────────
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS operational_dna jsonb,
  ADD COLUMN IF NOT EXISTS operational_dna_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_progress jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_operational_dna_shape') THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_operational_dna_shape CHECK (
        operational_dna IS NULL OR
        (jsonb_typeof(operational_dna) = 'object' AND pg_column_size(operational_dna) < 4096)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_operational_dna_version_nonneg') THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_operational_dna_version_nonneg CHECK (operational_dna_version >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_onboarding_progress_shape') THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_onboarding_progress_shape CHECK (
        onboarding_progress IS NULL OR
        (jsonb_typeof(onboarding_progress) = 'object' AND pg_column_size(onboarding_progress) < 4096)
      );
  END IF;
END $$;

-- ── 2. Append-only history ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workspace_operational_dna_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  version      integer NOT NULL CHECK (version > 0),
  dna          jsonb NOT NULL CHECK (jsonb_typeof(dna) = 'object'),
  changed_by   uuid,
  changed_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_operational_dna_history_one_per_version UNIQUE (workspace_id, version)
);

-- A fresh table is born with ALL for anon/authenticated/service_role in Supabase.
REVOKE ALL ON public.workspace_operational_dna_history FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.workspace_operational_dna_history TO service_role;
ALTER TABLE public.workspace_operational_dna_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.workspace_operational_dna_history_frozen()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- A workspace being deleted takes its history with it (cascade); nothing else may.
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'OPERATIONAL_DNA_HISTORY_IS_APPEND_ONLY' USING ERRCODE = 'P0001';
END $$;

DROP TRIGGER IF EXISTS workspace_operational_dna_history_frozen_trg
  ON public.workspace_operational_dna_history;
CREATE TRIGGER workspace_operational_dna_history_frozen_trg
  BEFORE UPDATE OR DELETE ON public.workspace_operational_dna_history
  FOR EACH ROW EXECUTE FUNCTION public.workspace_operational_dna_history_frozen();

-- ── 3. The one writer ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.workspace_set_operational_dna(
  p_workspace_id     uuid,
  p_actor            uuid,
  p_dna              jsonb,
  p_expected_version integer
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current jsonb;
  v_version integer;
BEGIN
  IF p_dna IS NULL OR jsonb_typeof(p_dna) <> 'object' THEN
    RAISE EXCEPTION 'OPERATIONAL_DNA_INVALID' USING ERRCODE = 'P0001';
  END IF;

  SELECT operational_dna, operational_dna_version
    INTO v_current, v_version
    FROM public.workspaces
   WHERE id = p_workspace_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKSPACE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- The same profile again (a retried save, a second device finishing the
  -- same wizard): the answer, and nothing new.
  IF v_current IS NOT NULL AND v_current = p_dna THEN
    RETURN jsonb_build_object('version', v_version, 'replayed', true);
  END IF;

  IF p_expected_version IS DISTINCT FROM v_version THEN
    RAISE EXCEPTION 'OPERATIONAL_PROFILE_CHANGED' USING ERRCODE = 'P0001';
  END IF;

  v_version := v_version + 1;

  UPDATE public.workspaces
     SET operational_dna = p_dna,
         operational_dna_version = v_version
   WHERE id = p_workspace_id;

  INSERT INTO public.workspace_operational_dna_history (workspace_id, version, dna, changed_by)
  VALUES (p_workspace_id, v_version, p_dna, p_actor);

  RETURN jsonb_build_object('version', v_version, 'replayed', false);
END $$;

REVOKE EXECUTE ON FUNCTION public.workspace_set_operational_dna(uuid, uuid, jsonb, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_set_operational_dna(uuid, uuid, jsonb, integer)
  TO service_role;

-- ── ROLLBACK BLOCK (manual; drops the history — export it first) ───────────
-- DROP FUNCTION IF EXISTS public.workspace_set_operational_dna(uuid, uuid, jsonb, integer);
-- DROP TRIGGER IF EXISTS workspace_operational_dna_history_frozen_trg ON public.workspace_operational_dna_history;
-- DROP FUNCTION IF EXISTS public.workspace_operational_dna_history_frozen();
-- DROP TABLE IF EXISTS public.workspace_operational_dna_history;
-- ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_onboarding_progress_shape;
-- ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_operational_dna_version_nonneg;
-- ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_operational_dna_shape;
-- ALTER TABLE public.workspaces DROP COLUMN IF EXISTS onboarding_progress;
-- ALTER TABLE public.workspaces DROP COLUMN IF EXISTS operational_dna_version;
-- ALTER TABLE public.workspaces DROP COLUMN IF EXISTS operational_dna;
