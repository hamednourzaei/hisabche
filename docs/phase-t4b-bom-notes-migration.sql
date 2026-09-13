-- ============================================================================
-- docs/phase-t4b-bom-notes-migration.sql
--
-- Adds `boms.notes`, which the validation contract (manufacturing.schema.ts
-- `notes`) and the BOM create/update service have always assumed, but which no
-- migration in docs/ ever created. Selecting it made GET /api/boms answer 500.
--
-- The backend no longer SELECTS notes, so the page works without this file.
-- Without it, a create/update that actually supplies `notes` still fails.
--
-- ADDITIVE · IDEMPOTENT · SAFE TO RE-RUN. No backfill: existing rows stay NULL.
--
-- STATUS: PENDING HUMAN CONFIRMATION — run by a human in the SQL Editor.
--
-- ROLLBACK / MITIGATION
--   ALTER TABLE boms DROP COLUMN IF EXISTS notes;
--   (Only if no row has been written with a note; check first:
--    SELECT count(*) FROM boms WHERE notes IS NOT NULL;)
-- ============================================================================

BEGIN;

ALTER TABLE boms ADD COLUMN IF NOT EXISTS notes text;

COMMIT;

-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'boms' AND column_name = 'notes';
--   -- expect one row: notes | text | YES
