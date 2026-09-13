-- ============================================================================
-- MIGRATION — close SECURITY DEFINER functions that trust a workspace argument
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
--
-- RUN FIRST: docs/VERIFY-security-definer-exposure.sql
-- If every row there already shows anon_can_execute = false AND
-- authenticated_can_execute = false, this migration is a harmless no-op.
--
-- WHAT IT DOES
--   Removes EXECUTE from PUBLIC, anon and authenticated on every
--   SECURITY DEFINER function in `public` whose arguments name a workspace,
--   and keeps it for service_role.
--
-- WHY IT IS SAFE FOR THE APP
--   The backend calls these through the service-role client (`supabase` in
--   backend/src/db.ts). service_role keeps EXECUTE. The browser never calls
--   them directly — if a screen breaks after this, that screen was calling a
--   workspace-trusting RLS-bypassing function from the client, which is the
--   hole being closed.
--
-- ADDITIVE / IDEMPOTENT
--   REVOKE and GRANT are re-runnable. No data, table or function body changes.
-- ============================================================================

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM   pg_proc p
    JOIN   pg_namespace n ON n.oid = p.pronamespace
    WHERE  n.nspname = 'public'
      AND  p.prosecdef = true
      AND  pg_get_function_identity_arguments(p.oid) ILIKE '%workspace%'
      -- ⚠️ THE RLS HELPERS ARE EXCLUDED. Policies call them as the signed-in
      -- role, so revoking them from `authenticated` breaks every policy that
      -- uses them (docs/linter-hardening-migration.sql explains this and
      -- keeps them open on purpose). An earlier version of THIS file did not
      -- exclude them and revoked is_workspace_member from authenticated.
      AND  p.proname NOT IN ('auth_workspace_ids', 'is_workspace_member', 'auth_owned_workspace_ids')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn.signature);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn.signature);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', fn.signature);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO service_role', fn.signature);
    RAISE NOTICE 'restricted %', fn.signature;
  END LOOP;
END $$;

-- ─── Verification ───────────────────────────────────────────────────────────
-- Expected after running: zero rows.
SELECT  p.oid::regprocedure AS still_exposed
FROM    pg_proc p
JOIN    pg_namespace n ON n.oid = p.pronamespace
WHERE   n.nspname = 'public'
  AND   p.prosecdef = true
  AND   pg_get_function_identity_arguments(p.oid) ILIKE '%workspace%'
  AND   p.proname NOT IN ('auth_workspace_ids', 'is_workspace_member', 'auth_owned_workspace_ids')
  AND   (has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));

-- ─── Rollback / Mitigation ──────────────────────────────────────────────────
-- ⚠️ IF THE EARLIER VERSION OF THIS FILE WAS RUN, RESTORE THE RLS HELPER NOW:
--
--   GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;
--
-- (auth_workspace_ids and auth_owned_workspace_ids take no workspace argument,
--  so the earlier filter never touched them.)
--
-- Only if a legitimate CLIENT-side caller is found to break. Re-grant that ONE
-- function to `authenticated` — never `anon` — and fix the function to derive
-- the workspace from auth_workspace_ids() instead of trusting its argument:
--
--   GRANT EXECUTE ON FUNCTION public.<name>(<args>) TO authenticated;
