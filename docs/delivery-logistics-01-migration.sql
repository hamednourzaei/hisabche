-- ============================================================================
-- HISABCHE — WP-19 · FLEET, DELIVERY, PROOF OF DELIVERY AND COD
-- Run this in the Supabase SQL editor.
--
-- WHAT IT ADDS
--
--   1. `public.delivery_vehicles` — the fleet register: plate, declared daily
--      parcel capacity, and the periodic-service dates that decide whether the
--      van may take a parcel at all.
--
--   2. On `public.courier_deliveries`:
--        vehicle_id           which vehicle took it
--        planned_on           the day the run is planned for (capacity is per day)
--        pod_method           how acceptance was captured: signature | photo | code
--        pod_recipient_name   who took the parcel
--        pod_photo_ref        storage reference of the photo
--        pod_code             the code the customer was given when it left the shop
--        pod_recorded_at      when the proof was captured
--        pod_actor_user_id    who recorded it
--        failure_reason       why the attempt failed (a FAILED attempt has no proof)
--        attempt_count        how many times somebody stood at the door
--        last_attempt_at      when that happened
--        cod_collected_minor  what the driver actually received
--        cod_shortfall_minor  cod - collected: STILL OWED, never forgiven
--        cod_settled_at       when the cash reached the office
--        client_request_id    the device's outbox key, for exactly-once closing
--
--   3. The same proof columns on `public.delivery_notes` (the customer-facing
--      delivery note), so a note's POD is a fact on the document instead of a
--      line in the event log.
--
-- THE MODEL, AND NOTHING BEYOND IT
--
--   A delivery has exactly two ways to end:
--
--     delivered   pod_recorded_at set, a method, a recipient, and `cod_collected_minor`
--                 ≤ `cod_amount_minor`. `cod_shortfall_minor` is what the customer
--                 still owes and is NOT cleared by closing the parcel.
--     failed      `failure_reason` set, NO pod_*, NO delivered_at, and the COD stage
--                 stays where it was: nothing was collected, nothing was received.
--
--   The rules are implemented once in
--   `packages/validation/src/schemas/universal-core/delivery-logistics.domain.ts`
--   (`decideDeliveryAttempt`, `dispatchIssues`) and run on the server and on the
--   device. This file only states the same rules where application code cannot be
--   bypassed.
--
-- ⚠️ READ BEFORE RUNNING
--
--   `courier_deliveries_delivered_has_pod` and `courier_deliveries_failed_has_reason`
--   are added NOT VALID and are deliberately NOT validated: rows closed before this
--   migration carry no proof of delivery, and a backfill would be a guess
--   (CLAUDE.md §12). They protect every row written or updated from now on. Count
--   what history would break with:
--
--     SELECT count(*) FROM courier_deliveries
--     WHERE status = 'delivered' AND pod_recorded_at IS NULL;
--     SELECT count(*) FROM courier_deliveries
--     WHERE status = 'failed' AND failure_reason IS NULL;
--
-- SAFE TO RUN MORE THAN ONCE — every statement is IF NOT EXISTS / idempotent.
-- ADDITIVE — no column is dropped, no row is rewritten, no figure is invented.
--
-- Read the ROLLBACK section at the bottom before running.
-- ============================================================================

BEGIN;

