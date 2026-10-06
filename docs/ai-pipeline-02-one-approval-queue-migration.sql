-- ============================================================================
-- AI PIPELINE — 02 (ONE approval queue).
-- Additive, idempotent. Run AFTER:
--   docs/ai-action-requests-01-migration.sql
--   docs/ai-pipeline-01-migration.sql
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-ai-pipeline-02.sql.
--
-- There were two places where a person approved what an assistant asked for:
-- `ai_action_requests` (an outside assistant, through MCP) and a second claim
-- on `ai_pipeline_runs` (the in-app assistant). Two queues means two rules for
-- «who may approve» and two screens that can disagree.
--
-- From here there is ONE: `ai_action_requests`. A request comes either from an
-- API key (MCP) or from a run of the in-app pipeline — exactly one of the two —
-- and it is approved, rejected and executed through the same routes
-- (/api/ai-requests/:id/approve|reject), claimed by the same conditional
-- update, under the same forward-only trigger.
--
--   key_id   becomes nullable: the in-app assistant has a person, not a key.
--   run_id   the pipeline run a request belongs to (at most one per run).
--   risk     gains 'write': a non-financial change from the in-app assistant
--            still waits for a person unless the owner allowed it to run by rule.
-- ============================================================================

ALTER TABLE public.ai_action_requests ALTER COLUMN key_id DROP NOT NULL;

ALTER TABLE public.ai_action_requests
  ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES public.ai_pipeline_runs (id);

COMMENT ON COLUMN public.ai_action_requests.run_id IS
  'The in-app pipeline run this request belongs to. NULL for a request made with an API key.';

-- One request per run: a run is proposed once and decided once.
CREATE UNIQUE INDEX IF NOT EXISTS ai_action_requests_run_idx
  ON public.ai_action_requests (run_id)
  WHERE run_id IS NOT NULL;

-- The risk classes. The original check was written inline (and so got the
-- default name); it is replaced by a named one that also allows 'write'.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.ai_action_requests'::regclass
       AND conname = 'ai_action_requests_risk_check'
  ) THEN
    ALTER TABLE public.ai_action_requests DROP CONSTRAINT ai_action_requests_risk_check;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.ai_action_requests'::regclass
       AND conname = 'ai_action_requests_risk_allowed'
  ) THEN
    ALTER TABLE public.ai_action_requests
      ADD CONSTRAINT ai_action_requests_risk_allowed
      CHECK (risk IN ('write', 'financial', 'destructive'));
  END IF;

  -- Exactly one origin: an API key, or a pipeline run. Never both, never none.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.ai_action_requests'::regclass
       AND conname = 'ai_action_requests_one_origin'
  ) THEN
    ALTER TABLE public.ai_action_requests
      ADD CONSTRAINT ai_action_requests_one_origin
      CHECK ((key_id IS NOT NULL) <> (run_id IS NOT NULL));
  END IF;

  -- Through MCP a plain write runs at once and is never queued; only the
  -- in-app assistant queues one.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.ai_action_requests'::regclass
       AND conname = 'ai_action_requests_write_is_in_app'
  ) THEN
    ALTER TABLE public.ai_action_requests
      ADD CONSTRAINT ai_action_requests_write_is_in_app
      CHECK (risk <> 'write' OR run_id IS NOT NULL);
  END IF;
END $$;

-- Forward only, as before — and the origin is part of what was asked.
CREATE OR REPLACE FUNCTION public.ai_action_requests_move_forward_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AI_REQUEST_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.tool IS DISTINCT FROM OLD.tool
     OR NEW.arguments IS DISTINCT FROM OLD.arguments
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.key_id IS DISTINCT FROM OLD.key_id
     OR NEW.run_id IS DISTINCT FROM OLD.run_id
     OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
     OR NEW.risk IS DISTINCT FROM OLD.risk THEN
    RAISE EXCEPTION 'AI_REQUEST_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
       (OLD.status = 'pending'  AND NEW.status IN ('approved', 'rejected'))
    OR (OLD.status = 'approved' AND NEW.status IN ('executed', 'failed'))
  ) THEN
    RAISE EXCEPTION 'AI_REQUEST_ALREADY_DECIDED' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Mitigation first: set `enabled = false` in ai_pipeline_settings. No in-app
-- request is then created or approved, and the MCP queue is unaffected.
--
-- The column can only be removed once no in-app request exists (they have no
-- key, and `key_id` cannot be made NOT NULL again while they do):
--
--   ALTER TABLE public.ai_action_requests DROP CONSTRAINT IF EXISTS ai_action_requests_write_is_in_app;
--   ALTER TABLE public.ai_action_requests DROP CONSTRAINT IF EXISTS ai_action_requests_one_origin;
--   DROP INDEX IF EXISTS public.ai_action_requests_run_idx;
--   -- only if `SELECT count(*) FROM ai_action_requests WHERE run_id IS NOT NULL` is 0:
--   ALTER TABLE public.ai_action_requests DROP COLUMN IF EXISTS run_id;
--   ALTER TABLE public.ai_action_requests ALTER COLUMN key_id SET NOT NULL;
