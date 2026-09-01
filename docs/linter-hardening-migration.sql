-- ============================================================================
-- docs/linter-hardening-migration.sql
--
-- Everything Supabase's database linter found. One of them is serious.
--
-- ---------------------------------------------------------------------------
-- ⚠️ THE ONE THAT MATTERS: THE RPCs ARE REACHABLE FROM THE BROWSER
--
-- Twelve `SECURITY DEFINER` functions are exposed through PostgREST at
-- `/rest/v1/rpc/<name>`, callable by `anon` and by `authenticated`.
--
-- Each of them takes the workspace as a PARAMETER:
--
--     payments_record(p_workspace_id, p_user_id, p_payment, p_allocations)
--     accounting_post_journal_entry(p_workspace_id, p_user_id, p_entry, p_lines)
--
-- They trust that parameter, because the only caller was ever the backend —
-- which has already checked membership before it calls. Exposed to the
-- browser, that trust is the entire tenancy boundary handed to whoever is
-- typing:
--
--     POST /rest/v1/rpc/payments_record
--     { "p_workspace_id": "<somebody else's workspace>", ... }
--
-- SECURITY DEFINER means it runs as the owner and RLS does not apply. So that
-- call posts a payment into another business's books, and every guard in the
-- application is upstream of a door that was never locked.
--
-- Nothing exploited it — the frontend has no `supabase.from()` or `.rpc()` call
-- anywhere; every request goes through Fastify on `service_role`. But "nobody
-- has walked through it yet" is not a security control.
--
-- ---------------------------------------------------------------------------
-- WHY REVOKE RATHER THAN ADD CHECKS INSIDE THE FUNCTIONS
--
-- The functions could each verify `is_workspace_member(p_workspace_id,
-- auth.uid())`. That is twelve places to get right, twelve places to forget on
-- the thirteenth function, and it makes them slower for the caller that is
-- actually legitimate.
--
-- Revoking is one line each, cannot be forgotten halfway, and states the real
-- rule: these are internal. `service_role` bypasses grants, so the backend is
-- unaffected.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── 1. Views: SECURITY INVOKER ─────────────────────────────────────────────
--
-- A view runs with its CREATOR's permissions unless told otherwise, so a view
-- over `invoices` returns every workspace's invoices to whoever can read the
-- view — RLS on the underlying table never applies.
--
-- `security_invoker = true` makes the view run as the QUERYING user, which is
-- what anyone reading `transactions_view` would assume it already did.
--
-- ⚠️ Postgres 15+. Supabase is well past that.

DO $$
DECLARE
  v_view TEXT;
BEGIN
  FOREACH v_view IN ARRAY ARRAY[
    'sync_horizon',
    'transactions_view',
    'ledger_entries_view',
    'invoice_outstanding'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = v_view
    ) THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v_view);
      RAISE NOTICE 'security_invoker: %', v_view;
    END IF;
  END LOOP;
END $$;

-- ─── 2. Functions: pin the search_path ──────────────────────────────────────
--
-- Without a fixed `search_path`, a caller who can create objects could put a
-- table called `invoices` in a schema that resolves first, and a SECURITY
-- DEFINER function — running as its owner — would read theirs instead.
--
-- ⚠️ `pg_temp` is deliberately absent from these paths. It resolves BEFORE
-- `public` by default, so a caller with a temp table named `invoices` shadows
-- the real one. Naming only `public` removes that.

DO $$
DECLARE
  v_signature TEXT;
BEGIN
  FOR v_signature IN
    SELECT format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      -- Only the ones the linter named, plus anything else still unpinned.
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION public.%s SET search_path = public', v_signature);
    RAISE NOTICE 'search_path pinned: %', v_signature;
  END LOOP;
END $$;

-- ─── 3. Close the RPCs to the browser ───────────────────────────────────────
--
-- ⚠️ THE THREE RLS HELPERS ARE EXCLUDED, AND THAT IS NOT AN OVERSIGHT.
--
-- `auth_workspace_ids`, `is_workspace_member` and `auth_owned_workspace_ids`
-- are called INSIDE the policies:
--
--     USING (workspace_id IN (SELECT auth_workspace_ids()))
--
-- A policy body is evaluated with the QUERYING role's privileges. Revoke
-- EXECUTE from `authenticated` and every policy that calls one starts failing
-- with `permission denied for function` — which locks every signed-in user out
-- of every table, and looks exactly like a broken RLS configuration rather
-- than a revoked grant.
--
-- The first draft of this file revoked all fifteen. It would have taken the
-- product down for everyone who was logged in.
--
-- They stay callable by `authenticated`, and the linter's warning about them
-- is accepted: `auth_workspace_ids()` and `auth_owned_workspace_ids()` take no
-- arguments and read `auth.uid()`, so a caller can only ever ask about
-- themselves. `is_workspace_member(ws, user)` does take arguments and can be
-- used to probe whether a given user is in a given workspace — a small
-- information leak, and the cost of having working policies.
--
-- `anon` and `PUBLIC` are revoked from all fifteen: a policy is never
-- evaluated for an anonymous caller on these tables.

DO $$
DECLARE
  v_signature TEXT;
  v_name      TEXT;
  v_all       integer := 0;
  v_closed    integer := 0;
BEGIN
  FOR v_name, v_signature IN
    SELECT p.proname, format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef                       -- SECURITY DEFINER only
      AND p.prokind = 'f'
  LOOP
    -- Everyone loses the PUBLIC default and anonymous access.
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', v_signature);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM anon', v_signature);
    v_all := v_all + 1;

    -- Signed-in users lose everything EXCEPT the three the policies call.
    IF v_name NOT IN ('auth_workspace_ids', 'is_workspace_member', 'auth_owned_workspace_ids') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM authenticated', v_signature);
      v_closed := v_closed + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'anon+PUBLIC revoked on % functions', v_all;
  RAISE NOTICE 'authenticated revoked on % (3 RLS helpers kept — policies call them)', v_closed;
END $$;

-- The helpers must remain callable by `authenticated`, so grant explicitly in
-- case a REVOKE above or a default-privilege change ever takes them away.
GRANT EXECUTE ON FUNCTION public.auth_workspace_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_owned_workspace_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;

-- ─── 4. Stop the next one being open by default ─────────────────────────────
--
-- Everything above fixes what exists. This stops the thirteenth function from
-- arriving with the same hole: new functions in `public` will not be granted
-- to `anon` or `authenticated` at creation.

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated;

COMMIT;

-- ─── Prove it ───────────────────────────────────────────────────────────────
--
-- Expect EXACTLY three rows — the RLS helpers, kept on purpose. Anything else
-- listed here is a multi-table write still callable from a browser.

SELECT
  p.proname AS still_callable,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  CASE
    WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'anon'
    ELSE 'authenticated'
  END AS by_role
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
  AND (
    has_function_privilege('anon', p.oid, 'EXECUTE')
    OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )
ORDER BY 1;

-- Expected, and only these:
--   auth_owned_workspace_ids  ()                          authenticated
--   auth_workspace_ids        ()                          authenticated
--   is_workspace_member       (_workspace_id, _user_id)   authenticated
