-- ============================================================================
-- docs/linter-2026-09-14-migration.sql
--
-- Supabase security linter, 2026-09-14. Five warnings closed here; the sixth
-- (leaked password protection) is a dashboard setting, not SQL.
--
-- ---------------------------------------------------------------------------
-- 1–2. function_search_path_mutable
--   product_units_replace(uuid, uuid, jsonb), budget_revisions_immutable()
--   Pin search_path so a caller's session search_path cannot redirect the
--   unqualified table names inside them. Body and behaviour unchanged.
--
-- ---------------------------------------------------------------------------
-- 3–5. authenticated_security_definer_function_executable
--   auth_workspace_ids(), auth_owned_workspace_ids(), is_workspace_member(uuid, uuid)
--
--   docs/linter-hardening-migration.sql kept these callable by `authenticated`
--   on purpose: RLS policies call them, a policy runs with the QUERYING role's
--   privileges, and revoking EXECUTE would lock every signed-in user out of
--   every table. That reasoning still holds — so this file does NOT revoke.
--
--   Instead the three move to schema `private`, which PostgREST does not
--   expose. `/rest/v1/rpc/is_workspace_member` stops existing (closing the
--   membership probe), while policies and views keep working: Postgres stores
--   a policy's / view's function reference by OID, and ALTER FUNCTION … SET
--   SCHEMA keeps the OID.
--
--   ⚠️ WHAT WOULD BREAK: code that calls them BY NAME at run time — a plpgsql
--   body, or a non-atomic SQL function body. Step 0 looks for such callers in
--   the live database and ABORTS the whole file (nothing changes) if it finds
--   one, naming it. Better a refused migration than a lock-out.
--
--   ⚠️ Re-running an OLD file that does CREATE OR REPLACE FUNCTION
--   public.auth_workspace_ids() (rls-performance-migration.sql,
--   SETUP-COMPLETE.sql) creates a new, unused public copy and brings the
--   warning back. It breaks nothing.
--
-- ROLLBACK / MITIGATION
--   ALTER FUNCTION private.auth_workspace_ids()             SET SCHEMA public;
--   ALTER FUNCTION private.auth_owned_workspace_ids()       SET SCHEMA public;
--   ALTER FUNCTION private.is_workspace_member(uuid, uuid)  SET SCHEMA public;
--   ALTER FUNCTION public.product_units_replace(uuid, uuid, jsonb) RESET search_path;
--   ALTER FUNCTION public.budget_revisions_immutable()             RESET search_path;
--
-- IDEMPOTENT. SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── 0. Refuse if anything calls the helpers by name at run time ────────────
DO $$
DECLARE
  v_callers text;
BEGIN
  SELECT string_agg(DISTINCT n.nspname || '.' || p.proname, ', ')
    INTO v_callers
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND p.proname NOT IN ('auth_workspace_ids', 'auth_owned_workspace_ids', 'is_workspace_member')
    AND p.prosqlbody IS NULL                       -- atomic SQL bodies are bound by OID
    AND p.prosrc ~ '(auth_workspace_ids|auth_owned_workspace_ids|is_workspace_member)';

  IF v_callers IS NOT NULL THEN
    RAISE EXCEPTION 'LINTER_ABORT: these functions call the RLS helpers by name and would break: %', v_callers;
  END IF;
END $$;

-- ─── 1–2. Pin search_path ──────────────────────────────────────────────────
ALTER FUNCTION public.product_units_replace(uuid, uuid, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.budget_revisions_immutable()             SET search_path = public, pg_temp;

-- ─── 3–5. Move the RLS helpers out of the exposed schema ────────────────────
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('public.auth_workspace_ids()') IS NOT NULL
     AND to_regprocedure('private.auth_workspace_ids()') IS NULL THEN
    ALTER FUNCTION public.auth_workspace_ids() SET SCHEMA private;
  END IF;
  IF to_regprocedure('public.auth_owned_workspace_ids()') IS NOT NULL
     AND to_regprocedure('private.auth_owned_workspace_ids()') IS NULL THEN
    ALTER FUNCTION public.auth_owned_workspace_ids() SET SCHEMA private;
  END IF;
  IF to_regprocedure('public.is_workspace_member(uuid, uuid)') IS NOT NULL
     AND to_regprocedure('private.is_workspace_member(uuid, uuid)') IS NULL THEN
    ALTER FUNCTION public.is_workspace_member(uuid, uuid) SET SCHEMA private;
  END IF;
END $$;

-- Policies still need to execute them as the signed-in user.
REVOKE ALL ON FUNCTION private.auth_workspace_ids()            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.auth_owned_workspace_ids()      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.auth_workspace_ids()            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.auth_owned_workspace_ids()      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_workspace_member(uuid, uuid) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
