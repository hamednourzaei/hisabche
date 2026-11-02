-- ============================================================================
-- docs/VERIFY-invoice-write-grant-01.sql
--
-- Verification script for docs/invoice-write-grant-01-migration.sql
-- Status: PENDING HUMAN CONFIRMATION
--
-- RUN:
--   psql "$DATABASE_URL" -f docs/VERIFY-invoice-write-grant-01.sql
--
-- EXPECTED:
--   All assertions return true.
-- ============================================================================

SELECT
  to_regprocedure('public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb)') IS NOT NULL
    AS invoice_write_document_11_args_exists,

  EXISTS (
    SELECT 1 FROM information_schema.routines
     WHERE specific_schema = 'public'
       AND routine_name = 'document_write_rows'
  ) AS document_write_rows_exists;
