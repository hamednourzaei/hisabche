-- ============================================================================
-- AI PIPELINE — 01 (runs, their audit trail, and the per-business switch).
-- Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-ai-pipeline-01.sql.
--
-- The in-app assistant could only READ. The pipeline lets a person ASK for a
-- change in words («یک فاکتور برای احمد بزن»), and turns that into:
--
--   understand → authorize → investigate → ask → propose → confirm →
--   execute (the SAME route a person uses) → verify → audit
--
-- Nothing here writes an invoice, a payment or a customer. Those are written by
-- their own routes; these three tables only record what was asked, what was
-- proposed, who agreed, and what came of it.
--
--   ai_pipeline_settings  the switch (`ai_pipeline_v2`). OFF until an owner
--                         turns it on. Auto-approval is a second switch, OFF.
--   ai_pipeline_runs      one row per request. Moves forward only.
--   ai_pipeline_steps     one row per stage of a run. Append-only.
-- ============================================================================

-- ─── The switch ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_pipeline_settings (
  workspace_id               uuid PRIMARY KEY,
  enabled                    boolean NOT NULL DEFAULT false,
  -- Even when true, only operations that are NOT financial may skip the
  -- person's approval. The server decides which those are; this is not it.
  auto_approve_non_financial boolean NOT NULL DEFAULT false,
  updated_by                 uuid,
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_pipeline_settings IS
  'Per-business switch for the AI action pipeline (ai_pipeline_v2). Absent row = off.';

ALTER TABLE public.ai_pipeline_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_pipeline_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ai_pipeline_settings FROM service_role;
GRANT SELECT, INSERT, UPDATE ON public.ai_pipeline_settings TO service_role;

-- ─── Runs ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_pipeline_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  requested_by  uuid NOT NULL,
  request_text  text NOT NULL CHECK (char_length(request_text) BETWEEN 1 AND 2000),
  -- A dry run stops at the proposal and can never be approved.
  dry_run       boolean NOT NULL DEFAULT false,
  operation     text CHECK (operation IS NULL OR operation IN
                  ('create_invoice', 'register_payment', 'create_customer', 'update_customer')),
  status        text NOT NULL DEFAULT 'understanding' CHECK (status IN
                  ('understanding', 'needs_input', 'proposed', 'approved',
                   'executed', 'failed', 'needs_review', 'rejected', 'refused')),
  -- What has been understood so far; grows while questions are answered.
  draft         jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(draft) = 'object'),
  questions     jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(questions) = 'array'),
  -- The normalized command and the human-readable diff. Frozen once proposed.
  command       jsonb,
  proposal      jsonb,
  -- Why a run stopped without a proposal or failed (a code, never a stack).
  reason_code   text,
  approved_by   uuid,
  approved_at   timestamptz,
  auto_approved boolean NOT NULL DEFAULT false,
  -- The HTTP status and body of the route that ran, once it has.
  result_status integer,
  result        jsonb,
  -- What the run created or changed, so a document can show its AI history.
  entity_type   text CHECK (entity_type IS NULL OR entity_type IN ('invoice', 'payment', 'customer')),
  entity_id     uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- A run that was agreed to names who agreed.
  CONSTRAINT ai_pipeline_runs_approval_has_approver
    CHECK (status NOT IN ('approved', 'executed', 'needs_review')
           OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  -- A proposal exists from the moment a run is proposed.
  CONSTRAINT ai_pipeline_runs_proposed_has_proposal
    CHECK (status NOT IN ('proposed', 'approved', 'executed', 'needs_review')
           OR (operation IS NOT NULL AND command IS NOT NULL AND proposal IS NOT NULL))
);

COMMENT ON TABLE public.ai_pipeline_runs IS
  'One request made to the AI action pipeline. Holds the request, the proposal and the outcome; never a credential.';

