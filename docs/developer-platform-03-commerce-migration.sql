-- ============================================================================
-- DEVELOPER PLATFORM 03 — publishable keys, storefront settings, sales orders.
-- Additive, idempotent, re-runnable. Requires docs/developer-platform-migration.sql.
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then docs/VERIFY-developer-platform-03.sql.
-- Status: PENDING HUMAN CONFIRMATION.
--
-- Until it runs: the public storefront API and the orders screen answer
-- «not configured» (503). Nothing that exists today changes.
--
-- ---------------------------------------------------------------------------
-- THE SECURITY CONTRACT (agreed 27 Sep 2026)
--
--   · A publishable key (hk_pub_…) is public by design — it sits in a
--     website's HTML. It can read the catalogue, read availability, and create
--     a PENDING order. Nothing else. It can never become a secret key: the two
--     have different prefixes, and a lookup by one's hash can never match the
--     other.
--   · The browser sends product ids, quantities and contact details. PRICES,
--     TOTALS AND STOCK ARE READ BY THIS DATABASE FROM ITS OWN ROWS inside
--     create_sales_order. There is no parameter through which a caller could
--     pass an amount.
--   · Nothing in this file writes the ledger or moves stock. An order moves
--     stock only when it is INVOICED, through the existing invoice path.
--
-- THE LIFECYCLE — every change is one function call, one transaction, and the
-- only place order.* events are emitted:
--
--   pending ──► confirmed ──► invoiced ──► paid ──► fulfilled
--      │            │              │         │
--      └──► cancelled ◄┘           └──► fulfilled (delivered before paid)
--                                          paid ──► invoiced (payment reversed)
--
--   invoiced ↔ paid follow the INVOICE: a trigger on invoices.status moves the
--   order when the receivables projection marks its invoice paid, or unpaid
--   again after a reversal. A person cannot set «paid» by hand.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.api_keys') IS NULL OR to_regprocedure('public.enqueue_webhook_event(uuid, uuid, text, jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Run docs/developer-platform-migration.sql first.';
  END IF;
END $$;

-- ─── Publishable keys: a kind of api_keys row, not a second key table (G2) ───

ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'secret';
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS public_token text;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS allowed_origins text[] NOT NULL DEFAULT '{}';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_kind_check') THEN
    ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_kind_check CHECK (kind IN ('secret', 'publishable'));
  END IF;
  -- The plain text is kept ONLY for a publishable key (it is public anyway, and
  -- the owner must be able to copy it again). A secret key never has one.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_public_token_only_publishable') THEN
    ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_public_token_only_publishable
      CHECK ((kind = 'publishable') = (public_token IS NOT NULL));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS api_keys_public_token_idx ON public.api_keys (public_token) WHERE public_token IS NOT NULL;

-- ─── Storefront settings: one row per workspace, every value has a default (G4)

CREATE TABLE IF NOT EXISTS public.storefront_settings (
  workspace_id             uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  -- A website order waits for a person unless the owner says otherwise.
  order_confirmation       text NOT NULL DEFAULT 'manual' CHECK (order_confirmation IN ('manual', 'automatic')),
  -- The site shows «in stock / out of stock» unless the owner opts into numbers.
  stock_display            text NOT NULL DEFAULT 'availability' CHECK (stock_display IN ('availability', 'quantity')),
  pending_expiry_hours     integer NOT NULL DEFAULT 48 CHECK (pending_expiry_hours BETWEEN 1 AND 720),
  max_items_per_order      integer NOT NULL DEFAULT 50 CHECK (max_items_per_order BETWEEN 1 AND 200),
  max_pending_per_contact  integer NOT NULL DEFAULT 5 CHECK (max_pending_per_contact BETWEEN 1 AND 100),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- ─── Sales orders ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sales_orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  order_number     text NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'confirmed', 'invoiced', 'paid', 'fulfilled', 'cancelled')),
  source           text NOT NULL CHECK (source IN ('website', 'api', 'dashboard')),
  api_key_id       uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  idempotency_key  text,
  customer_name    text NOT NULL CHECK (char_length(customer_name) BETWEEN 1 AND 120),
  customer_phone   text NOT NULL CHECK (char_length(customer_phone) BETWEEN 5 AND 32),
  customer_email   text CHECK (customer_email IS NULL OR char_length(customer_email) <= 200),
  customer_note    text CHECK (customer_note IS NULL OR char_length(customer_note) <= 500),
  customer_id      uuid,
  -- Exact decimals of the same type as products.sell_price, computed HERE.
  total            numeric(18, 4) NOT NULL CHECK (total >= 0),
  invoice_id       uuid,
  -- For the customer's own status page; unguessable, never the id.
  public_token     text NOT NULL UNIQUE,
  cancel_reason    text,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz,
  confirmed_at     timestamptz,
  invoiced_at      timestamptz,
  paid_at          timestamptz,
  fulfilled_at     timestamptz,
  cancelled_at     timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS sales_orders_idempotency_idx
  ON public.sales_orders (workspace_id, source, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS sales_orders_workspace_idx ON public.sales_orders (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_orders_invoice_idx ON public.sales_orders (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sales_orders_pending_idx ON public.sales_orders (expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS sales_orders_contact_idx ON public.sales_orders (workspace_id, customer_phone) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL,
  product_name  text NOT NULL,
  unit          text,
  quantity      numeric(18, 4) NOT NULL CHECK (quantity > 0),
  unit_price    numeric(18, 4) NOT NULL CHECK (unit_price >= 0),
  line_total    numeric(18, 4) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS sales_order_items_order_idx ON public.sales_order_items (order_id);

-- ─── RLS: members read their workspace's orders; nobody writes directly ─────

ALTER TABLE storefront_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.storefront_settings, public.sales_orders, public.sales_order_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.storefront_settings, public.sales_orders, public.sales_order_items TO authenticated;
GRANT ALL ON public.storefront_settings, public.sales_orders, public.sales_order_items TO service_role;

DROP POLICY IF EXISTS storefront_settings_members_read ON storefront_settings;
CREATE POLICY storefront_settings_members_read ON storefront_settings
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members m
                  WHERE m.workspace_id = storefront_settings.workspace_id AND m.user_id = auth.uid()
                    AND m.has_access = true AND m.suspended_at IS NULL));

DROP POLICY IF EXISTS sales_orders_members_read ON sales_orders;
CREATE POLICY sales_orders_members_read ON sales_orders
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members m
                  WHERE m.workspace_id = sales_orders.workspace_id AND m.user_id = auth.uid()
                    AND m.has_access = true AND m.suspended_at IS NULL));

