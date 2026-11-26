-- Verification query for update-control-plane-01-migration.sql
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION

SELECT
  to_regclass('public.runtime_release_artifacts') IS NOT NULL AS has_release_table,
  to_regclass('public.runtime_rollout_telemetry') IS NOT NULL AS has_telemetry_table,
  to_regclass('public.runtime_halt_directives') IS NOT NULL AS has_directives_table,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'halt_runtime_release_atomic'
  ) AS has_halt_rpc;
