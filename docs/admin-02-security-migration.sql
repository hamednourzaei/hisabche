-- ============================================================================
-- ADMIN 02 SECURITY & RBAC MIGRATION — additive, idempotent, re-runnable.
--
-- WHAT THIS ADDS:
--   1. admin_accounts: who is an admin, role enum, active status
--   2. admin_permissions: seeded permissions matrix for 7 fixed roles:
--      SUPER, BILLING, SUPPORT, CONTENT, MARKET, OPS, SECURITY
--   3. admin_security_events: audit trail of security events (failed logins, step-up, etc.)
--   4. audit_logs extension: adds reason, request_id, correlation_id
--   5. audit_logs append-only guard: prevents all UPDATEs; prevents DELETEs unless
--      invoked through the authorized retention cleanup function.
--   6. cleanup_audit_logs_retention function: auditable retention cleanup.
--
-- Security rules:
--   - Tables created with RLS enabled.
--   - REVOKE ALL from PUBLIC, anon, authenticated.
--   - GRANT SELECT, INSERT, UPDATE, DELETE to service_role.
-- ============================================================================

BEGIN;

-- 1. admin_accounts table
CREATE TABLE IF NOT EXISTS public.admin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('SUPER', 'BILLING', 'SUPPORT', 'CONTENT', 'MARKET', 'OPS', 'SECURITY')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. admin_permissions table
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('SUPER', 'BILLING', 'SUPPORT', 'CONTENT', 'MARKET', 'OPS', 'SECURITY')),
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_permissions_role_perm_unique UNIQUE (role, permission)
);

-- 3. admin_security_events table
CREATE TABLE IF NOT EXISTS public.admin_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  admin_email text,
  ip_address text,
  user_agent text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Extend audit_logs table with reason, request_id, correlation_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
    CREATE TABLE public.audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid,
      user_id text,
      action text NOT NULL,
      entity_type text NOT NULL,
      entity_id text,
      old_data jsonb,
      new_data jsonb,
      ip_address text,
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS correlation_id text;

