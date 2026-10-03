-- ============================================================================
-- AUTOMATION — 01: standing arrangements a business defines, and their history.
-- Capability #63 (recurring invoice). Additive, idempotent (safe to run twice).
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-automation-01.sql and report the result.
--
-- WHAT THIS IS
--
--   automations       what should happen, when, and what to do when it fails
--   automation_runs   every evaluation of a due slot — ran, skipped or failed —
--                     with the reason. The skips are the point: «why did my
--                     monthly invoice stop in March» is answered by a row, not
--                     by an absence.
--
-- WHAT THIS IS NOT
--
--   Not a job runtime. The work is claimed once per day across all instances by
--   the existing `claim_scheduled_run`, and each action goes through the
--   product's own service (a recurring invoice is issued by InvoiceService, the
--   same code path as a person pressing «ثبت»). Nothing here writes an invoice,
--   a stock movement or a ledger line.
--
--   Not a script host. `action_type` names an operation the backend knows; there
--   is no SQL, URL or code in a row.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.automations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL,
  name            text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  -- The operation. Validated by the backend against its closed set; kept free
  -- of a CHECK here so adding an action is a code change, not a schema change.
  action_type     text NOT NULL,
  -- { kind: 'monthly', dayOfMonth, from } | { kind: 'interval', everyDays, from }
  -- | { kind: 'once', on }
  cadence         jsonb NOT NULL,
  -- NULL = always. An array of { field, operator, value }.
  conditions      jsonb,
  -- What the action operates on (for a recurring invoice: the invoice template).
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled         boolean NOT NULL DEFAULT true,
  -- stop: disable after max_attempts failures · keep: keep trying · ignore: record and move on
  on_failure      text NOT NULL DEFAULT 'stop' CHECK (on_failure IN ('stop', 'keep', 'ignore')),
  max_attempts    integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 20),
  -- Consecutive failures. Reset to 0 by a successful run.
  attempts        integer NOT NULL DEFAULT 0,
  -- Set when the failure policy switched it off, so the screen can say WHY it
  -- is off — «you paused it» and «it failed three times» are different.
  disabled_reason text,
  -- The last calendar day this row was evaluated. The runner walks every day
  -- AFTER it up to today, so a server that was down on the 1st still issues the
  -- 1st's invoice — dated the 1st.
  last_checked_on date,
  last_run_at     timestamptz,
  -- Soft removal: history rows keep pointing at it.
  archived_at     timestamptz,
  created_by      uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.automations IS
  'A standing arrangement (e.g. a recurring invoice): what, when, and the failure policy. Executed by the backend through the product''s own services.';

CREATE INDEX IF NOT EXISTS automations_workspace_idx
  ON public.automations (workspace_id, created_at DESC)
  WHERE archived_at IS NULL;
-- The daily pass: everything live, across workspaces.
CREATE INDEX IF NOT EXISTS automations_due_idx
  ON public.automations (last_checked_on)
  WHERE enabled AND archived_at IS NULL;


CREATE TABLE IF NOT EXISTS public.automation_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  automation_id uuid NOT NULL REFERENCES public.automations (id) ON DELETE CASCADE,
  -- The calendar day this run is FOR (not the day it happened).
  slot          date NOT NULL,
  outcome       text NOT NULL CHECK (outcome IN ('ran', 'skipped', 'failed')),
  -- A code or a short reason. Never a stack trace, never request data.
  detail        text NOT NULL DEFAULT '',
  -- What the run produced (the invoice id), when it produced something.
  document_type text,
  document_id   uuid,
  duration_ms   integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.automation_runs IS
  'Every evaluation of a due slot — ran, skipped or failed — with its reason. Append-only.';

CREATE INDEX IF NOT EXISTS automation_runs_automation_idx
  ON public.automation_runs (automation_id, created_at DESC);

-- ⚠️ ONE SUCCESS PER SLOT. The scheduler already runs the pass once per day
-- across instances, and the invoice itself is idempotent on a key derived from
-- (automation, slot). This is the third lock, at the level where a manual «run
-- now» racing the nightly pass cannot get past it: the second INSERT fails on
-- 23505 and the caller reports «already ran».
CREATE UNIQUE INDEX IF NOT EXISTS automation_runs_one_success_per_slot
  ON public.automation_runs (automation_id, slot)
  WHERE outcome = 'ran';


-- Internal: read and written by the backend with service_role only. RLS on, no
-- policy, no grant to a browser role — the template holds customer and price data.
ALTER TABLE public.automations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automations     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.automation_runs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.automations     TO service_role;
GRANT ALL ON public.automation_runs TO service_role;

NOTIFY pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK / MITIGATION
-- ═══════════════════════════════════════════════════════════════════════════
--
-- To stop every automation without losing anything:
--
--   UPDATE public.automations SET enabled = false, disabled_reason = 'PAUSED_BY_OPERATOR';
--
-- The backend answers «not configured» when the tables are missing, so a full
-- rollback is safe for the application — but it deletes the arrangements and
-- their history. Invoices already issued by a run are ordinary invoices and are
-- NOT touched by any of this:
--
--   DROP TABLE IF EXISTS public.automation_runs;
--   DROP TABLE IF EXISTS public.automations;
