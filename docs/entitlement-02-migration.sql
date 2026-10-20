-- ============================================================================
-- docs/entitlement-02-migration.sql
-- E3 Licence Policy Migration: Seats (Computer + Mobile), Ban Status,
-- Append-Only Licence Log, and Tier-2 Review Queue.
--
-- Prerequisite: docs/entitlement-01-migration.sql
-- Idempotent and additive. Safe to run repeatedly.
-- ============================================================================

-- 1. Add status and seat fields to offline_licenses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offline_licenses' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.offline_licenses
      ADD COLUMN status text NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'revoked', 'banned'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offline_licenses' AND column_name = 'banned_at'
  ) THEN
    ALTER TABLE public.offline_licenses ADD COLUMN banned_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offline_licenses' AND column_name = 'ban_reason'
  ) THEN
    ALTER TABLE public.offline_licenses ADD COLUMN ban_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offline_licenses' AND column_name = 'transfer_count'
  ) THEN
    ALTER TABLE public.offline_licenses ADD COLUMN transfer_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offline_licenses' AND column_name = 'transfer_year'
  ) THEN
    ALTER TABLE public.offline_licenses ADD COLUMN transfer_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now());
  END IF;
END $$;

-- 2. Add seat, stable_id, public_key, and active fields to devices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'license_id'
  ) THEN
    ALTER TABLE public.devices ADD COLUMN license_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'seat'
  ) THEN
    ALTER TABLE public.devices
      ADD COLUMN seat text
      CHECK (seat IN ('computer', 'mobile'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'stable_id'
  ) THEN
    ALTER TABLE public.devices ADD COLUMN stable_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'public_key'
  ) THEN
    ALTER TABLE public.devices ADD COLUMN public_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE public.devices ADD COLUMN ip_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.devices ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS devices_license_seat_idx
  ON public.devices (license_id, seat, is_active);

-- 3. Create public.license_logs table (Append-Only)
CREATE TABLE IF NOT EXISTS public.license_logs (
  log_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id    uuid NOT NULL,
  workspace_id  uuid NOT NULL,
  event         text NOT NULL CHECK (event IN (
    'activation', 'rejected_activation', 'reinstall',
    'transfer', 'connection', 'ban', 'unban', 'tier2_flagged'
  )),
  device_seat   text CHECK (device_seat IN ('computer', 'mobile')),
  device_id     uuid,
  stable_id     text,
  ip_address    text,
  reason        text,
  evidence      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS license_logs_license_idx ON public.license_logs (license_id);
CREATE INDEX IF NOT EXISTS license_logs_workspace_idx ON public.license_logs (workspace_id);
CREATE INDEX IF NOT EXISTS license_logs_event_idx ON public.license_logs (event);

-- Append-only trigger on license_logs: refuse updates and deletes
CREATE OR REPLACE FUNCTION public.prevent_license_logs_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'license_logs is append-only: updates and deletes are forbidden';
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'license_logs_append_only'
  ) THEN
    CREATE TRIGGER license_logs_append_only
      BEFORE UPDATE OR DELETE ON public.license_logs
      FOR EACH ROW EXECUTE FUNCTION public.prevent_license_logs_mutation();
  END IF;
END $$;

-- 4. Create public.license_review_queue table (Tier-2 Heuristic Review Queue)
CREATE TABLE IF NOT EXISTS public.license_review_queue (
  queue_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id    uuid NOT NULL,
  workspace_id  uuid NOT NULL,
  signal_type   text NOT NULL,
  details       jsonb,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   uuid
);

CREATE INDEX IF NOT EXISTS license_review_queue_status_idx ON public.license_review_queue (status);
CREATE INDEX IF NOT EXISTS license_review_queue_workspace_idx ON public.license_review_queue (workspace_id);

-- 5. Security & RLS Policies
ALTER TABLE public.license_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_review_queue ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.license_logs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.license_review_queue FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.license_logs TO service_role;
GRANT ALL ON public.license_review_queue TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'license_logs' AND policyname = 'license_logs_members_read'
  ) THEN
    CREATE POLICY license_logs_members_read ON public.license_logs
      FOR SELECT TO authenticated
      USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'license_review_queue' AND policyname = 'license_review_queue_members_read'
  ) THEN
    CREATE POLICY license_review_queue_members_read ON public.license_review_queue
      FOR SELECT TO authenticated
      USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 6. Add subscription_events event types if needed
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
        'refunded', 'downgraded', 'credit_issued', 'licence_issued',
        'licence_revoked', 'device_released', 'licence_banned', 'licence_unbanned'
      ));
  END IF;
END $$;

-- ============================================================================
-- Rollback block (run manually if needed)
-- ============================================================================
-- DROP TRIGGER IF EXISTS license_logs_append_only ON public.license_logs;
-- DROP FUNCTION IF EXISTS public.prevent_license_logs_mutation();
-- DROP TABLE IF EXISTS public.license_review_queue;
-- DROP TABLE IF EXISTS public.license_logs;
-- ALTER TABLE public.devices DROP COLUMN IF EXISTS seat;
-- ALTER TABLE public.devices DROP COLUMN IF EXISTS stable_id;
-- ALTER TABLE public.devices DROP COLUMN IF EXISTS public_key;
-- ALTER TABLE public.devices DROP COLUMN IF EXISTS ip_address;
-- ALTER TABLE public.devices DROP COLUMN IF EXISTS is_active;
-- ALTER TABLE public.devices DROP COLUMN IF EXISTS license_id;
-- ALTER TABLE public.offline_licenses DROP COLUMN IF EXISTS status;
-- ALTER TABLE public.offline_licenses DROP COLUMN IF EXISTS banned_at;
-- ALTER TABLE public.offline_licenses DROP COLUMN IF EXISTS ban_reason;
-- ALTER TABLE public.offline_licenses DROP COLUMN IF EXISTS transfer_count;
-- ALTER TABLE public.offline_licenses DROP COLUMN IF EXISTS transfer_year;
