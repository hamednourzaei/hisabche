-- ============================================================================
-- AI ACTION REQUESTS — 01 (the confirmation step of the MCP gateway).
-- Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-ai-action-requests-01.sql.
--
-- An AI assistant connected through MCP may READ what its API key allows, and
-- make low-risk changes. An action that moves money or stock, or cannot be
-- undone — issuing an invoice, fulfilling or cancelling an order — is NOT run
-- when the assistant asks for it. It is stored here as a request, and a person
-- (manager or owner) approves or rejects it inside Hisabche. On approval the
-- server runs the SAME Public API route a person would have used, as that
-- person.
--
-- This table is that queue and its record: what was asked, by which key, who
-- decided, and what came of it. It stores the arguments of the request and
-- never a credential.
--
-- A request moves forward only: pending → approved → executed | failed, or
-- pending → rejected. The trigger below refuses any other change, so a decided
-- request can never be re-opened and run again.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_action_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  -- The API key (or OAuth app token — also an api_keys row) that asked.
  key_id        uuid NOT NULL,
  -- The person that key acts for.
  requested_by  uuid NOT NULL,
  tool          text NOT NULL CHECK (tool ~ '^[a-z][a-z0-9_]{1,59}$'),
  risk          text NOT NULL CHECK (risk IN ('financial', 'destructive')),
  arguments     jsonb NOT NULL CHECK (jsonb_typeof(arguments) = 'object'),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'executed', 'failed', 'rejected')),
  -- The HTTP status and body of the route that ran, once it has.
  result_status integer,
  result        jsonb,
  decided_by    uuid,
  decided_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- A decided request names who decided it.
  CONSTRAINT ai_action_requests_decision_has_decider
    CHECK (status = 'pending' OR (decided_by IS NOT NULL AND decided_at IS NOT NULL))
);

COMMENT ON TABLE public.ai_action_requests IS
  'Actions an AI assistant asked for through MCP that need a person''s approval. Holds arguments, never credentials.';

CREATE INDEX IF NOT EXISTS ai_action_requests_workspace_idx
  ON public.ai_action_requests (workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_action_requests_key_idx
  ON public.ai_action_requests (key_id, created_at DESC);

ALTER TABLE public.ai_action_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_action_requests FROM PUBLIC, anon, authenticated;
-- ⚠️ `service_role` is revoked FIRST. On Supabase a new table in `public`
-- arrives with ALL privileges already granted to it (default privileges), so
-- granting a narrower set on top changes nothing. The first version of this
-- script only granted, and its VERIFY reported the backend role could still
-- UPDATE and DELETE. Safe to run again.
REVOKE ALL ON public.ai_action_requests FROM service_role;
GRANT SELECT, INSERT, UPDATE ON public.ai_action_requests TO service_role;

-- Forward only. What was asked is never rewritten, and a decided request is
-- never re-opened — re-opening one would run a financial action twice.
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

DROP TRIGGER IF EXISTS ai_action_requests_forward_only_trg ON public.ai_action_requests;
CREATE TRIGGER ai_action_requests_forward_only_trg
  BEFORE UPDATE OR DELETE ON public.ai_action_requests
  FOR EACH ROW EXECUTE FUNCTION public.ai_action_requests_move_forward_only();

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes the queue and its history. Whatever was already executed stays in
-- the books: those invoices and orders were written by their own routes.
--
--   DROP TABLE IF EXISTS public.ai_action_requests;
--   DROP FUNCTION IF EXISTS public.ai_action_requests_move_forward_only();
