-- ═══════════════════════════════════════════════════════════════════════════
-- warehouse-map-01 — WHERE inside the warehouse the goods are
-- ═══════════════════════════════════════════════════════════════════════════
--
-- THE REQUEST (16 Oct 2026). «موجودی من ۴۰۰ قلم است» answers what a business
-- has. It does not answer which part of the building it is in, which part is
-- working and which part is holding money still. Until now the schema had
-- `warehouses` and `warehouse_stock` and nothing between them: a warehouse was
-- a single undifferentiated box.
--
-- WHAT THIS IS — AND IS NOT.
--
--   storage_locations            the physical plan of ONE warehouse: a zone,
--                                an aisle, a rack, a shelf, a bin — a TREE of
--                                `parent_id`, any depth, each with a CODE and a
--                                rectangle on a grid (position_x/y, width,
--                                height). No stock figure lives here.
--
--   storage_location_placements  which product a PERSON recorded as sitting in
--                                which location, and how many units of it.
--
-- ⚠️ A PLACEMENT IS NOT A STOCK MOVEMENT, AND IT NEVER ADDS STOCK.
--
-- `stock_movements` stays the only source of truth for quantity (Phase C) and
-- `warehouse_stock` stays its projection. A placement is a statement about
-- where goods that ALREADY EXIST are; it is capped, inside the function below,
-- by what that warehouse actually holds, and it is never summed into
-- `products.quantity`, `warehouse_stock.quantity`, a cost layer or a ledger
-- figure. Moving goods BETWEEN warehouses is `warehouse_transfer_stock` and is
-- untouched by this file — placing is not transferring.
--
-- ⚠️ WHY THE CAP LIVES IN THE FUNCTION AND NOT IN A TRIGGER.
--
-- A trigger would have to re-check every placement of a product whenever
-- `warehouse_stock` changes — which is on every sale. A sale that fails because
-- a shelf label says 5 would be a stock engine that cannot sell. So the cap is
-- applied on the way IN (row-locked, one writing path), and a placement that
-- the stock has since outgrown is REPORTED by the reader (drift), not silently
-- repaired and not allowed to block a movement.
--
-- THE RULES THE DATABASE HOLDS
--   1. Every location has a non-blank code, unique inside its warehouse.
--   2. kind ∈ zone | aisle | rack | shelf | bin.
--   3. width > 0, height > 0, capacity IS NULL OR capacity > 0. A location with
--      no capacity recorded has capacity NULL — «cannot be calculated», not 0.
--   4. A location cannot be its own parent, its chain cannot cycle, and its
--      parent must be in the SAME warehouse and the SAME workspace.
--   5. Retirement, not deletion: `is_active = false`. (No DELETE grant.)
--   6. One placement row per (location, product); quantity ≥ 0. Quantity 0
--      means «no longer recorded here» and the row stays.
--   7. A placement may never exceed the units that warehouse holds, counted
--      over all the locations of that warehouse.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
-- Run docs/VERIFY-warehouse-map-01.sql after it and paste the rows back.
-- Nothing must run before it; it depends only on `warehouses` and `products`.
--
-- ROLLBACK / MITIGATION (only this feature's own objects):
--   DROP TRIGGER IF EXISTS storage_locations_shape ON public.storage_locations;
--   DROP FUNCTION IF EXISTS public.storage_locations_shape();
--   DROP FUNCTION IF EXISTS public.storage_place_stock(uuid, uuid, uuid, uuid, numeric);
--   DROP TABLE IF EXISTS public.storage_location_placements;
--   DROP TABLE IF EXISTS public.storage_locations;
--   The server answers «نقشه پیکربندی نشده» without these; nothing else reads
--   them, and no stock figure, movement or cost layer refers to them.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The plan of a warehouse
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.storage_locations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  warehouse_id  uuid NOT NULL,
  parent_id     uuid,
  code          text NOT NULL,
  name          text,
  kind          text NOT NULL DEFAULT 'bin',
  position_x    numeric NOT NULL DEFAULT 0,
  position_y    numeric NOT NULL DEFAULT 0,
  width         numeric NOT NULL DEFAULT 1,
  height        numeric NOT NULL DEFAULT 1,
  capacity      numeric,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT storage_locations_kind
    CHECK (kind IN ('zone', 'aisle', 'rack', 'shelf', 'bin')),
  CONSTRAINT storage_locations_code_length
    CHECK (code IS NOT NULL AND char_length(btrim(code)) BETWEEN 1 AND 40),
  CONSTRAINT storage_locations_code_trimmed
    CHECK (code = btrim(code)),
  CONSTRAINT storage_locations_name_length
    CHECK (name IS NULL OR char_length(btrim(name)) <= 80),
  CONSTRAINT storage_locations_size_positive
    CHECK (width > 0 AND height > 0),
  CONSTRAINT storage_locations_capacity_positive
    CHECK (capacity IS NULL OR capacity > 0),
  CONSTRAINT storage_locations_not_own_parent
    CHECK (parent_id IS DISTINCT FROM id),
  -- A rectangle on a grid, not a CAD drawing: whole grid cells, so two people
  -- typing the same numbers get the same picture.
  CONSTRAINT storage_locations_grid_whole
    CHECK (
      position_x = trunc(position_x) AND position_y = trunc(position_y)
      AND width = trunc(width) AND height = trunc(height)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS storage_locations_code_per_warehouse
  ON public.storage_locations (warehouse_id, code);

CREATE INDEX IF NOT EXISTS storage_locations_tree
  ON public.storage_locations (workspace_id, warehouse_id, parent_id);

COMMENT ON TABLE public.storage_locations IS
  'The physical plan of one warehouse (zone/aisle/rack/shelf/bin), a tree of parent_id with a code and a grid rectangle. Holds no stock figure.';

-- Warehouse and parent must agree with the row that is being written, and the
-- chain may not cycle. A self-reference would make the reader's tree walk hang
-- or paint a location on top of itself forever.
CREATE OR REPLACE FUNCTION public.storage_locations_shape()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $shape$
DECLARE
  v_warehouse_workspace uuid;
  v_parent_warehouse    uuid;
  v_parent_workspace    uuid;
  v_parent              uuid;
  v_hops                int := 0;
BEGIN
  SELECT workspace_id INTO v_warehouse_workspace
    FROM warehouses WHERE id = NEW.warehouse_id;
  IF v_warehouse_workspace IS NULL THEN
    RAISE EXCEPTION 'STORAGE_LOCATION_WAREHOUSE_NOT_FOUND';
  END IF;
  IF v_warehouse_workspace <> NEW.workspace_id THEN
    RAISE EXCEPTION 'STORAGE_LOCATION_WAREHOUSE_MISMATCH';
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT warehouse_id, workspace_id INTO v_parent_warehouse, v_parent_workspace
      FROM storage_locations WHERE id = NEW.parent_id;
    IF v_parent_warehouse IS NULL THEN
      RAISE EXCEPTION 'STORAGE_LOCATION_PARENT_NOT_FOUND';
    END IF;
    IF v_parent_warehouse <> NEW.warehouse_id
       OR v_parent_workspace <> NEW.workspace_id THEN
      RAISE EXCEPTION 'STORAGE_LOCATION_PARENT_OTHER_WAREHOUSE';
    END IF;

    v_parent := NEW.parent_id;
    WHILE v_parent IS NOT NULL LOOP
      IF v_parent = NEW.id THEN
        RAISE EXCEPTION 'STORAGE_LOCATION_CYCLE';
      END IF;
      v_hops := v_hops + 1;
      IF v_hops > 64 THEN
        RAISE EXCEPTION 'STORAGE_LOCATION_TOO_DEEP';
      END IF;
      SELECT parent_id INTO v_parent FROM storage_locations WHERE id = v_parent;
    END LOOP;
  END IF;

  RETURN NEW;
END
$shape$;

DROP TRIGGER IF EXISTS storage_locations_shape ON public.storage_locations;
CREATE TRIGGER storage_locations_shape
  BEFORE INSERT OR UPDATE ON public.storage_locations
  FOR EACH ROW EXECUTE FUNCTION public.storage_locations_shape();

-- ---------------------------------------------------------------------------
-- 2. What a person recorded as sitting in a location
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.storage_location_placements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  location_id   uuid NOT NULL,
  product_id    uuid NOT NULL,
  quantity      numeric NOT NULL DEFAULT 0,
  placed_by     uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT storage_location_placements_location
    FOREIGN KEY (location_id) REFERENCES public.storage_locations (id),
  CONSTRAINT storage_location_placements_not_negative
    CHECK (quantity IS NOT NULL AND quantity >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS storage_location_placements_one_per_product
  ON public.storage_location_placements (location_id, product_id);

CREATE INDEX IF NOT EXISTS storage_location_placements_by_product
  ON public.storage_location_placements (workspace_id, product_id);

COMMENT ON TABLE public.storage_location_placements IS
  'Which product a person recorded as sitting in which storage location of a warehouse, and how many units. Capped by warehouse_stock; never a stock figure of its own.';

-- ---------------------------------------------------------------------------
-- 3. The one writing path for a placement
--
-- Row-locked, so two devices placing the same product at once cannot both pass
-- the cap: the sum is read under FOR UPDATE and the row is written in the same
-- transaction (CLAUDE.md §1.4 — supabase-js has no transactions, so a
-- multi-row write is a Postgres function).
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

  -- What this warehouse holds, locked so a sale cannot slip under the check.
  SELECT quantity INTO v_on_hand
    FROM warehouse_stock
   WHERE warehouse_id = v_location.warehouse_id
     AND product_id = p_product
     AND workspace_id = p_workspace
   FOR UPDATE;
  v_on_hand := COALESCE(v_on_hand, 0);

  -- Everything already recorded for this product in this warehouse, and the
  -- part of it that is THIS location — which is being replaced, not added to.
  SELECT COALESCE(SUM(quantity), 0),
         COALESCE(SUM(quantity) FILTER (WHERE location_id = p_location), 0)
    INTO v_placed, v_here
    FROM storage_location_placements
   WHERE workspace_id = p_workspace
     AND product_id = p_product
     AND location_id IN (SELECT id FROM storage_locations
                          WHERE warehouse_id = v_location.warehouse_id);

  v_free := GREATEST(v_on_hand, 0) - (v_placed - v_here);

  -- 1e-6: quantities arrive as JSON numbers and a float that should be 5 can
  -- be 4.999999999999999. A real over-placement is orders of magnitude larger.
  IF p_quantity > v_free + 1e-6 THEN
    RAISE EXCEPTION 'STORAGE_PLACEMENT_EXCEEDS_STOCK:%:%', p_quantity, v_free
      USING DETAIL = jsonb_build_object('requested', p_quantity, 'available', v_free)::text;
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
-- 4. Privileges
--
-- Supabase gives every new table ALL to anon, authenticated and service_role.
-- Only the server reads or writes these, and it never deletes.
-- ---------------------------------------------------------------------------

ALTER TABLE public.storage_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storage_locations FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.storage_locations TO service_role;

ALTER TABLE public.storage_location_placements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storage_location_placements FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.storage_location_placements TO service_role;

REVOKE ALL ON FUNCTION public.storage_locations_shape() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.storage_place_stock(uuid, uuid, uuid, uuid, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_place_stock(uuid, uuid, uuid, uuid, numeric)
  TO service_role;

COMMIT;
