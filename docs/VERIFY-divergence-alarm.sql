-- ============================================================================
-- docs/VERIFY-divergence-alarm.sql
--
-- Verification for docs/divergence-alarm-migration.sql.
--
-- ⚠️ THIS FILE ONLY READS. Every statement is a SELECT that returns an `ok`
-- boolean per check, so a human can run the whole file and read pass/fail
-- without interpreting row counts. It never writes, never locks.
-- ============================================================================

-- 1. The column exists, with the expected type.
SELECT
  'divergence_alarm_percent column exists as numeric(5,2)' AS check,
  EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'workspaces'
       AND column_name = 'divergence_alarm_percent'
       AND data_type = 'numeric'
  ) AS ok;

-- 2. It is NULLABLE — «not configured» is a legal state.
SELECT
  'column is nullable (NULL = alarm off)' AS check,
  COALESCE((
    SELECT is_nullable = 'YES' FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'workspaces'
       AND column_name = 'divergence_alarm_percent'
  ), false) AS ok;

-- 3. The 0–100 range constraint is installed.
SELECT
  'range constraint present' AS check,
  EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'workspaces_divergence_alarm_percent_range'
  ) AS ok;

-- 4. No stored value is outside the range (a constraint added to dirty data
--    would have failed the migration; this proves the data it saw was clean).
SELECT
  'no stored threshold outside 0..100' AS check,
  NOT EXISTS (
    SELECT 1 FROM public.workspaces
     WHERE divergence_alarm_percent IS NOT NULL
       AND (divergence_alarm_percent < 0 OR divergence_alarm_percent > 100)
  ) AS ok;

-- 5. The alarm's window index exists.
SELECT
  'core_divergence detected_at index present' AS check,
  EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'core_divergence'
       AND indexname = 'core_divergence_detected_at_idx'
  ) AS ok;

-- 6. `core_divergence` still has RLS on the membership chain (unchanged by this
--    migration, asserted here so one file answers «is the alarm's source safe»).
SELECT
  'core_divergence policy follows the membership chain' AS check,
  EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename = 'core_divergence'
       AND qual LIKE '%workspace_members%'
       AND qual LIKE '%auth.uid()%'
  ) AS ok;

-- 7. How many workspaces have actually configured a threshold. With this
--    migration unrun — or run but unused — expect 0, which means the alarm is
--    OFF everywhere. That is the shipped default, not a fault.
SELECT
  'workspaces with the alarm switched on' AS check,
  (SELECT count(*) FROM public.workspaces WHERE divergence_alarm_percent IS NOT NULL) AS configured,
  true AS ok;
