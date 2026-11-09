-- ============================================================================
-- cycle-count-04 — open a stock count in ONE transaction (audit F-08, 8 Nov 2026).
--
-- WHY: CycleCountService.create inserted the header, then the lines, and on a
-- line failure DELETED the header — a compensating DELETE, forbidden here
-- (CLAUDE.md rule 4: supabase-js has no transactions; multi-table writes are
-- a Postgres function). If the DELETE also failed, an empty count sat in the
-- list forever.
--
-- WHAT: cycle_count_open(workspace, warehouse, user, notes, product ids)
--   · refuses a warehouse of another workspace (CYCLE_COUNT_WAREHOUSE_NOT_FOUND);
--   · reads each product's quantity IN THE SAME TRANSACTION and freezes it as
--     expected_qty — only products of this workspace (CYCLE_COUNT_NO_PRODUCTS
--     when none match);
--   · writes header + lines; any failure rolls both back.
--
-- Additive, idempotent (CREATE OR REPLACE), safe to run twice.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.cycle_count_open(
  p_workspace_id uuid,
  p_warehouse_id uuid,
  p_user_id uuid,
  p_notes text,
  p_product_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_count_id uuid;
  v_lines integer;
BEGIN
  IF p_product_ids IS NULL OR cardinality(p_product_ids) = 0 THEN
    RAISE EXCEPTION 'CYCLE_COUNT_NO_PRODUCTS';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM warehouses WHERE id = p_warehouse_id AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'CYCLE_COUNT_WAREHOUSE_NOT_FOUND';
  END IF;

  INSERT INTO cycle_counts (workspace_id, warehouse_id, status, created_by, notes)
  VALUES (p_workspace_id, p_warehouse_id, 'counting', p_user_id, p_notes)
  RETURNING id INTO v_count_id;

  -- counted_qty stays NULL: «not yet counted» is not «counted zero».
  INSERT INTO cycle_count_lines (workspace_id, count_id, product_id, expected_qty, counted_qty)
  SELECT p_workspace_id, v_count_id, p.id, COALESCE(p.quantity, 0), NULL
    FROM products p
   WHERE p.workspace_id = p_workspace_id
     AND p.id = ANY (SELECT DISTINCT unnest(p_product_ids));

  GET DIAGNOSTICS v_lines = ROW_COUNT;
  IF v_lines = 0 THEN
    -- Raising rolls back the header too: no empty count is ever left behind.
    RAISE EXCEPTION 'CYCLE_COUNT_NO_PRODUCTS';
  END IF;

  RETURN v_count_id;
END
$fn$;

REVOKE ALL ON FUNCTION public.cycle_count_open(uuid, uuid, uuid, text, uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cycle_count_open(uuid, uuid, uuid, text, uuid[])
  TO service_role;

COMMENT ON FUNCTION public.cycle_count_open(uuid, uuid, uuid, text, uuid[])
  IS 'cycle-count-04:rev1';

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION (the service falls back to its old path, with a log):
-- ============================================================================
/*
DROP FUNCTION IF EXISTS public.cycle_count_open(uuid, uuid, uuid, text, uuid[]);
*/
