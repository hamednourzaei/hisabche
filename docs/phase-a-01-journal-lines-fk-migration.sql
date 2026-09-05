-- ============================================================================
-- docs/phase-a-01-journal-lines-fk-migration.sql
--
-- PHASE A · 1/4 — the missing parent link on journal_lines.
--
-- `journal_lines.journal_id` is the line's link to its journal entry header, but
-- the audit of the live database found NO foreign key behind it: the column was
-- restored by `base-schema-migration.sql` from a dump that recorded only names
-- and types. Consequences, all silent:
--
--   * an orphan line — a line whose header no longer exists — is accepted, and
--     it counts in `journal_lines` totals while appearing in no journal entry.
--     That is an unbalanced ledger nobody can see.
--   * PostgREST cannot resolve `journal_entries(*, journal_lines(*))`; the embed
--     fails with PGRST200, which reads as a "schema cache" error, not as a
--     missing constraint.
--
-- The FK is added NOT VALID, matching `hardening-migration.sql`: enforced on
-- every future insert and update, not scanned against existing rows. Validating
-- takes an ACCESS EXCLUSIVE lock for the length of the scan. Validate later,
-- deliberately, after the orphan report at the bottom of this file is empty:
--
--     ALTER TABLE journal_lines VALIDATE CONSTRAINT journal_lines_journal_id_fkey;
--
-- No ON DELETE CASCADE. Deleting a posted journal entry that still has lines
-- must REFUSE, not quietly remove the lines.
--
-- SAFE TO RE-RUN. Additive only — no row is written, moved or deleted.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The foreign key
-- ---------------------------------------------------------------------------

ALTER TABLE journal_lines DROP CONSTRAINT IF EXISTS journal_lines_journal_id_fkey;
ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_journal_id_fkey
  FOREIGN KEY (journal_id) REFERENCES journal_entries (id) NOT VALID;

-- ---------------------------------------------------------------------------
-- 2. The index the FK needs
--
-- Postgres does not create one for a foreign key. Without it, deleting or
-- updating a journal entry sequentially scans every line in the book, and
-- "show me the lines of this entry" — the single most common accounting read —
-- does the same.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS journal_lines_journal_id_idx ON journal_lines (journal_id);

COMMIT;

-- ============================================================================
-- ORPHAN REPORT — run this before VALIDATE CONSTRAINT.
--
-- Any row returned is a line whose header is gone. Do not delete them: they are
-- evidence of a half-written entry. Archive them the way SETUP-COMPLETE.sql
-- archives zero-amount lines (journal_lines_archive), with a reason.
-- ============================================================================
--
-- SELECT l.id, l.journal_id, l.account_id, l.debit, l.credit, l.created_at
-- FROM journal_lines l
-- WHERE l.journal_id IS NOT NULL
--   AND NOT EXISTS (SELECT 1 FROM journal_entries e WHERE e.id = l.journal_id);
