-- ============================================================================
-- docs/bundles-consignment-commission-02-migration.sql
--
-- V61 audit (12 Nov 2026) — a bundle's components are saved in ONE transaction.
--
-- Before: `setBundleItems` did three separate supabase-js calls — mark the
-- product a bundle, DELETE every component, INSERT the new list — ignored the
-- first two errors, and never checked that a component belonged to the same
-- business. A failed insert left a «bundle» with no components (CLAUDE.md
-- rule 4: no compensating DELETE across calls).
--
-- After: `product_bundle_set_items` locks the bundle product, proves every
-- component is this workspace's own product, refuses a component that is
-- itself a bundle and a bundle that is a component of another (no nesting, so
-- no cycles), then replaces the list and sets `products.kind` together.
-- An empty list turns the product back into a standard one.
--
-- Additive, idempotent, safe to run twice.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- (docs/VERIFY-bundles-consignment-commission-02.sql).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.product_bundle_set_items(
  p_workspace_id uuid,
  p_bundle_product_id uuid,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_component uuid;
  v_quantity numeric;
  v_seen uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_workspace_id IS NULL OR p_bundle_product_id IS NULL OR p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'BUNDLE_ARGUMENTS_REQUIRED' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.products
   WHERE id = p_bundle_product_id AND workspace_id = p_workspace_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BUNDLE_PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF jsonb_array_length(p_items) > 0 AND EXISTS (
    SELECT 1 FROM public.bundle_items
     WHERE workspace_id = p_workspace_id AND component_product_id = p_bundle_product_id
  ) THEN
    RAISE EXCEPTION 'BUNDLE_PRODUCT_IS_COMPONENT' USING ERRCODE = '23514';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_component := NULLIF(v_item->>'component_product_id', '')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    IF v_component IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'BUNDLE_ITEM_INVALID' USING ERRCODE = '22023';
    END IF;
    IF v_component = p_bundle_product_id THEN
      RAISE EXCEPTION 'BUNDLE_COMPONENT_IS_SELF' USING ERRCODE = '23514';
    END IF;
    IF v_component = ANY (v_seen) THEN
      RAISE EXCEPTION 'BUNDLE_COMPONENT_DUPLICATE' USING ERRCODE = '23505';
    END IF;
    v_seen := v_seen || v_component;

    PERFORM 1 FROM public.products
     WHERE id = v_component AND workspace_id = p_workspace_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'BUNDLE_COMPONENT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.products
       WHERE id = v_component AND workspace_id = p_workspace_id AND kind = 'bundle'
    ) THEN
      RAISE EXCEPTION 'BUNDLE_COMPONENT_IS_BUNDLE' USING ERRCODE = '23514';
    END IF;
  END LOOP;

  -- Inside one transaction: replacing the list is not a compensating delete.
  DELETE FROM public.bundle_items
   WHERE workspace_id = p_workspace_id AND bundle_product_id = p_bundle_product_id;

  INSERT INTO public.bundle_items (workspace_id, bundle_product_id, component_product_id, quantity)
  SELECT p_workspace_id,
         p_bundle_product_id,
         (e->>'component_product_id')::uuid,
         (e->>'quantity')::numeric
    FROM jsonb_array_elements(p_items) AS e;

  UPDATE public.products
     SET kind = CASE WHEN jsonb_array_length(p_items) > 0 THEN 'bundle' ELSE 'standard' END,
         updated_at = now()
   WHERE id = p_bundle_product_id AND workspace_id = p_workspace_id;

  RETURN COALESCE(
    (SELECT jsonb_agg(to_jsonb(b) ORDER BY b.created_at, b.id)
       FROM public.bundle_items b
      WHERE b.workspace_id = p_workspace_id AND b.bundle_product_id = p_bundle_product_id),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.product_bundle_set_items(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_bundle_set_items(uuid, uuid, jsonb) TO service_role;

CREATE INDEX IF NOT EXISTS bundle_items_component_idx
  ON public.bundle_items (workspace_id, component_product_id);

COMMIT;

-- ----------------------------------------------------------------------------
-- Rollback / Mitigation (manual):
--   DROP FUNCTION IF EXISTS public.product_bundle_set_items(uuid, uuid, jsonb);
--   DROP INDEX IF EXISTS public.bundle_items_component_idx;
-- Without the function the backend answers 503 BUNDLE_SAVE_NOT_INSTALLED; it
-- never falls back to the old delete-then-insert.
-- ----------------------------------------------------------------------------
