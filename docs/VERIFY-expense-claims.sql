-- ============================================================================
-- docs/VERIFY-expense-claims.sql
--
-- Verification query for Option 9 (Expense Claims).
-- ============================================================================

SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('expense_reports', 'expense_lines')
ORDER BY table_name, ordinal_position;