-- 5. Append-only trigger on audit_logs
CREATE OR REPLACE FUNCTION public.audit_logs_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'AUDIT_LOG_IMMUTABLE: audit_logs rows can never be updated'
      USING ERRCODE = '23505';
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF current_setting('app.allow_audit_retention_cleanup', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'AUDIT_LOG_IMMUTABLE: audit_logs rows can only be deleted via retention cleanup'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_immutable_trigger ON public.audit_logs;
CREATE TRIGGER audit_logs_immutable_trigger
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_logs_immutable_guard();

-- 6. Retention cleanup function for audit_logs
CREATE OR REPLACE FUNCTION public.cleanup_audit_logs_retention(
  p_days_to_keep int,
  p_actor_id text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cutoff timestamptz;
  v_deleted int;
BEGIN
  IF p_days_to_keep < 1 THEN
    RAISE EXCEPTION 'days_to_keep must be positive';
  END IF;

  v_cutoff := now() - (p_days_to_keep || ' days')::interval;

  -- Record audit marker row FIRST
  INSERT INTO public.audit_logs (
    action,
    entity_type,
    user_id,
    new_data,
    reason,
    created_at
  ) VALUES (
    'audit.cleanup',
    'audit_logs',
    p_actor_id,
    jsonb_build_object('days_to_keep', p_days_to_keep, 'cutoff', v_cutoff),
    'Scheduled retention cleanup',
    now()
  );

  PERFORM set_config('app.allow_audit_retention_cleanup', 'true', true);

  DELETE FROM public.audit_logs
  WHERE created_at < v_cutoff;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted;
END;
$$;

-- 7. Security permissions & RLS
ALTER TABLE public.admin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.admin_permissions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.admin_security_events FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_permissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_security_events TO service_role;

REVOKE EXECUTE ON FUNCTION public.audit_logs_immutable_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_audit_logs_retention(int, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.audit_logs_immutable_guard() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_audit_logs_retention(int, text) TO service_role;

-- 8. Seed permissions catalogue for the 7 roles
DO $$
DECLARE
  v_roles text[] := ARRAY['SUPER', 'BILLING', 'SUPPORT', 'CONTENT', 'MARKET', 'OPS', 'SECURITY'];
  v_all_perms text[] := ARRAY[
    'billing.plans.read', 'billing.plans.write',
    'billing.prices.read', 'billing.prices.write',
    'billing.subscriptions.read', 'billing.subscriptions.plan', 'billing.subscriptions.status', 'billing.subscriptions.extend', 'billing.subscriptions.override_limits',
    'billing.ledger.read', 'billing.ledger.write',
    'billing.wallet.read', 'billing.wallet.adjust',
    'billing.upgrade_requests.read', 'billing.upgrade_requests.decide',
    'offline.licences.read', 'offline.licences.issue', 'offline.licences.revoke', 'offline.licences.reissue', 'offline.licences.transfer',
    'offline.devices.read', 'offline.devices.release',
    'offline.migration.read', 'offline.migration.run',
    'offline.reconciliation.read',
    'customers.workspaces.read', 'customers.workspaces.suspend',
    'customers.users.read', 'customers.users.suspend', 'customers.users.revoke_sessions', 'customers.users.reset_mfa', 'customers.users.force_signout',
    'customers.support_sessions.read', 'customers.support_sessions.open',
    'customers.data_requests.read', 'customers.data_requests.decide',
    'product.features.read', 'product.features.write',
    'product.flags.read', 'product.flags.write',
    'product.ai.read', 'product.ai.quota',
    'product.oauth.read', 'product.oauth.write',
    'product.market.read', 'product.market.write',
    'operations.health.read', 'operations.servers.read', 'operations.jobs.read', 'operations.jobs.run',
    'content.blog.read', 'content.blog.write',
    'content.cms.read', 'content.cms.write',
    'security.audit.read',
    'security.roles.read', 'security.roles.write',
    'security.sessions.read', 'security.sessions.revoke',
    'security.events.read',
    'admin.announcements.read', 'admin.announcements.write'
  ];
  p text;
BEGIN
  -- SUPER carries everything
  FOREACH p IN ARRAY v_all_perms LOOP
    INSERT INTO public.admin_permissions (role, permission)
    VALUES ('SUPER', p)
    ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;

  -- BILLING
  FOREACH p IN ARRAY ARRAY[
    'billing.plans.read', 'billing.plans.write',
    'billing.prices.read', 'billing.prices.write',
    'billing.subscriptions.read', 'billing.subscriptions.plan', 'billing.subscriptions.status', 'billing.subscriptions.extend', 'billing.subscriptions.override_limits',
    'billing.ledger.read', 'billing.ledger.write',
    'billing.wallet.read', 'billing.wallet.adjust',
    'billing.upgrade_requests.read', 'billing.upgrade_requests.decide',
    'security.audit.read'
  ] LOOP
    INSERT INTO public.admin_permissions (role, permission)
    VALUES ('BILLING', p)
    ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;

  -- SUPPORT
  FOREACH p IN ARRAY ARRAY[
    'customers.workspaces.read',
    'customers.users.read',
    'customers.support_sessions.read', 'customers.support_sessions.open',
    'customers.data_requests.read', 'customers.data_requests.decide',
    'security.audit.read'
  ] LOOP
    INSERT INTO public.admin_permissions (role, permission)
    VALUES ('SUPPORT', p)
    ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;

  -- CONTENT
  FOREACH p IN ARRAY ARRAY[
    'content.blog.read', 'content.blog.write',
    'content.cms.read', 'content.cms.write',
    'security.audit.read'
  ] LOOP
    INSERT INTO public.admin_permissions (role, permission)
    VALUES ('CONTENT', p)
    ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;

  -- MARKET
  FOREACH p IN ARRAY ARRAY[
    'product.market.read', 'product.market.write',
    'product.oauth.read', 'product.oauth.write',
    'security.audit.read'
  ] LOOP
    INSERT INTO public.admin_permissions (role, permission)
    VALUES ('MARKET', p)
    ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;

  -- OPS
  FOREACH p IN ARRAY ARRAY[
    'operations.health.read', 'operations.servers.read', 'operations.jobs.read', 'operations.jobs.run',
    'product.ai.read', 'product.ai.quota',
    'offline.devices.read',
    'security.audit.read'
  ] LOOP
    INSERT INTO public.admin_permissions (role, permission)
    VALUES ('OPS', p)
    ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;

  -- SECURITY
  FOREACH p IN ARRAY ARRAY[
    'security.audit.read',
    'security.roles.read', 'security.roles.write',
    'security.sessions.read', 'security.sessions.revoke',
    'security.events.read',
    'customers.users.revoke_sessions', 'customers.users.reset_mfa'
  ] LOOP
    INSERT INTO public.admin_permissions (role, permission)
    VALUES ('SECURITY', p)
    ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK BLOCK (manual execution only)
-- ============================================================================
-- BEGIN;
-- DROP TRIGGER IF EXISTS audit_logs_immutable_trigger ON public.audit_logs;
-- DROP FUNCTION IF EXISTS public.audit_logs_immutable_guard();
-- DROP FUNCTION IF EXISTS public.cleanup_audit_logs_retention(int, text);
-- DROP TABLE IF EXISTS public.admin_security_events;
-- DROP TABLE IF EXISTS public.admin_permissions;
-- DROP TABLE IF EXISTS public.admin_accounts;
-- ALTER TABLE public.audit_logs DROP COLUMN IF EXISTS reason;
-- ALTER TABLE public.audit_logs DROP COLUMN IF EXISTS request_id;
-- ALTER TABLE public.audit_logs DROP COLUMN IF EXISTS correlation_id;
-- COMMIT;