-- ─── 1. The fleet register ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  plate_number text,
  -- The fixed asset this van is booked under, when the shop keeps one. No FK on
  -- purpose: `fixed_assets` lives in another module and a vehicle may be rented.
  asset_id uuid,
  -- Parcels per day. NULL = never declared (unknown), which is NOT «unlimited»:
  -- the dispatcher is told nothing is known and is allowed to proceed.
  capacity_parcels integer,
  active boolean NOT NULL DEFAULT true,
  last_service_on date,
  -- The date the next periodic service is due. NULL = no service has ever been
  -- recorded, which reads as `unknown`, never as `fine`.
  next_service_due_on date,
  odometer_km integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_vehicles_capacity_positive
    CHECK (capacity_parcels IS NULL OR capacity_parcels > 0),
  CONSTRAINT delivery_vehicles_odometer_non_negative
    CHECK (odometer_km IS NULL OR odometer_km >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS delivery_vehicles_plate_idx
  ON public.delivery_vehicles (workspace_id, plate_number)
  WHERE plate_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS delivery_vehicles_workspace_idx
  ON public.delivery_vehicles (workspace_id, active);

-- ─── 2. The delivery columns ───────────────────────────────────────────────
ALTER TABLE public.courier_deliveries
  ADD COLUMN IF NOT EXISTS vehicle_id uuid,
  ADD COLUMN IF NOT EXISTS planned_on date,
  ADD COLUMN IF NOT EXISTS pod_method text,
  ADD COLUMN IF NOT EXISTS pod_recipient_name text,
  ADD COLUMN IF NOT EXISTS pod_photo_ref text,
  ADD COLUMN IF NOT EXISTS pod_code text,
  ADD COLUMN IF NOT EXISTS pod_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS pod_actor_user_id uuid,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS cod_collected_minor bigint,
  ADD COLUMN IF NOT EXISTS cod_shortfall_minor bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cod_settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_request_id text;

-- ─── 3. The delivery rules, where no code can bypass them ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courier_deliveries_pod_method_check'
  ) THEN
    ALTER TABLE public.courier_deliveries
      ADD CONSTRAINT courier_deliveries_pod_method_check
      CHECK (pod_method IS NULL OR pod_method IN ('signature', 'photo', 'code')) NOT VALID;
  END IF;

  -- A proof is a method AND a person. «Signed» by nobody is not a proof.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courier_deliveries_pod_shape'
  ) THEN
    ALTER TABLE public.courier_deliveries
      ADD CONSTRAINT courier_deliveries_pod_shape
      CHECK (
        pod_recorded_at IS NULL
        OR (
          pod_method IS NOT NULL
          AND pod_recipient_name IS NOT NULL
          AND length(btrim(pod_recipient_name)) > 0
        )
      ) NOT VALID;
  END IF;

  -- Nothing is collected twice, and nothing above what was due: an over-collection
  -- is a pricing argument, not a delivery outcome.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courier_deliveries_cod_collected_range'
  ) THEN
    ALTER TABLE public.courier_deliveries
      ADD CONSTRAINT courier_deliveries_cod_collected_range
      CHECK (
        cod_collected_minor IS NULL
        OR (cod_collected_minor >= 0 AND cod_collected_minor <= cod_amount_minor)
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courier_deliveries_shortfall_non_negative'
  ) THEN
    ALTER TABLE public.courier_deliveries
      ADD CONSTRAINT courier_deliveries_shortfall_non_negative
      CHECK (cod_shortfall_minor >= 0) NOT VALID;
  END IF;

  -- The two that guard history: NOT VALID on purpose (see the header).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courier_deliveries_delivered_has_pod'
  ) THEN
    ALTER TABLE public.courier_deliveries
      ADD CONSTRAINT courier_deliveries_delivered_has_pod
      CHECK (status <> 'delivered' OR pod_recorded_at IS NOT NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courier_deliveries_failed_has_reason'
  ) THEN
    ALTER TABLE public.courier_deliveries
      ADD CONSTRAINT courier_deliveries_failed_has_reason
      CHECK (
        status <> 'failed'
        OR (failure_reason IS NOT NULL AND length(btrim(failure_reason)) > 0)
      ) NOT VALID;
  END IF;
END $$;

-- The four that no historical row can break are validated in a second pass.
ALTER TABLE public.courier_deliveries VALIDATE CONSTRAINT courier_deliveries_pod_method_check;
ALTER TABLE public.courier_deliveries VALIDATE CONSTRAINT courier_deliveries_pod_shape;
ALTER TABLE public.courier_deliveries VALIDATE CONSTRAINT courier_deliveries_cod_collected_range;
ALTER TABLE public.courier_deliveries VALIDATE CONSTRAINT courier_deliveries_shortfall_non_negative;

-- Exactly-once closing: the device's outbox retries the same close until the
-- server answers, and the second attempt must return the first row, not a copy.
CREATE UNIQUE INDEX IF NOT EXISTS courier_deliveries_request_idx
  ON public.courier_deliveries (workspace_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- Capacity is counted per vehicle per day.
CREATE INDEX IF NOT EXISTS courier_deliveries_dispatch_idx
  ON public.courier_deliveries (workspace_id, vehicle_id, planned_on);

CREATE INDEX IF NOT EXISTS courier_deliveries_status_idx
  ON public.courier_deliveries (workspace_id, status);

-- ─── 4. Proof on the delivery note ─────────────────────────────────────────
ALTER TABLE public.delivery_notes
  ADD COLUMN IF NOT EXISTS pod_method text,
  ADD COLUMN IF NOT EXISTS pod_recipient_name text,
  ADD COLUMN IF NOT EXISTS pod_photo_ref text,
  ADD COLUMN IF NOT EXISTS pod_code text,
  ADD COLUMN IF NOT EXISTS pod_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS pod_actor_user_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delivery_notes_pod_method_check'
  ) THEN
    ALTER TABLE public.delivery_notes
      ADD CONSTRAINT delivery_notes_pod_method_check
      CHECK (pod_method IS NULL OR pod_method IN ('signature', 'photo', 'code')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delivery_notes_pod_shape'
  ) THEN
    ALTER TABLE public.delivery_notes
      ADD CONSTRAINT delivery_notes_pod_shape
      CHECK (
        pod_recorded_at IS NULL
        OR (
          pod_method IS NOT NULL
          AND pod_recipient_name IS NOT NULL
          AND length(btrim(pod_recipient_name)) > 0
        )
      ) NOT VALID;
  END IF;
END $$;

