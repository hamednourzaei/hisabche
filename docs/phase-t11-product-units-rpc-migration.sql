-- ============================================================================
-- T11 / L1 — the function that lets a product's unit set be edited.
--
-- `phase-l-02` created `product_units` and the conversion domain reads it.
-- Nothing could write it: no route, no service, no function. So the table was
-- empty in every workspace and multi-unit selling was unavailable in practice.
--
-- ---------------------------------------------------------------------------
-- ⚠️ WHY THIS IS A FUNCTION AND NOT TWO supabase-js CALLS
--
-- Replacing a set is DELETE-then-INSERT. supabase-js has no transactions, so
-- as two calls a failed insert leaves the product with NO units at all.
--
-- That state is worse than the one before the edit. `loadProductUnits` treats
-- «no rows» as «this product is single-unit», so a product that sells in
-- cartons of 24 would silently start reading «2 cartons» as 2 pieces — into
-- `stock_movements`, which is the source of truth for quantity. A failed edit
-- would corrupt inventory by a factor of 24 and nothing would report an error.
--
-- Inside one function both statements share a transaction: either the new set
-- is in place or the old one still is.
--
-- ---------------------------------------------------------------------------
-- ⚠️ THE SET RULES ARE RE-CHECKED HERE, NOT ONLY IN THE SERVICE
--
-- The service validates before calling. This validates again, because the
-- function is reachable by anything holding a database role and the rules it
-- protects are the ones that make a quantity deterministic:
--
--   exactly one base · the base factor is 1 · at most one default per side
--
-- The partial unique indexes from phase-l-02 would also catch a second base,
-- but as a 23505 with no explanation. A named refusal is actionable.
--
-- ---------------------------------------------------------------------------
-- ADDITIVE AND IDEMPOTENT. Creates one function. No table is created, no
-- column dropped, no existing row changed by the migration itself.
--
-- ROLLBACK / MITIGATION
--   DROP FUNCTION IF EXISTS product_units_replace(uuid, uuid, jsonb);
--
--   The product-units screen then fails with a clear error and every other
--   part of the product is unaffected — `product_units` is opt-in, so an
--   empty table means «every product is single-unit», which is the state
--   before L1 shipped.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION product_units_replace(
  p_workspace_id uuid,
  p_product_id   uuid,
  p_units        jsonb
)
RETURNS void
LANGUAGE plpgsql
-- ⚠️ SECURITY INVOKER, not DEFINER.
--
-- The caller is the backend's service role, which already has the rights it
-- needs. A DEFINER function here would run as its owner for EVERY caller, so
-- any role that could execute it would gain write access to every workspace's
-- product units — the `security_definer_view` mistake in function form.
SECURITY INVOKER
AS $$
DECLARE
  v_count            integer;
  v_bases            integer;
  v_bad_base_factor  integer;
  v_purchase         integer;
  v_sale             integer;
  v_bad_factor       integer;
  v_distinct_units   integer;
BEGIN
  IF p_workspace_id IS NULL OR p_product_id IS NULL THEN
    RAISE EXCEPTION 'UNIT_SET_ARGS_MISSING';
  END IF;

  -- The product must belong to the workspace being claimed. Without this the
  -- function would happily write units onto another shop's product, and that
  -- shop's quantities would then be read through them.
  IF NOT EXISTS (
    SELECT 1 FROM products
    WHERE  id = p_product_id AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'UNIT_SET_PRODUCT_NOT_IN_WORKSPACE';
  END IF;

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE (u->>'is_base_unit')::boolean),
         COUNT(*) FILTER (WHERE (u->>'is_base_unit')::boolean
                            AND (u->>'conversion_factor_to_base')::numeric <> 1),
         COUNT(*) FILTER (WHERE (u->>'is_purchase_default')::boolean),
         COUNT(*) FILTER (WHERE (u->>'is_sale_default')::boolean),
         COUNT(*) FILTER (WHERE (u->>'conversion_factor_to_base')::numeric <= 0),
         COUNT(DISTINCT (u->>'unit_id'))
    INTO v_count, v_bases, v_bad_base_factor, v_purchase, v_sale, v_bad_factor, v_distinct_units
    FROM jsonb_array_elements(COALESCE(p_units, '[]'::jsonb)) AS u;

  IF v_count > 0 THEN
    IF v_bases = 0 THEN RAISE EXCEPTION 'UNIT_SET_NO_BASE'; END IF;
    IF v_bases > 1 THEN RAISE EXCEPTION 'UNIT_SET_MULTIPLE_BASES'; END IF;
    IF v_bad_base_factor > 0 THEN RAISE EXCEPTION 'UNIT_SET_BASE_FACTOR_NOT_ONE'; END IF;
    IF v_bad_factor > 0 THEN RAISE EXCEPTION 'UNIT_SET_FACTOR_INVALID'; END IF;
    IF v_purchase > 1 THEN RAISE EXCEPTION 'UNIT_SET_MULTIPLE_PURCHASE_DEFAULTS'; END IF;
    IF v_sale > 1 THEN RAISE EXCEPTION 'UNIT_SET_MULTIPLE_SALE_DEFAULTS'; END IF;
    IF v_distinct_units <> v_count THEN RAISE EXCEPTION 'UNIT_SET_DUPLICATE_UNIT'; END IF;
  END IF;

  -- Both statements are in this function's transaction. A failure in the
  -- insert rolls the delete back with it, so the product keeps its old set
  -- rather than ending up with none.
  DELETE FROM product_units
  WHERE  workspace_id = p_workspace_id
    AND  product_id   = p_product_id;

  IF v_count > 0 THEN
    INSERT INTO product_units (
      workspace_id, product_id, unit_id,
      conversion_factor_to_base, is_base_unit, is_purchase_default, is_sale_default
    )
    SELECT p_workspace_id,
           p_product_id,
           (u->>'unit_id')::uuid,
           (u->>'conversion_factor_to_base')::numeric,
           (u->>'is_base_unit')::boolean,
           (u->>'is_purchase_default')::boolean,
           (u->>'is_sale_default')::boolean
      FROM jsonb_array_elements(p_units) AS u;
  END IF;
END;
$$;

COMMENT ON FUNCTION product_units_replace(uuid, uuid, jsonb) IS
  'T11/L1 - replace a product''s unit set atomically. DELETE+INSERT must share a transaction: a half-applied edit leaves the product with no units, which loadProductUnits reads as "single unit" - so a product sold in cartons of 24 would start recording 2 cartons as 2 pieces in stock_movements.';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
-- ============================================================================

-- 1. The function exists and is INVOKER, not DEFINER.
--    EXPECT: 1 row, security_definer = false
SELECT p.proname, p.prosecdef AS security_definer
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  p.proname = 'product_units_replace' AND n.nspname = 'public';

-- 2. The phase-l-02 guarantees are still in place.  EXPECT: 3 rows
SELECT indexname
FROM   pg_indexes
WHERE  tablename = 'product_units'
  AND  indexname IN (
         'product_units_one_base',
         'product_units_one_purchase_default',
         'product_units_one_sale_default'
       )
ORDER  BY indexname;

-- 3. ⚠️ Nothing was changed by running this.  EXPECT: whatever it was before
--    (0 on a database where L1 has never been used).
SELECT COUNT(*) AS product_unit_rows FROM product_units;

-- 4. Every existing row still satisfies "exactly one base per product".
--    EXPECT: 0
SELECT COUNT(*) AS products_without_exactly_one_base
FROM (
  SELECT product_id
  FROM   product_units
  GROUP  BY product_id
  HAVING COUNT(*) FILTER (WHERE is_base_unit) <> 1
) AS bad;