CREATE INDEX IF NOT EXISTS ai_pipeline_runs_workspace_idx
  ON public.ai_pipeline_runs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_pipeline_runs_requester_idx
  ON public.ai_pipeline_runs (workspace_id, requested_by, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_pipeline_runs_entity_idx
  ON public.ai_pipeline_runs (workspace_id, entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

ALTER TABLE public.ai_pipeline_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_pipeline_runs FROM PUBLIC, anon, authenticated;
-- service_role is revoked FIRST: on Supabase a new table arrives with ALL
-- already granted to it, so a narrower GRANT alone changes nothing.
REVOKE ALL ON public.ai_pipeline_runs FROM service_role;
GRANT SELECT, INSERT, UPDATE ON public.ai_pipeline_runs TO service_role;

-- Forward only. What was asked is never rewritten; what was proposed is never
-- rewritten after it was shown; a decided run is never re-opened — re-opening
-- one would run a financial action twice.
CREATE OR REPLACE FUNCTION public.ai_pipeline_runs_move_forward_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AI_RUN_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
     OR NEW.request_text IS DISTINCT FROM OLD.request_text
     OR NEW.dry_run IS DISTINCT FROM OLD.dry_run
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'AI_RUN_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;

  -- Once a proposal was shown, what was proposed is what runs.
  IF OLD.status NOT IN ('understanding', 'needs_input')
     AND (NEW.operation IS DISTINCT FROM OLD.operation
          OR NEW.command IS DISTINCT FROM OLD.command
          OR NEW.proposal IS DISTINCT FROM OLD.proposal
          OR NEW.draft IS DISTINCT FROM OLD.draft) THEN
    RAISE EXCEPTION 'AI_RUN_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.status = 'approved' AND OLD.dry_run THEN
    RAISE EXCEPTION 'AI_RUN_IS_DRY_RUN' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
       (OLD.status = 'understanding' AND NEW.status IN ('understanding', 'needs_input', 'proposed', 'refused', 'failed'))
    OR (OLD.status = 'needs_input'   AND NEW.status IN ('needs_input', 'proposed', 'refused', 'failed', 'rejected'))
    OR (OLD.status = 'proposed'      AND NEW.status IN ('approved', 'rejected'))
    OR (OLD.status = 'approved'      AND NEW.status IN ('executed', 'failed', 'needs_review'))
  ) THEN
    RAISE EXCEPTION 'AI_RUN_ALREADY_DECIDED' USING ERRCODE = 'P0001';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_pipeline_runs_forward_only_trg ON public.ai_pipeline_runs;
CREATE TRIGGER ai_pipeline_runs_forward_only_trg
  BEFORE UPDATE OR DELETE ON public.ai_pipeline_runs
  FOR EACH ROW EXECUTE FUNCTION public.ai_pipeline_runs_move_forward_only();

-- ─── Steps: the audit trail ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_pipeline_steps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       uuid NOT NULL REFERENCES public.ai_pipeline_runs (id),
  workspace_id uuid NOT NULL,
  stage        text NOT NULL CHECK (stage IN
                 ('understand', 'authorize', 'investigate', 'ask', 'propose',
                  'validate', 'confirm', 'execute', 'verify')),
  outcome      text NOT NULL CHECK (outcome IN ('ok', 'stopped', 'failed')),
  -- The person acting at this stage (the requester, or whoever approved).
  actor_id     uuid,
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(detail) = 'object'),
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_pipeline_steps IS
  'Append-only audit trail of the AI action pipeline: one row per stage of a run.';

CREATE INDEX IF NOT EXISTS ai_pipeline_steps_run_idx
  ON public.ai_pipeline_steps (run_id, created_at);

ALTER TABLE public.ai_pipeline_steps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_pipeline_steps FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ai_pipeline_steps FROM service_role;
GRANT SELECT, INSERT ON public.ai_pipeline_steps TO service_role;

CREATE OR REPLACE FUNCTION public.ai_pipeline_steps_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AI_STEP_APPEND_ONLY' USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS ai_pipeline_steps_append_only_trg ON public.ai_pipeline_steps;
CREATE TRIGGER ai_pipeline_steps_append_only_trg
  BEFORE UPDATE OR DELETE ON public.ai_pipeline_steps
  FOR EACH ROW EXECUTE FUNCTION public.ai_pipeline_steps_append_only();

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Mitigation first: set `enabled = false` in ai_pipeline_settings — the
-- pipeline then refuses every new run and nothing else changes.
--
-- Removing the tables removes the history of what the assistant was asked and
-- who approved it. Whatever was executed stays in the books: those invoices,
-- payments and customers were written by their own routes.
--
--   DROP TABLE IF EXISTS public.ai_pipeline_steps;
--   DROP TABLE IF EXISTS public.ai_pipeline_runs;
--   DROP TABLE IF EXISTS public.ai_pipeline_settings;
--   DROP FUNCTION IF EXISTS public.ai_pipeline_steps_append_only();
--   DROP FUNCTION IF EXISTS public.ai_pipeline_runs_move_forward_only();
