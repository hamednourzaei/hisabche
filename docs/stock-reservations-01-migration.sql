-- ═══════════════════════════════════════════════════════════════════════════
-- stock-reservations-01-migration.sql          PENDING HUMAN CONFIRMATION
-- V58 · P0-1 — stock reservations and available-to-promise (ATP)
--
-- WHY. A sale at the counter and an order taken for later both promise the
-- same units. Nothing held them apart, so two sellers could promise one
-- shelf's contents and the second sale found the bin empty. This migration
-- gives every promise its own auditable row and one writing path that cannot
-- oversell.
--
-- WHAT IT ADDS
--   public.stock_reservations          one row per promise
--   public.stock_reserve()             the ONLY way a reservation is created
--   public.stock_release_reservation() cancel (whole or part), never deletes
--   public.stock_settle_reservation()  the promise was honoured (partial ok)
--   public.stock_available()           ATP = on hand − active reservations
--
-- SEMANTICS (read before wiring a caller)
--   · ATP never counts a reservation. A reservation SHRINKS what is free.
--   · Settlement does NOT move stock. The sale (or transfer) that honours the
--     promise decrements `warehouse_stock` through its own existing path; the
--     reservation only stops holding. Decrementing here too would subtract
--     the units twice.
--   · Nothing is ever deleted. Every state change is a row update with who
--     and when — the history is the table.
--   · Idempotent on (workspace_id, idempotency_key): a retried reserve
--     returns the reservation it already made.
--   · Expired reservations stop counting against ATP automatically (the
--     available function filters on expires_at); a sweep is not required for
--     correctness.
--
-- ROLLBACK (safe — nothing else refers to these objects yet)
--   DROP FUNCTION IF EXISTS public.stock_available(uuid, uuid, uuid);
--   DROP FUNCTION IF EXISTS public.stock_settle_reservation(uuid, uuid, uuid, numeric, uuid);
--   DROP FUNCTION IF EXISTS public.stock_release_reservation(uuid, uuid, uuid, numeric, uuid);
--   DROP FUNCTION IF EXISTS public.stock_reserve(uuid, uuid, uuid, uuid, numeric, text, uuid, text, timestamptz);
--   DROP TABLE IF EXISTS public.stock_reservations;
--
-- VERIFY: docs/VERIFY-stock-reservations-01.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The reservation itself
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.stock_reservations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL,
  warehouse_id     uuid NOT NULL,
  product_id       uuid NOT NULL,
  variant_id       uuid,
  quantity         numeric NOT NULL,
  -- active → settled | released | expired. A row is never deleted and never
  -- goes backwards: settled/released/expired are terminal states.
  status           text NOT NULL DEFAULT 'active',
  reference_type   text,
  reference_id     uuid,
  idempotency_key  text,
  notes            text,
  expires_at       timestamptz,
  reserved_by      uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  settled_at       timestamptz,
  released_at      timestamptz,
  settled_quantity numeric,
  released_quantity numeric,
  -- Reserved quantity is positive and final: to change a promise, release it
  -- and make a new one. Editing a hold in place is how books drift.
  CONSTRAINT stock_reservations_quantity_positive
    CHECK (quantity IS NOT NULL AND quantity > 0),
  CONSTRAINT stock_reservations_status
    CHECK (status IN ('active', 'settled', 'released', 'expired')),
  CONSTRAINT stock_reservations_state_terminal
    CHECK (
      (status = 'active' AND settled_at IS NULL AND released_at IS NULL)
      OR (status <> 'active')
    )
);

