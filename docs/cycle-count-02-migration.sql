-- ============================================================================
-- docs/cycle-count-02-migration.sql
--
-- A cycle count may adjust a product's stock ONCE.
--
-- Why: CycleCountService.complete() writes the ADJUSTMENT movements and only
-- afterwards closes the count. Two simultaneous completions (a double click, a
-- retry after a timeout) could both pass the "already applied?" read and both
-- write — the shelf corrected twice. The service now skips products that
-- already have a movement for the count; this index is the database's own
-- refusal, so the race cannot produce a second row even when two requests read
-- at the same instant. The service treats the unique violation (23505) as
-- «already applied».
--
-- ADDITIVE and IDEMPOTENT: one partial unique index, re-runnable. It touches no
-- row. If duplicates ALREADY exist the migration stops with an exception and
-- changes nothing — it never deletes or rewrites a movement (a stock movement
-- is the source of truth for quantity). Run docs/VERIFY-cycle-count-02.sql
-- afterwards; «Success. No rows returned» is NOT a pass.
--
-- Rollback / mitigation (forward-only is safe; both objects only restrict or wrap):
--   DROP FUNCTION IF EXISTS public.cycle_count_complete(uuid, uuid, uuid, jsonb, numeric, numeric, numeric);
--   DROP INDEX IF EXISTS stock_movements_cycle_count_once_idx;
--
-- It also adds cycle_count_complete(): the count's adjustments, its frozen figures
-- and its status change in ONE database transaction. supabase-js has no
-- transaction, so the service used to write the movements and the status in
-- separate requests; a crash between them left stock moved and the count open.
-- The function is what makes completion atomic. It prices nothing — the service
-- prices the lines with stock-count.domain.ts (and the costing core) and passes
-- the result in.
-- ============================================================================

-- No BEGIN/COMMIT on purpose: a script sent as ONE simple query already runs as a single
-- implicit transaction, so the guard below aborts the whole script and leaves nothing behind —
-- and a failed run cannot leave a connection stuck in an aborted transaction.

DO $guard$
DECLARE
  v_duplicates integer;
BEGIN
  SELECT count(*) INTO v_duplicates
    FROM (
      SELECT 1
        FROM stock_movements
       WHERE reference_type = 'cycle_count'
       GROUP BY workspace_id, reference_id, product_id
      HAVING count(*) > 1
    ) d;

  IF v_duplicates > 0 THEN
    RAISE EXCEPTION
      'CYCLE_COUNT_DUPLICATE_MOVEMENTS: % (count, product) pair(s) already have more than one adjustment movement. Nothing was changed. Review them by hand (they are real stock history) before re-running.',
      v_duplicates;
  END IF;
END
$guard$;

CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_cycle_count_once_idx
  ON stock_movements (workspace_id, reference_id, product_id)
  WHERE reference_type = 'cycle_count';

COMMENT ON INDEX stock_movements_cycle_count_once_idx IS
  'cycle-count-02: a cycle count adjusts a product''s stock once. Partial: only reference_type = cycle_count.';

-- ---------------------------------------------------------------------------
-- cycle_count_complete — one transaction: movements + frozen figures + status.
--
--   p_lines: [{ "product_id": uuid, "variance_qty": number, "variance_value": number }, ...]
--            every COUNTED line (a line with variance 0 is listed so its figures
--            are frozen too; it produces no movement).
--
-- Returns 'completed' | 'not_open' | 'not_found'. Any other failure raises and
-- rolls the whole thing back, so there is never a half-completed count.
-- The row lock makes two simultaneous completions run one after the other; the
-- second finds the count already 'completed' and returns 'not_open'.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cycle_count_complete(
  p_workspace_id uuid,
  p_count_id uuid,
  p_user_id uuid,
  p_lines jsonb,
  p_shortage_value numeric,
  p_surplus_value numeric,
  p_net_loss numeric
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_status text;
  v_warehouse uuid;
BEGIN
  SELECT status, warehouse_id INTO v_status, v_warehouse
    FROM cycle_counts
   WHERE id = p_count_id AND workspace_id = p_workspace_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF v_status <> 'counting' THEN
    RETURN 'not_open';
  END IF;

  INSERT INTO stock_movements (
    workspace_id, product_id, type, quantity,
    reference_type, reference_id, to_warehouse_id, user_id, notes
  )
  SELECT p_workspace_id, l.product_id, 'adjustment', l.variance_qty,
         'cycle_count', p_count_id, v_warehouse, p_user_id,
         'count variance ' || l.variance_qty::text
    FROM jsonb_to_recordset(p_lines) AS l(product_id uuid, variance_qty numeric, variance_value numeric)
   WHERE l.variance_qty <> 0
  ON CONFLICT (workspace_id, reference_id, product_id) WHERE reference_type = 'cycle_count'
  DO NOTHING;

  UPDATE cycle_count_lines AS cl
     SET variance_qty = l.variance_qty,
         variance_value = l.variance_value
    FROM jsonb_to_recordset(p_lines) AS l(product_id uuid, variance_qty numeric, variance_value numeric)
   WHERE cl.count_id = p_count_id
     AND cl.workspace_id = p_workspace_id
     AND cl.product_id = l.product_id;

  UPDATE cycle_counts
     SET status = 'completed',
         completed_by = p_user_id,
         completed_at = now(),
         shortage_value = p_shortage_value,
         surplus_value = p_surplus_value,
         net_loss = p_net_loss,
         updated_at = now()
   WHERE id = p_count_id AND workspace_id = p_workspace_id;

  RETURN 'completed';
END
$fn$;

REVOKE ALL ON FUNCTION public.cycle_count_complete(uuid, uuid, uuid, jsonb, numeric, numeric, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cycle_count_complete(uuid, uuid, uuid, jsonb, numeric, numeric, numeric)
  TO service_role;

COMMENT ON FUNCTION public.cycle_count_complete(uuid, uuid, uuid, jsonb, numeric, numeric, numeric)
  IS 'cycle-count-02:rev1';
