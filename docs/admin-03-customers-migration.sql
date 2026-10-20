-- ==============================================================================
-- docs/admin-03-customers-migration.sql
--
-- Agent A — Step A3: Customers & Support Infrastructure
-- 1. support_sessions (short-lived read-only access for support impersonation)
-- 2. admin_notes (internal admin notes per workspace with tags)
-- 3. admin_data_requests (GDPR/compliance data export, delete, anonymise, legal hold)
-- 4. trial_abuse_signals (detection signals for multi-account abuse)
--
-- Security:
-- - REVOKE ALL FROM PUBLIC, anon, authenticated
-- - GRANT ALL TO service_role
-- - RLS enabled
-- - Additive, idempotent
-- ==============================================================================

-- 1. support_sessions
CREATE TABLE IF NOT EXISTS public.support_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    admin_id UUID NOT NULL,
    admin_email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_sessions_workspace 
    ON public.support_sessions(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_sessions_token 
    ON public.support_sessions(token) WHERE is_revoked IS FALSE;

-- 2. admin_notes
CREATE TABLE IF NOT EXISTS public.admin_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    admin_id UUID NOT NULL,
    admin_email TEXT NOT NULL,
    note TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notes_workspace 
    ON public.admin_notes(workspace_id, created_at DESC);

-- 3. admin_data_requests
CREATE TABLE IF NOT EXISTS public.admin_data_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    request_type TEXT NOT NULL CHECK (request_type IN ('EXPORT', 'DELETE', 'ANONYMISE')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED')),
    sla_due_at TIMESTAMPTZ NOT NULL,
    legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_data_requests_workspace 
    ON public.admin_data_requests(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_data_requests_sla 
    ON public.admin_data_requests(sla_due_at) WHERE status IN ('PENDING', 'PROCESSING');

-- 4. trial_abuse_signals
CREATE TABLE IF NOT EXISTS public.trial_abuse_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_type TEXT NOT NULL CHECK (signal_type IN ('SAME_PHONE', 'SAME_DEVICE', 'SAME_IP_RANGE', 'SAME_CARD_HASH')),
    fingerprint TEXT NOT NULL,
    workspace_count INTEGER NOT NULL DEFAULT 1,
    workspace_ids UUID[] NOT NULL DEFAULT '{}',
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_trial_abuse_signals_lookup 
    ON public.trial_abuse_signals(signal_type, fingerprint);

-- Security: Enable RLS and lock down permissions
ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_abuse_signals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON public.support_sessions FROM anon;
        REVOKE ALL ON public.admin_notes FROM anon;
        REVOKE ALL ON public.admin_data_requests FROM anon;
        REVOKE ALL ON public.trial_abuse_signals FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON public.support_sessions FROM authenticated;
        REVOKE ALL ON public.admin_notes FROM authenticated;
        REVOKE ALL ON public.admin_data_requests FROM authenticated;
        REVOKE ALL ON public.trial_abuse_signals FROM authenticated;
    END IF;
    REVOKE ALL ON public.support_sessions FROM PUBLIC;
    REVOKE ALL ON public.admin_notes FROM PUBLIC;
    REVOKE ALL ON public.admin_data_requests FROM PUBLIC;
    REVOKE ALL ON public.trial_abuse_signals FROM PUBLIC;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT ALL ON public.support_sessions TO service_role;
        GRANT ALL ON public.admin_notes TO service_role;
        GRANT ALL ON public.admin_data_requests TO service_role;
        GRANT ALL ON public.trial_abuse_signals TO service_role;
    END IF;
END $$;
