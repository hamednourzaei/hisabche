-- ============================================================================
-- docs/finance-gaps-migration.sql
--
-- POS sessions, fixed assets, bank reconciliation, FX revaluation and
-- accounting dimensions — Tier 1 gaps 3 to 7.
--
-- MONEY IS IN MINOR UNITS throughout, for the same reason as the tax engine:
-- a depreciation schedule that rounds 36 times must still sum exactly to what
-- was capitalised, and floats cannot promise that.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ══════════════════════════════════════════════ POS

CREATE TABLE IF NOT EXISTS pos_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL,
  branch_id           uuid,
  status              text NOT NULL DEFAULT 'open',
  opening_float_minor bigint NOT NULL DEFAULT 0,
  opened_at           timestamptz NOT NULL DEFAULT now(),
  opened_by           uuid NOT NULL,
  -- What a person physically counted. NULL until somebody has.
  counted_cash_minor  bigint,
  -- Required once the variance exceeds the workspace tolerance.
  variance_reason     text,
  closed_at           timestamptz,
  closed_by           uuid,
  -- An owner closed somebody else's abandoned session from another device.
  was_forced          boolean NOT NULL DEFAULT false,
  journal_entry_id    uuid,
  CONSTRAINT pos_sessions_status_check
    CHECK (status IN ('open', 'closing', 'closed', 'force_closed'))
);

-- One open session per person per branch. Two open drawers for one till is
-- two counts that can never be reconciled against one another.
CREATE UNIQUE INDEX IF NOT EXISTS pos_sessions_one_open
  ON pos_sessions (workspace_id, opened_by, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS pos_sessions_abandoned_idx
  ON pos_sessions (workspace_id, opened_at) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS pos_orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  session_id    uuid NOT NULL REFERENCES pos_sessions (id),
  -- Generated ONCE on the device and never regenerated. This is what makes a
  -- retry after a lost response idempotent rather than a second sale.
  order_ref     text NOT NULL,
  invoice_id    uuid,
  total_minor   bigint NOT NULL,
  change_minor  bigint NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'completed',
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_orders_status_check CHECK (status IN ('completed', 'voided'))
);

CREATE UNIQUE INDEX IF NOT EXISTS pos_orders_ref_key
  ON pos_orders (workspace_id, order_ref);

CREATE TABLE IF NOT EXISTS pos_order_payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  order_id     uuid NOT NULL REFERENCES pos_orders (id) ON DELETE CASCADE,
  method       text NOT NULL,
  amount_minor bigint NOT NULL,
  CONSTRAINT pos_order_payments_method_check
    CHECK (method IN ('cash', 'card', 'transfer', 'credit', 'other'))
);

CREATE TABLE IF NOT EXISTS pos_cash_movements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  session_id   uuid NOT NULL REFERENCES pos_sessions (id),
  kind         text NOT NULL,
  amount_minor bigint NOT NULL,
  -- Never empty. Cash leaving a drawer with no stated reason is
  -- indistinguishable from cash going missing.
  reason       text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  CONSTRAINT pos_cash_movements_kind_check CHECK (kind IN ('cash_in', 'cash_out')),
  CONSTRAINT pos_cash_movements_reason_check CHECK (length(btrim(reason)) > 0),
  CONSTRAINT pos_cash_movements_amount_check CHECK (amount_minor > 0)
);

-- ══════════════════════════════════════════════ FIXED ASSETS

CREATE TABLE IF NOT EXISTS fixed_assets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL,
  name               text NOT NULL,
  asset_account_id   uuid,
  expense_account_id uuid,
  accumulated_account_id uuid,
  cost_minor         bigint NOT NULL,
  salvage_minor      bigint NOT NULL DEFAULT 0,
  method             text NOT NULL DEFAULT 'straight_line',
  periods            integer NOT NULL,
  period_months      integer NOT NULL DEFAULT 1,
  declining_factor   numeric(6, 3),
  first_period_on    date NOT NULL,
  prorata_from       date,
  acquired_on        date NOT NULL,
  -- Set on disposal. The schedule stops here and remaining periods cancel.
  disposed_on        date,
  disposal_proceeds_minor bigint,
  source_invoice_id  uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fixed_assets_method_check
    CHECK (method IN ('straight_line', 'declining', 'declining_then_straight')),
  CONSTRAINT fixed_assets_salvage_check CHECK (salvage_minor >= 0 AND salvage_minor <= cost_minor),
  CONSTRAINT fixed_assets_periods_check CHECK (periods >= 1 AND period_months >= 1)
);