-- Historical notes carry no POD at all, so both constraints validate cleanly.
ALTER TABLE public.delivery_notes VALIDATE CONSTRAINT delivery_notes_pod_method_check;
ALTER TABLE public.delivery_notes VALIDATE CONSTRAINT delivery_notes_pod_shape;

-- ─── 5. Tenancy: lock the new table against clients (backend-only) ───────────
-- A new Supabase table is born with ALL granted to anon/authenticated/
-- service_role. The fleet register is written only through the backend's
-- `requireWorkspaceContext` routes, so clients get NOTHING — no write policy
-- and no write grant. `service_role` (used by the backend with the tenancy
-- context) keeps its access. See migration-client-lockdown.test.ts.
ALTER TABLE public.delivery_vehicles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_vehicles FROM PUBLIC, anon, authenticated;

-- Drop any pre-existing policy so a re-run cannot leave a member-write policy
-- behind from an older version of this file.
DO $lockdown$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'delivery_vehicles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.delivery_vehicles', r.policyname);
  END LOOP;
END $lockdown$;

COMMENT ON TABLE public.delivery_vehicles IS
  'WP-19 fleet register: plate, declared daily parcel capacity and the periodic service dates that gate dispatch. capacity_parcels NULL = never declared (unknown), next_service_due_on NULL = no service on record (unknown).';

COMMENT ON COLUMN public.courier_deliveries.pod_code IS
  'WP-19: the code the customer was given when the parcel left the shop. A code-method POD must match it; NULL means no code was issued, so the code method cannot be used.';

COMMENT ON COLUMN public.courier_deliveries.cod_shortfall_minor IS
  'WP-19: cod_amount_minor - cod_collected_minor. What the customer still owes after a partial COD collection. Never zeroed by closing the delivery.';

COMMENT ON COLUMN public.courier_deliveries.failure_reason IS
  'WP-19: why the attempt failed. A failed attempt carries no pod_* and no delivery timestamp.';

COMMIT;

-- ============================================================================
-- ROLLBACK
--
-- BEGIN;
-- DROP INDEX IF EXISTS public.courier_deliveries_status_idx;
-- DROP INDEX IF EXISTS public.courier_deliveries_dispatch_idx;
-- DROP INDEX IF EXISTS public.courier_deliveries_request_idx;
-- ALTER TABLE public.courier_deliveries
--   DROP CONSTRAINT IF EXISTS courier_deliveries_failed_has_reason,
--   DROP CONSTRAINT IF EXISTS courier_deliveries_delivered_has_pod,
--   DROP CONSTRAINT IF EXISTS courier_deliveries_shortfall_non_negative,
--   DROP CONSTRAINT IF EXISTS courier_deliveries_cod_collected_range,
--   DROP CONSTRAINT IF EXISTS courier_deliveries_pod_shape,
--   DROP CONSTRAINT IF EXISTS courier_deliveries_pod_method_check;
-- ALTER TABLE public.courier_deliveries
--   DROP COLUMN IF EXISTS client_request_id,
--   DROP COLUMN IF EXISTS cod_settled_at,
--   DROP COLUMN IF EXISTS cod_shortfall_minor,
--   DROP COLUMN IF EXISTS cod_collected_minor,
--   DROP COLUMN IF EXISTS last_attempt_at,
--   DROP COLUMN IF EXISTS attempt_count,
--   DROP COLUMN IF EXISTS failure_reason,
--   DROP COLUMN IF EXISTS pod_actor_user_id,
--   DROP COLUMN IF EXISTS pod_recorded_at,
--   DROP COLUMN IF EXISTS pod_code,
--   DROP COLUMN IF EXISTS pod_photo_ref,
--   DROP COLUMN IF EXISTS pod_recipient_name,
--   DROP COLUMN IF EXISTS pod_method,
--   DROP COLUMN IF EXISTS planned_on,
--   DROP COLUMN IF EXISTS vehicle_id;
-- ALTER TABLE public.delivery_notes
--   DROP CONSTRAINT IF EXISTS delivery_notes_pod_shape,
--   DROP CONSTRAINT IF EXISTS delivery_notes_pod_method_check;
-- ALTER TABLE public.delivery_notes
--   DROP COLUMN IF EXISTS pod_actor_user_id,
--   DROP COLUMN IF EXISTS pod_recorded_at,
--   DROP COLUMN IF EXISTS pod_code,
--   DROP COLUMN IF EXISTS pod_photo_ref,
--   DROP COLUMN IF EXISTS pod_recipient_name,
--   DROP COLUMN IF EXISTS pod_method;
-- DROP TABLE IF EXISTS public.delivery_vehicles CASCADE;
-- COMMIT;
--
-- The rollback loses the delivery outcomes recorded after the migration (which
-- is what rolling back means) but touches no invoice, payment, stock movement or
-- ledger row: a COD shortfall lives on the invoice's unpaid balance, not in a
-- table this migration created.
-- ============================================================================
