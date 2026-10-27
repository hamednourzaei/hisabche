-- ============================================================================
-- docs/VERIFY-landed-costs.sql
--
-- Verification query for Option 13 (Landed Costs).
-- ============================================================================

SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('landed_costs', 'landed_cost_lines')
ORDER BY table_name, ordinal_position;
