-- ============================================================================
-- docs/resource-capacity-01-migration.sql
--
-- V60 Slice 7 — Unified Resource & Capacity Engine
-- Generalizes `service_resources` to table/room/vehicle/machine/equipment/court
-- and introduces ONE atomic interval booking table (`resource_bookings`) backed
-- by `btree_gist` exclusion constraints (`during tstzrange WITH &&`) so no two
-- concurrent active bookings (or maintenance holds) can ever double-book a resource.
--
-- Re-runnable, additive, non-destructive (historical sessions without a booking stay intact).
-- ⚠️ NOT run by the assistant. Status: PENDING HUMAN CONFIRMATION.
-- After running, run `docs/VERIFY-resource-capacity-01.sql`.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ─── 1. Generalize resource kinds & exclusiveness on service_resources ────────
ALTER TABLE public.service_resources
  ADD COLUMN IF NOT EXISTS exclusive boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_resources_kind') THEN
    ALTER TABLE public.service_resources DROP CONSTRAINT service_resources_kind;
  END IF;
  ALTER TABLE public.service_resources
    ADD CONSTRAINT service_resources_kind CHECK (
      kind IN ('chair', 'room', 'bed', 'station', 'equipment', 'table', 'vehicle', 'machine', 'court')
    );

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_catalog_kind') THEN
    ALTER TABLE public.service_catalog DROP CONSTRAINT service_catalog_kind;
  END IF;
  ALTER TABLE public.service_catalog
    ADD CONSTRAINT service_catalog_kind CHECK (
      resource_kind IS NULL OR resource_kind IN (
        'chair', 'room', 'bed', 'station', 'equipment', 'table', 'vehicle', 'machine', 'court'
      )
    );
END $$;

-- ─── 2. Unified interval booking table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resource_bookings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  resource_id  uuid NOT NULL REFERENCES public.service_resources (id) ON DELETE CASCADE,
  during       tstzrange NOT NULL,
  source_type  text NOT NULL CHECK (source_type IN ('session', 'appointment', 'rental', 'table', 'maintenance')),
  source_id    uuid,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'cancelled')),
  notes        text,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  released_at  timestamptz,
  CONSTRAINT resource_bookings_valid_range CHECK (NOT isempty(during) AND lower(during) < upper(during))
);

CREATE INDEX IF NOT EXISTS resource_bookings_ws_res_idx
  ON public.resource_bookings (workspace_id, resource_id, status);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resource_bookings_no_overlap') THEN
    ALTER TABLE public.resource_bookings
      ADD CONSTRAINT resource_bookings_no_overlap
      EXCLUDE USING gist (
        workspace_id WITH =,
        resource_id WITH =,
        during WITH &&
      )
      WHERE (status = 'active');
  END IF;
END $$;

-- ─── 3. Cross-tenant & active-resource integrity guard trigger ───────────────
CREATE OR REPLACE FUNCTION public.resource_bookings_guard_fn()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_ws uuid;
  v_active boolean;
BEGIN
  SELECT workspace_id, is_active INTO v_ws, v_active
    FROM public.service_resources
   WHERE id = NEW.resource_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_ws <> NEW.workspace_id THEN
    RAISE EXCEPTION 'TENANT_RESOURCE_MISMATCH' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.status = 'active' AND NOT COALESCE(v_active, false) THEN
    RAISE EXCEPTION 'RESOURCE_INACTIVE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $fn$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'resource_bookings_guard_trg') THEN
    CREATE TRIGGER resource_bookings_guard_trg
      BEFORE INSERT OR UPDATE ON public.resource_bookings
      FOR EACH ROW
      EXECUTE FUNCTION public.resource_bookings_guard_fn();
  END IF;
END $$;

-- ─── 4. RLS & Least-Privilege Grants (Supabase mandatory pattern) ────────────
ALTER TABLE resource_bookings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.resource_bookings FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.resource_bookings TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.resource_bookings TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'resource_bookings' AND policyname = 'resource_bookings_workspace_member'
  ) THEN
    CREATE POLICY resource_bookings_workspace_member ON resource_bookings
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = resource_bookings.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.has_access = true
            AND wm.suspended_at IS NULL
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = resource_bookings.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.has_access = true
            AND wm.suspended_at IS NULL
        )
      );
  END IF;
END $$;

-- ─── ROLLBACK BLOCK ──────────────────────────────────────────────────────────
-- DROP TRIGGER IF EXISTS resource_bookings_guard_trg ON public.resource_bookings;
-- DROP FUNCTION IF EXISTS public.resource_bookings_guard_fn();
-- DROP TABLE IF EXISTS public.resource_bookings;
-- ALTER TABLE public.service_resources DROP COLUMN IF EXISTS exclusive;
