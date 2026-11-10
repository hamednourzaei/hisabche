-- ============================================
-- docs/salon-01-migration.sql
--
-- Barber shop / beauty salon — QA document §8 (10 Nov 2026). One service
-- core; a salon adds departments, resources and materials, a barber needs none.
--
--   service_resources      chairs, rooms, beds — what a session occupies
--   service_catalog        per service: duration, department, the kind of
--                          resource it needs, the warehouse its materials leave,
--                          and the materials one delivery uses (a JSON list on
--                          the same row, so the recipe is saved in one write)
--   service_delivery_sessions + resource_id, department_id
--   service_sessions_resource_guard   two live sessions never hold the same
--                          resource at overlapping times (trigger, locked per
--                          resource) — SERVICE_RESOURCE_BUSY
--
-- Materials leave through the EXISTING delivery path
-- (ServiceDeliveryService#consumeMaterials: cost issue keyed per session and
-- product, stock movement, one ledger entry). This file only stores each
-- service's recipe, which delivery uses when the screen lists no materials.
--
-- Departments are the existing HR `departments` (hair, nails, skin): no
-- second list. Commission rates are provider_commission_rates
-- (provider-commission-01); this file does not touch them.
--
-- Additive and re-runnable. Depends on: service-delivery-01, departments,
-- branches, warehouses, products.
-- ⚠️ NOT run by the assistant. Run it, then docs/VERIFY-salon-01.sql.
--
-- ROLLBACK (only while empty):
--   DROP TRIGGER IF EXISTS service_sessions_resource_guard_trg ON public.service_delivery_sessions;
--   ALTER TABLE public.service_delivery_sessions DROP COLUMN IF EXISTS resource_id,
--                                                DROP COLUMN IF EXISTS department_id;
--   DROP TABLE IF EXISTS public.service_catalog, public.service_resources;
-- ============================================

CREATE TABLE IF NOT EXISTS public.service_resources (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  name           text NOT NULL,
  kind           text NOT NULL,
  branch_id      uuid REFERENCES public.branches (id) ON DELETE SET NULL,
  department_id  uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_resources_kind CHECK (kind IN ('chair', 'room', 'bed', 'station', 'equipment')),
  CONSTRAINT service_resources_name CHECK (length(btrim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS service_resources_ws_idx ON public.service_resources (workspace_id, is_active);

CREATE TABLE IF NOT EXISTS public.service_catalog (
  workspace_id      uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  product_id        uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  duration_minutes  integer NOT NULL,
  department_id     uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  resource_kind     text,
  warehouse_id      uuid REFERENCES public.warehouses (id) ON DELETE SET NULL,
  -- [{ "productId": uuid, "quantity": number > 0 }, …] — checked by the
  -- backend against this workspace's products before it is written.
  consumables       jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid,
  PRIMARY KEY (workspace_id, product_id),
  CONSTRAINT service_catalog_duration CHECK (duration_minutes BETWEEN 5 AND 1440),
  CONSTRAINT service_catalog_consumables_list CHECK (
    jsonb_typeof(consumables) = 'array' AND jsonb_array_length(consumables) <= 30
  ),
  CONSTRAINT service_catalog_kind CHECK (
    resource_kind IS NULL OR resource_kind IN ('chair', 'room', 'bed', 'station', 'equipment')
  )
);

ALTER TABLE public.service_delivery_sessions
  ADD COLUMN IF NOT EXISTS resource_id uuid REFERENCES public.service_resources (id) ON DELETE SET NULL;
ALTER TABLE public.service_delivery_sessions
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS service_sessions_resource_idx
  ON public.service_delivery_sessions (workspace_id, resource_id, session_date)
  WHERE resource_id IS NOT NULL;

-- ─── One resource, one session at a time ───────────────────────────────────
-- A trigger (not an EXCLUDE constraint): the times are stored as text
-- «HH:MM», and the lock per resource makes two bookings in the same instant
-- see each other. Cancelled, no-show and deleted sessions free the resource.
CREATE OR REPLACE FUNCTION public.service_sessions_resource_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_clash uuid;
BEGIN
  IF NEW.resource_id IS NULL
     OR NEW.status IN ('cancelled', 'no_show')
     OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('resource:' || NEW.resource_id::text, 0));
  SELECT s.id INTO v_clash
    FROM public.service_delivery_sessions s
   WHERE s.workspace_id = NEW.workspace_id
     AND s.resource_id = NEW.resource_id
     AND s.session_date = NEW.session_date
     AND s.id <> NEW.id
     AND s.status NOT IN ('cancelled', 'no_show')
     AND s.deleted_at IS NULL
     AND left(s.start_time, 5)::time < left(NEW.end_time, 5)::time
     AND left(NEW.start_time, 5)::time < left(s.end_time, 5)::time
   LIMIT 1;
  IF v_clash IS NOT NULL THEN
    RAISE EXCEPTION 'SERVICE_RESOURCE_BUSY' USING ERRCODE = 'P0001', DETAIL = v_clash::text;
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS service_sessions_resource_guard_trg ON public.service_delivery_sessions;
CREATE TRIGGER service_sessions_resource_guard_trg
  BEFORE INSERT OR UPDATE OF resource_id, session_date, start_time, end_time, status, deleted_at
  ON public.service_delivery_sessions
  FOR EACH ROW EXECUTE FUNCTION public.service_sessions_resource_guard();

-- ─── Privileges and RLS ────────────────────────────────────────────────────
ALTER TABLE public.service_resources            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog              ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.service_resources, public.service_catalog
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.service_resources, public.service_catalog TO service_role;
REVOKE ALL ON FUNCTION public.service_sessions_resource_guard() FROM PUBLIC, anon, authenticated, service_role;