-- The idempotency promise: the same key in the same workspace is ONE promise.
CREATE UNIQUE INDEX IF NOT EXISTS stock_reservations_idempotency
  ON public.stock_reservations (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- The ATP read: what is held, per warehouse and product, right now.
CREATE INDEX IF NOT EXISTS stock_reservations_atp
  ON public.stock_reservations (workspace_id, warehouse_id, product_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS stock_reservations_reference
  ON public.stock_reservations (workspace_id, reference_type, reference_id);

COMMENT ON TABLE public.stock_reservations IS
  'One row per promise of stock (sale order, POS hold, transfer plan). Active reservations shrink available-to-promise; the history is never deleted.';

-- ---------------------------------------------------------------------------
-- 2. Available-to-promise
--
-- On hand minus what is promised and not yet expired. Row-level, so a caller
-- inside the reserve function sees the same truth the reader sees.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stock_available(
  p_workspace uuid,
  p_warehouse uuid,
  p_product   uuid
)
RETURNS numeric
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $available$
DECLARE
  v_on_hand numeric;
  v_held    numeric;
BEGIN
  SELECT quantity INTO v_on_hand
    FROM warehouse_stock
   WHERE warehouse_id = p_warehouse
     AND product_id = p_product;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_held
    FROM stock_reservations
   WHERE workspace_id = p_workspace
     AND warehouse_id = p_warehouse
     AND product_id = p_product
     AND status = 'active'
     AND (expires_at IS NULL OR expires_at > now());

  RETURN COALESCE(v_on_hand, 0) - COALESCE(v_held, 0);
END
$available$;

COMMENT ON FUNCTION public.stock_available IS
  'Available-to-promise: on hand minus active, unexpired reservations. Never counts a reservation as free.';

-- ---------------------------------------------------------------------------
-- 3. The one writing path for a reservation
--
-- Row-locked (warehouse_stock FOR UPDATE) so two devices promising the last
-- unit cannot both pass the check — the same pattern the storage-placement
-- writer uses (docs/warehouse-map-01-migration.sql). supabase-js has no
-- transaction, so a check-then-write is a Postgres function or it is a race.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stock_reserve(
  p_workspace       uuid,
  p_actor           uuid,
  p_warehouse       uuid,
  p_product         uuid,
  p_quantity        numeric,
  p_reference_type  text DEFAULT NULL,
  p_reference_id    uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_expires_at      timestamptz DEFAULT NULL,
  p_variant         uuid DEFAULT NULL,
  p_notes           text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $reserve$
DECLARE
  v_existing   stock_reservations;
  v_available  numeric;
  v_row        stock_reservations;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'STOCK_RESERVATION_INVALID_QUANTITY';
  END IF;

  -- Idempotent first: a retry returns the promise it already made, before
  -- any check that could refuse it a second time.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing
      FROM stock_reservations
     WHERE workspace_id = p_workspace AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'status', 'already_reserved',
        'reservation_id', v_existing.id,
        'quantity', v_existing.quantity,
        'reservation_status', v_existing.status
      );
    END IF;
  END IF;

  -- Lock the stock row: every writer of this warehouse+product queues here,
  -- so the check and the insert are one atomic step against the others.
  -- ⚠️ The workspace filter is the tenancy boundary, not a formality: without
  -- it a hold could be made against another workspace's stock row.
  SELECT quantity INTO v_available
    FROM warehouse_stock
   WHERE warehouse_id = p_warehouse
     AND product_id = p_product
     AND workspace_id = p_workspace
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_RESERVATION_NO_STOCK';
  END IF;

  v_available := v_available - COALESCE((
    SELECT SUM(quantity) FROM stock_reservations
     WHERE workspace_id = p_workspace
       AND warehouse_id = p_warehouse
       AND product_id = p_product
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > now())
  ), 0);

  IF p_quantity > v_available THEN
    RAISE EXCEPTION 'STOCK_RESERVATION_INSUFFICIENT';
  END IF;

  INSERT INTO stock_reservations (
    workspace_id, warehouse_id, product_id, variant_id, quantity,
    status, reference_type, reference_id, idempotency_key, notes,
    expires_at, reserved_by
  ) VALUES (
    p_workspace, p_warehouse, p_product, p_variant, p_quantity,
    'active', p_reference_type, p_reference_id, p_idempotency_key, p_notes,
    p_expires_at, p_actor
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'status', 'reserved',
    'reservation_id', v_row.id,
    'quantity', v_row.quantity,
    'reservation_status', v_row.status
  );
END
$reserve$;

COMMENT ON FUNCTION public.stock_reserve IS
  'The only way a reservation is created. Atomic against concurrent sales: warehouse_stock is locked for the check. Idempotent on the idempotency key.';

-- ---------------------------------------------------------------------------
-- 4. Release — the promise is cancelled (whole, or the rest after a partial)
--
-- ⚠️ NOT delete. An expired hold, a failed order, a customer who walked away:
-- each leaves its row, its actor and its timestamp behind.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stock_release_reservation(
  p_workspace     uuid,
  p_actor         uuid,
  p_reservation   uuid,
  p_quantity      numeric DEFAULT NULL,  -- NULL = the whole remainder
  p_notes         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $release$
DECLARE
  v_row stock_reservations;
BEGIN
  SELECT * INTO v_row
    FROM stock_reservations
   WHERE id = p_reservation AND workspace_id = p_workspace
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_RESERVATION_NOT_FOUND';
  END IF;
  IF v_row.status <> 'active' THEN
    RAISE EXCEPTION 'STOCK_RESERVATION_NOT_ACTIVE';
  END IF;
  IF p_quantity IS NOT NULL AND (p_quantity <= 0 OR p_quantity > v_row.quantity) THEN
    RAISE EXCEPTION 'STOCK_RESERVATION_INVALID_QUANTITY';
  END IF;

  IF p_quantity IS NULL OR p_quantity = v_row.quantity THEN
    UPDATE stock_reservations SET
      status = 'released', released_at = now(), updated_at = now(),
      released_quantity = v_row.quantity,
      notes = COALESCE(p_notes, notes)
     WHERE id = v_row.id;
    RETURN jsonb_build_object('status', 'released', 'released_quantity', v_row.quantity);
  END IF;

  -- Partial release: the hold shrinks, the row stays active with the rest.
  UPDATE stock_reservations SET
    quantity = v_row.quantity - p_quantity,
    released_quantity = COALESCE(released_quantity, 0) + p_quantity,
    updated_at = now(),
    notes = COALESCE(p_notes, notes)
   WHERE id = v_row.id;
  RETURN jsonb_build_object(
    'status', 'partially_released',
    'released_quantity', p_quantity,
    'remaining_quantity', v_row.quantity - p_quantity
  );
END
$release$;

-- ---------------------------------------------------------------------------
-- 5. Settle — the promise was honoured (partial settlement allowed)
--
-- ⚠️ Moves NO stock. The sale/transfer that honoured the promise already
-- decremented `warehouse_stock` through its own path. Settling only stops
-- the hold — subtracting here too would take the units out twice.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stock_settle_reservation(
  p_workspace     uuid,
  p_actor         uuid,
  p_reservation   uuid,
  p_quantity      numeric DEFAULT NULL,  -- NULL = the whole remainder
  p_notes         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $settle$
DECLARE
  v_row stock_reservations;
BEGIN
  SELECT * INTO v_row
    FROM stock_reservations
   WHERE id = p_reservation AND workspace_id = p_workspace
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_RESERVATION_NOT_FOUND';
  END IF;
  IF v_row.status <> 'active' THEN
    RAISE EXCEPTION 'STOCK_RESERVATION_NOT_ACTIVE';
  END IF;
  IF p_quantity IS NOT NULL AND (p_quantity <= 0 OR p_quantity > v_row.quantity) THEN
    RAISE EXCEPTION 'STOCK_RESERVATION_INVALID_QUANTITY';
  END IF;

  IF p_quantity IS NULL OR p_quantity = v_row.quantity THEN
    UPDATE stock_reservations SET
      status = 'settled', settled_at = now(), updated_at = now(),
      settled_quantity = v_row.quantity,
      notes = COALESCE(p_notes, notes)
     WHERE id = v_row.id;
    RETURN jsonb_build_object('status', 'settled', 'settled_quantity', v_row.quantity);
  END IF;

  UPDATE stock_reservations SET
    quantity = v_row.quantity - p_quantity,
    settled_quantity = COALESCE(settled_quantity, 0) + p_quantity,
    updated_at = now(),
    notes = COALESCE(p_notes, notes)
   WHERE id = v_row.id;
  RETURN jsonb_build_object(
    'status', 'partially_settled',
    'settled_quantity', p_quantity,
    'remaining_quantity', v_row.quantity - p_quantity
  );
END
$settle$;

COMMIT;

-- ---------------------------------------------------------------------------
-- 6. Backend-only functions are not callable by clients.
--
-- The service key bypasses RLS; a client holding the anon key must never be
-- able to call the writers directly and skip the HTTP layer's capability
-- checks. The guard test (rpc-not-callable-by-clients.test.ts) enforces this
-- for every RPC the backend calls.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.stock_available(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stock_reserve(uuid, uuid, uuid, uuid, numeric, text, uuid, text, timestamptz, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stock_release_reservation(uuid, uuid, uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stock_settle_reservation(uuid, uuid, uuid, numeric, text) FROM PUBLIC, anon, authenticated;

-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- (see docs/VERIFY-stock-reservations-01.sql)
