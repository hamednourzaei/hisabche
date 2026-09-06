-- ============================================================================
-- docs/phase-n-01-reconciliation-memory-migration.sql
--
-- PHASE N · N1 — the one column that lets reconciliation learn.
--
-- ---------------------------------------------------------------------------
-- WHY THE SCORER COULD NOT LEARN
--
-- `bank_statement_lines.matched_to` holds the id of the BOOK ENTRY a line was
-- reconciled against. That id is unique to one payment or one journal entry,
-- so it is different every month:
--
--   Jan  «DABS KABUL 4471»  →  payment-a1f2…
--   Feb  «DABS KABUL 4482»  →  payment-9c04…
--
-- A pattern that maps to a different id every time teaches nothing. The stable
-- fact — «this description means this supplier» — was never written down: the
-- party name lives on the BookEntry the scorer assembles at read time, from
-- payments, invoices and journals, and is discarded once the match is
-- confirmed.
--
-- This column keeps it.
--
-- ---------------------------------------------------------------------------
-- ⚠️ ADDITIVE, NULLABLE, AND NOT BACKFILLED
--
-- Every line reconciled before this migration keeps NULL. The party could be
-- recovered by joining `matched_to` across three tables, but only for entries
-- that still exist and still carry the same name — so a backfill would be
-- partly right and entirely unmarked (§12).
--
-- The learner simply has less history to work with until confirmations
-- accumulate, and it already refuses to act on fewer than three observations.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
--   ALTER TABLE bank_statement_lines DROP COLUMN IF EXISTS matched_party;
--
-- Safe. It discards the learned history; suggestions fall back to exactly the
-- four signals they scored on before N1.
--
-- SAFE TO RE-RUN.
-- ============================================================================

-- ============================================================================
-- PRE-MIGRATION VERIFICATION
-- ============================================================================
--
-- P1. Does the column already exist? (Expected: no rows.)
--
--   SELECT column_name FROM information_schema.columns
--   WHERE  table_name = 'bank_statement_lines' AND column_name = 'matched_party';
--
-- P2. How much history exists that will NOT be backfilled?
--
--   SELECT COUNT(*) AS already_reconciled
--   FROM   bank_statement_lines WHERE matched_to IS NOT NULL;
--
-- ============================================================================

BEGIN;

ALTER TABLE bank_statement_lines
  ADD COLUMN IF NOT EXISTS matched_party text;

COMMENT ON COLUMN bank_statement_lines.matched_party IS
  'N1 — the counterparty NAME this line was reconciled against, written at confirmation. `matched_to` holds an entry id, which is unique per month and so teaches a learner nothing; this is the stable fact behind «this description means this supplier». NULL on anything reconciled before phase-n-01 — deliberately not backfilled.';

CREATE INDEX IF NOT EXISTS bank_statement_lines_matched_party_idx
  ON bank_statement_lines (workspace_id, matched_party)
  WHERE matched_party IS NOT NULL;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
-- ============================================================================
--
-- V1. The column exists and is nullable.
--
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--   WHERE  table_name = 'bank_statement_lines' AND column_name = 'matched_party';
--
-- V2. ⚠️ NOTHING WAS BACKFILLED.
--
--   SELECT COUNT(*) FROM bank_statement_lines WHERE matched_party IS NOT NULL;
--   -- expect 0 immediately after the migration
--
-- V3. AFTER A FEW CONFIRMATIONS — the party is being recorded, and the same
--     description pattern is resolving to the same party.
--
--   SELECT matched_party, COUNT(*) AS confirmations
--   FROM   bank_statement_lines
--   WHERE  matched_party IS NOT NULL
--   GROUP  BY matched_party ORDER BY 2 DESC LIMIT 20;
--
-- ============================================================================
