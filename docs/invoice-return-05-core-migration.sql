-- ============================================================================
-- Hisabche Migration: the returns core — several items, deductions, tax, refund
-- File: docs/invoice-return-05-core-migration.sql
--
-- RUN ORDER: invoice-return-03 (repair)  ->  invoice-return-04 (one per invoice)  ->  THIS FILE.
-- PENDING HUMAN CONFIRMATION — run docs/VERIFY-invoice-return-05.sql after it.
--
-- WHAT IT ADDS (additive; a plain return keeps working with the same five arguments)
--   invoice_returns          + reason_code, notes, deduction_minor, refunded_minor
--   invoice_return_lines     + condition_code
--   invoice_return_deductions   what the shop keeps, one row per reason (new table)
--   invoice_return_refunds      cash paid back against a return (new table, 3 functions)
--   invoice_return_create(…, p_deductions)  — replaces the five-argument function
--
-- WHAT CHANGES IN THE MONEY (sale returns)
--   grand_total_minor  was «goods + tax»; it is now what the return CREDITS the customer:
--                      goods - discount + tax - deductions. Every balance, statement and
--                      customers-list reader already subtracts grand_total_minor, so none changes.
--   tax                was 0 on every return line. It is now the line's share of the invoice's
--                      tax_total (by net value). Returning every line returns the whole tax.
--   journal            Dr sales (goods - deductions), Dr tax, Cr receivable. The part the shop
--                      keeps stays in sales — it is revenue, not a refund. (A dedicated
--                      «return fee» account role is a separate decision: it needs a new value in
--                      the accounts.role check, the chart, and the labels.)
--   purchase returns   unchanged (no deductions, no tax split).
--
-- NOT DONE HERE, ON PURPOSE
--   · the cash refund itself is NOT inside invoice_return_create. A refund is money leaving the
--     till or the bank and goes through PaymentsService (the one payment core), in two steps:
--     reserve (cap checked under lock) -> payment -> settle. See the three functions below.
--
-- ROLLBACK: re-run docs/invoice-return-03-repair-migration.sql (it drops nothing of this file's
-- tables; they stay, empty of meaning). To remove the new objects completely:
--   DROP FUNCTION IF EXISTS public.invoice_return_refund_fail(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.invoice_return_refund_settle(uuid, uuid, uuid);
--   DROP FUNCTION IF EXISTS public.invoice_return_refund_reserve(uuid, uuid, integer, uuid, bigint, text, text);
--   DROP FUNCTION IF EXISTS public.invoice_return_refund_reconcile(uuid, uuid, interval);
--   DROP FUNCTION IF EXISTS public.invoice_return_create(uuid, uuid, integer, jsonb, jsonb, jsonb);
--   DROP TABLE IF EXISTS public.invoice_return_refunds, public.invoice_return_deductions;
-- ============================================================================

BEGIN;

-- ── 1. Columns ──────────────────────────────────────────────────────────────

ALTER TABLE public.invoice_returns
  ADD COLUMN IF NOT EXISTS reason_code      text,
  ADD COLUMN IF NOT EXISTS notes            text,
  ADD COLUMN IF NOT EXISTS deduction_minor  bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_minor   bigint NOT NULL DEFAULT 0,
  -- The caller's Idempotency-Key, stored WITH the return so a retry cannot slip between the two.
  ADD COLUMN IF NOT EXISTS client_request_id text;

CREATE UNIQUE INDEX IF NOT EXISTS invoice_returns_request_idx
  ON public.invoice_returns (workspace_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

ALTER TABLE public.invoice_return_lines
  ADD COLUMN IF NOT EXISTS condition_code   text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_return_lines_condition_chk') THEN
    ALTER TABLE public.invoice_return_lines
      ADD CONSTRAINT invoice_return_lines_condition_chk
      CHECK (condition_code IS NULL
             OR condition_code IN ('sealed', 'opened', 'used', 'damaged', 'defective', 'incomplete'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_returns_amounts_chk') THEN
    ALTER TABLE public.invoice_returns
      ADD CONSTRAINT invoice_returns_amounts_chk
      CHECK (deduction_minor >= 0 AND refunded_minor >= 0 AND refunded_minor <= GREATEST(grand_total_minor, 0))
      NOT VALID;
  END IF;
END $$;

-- ── 2. New tables ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_return_deductions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  return_id    uuid NOT NULL,
  reason_code  text NOT NULL
               CHECK (reason_code IN ('return_fee', 'repackaging', 'damage', 'usage', 'missing_parts', 'agreed', 'other')),
  mode         text NOT NULL CHECK (mode IN ('percent', 'fixed')),
  percent      numeric,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_return_refunds (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  return_id    uuid NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  method       text NOT NULL CHECK (method IN ('cash', 'bank')),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  payment_id   uuid,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  paid_at      timestamptz,
  -- The caller's Idempotency-Key: the same key is the same refund, however many times it is sent.
  client_request_id text
);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_return_refunds_request_idx
  ON public.invoice_return_refunds (workspace_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS invoice_return_deductions_return_idx
  ON public.invoice_return_deductions (workspace_id, return_id);
CREATE INDEX IF NOT EXISTS invoice_return_refunds_return_idx
  ON public.invoice_return_refunds (workspace_id, return_id, status);

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['invoice_return_deductions', 'invoice_return_refunds']) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC;', tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon;', tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated;', tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM service_role;', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO service_role;', tbl);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_workspace_members ON public.%I;', tbl, tbl);
    EXECUTE format('CREATE POLICY %I_workspace_members ON public.%I
      FOR SELECT
      USING (
        workspace_id IN (
          SELECT wm.workspace_id FROM public.workspace_members wm
          WHERE wm.user_id = (SELECT auth.uid())
            AND wm.has_access = true
            AND wm.suspended_at IS NULL
        )
      );', tbl, tbl);
  END LOOP;
END $$;

-- ── 3. invoice_return_create — replaces the five-argument function ──────────

DROP FUNCTION IF EXISTS public.invoice_return_create(uuid, uuid, integer, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.invoice_return_create(
  p_workspace_id     uuid,
  p_user_id          uuid,
  p_fraction_digits  integer,
  p_return           jsonb,
  p_lines            jsonb,
  p_deductions       jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_invoice_id          uuid;
  v_return_type         text;
  v_return_number       text;
  v_return_date         date;
  v_return_id           uuid;
  v_invoice             record;
  v_rate                numeric(18, 6);
  v_factor              numeric(18, 2);
  v_line_elem           jsonb;
  v_orig_line_id        uuid;
  v_qty                 numeric(18, 4);
  v_restock_choice      text;
  v_reason_code         text;
  v_item                record;
  v_already_returned    numeric(18, 4);
  v_orig_unit_price     numeric(18, 2);
  v_orig_discount_rate  numeric;
  v_inv_base            numeric := 0;
  v_inv_tax             numeric := 0;
  v_condition           text;
  v_reason_doc          text;
  v_notes_doc           text;
  v_client_key          text;
  v_ded                 jsonb;
  v_ded_reason          text;
  v_ded_mode            text;
  v_ded_percent         numeric;
  v_ded_amount          bigint;
  v_ded_total           bigint := 0;
  v_net_base_minor      bigint := 0;
  v_credit_minor        bigint := 0;
  v_sales_books         numeric(18, 2);
  v_subtotal_minor      bigint;
  v_discount_minor      bigint;
  v_tax_minor           bigint;
  v_total_minor         bigint;
  v_tot_subtotal_minor  bigint := 0;
  v_tot_discount_minor  bigint := 0;
  v_tot_tax_minor       bigint := 0;
  v_tot_grand_minor     bigint := 0;
  v_has_restored_cost   boolean := false;
  v_has_unknown_cost    boolean := false;
  v_tot_restored_cost   numeric(18, 2) := 0;
  v_line_restored_minor bigint;
  v_cost_status         text;
  v_sales_acct          uuid;
  v_recv_acct           uuid;
  v_pay_acct            uuid;
  v_inv_acct            uuid;
  v_cogs_acct           uuid;
  v_tax_acct            uuid;
  v_total_books         numeric(18, 2);
  v_cost_books          numeric(18, 2);
  v_tax_books           numeric(18, 2);
  v_net_books           numeric(18, 2);
  v_journal_lines       jsonb := '[]'::jsonb;
  v_journal_id          uuid := NULL;
  v_journal_desc        text;
  v_curr_stock          numeric(18, 4);
  v_curr_prod_qty       numeric(18, 4);
  v_curr_layer_qty      numeric(18, 4);
  v_warehouse_id        uuid;
  v_consumed_amount     numeric(18, 4);
  v_consumed_qty        numeric(18, 4);
  v_unit_cost           numeric(18, 6);
  v_line_cost           numeric(18, 4);
  v_qty_to_restore      numeric(18, 4);
  v_layer_restore       numeric(18, 4);
  v_c                   record;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNTING_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF p_fraction_digits IS NULL OR p_fraction_digits < 0 OR p_fraction_digits > 4 THEN
    RAISE EXCEPTION 'INVALID_FRACTION_DIGITS' USING ERRCODE = 'P0001';
  END IF;

  v_factor := POWER(10, p_fraction_digits);

  v_invoice_id    := (p_return->>'originalInvoiceId')::uuid;
  v_return_type   := p_return->>'returnType';
  v_return_number := p_return->>'returnNumber';
  v_return_date   := COALESCE((p_return->>'returnDate')::date, CURRENT_DATE);
  v_reason_doc    := NULLIF(btrim(COALESCE(p_return->>'reasonCode', '')), '');
  v_notes_doc     := NULLIF(btrim(COALESCE(p_return->>'notes', '')), '');
  v_client_key    := NULLIF(btrim(COALESCE(p_return->>'clientRequestId', '')), '');

  IF v_invoice_id IS NULL OR v_return_type IS NULL OR v_return_number IS NULL THEN
    RAISE EXCEPTION 'INVALID_RETURN_PARAMETERS' USING ERRCODE = 'P0001';
  END IF;

  IF v_return_type NOT IN ('sale_return', 'purchase_return') THEN
    RAISE EXCEPTION 'INVALID_RETURN_TYPE: %', v_return_type USING ERRCODE = 'P0001';
  END IF;

  IF v_return_type <> 'sale_return' AND jsonb_array_length(COALESCE(p_deductions, '[]'::jsonb)) > 0 THEN
    RAISE EXCEPTION 'RETURN_DEDUCTION_NOT_ALLOWED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_invoice
    FROM public.invoices
   WHERE id = v_invoice_id AND workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_return_type = 'sale_return' THEN
    -- invoice_items has no tax column: a line's tax is its share of the invoice's tax_total by net value.
    SELECT COALESCE(SUM(quantity * unit_price - COALESCE(discount, 0)), 0)
      INTO v_inv_base
      FROM public.invoice_items
     WHERE invoice_id = v_invoice_id AND workspace_id = p_workspace_id;
    v_inv_tax := COALESCE(v_invoice.tax_total, 0);
  END IF;

  v_rate := COALESCE(v_invoice.exchange_rate, 1.0);
  IF v_rate <= 0 THEN v_rate := 1.0; END IF;

  v_return_id := gen_random_uuid();

  FOR v_line_elem IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_orig_line_id   := (v_line_elem->>'originalLineId')::uuid;
    v_qty            := (v_line_elem->>'quantity')::numeric;
    v_restock_choice := COALESCE(v_line_elem->>'restockChoice', 'restock');
    v_reason_code    := COALESCE(v_line_elem->>'reasonCode', 'return');
    v_condition      := NULLIF(btrim(COALESCE(v_line_elem->>'conditionCode', '')), '');
    IF v_condition IS NOT NULL AND v_condition NOT IN ('sealed', 'opened', 'used', 'damaged', 'defective', 'incomplete') THEN
      RAISE EXCEPTION 'INVALID_RETURN_CONDITION: %', v_condition USING ERRCODE = 'P0001';
    END IF;

    IF v_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_item
      FROM public.invoice_items
     WHERE id = v_orig_line_id AND invoice_id = v_invoice_id AND workspace_id = p_workspace_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVOICE_LINE_NOT_FOUND: %', v_orig_line_id USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE(SUM(quantity), 0) INTO v_already_returned
      FROM public.invoice_return_lines
     WHERE original_line_id = v_orig_line_id AND workspace_id = p_workspace_id;

    IF (v_already_returned + v_qty) > v_item.quantity THEN
      RAISE EXCEPTION 'RETURN_QUANTITY_EXCEEDS_ORIGINAL: line %, max %', v_orig_line_id, (v_item.quantity - v_already_returned)
        USING ERRCODE = 'P0001';
    END IF;

    v_orig_unit_price := v_item.unit_price;
    v_orig_discount_rate := CASE WHEN (v_item.quantity * v_item.unit_price) > 0
                                 THEN COALESCE(v_item.discount, 0) / (v_item.quantity * v_item.unit_price)
                                 ELSE 0 END;

    v_subtotal_minor := ROUND((v_qty * v_orig_unit_price) * v_factor);
    v_discount_minor := ROUND((v_subtotal_minor::numeric * v_orig_discount_rate));
    v_tax_minor      := CASE
                          WHEN v_return_type = 'sale_return' AND v_inv_base > 0 AND v_inv_tax > 0
                          THEN ROUND((v_subtotal_minor - v_discount_minor)::numeric * v_inv_tax / v_inv_base)
                          ELSE 0
                        END;
    v_total_minor    := v_subtotal_minor - v_discount_minor + v_tax_minor;

    v_tot_subtotal_minor := v_tot_subtotal_minor + v_subtotal_minor;
    v_tot_discount_minor := v_tot_discount_minor + v_discount_minor;
    v_tot_tax_minor      := v_tot_tax_minor + v_tax_minor;
    v_tot_grand_minor    := v_tot_grand_minor + v_total_minor;

    v_line_restored_minor := NULL;
    v_warehouse_id := v_invoice.warehouse_id;

    IF v_return_type = 'sale_return' AND v_restock_choice = 'restock' AND v_item.product_id IS NOT NULL THEN
      -- Physical movement back into the warehouse (as 01; an inflow of a sale is type 'purchase').
      IF v_warehouse_id IS NOT NULL THEN
        INSERT INTO public.stock_movements (
          workspace_id, user_id, product_id, type, quantity, to_warehouse_id,
          reference_type, reference_id, created_at
        ) VALUES (
          p_workspace_id, p_user_id, v_item.product_id, 'purchase', v_qty, v_warehouse_id,
          'invoice_return', v_return_id, now()
        );
      END IF;

      -- Cost restored at the ORIGINAL consumed unit cost; unknown cost is never written as zero.
      SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(quantity), 0)
        INTO v_consumed_amount, v_consumed_qty
        FROM public.cost_consumptions
       WHERE workspace_id = p_workspace_id
         AND consumer_type = 'invoice'
         AND consumer_id = v_invoice_id
         AND product_id = v_item.product_id
         AND quantity > 0;

      IF v_consumed_qty > 0 THEN
        v_unit_cost := v_consumed_amount / v_consumed_qty;
        v_line_cost := ROUND(v_qty * v_unit_cost, 4);
        v_line_restored_minor := ROUND(v_line_cost * v_factor);

        v_qty_to_restore := v_qty;
        FOR v_c IN
          SELECT layer_id, quantity
            FROM public.cost_consumptions
           WHERE workspace_id = p_workspace_id
             AND consumer_type = 'invoice'
             AND consumer_id = v_invoice_id
             AND product_id = v_item.product_id
             AND quantity > 0
           ORDER BY entry_date DESC, created_at DESC
        LOOP
          EXIT WHEN v_qty_to_restore <= 0;
          IF v_c.layer_id IS NOT NULL THEN
            v_layer_restore := LEAST(v_qty_to_restore, v_c.quantity);
            UPDATE public.cost_layers
               SET remaining_qty = LEAST(received_qty, remaining_qty + v_layer_restore)
             WHERE id = v_c.layer_id AND workspace_id = p_workspace_id;
            v_qty_to_restore := v_qty_to_restore - v_layer_restore;
          END IF;
        END LOOP;

        INSERT INTO public.cost_consumptions (
          workspace_id, product_id, warehouse_id, consumer_type,
          consumer_id, consumer_line, quantity, unit_cost, amount,
          is_estimated, entry_date, created_by
        ) VALUES (
          p_workspace_id, v_item.product_id, v_warehouse_id,
          'invoice_return', v_return_id, v_orig_line_id::text,
          v_qty, v_unit_cost, -v_line_cost, false, CURRENT_DATE, p_user_id
        );

        v_tot_restored_cost := v_tot_restored_cost + v_line_cost;
        v_has_restored_cost := true;
      ELSE
        v_has_unknown_cost := true;
      END IF;
    END IF;

    -- Scenario 01C Fix: In purchase return, physical stock is verified and removed from warehouse, and cost layer is depleted
    IF v_return_type = 'purchase_return' AND v_item.product_id IS NOT NULL THEN
      IF v_invoice.warehouse_id IS NOT NULL THEN
        SELECT qty INTO v_curr_stock
          FROM public.product_stock
         WHERE workspace_id = p_workspace_id
           AND product_id = v_item.product_id
           AND warehouse_id = v_invoice.warehouse_id
           AND deleted_at IS NULL
         FOR UPDATE;

        IF v_curr_stock IS NULL OR v_curr_stock < v_qty THEN
          RAISE EXCEPTION 'PURCHASE_RETURN_INSUFFICIENT_STOCK: warehouse stock is %, but return requires %',
            COALESCE(v_curr_stock, 0), v_qty
            USING ERRCODE = 'P0001';
        END IF;

        UPDATE public.product_stock
           SET qty = qty - v_qty, updated_at = now()
         WHERE workspace_id = p_workspace_id
           AND product_id = v_item.product_id
           AND warehouse_id = v_invoice.warehouse_id
           AND deleted_at IS NULL;
      END IF;

      SELECT quantity INTO v_curr_prod_qty
        FROM public.products
       WHERE workspace_id = p_workspace_id
         AND id = v_item.product_id
       FOR UPDATE;

      IF v_curr_prod_qty IS NULL OR v_curr_prod_qty < v_qty THEN
        RAISE EXCEPTION 'PURCHASE_RETURN_INSUFFICIENT_PRODUCT_STOCK: total product stock is %, but return requires %',
          COALESCE(v_curr_prod_qty, 0), v_qty
          USING ERRCODE = 'P0001';
      END IF;

      UPDATE public.products
         SET quantity = quantity - v_qty, updated_at = now()
       WHERE workspace_id = p_workspace_id
         AND id = v_item.product_id;

      SELECT remaining_qty INTO v_curr_layer_qty
        FROM public.cost_layers
       WHERE workspace_id = p_workspace_id
         AND source_type = 'invoice'
         AND source_id = v_invoice_id
         AND product_id = v_item.product_id
       FOR UPDATE;

      IF v_curr_layer_qty IS NULL OR v_curr_layer_qty < v_qty THEN
        RAISE EXCEPTION 'PURCHASE_RETURN_COST_LAYER_DEPLETED: purchase layer has %, but return requires %',
          COALESCE(v_curr_layer_qty, 0), v_qty
          USING ERRCODE = 'P0001';
      END IF;

      UPDATE public.cost_layers
         SET remaining_qty = remaining_qty - v_qty, updated_at = now()
       WHERE workspace_id = p_workspace_id
         AND source_type = 'invoice'
         AND source_id = v_invoice_id
         AND product_id = v_item.product_id;
    END IF;

    INSERT INTO public.invoice_return_lines (
      id, workspace_id, return_id, original_line_id, product_id,
      quantity, restock_choice, reason_code, condition_code, subtotal_minor,
      discount_minor, tax_minor, total_minor, restored_cost_minor,
      created_at
    ) VALUES (
      gen_random_uuid(), p_workspace_id, v_return_id, v_orig_line_id, v_item.product_id,
      v_qty, v_restock_choice, v_reason_code, v_condition, v_subtotal_minor,
      v_discount_minor, v_tax_minor, v_total_minor, v_line_restored_minor,
      now()
    );
  END LOOP;

  v_net_base_minor := v_tot_subtotal_minor - v_tot_discount_minor;

  IF jsonb_array_length(COALESCE(p_deductions, '[]'::jsonb)) > 0 THEN
    FOR v_ded IN SELECT * FROM jsonb_array_elements(p_deductions)
    LOOP
      v_ded_reason := v_ded->>'reason';
      v_ded_mode   := v_ded->>'mode';
      IF v_ded_reason IS NULL OR v_ded_reason NOT IN
         ('return_fee', 'repackaging', 'damage', 'usage', 'missing_parts', 'agreed', 'other') THEN
        RAISE EXCEPTION 'RETURN_DEDUCTION_REASON_INVALID' USING ERRCODE = 'P0001';
      END IF;
      IF v_ded_reason = 'other' AND btrim(COALESCE(v_ded->>'note', '')) = '' THEN
        RAISE EXCEPTION 'RETURN_DEDUCTION_NOTE_REQUIRED' USING ERRCODE = 'P0001';
      END IF;

      v_ded_percent := NULL;
      IF v_ded_mode = 'percent' THEN
        v_ded_percent := (v_ded->>'percent')::numeric;
        IF v_ded_percent IS NULL OR v_ded_percent <= 0 OR v_ded_percent > 100 THEN
          RAISE EXCEPTION 'RETURN_DEDUCTION_PERCENT_INVALID' USING ERRCODE = 'P0001';
        END IF;
        v_ded_amount := ROUND(v_net_base_minor::numeric * v_ded_percent / 100);
      ELSIF v_ded_mode = 'fixed' THEN
        IF (v_ded->>'amount') IS NULL OR (v_ded->>'amount')::numeric <= 0 THEN
          RAISE EXCEPTION 'RETURN_DEDUCTION_AMOUNT_INVALID' USING ERRCODE = 'P0001';
        END IF;
        v_ded_amount := ROUND((v_ded->>'amount')::numeric * v_factor);
      ELSE
        RAISE EXCEPTION 'RETURN_DEDUCTION_MODE_INVALID' USING ERRCODE = 'P0001';
      END IF;
      IF v_ded_amount <= 0 THEN
        RAISE EXCEPTION 'RETURN_DEDUCTION_AMOUNT_INVALID' USING ERRCODE = 'P0001';
      END IF;

      v_ded_total := v_ded_total + v_ded_amount;

      INSERT INTO public.invoice_return_deductions (
        id, workspace_id, return_id, reason_code, mode, percent, amount_minor, note, created_at
      ) VALUES (
        gen_random_uuid(), p_workspace_id, v_return_id, v_ded_reason, v_ded_mode,
        v_ded_percent, v_ded_amount, NULLIF(btrim(COALESCE(v_ded->>'note', '')), ''), now()
      );
    END LOOP;

    IF v_ded_total > v_net_base_minor THEN
      RAISE EXCEPTION 'RETURN_DEDUCTION_EXCEEDS_BASE' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- grand_total_minor is what the return CREDITS the customer: goods + tax - what the shop keeps.
  -- Every reader that already subtracts a return from a balance stays right without change.
  v_credit_minor := v_tot_grand_minor - v_ded_total;

  IF v_has_restored_cost THEN
    v_cost_status := 'restored';
  ELSIF v_has_unknown_cost THEN
    v_cost_status := 'unknown';
  ELSE
    v_cost_status := 'not_applicable';
  END IF;

  INSERT INTO public.invoice_returns (
    id, workspace_id, original_invoice_id, return_type, return_number,
    return_date, total_subtotal_minor, total_discount_minor,
    total_tax_minor, grand_total_minor, deduction_minor, reason_code, notes, client_request_id, created_at
  ) VALUES (
    v_return_id, p_workspace_id, v_invoice_id, v_return_type, v_return_number,
    v_return_date, v_tot_subtotal_minor, v_tot_discount_minor,
    v_tot_tax_minor, v_credit_minor, v_ded_total, v_reason_doc, v_notes_doc, v_client_key, now()
  );

  -- 6. Ledger Posting (Branched by Return Type)
  IF v_tot_grand_minor > 0 THEN
    v_total_books := ROUND(((v_tot_grand_minor::numeric / v_factor) * v_rate), 2);

    IF v_return_type = 'purchase_return' THEN
      -- Purchase Return: Dr Accounts Payable, Cr Inventory, Cr Tax (if tax exists)
      SELECT id INTO v_pay_acct FROM public.accounts
       WHERE workspace_id = p_workspace_id AND role = 'payable' AND deleted_at IS NULL AND is_active = true LIMIT 1;
      IF v_pay_acct IS NULL THEN
        RAISE EXCEPTION 'RETURN_ACCOUNTS_MISSING: payable' USING ERRCODE = 'P0001';
      END IF;

      SELECT id INTO v_inv_acct FROM public.accounts
       WHERE workspace_id = p_workspace_id AND role = 'inventory' AND deleted_at IS NULL AND is_active = true LIMIT 1;
      IF v_inv_acct IS NULL THEN
        RAISE EXCEPTION 'RETURN_ACCOUNTS_MISSING: inventory' USING ERRCODE = 'P0001';
      END IF;

      SELECT id INTO v_tax_acct FROM public.accounts
       WHERE workspace_id = p_workspace_id AND role = 'tax' AND deleted_at IS NULL AND is_active = true LIMIT 1;

      IF v_tot_tax_minor > 0 AND v_tax_acct IS NOT NULL THEN
        v_tax_books := ROUND(((v_tot_tax_minor::numeric / v_factor) * v_rate), 2);
        v_net_books := v_total_books - v_tax_books;
        v_journal_lines := jsonb_build_array(
          jsonb_build_object('account_id', v_pay_acct, 'debit', v_total_books, 'credit', 0),
          jsonb_build_object('account_id', v_inv_acct, 'debit', 0, 'credit', v_net_books),
          jsonb_build_object('account_id', v_tax_acct, 'debit', 0, 'credit', v_tax_books)
        );
      ELSE
        v_journal_lines := jsonb_build_array(
          jsonb_build_object('account_id', v_pay_acct, 'debit', v_total_books, 'credit', 0),
          jsonb_build_object('account_id', v_inv_acct, 'debit', 0, 'credit', v_total_books)
        );
      END IF;

      v_journal_desc := 'برگشت فاکتور خرید ' || COALESCE(v_invoice.invoice_number, '');
    ELSE
      -- Sale Return: Dr Sales, Cr Accounts Receivable
      SELECT id INTO v_sales_acct FROM public.accounts
       WHERE workspace_id = p_workspace_id AND role = 'sales' AND deleted_at IS NULL AND is_active = true LIMIT 1;
      IF v_sales_acct IS NULL THEN
        RAISE EXCEPTION 'RETURN_ACCOUNTS_MISSING: sales' USING ERRCODE = 'P0001';
      END IF;

      SELECT id INTO v_recv_acct FROM public.accounts
       WHERE workspace_id = p_workspace_id AND role = 'receivable' AND deleted_at IS NULL AND is_active = true LIMIT 1;
      IF v_recv_acct IS NULL THEN
        RAISE EXCEPTION 'RETURN_ACCOUNTS_MISSING: receivable' USING ERRCODE = 'P0001';
      END IF;

      -- Dr sales (goods - what the shop keeps) + Dr tax (the whole tax of the goods), Cr receivable.
      -- The credit is the sum of the two debits, so rounding at a foreign rate cannot unbalance it.
      v_sales_books := ROUND((((v_net_base_minor - v_ded_total)::numeric / v_factor) * v_rate), 2);
      v_tax_books := CASE WHEN v_tot_tax_minor > 0
                          THEN ROUND(((v_tot_tax_minor::numeric / v_factor) * v_rate), 2)
                          ELSE 0 END;
      IF v_tax_books > 0 THEN
        SELECT id INTO v_tax_acct FROM public.accounts
         WHERE workspace_id = p_workspace_id AND role = 'tax' AND deleted_at IS NULL AND is_active = true LIMIT 1;
        -- No tax account: the invoice booked its tax inside sales, so the return takes it back the same way.
        IF v_tax_acct IS NULL THEN
          v_sales_books := v_sales_books + v_tax_books;
          v_tax_books := 0;
        END IF;
      END IF;
      v_total_books := v_sales_books + v_tax_books;

      v_journal_lines := '[]'::jsonb;
      IF v_sales_books > 0 THEN
        v_journal_lines := v_journal_lines ||
          jsonb_build_array(jsonb_build_object('account_id', v_sales_acct, 'debit', v_sales_books, 'credit', 0));
      END IF;
      IF v_tax_books > 0 THEN
        v_journal_lines := v_journal_lines ||
          jsonb_build_array(jsonb_build_object('account_id', v_tax_acct, 'debit', v_tax_books, 'credit', 0));
      END IF;
      IF v_total_books > 0 THEN
        v_journal_lines := v_journal_lines ||
          jsonb_build_array(jsonb_build_object('account_id', v_recv_acct, 'debit', 0, 'credit', v_total_books));
      END IF;

      IF v_tot_restored_cost > 0 THEN
        SELECT id INTO v_inv_acct FROM public.accounts
         WHERE workspace_id = p_workspace_id AND role = 'inventory' AND deleted_at IS NULL AND is_active = true LIMIT 1;
        IF v_inv_acct IS NULL THEN
          RAISE EXCEPTION 'RETURN_ACCOUNTS_MISSING: inventory' USING ERRCODE = 'P0001';
        END IF;

        SELECT id INTO v_cogs_acct FROM public.accounts
         WHERE workspace_id = p_workspace_id AND role = 'cogs' AND deleted_at IS NULL AND is_active = true LIMIT 1;
        IF v_cogs_acct IS NULL THEN
          RAISE EXCEPTION 'RETURN_ACCOUNTS_MISSING: cogs' USING ERRCODE = 'P0001';
        END IF;

        v_cost_books := ROUND(v_tot_restored_cost, 2);
        v_journal_lines := v_journal_lines || jsonb_build_array(
          jsonb_build_object('account_id', v_inv_acct, 'debit', v_cost_books, 'credit', 0),
          jsonb_build_object('account_id', v_cogs_acct, 'debit', 0, 'credit', v_cost_books)
        );
      END IF;

      v_journal_desc := 'برگشت فاکتور فروش ' || COALESCE(v_invoice.invoice_number, '');
    END IF;

    -- Call accounting_post_journal_entry in the same transaction
    v_journal_id := public.accounting_post_journal_entry(
      p_workspace_id,
      p_user_id,
      jsonb_build_object(
        'date', v_return_date::text,
        'description', v_journal_desc,
        'reference', v_return_number,
        'status', 'posted',
        'source_type', 'invoice_return',
        'source_id', v_return_id::text
      ),
      v_journal_lines
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_return_id,
    'workspaceId', p_workspace_id,
    'originalInvoiceId', v_invoice_id,
    'returnType', v_return_type,
    'returnNumber', v_return_number,
    'returnDate', v_return_date,
    'grandTotalMinor', v_credit_minor,
    'deductionMinor', v_ded_total,
    'taxMinor', v_tot_tax_minor,
    'restoredCostMinor', CASE WHEN v_cost_status = 'restored' THEN ROUND(v_tot_restored_cost * v_factor) ELSE NULL END,
    'costStatus', v_cost_status,
    'journalEntryId', v_journal_id
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.invoice_return_create(uuid, uuid, integer, jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoice_return_create(uuid, uuid, integer, jsonb, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.invoice_return_create(uuid, uuid, integer, jsonb, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_return_create(uuid, uuid, integer, jsonb, jsonb, jsonb) TO service_role;

-- ── 4. Refund: reserve -> (payment, by PaymentsService) -> settle | fail ────
--
-- The cash is paid by the payment core, not here. This pair only makes the CAP honest under
-- concurrency: two people refunding the same return at once cannot both be told «yes».
-- The cap is the part of the credit that is real money: the credit on an unpaid invoice only
-- lowers the debt and there is nothing to hand over (same split as returnEffectOfInvoice).

-- A reservation is a promise to pay. If the process died between «reserve» and «settle», the
-- reservation would count against the cap for ever. After the grace period each stale one is
-- looked up by its payment (the payment's own idempotency key IS the reservation id):
--   · a posted payment exists  -> the refund WAS paid: finish it (never release it, that would
--                                 let the same money be paid twice)
--   · no payment exists        -> nothing was paid: release it.
CREATE OR REPLACE FUNCTION public.invoice_return_refund_reconcile(
  p_workspace_id uuid,
  p_return_id    uuid,
  p_older_than   interval DEFAULT interval '10 minutes'
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_row     record;
  v_payment uuid;
  v_count   integer := 0;
BEGIN
  FOR v_row IN
    SELECT * FROM public.invoice_return_refunds
     WHERE workspace_id = p_workspace_id AND return_id = p_return_id
       AND status = 'pending' AND created_at < now() - p_older_than
     FOR UPDATE
  LOOP
    SELECT id INTO v_payment FROM public.payments
     WHERE workspace_id = p_workspace_id
       AND client_request_id = v_row.id::text
       AND COALESCE(status, 'posted') = 'posted'
     LIMIT 1;

    IF v_payment IS NOT NULL THEN
      UPDATE public.invoice_return_refunds
         SET status = 'paid', payment_id = v_payment, paid_at = now()
       WHERE id = v_row.id;
      UPDATE public.invoice_returns
         SET refunded_minor = refunded_minor + v_row.amount_minor
       WHERE id = p_return_id AND workspace_id = p_workspace_id;
    ELSE
      UPDATE public.invoice_return_refunds
         SET status = 'failed', client_request_id = NULL
       WHERE id = v_row.id;
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.invoice_return_refund_reserve(
  p_workspace_id    uuid,
  p_user_id         uuid,
  p_fraction_digits integer,
  p_return_id       uuid,
  p_amount_minor    bigint,
  p_method          text,
  p_client_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_ret         record;
  v_inv         record;
  v_factor      numeric;
  v_owed        bigint;
  v_returned    bigint;
  v_credit      bigint;
  v_refunded    bigint;
  v_pending     bigint;
  v_this_open   bigint;
  v_refundable  bigint;
  v_id          uuid;
  v_same        record;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNTING_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF p_fraction_digits IS NULL OR p_fraction_digits < 0 OR p_fraction_digits > 4 THEN
    RAISE EXCEPTION 'INVALID_FRACTION_DIGITS' USING ERRCODE = 'P0001';
  END IF;
  IF p_method IS NULL OR p_method NOT IN ('cash', 'bank') THEN
    RAISE EXCEPTION 'INVALID_REFUND_METHOD' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'INVALID_REFUND_AMOUNT' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_ret FROM public.invoice_returns
   WHERE id = p_return_id AND workspace_id = p_workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RETURN_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  -- One refund at a time per invoice: the cap is an invoice-level figure.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_ret.original_invoice_id::text, 1));
  SELECT * INTO v_ret FROM public.invoice_returns
   WHERE id = p_return_id AND workspace_id = p_workspace_id
   FOR UPDATE;

  -- A reservation that was never paid and has gone quiet is given back (or, if its payment
  -- DID get recorded before the process died, finished) BEFORE the cap is read.
  PERFORM public.invoice_return_refund_reconcile(p_workspace_id, p_return_id, interval '10 minutes');

  -- The same Idempotency-Key is the same refund: answer with what is already there.
  IF p_client_request_id IS NOT NULL THEN
    SELECT * INTO v_same FROM public.invoice_return_refunds
     WHERE workspace_id = p_workspace_id AND client_request_id = p_client_request_id;
    IF FOUND THEN
      IF v_same.return_id <> p_return_id OR v_same.amount_minor <> p_amount_minor THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH' USING ERRCODE = 'P0001';
      END IF;
      RETURN jsonb_build_object(
        'id', v_same.id, 'returnId', v_same.return_id, 'amountMinor', v_same.amount_minor,
        'status', v_same.status, 'paymentId', v_same.payment_id, 'replayed', true
      );
    END IF;
  END IF;

  IF v_ret.return_type <> 'sale_return' THEN
    RAISE EXCEPTION 'REFUND_NOT_ALLOWED: only a sale return is paid back to a customer' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_inv FROM public.invoices
   WHERE id = v_ret.original_invoice_id AND workspace_id = p_workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  v_factor := POWER(10, p_fraction_digits);
  v_owed   := GREATEST(0, ROUND(COALESCE(v_inv.total, 0) * v_factor) - ROUND(COALESCE(v_inv.paid_amount, 0) * v_factor));

  -- The invoice-level split, the same as returnEffectOfInvoice: returns first cancel what is owed,
  -- the rest is credit — money the customer really gave.
  SELECT COALESCE(SUM(grand_total_minor), 0), COALESCE(SUM(refunded_minor), 0)
    INTO v_returned, v_refunded
    FROM public.invoice_returns
   WHERE workspace_id = p_workspace_id
     AND original_invoice_id = v_ret.original_invoice_id
     AND return_type = 'sale_return';
  v_credit := GREATEST(0, v_returned - LEAST(GREATEST(0, v_returned), v_owed));

  SELECT COALESCE(SUM(f.amount_minor), 0) INTO v_pending
    FROM public.invoice_return_refunds f
    JOIN public.invoice_returns r ON r.id = f.return_id AND r.workspace_id = f.workspace_id
   WHERE f.workspace_id = p_workspace_id
     AND r.original_invoice_id = v_ret.original_invoice_id
     AND f.status = 'pending';

  v_refundable := GREATEST(0, v_credit - v_refunded - v_pending);

  -- And never more than this return itself credited.
  SELECT GREATEST(0, v_ret.grand_total_minor - v_ret.refunded_minor - COALESCE(SUM(amount_minor), 0))
    INTO v_this_open
    FROM public.invoice_return_refunds
   WHERE workspace_id = p_workspace_id AND return_id = p_return_id AND status = 'pending';
  v_refundable := LEAST(v_refundable, v_this_open);

  IF p_amount_minor > v_refundable THEN
    RAISE EXCEPTION 'REFUND_EXCEEDS_REFUNDABLE: refundable %, requested %', v_refundable, p_amount_minor
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.invoice_return_refunds
    (id, workspace_id, return_id, amount_minor, method, status, created_by, client_request_id)
  VALUES (gen_random_uuid(), p_workspace_id, p_return_id, p_amount_minor, p_method, 'pending',
          p_user_id, p_client_request_id)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'returnId', p_return_id,
    'amountMinor', p_amount_minor,
    'status', 'pending',
    'paymentId', NULL,
    'replayed', false,
    'refundableMinor', v_refundable - p_amount_minor
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.invoice_return_refund_settle(
  p_workspace_id uuid,
  p_refund_id    uuid,
  p_payment_id   uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_refund record;
  v_ret    record;
BEGIN
  SELECT * INTO v_refund FROM public.invoice_return_refunds
   WHERE id = p_refund_id AND workspace_id = p_workspace_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REFUND_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- Settling twice is a retry, not a second payment: the counter moves once.
  IF v_refund.status = 'paid' THEN
    RETURN jsonb_build_object('id', v_refund.id, 'status', 'paid', 'replayed', true);
  END IF;
  IF v_refund.status <> 'pending' THEN
    RAISE EXCEPTION 'REFUND_NOT_PENDING' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_ret FROM public.invoice_returns
   WHERE id = v_refund.return_id AND workspace_id = p_workspace_id
   FOR UPDATE;

  UPDATE public.invoice_return_refunds
     SET status = 'paid', payment_id = p_payment_id, paid_at = now()
   WHERE id = p_refund_id;

  UPDATE public.invoice_returns
     SET refunded_minor = refunded_minor + v_refund.amount_minor
   WHERE id = v_refund.return_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object('id', v_refund.id, 'status', 'paid', 'replayed', false);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.invoice_return_refund_fail(
  p_workspace_id uuid,
  p_refund_id    uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_refund record;
BEGIN
  SELECT * INTO v_refund FROM public.invoice_return_refunds
   WHERE id = p_refund_id AND workspace_id = p_workspace_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REFUND_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  -- Only a reservation that never became a payment can be released; a paid one is history.
  IF v_refund.status = 'pending' THEN
    -- The key is freed: a retry of a refund that never paid is a fresh attempt, not a replay.
    UPDATE public.invoice_return_refunds
       SET status = 'failed', client_request_id = NULL
     WHERE id = p_refund_id;
    RETURN jsonb_build_object('id', v_refund.id, 'status', 'failed');
  END IF;
  RETURN jsonb_build_object('id', v_refund.id, 'status', v_refund.status);
END;
$fn$;

REVOKE ALL ON FUNCTION public.invoice_return_refund_reconcile(uuid, uuid, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_return_refund_reconcile(uuid, uuid, interval) TO service_role;
REVOKE ALL ON FUNCTION public.invoice_return_refund_reserve(uuid, uuid, integer, uuid, bigint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoice_return_refund_settle(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoice_return_refund_fail(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_return_refund_reserve(uuid, uuid, integer, uuid, bigint, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.invoice_return_refund_settle(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.invoice_return_refund_fail(uuid, uuid) TO service_role;

COMMIT;