-- The whole schedule, computed ONCE at creation.
--
-- Not a monthly formula: a month the job did not run is a month of
-- depreciation that never happened and nothing says so. With a stored
-- schedule, "what is due and unposted" has a definite answer that survives a
-- missed run, a crash, and six weeks offline.
CREATE TABLE IF NOT EXISTS asset_depreciation_schedule (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL,
  asset_id          uuid NOT NULL REFERENCES fixed_assets (id) ON DELETE CASCADE,
  period            integer NOT NULL,
  on_date           date NOT NULL,
  amount_minor      bigint NOT NULL,
  accumulated_minor bigint NOT NULL,
  book_value_minor  bigint NOT NULL,
  journal_entry_id  uuid,
  posted_at         timestamptz,
  cancelled_at      timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS asset_schedule_period_key
  ON asset_depreciation_schedule (workspace_id, asset_id, period);

CREATE INDEX IF NOT EXISTS asset_schedule_due_idx
  ON asset_depreciation_schedule (workspace_id, on_date)
  WHERE posted_at IS NULL AND cancelled_at IS NULL;

-- ══════════════════════════════════════════════ BANK RECONCILIATION

CREATE TABLE IF NOT EXISTS bank_statements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL,
  account_id     uuid NOT NULL,
  statement_date date NOT NULL,
  opening_balance_minor bigint NOT NULL DEFAULT 0,
  closing_balance_minor bigint NOT NULL DEFAULT 0,
  imported_at    timestamptz NOT NULL DEFAULT now(),
  imported_by    uuid
);

CREATE TABLE IF NOT EXISTS bank_statement_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  statement_id  uuid NOT NULL REFERENCES bank_statements (id) ON DELETE CASCADE,
  -- The bank's own identifier where it gives one; a position-based fallback
  -- otherwise. This is what stops a re-imported file duplicating every line.
  line_key      text NOT NULL,
  external_ref  text,
  on_date       date NOT NULL,
  -- Positive is money in, negative is money out. Same convention as the books.
  amount_minor  bigint NOT NULL,
  description   text NOT NULL DEFAULT '',
  matched_to    uuid,
  matched_at    timestamptz,
  matched_by    uuid,
  -- A difference is usually a bank charge. Writing it off is a real entry, so
  -- it needs a reason that says where it lands.
  difference_reason text
);

CREATE UNIQUE INDEX IF NOT EXISTS bank_statement_lines_dedupe
  ON bank_statement_lines (workspace_id, statement_id, line_key);

CREATE INDEX IF NOT EXISTS bank_statement_lines_unmatched_idx
  ON bank_statement_lines (workspace_id, on_date) WHERE matched_to IS NULL;

-- ══════════════════════════════════════════════ FX REVALUATION

CREATE TABLE IF NOT EXISTS fx_revaluations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  as_of         date NOT NULL,
  -- The rates used, so the run can be reproduced exactly.
  rates         jsonb NOT NULL DEFAULT '{}'::jsonb,
  gain_minor    bigint NOT NULL DEFAULT 0,
  loss_minor    bigint NOT NULL DEFAULT 0,
  net_minor     bigint NOT NULL DEFAULT 0,
  -- What this run reversed. An unrealised difference is an opinion about a
  -- rate; last period's opinion must not sit under this one.
  reversed_minor bigint NOT NULL DEFAULT 0,
  journal_entry_id uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS fx_revaluations_period_key
  ON fx_revaluations (workspace_id, as_of);

CREATE TABLE IF NOT EXISTS fx_revaluation_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL,
  revaluation_id    uuid NOT NULL REFERENCES fx_revaluations (id) ON DELETE CASCADE,
  source_type       text NOT NULL,
  source_id         uuid NOT NULL,
  currency          text NOT NULL,
  foreign_minor     bigint NOT NULL,
  booked_rate       numeric(18, 8) NOT NULL,
  closing_rate      numeric(18, 8) NOT NULL,
  booked_base_minor bigint NOT NULL,
  revalued_base_minor bigint NOT NULL,
  difference_minor  bigint NOT NULL
);

-- ══════════════════════════════════════════════ DIMENSIONS

CREATE TABLE IF NOT EXISTS accounting_dimensions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL,
  code             text NOT NULL,
  label_key        text NOT NULL,
  allows_hierarchy boolean NOT NULL DEFAULT true,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS accounting_dimensions_code_key
  ON accounting_dimensions (workspace_id, code);

CREATE TABLE IF NOT EXISTS dimension_values (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  dimension_id uuid NOT NULL REFERENCES accounting_dimensions (id) ON DELETE CASCADE,
  code         text NOT NULL,
  name         text NOT NULL,
  parent_id    uuid REFERENCES dimension_values (id),
  is_active    boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS dimension_values_code_key
  ON dimension_values (workspace_id, dimension_id, code);

-- Required-ness is per ACCOUNT or account TYPE, never global. "Every posting
-- must name a cost centre" is unworkable — the bank account does not have one
-- — and a requirement that fires everywhere gets switched off within a week.
CREATE TABLE IF NOT EXISTS dimension_requirements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL,
  dimension_id     uuid NOT NULL REFERENCES accounting_dimensions (id) ON DELETE CASCADE,
  account_types    jsonb NOT NULL DEFAULT '[]'::jsonb,
  account_ids      jsonb NOT NULL DEFAULT '[]'::jsonb,
  except_account_ids jsonb NOT NULL DEFAULT '[]'::jsonb
);

-- A journal line carries its tags. dimensionId → valueId.
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS dimensions jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS journal_lines_dimensions_idx
  ON journal_lines USING gin (dimensions);

-- ══════════════════════════════════════════════ ROW LEVEL SECURITY

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'pos_sessions', 'pos_orders', 'pos_order_payments', 'pos_cash_movements',
    'fixed_assets', 'asset_depreciation_schedule',
    'bank_statements', 'bank_statement_lines',
    'fx_revaluations', 'fx_revaluation_lines',
    'accounting_dimensions', 'dimension_values', 'dimension_requirements'
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
