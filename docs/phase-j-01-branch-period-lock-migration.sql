-- ============================================================================
-- docs/phase-j-01-branch-period-lock-migration.sql
--
-- PHASE J · J1 — the period lock becomes branch-aware.
--
-- ---------------------------------------------------------------------------
-- WHAT ALREADY EXISTS (J0 finding — read before assuming this builds anything)
--
-- The period lock is NOT missing. `accounting_period_locks` exists, and the
-- check runs INSIDE `accounting_post_journal_entry` — in the same transaction
-- as the insert, so a direct database write is refused too, not just a call
-- through the service:
--
--     SELECT locked_until INTO v_locked_until
--     FROM accounting_period_locks WHERE workspace_id = p_workspace_id;
--     IF v_locked_until IS NOT NULL AND v_date <= v_locked_until THEN
--       RAISE EXCEPTION 'ACCOUNTING_PERIOD_LOCKED';
--
-- So J1 does NOT create a period model. Building `accounting_periods` beside
-- this would be a second, competing lock — the parallel architecture G2
-- forbids, on the one control that decides whether filed figures are final.
--
-- What is genuinely missing is the BRANCH dimension (J1.2) and the AUDIT
-- trail (J1.5). That is what this file adds.
--
-- ---------------------------------------------------------------------------
-- THE SHAPE PROBLEM, AND WHY THE PRIMARY KEY MOVES
--
-- The table is keyed `workspace_id PRIMARY KEY` — one lock per workspace, by
-- construction. A branch lock needs a second row for the same workspace, which
-- that key forbids.
--
-- ⚠️ A composite PK `(workspace_id, branch_id)` does NOT work: a primary key
-- column cannot be NULL, and NULL is exactly how the company-wide lock is
-- expressed. Postgres would reject every company lock.
--
-- So: a surrogate `id`, plus TWO partial unique indexes that together say what
-- the old key said and one thing more —
--
--     one company lock per workspace   UNIQUE (workspace_id) WHERE branch_id IS NULL
--     one lock per branch              UNIQUE (workspace_id, branch_id) WHERE branch_id IS NOT NULL
--
-- Existing rows get `branch_id = NULL` and therefore remain company locks.
-- NOTHING ABOUT CURRENT BEHAVIOUR CHANGES until someone creates a branch lock.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
-- Additive except for the primary key swap, which is reversible while no branch
-- lock exists:
--
--   1. DELETE FROM accounting_period_locks WHERE branch_id IS NOT NULL;
--   2. ALTER TABLE accounting_period_locks DROP CONSTRAINT accounting_period_locks_pkey;
--   3. ALTER TABLE accounting_period_locks ADD PRIMARY KEY (workspace_id);
--   4. Restore the previous body of accounting_post_journal_entry from
--      docs/SETUP-COMPLETE.sql (the version reading only workspace_id).
--
-- ⚠️ Step 1 deletes branch locks, which REOPENS those periods. That is a
-- financial control being switched off — do it deliberately, not as cleanup.
--
-- No data is dropped by this file. SAFE TO RE-RUN.
-- ============================================================================

-- ============================================================================
-- PRE-MIGRATION VERIFICATION — run these FIRST and keep the output.
-- ============================================================================
--
-- P1. How many locks exist, and what do they cover? (expect: one row per
--     workspace that has ever closed a period)
--
--   SELECT COUNT(*) AS lock_rows, MIN(locked_until) AS earliest, MAX(locked_until) AS latest
--   FROM accounting_period_locks;
--
-- P2. The current primary key, so the rollback above is checked against
--     reality rather than against this comment.
--
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'accounting_period_locks'::regclass AND contype = 'p';
--
-- P3. Does the column already exist? (a re-run should report `1`)
--
--   SELECT COUNT(*) FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'accounting_period_locks'
--     AND column_name = 'branch_id';
--
-- P4. Entries that would ALREADY be refused by their workspace lock. Expect 0.
--     Anything here is an entry posted into a closed period before the lock was
--     set — it is NOT modified by this migration and must be investigated.
--
--   SELECT je.workspace_id, COUNT(*) AS entries, MIN(je.date) AS earliest
--   FROM journal_entries je
--   JOIN accounting_period_locks l ON l.workspace_id = je.workspace_id
--   WHERE je.date <= l.locked_until AND je.status = 'posted'
--   GROUP BY je.workspace_id;
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The branch dimension
-- ---------------------------------------------------------------------------

