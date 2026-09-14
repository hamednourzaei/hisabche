-- ============================================================================
-- docs/budget-planning-migration.sql
--
-- Budgets become a planning + control domain: type, uneven distribution,
-- approval state, versioned revisions, consumed commitments, and one batched
-- aggregate for the whole budgets page (replaces one RPC per budget).
--
-- Depends on: docs/tier2-gaps-migration.sql (budgets, budget_commitments).
--
-- ---------------------------------------------------------------------------
-- EXISTING ROWS — §12, no fake backfill
--
--   budget_type  'expense'  — every existing budget was checked against
--                              purchase/expense spend (checkSpend), so this is
--                              what they already were, not a guess.
--   status       'approved' — they were already ENFORCED controls. approved_by
--                              stays NULL: the approver is unknown and is shown
--                              as unknown, never invented.
--   version      1
--   distribution NULL       — NULL means an equal split, which is exactly how
--                              the per-period amount_minor behaved before.
--   consumed_minor 0
--
-- ---------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
--   DROP FUNCTION IF EXISTS public.budget_performance_batch(uuid, date, date);
--   DROP FUNCTION IF EXISTS public.budget_apply_revision(uuid, uuid, integer, bigint, jsonb, text, text, integer, uuid, jsonb);
--   DROP TABLE IF EXISTS public.budget_revisions;
--   ALTER TABLE public.budget_commitments DROP COLUMN IF EXISTS consumed_minor;
--   ALTER TABLE public.budgets DROP COLUMN IF EXISTS name, DROP COLUMN IF EXISTS budget_type,
--     DROP COLUMN IF EXISTS status, DROP COLUMN IF EXISTS version,
--     DROP COLUMN IF EXISTS distribution, DROP COLUMN IF EXISTS notes,
--     DROP COLUMN IF EXISTS approved_by, DROP COLUMN IF EXISTS approved_at,
--     DROP COLUMN IF EXISTS updated_at;
--
-- The backend tolerates every piece of this being absent (42703 / 42P01 /
-- PGRST202): it falls back to the legacy columns and the per-budget RPC.
--
-- ADDITIVE / IDEMPOTENT. SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── budgets ────────────────────────────────────────────────────────────────

ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS name         text;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS budget_type  text NOT NULL DEFAULT 'expense';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS status       text NOT NULL DEFAULT 'approved';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS version      integer NOT NULL DEFAULT 1;
-- [{ "start": "2026-03-21", "amount_minor": 5000000 }, ...] — per sub-period.
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS distribution jsonb;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS notes        text;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS approved_by  uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS approved_at  timestamptz;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();
-- Who drafted it. NULL on rows that predate this column (unknown, not guessed).
-- Separation of duties: the approver may not be the creator.
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS created_by   uuid;

-- New rows start as drafts; the column default above only labels the rows
-- that existed (and were enforced) before this migration.
ALTER TABLE public.budgets ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_type_check;
ALTER TABLE public.budgets ADD CONSTRAINT budgets_type_check
  CHECK (budget_type IN ('expense', 'revenue'));

ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_status_check;
ALTER TABLE public.budgets ADD CONSTRAINT budgets_status_check
  CHECK (status IN ('draft', 'pending_approval', 'approved', 'archived'));

-- `approval` holds an over-budget document for a manager instead of refusing.
-- Widening a CHECK accepts every row the old one accepted.
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_action_check;
ALTER TABLE public.budgets ADD CONSTRAINT budgets_action_check
  CHECK (action IN ('block', 'warn', 'approval', 'track'));

ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_version_check;
ALTER TABLE public.budgets ADD CONSTRAINT budgets_version_check CHECK (version >= 1);

CREATE INDEX IF NOT EXISTS budgets_workspace_scope_idx
  ON public.budgets (workspace_id, account_id, budget_type, status);

-- ─── budget_commitments ─────────────────────────────────────────────────────
--
-- consumed_minor: the part of a commitment that has become actual. Open =
-- amount − consumed (unless released). Moving money from open to actual must
-- never change remaining.

ALTER TABLE public.budget_commitments
  ADD COLUMN IF NOT EXISTS consumed_minor bigint NOT NULL DEFAULT 0;

