-- ═══════════════════════════════════════════════════════════════════════════
-- storage-bin-transfer-01-migration.sql        PENDING HUMAN CONFIRMATION
-- V58 · P0-1b — bin-to-bin transfer of a placement
--
-- WHY. A person records stock at a bin, then the goods physically move to
-- another bin. Until now the only paths were «remove here, add there» — two
-- calls, no transaction, and a failure between them left the units nowhere.
-- One function moves the placement in one transaction, refusing everything
-- that would break conservation.
--
-- RULES
--   · Both locations must belong to the caller's workspace and the SAME
--     warehouse (a cross-warehouse move is a warehouse transfer, not a map edit).
--   · The move can never exceed what the source bin holds.
--   · The destination's total can never exceed what the warehouse holds
--     (the same cap storage_place_stock enforces).
--   · Conservation is structural: one UPDATE on the source and one UPSERT on
--     the destination inside one transaction. Nothing else touches the rows.
--   · The moved quantity is returned so the caller can show it and so a test
--     can assert it.
--
-- ROLLBACK (safe — no other object references it)
--   DROP FUNCTION IF EXISTS public.storage_move_stock(uuid, uuid, uuid, uuid, uuid, numeric);
--
-- VERIFY: docs/VERIFY-storage-bin-transfer-01.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.storage_move_stock(
  p_workspace  uuid,
  p_actor      uuid,
  p_from       uuid,
  p_to         uuid,
  p_product    uuid,
  p_quantity   numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $move$
DECLARE
  v_from   storage_locations;
  v_to     storage_locations;
  v_moved  numeric;
  v_target numeric;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'STORAGE_MOVE_INVALID_QUANTITY';
  END IF;
  IF p_from = p_to THEN
    RAISE EXCEPTION 'STORAGE_MOVE_SAME_LOCATION';
  END IF;

  SELECT * INTO v_from
    FROM storage_locations
   WHERE id = p_from AND workspace_id = p_workspace
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STORAGE_MOVE_SOURCE_NOT_FOUND';
  END IF;
  IF NOT v_from.is_active THEN
    RAISE EXCEPTION 'STORAGE_MOVE_SOURCE_INACTIVE';
  END IF;

  SELECT * INTO v_to
    FROM storage_locations
   WHERE id = p_to AND workspace_id = p_workspace
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STORAGE_MOVE_DESTINATION_NOT_FOUND';
  END IF;
  IF NOT v_to.is_active THEN
    RAISE EXCEPTION 'STORAGE_MOVE_DESTINATION_INACTIVE';
  END IF;
  IF v_to.warehouse_id <> v_from.warehouse_id THEN
    RAISE EXCEPTION 'STORAGE_MOVE_OTHER_WAREHOUSE';
  END IF;

  -- The product must belong to the caller's workspace — an id that leaked
  -- from elsewhere must never move a row.
  IF NOT EXISTS (
    SELECT 1 FROM products
     WHERE id = p_product AND workspace_id = p_workspace
  ) THEN
    RAISE EXCEPTION 'STORAGE_MOVE_PRODUCT_NOT_FOUND';
  END IF;

  -- What the source bin holds, under the same lock the cap writer takes.
  SELECT quantity INTO v_moved
    FROM storage_location_placements
   WHERE location_id = p_from AND product_id = p_product
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STORAGE_MOVE_NOTHING_PLACED';
  END IF;
  IF p_quantity > v_moved THEN
    RAISE EXCEPTION 'STORAGE_MOVE_EXCEEDS_PLACED';
  END IF;

  -- The warehouse cap on the destination, locked against concurrent moves.
  SELECT quantity INTO v_target
    FROM warehouse_stock
   WHERE workspace_id = p_workspace
     AND warehouse_id = v_to.warehouse_id
     AND product_id = p_product
   FOR UPDATE;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'STORAGE_MOVE_NO_STOCK';
  END IF;

  -- What the destination already holds of this product, every bin summed.
  IF (
    SELECT COALESCE(SUM(quantity), 0) + p_quantity
      FROM storage_location_placements
     WHERE location_id = p_to AND product_id = p_product
  ) > v_target THEN
    RAISE EXCEPTION 'STORAGE_MOVE_EXCEEDS_WAREHOUSE';
  END IF;

  IF p_quantity = v_moved THEN
    -- The source empties: the row goes with it. A placement of zero tells
    -- nobody anything and blocks the «one row per product per bin» index.
    DELETE FROM storage_location_placements
     WHERE location_id = p_from AND product_id = p_product;
  ELSE
    UPDATE storage_location_placements
       SET quantity = quantity - p_quantity, updated_at = now()
     WHERE location_id = p_from AND product_id = p_product;
  END IF;

  INSERT INTO storage_location_placements
    (workspace_id, location_id, product_id, quantity, placed_by)
  VALUES
    (p_workspace, p_to, p_product, p_quantity, p_actor)
  ON CONFLICT (location_id, product_id)
  DO UPDATE SET quantity = storage_location_placements.quantity + p_quantity,
                updated_at = now();

  RETURN jsonb_build_object(
    'status', 'moved',
    'moved_quantity', p_quantity,
    'from_location', p_from,
    'to_location', p_to
  );
END
$move$;

COMMENT ON FUNCTION public.storage_move_stock IS
  'The one bin-to-bin transfer path: both rows locked, conservation structural, every refusal a named exception. Moves placements only — warehouse_stock is untouched.';

COMMIT;

-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION

-- Backend-only functions are not callable by clients (see the note in
-- stock-reservations-01-migration.sql; enforced by
-- rpc-not-callable-by-clients.test.ts).
REVOKE ALL ON FUNCTION public.storage_move_stock(uuid, uuid, uuid, uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
