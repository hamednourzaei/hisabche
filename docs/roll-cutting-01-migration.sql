-- ============================================================================
-- docs/roll-cutting-01-migration.sql
--
-- WP-04 — roll identity, cutting, waste, return and roll-centric cost.
--
-- SAFE TO RE-RUN. Additive and idempotent (CREATE IF NOT EXISTS / OR REPLACE).
--
-- THE RACE THIS CLOSES (two devices, zero double sale):
-- `supabase-js` has no transaction, so read-then-update in Node is a check a
-- second device can win. `roll_apply_movement` locks the roll row FOR UPDATE,
-- checks the remaining length and writes the movement in ONE Postgres
-- transaction. A concurrent cut that would oversell raises instead of
-- deducting twice. The caller's idempotency key is stamped in the same
-- transaction, so a retry returns the first movement, never a second.
--
-- Nothing here is guessed: a cost that was not recorded stays unknown in the
-- report; no length is invented by a return beyond what was consumed.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.rolls (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             uuid NOT NULL,
  roll_number              text NOT NULL,
  initial_length           numeric NOT NULL CHECK (initial_length > 0),
  remaining_length         numeric NOT NULL CHECK (remaining_length >= 0 AND remaining_length <= initial_length),
  unit                     text NOT NULL DEFAULT 'm',
  location                 text,
  cost_minor               bigint NOT NULL DEFAULT 0 CHECK (cost_minor >= 0),
  custom_conversion_factor numeric,
  client_request_id        text,
  created_by               uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rolls_request
  ON public.rolls (workspace_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rolls_workspace
  ON public.rolls (workspace_id, roll_number);

CREATE TABLE IF NOT EXISTS public.roll_movements (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL,
  roll_id            uuid NOT NULL REFERENCES public.rolls(id),
  kind               text NOT NULL CHECK (kind IN ('consume', 'cut', 'return')),
  length             numeric NOT NULL CHECK (length > 0),
  waste_length       numeric NOT NULL DEFAULT 0 CHECK (waste_length >= 0),
  client_request_id  text NOT NULL,
  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_roll_movements_request
  ON public.roll_movements (workspace_id, client_request_id);

CREATE INDEX IF NOT EXISTS idx_roll_movements_roll
  ON public.roll_movements (workspace_id, roll_id);

-- ─── roll_create ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.roll_create(
  p_workspace               uuid,
  p_actor                   uuid,
  p_roll_number             text,
  p_initial_length          numeric,
  p_unit                    text DEFAULT 'm',
  p_location                text DEFAULT NULL,
  p_cost_minor              bigint DEFAULT 0,
  p_custom_conversion_factor numeric DEFAULT NULL,
  p_idempotency_key         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $roll_create$
DECLARE
  v_existing rolls;
  v_row      rolls;
BEGIN
  IF p_roll_number IS NULL OR length(trim(p_roll_number)) = 0 THEN
    RAISE EXCEPTION 'ROLL_NUMBER_REQUIRED';
  END IF;
  IF p_initial_length IS NULL OR p_initial_length <= 0 THEN
    RAISE EXCEPTION 'ROLL_LENGTH_INVALID';
  END IF;
  IF p_cost_minor IS NULL OR p_cost_minor < 0 THEN
    RAISE EXCEPTION 'ROLL_COST_INVALID';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing
      FROM rolls
     WHERE workspace_id = p_workspace AND client_request_id = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('roll_id', v_existing.id, 'status', 'already_created');
    END IF;
  END IF;

  INSERT INTO rolls
    (workspace_id, roll_number, initial_length, remaining_length, unit,
     location, cost_minor, custom_conversion_factor, client_request_id, created_by)
  VALUES
    (p_workspace, trim(p_roll_number), p_initial_length, p_initial_length,
     coalesce(p_unit, 'm'), p_location, p_cost_minor, p_custom_conversion_factor,
     p_idempotency_key, p_actor)
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('roll_id', v_row.id, 'status', 'created');
END;
$roll_create$;

-- ─── roll_apply_movement ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.roll_apply_movement(
  p_workspace        uuid,
  p_actor            uuid,
  p_roll             uuid,
  p_kind             text,
  p_length           numeric,
  p_waste_length     numeric DEFAULT 0,
  p_idempotency_key  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $roll_movement$
DECLARE
  v_existing   roll_movements;
  v_roll       rolls;
  v_new_length numeric;
  v_waste      numeric := coalesce(p_waste_length, 0);
BEGIN
  IF p_kind NOT IN ('consume', 'cut', 'return') THEN
    RAISE EXCEPTION 'ROLL_KIND_INVALID';
  END IF;
  IF p_length IS NULL OR p_length <= 0 THEN
    RAISE EXCEPTION 'ROLL_LENGTH_INVALID';
  END IF;
  IF v_waste < 0 OR v_waste > p_length THEN
    RAISE EXCEPTION 'ROLL_WASTE_INVALID';
  END IF;

  -- Idempotent first: a retry returns what it already did.
  SELECT * INTO v_existing
    FROM roll_movements
   WHERE workspace_id = p_workspace AND client_request_id = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'already_applied',
      'roll_id', v_existing.roll_id,
      'length', v_existing.length,
      'kind', v_existing.kind
    );
  END IF;

  -- Lock the roll row: every writer of this roll queues here, so the check
  -- and the update are one atomic step against the other device.
  SELECT * INTO v_roll
    FROM rolls
   WHERE id = p_roll AND workspace_id = p_workspace AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROLL_NOT_FOUND';
  END IF;

  IF p_kind IN ('consume', 'cut') THEN
    IF p_length > v_roll.remaining_length + 0.0001 THEN
      RAISE EXCEPTION 'ROLL_INSUFFICIENT';
    END IF;
    v_new_length := round(greatest(0, v_roll.remaining_length - p_length), 3);
  ELSE
    -- A return cannot give the roll more than it originally had.
    IF p_length > (v_roll.initial_length - v_roll.remaining_length) + 0.0001 THEN
      RAISE EXCEPTION 'ROLL_RETURN_EXCEEDS_CONSUMED';
    END IF;
    v_new_length := round(least(v_roll.initial_length, v_roll.remaining_length + p_length), 3);
  END IF;

  UPDATE rolls
     SET remaining_length = v_new_length, updated_at = now()
   WHERE id = v_roll.id AND workspace_id = p_workspace;

  INSERT INTO roll_movements
    (workspace_id, roll_id, kind, length, waste_length, client_request_id, created_by)
  VALUES
    (p_workspace, v_roll.id, p_kind, p_length, v_waste, p_idempotency_key, p_actor);

  RETURN jsonb_build_object(
    'status', 'applied',
    'roll_id', v_roll.id,
    'kind', p_kind,
    'length', p_length,
    'new_remaining_length', v_new_length
  );
END;
$roll_movement$;

-- ─── Privileges ─────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.roll_create(uuid, uuid, text, numeric, text, text, bigint, numeric, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.roll_apply_movement(uuid, uuid, uuid, text, numeric, numeric, text)
  FROM PUBLIC, anon, authenticated;

ALTER TABLE public.rolls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rolls FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.rolls TO service_role;

ALTER TABLE public.roll_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.roll_movements FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.roll_movements TO service_role;

-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- (see docs/VERIFY-roll-cutting-01.sql)

-- ─── ROLLBACK BLOCK ─────────────────────────────────────────────────────────
-- DROP FUNCTION IF EXISTS public.roll_apply_movement(uuid, uuid, uuid, text, numeric, numeric, text);
-- DROP FUNCTION IF EXISTS public.roll_create(uuid, uuid, text, numeric, text, text, bigint, numeric, text);
-- DROP TABLE IF EXISTS public.roll_movements;
-- DROP TABLE IF EXISTS public.rolls;
