-- ============================================================================
-- docs/sales-orders-02-migration.sql
--
-- V61 §2.4 — Complete Sales Order Lifecycle:
--   1. Quotation state (`quoted` + `quote_expires_at` + `quote_accepted_at`)
--   2. Atomic reservation on confirm via `stock_reserve(...)` in one RPC
--   3. Partial deliveries (`sales_order_deliveries` + `sales_order_delivery_lines`)
--      settling reservations and moving stock atomically
--   4. Cancel releases remaining active reservations via `stock_release_reservation`
--   5. Derived `partially_fulfilled` / `fulfilled` and per-line `delivered_quantity`
--
-- Additive, idempotent. Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

-- 1. Extend sales_orders status CHECK + quote columns + warehouse default
ALTER TABLE public.sales_orders
  DROP CONSTRAINT IF EXISTS sales_orders_status_check;

ALTER TABLE public.sales_orders
  ADD CONSTRAINT sales_orders_status_check
  CHECK (status IN ('quoted', 'pending', 'confirmed', 'partially_fulfilled', 'invoiced', 'paid', 'fulfilled', 'cancelled'));

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS quote_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS quote_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS warehouse_id uuid;

-- 2. Extend sales_order_items with delivered/reserved quantities
ALTER TABLE public.sales_order_items
  ADD COLUMN IF NOT EXISTS delivered_quantity numeric(18, 4) NOT NULL DEFAULT 0 CHECK (delivered_quantity >= 0),
  ADD COLUMN IF NOT EXISTS reserved_quantity numeric(18, 4) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  ADD COLUMN IF NOT EXISTS warehouse_id uuid;

-- 3. Append-only delivery documents + lines
CREATE TABLE IF NOT EXISTS public.sales_order_deliveries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  order_id          uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  warehouse_id      uuid NOT NULL,
  delivery_note_id  uuid,
  idempotency_key   text NOT NULL,
  actor_id          uuid,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sales_order_deliveries_idem_idx
  ON sales_order_deliveries (workspace_id, idempotency_key);
CREATE INDEX IF NOT EXISTS sales_order_deliveries_order_idx
  ON sales_order_deliveries (workspace_id, order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sales_order_delivery_lines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  delivery_id    uuid NOT NULL REFERENCES public.sales_order_deliveries(id) ON DELETE CASCADE,
  order_item_id  uuid NOT NULL REFERENCES public.sales_order_items(id) ON DELETE CASCADE,
  product_id     uuid NOT NULL,
  quantity       numeric(18, 4) NOT NULL CHECK (quantity > 0),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_order_delivery_lines_delivery_idx
  ON sales_order_delivery_lines (delivery_id);

-- RLS + strict privileges
ALTER TABLE sales_order_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_delivery_lines ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON sales_order_deliveries, public.sales_order_delivery_lines FROM PUBLIC, anon, authenticated;
GRANT SELECT ON sales_order_deliveries, public.sales_order_delivery_lines TO authenticated;
GRANT ALL ON sales_order_deliveries, public.sales_order_delivery_lines TO service_role;

DROP POLICY IF EXISTS sales_order_deliveries_members_read ON sales_order_deliveries;
CREATE POLICY sales_order_deliveries_members_read ON sales_order_deliveries
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspace_members m
                  WHERE m.workspace_id = sales_order_deliveries.workspace_id AND m.user_id = auth.uid()
                    AND m.has_access = true AND m.suspended_at IS NULL));

DROP POLICY IF EXISTS sales_order_delivery_lines_members_read ON sales_order_delivery_lines;
CREATE POLICY sales_order_delivery_lines_members_read ON sales_order_delivery_lines
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspace_members m
                  WHERE m.workspace_id = sales_order_delivery_lines.workspace_id AND m.user_id = auth.uid()
                    AND m.has_access = true AND m.suspended_at IS NULL));