ALTER TABLE public.budget_commitments DROP CONSTRAINT IF EXISTS budget_commitments_consumed_check;
ALTER TABLE public.budget_commitments ADD CONSTRAINT budget_commitments_consumed_check
  CHECK (consumed_minor >= 0 AND consumed_minor <= amount_minor);

-- ─── budget_revisions — immutable history ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.budget_revisions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL,
  budget_id        uuid NOT NULL REFERENCES public.budgets (id) ON DELETE RESTRICT,
  version          integer NOT NULL,
  previous_version integer NOT NULL,
  reason           text NOT NULL,
  actor_id         uuid NOT NULL,
  -- { amount_minor, distribution, action, warn_at_percent } before and after.
  previous_values  jsonb NOT NULL,
  new_values       jsonb NOT NULL,
  -- [{ line_key, before_minor, after_minor }]
  lines            jsonb NOT NULL,
  approved_by      uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budget_revisions_reason_check CHECK (length(btrim(reason)) > 0),
  CONSTRAINT budget_revisions_version_check CHECK (version = previous_version + 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS budget_revisions_budget_version_key
  ON public.budget_revisions (budget_id, version);
CREATE INDEX IF NOT EXISTS budget_revisions_workspace_idx
  ON public.budget_revisions (workspace_id, budget_id, created_at DESC);

-- A revision is history: no UPDATE, no DELETE, for anyone.
CREATE OR REPLACE FUNCTION public.budget_revisions_immutable()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'BUDGET_REVISION_IMMUTABLE';
END;
$fn$;

DROP TRIGGER IF EXISTS budget_revisions_no_update ON public.budget_revisions;
CREATE TRIGGER budget_revisions_no_update
  BEFORE UPDATE OR DELETE ON public.budget_revisions
  FOR EACH ROW EXECUTE FUNCTION public.budget_revisions_immutable();

ALTER TABLE public.budget_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS budget_revisions_workspace_members ON public.budget_revisions;
CREATE POLICY budget_revisions_workspace_members ON public.budget_revisions
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

-- ─── budget_performance_batch — ONE call for the whole page ─────────────────
--
-- Daily posted movement (days, not calendar months: a budget that starts on
-- 21 March has sub-periods 21st→20th, and only daily rows sum into those) (debit − credit, minor units, rounded per line as
-- budget_consumption does) for every account that has a budget, in
-- [p_start, p_end]; plus open commitments per budget. Sign normalisation by
-- budget type is the backend domain's job, not this function's.

CREATE OR REPLACE FUNCTION public.budget_performance_batch(
  p_workspace_id uuid,
  p_start        date,
  p_end          date
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_build_object(
    'actuals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'account_id', a.account_id,
               'day', a.day,
               'net_minor', a.net_minor))
      FROM (
        SELECT l.account_id,
               to_char(j.date, 'YYYY-MM-DD')                      AS day,
               SUM(ROUND((l.debit - l.credit) * 100))::bigint     AS net_minor
        FROM journal_lines l
        JOIN journal_entries j ON j.id = l.journal_id
        WHERE l.workspace_id = p_workspace_id
          AND j.status = 'posted'
          AND j.date >= p_start
          AND j.date <= p_end
          AND l.account_id IN (
            SELECT b.account_id FROM budgets b WHERE b.workspace_id = p_workspace_id
          )
        GROUP BY l.account_id, j.date
      ) a
    ), '[]'::jsonb),
    'commitments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'budget_id', c.budget_id,
               'open_minor', c.open_minor))
      FROM (
        SELECT bc.budget_id,
               SUM(GREATEST(bc.amount_minor - bc.consumed_minor, 0))::bigint AS open_minor
        FROM budget_commitments bc
        WHERE bc.workspace_id = p_workspace_id
          AND bc.released_at IS NULL
        GROUP BY bc.budget_id
      ) c
    ), '[]'::jsonb)
  );
$fn$;

