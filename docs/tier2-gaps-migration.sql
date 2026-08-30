-- ============================================================================
-- docs/tier2-gaps-migration.sql
--
-- Budgets, backdated cost recalculation, landed cost, reordering and
-- timesheet billing — Tier 2 gaps 8 to 11 and 14.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ══════════════════════════════════════════════ BUDGETS

CREATE TABLE IF NOT EXISTS budgets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL,
  account_id         uuid NOT NULL,
  -- Optional narrowing. A workspace-wide cap and a per-project cap can both
  -- be in force; the tightest binds, which falls out of checking all of them.
  dimension_value_id uuid,
  branch_id          uuid,
  period             text NOT NULL DEFAULT 'monthly',
  starts_on          date NOT NULL,
  amount_minor       bigint NOT NULL,
  -- 'block'  refuse the document
  -- 'warn'   let it through, record the breach
  -- 'track'  no interference; the variance report still shows it
  --
  -- Making every budget a hard block is how budgets get set to absurd numbers
  -- so that work can continue.
  action             text NOT NULL DEFAULT 'warn',
  warn_at_percent    integer NOT NULL DEFAULT 80,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budgets_period_check CHECK (period IN ('monthly', 'quarterly', 'yearly')),
  CONSTRAINT budgets_action_check CHECK (action IN ('block', 'warn', 'track')),
  CONSTRAINT budgets_amount_check CHECK (amount_minor >= 0)
);

CREATE INDEX IF NOT EXISTS budgets_lookup_idx
  ON budgets (workspace_id, account_id) WHERE is_active = true;

-- Money promised but not yet spent: approved orders, granted approvals.
-- Counting it is what makes a budget a control rather than a report — by the
-- time an expense is posted, the money is already gone.
CREATE TABLE IF NOT EXISTS budget_commitments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  budget_id     uuid NOT NULL REFERENCES budgets (id) ON DELETE CASCADE,
  source_type   text NOT NULL,
  source_id     uuid NOT NULL,
  amount_minor  bigint NOT NULL,
  -- Cleared when the commitment becomes an actual posting, so the same money
  -- is never counted twice.
  released_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS budget_commitments_source_key
  ON budget_commitments (workspace_id, budget_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS budget_commitments_open_idx
  ON budget_commitments (workspace_id, budget_id) WHERE released_at IS NULL;

-- Recorded whenever a budget was breached, whatever the action. A `warn`
-- budget that leaves no trace is a budget nobody can review.
CREATE TABLE IF NOT EXISTS budget_breaches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  budget_id     uuid NOT NULL REFERENCES budgets (id) ON DELETE CASCADE,
  source_type   text NOT NULL,
  source_id     uuid NOT NULL,
  over_by_minor bigint NOT NULL,
  action_taken  text NOT NULL,
  actor_id      uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════ BACKDATED REPOST

-- A recalculation run and what it changed.
--
-- Posted journal entries are NEVER rewritten. The correction is its own entry
-- with its own date, pointing at what it corrects — which is the difference
-- between an audit trail and a rewritten history.
CREATE TABLE IF NOT EXISTS cost_reposts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid NOT NULL,
  -- What triggered it: the backdated receipt, the landed cost voucher.
  trigger_type         text NOT NULL,
  trigger_id           uuid,
  from_date            date NOT NULL,
  examined_count       integer NOT NULL DEFAULT 0,
  adjustment_count     integer NOT NULL DEFAULT 0,
  net_adjustment_minor bigint NOT NULL DEFAULT 0,
  journal_entry_id     uuid,
  status               text NOT NULL DEFAULT 'planned',
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  CONSTRAINT cost_reposts_status_check
    CHECK (status IN ('planned', 'applied', 'refused_period_locked', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS cost_repost_adjustments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL,
  repost_id             uuid NOT NULL REFERENCES cost_reposts (id) ON DELETE CASCADE,
  consumer_type         text NOT NULL,
  consumer_id           uuid NOT NULL,
  consumer_line         text,
  product_id            uuid NOT NULL,
  entry_date            date NOT NULL,
  recorded_cost_minor   bigint NOT NULL,
  recomputed_cost_minor bigint NOT NULL,
  difference_minor      bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS cost_repost_adjustments_repost_idx
  ON cost_repost_adjustments (workspace_id, repost_id);

-- ══════════════════════════════════════════════ LANDED COST

CREATE TABLE IF NOT EXISTS landed_costs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL,
  description        text NOT NULL,
  -- Customs, freight and handling are part of what the goods COST. Expensing
  -- them understates inventory and then overstates profit on every sale of
  -- those goods for the rest of their life.
  charge_minor       bigint NOT NULL,
  basis              text NOT NULL DEFAULT 'value',
  expense_account_id uuid,
  applied_on         date NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  CONSTRAINT landed_costs_basis_check CHECK (basis IN ('value', 'quantity', 'weight')),
  CONSTRAINT landed_costs_charge_check CHECK (charge_minor > 0)
);

CREATE TABLE IF NOT EXISTS landed_cost_allocations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL,
  landed_cost_id      uuid NOT NULL REFERENCES landed_costs (id) ON DELETE CASCADE,
  cost_layer_id       uuid NOT NULL,
  allocated_minor     bigint NOT NULL,
  new_unit_cost_minor bigint NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS landed_cost_allocations_key
  ON landed_cost_allocations (workspace_id, landed_cost_id, cost_layer_id);

-- ══════════════════════════════════════════════ REORDERING

ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_level numeric(18, 4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_quantity numeric(18, 4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS lead_time_days integer;

-- ══════════════════════════════════════════════ TIMESHEETS

CREATE TABLE IF NOT EXISTS project_billing_config (
  project_id         uuid PRIMARY KEY,
  workspace_id       uuid NOT NULL,
  method             text NOT NULL DEFAULT 'hourly',
  default_rate_minor bigint NOT NULL DEFAULT 0,
  budget_cap_minor   bigint,
  CONSTRAINT project_billing_method_check
    CHECK (method IN ('hourly', 'fixed', 'non_billable'))
);

CREATE TABLE IF NOT EXISTS time_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id   uuid NOT NULL,
  task_id      uuid,
  employee_id  uuid NOT NULL,
  on_date      date NOT NULL,
  -- MINUTES, not hours: 1.5 hours cannot be stored exactly as a float, and
  -- eleven six-minute calls must add up to sixty-six.
  minutes      integer NOT NULL,
  billable     boolean NOT NULL DEFAULT true,
  rate_minor   bigint,
  -- Its PRESENCE is the lock. Not a flag that can be cleared — the invoice
  -- that took this hour.
  invoice_id   uuid,
  description  text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_entries_minutes_check CHECK (minutes > 0)
);

CREATE INDEX IF NOT EXISTS time_entries_project_idx
  ON time_entries (workspace_id, project_id, on_date);

CREATE INDEX IF NOT EXISTS time_entries_unbilled_idx
  ON time_entries (workspace_id, project_id) WHERE invoice_id IS NULL AND billable = true;

-- What an employee's time actually COSTS. Valuing labour at the billing rate
-- makes every project look like it broke exactly even.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cost_rate_minor bigint;

-- ══════════════════════════════════════════════ ROW LEVEL SECURITY

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'budgets', 'budget_commitments', 'budget_breaches',
    'cost_reposts', 'cost_repost_adjustments',
    'landed_costs', 'landed_cost_allocations',
    'project_billing_config', 'time_entries'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_workspace_members', v_table);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO authenticated
        USING (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
        ))
        WITH CHECK (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
        ))
    $p$, v_table || '_workspace_members', v_table);
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- Two gaps the vertical-slice check caught after the fact.
--
-- 1. `suppliers` had NO row-level security. The supplier core reached it, the
--    static tenancy guard covered the application half, and nothing covered
--    the database half — so a direct client with an anon key could read every
--    workspace's supplier list. It is the only table the whole Tier 2 sweep
--    added a service for and never protected.
--
-- 2. A till order and its payment rows were written in two statements, with a
--    manual DELETE if the second failed. `.claude/lessons-learned.md` #3
--    forbids exactly that: if the process dies between them, the compensating
--    delete never runs and the drawer holds an order with no payments — cash
--    that the session expects and cannot explain.
-- ============================================================================