-- 4. transition_sales_order rev2: atomic reservation on confirm, release on cancel, settle on invoice
CREATE OR REPLACE FUNCTION public.transition_sales_order(
  p_workspace_id     uuid,
  p_order_id         uuid,
  p_to               text,
  p_reason           text DEFAULT NULL,
  p_invoice_id       uuid DEFAULT NULL,
  p_customer_id      uuid DEFAULT NULL,
  p_actor            uuid DEFAULT NULL,
  p_warehouse_id     uuid DEFAULT NULL,
  p_allow_backorder  boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order       public.sales_orders%ROWTYPE;
  v_from        text;
  v_event       text;
  v_wh          uuid;
  v_line        record;
  v_res         record;
  v_avail       numeric;
  v_to_reserve  numeric;
BEGIN
  SELECT * INTO v_order
    FROM public.sales_orders
   WHERE id = p_order_id AND workspace_id = p_workspace_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  v_from := v_order.status;

  IF NOT (
       (v_from = 'quoted'              AND p_to IN ('pending', 'confirmed', 'cancelled'))
    OR (v_from = 'pending'             AND p_to IN ('confirmed', 'cancelled'))
    OR (v_from = 'confirmed'           AND p_to IN ('partially_fulfilled', 'fulfilled', 'invoiced', 'cancelled'))
    OR (v_from = 'partially_fulfilled' AND p_to IN ('partially_fulfilled', 'fulfilled', 'invoiced', 'cancelled'))
    OR (v_from = 'invoiced'            AND p_to IN ('paid', 'partially_fulfilled', 'fulfilled'))
    OR (v_from = 'paid'                AND p_to IN ('fulfilled', 'invoiced'))
  ) THEN
    RAISE EXCEPTION 'ORDER_TRANSITION_INVALID';
  END IF;

  IF v_from = 'quoted' AND p_to IN ('pending', 'confirmed') AND v_order.quote_expires_at IS NOT NULL AND v_order.quote_expires_at < now() THEN
    RAISE EXCEPTION 'ORDER_QUOTE_EXPIRED';
  END IF;

  IF p_to = 'invoiced' AND v_from IN ('confirmed', 'partially_fulfilled') AND p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_INVOICE_REQUIRED';
  END IF;

  -- Confirm: reserve stock atomically inside this transaction
  IF p_to = 'confirmed' AND v_from IN ('quoted', 'pending') THEN
    v_wh := COALESCE(p_warehouse_id, v_order.warehouse_id);
    IF v_wh IS NOT NULL THEN
      FOR v_line IN
        SELECT * FROM public.sales_order_items
         WHERE order_id = p_order_id AND workspace_id = p_workspace_id
         ORDER BY id
         FOR UPDATE
      LOOP
        v_to_reserve := GREATEST(0, v_line.quantity - v_line.delivered_quantity - v_line.reserved_quantity);
        IF v_to_reserve > 0 THEN
          IF p_allow_backorder THEN
            v_avail := public.stock_available(p_workspace_id, COALESCE(v_line.warehouse_id, v_wh), v_line.product_id);
            v_to_reserve := LEAST(v_to_reserve, GREATEST(0, COALESCE(v_avail, 0)));
          END IF;
          IF v_to_reserve > 0 THEN
            PERFORM public.stock_reserve(
              p_workspace_id,
              COALESCE(p_actor, v_order.created_by),
              COALESCE(v_line.warehouse_id, v_wh),
              v_line.product_id,
              v_to_reserve,
              'sales_order',
              p_order_id,
              'order-confirm:' || p_order_id::text || ':' || v_line.id::text,
              NULL,
              NULL,
              'Order ' || v_order.order_number
            );
            UPDATE public.sales_order_items
               SET reserved_quantity = reserved_quantity + v_to_reserve,
                   warehouse_id = COALESCE(warehouse_id, v_wh)
             WHERE id = v_line.id AND workspace_id = p_workspace_id;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Cancel: release only remaining active reservations
  IF p_to = 'cancelled' THEN
    FOR v_res IN
      SELECT id FROM public.stock_reservations
       WHERE workspace_id = p_workspace_id
         AND reference_type = 'sales_order'
         AND reference_id = p_order_id
         AND status = 'active'
       ORDER BY id
       FOR UPDATE
    LOOP
      PERFORM public.stock_release_reservation(
        p_workspace_id,
        COALESCE(p_actor, v_order.created_by),
        v_res.id,
        NULL,
        COALESCE(p_reason, 'Order cancelled')
      );
    END LOOP;
    UPDATE public.sales_order_items
       SET reserved_quantity = 0
     WHERE order_id = p_order_id AND workspace_id = p_workspace_id;
  END IF;

  -- Invoiced: settle any remaining active reservations
  IF p_to = 'invoiced' AND v_from IN ('confirmed', 'partially_fulfilled') THEN
    FOR v_res IN
      SELECT id FROM public.stock_reservations
       WHERE workspace_id = p_workspace_id
         AND reference_type = 'sales_order'
         AND reference_id = p_order_id
         AND status = 'active'
       ORDER BY id
       FOR UPDATE
    LOOP
      PERFORM public.stock_settle_reservation(
        p_workspace_id,
        COALESCE(p_actor, v_order.created_by),
        v_res.id,
        NULL,
        'Order invoiced'
      );
    END LOOP;
  END IF;

  UPDATE public.sales_orders SET
    status            = p_to,
    updated_at        = now(),
    expires_at        = NULL,
    warehouse_id      = COALESCE(p_warehouse_id, warehouse_id),
    quote_accepted_at = CASE WHEN v_from = 'quoted' AND p_to IN ('pending', 'confirmed') THEN now() ELSE quote_accepted_at END,
    confirmed_at      = CASE WHEN p_to = 'confirmed' THEN now() ELSE confirmed_at END,
    invoiced_at       = CASE WHEN p_to = 'invoiced' AND v_from IN ('confirmed', 'partially_fulfilled') THEN now() ELSE invoiced_at END,
    invoice_id        = CASE WHEN p_to = 'invoiced' AND v_from IN ('confirmed', 'partially_fulfilled') THEN p_invoice_id ELSE invoice_id END,
    customer_id       = COALESCE(p_customer_id, customer_id),
    paid_at           = CASE WHEN p_to = 'paid' THEN now() WHEN v_from = 'paid' AND p_to = 'invoiced' THEN NULL ELSE paid_at END,
    fulfilled_at      = CASE WHEN p_to = 'fulfilled' THEN now() ELSE fulfilled_at END,
    cancelled_at      = CASE WHEN p_to = 'cancelled' THEN now() ELSE cancelled_at END,
    cancel_reason     = CASE WHEN p_to = 'cancelled' THEN left(p_reason, 300) ELSE cancel_reason END
  WHERE id = p_order_id AND workspace_id = p_workspace_id;

  v_event := CASE
    WHEN v_from = 'paid' AND p_to = 'invoiced' THEN 'order.payment_reversed'
    ELSE 'order.' || p_to
  END;
  PERFORM public.emit_sales_order_event(p_workspace_id, p_order_id, v_event);
  RETURN p_to;
END;
$$;

-- 5. Partial delivery RPC: idempotent, locks order -> items -> stock -> reservations
CREATE OR REPLACE FUNCTION public.deliver_sales_order_partial(
  p_workspace_id     uuid,
  p_actor            uuid,
  p_order_id         uuid,
  p_warehouse_id     uuid,
  p_lines            jsonb,
  p_idempotency_key  text,
  p_delivery_note_id uuid DEFAULT NULL,
  p_notes            text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing      public.sales_order_deliveries%ROWTYPE;
  v_order         public.sales_orders%ROWTYPE;
  v_delivery_id   uuid;
  v_elem          jsonb;
  v_item_id       uuid;
  v_qty           numeric;
  v_item          public.sales_order_items%ROWTYPE;
  v_res           record;
  v_to_settle     numeric;
  v_settle_chunk  numeric;
  v_new_status    text;
  v_all_delivered boolean;
BEGIN
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'ORDER_DELIVERY_IDEMPOTENCY_REQUIRED';
  END IF;

  SELECT * INTO v_existing
    FROM public.sales_order_deliveries
   WHERE workspace_id = p_workspace_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'already_delivered',
      'delivery_id', v_existing.id,
      'order_id', v_existing.order_id
    );
  END IF;

  SELECT * INTO v_order
    FROM public.sales_orders
   WHERE id = p_order_id AND workspace_id = p_workspace_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_order.status NOT IN ('confirmed', 'partially_fulfilled', 'invoiced', 'paid') THEN
    RAISE EXCEPTION 'ORDER_TRANSITION_INVALID';
  END IF;

  INSERT INTO public.sales_order_deliveries (
    workspace_id, order_id, warehouse_id, delivery_note_id, idempotency_key, actor_id, notes
  ) VALUES (
    p_workspace_id, p_order_id, p_warehouse_id, p_delivery_note_id, p_idempotency_key, p_actor, p_notes
  ) RETURNING id INTO v_delivery_id;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_item_id := (v_elem ->> 'orderItemId')::uuid;
    v_qty := (v_elem ->> 'quantity')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'ORDER_DELIVERY_INVALID_QUANTITY';
    END IF;

    SELECT * INTO v_item
      FROM public.sales_order_items
     WHERE id = v_item_id AND order_id = p_order_id AND workspace_id = p_workspace_id
     FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_ITEM_NOT_FOUND'; END IF;

    IF v_item.delivered_quantity + v_qty > v_item.quantity THEN
      RAISE EXCEPTION 'ORDER_DELIVERY_EXCEEDS_ORDERED';
    END IF;

    -- Move stock out of warehouse_stock
    UPDATE public.warehouse_stock
       SET quantity = quantity - v_qty
     WHERE workspace_id = p_workspace_id
       AND warehouse_id = p_warehouse_id
       AND product_id = v_item.product_id
       AND quantity >= v_qty;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK';
    END IF;

    INSERT INTO public.stock_movements (
      workspace_id, product_id, type, quantity, reference_type, reference_id, notes, user_id, from_warehouse_id
    ) VALUES (
      p_workspace_id, v_item.product_id, 'sale_delivery', -v_qty, 'sales_order_delivery', v_delivery_id, p_notes, COALESCE(p_actor, v_order.created_by, p_workspace_id), p_warehouse_id
    );

    -- Settle active reservations up to delivered quantity
    v_to_settle := LEAST(v_qty, v_item.reserved_quantity);
    IF v_to_settle > 0 THEN
      FOR v_res IN
        SELECT * FROM public.stock_reservations
         WHERE workspace_id = p_workspace_id
           AND reference_type = 'sales_order'
           AND reference_id = p_order_id
           AND product_id = v_item.product_id
           AND status = 'active'
         ORDER BY id
         FOR UPDATE
      LOOP
        EXIT WHEN v_to_settle <= 0;
        v_settle_chunk := LEAST(v_to_settle, v_res.quantity);
        IF v_settle_chunk > 0 THEN
          PERFORM public.stock_settle_reservation(
            p_workspace_id,
            p_actor,
            v_res.id,
            CASE WHEN v_settle_chunk = v_res.quantity THEN NULL ELSE v_settle_chunk END,
            'Partial delivery ' || v_delivery_id::text
          );
          v_to_settle := v_to_settle - v_settle_chunk;
        END IF;
      END LOOP;
    END IF;

    UPDATE public.sales_order_items
       SET delivered_quantity = delivered_quantity + v_qty,
           reserved_quantity = GREATEST(0, reserved_quantity - LEAST(v_qty, reserved_quantity))
     WHERE id = v_item.id AND workspace_id = p_workspace_id;

    INSERT INTO public.sales_order_delivery_lines (
      workspace_id, delivery_id, order_item_id, product_id, quantity
    ) VALUES (
      p_workspace_id, v_delivery_id, v_item.id, v_item.product_id, v_qty
    );
  END LOOP;

  SELECT bool_and(delivered_quantity >= quantity)
    INTO v_all_delivered
    FROM public.sales_order_items
   WHERE order_id = p_order_id AND workspace_id = p_workspace_id;

  v_new_status := CASE WHEN COALESCE(v_all_delivered, false) THEN 'fulfilled' ELSE 'partially_fulfilled' END;

  UPDATE public.sales_orders
     SET status = v_new_status,
         fulfilled_at = CASE WHEN v_new_status = 'fulfilled' THEN now() ELSE fulfilled_at END,
         updated_at = now()
   WHERE id = p_order_id AND workspace_id = p_workspace_id;

  PERFORM public.emit_sales_order_event(p_workspace_id, p_order_id, 'order.' || v_new_status);

  RETURN jsonb_build_object(
    'status', 'delivered',
    'delivery_id', v_delivery_id,
    'order_id', p_order_id,
    'order_status', v_new_status
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transition_sales_order(uuid, uuid, text, text, uuid, uuid, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_sales_order(uuid, uuid, text, text, uuid, uuid, uuid, uuid, boolean) TO service_role;

REVOKE EXECUTE ON FUNCTION public.deliver_sales_order_partial(uuid, uuid, uuid, uuid, jsonb, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deliver_sales_order_partial(uuid, uuid, uuid, uuid, jsonb, text, uuid, text) TO service_role;

-- Rollback (manual reference):
-- DROP FUNCTION IF EXISTS public.deliver_sales_order_partial(uuid, uuid, uuid, uuid, jsonb, text, uuid, text);
-- DROP TABLE IF EXISTS public.sales_order_delivery_lines;
-- DROP TABLE IF EXISTS public.sales_order_deliveries;