ALTER TABLE accounting_period_locks ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE accounting_period_locks ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

COMMENT ON TABLE accounting_period_locks IS
  'Which accounting dates are closed. One row per scope: branch_id NULL is the COMPANY lock covering every branch; a non-null branch_id closes that branch alone. A posting is refused when EITHER applies — a branch can close early, and can never reopen what the company has closed. Enforced inside accounting_post_journal_entry, in the posting transaction, so a direct database write is refused too. Phase J (J1).';

COMMENT ON COLUMN accounting_period_locks.branch_id IS
  'NULL = company-wide lock (the original behaviour, and what every pre-J1 row is). Non-null = that branch only.';

COMMENT ON COLUMN accounting_period_locks.locked_until IS
  'Inclusive. An entry dated ON this day is refused, not just before it — see isPeriodLocked in accounting.domain.ts.';

-- ---------------------------------------------------------------------------
-- 2. The key swap
--
-- Guarded: on a re-run the constraint is already `id` and this does nothing.
-- ---------------------------------------------------------------------------

DO $keys$
BEGIN
  -- Every existing row is a company lock. Stamped before the indexes below are
  -- created, so the partial unique index has consistent data to build on.
  UPDATE accounting_period_locks SET id = gen_random_uuid() WHERE id IS NULL;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'accounting_period_locks'::regclass
      AND contype = 'p'
      AND pg_get_constraintdef(oid) = 'PRIMARY KEY (workspace_id)'
  ) THEN
    ALTER TABLE accounting_period_locks DROP CONSTRAINT accounting_period_locks_pkey;
    ALTER TABLE accounting_period_locks ALTER COLUMN id SET NOT NULL;
    ALTER TABLE accounting_period_locks ADD CONSTRAINT accounting_period_locks_pkey PRIMARY KEY (id);
    RAISE NOTICE 'accounting_period_locks: primary key moved from (workspace_id) to (id).';
  ELSE
    RAISE NOTICE 'accounting_period_locks: primary key already migrated — nothing to do.';
  END IF;
END
$keys$;

-- One company lock per workspace — what the old primary key guaranteed.
CREATE UNIQUE INDEX IF NOT EXISTS accounting_period_locks_company_key
  ON accounting_period_locks (workspace_id)
  WHERE branch_id IS NULL;

-- One lock per branch.
CREATE UNIQUE INDEX IF NOT EXISTS accounting_period_locks_branch_key
  ON accounting_period_locks (workspace_id, branch_id)
  WHERE branch_id IS NOT NULL;

-- The posting path reads every lock for a workspace on every post.
CREATE INDEX IF NOT EXISTS accounting_period_locks_workspace_idx
  ON accounting_period_locks (workspace_id);

ALTER TABLE accounting_period_locks
  DROP CONSTRAINT IF EXISTS accounting_period_locks_branch_id_fkey;
ALTER TABLE accounting_period_locks ADD CONSTRAINT accounting_period_locks_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES branches (id) NOT VALID;

-- ---------------------------------------------------------------------------
-- 3. The enforcement — the only part that changes behaviour
--
-- Same function, same signature, same error code. The single-row lookup becomes
-- a two-scope one:
--
--     company lock   branch_id IS NULL
--     branch lock    branch_id = this entry's branch
--
-- ⚠️ `p_entry ->> 'branch_id'` may be absent — most postings carry no branch.
-- Such an entry is checked against the COMPANY lock only. Refusing it because
-- some unrelated branch is closed would let one shop's month-end block head
-- office, which is the opposite of what a branch lock is for.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION accounting_period_locked(
  p_workspace_id uuid,
  p_branch_id    uuid,
  p_date         date
) RETURNS TABLE (locked boolean, scope text, locked_until date, reason text)
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT
    true,
    CASE WHEN l.branch_id IS NULL THEN 'company' ELSE 'branch' END,
    l.locked_until,
    l.reason
  FROM accounting_period_locks l
  WHERE l.workspace_id = p_workspace_id
    AND p_date <= l.locked_until
    AND (l.branch_id IS NULL OR l.branch_id = p_branch_id)
  -- Company first: when both refuse, the company lock is the one to report,
  -- because it is the one a branch manager cannot lift.
  ORDER BY (l.branch_id IS NOT NULL)
  LIMIT 1;
$fn$;