REVOKE EXECUTE ON FUNCTION public.budget_performance_batch(uuid, date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.budget_performance_batch(uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.budget_performance_batch(uuid, date, date) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.budget_performance_batch(uuid, date, date) TO service_role;

-- The per-budget function must also subtract consumed, or the check path
-- and the page would disagree.
CREATE OR REPLACE FUNCTION public.budget_consumption(
  p_workspace_id uuid,
  p_budget_id    uuid,
  p_account_id   uuid,
  p_start        date,
  p_end          date
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_build_object(
    'actual_minor', (
      SELECT COALESCE(SUM(ROUND((l.debit - l.credit) * 100)), 0)::bigint
      FROM journal_lines l
      JOIN journal_entries j ON j.id = l.journal_id
      WHERE l.workspace_id = p_workspace_id
        AND l.account_id   = p_account_id
        AND j.status       = 'posted'
        AND j.date >= p_start
        AND j.date <= p_end
    ),
    'committed_minor', (
      SELECT COALESCE(SUM(GREATEST(bc.amount_minor - bc.consumed_minor, 0)), 0)::bigint
      FROM budget_commitments bc
      WHERE bc.workspace_id = p_workspace_id
        AND bc.budget_id    = p_budget_id
        AND bc.released_at IS NULL
    )
  );
$fn$;

REVOKE EXECUTE ON FUNCTION public.budget_consumption(uuid, uuid, uuid, date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.budget_consumption(uuid, uuid, uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.budget_consumption(uuid, uuid, uuid, date, date) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.budget_consumption(uuid, uuid, uuid, date, date) TO service_role;

-- ─── budget_apply_revision — revision row + budget update, ONE transaction ──
--
-- supabase-js has no transactions (CLAUDE.md §1.4). The version check is the
-- optimistic lock: a stale p_expected_version raises BUDGET_VERSION_CONFLICT
-- and nothing is written.

CREATE OR REPLACE FUNCTION public.budget_apply_revision(
  p_workspace_id     uuid,
  p_budget_id        uuid,
  p_expected_version integer,
  p_amount_minor     bigint,
  p_distribution     jsonb,
  p_action           text,
  p_reason           text,
  p_warn_at_percent  integer,
  p_actor_id         uuid,
  p_lines            jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_old budgets%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM budgets
  WHERE id = p_budget_id AND workspace_id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'BUDGET_NOT_FOUND'; END IF;
  IF v_old.status <> 'approved' THEN RAISE EXCEPTION 'BUDGET_REVISION_REQUIRES_APPROVED'; END IF;
  IF v_old.version <> p_expected_version THEN RAISE EXCEPTION 'BUDGET_VERSION_CONFLICT'; END IF;
  IF p_amount_minor < 0 THEN RAISE EXCEPTION 'BUDGET_AMOUNT_INVALID'; END IF;

  INSERT INTO budget_revisions (
    workspace_id, budget_id, version, previous_version, reason, actor_id,
    previous_values, new_values, lines, approved_by
  ) VALUES (
    p_workspace_id, p_budget_id, v_old.version + 1, v_old.version, p_reason, p_actor_id,
    jsonb_build_object('amount_minor', v_old.amount_minor, 'distribution', v_old.distribution,
                       'action', v_old.action, 'warn_at_percent', v_old.warn_at_percent),
    jsonb_build_object('amount_minor', p_amount_minor, 'distribution', p_distribution,
                       'action', p_action, 'warn_at_percent', p_warn_at_percent),
    p_lines, p_actor_id
  );

  UPDATE budgets SET
    amount_minor    = p_amount_minor,
    distribution    = p_distribution,
    action          = p_action,
    warn_at_percent = p_warn_at_percent,
    version         = v_old.version + 1,
    approved_by     = p_actor_id,
    approved_at     = now(),
    updated_at      = now()
  WHERE id = p_budget_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object('version', v_old.version + 1);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.budget_apply_revision(uuid, uuid, integer, bigint, jsonb, text, text, integer, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.budget_apply_revision(uuid, uuid, integer, bigint, jsonb, text, text, integer, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.budget_apply_revision(uuid, uuid, integer, bigint, jsonb, text, text, integer, uuid, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.budget_apply_revision(uuid, uuid, integer, bigint, jsonb, text, text, integer, uuid, jsonb) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
