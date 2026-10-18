-- ═══════════════════════════════════════════════════════════════════════════
-- shelf-capacity-01 — a shelf's capacity is enforced, and purchases fill the
-- shelf a product is set to, up to that capacity
-- ═══════════════════════════════════════════════════════════════════════════
--
-- THE REQUEST (owner, 18 Oct 2026). Eight gearboxes in the warehouse, two on
-- shelf A-3. «Put on this shelf» asked again for the TOTAL, starting at
-- 2 + 6 = 8; nothing stopped a shelf going past its capacity; and a purchase
-- of the same gearbox stayed «on no shelf» until someone placed it by hand.
--
-- Requires warehouse-map-01 (storage_locations, storage_location_placements,
-- storage_place_stock). Additive and idempotent: run it twice, same result.
--
-- What changes:
--   1. storage_place_stock also refuses to RAISE a shelf above its capacity
--      (all products on it, in units). Lowering an over-full shelf is allowed
--      — it is how one gets fixed. Capacity NULL = «not recorded», no limit.
--   2. storage_auto_shelves — ONE shelf per (warehouse, product) that a
--      purchase fills. Set by a person; never guessed.
--   3. storage_auto_receipts — one row per (invoice, product): the record that
--      a purchase was already shelved, so a retry, a replay or a second call
--      for the same invoice allocates NOTHING twice.
--   4. storage_auto_shelve_invoice — after a purchase's stock movements are
--      committed, puts what arrived on the product's shelf, up to the room left
--      on it and never more than the warehouse holds unshelved. What does not
--      fit stays «on no shelf»; the screen derives the overflow from these same
--      numbers (no counter is stored that could drift).
--
-- A placement is not a stock movement: nothing here writes warehouse_stock,
-- stock_movements, cost layers or the ledger.
--
-- Rollback / mitigation (manual):
--   DROP FUNCTION IF EXISTS public.storage_auto_shelve_invoice(uuid, uuid);
--   DROP TABLE IF EXISTS public.storage_auto_receipts;
--   DROP TABLE IF EXISTS public.storage_auto_shelves;
--   and re-run section 3 of warehouse-map-01-migration.sql to restore the
--   storage_place_stock without the capacity check.
-- The backend reads the new tables as optional: without them the auto-fill
-- and the overflow warning are simply off, nothing fails.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The one writing path for a placement, now with the capacity check
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.storage_place_stock(
  p_workspace uuid,
  p_actor     uuid,
  p_location  uuid,
  p_product   uuid,
  p_quantity  numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $place$
DECLARE
  v_location   storage_locations;
  v_product_ok boolean;
  v_on_hand    numeric;
  v_placed     numeric;
  v_here       numeric;
  v_free       numeric;
  v_others     numeric;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 0 THEN
    RAISE EXCEPTION 'STORAGE_PLACEMENT_NEGATIVE';
  END IF;

  SELECT * INTO v_location
    FROM storage_locations
   WHERE id = p_location AND workspace_id = p_workspace
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STORAGE_LOCATION_NOT_FOUND';
  END IF;
  IF NOT v_location.is_active THEN
    RAISE EXCEPTION 'STORAGE_LOCATION_INACTIVE';
  END IF;

  SELECT true INTO v_product_ok
    FROM products
   WHERE id = p_product AND workspace_id = p_workspace;
  IF v_product_ok IS NULL THEN
    RAISE EXCEPTION 'STORAGE_PLACEMENT_PRODUCT_NOT_FOUND';
  END IF;

  SELECT quantity INTO v_on_hand
    FROM warehouse_stock
   WHERE warehouse_id = v_location.warehouse_id
     AND product_id = p_product
     AND workspace_id = p_workspace
   FOR UPDATE;
  v_on_hand := COALESCE(v_on_hand, 0);

  SELECT COALESCE(SUM(quantity), 0),
         COALESCE(SUM(quantity) FILTER (WHERE location_id = p_location), 0)
    INTO v_placed, v_here
    FROM storage_location_placements
   WHERE workspace_id = p_workspace
     AND product_id = p_product
     AND location_id IN (SELECT id FROM storage_locations
                          WHERE warehouse_id = v_location.warehouse_id);

  v_free := GREATEST(v_on_hand, 0) - (v_placed - v_here);

  IF p_quantity > v_free + 1e-6 THEN
    RAISE EXCEPTION 'STORAGE_PLACEMENT_EXCEEDS_STOCK:%:%', p_quantity, v_free
      USING DETAIL = jsonb_build_object('requested', p_quantity, 'available', v_free)::text;
  END IF;

  -- Capacity: everything ELSE on this shelf plus this product's new quantity.
  -- Only a RAISE is refused; lowering a shelf that is already over is allowed.
  IF v_location.capacity IS NOT NULL AND p_quantity > v_here + 1e-6 THEN
    SELECT COALESCE(SUM(quantity), 0) INTO v_others
      FROM storage_location_placements
     WHERE location_id = p_location AND product_id <> p_product;
    IF v_others + p_quantity > v_location.capacity + 1e-6 THEN
      RAISE EXCEPTION 'STORAGE_PLACEMENT_EXCEEDS_CAPACITY:%:%',
        p_quantity, GREATEST(v_location.capacity - v_others, 0)
        USING DETAIL = jsonb_build_object(
          'requested', p_quantity,
          'room', GREATEST(v_location.capacity - v_others, 0))::text;
    END IF;
  END IF;

  INSERT INTO storage_location_placements
    (workspace_id, location_id, product_id, quantity, placed_by)
  VALUES (p_workspace, p_location, p_product, p_quantity, p_actor)
  ON CONFLICT (location_id, product_id) DO UPDATE
    SET quantity   = EXCLUDED.quantity,
        placed_by  = EXCLUDED.placed_by,
        updated_at = now();

  RETURN jsonb_build_object(
    'locationId', p_location,
    'productId',  p_product,
    'quantity',   p_quantity,
    'available',  v_free
  );
END
$place$;

-- ---------------------------------------------------------------------------
-- 2. The shelf a product's purchases go to, per warehouse
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.storage_auto_shelves (
  workspace_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  product_id   uuid NOT NULL,
  location_id  uuid NOT NULL,
  set_by       uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT storage_auto_shelves_pkey PRIMARY KEY (warehouse_id, product_id),
  CONSTRAINT storage_auto_shelves_location
    FOREIGN KEY (location_id) REFERENCES public.storage_locations (id)
);

CREATE INDEX IF NOT EXISTS storage_auto_shelves_by_workspace
  ON public.storage_auto_shelves (workspace_id, warehouse_id);

COMMENT ON TABLE public.storage_auto_shelves IS
  'The shelf a purchase of this product into this warehouse is put on, up to the shelf capacity. Set by a person.';

-- ---------------------------------------------------------------------------
-- 3. «This purchase was already shelved» — once per (invoice, product)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.storage_auto_receipts (
  workspace_id uuid NOT NULL,
  invoice_id   uuid NOT NULL,
  product_id   uuid NOT NULL,
  location_id  uuid NOT NULL,
  received     numeric NOT NULL DEFAULT 0,
  allocated    numeric NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT storage_auto_receipts_pkey PRIMARY KEY (invoice_id, product_id),
  CONSTRAINT storage_auto_receipts_not_negative
    CHECK (received >= 0 AND allocated >= 0 AND allocated <= received + 1e-6)
);

COMMENT ON TABLE public.storage_auto_receipts IS
  'One row per purchase invoice and product that was put on its auto shelf: what arrived and what fitted. Makes the auto-fill run once.';

-- ---------------------------------------------------------------------------
-- 4. Put a committed purchase on its shelves
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.storage_auto_shelve_invoice(
  p_workspace uuid,
  p_invoice   uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $auto$
DECLARE
  r          record;
  v_location storage_locations;
  v_loc_id   uuid;
  v_new      integer;
  v_occupied numeric;
  v_room     numeric;
  v_on_hand  numeric;
  v_placed   numeric;
  v_free     numeric;
  v_alloc    numeric;
  v_out      jsonb := '[]'::jsonb;
BEGIN
  FOR r IN
    -- What this purchase brought into each warehouse, per product. Joined to
    -- products for the workspace: older movements may lack workspace_id.
    SELECT m.product_id, m.to_warehouse_id AS warehouse_id, SUM(m.quantity) AS qty
      FROM stock_movements m
      JOIN products p ON p.id = m.product_id AND p.workspace_id = p_workspace
     WHERE m.reference_type = 'invoice'
       AND m.reference_id = p_invoice
       AND m.type = 'purchase'
       AND m.to_warehouse_id IS NOT NULL
     GROUP BY m.product_id, m.to_warehouse_id
    HAVING SUM(m.quantity) > 0
  LOOP
    SELECT location_id INTO v_loc_id
      FROM storage_auto_shelves
     WHERE workspace_id = p_workspace
       AND warehouse_id = r.warehouse_id
       AND product_id = r.product_id;
    CONTINUE WHEN v_loc_id IS NULL;

    -- Once per (invoice, product): a second call finds the row and stops.
    INSERT INTO storage_auto_receipts (workspace_id, invoice_id, product_id, location_id, received)
    VALUES (p_workspace, p_invoice, r.product_id, v_loc_id, r.qty)
    ON CONFLICT (invoice_id, product_id) DO NOTHING;
    GET DIAGNOSTICS v_new = ROW_COUNT;
    CONTINUE WHEN v_new = 0;

    -- Same lock order as storage_place_stock: the shelf, then the stock row.
    SELECT * INTO v_location
      FROM storage_locations
     WHERE id = v_loc_id AND workspace_id = p_workspace
     FOR UPDATE;
    CONTINUE WHEN NOT FOUND OR NOT v_location.is_active
               OR v_location.warehouse_id <> r.warehouse_id;

    SELECT COALESCE(SUM(quantity), 0) INTO v_occupied
      FROM storage_location_placements
     WHERE location_id = v_loc_id;

    SELECT quantity INTO v_on_hand
      FROM warehouse_stock
     WHERE warehouse_id = r.warehouse_id
       AND product_id = r.product_id
       AND workspace_id = p_workspace
     FOR UPDATE;
    v_on_hand := COALESCE(v_on_hand, 0);

    SELECT COALESCE(SUM(quantity), 0) INTO v_placed
      FROM storage_location_placements
     WHERE workspace_id = p_workspace
       AND product_id = r.product_id
       AND location_id IN (SELECT id FROM storage_locations
                            WHERE warehouse_id = r.warehouse_id);

    v_free := GREATEST(GREATEST(v_on_hand, 0) - v_placed, 0);
    v_room := CASE WHEN v_location.capacity IS NULL THEN r.qty
                   ELSE GREATEST(v_location.capacity - v_occupied, 0) END;
    v_alloc := LEAST(r.qty, v_room, v_free);

    IF v_alloc > 0 THEN
      INSERT INTO storage_location_placements
        (workspace_id, location_id, product_id, quantity, placed_by)
      VALUES (p_workspace, v_loc_id, r.product_id, v_alloc, NULL)
      ON CONFLICT (location_id, product_id) DO UPDATE
        SET quantity   = storage_location_placements.quantity + EXCLUDED.quantity,
            updated_at = now();
    END IF;

    UPDATE storage_auto_receipts
       SET allocated = GREATEST(v_alloc, 0)
     WHERE invoice_id = p_invoice AND product_id = r.product_id;

    v_out := v_out || jsonb_build_object(
      'productId', r.product_id, 'locationId', v_loc_id,
      'received', r.qty, 'allocated', GREATEST(v_alloc, 0),
      'overflow', r.qty - GREATEST(v_alloc, 0));
  END LOOP;

  RETURN v_out;
END
$auto$;

-- ---------------------------------------------------------------------------
-- 5. Privileges — only the server reads or writes these
-- ---------------------------------------------------------------------------

ALTER TABLE public.storage_auto_shelves ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storage_auto_shelves FROM anon, authenticated, service_role;
-- DELETE: turning a product's auto shelf off removes its one setting row.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_auto_shelves TO service_role;

ALTER TABLE public.storage_auto_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storage_auto_receipts FROM anon, authenticated, service_role;
-- INSERT/UPDATE: written by storage_auto_shelve_invoice, which runs as the caller.
GRANT SELECT, INSERT, UPDATE ON public.storage_auto_receipts TO service_role;

REVOKE ALL ON FUNCTION public.storage_place_stock(uuid, uuid, uuid, uuid, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_place_stock(uuid, uuid, uuid, uuid, numeric)
  TO service_role;

REVOKE ALL ON FUNCTION public.storage_auto_shelve_invoice(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_auto_shelve_invoice(uuid, uuid) TO service_role;

COMMIT;
