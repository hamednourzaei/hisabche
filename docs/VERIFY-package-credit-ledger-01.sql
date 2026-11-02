-- ============================================================================
-- Hisabche Migration Verification: Package Credit and Entitlement Ledger (M3)
-- File: docs/VERIFY-package-credit-ledger-01.sql
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================================================

SELECT
  'table_exists' AS check_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'package_credit_ledger'
  ) AS passed;

SELECT
  'columns_check' AS check_name,
  COUNT(*) = 17 AS passed
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'package_credit_ledger';

SELECT
  'check_constraint' AS check_name,
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_package_credit_ledger_entry_type'
  ) AS passed;

SELECT
  'idempotency_index' AS check_name,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'package_credit_ledger'
      AND indexname = 'uq_pkg_credit_idempotency'
  ) AS passed;

SELECT
  'rls_enabled' AS check_name,
  rowsecurity AS passed
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'package_credit_ledger';

SELECT
  'function_package_credit_consume_exists' AS check_name,
  EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'package_credit_consume'
  ) AS passed;

SELECT
  'trigger_immutability_exists' AS check_name,
  EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND event_object_table = 'package_credit_ledger'
      AND trigger_name = 'trg_prevent_package_credit_ledger_mutation'
  ) AS passed;
