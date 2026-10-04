-- ============================================================================
-- WORKFLOW ESCALATION — 01 (capability #68). Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-workflow-escalation-01.sql.
--
-- WHAT THIS ADDS
--
--   workflows.escalate_*            the policy: «if a step waits more than N
--                                   hours, a higher role may act on it too»
--   workflow_instances.escalated_*  what happened to ONE document: which role
--                                   it was escalated to, how many times, when
--   workflow_escalations            the record of every escalation decision
--
-- WHAT ESCALATION DOES, AND DOES NOT
--
--   It WIDENS who may act on the waiting step and TELLS them. It never
--   approves, never rejects and never skips a step: a document moving money
--   because nobody answered would be an approval decided by a calendar.
--
-- ⚠️ DEFAULT IS OFF. `escalate_after_hours` is NULL on every existing and new
-- workflow, so nothing escalates until a person sets a policy.
-- ============================================================================

ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS escalate_after_hours numeric(8, 2);
ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS escalate_to_role text;
ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS escalate_max_times integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflows_escalation_check') THEN
    ALTER TABLE public.workflows ADD CONSTRAINT workflows_escalation_check CHECK (
      -- Both or neither: half a policy is not a policy.
      --
      -- ⚠️ THE `IS NOT NULL`s ARE THE CONSTRAINT. A CHECK passes when its
      -- expression is NULL, and `24 > 0 AND NULL IN (…)` is NULL — so without
      -- them «24 hours, no role» was ACCEPTED. Found by running this file in a
      -- real Postgres (workflow-escalation.pg.test.ts), not by reading it.
      (escalate_after_hours IS NULL AND escalate_to_role IS NULL)
      OR (
        escalate_after_hours IS NOT NULL AND escalate_to_role IS NOT NULL
        AND escalate_after_hours > 0 AND escalate_to_role IN ('manager', 'owner')
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflows_escalation_times_check') THEN
    ALTER TABLE public.workflows ADD CONSTRAINT workflows_escalation_times_check
      CHECK (escalate_max_times BETWEEN 1 AND 5);
  END IF;
END $$;

ALTER TABLE public.workflow_instances ADD COLUMN IF NOT EXISTS escalated_role text;
ALTER TABLE public.workflow_instances ADD COLUMN IF NOT EXISTS escalations integer NOT NULL DEFAULT 0;
ALTER TABLE public.workflow_instances ADD COLUMN IF NOT EXISTS escalated_at timestamptz;
-- The step the escalation belongs to. A document that moves on to its next
-- step starts that step un-escalated.
ALTER TABLE public.workflow_instances ADD COLUMN IF NOT EXISTS escalated_step integer;

CREATE TABLE IF NOT EXISTS public.workflow_escalations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  instance_id   uuid NOT NULL,
  step_order    integer NOT NULL,
  from_role     text NOT NULL,
  to_role       text NOT NULL,
  -- 'escalated' — the higher role may now act and was told.
  -- 'no_one'    — the policy's role holds nobody; reported, nothing changed.
  outcome       text NOT NULL CHECK (outcome IN ('escalated', 'no_one')),
  hours_waiting numeric(10, 2) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workflow_escalations IS
  'Every escalation decision on a waiting approval step. Append-only.';

-- ⚠️ ONCE PER (document, step, role, outcome). The hourly pass meets the same
-- waiting step again and again; without this, «nobody holds that role» would be
-- reported every hour, and a retried pass would notify the same people twice.
CREATE UNIQUE INDEX IF NOT EXISTS workflow_escalations_once
  ON public.workflow_escalations (instance_id, step_order, to_role, outcome);
CREATE INDEX IF NOT EXISTS workflow_escalations_workspace_idx
  ON public.workflow_escalations (workspace_id, created_at DESC);

ALTER TABLE public.workflow_escalations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workflow_escalations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.workflow_escalations TO service_role;

-- The hourly pass: documents still waiting, per workflow.
CREATE INDEX IF NOT EXISTS workflow_instances_waiting_idx
  ON public.workflow_instances (workflow_id)
  WHERE status = 'in_progress';

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK / MITIGATION
-- ═══════════════════════════════════════════════════════════════════════════
--
-- To switch every escalation off without losing anything:
--
--   UPDATE public.workflows SET escalate_after_hours = NULL, escalate_to_role = NULL;
--
-- To take back the wider access already granted on waiting documents:
--
--   UPDATE public.workflow_instances
--      SET escalated_role = NULL, escalated_step = NULL WHERE status = 'in_progress';
--
-- Full removal (the approvals themselves are untouched):
--
--   DROP TABLE IF EXISTS public.workflow_escalations;
--   ALTER TABLE public.workflow_instances
--     DROP COLUMN IF EXISTS escalated_role, DROP COLUMN IF EXISTS escalations,
--     DROP COLUMN IF EXISTS escalated_at,  DROP COLUMN IF EXISTS escalated_step;
--   ALTER TABLE public.workflows
--     DROP CONSTRAINT IF EXISTS workflows_escalation_check,
--     DROP CONSTRAINT IF EXISTS workflows_escalation_times_check,
--     DROP COLUMN IF EXISTS escalate_after_hours, DROP COLUMN IF EXISTS escalate_to_role,
--     DROP COLUMN IF EXISTS escalate_max_times;
