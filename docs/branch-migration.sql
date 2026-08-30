-- ============================================================================
-- docs/branch-migration.sql
--
-- Branches inside one business.
--
-- A workspace IS the company: it owns the chart of accounts, the catalogue and
-- the customers. A branch is a PLACE inside it — a second shop, a warehouse
-- across town — that raises its own documents and can be reported on
-- separately.
--
--   SHARED across branches   products, customers, suppliers, chart of accounts
--   PER BRANCH               invoices, payments, journal entries, stock moves
--
-- Every branch column below is NULLABLE on purpose. A workspace with no
-- branches keeps working exactly as it did, and a NULL branch means "the
-- business as a whole" rather than an unfinished migration.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS branches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL,
  code             text NOT NULL,
  name             text NOT NULL,
  -- A region holding shops. Reporting on the region includes them.
  parent_branch_id uuid REFERENCES branches (id),
  is_active        boolean NOT NULL DEFAULT true,
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS branches_workspace_code_key
  ON branches (workspace_id, code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS branches_workspace_idx ON branches (workspace_id);

-- ─── Who may act where ──────────────────────────────────────────────────────
-- NO ROW means unrestricted, not "no access". Most workspaces have one branch
-- or none, and defaulting their members to no access would lock every existing
-- user out the moment branches shipped.

CREATE TABLE IF NOT EXISTS member_branches (
  workspace_id uuid NOT NULL,
  user_id      uuid NOT NULL,
  branch_id    uuid NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  assigned_by  uuid,
  assigned_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id, branch_id)
);

-- ─── Documents carry their branch ───────────────────────────────────────────

ALTER TABLE invoices         ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches (id);
ALTER TABLE payments         ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches (id);
ALTER TABLE journal_entries  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches (id);
ALTER TABLE stock_movements  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches (id);
ALTER TABLE cost_layers      ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches (id);
ALTER TABLE warehouses       ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches (id);

CREATE INDEX IF NOT EXISTS invoices_branch_idx        ON invoices (workspace_id, branch_id);
CREATE INDEX IF NOT EXISTS payments_branch_idx        ON payments (workspace_id, branch_id);
CREATE INDEX IF NOT EXISTS journal_entries_branch_idx ON journal_entries (workspace_id, branch_id);

-- ─── Row level security ─────────────────────────────────────────────────────
-- The workspace is still the security boundary. The branch narrows what a
-- member sees INSIDE it and is enforced in the application, where the member's
-- assignment is known; a policy here would have to re-derive it per row.

ALTER TABLE branches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS branches_workspace_members ON branches;
CREATE POLICY branches_workspace_members ON branches
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS member_branches_workspace_members ON member_branches;
CREATE POLICY member_branches_workspace_members ON member_branches
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;

-- ============================================================================
-- Branch-aware reporting.
--
-- The trial balance grows an optional branch filter. NULL means "every branch"
-- — a consolidated statement for the whole business, which is what every
-- existing caller asks for and continues to get.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION accounting_trial_balance(
  p_workspace_id uuid,
  p_from_date    date,
  p_to_date      date,
  p_branch_ids   uuid[] DEFAULT NULL
) RETURNS TABLE (
  account_id   uuid,
  account_code text,
  account_name text,
  account_type text,
  account_role text,
  total_debit  numeric,
  total_credit numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    a.id, a.code, a.name, a.type, a.role,
    COALESCE(SUM(l.debit), 0),
    COALESCE(SUM(l.credit), 0)
  FROM journal_lines l
  JOIN journal_entries j ON j.id = l.journal_id
  JOIN accounts a ON a.id = l.account_id
  WHERE j.workspace_id = p_workspace_id
    AND a.workspace_id = p_workspace_id
    AND j.status = 'posted'
    AND j.deleted_at IS NULL
    AND (p_from_date IS NULL OR j.date >= p_from_date)
    AND (p_to_date   IS NULL OR j.date <= p_to_date)
    AND (p_branch_ids IS NULL OR j.branch_id = ANY (p_branch_ids))
  GROUP BY a.id, a.code, a.name, a.type, a.role
  HAVING COALESCE(SUM(l.debit), 0) <> 0 OR COALESCE(SUM(l.credit), 0) <> 0
  ORDER BY a.code;
$fn$;

COMMIT;
