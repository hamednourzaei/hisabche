-- ============================================================================
-- VERIFY workspace purge — read-only. Run after docs/workspace-purge-migration.sql.
-- Expect one row with ok = true.
-- ============================================================================

SELECT
  position('FOR UPDATE' in pg_get_functiondef('public.purge_workspace(uuid, text)'::regprocedure)) > 0
    AS locks_the_workspace_row,
  position('WORKSPACE_NAME_MISMATCH'
    in pg_get_functiondef('public.purge_workspace(uuid, text)'::regprocedure)) > 0
    AS requires_the_typed_name,
  position('column_name = ''workspace_id'''
    in pg_get_functiondef('public.purge_workspace(uuid, text)'::regprocedure)) > 0
    AND position('pg_constraint'
      in pg_get_functiondef('public.purge_workspace(uuid, text)'::regprocedure)) > 0
    AS covers_workspace_tables_and_fk_children,
  position('WORKSPACE_PURGE_INCOMPLETE'
    in pg_get_functiondef('public.purge_workspace(uuid, text)'::regprocedure)) > 0
    AS refuses_a_half_deleted_business,
  NOT has_function_privilege('anon', 'public.purge_workspace(uuid, text)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.purge_workspace(uuid, text)', 'EXECUTE')
    AS clients_cannot_call,
  has_function_privilege('service_role', 'public.purge_workspace(uuid, text)', 'EXECUTE')
    AS backend_can_call,
  (
    position('FOR UPDATE' in pg_get_functiondef('public.purge_workspace(uuid, text)'::regprocedure)) > 0
    AND position('WORKSPACE_NAME_MISMATCH'
      in pg_get_functiondef('public.purge_workspace(uuid, text)'::regprocedure)) > 0
    AND position('WORKSPACE_PURGE_INCOMPLETE'
      in pg_get_functiondef('public.purge_workspace(uuid, text)'::regprocedure)) > 0
    AND NOT has_function_privilege('anon', 'public.purge_workspace(uuid, text)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.purge_workspace(uuid, text)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.purge_workspace(uuid, text)', 'EXECUTE')
  ) AS ok;
