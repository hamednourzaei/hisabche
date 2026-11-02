-- ============================================================================
-- docs/VERIFY-accounts-role-deferred-and-loss-01.sql
--
-- Verification script for docs/accounts-role-deferred-and-loss-01-migration.sql
-- Status: PENDING HUMAN CONFIRMATION
--
-- RUN:
--   psql "$DATABASE_URL" -f docs/VERIFY-accounts-role-deferred-and-loss-01.sql
--
-- EXPECTED:
--   All assertions return true.
-- ============================================================================

SELECT
  pg_get_constraintdef(c.oid) LIKE '%deferred_revenue%' AS has_deferred_revenue_in_check,
  pg_get_constraintdef(c.oid) LIKE '%inventory_loss%'    AS has_inventory_loss_in_check
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
WHERE t.relname = 'accounts' AND c.conname = 'accounts_role_check';
