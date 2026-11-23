-- ============================================================================
-- docs/stock-reservations-02-grants-and-scope-migration.sql
--
-- Two defects in `docs/stock-reservations-01-migration.sql`, found by the
-- WP-13 RPC audit and fixed together because both live in the same four
-- functions:
--
--   A. THE SERVER COULD NOT CALL THEM. The migration revoked EXECUTE from
--      PUBLIC, anon and authenticated but never granted it to service_role.
--      PostgreSQL grants EXECUTE to PUBLIC by default, so the REVOKE removed
--      the only grant that existed: every call from the backend (service key)
--      failed with `42501 permission denied for function stock_reserve`.
--      `transition_sales_order` and `deliver_sales_order_partial`
--      (docs/sales-orders-02-migration.sql) call these functions, so confirming
--      a sales order was the first thing to break.
--
--   B. `stock_available` READ STOCK WITHOUT THE TENANT. Its on-hand read was
--      `WHERE warehouse_id = … AND product_id = …`, so a caller who knew
--      another workspace's warehouse id could read that workspace's stock
--      level. `stock_reserve` already filtered `workspace_id`; the read did
--      not. Now both use the same rule.
--
--      A stock row whose `workspace_id` is NULL (written before
--      docs/inventory-costing-migration.sql backfilled the column) is NOT
--      counted for any workspace: an unowned row is not promiseable stock.
--      docs/FINDING-db-integrity.sql already lists those rows so the owner can
--      map them explicitly.
--
-- Safety classification: ADDITIVE (one function re-created with its own body,
-- four grants; no table, column, constraint or row is touched)
-- Status: PENDING HUMAN CONFIRMATION
-- Deploy order: after docs/stock-reservations-01-migration.sql.
-- After running, run docs/VERIFY-stock-reservations-02-grants-and-scope.sql.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- A. Available-to-promise, now scoped by the same tenant rule as the writers.
--    The signature is unchanged, so callers and the row-level lock in
--    `stock_reserve` keep working.
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
  -- ⚠️ `workspace_id = p_workspace` IS THE TENANCY BOUNDARY, not a formality.
  -- Without it, a caller inside workspace A that knows workspace B's warehouse
  -- id reads B's on-hand quantity.
  SELECT quantity INTO v_on_hand
    FROM warehouse_stock
   WHERE warehouse_id = p_warehouse
     AND product_id = p_product
     AND workspace_id = p_workspace;
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
  'Available-to-promise: on hand minus active, unexpired reservations. Never counts a reservation as free. Both reads are scoped to p_workspace; an unowned stock row (workspace_id NULL) is not promiseable.';

-- ---------------------------------------------------------------------------
-- B. The server may execute the four functions; no client may.
--
--    GRANT and REVOKE are idempotent, so re-running this file is harmless.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.stock_available(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_available(uuid, uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.stock_reserve(uuid, uuid, uuid, uuid, numeric, text, uuid, text, timestamptz, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_reserve(uuid, uuid, uuid, uuid, numeric, text, uuid, text, timestamptz, uuid, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.stock_release_reservation(uuid, uuid, uuid, numeric, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_release_reservation(uuid, uuid, uuid, numeric, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.stock_settle_reservation(uuid, uuid, uuid, numeric, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_settle_reservation(uuid, uuid, uuid, numeric, text)
  TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- (see docs/VERIFY-stock-reservations-02-grants-and-scope.sql)

-- ============================================================================
-- ROLLBACK BLOCK (manual)
-- ============================================================================
--   -- Restore the stock-reservations-01 body (the unscoped read):
--   \i docs/stock-reservations-01-migration.sql
--   -- Remove the grants the backend needs:
--   REVOKE EXECUTE ON FUNCTION public.stock_available(uuid, uuid, uuid)                    FROM service_role;
--   REVOKE EXECUTE ON FUNCTION public.stock_reserve(uuid, uuid, uuid, uuid, numeric, text, uuid, text, timestamptz, uuid, text) FROM service_role;
--   REVOKE EXECUTE ON FUNCTION public.stock_release_reservation(uuid, uuid, uuid, numeric, text) FROM service_role;
--   REVOKE EXECUTE ON FUNCTION public.stock_settle_reservation(uuid, uuid, uuid, numeric, text) FROM service_role;
--
-- ⚠️ Rolling back A re-opens the cross-workspace read; rolling back B breaks
-- every server call. Roll back only to re-apply a corrected file.
-- ============================================================================
