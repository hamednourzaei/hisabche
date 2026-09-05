-- ============================================================================
-- docs/phase-a-02-ledger-entries-workspace-migration.sql
--
-- PHASE A · 2/4 — ledger_entries gets the only security boundary this codebase
-- recognises.
--
-- `ledger_entries` was restored with (account_id, debit, credit, reference_type,
-- reference_id, description, entry_date, user_id) and NO `workspace_id`. Under
-- rule 1 of `.claude/README.md` — workspace_id is the only tenancy boundary,
-- user_id says who acted and is never a filter — that makes the table
-- unqueryable without a join, and un-RLS-able without a subquery per row.
--
-- This is the same defect as lesson 1 (half-finished tenancy boundary): the
-- accounting tables grew workspace_id one at a time and this one was missed,
-- so any report reaching it either filters by user_id (wrong: a workspace has
-- many users) or joins through accounts on every read.
--
-- WHAT THIS DOES
--
--   * adds `workspace_id uuid` — NULLABLE, so existing rows survive the ALTER
--   * adds `journal_entry_id uuid` — the link that makes ledger_entries a
--     projection of journal_entries (Phase B), rather than a third book
--   * adds `branch_id uuid` — branch-aware accounting, per the target model
--   * backfills workspace_id from accounts, then from journal_entries, then
--     from workspace_members as a last resort
--   * adds indexes and NOT VALID foreign keys
--   * sets NOT NULL only if the backfill left no NULL behind — reported, never
--     forced
--
-- No row is deleted. No column is dropped. SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Columns — nullable first, always
-- ---------------------------------------------------------------------------

ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS workspace_id     uuid;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS journal_entry_id uuid;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS branch_id        uuid;

COMMENT ON COLUMN ledger_entries.workspace_id IS
  'Tenancy boundary. NULL only on rows written before phase-a-02 that no backfill source could resolve; such rows are invisible to every workspace-scoped read and must be resolved by hand.';
COMMENT ON COLUMN ledger_entries.journal_entry_id IS
  'The journal entry this row projects. NULL means the row predates the journal as source of truth (Phase B) and was written directly.';

-- ---------------------------------------------------------------------------
-- 2. Backfill — three sources, most reliable first
-- ---------------------------------------------------------------------------

-- 2a. From the account. accounts.workspace_id was added by
--     accounting-core-migration.sql and is the closest thing to authoritative.
UPDATE ledger_entries le
SET    workspace_id = a.workspace_id
FROM   accounts a
WHERE  a.id = le.account_id
  AND  le.workspace_id IS NULL
  AND  a.workspace_id IS NOT NULL;

-- 2b. From the source document, when the reference points at a journal entry.
--     `reference_type` is free text; the variants below are the ones the
--     backend writes. ASSUMPTION: no other spelling is in use — widen the IN
--     list if `SELECT DISTINCT reference_type FROM ledger_entries` disagrees.
UPDATE ledger_entries le
SET    workspace_id     = COALESCE(le.workspace_id, e.workspace_id),
       journal_entry_id = COALESCE(le.journal_entry_id, e.id)
FROM   journal_entries e
WHERE  e.id = le.reference_id
  AND  le.reference_type IN ('journal_entry', 'journal', 'journal_entries', 'JOURNAL_ENTRY')
  AND  (le.workspace_id IS NULL OR le.journal_entry_id IS NULL);

-- 2c. Last resort: the writer's single workspace. Only applied when the user
--     belongs to EXACTLY ONE workspace — otherwise the row would be assigned to
--     a tenant on a coin flip, which is worse than leaving it NULL.
UPDATE ledger_entries le
SET    workspace_id = m.workspace_id
FROM   (
  -- (array_agg(...))[1], not MIN(...): Postgres has no min() for uuid. The
  -- HAVING clause guarantees there is exactly one distinct value, so which
  -- element is picked cannot matter.
  SELECT user_id, (array_agg(DISTINCT workspace_id))[1] AS workspace_id
  FROM   workspace_members
  GROUP  BY user_id
  HAVING COUNT(DISTINCT workspace_id) = 1
) m
WHERE  m.user_id = le.user_id
  AND  le.workspace_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Indexes
--
-- Every workspace-scoped read filters on workspace_id and slices on the
-- accounting date (lesson 7: never created_at). The composite serves both.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS ledger_entries_workspace_idx
  ON ledger_entries (workspace_id);

CREATE INDEX IF NOT EXISTS ledger_entries_workspace_date_idx
  ON ledger_entries (workspace_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS ledger_entries_workspace_account_idx
  ON ledger_entries (workspace_id, account_id);

CREATE INDEX IF NOT EXISTS ledger_entries_journal_entry_idx
  ON ledger_entries (journal_entry_id);

CREATE INDEX IF NOT EXISTS ledger_entries_branch_idx
  ON ledger_entries (workspace_id, branch_id);

CREATE INDEX IF NOT EXISTS ledger_entries_reference_idx
  ON ledger_entries (reference_type, reference_id);

-- ---------------------------------------------------------------------------
-- 4. Foreign keys — NOT VALID, per hardening-migration.sql
-- ---------------------------------------------------------------------------

ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_workspace_id_fkey;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspaces (id) NOT VALID;

ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_journal_entry_id_fkey;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_journal_entry_id_fkey
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries (id) NOT VALID;

ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_branch_id_fkey;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES branches (id) NOT VALID;

-- ---------------------------------------------------------------------------
-- 5. NOT NULL — only if the data earned it
--
-- Forcing NOT NULL while rows are still NULL aborts the migration and rolls
-- back the whole file. So: check, then decide, and SAY which happened.
-- ---------------------------------------------------------------------------

DO $do$
DECLARE
  orphans bigint;
BEGIN
  SELECT COUNT(*) INTO orphans FROM ledger_entries WHERE workspace_id IS NULL;

  IF orphans = 0 THEN
    ALTER TABLE ledger_entries ALTER COLUMN workspace_id SET NOT NULL;
    RAISE NOTICE 'ledger_entries.workspace_id: backfilled completely, NOT NULL applied.';
  ELSE
    RAISE WARNING
      'ledger_entries.workspace_id: % row(s) still NULL - NOT NULL NOT applied. Resolve them, then run: ALTER TABLE ledger_entries ALTER COLUMN workspace_id SET NOT NULL;',
      orphans;
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------
-- 6. RLS — the table already had RLS enabled with no workspace column to use.
--     Now it has one.
--
--     The subquery is wrapped in `(SELECT auth.uid())` so the planner evaluates
--     it once per statement rather than once per row — the pattern
--     rls-performance-migration.sql established.
-- ---------------------------------------------------------------------------

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_entries_workspace_access ON ledger_entries;
CREATE POLICY ledger_entries_workspace_access ON ledger_entries
  FOR ALL
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = (SELECT auth.uid())
    )
  );

COMMIT;

-- ============================================================================
-- UNRESOLVED ROWS — run after applying.
-- ============================================================================
--
-- SELECT le.id, le.account_id, le.reference_type, le.reference_id, le.user_id,
--        le.entry_date, le.debit, le.credit
-- FROM   ledger_entries le
-- WHERE  le.workspace_id IS NULL
-- ORDER  BY le.entry_date;
