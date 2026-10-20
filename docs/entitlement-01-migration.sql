-- ============================================================================
-- ENTITLEMENT CORE — additive, idempotent, re-runnable.
--
-- ⚠️ PREREQUISITE: docs/plan-limits-migration.sql MUST BE RUN BEFORE THIS MIGRATION.
--
-- WHAT THIS ADDS
--   1. plan_limit_settings.plan CHECK constraint widened to include:
--      'FREE', 'OFFLINE', 'ONLINE_500', 'ONLINE_1000', 'ONLINE_1500', 'free', 'pro', 'enterprise'
--   2. subscription_upgrade_requests.requested_plan CHECK constraint widened
--   3. subscription_events.event CHECK constraint widened to accept:
--      'refunded', 'downgraded', 'credit_issued', 'licence_issued', 'licence_revoked', 'device_released'
--   4. offline_licenses table: signed offline licence records
--   5. devices table: activated device records per workspace
--
-- Service role only writes; members can SELECT their workspace's rows.
-- RLS on, REVOKE ALL from PUBLIC/anon/authenticated, explicit grants.
-- ============================================================================

BEGIN;

-- 1. Widen plan_limit_settings plan check
DO $$
DECLARE
  v_con text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'plan_limit_settings') THEN
    FOR v_con IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.plan_limit_settings'::regclass AND contype = 'c'
    LOOP
      EXECUTE format('ALTER TABLE public.plan_limit_settings DROP CONSTRAINT %I', v_con);
    END LOOP;
    ALTER TABLE public.plan_limit_settings
      ADD CONSTRAINT plan_limit_settings_plan_check
      CHECK (plan IN ('FREE', 'OFFLINE', 'ONLINE_500', 'ONLINE_1000', 'ONLINE_1500', 'free', 'pro', 'enterprise'));
  END IF;
END $$;

-- 2. Widen subscription_upgrade_requests requested_plan check
DO $$
DECLARE
  v_con text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscription_upgrade_requests') THEN
    FOR v_con IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.subscription_upgrade_requests'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%requested_plan%'
    LOOP
      EXECUTE format('ALTER TABLE public.subscription_upgrade_requests DROP CONSTRAINT %I', v_con);
    END LOOP;
    ALTER TABLE public.subscription_upgrade_requests
      ADD CONSTRAINT subscription_upgrade_requests_requested_plan_check
      CHECK (requested_plan IN ('FREE', 'OFFLINE', 'ONLINE_500', 'ONLINE_1000', 'ONLINE_1500', 'pro', 'enterprise'));
  END IF;
END $$;

-- 3. Widen subscription_events event check
DO $$
DECLARE
  v_con text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscription_events') THEN
    FOR v_con IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.subscription_events'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%event%'
    LOOP
      EXECUTE format('ALTER TABLE public.subscription_events DROP CONSTRAINT %I', v_con);
    END LOOP;
    ALTER TABLE public.subscription_events
      ADD CONSTRAINT subscription_events_event_check
      CHECK (event IN (
        'upgrade_requested', 'upgrade_approved', 'upgrade_rejected',
        'upgrade_cancelled', 'cancel_scheduled', 'cancelled', 'expired',
        'refunded', 'downgraded', 'credit_issued', 'licence_issued', 'licence_revoked', 'device_released'
      ));
  END IF;
END $$;

-- 4. offline_licenses table
CREATE TABLE IF NOT EXISTS public.offline_licenses (
  license_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  account_id    uuid NOT NULL,
  plan          text NOT NULL,
  issued_at     timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  device_id     uuid,
  features      jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(features) = 'array'),
  version       integer NOT NULL DEFAULT 1,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offline_licenses_workspace_idx ON public.offline_licenses (workspace_id);
CREATE INDEX IF NOT EXISTS offline_licenses_device_idx ON public.offline_licenses (device_id);

-- 5. devices table
CREATE TABLE IF NOT EXISTS public.devices (
  device_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL,
  label             text,
  activated_at      timestamptz NOT NULL DEFAULT now(),
  released_at       timestamptz,
  last_verified_at  timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS devices_workspace_idx ON public.devices (workspace_id);

-- Security: RLS & Permissions
ALTER TABLE public.offline_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.offline_licenses FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.devices FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.offline_licenses TO service_role;
GRANT ALL ON public.devices TO service_role;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'offline_licenses' AND policyname = 'offline_licenses_members_read') THEN
    CREATE POLICY offline_licenses_members_read ON public.offline_licenses
      FOR SELECT TO authenticated
      USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'devices' AND policyname = 'devices_members_read') THEN
    CREATE POLICY devices_members_read ON public.devices
      FOR SELECT TO authenticated
      USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

GRANT SELECT ON public.offline_licenses TO authenticated;
GRANT SELECT ON public.devices TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--   DROP TABLE IF EXISTS public.offline_licenses;
--   DROP TABLE IF EXISTS public.devices;
-- ============================================================================
