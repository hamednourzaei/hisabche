-- ============================================================================
-- Verification: docs/VERIFY-invoice-return-01.sql
-- Name: Post-migration verification for invoice_return_create
-- Phase: Universal Core / Launch Critical
-- Date: 2026-10-26
-- ============================================================================

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'invoice_return_create';

SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('invoice_returns', 'invoice_return_lines');
