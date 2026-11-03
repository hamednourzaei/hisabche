-- ============================================================================
-- docs/VERIFY-customer-advances-01.sql
--
-- Verification script for docs/customer-advances-01-migration.sql
-- Status: PENDING HUMAN CONFIRMATION
--
-- RUN:
--   psql "$DATABASE_URL" -f docs/VERIFY-customer-advances-01.sql
--
-- EXPECTED:
--   Every assertion returns true. «Success. No rows returned» is NOT a pass.
-- ============================================================================

SELECT
  c.convalidated                                             AS constraint_validated,
  pg_get_constraintdef(c.oid) LIKE '%customer_advances%'     AS has_customer_advances_in_check,
  pg_get_constraintdef(c.oid) LIKE '%deferred_revenue%'      AS keeps_deferred_revenue,
  pg_get_constraintdef(c.oid) LIKE '%inventory_loss%'        AS keeps_inventory_loss,
  pg_get_constraintdef(c.oid) LIKE '%''bank''%'              AS keeps_existing_roles,
  pg_get_constraintdef(c.oid) LIKE '%''receivable''%'        AS keeps_receivable
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
WHERE t.relname = 'accounts' AND c.conname = 'accounts_role_check';
