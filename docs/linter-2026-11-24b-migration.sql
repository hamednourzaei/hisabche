-- ============================================================================
-- docs/linter-2026-11-24b-migration.sql — Supabase linter, reported 24 Nov 2026
-- 11:09 UTC (the second batch of the same day).
--
--   0011  Function Search Path Mutable                    7 functions
--   0014  Extension in Public                             btree_gist
--   0028  Public Can Execute SECURITY DEFINER Function    2 functions
--   0029  Signed-In Users Can Execute SECURITY DEFINER    4 functions
--
-- The three classes in the 09:29 report (auth_rls_initplan,
-- multiple_permissive_policies, duplicate_index) are handled by
-- docs/linter-2026-11-24-migration.sql. This file does not repeat them.
--
-- NOT IN THIS FILE — «Leaked Password Protection Disabled» is not SQL. It is a
-- switch in the dashboard: Authentication → Sign In / Providers → Email →
-- «Prevent use of leaked passwords». A person turns it on; no migration can.
--
-- WHY THIS FILE EXISTS
-- Every rule below is already written in the feature migration that owns the
-- object: entitlement-02, operational-profile-01, service-delivery-01,
-- offline-licence-keys-01/02, exchange-01, retail-ops-01,
-- sync-entity-coverage, package-credit-ledger-01, package-deferred-revenue-01,
-- subscription-orders-claim, appointment-conflict-02 and resource-capacity-01.
-- A database that ran those files BEFORE the lines were added still carries the
-- old state, and re-running a feature migration is not how a live database is
-- patched. This file applies exactly those rules, once.
--
-- Additive in effect, idempotent, re-runnable.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- (docs/VERIFY-linter-2026-11-24b.sql)
-- ============================================================================

BEGIN;

-- ─── 1. search_path on the seven trigger functions ─────────────────────────
--
-- All seven are SECURITY INVOKER; the warning is not privilege escalation but
-- name resolution: an unqualified name in the body is looked up through the
-- CALLER's search_path. `ALTER FUNCTION … SET` changes only the configuration —
-- body, triggers and callers are untouched. Every ALTER is guarded, so a
-- database that has not had one of the feature migrations is not an error.
--
-- `pg_temp` is last, not first: that is the ordering the 2026-10-11 linter fix
-- uses, and the only ordering in which a temporary table cannot shadow a table
-- the function names.

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.prevent_license_logs_mutation()',
    'public.workspace_operational_dna_history_frozen()',
    'public.trg_service_delivery_sessions_updated_at()',
    'public.offline_license_signing_keys_guard()',
    'public.remittance_events_append_only()',
    'public.repair_ticket_events_append_only()',
    'public.sync_record_workspace_keyed_change()'
  ]
  LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);
    END IF;
  END LOOP;
END $$;

-- ─── 2. SECURITY DEFINER functions callable by clients ─────────────────────
--
-- Two of these are append-only TRIGGER functions: a trigger fires without the
-- invoking role holding EXECUTE, so no client needs it. The other two are RPCs
-- and the only caller is the backend, whose default client is the service-role
-- key (backend/src/db.ts); they keep EXECUTE for service_role and lose it for
-- everyone else. `PUBLIC` is revoked first — that is where the default grant
-- lives, and anon/authenticated inherit it.
--
-- Roles are filtered through pg_roles: a bare Postgres (the pg test harness)
-- has no anon/authenticated/service_role, and REVOKE from a missing role would
-- abort the whole transaction.

DO $$
DECLARE
  fn    text;
  roles text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.prevent_package_credit_ledger_mutation()',
    'public.prevent_package_credit_side_table_mutation()'
  ]
  LOOP
    CONTINUE WHEN to_regprocedure(fn) IS NULL;

    SELECT string_agg(quote_ident(rolname), ', ')
      INTO roles
      FROM pg_roles
     WHERE rolname IN ('anon', 'authenticated', 'service_role');

    roles := 'PUBLIC' || coalesce(', ' || roles, '');
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s', fn, roles);
  END LOOP;

  FOREACH fn IN ARRAY ARRAY[
    'public.canonical_provision_workspace(uuid, uuid, text, text, text)',
    'public.package_credit_consume(uuid, uuid, uuid, numeric, text, text, text, date, uuid)'
  ]
  LOOP
    CONTINUE WHEN to_regprocedure(fn) IS NULL;

    SELECT string_agg(quote_ident(rolname), ', ')
      INTO roles
      FROM pg_roles
     WHERE rolname IN ('anon', 'authenticated');

    roles := 'PUBLIC' || coalesce(', ' || roles, '');
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM %s', fn, roles);

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END $$;

-- ─── 3. btree_gist out of the exposed schema ───────────────────────────────
--
-- `extensions` is Supabase's non-API schema and already holds the other
-- extensions. Moving an extension keeps the OIDs of its functions and operator
-- classes, so the two exclusion constraints that depend on them
-- (appointments_no_staff_overlap, resource_bookings_no_overlap) keep working.
-- New DDL that names the opclass must see `extensions`; the two migrations that
-- create such constraints already run `SET search_path = public, extensions`
-- first (appointment-conflict-02, resource-capacity-01).
--
-- The ALTER is skipped when the extension is absent or already moved, so a
-- second run is silent. USAGE is granted only to roles that exist.

CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA extensions TO %I', r);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist')
     AND NOT EXISTS (
       SELECT 1
         FROM pg_extension e
         JOIN pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname = 'btree_gist'
          AND n.nspname = 'extensions'
     )
  THEN
    EXECUTE 'ALTER EXTENSION btree_gist SET SCHEMA extensions';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION
--
--   ALTER FUNCTION public.<name>() RESET search_path;            -- per function
--   GRANT EXECUTE ON FUNCTION public.<name>(<args>) TO PUBLIC;   -- restores 0028/0029
--   ALTER EXTENSION btree_gist SET SCHEMA public;                -- OIDs unchanged
--
-- The leaked-password warning has no rollback because it has no migration.
-- ============================================================================
