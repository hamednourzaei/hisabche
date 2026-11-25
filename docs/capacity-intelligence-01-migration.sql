-- ============================================================================
-- docs/capacity-intelligence-01-migration.sql
--
-- V76 Phase 12 — Capacity Benchmark History & Isolation Telemetry Storage.
-- Stores ONLY aggregated synthetic benchmark metadata (never customer data).
-- Additive and idempotent. Never run against Production automatically.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.capacity_benchmark_runs (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id               text NOT NULL,
  environment            text NOT NULL CHECK (environment IN ('isolated_local', 'isolated_staging')),
  target_host            text NOT NULL,
  workload_profile       text NOT NULL,
  dataset_seed           integer NOT NULL DEFAULT 42,
  dataset_size           integer NOT NULL DEFAULT 0,
  git_revision           text NOT NULL,
  status                 text NOT NULL CHECK (status IN ('COMPLETED', 'ABORTED', 'SAFETY_STOPPED', 'BLOCKED')),
  safety_stop_reason     text,
  max_stable_concurrency integer NOT NULL DEFAULT 0,
  peak_rps               numeric(12, 2) NOT NULL DEFAULT 0,
  p95_ms                 numeric(12, 2) NOT NULL DEFAULT 0,
  p99_ms                 numeric(12, 2) NOT NULL DEFAULT 0,
  error_rate             numeric(8, 4) NOT NULL DEFAULT 0,
  limiting_resource      text NOT NULL DEFAULT 'unknown',
  isolation_report       jsonb,
  financial_check        jsonb,
  started_at             timestamptz NOT NULL DEFAULT now(),
  finished_at            timestamptz NOT NULL DEFAULT now(),
  duration_ms            integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_capacity_benchmark_runs_suite_finished
  ON public.capacity_benchmark_runs (suite_id, finished_at DESC);

CREATE INDEX IF NOT EXISTS idx_capacity_benchmark_runs_profile_finished
  ON public.capacity_benchmark_runs (workload_profile, finished_at DESC);

ALTER TABLE public.capacity_benchmark_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.capacity_benchmark_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.capacity_benchmark_runs TO service_role;

COMMIT;

-- ============================================================================
-- Rollback:
--   DROP TABLE IF EXISTS public.capacity_benchmark_runs;
-- ============================================================================
