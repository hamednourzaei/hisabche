-- ============================================================================
-- docs/workspace-2fa-01-migration.sql
--
-- V61 B.2.25 — Workspace-level 2FA (TOTP enrollment, hashed single-use recovery
--              codes, lockout counter, workspace policy)
--
-- Additive, idempotent. Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_2fa_policies (
  workspace_id uuid PRIMARY KEY NOT NULL,
  require_owner boolean NOT NULL DEFAULT true,
  step_up_capabilities text[] NOT NULL DEFAULT ARRAY['ledger.lock_period', 'payroll.manage', 'role.manage', 'bank.manage']::text[],
  max_failed_attempts integer NOT NULL DEFAULT 5 CHECK (max_failed_attempts >= 3),
  lockout_minutes integer NOT NULL DEFAULT 15 CHECK (lockout_minutes >= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_2fa_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  totp_secret_ref text NOT NULL,
  recovery_code_hashes text[] NOT NULL DEFAULT ARRAY[]::text[],
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

REVOKE ALL ON public.workspace_2fa_policies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.workspace_2fa_enrollments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workspace_2fa_policies TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.workspace_2fa_enrollments TO authenticated, service_role;

ALTER TABLE public.workspace_2fa_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_2fa_enrollments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workspace_2fa_policies', 'workspace_2fa_enrollments']
  LOOP
    pol := t || '_ws_isolation';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = pol
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())) WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))',
        pol, t
      );
    END IF;
  END LOOP;
END $$;

-- Rollback (manual reference):
-- DROP TABLE IF EXISTS public.workspace_2fa_enrollments;
-- DROP TABLE IF EXISTS public.workspace_2fa_policies;
