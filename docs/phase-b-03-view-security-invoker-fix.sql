-- ============================================================================
-- docs/phase-b-03-view-security-invoker-fix.sql
--
-- 🔴 RUN THIS NOW. It closes a tenancy hole that phase-b-01 opened.
--
-- ---------------------------------------------------------------------------
-- WHAT WENT WRONG
--
-- A Postgres view runs with its CREATOR's permissions unless it is told
-- otherwise. `security_invoker = true` switches it to the querying user's
-- permissions, which is the only setting under which RLS on the tables beneath
-- a view has any effect.
--
-- `linter-hardening-migration.sql` set that flag on `transactions_view` once,
-- deliberately, for exactly this reason.
--
-- `phase-b-01` had to DROP that view to change a column's type (42P16 forbids
-- replacing it in place) — and a DROP takes the view's settings with it. The
-- rebuilt view came back at the default, and `party_ledger` never had the flag
-- at all.
--
-- The result, live right now: any signed-in user reading
-- `/rest/v1/party_ledger` or `/rest/v1/transactions_view` gets EVERY
-- workspace's invoices, payments and party movements. The workspace filter
-- these views' callers pass is a filter, not a boundary — it keeps honest
-- clients honest and stops nobody else.
--
-- The backend is unaffected either way: it holds the service_role key, which
-- bypasses RLS regardless. The exposure is the PostgREST surface.
--
-- ---------------------------------------------------------------------------
-- THE LESSON, so it does not happen a third time
--
-- `security_invoker` is a property of the VIEW, not of the schema. Any
-- migration that drops and re-creates a view must re-apply it in the same file.
-- `phase-b-01` has been corrected to do so; this file repairs the database that
-- already ran the uncorrected version.
--
-- Section 2 also pins `search_path` on the two trigger functions Phase B added,
-- matching section 2 of `linter-hardening-migration.sql`.
--
-- SAFE TO RE-RUN. Changes no data and no view definition — only properties.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The views
--
-- Guarded per view so this file also serves as the sweep: if a later migration
-- rebuilds one of these and forgets again, re-running this closes it.
-- ---------------------------------------------------------------------------

DO $views$
DECLARE
  v_view text;
  v_fixed int := 0;
BEGIN
  FOREACH v_view IN ARRAY ARRAY[
    'party_ledger',
    'transactions_view',
    'ledger_entries_view',
    'invoice_outstanding',
    'sync_horizon'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = v_view
    ) THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v_view);
      v_fixed := v_fixed + 1;
      RAISE NOTICE 'security_invoker = true: %', v_view;
    END IF;
  END LOOP;

  RAISE NOTICE 'phase-b-03: % view(s) set to security_invoker.', v_fixed;
END
$views$;

-- ---------------------------------------------------------------------------
-- 2. The Phase B trigger functions
--
-- Without a fixed search_path, a caller able to create objects can put a table
-- named `transactions` in a schema that resolves first. `pg_temp` is left out
-- on purpose — it resolves BEFORE public, which is the same problem by another
-- road.
--
-- ALTER FUNCTION, not CREATE OR REPLACE: the bodies are unchanged and live in
-- phase-b-01 and phase-b-02, which have also been corrected. Re-defining them
-- here would give this file a second copy of each to drift from.
-- ---------------------------------------------------------------------------

DO $fns$
DECLARE
  v_fn text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'ledger_entries_frozen',
    'transactions_reject_money_movement'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_fn
    ) THEN
      EXECUTE format('ALTER FUNCTION public.%I() SET search_path = public', v_fn);
      RAISE NOTICE 'search_path pinned: %', v_fn;
    END IF;
  END LOOP;
END
$fns$;

COMMIT;

-- ============================================================================
-- VERIFY — every public view, and whether RLS underneath it applies.
-- `security_invoker` must be true on all of them.
-- ============================================================================
--
-- SELECT c.relname AS view_name,
--        COALESCE(
--          (SELECT option_value
--             FROM pg_options_to_table(c.reloptions)
--            WHERE option_name = 'security_invoker'),
--          'false (DEFINER — RLS DOES NOT APPLY)'
--        ) AS security_invoker
-- FROM   pg_class c
-- JOIN   pg_namespace n ON n.oid = c.relnamespace
-- WHERE  c.relkind = 'v' AND n.nspname = 'public'
-- ORDER  BY 2, 1;
