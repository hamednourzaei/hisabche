-- ============================================
-- VERIFY-credit-concurrency-03.sql — run AFTER credit-concurrency-03. Read-only, one row.
-- Every column must be true.
--
-- The call uses two random ids: no such workspace or customer exists, so it
-- takes the «no limit» branch and writes nothing. The unit conversion itself is
-- asserted from the deployed function body and proven with real rows by
-- backend/src/__tests__/credit-concurrency-03.pg.test.ts.
-- ============================================
SELECT
  (SELECT count(*) = 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'assert_customer_credit') AS function_exists,
  (SELECT count(*) = 1
     FROM public.assert_customer_credit(gen_random_uuid(), gen_random_uuid(), 100)) AS answers_one_row,
  (SELECT bool_and(allowed)
     FROM public.assert_customer_credit(gen_random_uuid(), gen_random_uuid(), 100)) AS no_limit_is_allowed,
  -- The body converts BOTH sides to the caller's 1/100 unit before comparing.
  (SELECT pg_get_functiondef(p.oid) LIKE '%v_receivable_minor := round(v_receivable * 100)%'
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'assert_customer_credit') AS receivable_scaled,
  (SELECT pg_get_functiondef(p.oid) LIKE '%v_limit_minor := round(v_limit * 100)%'
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'assert_customer_credit') AS limit_scaled,
  NOT has_function_privilege('anon', 'public.assert_customer_credit(uuid, uuid, bigint)', 'EXECUTE')
    AS anon_cannot_execute,
  NOT has_function_privilege('authenticated', 'public.assert_customer_credit(uuid, uuid, bigint)', 'EXECUTE')
    AS authenticated_cannot_execute,
  has_function_privilege('service_role', 'public.assert_customer_credit(uuid, uuid, bigint)', 'EXECUTE')
    AS service_role_can_execute;
