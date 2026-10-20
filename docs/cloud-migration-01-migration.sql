-- ============================================================================
-- CLOUD MIGRATION CORE (Phase 8: Offline -> Cloud Safe Migration)
--
-- Tables:
--   1. cloud_migration_jobs: The lifecycle and lease of a migration run.
--   2. cloud_migration_map: Mapping between local device IDs and cloud UUIDs.
--   3. cloud_migration_records: Detailed record-by-record execution and failure log.
--
-- Security:
--   - Tenant isolation via workspace_id.
--   - REVOKE ALL from PUBLIC, anon, authenticated first.
--   - Explicit grants to service_role and authenticated.
--   - RLS enabled on all tables.
--   - Rollback block included.
-- ============================================================================

BEGIN;

-- 1. Migration Jobs Table
CREATE TABLE IF NOT EXISTS public.cloud_migration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  device_id text NOT NULL,
  licence_id text NOT NULL,
  status text NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN (
      'REQUESTED',
      'BACKUP_CREATED',
      'PREVIEWED',
      'UPLOADING',
      'RECONCILING',
      'AWAITING_CONFIRMATION',
      'COMPLETED',
      'FAILED',
      'ROLLED_BACK'
    )),
  error_code text,
  lease_expires_at timestamptz,
  chunks_total integer NOT NULL DEFAULT 0,
  chunks_completed integer NOT NULL DEFAULT 0,
  package_checksum text,
  preview_metrics jsonb,
  reconciliation_result jsonb,
  reconciliation_diffs jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cloud_migration_jobs_workspace
  ON public.cloud_migration_jobs (workspace_id, status);

-- Forward-only status enforcement: a completed or rolled-back job cannot be reopened
CREATE OR REPLACE FUNCTION public.fn_cloud_migration_jobs_status_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'COMPLETED' AND NEW.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'MIGRATION_JOB_ALREADY_COMPLETED';
  END IF;
  IF OLD.status = 'ROLLED_BACK' AND NEW.status <> 'ROLLED_BACK' THEN
    RAISE EXCEPTION 'MIGRATION_JOB_ALREADY_ROLLED_BACK';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cloud_migration_jobs_status_guard ON public.cloud_migration_jobs;
CREATE TRIGGER trg_cloud_migration_jobs_status_guard
  BEFORE UPDATE ON public.cloud_migration_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_cloud_migration_jobs_status_guard();

-- 2. Id Mapping Table (Local ID -> Cloud ID)
CREATE TABLE IF NOT EXISTS public.cloud_migration_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.cloud_migration_jobs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  local_id text NOT NULL,
  cloud_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_migration_entity_local UNIQUE (workspace_id, entity_type, local_id)
);

CREATE INDEX IF NOT EXISTS idx_cloud_migration_map_lookup
  ON public.cloud_migration_map (workspace_id, entity_type, local_id);

-- 3. Execution Log Records Table
CREATE TABLE IF NOT EXISTS public.cloud_migration_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.cloud_migration_jobs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  local_id text NOT NULL,
  status text NOT NULL DEFAULT 'COMMITTED'
    CHECK (status IN ('COMMITTED', 'SKIPPED', 'FAILED')),
  error_code text,
  error_detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_migration_record_entry UNIQUE (workspace_id, job_id, entity_type, local_id)
);

CREATE INDEX IF NOT EXISTS idx_cloud_migration_records_job
  ON public.cloud_migration_records (job_id, status);

-- Security: Revoke default public access
REVOKE ALL ON public.cloud_migration_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cloud_migration_map FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cloud_migration_records FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_cloud_migration_jobs_status_guard() FROM PUBLIC, anon, authenticated;

-- Grants
GRANT ALL ON public.cloud_migration_jobs TO service_role;
GRANT ALL ON public.cloud_migration_map TO service_role;
GRANT ALL ON public.cloud_migration_records TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.cloud_migration_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cloud_migration_map TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cloud_migration_records TO authenticated;

-- Enable Row Level Security (RLS)
ALTER TABLE public.cloud_migration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_migration_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_migration_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cloud_migration_jobs' AND policyname = 'cloud_migration_jobs_tenant_policy') THEN
    CREATE POLICY cloud_migration_jobs_tenant_policy ON public.cloud_migration_jobs
      FOR ALL TO authenticated
      USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cloud_migration_map' AND policyname = 'cloud_migration_map_tenant_policy') THEN
    CREATE POLICY cloud_migration_map_tenant_policy ON public.cloud_migration_map
      FOR ALL TO authenticated
      USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cloud_migration_records' AND policyname = 'cloud_migration_records_tenant_policy') THEN
    CREATE POLICY cloud_migration_records_tenant_policy ON public.cloud_migration_records
      FOR ALL TO authenticated
      USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- DROP TRIGGER IF EXISTS trg_cloud_migration_jobs_status_guard ON public.cloud_migration_jobs;
-- DROP FUNCTION IF EXISTS public.fn_cloud_migration_jobs_status_guard();
-- DROP TABLE IF EXISTS public.cloud_migration_records;
-- DROP TABLE IF EXISTS public.cloud_migration_map;
-- DROP TABLE IF EXISTS public.cloud_migration_jobs;
-- ============================================================================
