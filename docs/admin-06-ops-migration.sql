-- ==============================================================================
-- docs/admin-06-ops-migration.sql
--
-- Agent A — Step A6: Product, Operations & Analytics Infrastructure
-- 1. feature_flags (global, rollout %, platform, country, beta)
-- 2. admin_announcements (targeted by plan, edition, platform, maintenance mode)
-- 3. background_jobs (import/export/migration job monitoring & retry)
--
-- Security:
-- - REVOKE ALL FROM PUBLIC, anon, authenticated
-- - GRANT ALL TO service_role
-- - RLS enabled
-- - Additive, idempotent
-- ==============================================================================

-- 1. feature_flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    rollout_percentage INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
    platforms TEXT[] NOT NULL DEFAULT '{}',
    countries TEXT[] NOT NULL DEFAULT '{}',
    is_beta BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON public.feature_flags(key);

-- 2. admin_announcements
CREATE TABLE IF NOT EXISTS public.admin_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'INFO' CHECK (level IN ('INFO', 'WARNING', 'CRITICAL', 'MAINTENANCE')),
    target_plans TEXT[] NOT NULL DEFAULT '{}',
    target_editions TEXT[] NOT NULL DEFAULT '{}',
    target_platforms TEXT[] NOT NULL DEFAULT '{}',
    target_locales TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_announcements_active 
    ON public.admin_announcements(is_active, starts_at, ends_at);

-- 3. background_jobs
CREATE TABLE IF NOT EXISTS public.background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL CHECK (job_type IN ('IMPORT', 'EXPORT', 'MIGRATION', 'CLEANUP', 'DUNNING')),
    status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    workspace_id UUID,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_status 
    ON public.background_jobs(status, created_at DESC);

-- Security: Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON public.feature_flags FROM anon;
        REVOKE ALL ON public.admin_announcements FROM anon;
        REVOKE ALL ON public.background_jobs FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON public.feature_flags FROM authenticated;
        REVOKE ALL ON public.admin_announcements FROM authenticated;
        REVOKE ALL ON public.background_jobs FROM authenticated;
    END IF;
    REVOKE ALL ON public.feature_flags FROM PUBLIC;
    REVOKE ALL ON public.admin_announcements FROM PUBLIC;
    REVOKE ALL ON public.background_jobs FROM PUBLIC;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT ALL ON public.feature_flags TO service_role;
        GRANT ALL ON public.admin_announcements TO service_role;
        GRANT ALL ON public.background_jobs TO service_role;
    END IF;
END $$;