DROP POLICY IF EXISTS sales_order_items_members_read ON sales_order_items;
CREATE POLICY sales_order_items_members_read ON sales_order_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members m
                  WHERE m.workspace_id = sales_order_items.workspace_id AND m.user_id = auth.uid()
                    AND m.has_access = true AND m.suspended_at IS NULL));

-- ─── Events ──────────────────────────────────────────────────────────────────

-- The envelope buildEnvelope() writes (developer.domain.ts), field for field.
CREATE OR REPLACE FUNCTION public.emit_sales_order_event(p_workspace_id uuid, p_order_id uuid, p_type text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  PERFORM public.enqueue_webhook_event(
    p_workspace_id, v_id, p_type,
    jsonb_build_object(
      'id', v_id,
      'type', p_type,
      'createdAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'workspaceId', p_workspace_id,
      'data', jsonb_build_object('resource', 'sales_order', 'id', p_order_id),
      'apiVersion', 1
    )
  );
END;
$$;

-- ─── Create: the ONLY way an order comes into existence ─────────────────────
--
-- Errors are raised with a stable code as the message and SQLSTATE P0001; the
-- service maps them to 4xx. Returns { order_id, replay }.
CREATE OR REPLACE FUNCTION public.create_sales_order(
  p_workspace_id uuid,
  p_source       text,
  p_api_key_id   uuid,
  p_idempotency  text,
  p_customer     jsonb,
  p_items        jsonb,
  p_created_by   uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_settings  public.storefront_settings;
  v_order_id  uuid;
  v_existing  uuid;
  v_phone     text := btrim(COALESCE(p_customer ->> 'phone', ''));
  v_name      text := btrim(COALESCE(p_customer ->> 'name', ''));
  v_count     integer;
  v_pending   integer;
  v_line      record;
  v_total     numeric(18, 4) := 0;
  v_auto      boolean;
BEGIN
  IF p_source NOT IN ('website', 'api', 'dashboard') THEN
    RAISE EXCEPTION 'ORDER_SOURCE_INVALID';
  END IF;

  -- A replay returns the order the first request created, and writes nothing.
  IF p_idempotency IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.sales_orders
     WHERE workspace_id = p_workspace_id AND source = p_source AND idempotency_key = p_idempotency;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('order_id', v_existing, 'replay', true);
    END IF;
  END IF;

  SELECT * INTO v_settings FROM public.storefront_settings WHERE workspace_id = p_workspace_id;
  IF NOT FOUND THEN
    v_settings.order_confirmation := 'manual';
    v_settings.pending_expiry_hours := 48;
    v_settings.max_items_per_order := 50;
    v_settings.max_pending_per_contact := 5;
  END IF;

  IF v_name = '' THEN RAISE EXCEPTION 'ORDER_CUSTOMER_NAME_REQUIRED'; END IF;
  IF char_length(v_phone) < 5 THEN RAISE EXCEPTION 'ORDER_CUSTOMER_PHONE_REQUIRED'; END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ORDER_ITEMS_REQUIRED';
  END IF;
  IF jsonb_array_length(p_items) > v_settings.max_items_per_order THEN
    RAISE EXCEPTION 'ORDER_TOO_MANY_ITEMS';
  END IF;

  -- Throttle per contact: a public endpoint must not be a way to fill the
  -- owner's queue.
  SELECT count(*) INTO v_pending FROM public.sales_orders
   WHERE workspace_id = p_workspace_id AND status = 'pending' AND customer_phone = v_phone;
  IF v_pending >= v_settings.max_pending_per_contact THEN
    RAISE EXCEPTION 'ORDER_TOO_MANY_PENDING';
  END IF;

  v_order_id := gen_random_uuid();
  v_auto := p_source = 'website' AND v_settings.order_confirmation = 'automatic';

  INSERT INTO public.sales_orders (
    id, workspace_id, order_number, status, source, api_key_id, idempotency_key,
    customer_name, customer_phone, customer_email, customer_note,
    total, public_token, created_by, expires_at, confirmed_at
  ) VALUES (
    v_order_id, p_workspace_id,
    'SO-' || to_char(now() AT TIME ZONE 'UTC', 'YYMMDD') || '-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 6)),
    CASE WHEN v_auto THEN 'confirmed' ELSE 'pending' END,
    p_source, p_api_key_id, p_idempotency,
    left(v_name, 120), left(v_phone, 32),
    NULLIF(left(btrim(COALESCE(p_customer ->> 'email', '')), 200), ''),
    NULLIF(left(btrim(COALESCE(p_customer ->> 'note', '')), 500), ''),
    0,
    replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    p_created_by,
    CASE WHEN v_auto THEN NULL ELSE now() + make_interval(hours => v_settings.pending_expiry_hours) END,
    CASE WHEN v_auto THEN now() END
  );

  -- Lines: duplicates merged, every product of THIS workspace, active, priced,
  -- and with the stock to cover the quantity. Price and name come from the row.
  FOR v_line IN
    SELECT (i ->> 'productId')::uuid AS product_id, sum((i ->> 'quantity')::numeric) AS quantity
      FROM jsonb_array_elements(p_items) AS i
     GROUP BY 1
  LOOP
    IF v_line.quantity IS NULL OR v_line.quantity <= 0 THEN
      RAISE EXCEPTION 'ORDER_QUANTITY_INVALID';
    END IF;
    PERFORM 1 FROM public.products p
      WHERE p.id = v_line.product_id AND p.workspace_id = p_workspace_id AND COALESCE(p.is_active, true);
    IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_PRODUCT_NOT_FOUND'; END IF;

    INSERT INTO public.sales_order_items (order_id, workspace_id, product_id, product_name, unit, quantity, unit_price, line_total)
    SELECT v_order_id, p_workspace_id, p.id, p.name, p.unit, v_line.quantity,
           p.sell_price, round(p.sell_price * v_line.quantity, 4)
      FROM public.products p
     WHERE p.id = v_line.product_id
       AND COALESCE(p.sell_price, 0) > 0
       AND COALESCE(p.quantity, 0) >= v_line.quantity;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      IF (SELECT COALESCE(sell_price, 0) FROM public.products WHERE id = v_line.product_id) <= 0 THEN
        RAISE EXCEPTION 'ORDER_PRODUCT_NOT_PRICED';
      END IF;
      RAISE EXCEPTION 'ORDER_INSUFFICIENT_STOCK';
    END IF;
  END LOOP;

  SELECT COALESCE(sum(line_total), 0) INTO v_total FROM public.sales_order_items WHERE order_id = v_order_id;
  UPDATE public.sales_orders SET total = v_total WHERE id = v_order_id;

  PERFORM public.emit_sales_order_event(p_workspace_id, v_order_id, 'order.created');
  IF v_auto THEN
    PERFORM public.emit_sales_order_event(p_workspace_id, v_order_id, 'order.confirmed');
  END IF;

  RETURN jsonb_build_object('order_id', v_order_id, 'replay', false);
EXCEPTION
  -- Two identical requests at the same instant: the loser answers with the
  -- winner's order, as a replay.
  WHEN unique_violation THEN
    SELECT id INTO v_existing FROM public.sales_orders
     WHERE workspace_id = p_workspace_id AND source = p_source AND idempotency_key = p_idempotency;
    IF v_existing IS NULL THEN RAISE; END IF;
    RETURN jsonb_build_object('order_id', v_existing, 'replay', true);
END;
$$;

-- ─── Transitions ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.transition_sales_order(
  p_workspace_id uuid,
  p_order_id     uuid,
  p_to           text,
  p_reason       text DEFAULT NULL,
  p_invoice_id   uuid DEFAULT NULL,
  p_customer_id  uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_from  text;
  v_event text;
BEGIN
  SELECT status INTO v_from FROM public.sales_orders
   WHERE id = p_order_id AND workspace_id = p_workspace_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

  IF NOT (
       (v_from = 'pending'   AND p_to IN ('confirmed', 'cancelled'))
    OR (v_from = 'confirmed' AND p_to IN ('invoiced', 'cancelled'))
    OR (v_from = 'invoiced'  AND p_to IN ('paid', 'fulfilled'))
    OR (v_from = 'paid'      AND p_to IN ('fulfilled', 'invoiced'))
  ) THEN
    RAISE EXCEPTION 'ORDER_TRANSITION_INVALID';
  END IF;

  IF p_to = 'invoiced' AND v_from = 'confirmed' AND p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_INVOICE_REQUIRED';
  END IF;

  UPDATE public.sales_orders SET
    status       = p_to,
    updated_at   = now(),
    expires_at   = NULL,
    confirmed_at = CASE WHEN p_to = 'confirmed' THEN now() ELSE confirmed_at END,
    invoiced_at  = CASE WHEN p_to = 'invoiced' AND v_from = 'confirmed' THEN now() ELSE invoiced_at END,
    invoice_id   = CASE WHEN p_to = 'invoiced' AND v_from = 'confirmed' THEN p_invoice_id ELSE invoice_id END,
    customer_id  = COALESCE(p_customer_id, customer_id),
    paid_at      = CASE WHEN p_to = 'paid' THEN now() WHEN v_from = 'paid' AND p_to = 'invoiced' THEN NULL ELSE paid_at END,
    fulfilled_at = CASE WHEN p_to = 'fulfilled' THEN now() ELSE fulfilled_at END,
    cancelled_at = CASE WHEN p_to = 'cancelled' THEN now() ELSE cancelled_at END,
    cancel_reason = CASE WHEN p_to = 'cancelled' THEN left(p_reason, 300) ELSE cancel_reason END
  WHERE id = p_order_id;

  v_event := CASE
    WHEN v_from = 'paid' AND p_to = 'invoiced' THEN 'order.payment_reversed'
    ELSE 'order.' || p_to
  END;
  PERFORM public.emit_sales_order_event(p_workspace_id, p_order_id, v_event);
  RETURN p_to;
END;
$$;

-- invoiced ↔ paid follow the invoice. Never able to fail the payment.
CREATE OR REPLACE FUNCTION public.sales_order_follows_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order record;
BEGIN
  FOR v_order IN
    SELECT id, workspace_id, status FROM public.sales_orders WHERE invoice_id = NEW.id
  LOOP
    BEGIN
      IF NEW.status = 'paid' AND v_order.status = 'invoiced' THEN
        PERFORM public.transition_sales_order(v_order.workspace_id, v_order.id, 'paid');
      ELSIF OLD.status = 'paid' AND NEW.status <> 'paid' AND v_order.status = 'paid' THEN
        PERFORM public.transition_sales_order(v_order.workspace_id, v_order.id, 'invoiced');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'sales_order_follows_invoice: % (%)', SQLERRM, SQLSTATE;
    END;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_order_follows_invoice_trg ON public.invoices;
CREATE TRIGGER sales_order_follows_invoice_trg
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sales_order_follows_invoice();

-- Pending orders nobody confirmed in time are cancelled, with the reason.
CREATE OR REPLACE FUNCTION public.expire_pending_sales_orders()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_count integer := 0;
BEGIN
  FOR v_order IN
    SELECT id, workspace_id FROM public.sales_orders
     WHERE status = 'pending' AND expires_at < now()
     ORDER BY expires_at
     LIMIT 500
     FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.transition_sales_order(v_order.workspace_id, v_order.id, 'cancelled', 'EXPIRED');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ─── Grants ──────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.emit_sales_order_event(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_sales_order(uuid, text, uuid, text, jsonb, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transition_sales_order(uuid, uuid, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sales_order_follows_invoice() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_pending_sales_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_sales_order(uuid, text, uuid, text, jsonb, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_sales_order(uuid, uuid, text, text, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_pending_sales_orders() TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- Stop taking website orders, keep every order and key:
--   UPDATE public.api_keys SET revoked_at = now() WHERE kind = 'publishable' AND revoked_at IS NULL;
--
-- Stop orders following their invoices:
--   DROP TRIGGER IF EXISTS sales_order_follows_invoice_trg ON public.invoices;
--
-- Remove entirely (destroys orders — only before anyone relies on them):
--   BEGIN;
--   DROP TRIGGER IF EXISTS sales_order_follows_invoice_trg ON public.invoices;
--   DROP FUNCTION IF EXISTS public.expire_pending_sales_orders();
--   DROP FUNCTION IF EXISTS public.sales_order_follows_invoice();
--   DROP FUNCTION IF EXISTS public.transition_sales_order(uuid, uuid, text, text, uuid, uuid);
--   DROP FUNCTION IF EXISTS public.create_sales_order(uuid, text, uuid, text, jsonb, jsonb, uuid);
--   DROP FUNCTION IF EXISTS public.emit_sales_order_event(uuid, uuid, text);
--   DROP TABLE IF EXISTS public.sales_order_items;
--   DROP TABLE IF EXISTS public.sales_orders;
--   DROP TABLE IF EXISTS public.storefront_settings;
--   ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_public_token_only_publishable;
--   ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_kind_check;
--   DROP INDEX IF EXISTS public.api_keys_public_token_idx;
--   ALTER TABLE public.api_keys DROP COLUMN IF EXISTS allowed_origins;
--   ALTER TABLE public.api_keys DROP COLUMN IF EXISTS public_token;
--   ALTER TABLE public.api_keys DROP COLUMN IF EXISTS kind;
--   COMMIT;
-- ============================================================================
