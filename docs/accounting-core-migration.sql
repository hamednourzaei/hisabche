-- ============================================================================
-- docs/accounting-core-migration.sql
--
-- Accounting Core — the shape the ledger must have for
-- backend/src/services/accounting/* to be correct.
--
-- WHY THIS FILE EXISTS
--   The ledger was scoped by user_id while accounts were scoped by
--   workspace_id, so a chart of accounts built in the UI was invisible to the
--   invoice poster. It also had no posted state, no atomicity and no period
--   lock: a financial record anyone can edit is not a ledger.
--
-- SAFE TO RE-RUN. Every statement is guarded.
-- ============================================================================

BEGIN;

-- ─── 1. Chart of accounts ───────────────────────────────────────────────────

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false;
-- The functional role of the account. Root type says WHERE it sits in the
-- statements; role says WHAT the system may do with it (which account the
-- invoice poster reaches for). Deliberately nullable: an ordinary expense
-- account has no special role.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS role text;

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_role_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_role_check CHECK (
  role IS NULL OR role IN (
    'bank', 'cash', 'receivable', 'payable', 'tax',
    'inventory', 'cogs', 'sales', 'purchase',
    'retained_earnings', 'current_year_earnings'
  )
);

-- A code is only meaningful inside one business's books.
CREATE UNIQUE INDEX IF NOT EXISTS accounts_workspace_code_key
  ON accounts (workspace_id, code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS accounts_workspace_idx ON accounts (workspace_id);

-- ─── 2. Journal entries ─────────────────────────────────────────────────────

ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS entry_number text;
-- What produced this entry, and which record. Together they make automatic
-- posting idempotent: re-saving an invoice must not book its revenue twice.
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reversal_of uuid;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS posted_at timestamptz;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS posted_by uuid;

ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_status_check;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_status_check
  CHECK (status IN ('draft', 'posted', 'reversed', 'cancelled'));

CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_workspace_number_key
  ON journal_entries (workspace_id, entry_number)
  WHERE entry_number IS NOT NULL;

-- One live entry per source document. A reversal carries its own source_type
-- so it does not collide with the entry it reverses.
CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_source_key
  ON journal_entries (workspace_id, source_type, source_id)
  WHERE source_id IS NOT NULL AND status <> 'cancelled';

CREATE INDEX IF NOT EXISTS journal_entries_workspace_date_idx
  ON journal_entries (workspace_id, date)
  WHERE status = 'posted';

ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS workspace_id uuid;

CREATE INDEX IF NOT EXISTS journal_lines_workspace_account_idx
  ON journal_lines (workspace_id, account_id);

-- A line is one side or the other, never both and never neither.
--
-- Added NOT VALID deliberately.
--
-- `NOT VALID` means: enforce this on every row written from now on, and do not
-- re-check the rows that are already there. Postgres refuses to add a CHECK
-- over data that breaks it, and a live database was found holding two lines
-- with neither a debit nor a credit — so the strict form aborts the whole
-- migration and NOTHING gets applied, including the tenant isolation below.
--
-- Refusing to install any control because two old rows are wrong is the worse
-- outcome. This way the ledger is protected from today, and the two rows stay
-- visible instead of being silently deleted — which is the right order for a
-- financial record: a person decides what an old entry should have said, not a
-- migration.
--
-- To find them, and to promote the constraint once they are dealt with, see
-- docs/live-reconciliation-migration.sql.
ALTER TABLE journal_lines DROP CONSTRAINT IF EXISTS journal_lines_one_sided_check;
ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_one_sided_check CHECK (
  COALESCE(debit, 0) >= 0 AND COALESCE(credit, 0) >= 0
  AND (COALESCE(debit, 0) = 0) <> (COALESCE(credit, 0) = 0)
) NOT VALID;

-- Promote it to fully enforced, but only if the ledger is actually clean.
--
-- NOT VALID is the safe way to ADD the constraint; it is not a good place to
-- leave it. An unvalidated constraint is a promise about new rows only, and
-- the next person reading the schema cannot tell whether the history behind it
-- was ever checked.
--
-- `live-reconciliation-migration.sql` archives and removes the amount-less
-- lines before this file runs, so on a database that has been through the full
-- sequence this validates and the constraint becomes a real guarantee. On one
-- that has not, it stays NOT VALID and says so rather than aborting.
DO $$
DECLARE
  bad_rows bigint;
BEGIN
  SELECT count(*) INTO bad_rows
    FROM journal_lines
   WHERE NOT (
     COALESCE(debit, 0) >= 0 AND COALESCE(credit, 0) >= 0
     AND (COALESCE(debit, 0) = 0) <> (COALESCE(credit, 0) = 0)
   );

  IF bad_rows = 0 THEN
    ALTER TABLE journal_lines VALIDATE CONSTRAINT journal_lines_one_sided_check;
  ELSE
    RAISE NOTICE
      'journal_lines_one_sided_check left NOT VALID: % existing row(s) break it. New writes are still enforced.',
      bad_rows;
  END IF;
END $$;

-- ─── 3. Period lock ─────────────────────────────────────────────────────────
-- One row per workspace. Nothing may be posted, edited or reversed with an
-- accounting date on or before locked_until.

CREATE TABLE IF NOT EXISTS accounting_period_locks (
  workspace_id  uuid PRIMARY KEY,
  locked_until  date NOT NULL,
  reason        text NOT NULL DEFAULT '',
  locked_by     uuid,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── 4. Backfill ────────────────────────────────────────────────────────────
-- Existing rows were stamped with the creator's user id only. Their workspace
-- is whichever workspace that user belongs to; a user in several workspaces
-- cannot be resolved this way and is left NULL on purpose — a wrong guess
-- would move somebody's books into the wrong business.

WITH sole_membership AS (
  SELECT user_id, MIN(workspace_id::text)::uuid AS workspace_id
  FROM workspace_members
  WHERE has_access = true AND suspended_at IS NULL
  GROUP BY user_id
  HAVING COUNT(DISTINCT workspace_id) = 1
)
UPDATE accounts a SET workspace_id = m.workspace_id
FROM sole_membership m
WHERE a.workspace_id IS NULL AND a.user_id = m.user_id;

WITH sole_membership AS (
  SELECT user_id, MIN(workspace_id::text)::uuid AS workspace_id
  FROM workspace_members
  WHERE has_access = true AND suspended_at IS NULL
  GROUP BY user_id
  HAVING COUNT(DISTINCT workspace_id) = 1
)
UPDATE journal_entries j SET workspace_id = m.workspace_id
FROM sole_membership m
WHERE j.workspace_id IS NULL AND j.user_id = m.user_id;

UPDATE journal_lines l SET workspace_id = j.workspace_id
FROM journal_entries j
WHERE l.workspace_id IS NULL AND l.journal_id = j.id;

-- Everything that already existed was visible in the reports, so it is posted.
UPDATE journal_entries SET status = 'posted', posted_at = COALESCE(posted_at, created_at)
WHERE status = 'draft';

-- ─── 5. Atomic posting ──────────────────────────────────────────────────────
-- The header and its lines must arrive together or not at all. supabase-js
-- cannot open a transaction, so the write lives here and the service calls it.
-- This is what replaces the compensating DELETE in the old service.

CREATE OR REPLACE FUNCTION accounting_post_journal_entry(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_entry        jsonb,
  p_lines        jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_entry_id     uuid;
  v_date         date := (p_entry ->> 'date')::date;
  v_status       text := COALESCE(p_entry ->> 'status', 'posted');
  v_total_debit  numeric(18, 2);
  v_total_credit numeric(18, 2);
  v_locked_until date;
  v_bad_accounts int;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNTING_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT locked_until INTO v_locked_until
  FROM accounting_period_locks WHERE workspace_id = p_workspace_id;

  IF v_locked_until IS NOT NULL AND v_date <= v_locked_until THEN
    RAISE EXCEPTION 'ACCOUNTING_PERIOD_LOCKED' USING ERRCODE = 'P0001';
  END IF;

  SELECT
    COALESCE(SUM((l ->> 'debit')::numeric), 0),
    COALESCE(SUM((l ->> 'credit')::numeric), 0)
  INTO v_total_debit, v_total_credit
  FROM jsonb_array_elements(p_lines) AS l;

  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'JOURNAL_ENTRY_UNBALANCED' USING ERRCODE = 'P0001';
  END IF;

  IF v_total_debit = 0 THEN
    RAISE EXCEPTION 'JOURNAL_ENTRY_EMPTY' USING ERRCODE = 'P0001';
  END IF;

  -- Every account must belong to THIS workspace and must be postable. Checked
  -- in the same transaction as the insert, so a concurrent change to the chart
  -- of accounts cannot slip between the check and the write.
  SELECT COUNT(*) INTO v_bad_accounts
  FROM jsonb_array_elements(p_lines) AS l
  LEFT JOIN accounts a
    ON a.id = (l ->> 'account_id')::uuid
   AND a.workspace_id = p_workspace_id
   AND a.deleted_at IS NULL
  WHERE a.id IS NULL OR a.is_group = true OR a.is_active = false;

  IF v_bad_accounts > 0 THEN
    RAISE EXCEPTION 'JOURNAL_LINE_ACCOUNT_INVALID' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO journal_entries (
    workspace_id, user_id, date, description, reference, status,
    entry_number, source_type, source_id, reversal_of, posted_at, posted_by
  ) VALUES (
    p_workspace_id,
    p_user_id,
    v_date,
    COALESCE(p_entry ->> 'description', ''),
    COALESCE(p_entry ->> 'reference', ''),
    v_status,
    p_entry ->> 'entry_number',
    p_entry ->> 'source_type',
    NULLIF(p_entry ->> 'source_id', '')::uuid,
    NULLIF(p_entry ->> 'reversal_of', '')::uuid,
    CASE WHEN v_status = 'posted' THEN now() ELSE NULL END,
    CASE WHEN v_status = 'posted' THEN p_user_id ELSE NULL END
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_lines (journal_id, workspace_id, user_id, account_id, debit, credit)
  SELECT
    v_entry_id,
    p_workspace_id,
    p_user_id,
    (l ->> 'account_id')::uuid,
    COALESCE((l ->> 'debit')::numeric, 0),
    COALESCE((l ->> 'credit')::numeric, 0)
  FROM jsonb_array_elements(p_lines) AS l;

  RETURN v_entry_id;
END;
$fn$;

-- ─── 6. Ledger aggregation ──────────────────────────────────────────────────
-- The trial balance is summed in the database. The old service pulled every
-- journal line into Node with no bound and added them up there.

CREATE OR REPLACE FUNCTION accounting_trial_balance(
  p_workspace_id uuid,
  p_from_date    date,
  p_to_date      date
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
  GROUP BY a.id, a.code, a.name, a.type, a.role
  HAVING COALESCE(SUM(l.debit), 0) <> 0 OR COALESCE(SUM(l.credit), 0) <> 0
  ORDER BY a.code;
$fn$;

-- ─── 7. Row level security ──────────────────────────────────────────────────
-- The backend uses the service role and is not subject to these. They exist so
-- that a direct client connection, now or later, cannot read another
-- business's books.

ALTER TABLE accounts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines           ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_period_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounts_workspace_members ON accounts;
CREATE POLICY accounts_workspace_members ON accounts
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS journal_entries_workspace_members ON journal_entries;
CREATE POLICY journal_entries_workspace_members ON journal_entries
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS journal_lines_workspace_members ON journal_lines;
CREATE POLICY journal_lines_workspace_members ON journal_lines
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS accounting_period_locks_workspace_members ON accounting_period_locks;
CREATE POLICY accounting_period_locks_workspace_members ON accounting_period_locks
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
