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

-- V61 audit (12 Nov 2026): clients are locked out — RLS on, no policy, and
-- neither anon nor authenticated holds any privilege. Expect ok = true.
SELECT 'clients_locked' AS check_name,
       bool_and(c.relrowsecurity)
       AND NOT bool_or(
             has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
          OR has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE'))
       AND NOT EXISTS (
             SELECT 1 FROM pg_policies p
              WHERE p.schemaname = 'public' AND p.tablename = ANY (ARRAY['contracts', 'contract_obligations']))
       AND count(*) = 2 AS ok
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('contracts', 'contract_obligations');