BEGIN;

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suppliers_workspace_members ON suppliers;
CREATE POLICY suppliers_workspace_members ON suppliers
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

-- ─── The till order, written atomically ─────────────────────────────────────
-- Returns the EXISTING order when the reference has already been used, which
-- is what makes a retry after a lost response idempotent rather than a second
-- sale. A till on a bad connection retries constantly.

CREATE OR REPLACE FUNCTION pos_record_order(
  p_workspace_id uuid,
  p_session_id   uuid,
  p_payload      jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_order_id uuid;
  v_status   text;
  v_existing uuid;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'POS_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- The session must be open, and it must be OURS. Checked inside the
  -- transaction: outside it, a close could land between the check and the
  -- insert and the order would join a session that had already posted.
  SELECT status INTO v_status
    FROM pos_sessions
   WHERE id = p_session_id AND workspace_id = p_workspace_id
   FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'POS_SESSION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'POS_SESSION_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;

  -- Already taken. Hand back what exists rather than refusing: the device is
  -- retrying something that already succeeded, and an error would make it
  -- retry forever.
  SELECT id INTO v_existing
    FROM pos_orders
   WHERE workspace_id = p_workspace_id
     AND order_ref = p_payload ->> 'order_ref';

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_existing, 'status', 'already_recorded');
  END IF;

  INSERT INTO pos_orders (
    workspace_id, session_id, order_ref, invoice_id,
    total_minor, change_minor, status
  ) VALUES (
    p_workspace_id,
    p_session_id,
    p_payload ->> 'order_ref',
    NULLIF(p_payload ->> 'invoice_id', '')::uuid,
    (p_payload ->> 'total_minor')::bigint,
    COALESCE((p_payload ->> 'change_minor')::bigint, 0),
    'completed'
  )
  RETURNING id INTO v_order_id;

  -- Same transaction. An order without its payments is cash the session
  -- expects and cannot explain.
  INSERT INTO pos_order_payments (workspace_id, order_id, method, amount_minor)
  SELECT
    p_workspace_id,
    v_order_id,
    payment ->> 'method',
    (payment ->> 'amount_minor')::bigint
  FROM jsonb_array_elements(p_payload -> 'payments') AS payment;

  RETURN jsonb_build_object('id', v_order_id, 'status', 'recorded');
END;
$fn$;

COMMIT;
