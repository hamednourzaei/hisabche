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
  step_up_capabilities text[] NOT NULL DEFAULT ARRAY['ledger.lock_period', 'payroll.post', 'member.manage', 'account.manage']::text[],
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
GRANT SELECT, INSERT, UPDATE ON public.workspace_2fa_policies TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.workspace_2fa_enrollments TO service_role;

ALTER TABLE public.workspace_2fa_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_2fa_enrollments ENABLE ROW LEVEL SECURITY;


-- Rollback (manual reference):
-- DROP TABLE IF EXISTS public.workspace_2fa_enrollments;
-- DROP TABLE IF EXISTS public.workspace_2fa_policies;


-- ---------------------------------------------------------------------------
-- V61 audit (12 Nov 2026): the first default named three capabilities that do
-- not exist (payroll.manage, role.manage, bank.manage), so it protected only
-- ledger.lock_period. Idempotent correction for a database where that version
-- already ran: the column default, and stored lists mapped to the real names.
-- `totp_secret_ref` now holds the Supabase Auth factor ID — never a secret.
-- ---------------------------------------------------------------------------
ALTER TABLE public.workspace_2fa_policies
  ALTER COLUMN step_up_capabilities
  SET DEFAULT ARRAY['ledger.lock_period', 'payroll.post', 'member.manage', 'account.manage']::text[];

UPDATE public.workspace_2fa_policies
   SET step_up_capabilities = ARRAY(
         SELECT DISTINCT CASE c
                  WHEN 'payroll.manage' THEN 'payroll.post'
                  WHEN 'role.manage'    THEN 'member.manage'
                  WHEN 'bank.manage'    THEN 'account.manage'
                  ELSE c
                END
           FROM unnest(step_up_capabilities) AS c
       ),
       updated_at = now()
 WHERE step_up_capabilities && ARRAY['payroll.manage', 'role.manage', 'bank.manage']::text[];

COMMENT ON COLUMN public.workspace_2fa_enrollments.totp_secret_ref IS
  'The Supabase Auth TOTP factor id. The authenticator secret lives in Supabase Auth only.';

-- ---------------------------------------------------------------------------
-- CLIENT LOCKDOWN (V61 audit, 12 Nov 2026).
--
-- These tables are reached ONLY through the backend (service_role), which
-- checks the capability of the person asking. A policy "FOR ALL TO
-- authenticated USING (workspace member)" let ANY member of the workspace —
-- a seller included — write these rows straight through the Supabase API and
-- skip every capability check (e.g. approve their own request, overwrite
-- another member's 2FA enrollment). RLS stays ON with NO policy; clients get
-- nothing. Idempotent: on a database where the earlier version of this file
-- already ran, it drops whatever policies exist on these tables.
-- ---------------------------------------------------------------------------
DO $lockdown$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = ANY (ARRAY['workspace_2fa_policies', 'workspace_2fa_enrollments'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $lockdown$;
ALTER TABLE public.workspace_2fa_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_2fa_policies FROM PUBLIC, anon, authenticated;
ALTER TABLE public.workspace_2fa_enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_2fa_enrollments FROM PUBLIC, anon, authenticated;