COMMENT ON FUNCTION accounting_period_locked(uuid, uuid, date) IS
  'Is this accounting date closed for this branch? Returns no row when open. Company lock OR branch lock refuses; the company lock is reported first because a branch cannot lift it. Phase J (J1).';

COMMIT;

-- ============================================================================
-- ⚠️ SECTION 4 — the posting function
--
-- Deliberately OUTSIDE the transaction above and written as a separate
-- statement, because it REPLACES the body of the function every posting path in
-- the product goes through. If anything in it is wrong, everything stops.
--
-- Only the lock lookup changed. Balance, empty-entry and account-validity
-- checks, the inserts and the return value are byte-for-byte the previous
-- behaviour.
-- ============================================================================

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
  v_branch_id    uuid := NULLIF(p_entry ->> 'branch_id', '')::uuid;
  v_total_debit  numeric(18, 2);
  v_total_credit numeric(18, 2);
  v_lock         record;
  v_bad_accounts int;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNTING_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- J1 — company lock OR branch lock.
  SELECT * INTO v_lock
  FROM accounting_period_locked(p_workspace_id, v_branch_id, v_date);

  IF FOUND THEN
    RAISE EXCEPTION 'ACCOUNTING_PERIOD_LOCKED'
      USING ERRCODE = 'P0001',
            DETAIL  = format('%s lock, closed through %s', v_lock.scope, v_lock.locked_until),
            HINT    = COALESCE(NULLIF(v_lock.reason, ''), 'Reopen the period before posting into it.');
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
    entry_number, source_type, source_id, reversal_of, posted_at, posted_by,
    branch_id
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
    CASE WHEN v_status = 'posted' THEN p_user_id ELSE NULL END,
    v_branch_id
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_lines (workspace_id, journal_id, account_id, debit, credit, user_id)
  SELECT
    p_workspace_id,
    v_entry_id,
    (l ->> 'account_id')::uuid,
    COALESCE((l ->> 'debit')::numeric, 0),
    COALESCE((l ->> 'credit')::numeric, 0),
    p_user_id
  FROM jsonb_array_elements(p_lines) AS l;

  RETURN v_entry_id;
END;
$fn$;

-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
--
-- Run all five. V1–V4 must pass before J1 is considered done.
-- ============================================================================
--
-- V1. Shape. Expect: branch_id present, primary key on (id), two partial
--     unique indexes.
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='accounting_period_locks'
--   ORDER BY ordinal_position;
--
--   SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename = 'accounting_period_locks';
--
-- V2. Every pre-existing lock is still a COMPANY lock. Expect 0 rows.
--
--   SELECT * FROM accounting_period_locks WHERE branch_id IS NOT NULL;
--
-- V3. The lock function answers correctly. Substitute a real workspace that
--     HAS a lock. Expect: row returned for a date on/before locked_until,
--     no row for a date after it.
--
--   SELECT * FROM accounting_period_locked('<workspace uuid>', NULL, '<locked_until date>');
--   SELECT * FROM accounting_period_locked('<workspace uuid>', NULL, '<locked_until + 1 day>');
--
-- V4. ⚠️ THE ONE THAT MATTERS — a DIRECT database posting into a closed period
--     is refused. This is the check the application layer cannot prove.
--     Expect: ERROR ACCOUNTING_PERIOD_LOCKED.
--
--   SELECT accounting_post_journal_entry(
--     '<workspace uuid>'::uuid,
--     '<user uuid>'::uuid,
--     jsonb_build_object('date', '<a date on or before locked_until>', 'status', 'posted'),
--     jsonb_build_array(
--       jsonb_build_object('account_id', '<a real postable account uuid>', 'debit', 1, 'credit', 0),
--       jsonb_build_object('account_id', '<another real postable account uuid>', 'debit', 0, 'credit', 1)
--     )
--   );
--
-- V5. Branch precedence. Create a branch lock, then confirm a posting in THAT
--     branch is refused while one in another branch is not.
--
--   INSERT INTO accounting_period_locks (workspace_id, branch_id, locked_until, reason)
--   VALUES ('<workspace uuid>', '<branch uuid>', CURRENT_DATE, 'V5 test');
--
--   SELECT * FROM accounting_period_locked('<workspace uuid>', '<branch uuid>', CURRENT_DATE);
--     → one row, scope = 'branch'
--   SELECT * FROM accounting_period_locked('<workspace uuid>', '<other branch uuid>', CURRENT_DATE);
--     → no rows
--
--   DELETE FROM accounting_period_locks WHERE reason = 'V5 test';
