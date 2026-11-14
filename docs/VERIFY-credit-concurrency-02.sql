-- ============================================
-- VERIFY-credit-concurrency-02.sql — run AFTER credit-concurrency-02. Read-only, one row.
-- Every column must be true.
-- The call uses two random ids: no such workspace or customer exists, so it takes the
-- «no limit» branch — exactly the one that failed before — and writes nothing.
-- ============================================
SELECT
  (SELECT count(*) = 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'assert_customer_credit') AS function_exists,
  (SELECT count(*) = 1
     FROM public.assert_customer_credit(gen_random_uuid(), gen_random_uuid(), 100)) AS answers_one_row,
  (SELECT bool_and(allowed)
     FROM public.assert_customer_credit(gen_random_uuid(), gen_random_uuid(), 100)) AS no_limit_is_allowed,
  NOT has_function_privilege('anon', 'public.assert_customer_credit(uuid, uuid, bigint)', 'EXECUTE')
    AS anon_cannot_execute,
  NOT has_function_privilege('authenticated', 'public.assert_customer_credit(uuid, uuid, bigint)', 'EXECUTE')
    AS authenticated_cannot_execute,
  has_function_privilege('service_role', 'public.assert_customer_credit(uuid, uuid, bigint)', 'EXECUTE')
    AS service_role_can_execute;
