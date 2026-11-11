-- ============================================================================
-- docs/VERIFY-contracts-01.sql
--
-- Post-migration verification for docs/contracts-01-migration.sql.
-- Status: Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================================================

SELECT relname, relrowsecurity
  FROM pg_class
 WHERE relname IN ('contracts', 'contract_obligations');

SELECT conname, contype
  FROM pg_constraint
 WHERE conname = 'contract_obligations_unique_period';

SELECT tablename, policyname
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('contracts', 'contract_obligations');
