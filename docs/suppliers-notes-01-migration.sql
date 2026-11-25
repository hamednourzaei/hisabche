-- ============================================================================
-- docs/suppliers-notes-01-migration.sql
--
-- Adds the `notes` column to `public.suppliers` (additive, idempotent).
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running this file in the Supabase SQL Editor, run:
--    docs/VERIFY-suppliers-notes-01.sql
--
-- PREREQUISITES:
--   - docs/base-schema-migration.sql (creates public.suppliers)
--
-- RULES THE DATABASE HOLDS:
--   - `suppliers.notes` stores free-form supplier notes as `text` defaulting
--     to empty string (`''`), matching `SupplierService` (`list`, `get`,
--     `create`, `update`) while keeping existing rows valid in O(1) DDL time.
--   - Existing RLS and role grants on `public.suppliers` remain intact.
--   - `NOTIFY pgrst, 'reload schema'` clears stale PostgREST schema cache.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.suppliers') IS NULL THEN
    RAISE EXCEPTION 'Run docs/base-schema-migration.sql first: public.suppliers does not exist';
  END IF;
END $$;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

COMMENT ON COLUMN public.suppliers.notes IS
  'Optional internal notes about this supplier, read and written by SupplierService.';

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK (manual only — permanently drops any notes stored on suppliers rows;
-- existing supplier rows and other columns are untouched):
-- ============================================================================
-- ALTER TABLE public.suppliers DROP COLUMN IF EXISTS notes;
-- NOTIFY pgrst, 'reload schema';
