-- ============================================================================
-- docs/divergence-alarm-migration.sql
--
-- Stores each workspace's divergence-alarm threshold.
--
-- ⚠️ WHY THIS IS A COLUMN AND NOT A NEW TABLE.
--
-- The threshold is a per-tenancy SETTING with exactly one value, read in exactly
-- one place (the alarm worker). A `divergence_settings` table would be a second
-- home for workspace configuration, needing its own RLS policy, its own
-- read path and its own row-per-workspace backfill — for one nullable number.
--
-- ⚠️ NULL MEANS «NOT CONFIGURED», AND THE SHIPPED DEFAULT IS OFF.
--
-- The worker checks the column on every pass. When this migration has not run,
-- PostgREST answers 42703/PGRST204 and the worker falls back to
-- `DEFAULT_DIVERGENCE_THRESHOLD` (percent: null = alarm off). That is deliberate:
-- «off» is an absence, never a zero threshold that would fire on everything.
--
-- SAFE TO RE-RUN. Every statement is guarded.
-- RUN ORDER: this file, then docs/VERIFY-divergence-alarm.sql, then
--            docs/VERIFY-core-divergence.sql (still valid, unchanged).
--
-- A human runs these in the SQL Editor. Reported as:
--   Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================================================

BEGIN;

-- ── the threshold ──────────────────────────────────────────────────────────
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS divergence_alarm_percent numeric(5, 2);

-- ⚠️ A THRESHOLD OUTSIDE 0–100 IS NOT A THRESHOLD. `0` is legal («any
-- divergence at all»); `NULL` is legal («off»). Everything else is a data error,
-- not a value to clamp silently.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_divergence_alarm_percent_range'
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_divergence_alarm_percent_range
      CHECK (
        divergence_alarm_percent IS NULL
        OR (divergence_alarm_percent >= 0 AND divergence_alarm_percent <= 100)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.workspaces.divergence_alarm_percent IS
  'Divergence alarm threshold in percent of comparisons. NULL = alarm off (the shipped default). 0 = fire on any divergence.';

-- ── index for the alarm's window read ──────────────────────────────────────
-- The worker reads `core_divergence` for one hour window and groups by
-- capability. `core_divergence_capability_idx (capability, detected_at DESC)`
-- already serves that; this one serves the reverse order (rows first) used by
-- the workspace fan-out.
CREATE INDEX IF NOT EXISTS core_divergence_detected_at_idx
  ON public.core_divergence (detected_at DESC);

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION
-- ============================================================================
-- Dropping the column returns every workspace to the shipped default, which is
-- «alarm off». Nothing is lost that a person authored: NULL and «not
-- configured» are the same state.
--
-- BEGIN;
--   DROP INDEX IF EXISTS public.core_divergence_detected_at_idx;
--   ALTER TABLE public.workspaces
--     DROP CONSTRAINT IF EXISTS workspaces_divergence_alarm_percent_range;
--   ALTER TABLE public.workspaces
--     DROP COLUMN IF EXISTS divergence_alarm_percent;
-- COMMIT;
--
-- ⚠️ This migration adds NO table, so it needs no new RLS policy: the column
-- lives on `workspaces`, which is already governed by the membership chain. A
-- new policy here would be a second rule over the same rows.
