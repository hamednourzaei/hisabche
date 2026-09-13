-- ============================================================================
-- READ-ONLY. Can an ordinary caller execute a function that bypasses RLS and
-- trusts a workspace id it is handed?
--
-- WHY THIS MATTERS
--
-- `accounting_trial_balance(p_workspace_id, …)` is SECURITY DEFINER — it runs
-- with its owner's rights and bypasses row-level security — and it takes the
-- workspace as an argument. No migration in `docs/` REVOKEs it.
--
-- Postgres grants EXECUTE on a new function to PUBLIC by default, and Supabase
-- exposes functions in the `public` schema at /rest/v1/rpc/<name> to the
-- `anon` and `authenticated` roles. The anon key ships inside the client
-- bundle, so it is public.
--
-- If `anon_can_execute` or `authenticated_can_execute` is TRUE below, anyone
-- can POST /rest/v1/rpc/accounting_trial_balance with another business's
-- workspace id and read its books.
-- ============================================================================

SELECT  p.proname                                                     AS function_name,
        pg_get_function_identity_arguments(p.oid)                     AS arguments,
        p.prosecdef                                                   AS security_definer,
        has_function_privilege('anon',          p.oid, 'EXECUTE')     AS anon_can_execute,
        has_function_privilege('authenticated', p.oid, 'EXECUTE')     AS authenticated_can_execute,
        has_function_privilege('service_role',  p.oid, 'EXECUTE')     AS service_role_can_execute
FROM    pg_proc p
JOIN    pg_namespace n ON n.oid = p.pronamespace
WHERE   n.nspname = 'public'
  AND   p.prosecdef = true                                  -- bypasses RLS
  AND   pg_get_function_identity_arguments(p.oid) ILIKE '%workspace%'
ORDER BY anon_can_execute DESC, authenticated_can_execute DESC, function_name;
