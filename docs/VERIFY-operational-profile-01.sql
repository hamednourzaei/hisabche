-- ============================================================================
-- docs/VERIFY-operational-profile-01.sql — run AFTER operational-profile-01.
-- Read-only. Each block returns one row with `ok`. Run blocks one at a time
-- (the SQL editor shows only the last result).
-- ============================================================================

-- 1. The three columns exist.
SELECT count(*) = 3 AS ok, array_agg(column_name ORDER BY column_name) AS found
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'workspaces'
   AND column_name IN ('operational_dna', 'operational_dna_version', 'onboarding_progress');

-- 2. The history table exists, with RLS on.
SELECT c.relrowsecurity AS ok
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname = 'workspace_operational_dna_history';

-- 3. The history is append-only (trigger present).
SELECT count(*) = 1 AS ok
  FROM pg_trigger
 WHERE tgname = 'workspace_operational_dna_history_frozen_trg' AND NOT tgisinternal;

-- 4. Only service_role may execute the writer.
SELECT has_function_privilege('service_role',
         'public.workspace_set_operational_dna(uuid, uuid, jsonb, integer)', 'EXECUTE')
   AND NOT has_function_privilege('anon',
         'public.workspace_set_operational_dna(uuid, uuid, jsonb, integer)', 'EXECUTE')
   AND NOT has_function_privilege('authenticated',
         'public.workspace_set_operational_dna(uuid, uuid, jsonb, integer)', 'EXECUTE') AS ok;

-- 5. anon/authenticated cannot read or write the history; service_role cannot UPDATE/DELETE it.
SELECT NOT has_table_privilege('anon', 'public.workspace_operational_dna_history', 'SELECT')
   AND NOT has_table_privilege('authenticated', 'public.workspace_operational_dna_history', 'SELECT')
   AND NOT has_table_privilege('service_role', 'public.workspace_operational_dna_history', 'UPDATE')
   AND NOT has_table_privilege('service_role', 'public.workspace_operational_dna_history', 'DELETE') AS ok;

-- 6. Data: every declared version has its history row (0 rows breaking = ok).
SELECT count(*) = 0 AS ok, count(*) AS workspaces_without_history
  FROM public.workspaces w
 WHERE w.operational_dna_version > 0
   AND NOT EXISTS (
     SELECT 1 FROM public.workspace_operational_dna_history h
      WHERE h.workspace_id = w.id AND h.version = w.operational_dna_version);
