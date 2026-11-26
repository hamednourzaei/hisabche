-- ============================================
-- docs/VERIFY-budget-currency-02.sql
-- Post-migration verification for budget-currency-02-any-unit-migration.sql.
-- Status target after human execution: Post-migration verification query generated - PENDING HUMAN CONFIRMATION.
-- ============================================

SELECT conname, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'budgets'
  AND conname IN ('budgets_currency_check', 'budgets_fx_check')
ORDER BY conname;
