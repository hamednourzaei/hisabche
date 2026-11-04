-- ============================================
-- VERIFY-credit-concurrency-01.sql
-- Run after credit-concurrency-01-migration.sql on a real Postgres.
-- Every returned row must be ok = true.
-- ============================================
SELECT
  'function exists' AS check_name,
  (COUNT(*) = 1)::boolean AS ok
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'assert_customer_credit';

SELECT
  'revoked from PUBLIC' AS check_name,
  (COUNT(*) = 0)::boolean AS ok
FROM information_schema.routine_privileges rp
WHERE rp.specific_schema = 'public'
  AND rp.specific_name = 'assert_customer_credit'
  AND rp.grantee IN ('PUBLIC', 'anon', 'authenticated');

SELECT
  'search_path set' AS check_name,
  (COUNT(*) = 1)::boolean AS ok
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'assert_customer_credit'
  AND p.proconfig::text LIKE '%search_path = public, pg_temp%';

-- Two concurrent calls for the same customer must not both pass when the
-- second would exceed the limit. This is the concurrency proof; it needs a
-- real Postgres with two sessions and is not covered by unit tests.
