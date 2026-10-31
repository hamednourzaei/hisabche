-- ============================================================================
-- docs/VERIFY-payroll-idempotency-01.sql
--
-- Verification query for payroll-idempotency-01-migration.sql.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================================================

SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payrolls'
      AND column_name = 'client_request_id'
  ) AS column_client_request_id_exists,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'payrolls'
      AND indexname = 'idx_payrolls_client_request_id'
  ) AS index_idx_payrolls_client_request_id_exists;
