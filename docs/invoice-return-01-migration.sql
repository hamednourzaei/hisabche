-- ============================================================================
-- Migration: docs/invoice-return-01-migration.sql
-- Name: Atomic Invoice Return Processing & Ledger/Inventory Reversal
-- Phase: Universal Core / Launch Critical
-- Date: 2026-10-26
--
-- Purpose:
--   Implements atomic, accounted sales return document creation inside ONE
--   Postgres function `invoice_return_create`. Validates workspace tenancy,
--   enforces cumulative over-return guards with row-level locks on the invoice,
--   scales monetary amounts via dynamic minor-unit factor (0-4 fraction digits),
--   inserts return header and lines, generates stock movements (for restock),
--   restores cost layers at the original consumed cost, applies the unknown cost rule
--   (costStatus = 'unknown' when original consumption is missing), and posts the exact
--   ledger reversal (sales/receivable, inventory/COGS) in the same transaction.
--   Enforces mandatory accounts: missing accounts raise RETURN_ACCOUNTS_MISSING
--   and roll back the entire transaction.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.invoice_return_create(uuid, uuid, integer, jsonb, jsonb);
--   DROP FUNCTION IF EXISTS public.invoice_return_create(uuid, uuid, jsonb, jsonb);
--   DROP INDEX IF EXISTS public.invoice_returns_workspace_invoice_num_idx;
-- ============================================================================

-- ── 1. Supporting Tables & Indices ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  original_invoice_id uuid NOT NULL,
  return_type text NOT NULL CHECK (return_type IN ('sale_return', 'purchase_return')),
  return_number text NOT NULL,
  return_date date NOT NULL,
  total_subtotal_minor bigint NOT NULL,
  total_discount_minor bigint NOT NULL,
  total_tax_minor bigint NOT NULL,
  grand_total_minor bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_return_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  return_id uuid NOT NULL,
  original_line_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity numeric NOT NULL,
  restock_choice text NOT NULL CHECK (restock_choice IN ('restock', 'scrap')),
  reason_code text NOT NULL,
  subtotal_minor bigint NOT NULL,
  discount_minor bigint NOT NULL,
  tax_minor bigint NOT NULL,
  total_minor bigint NOT NULL,
  restored_cost_minor bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency constraint: exactly one return document per (workspace, invoice, return_number)
CREATE UNIQUE INDEX IF NOT EXISTS invoice_returns_workspace_invoice_num_idx
  ON public.invoice_returns (workspace_id, original_invoice_id, return_number);

CREATE INDEX IF NOT EXISTS invoice_return_lines_return_id_idx
  ON public.invoice_return_lines (return_id);

CREATE INDEX IF NOT EXISTS invoice_return_lines_original_line_idx
  ON public.invoice_return_lines (workspace_id, original_line_id);

-- ── 2. Atomic Return Function ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.invoice_return_create(
  p_workspace_id    uuid,
  p_user_id         uuid,
  p_fraction_digits integer,
  p_return          jsonb,
  p_lines           jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_invoice_id           uuid;
  v_return_type          text;
  v_return_number        text;
  v_return_date          date;
  v_invoice              record;
  v_existing_id          uuid;
  v_return_id            uuid;
  v_factor               numeric;
  v_line_elem            jsonb;
  v_orig_line_id         uuid;
  v_item                 record;
  v_qty                  numeric;
  v_restock_choice       text;
  v_reason_code          text;
  v_prior_returned       numeric;
  v_rate                 numeric;
  v_subtotal_minor       bigint;
  v_discount_minor       bigint;
  v_tax_minor            bigint;
  v_total_minor          bigint;
  v_tot_subtotal_minor   bigint := 0;
  v_tot_discount_minor   bigint := 0;
  v_tot_tax_minor        bigint := 0;
  v_tot_grand_minor      bigint := 0;
  v_tot_restored_cost    numeric := 0;
  v_cost_status          text := 'not_applicable';
  v_has_unknown_cost     boolean := false;
  v_has_restored_cost    boolean := false;
  v_consumed_amount      numeric;
  v_consumed_qty         numeric;
  v_unit_cost            numeric;
  v_line_cost            numeric;
  v_line_restored_minor  bigint;
  v_qty_to_restore       numeric;
  v_c                    record;
  v_layer_restore        numeric;
  v_warehouse_id         uuid;
  v_sales_acct           uuid;
  v_recv_acct            uuid;
  v_inv_acct             uuid;
  v_cogs_acct            uuid;
  v_total_books          numeric;
  v_cost_books           numeric;
  v_journal_lines        jsonb := '[]'::jsonb;
  v_journal_id           uuid;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNTING_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF p_fraction_digits IS NULL OR p_fraction_digits < 0 OR p_fraction_digits > 4 THEN
    RAISE EXCEPTION 'INVALID_FRACTION_DIGITS' USING ERRCODE = 'P0001';
  END IF;

  v_factor := POWER(10, p_fraction_digits)::numeric;

  v_invoice_id    := (p_return ->> 'originalInvoiceId')::uuid;
  v_return_type   := COALESCE(p_return ->> 'returnType', 'sale_return');
  v_return_number := TRIM(p_return ->> 'returnNumber');
  v_return_date   := COALESCE(NULLIF(p_return ->> 'returnDate', '')::date, CURRENT_DATE);

  IF v_invoice_id IS NULL OR v_return_number IS NULL OR v_return_number = '' THEN
    RAISE EXCEPTION 'INVALID_RETURN_PARAMETERS' USING ERRCODE = 'P0001';
  END IF;

  -- 1. Tenant boundary & Concurrency lock: lock the invoice row
  SELECT * INTO v_invoice
    FROM public.invoices
   WHERE id = v_invoice_id
     AND workspace_id = p_workspace_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Idempotency check: replay of existing return returns existing document
  SELECT id INTO v_existing_id
    FROM public.invoice_returns
   WHERE workspace_id = p_workspace_id
     AND original_invoice_id = v_invoice_id
     AND return_number = v_return_number;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', v_existing_id,
      'workspaceId', p_workspace_id,
      'originalInvoiceId', v_invoice_id,
      'returnNumber', v_return_number,
      'idempotentReplay', true
    );
  END IF;

  -- NULL exchange_rate = the invoice is in the books currency = rate 1. The previous
  -- CASE returned v_invoice.exchange_rate itself when it was NULL, so the journal
  -- amount became NULL and the ledger refused it (JOURNAL_ENTRY_EMPTY).
  v_rate := COALESCE(NULLIF(v_invoice.exchange_rate, 0), 1);
  v_return_id := gen_random_uuid();

  -- 3. Validate and calculate each return line
  FOR v_line_elem IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_orig_line_id   := (v_line_elem ->> 'originalLineId')::uuid;
    v_qty            := (v_line_elem ->> 'quantity')::numeric;
    v_restock_choice := COALESCE(v_line_elem ->> 'restockChoice', 'restock');
    v_reason_code    := COALESCE(v_line_elem ->> 'reasonCode', 'return');

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'INVALID_RETURN_QUANTITY' USING ERRCODE = 'P0001';
    END IF;

    -- Verify line belongs to this invoice and workspace
    SELECT * INTO v_item
      FROM public.invoice_items
     WHERE id = v_orig_line_id
       AND invoice_id = v_invoice_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVOICE_LINE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    -- Cumulative over-return guard
    SELECT COALESCE(SUM(irl.quantity), 0) INTO v_prior_returned
      FROM public.invoice_return_lines irl
      JOIN public.invoice_returns ir ON ir.id = irl.return_id
     WHERE ir.workspace_id = p_workspace_id
       AND ir.original_invoice_id = v_invoice_id
       AND irl.original_line_id = v_orig_line_id;

    IF (v_prior_returned + v_qty) > v_item.quantity THEN
      RAISE EXCEPTION 'RETURN_QUANTITY_EXCEEDS_ORIGINAL' USING ERRCODE = 'P0001';
    END IF;

    -- Proportional monetary calculations in minor units (using minor unit scaling factor)
    v_subtotal_minor := ROUND(v_qty * v_item.unit_price * v_factor);
    v_discount_minor := CASE WHEN v_item.quantity > 0
                             THEN ROUND((v_qty / v_item.quantity) * COALESCE(v_item.discount, 0) * v_factor)
                             ELSE 0 END;
    v_tax_minor      := 0;
    v_total_minor    := v_subtotal_minor - v_discount_minor + v_tax_minor;

    v_tot_subtotal_minor := v_tot_subtotal_minor + v_subtotal_minor;
    v_tot_discount_minor := v_tot_discount_minor + v_discount_minor;
    v_tot_tax_minor      := v_tot_tax_minor + v_tax_minor;
    v_tot_grand_minor    := v_tot_grand_minor + v_total_minor;

    -- Cost restoration at ORIGINAL consumed unit cost
    SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(quantity), 0)
      INTO v_consumed_amount, v_consumed_qty
      FROM public.cost_consumptions
     WHERE workspace_id = p_workspace_id
       AND consumer_type = 'invoice'
       AND consumer_id = v_invoice_id
       AND product_id = v_item.product_id
       AND quantity > 0;

    -- ⚠️ `invoice_items` has NO warehouse_id column (the warehouse lives on the
    -- invoice header). Reading `v_item.warehouse_id` raised 42703 «record has no
    -- field» on every call — found on production, 27 Oct 2026.
    v_warehouse_id := v_invoice.warehouse_id;

    IF v_restock_choice = 'restock' THEN
      -- Physical movement back into warehouse
      IF v_warehouse_id IS NOT NULL THEN
        -- `stock_movements.type` is NOT NULL with no default. Goods coming back
        -- are recorded the way InvoiceService's own reversal records them
        -- (netReversal: an inflow of a sale is `type: 'purchase'`, direction from
        -- `to_warehouse_id`), so every reader of the movements sees one convention.
        INSERT INTO public.stock_movements (
          workspace_id, user_id, product_id, type, quantity, to_warehouse_id,
          reference_type, reference_id, created_at
        ) VALUES (
          p_workspace_id, p_user_id, v_item.product_id, 'purchase', v_qty, v_warehouse_id,
          'invoice_return', v_return_id, now()
        );
      END IF;

      -- Unknown cost rule: when cost_consumptions has no row (v_consumed_qty = 0),
      -- restock physical quantity into stock_movements, but do NOT write zero cost to cost_consumptions
      -- and do NOT post COGS reversal; mark unknown (enters unvalued stock pipeline).
      IF v_consumed_qty > 0 THEN
        v_unit_cost := v_consumed_amount / v_consumed_qty;
        v_line_cost := ROUND(v_qty * v_unit_cost, 4);
        v_line_restored_minor := ROUND(v_line_cost * v_factor);

        -- Restore remaining_qty on original cost layers
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

        -- Record negative consumption row in cost_consumptions
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
        -- Original cost consumption missing: cost is UNKNOWN.
        -- Do not write zero cost; leave restored_cost_minor as NULL.
        v_line_restored_minor := NULL;
        v_has_unknown_cost := true;
      END IF;
    ELSE
      -- Scrap: no physical stock restoration and no cost restoration
      v_line_restored_minor := NULL;
    END IF;

    -- Insert return line
    INSERT INTO public.invoice_return_lines (
      id, workspace_id, return_id, original_line_id, product_id,
      quantity, restock_choice, reason_code, subtotal_minor,
      discount_minor, tax_minor, total_minor, restored_cost_minor,
      created_at
    ) VALUES (
      gen_random_uuid(), p_workspace_id, v_return_id, v_orig_line_id, v_item.product_id,
      v_qty, v_restock_choice, v_reason_code, v_subtotal_minor,
      v_discount_minor, v_tax_minor, v_total_minor, v_line_restored_minor,
      now()
    );
  END LOOP;

  -- 4. Determine cost status
  IF v_has_restored_cost THEN
    v_cost_status := 'restored';
  ELSIF v_has_unknown_cost THEN
    v_cost_status := 'unknown';
  ELSE
    v_cost_status := 'not_applicable';
  END IF;

  -- 5. Insert return header
  INSERT INTO public.invoice_returns (
    id, workspace_id, original_invoice_id, return_type, return_number,
    return_date, total_subtotal_minor, total_discount_minor,
    total_tax_minor, grand_total_minor, created_at
  ) VALUES (
    v_return_id, p_workspace_id, v_invoice_id, v_return_type, v_return_number,
    v_return_date, v_tot_subtotal_minor, v_tot_discount_minor,
    v_tot_tax_minor, v_tot_grand_minor, now()
  );

  -- 6. Ledger Reversal Posting & Mandatory Account Checks
  IF v_tot_grand_minor > 0 THEN
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

    v_total_books := ROUND(((v_tot_grand_minor::numeric / v_factor) * v_rate), 2);

    v_journal_lines := jsonb_build_array(
      jsonb_build_object('account_id', v_sales_acct, 'debit', v_total_books, 'credit', 0),
      jsonb_build_object('account_id', v_recv_acct, 'debit', 0, 'credit', v_total_books)
    );

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

    -- Call accounting_post_journal_entry in the same transaction
    v_journal_id := public.accounting_post_journal_entry(
      p_workspace_id,
      p_user_id,
      jsonb_build_object(
        'date', v_return_date::text,
        'description', 'برگشت فاکتور فروش ' || COALESCE(v_invoice.invoice_number, ''),
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
    'grandTotalMinor', v_tot_grand_minor,
    'restoredCostMinor', CASE WHEN v_cost_status = 'restored' THEN ROUND(v_tot_restored_cost * v_factor) ELSE NULL END,
    'costStatus', v_cost_status,
    'journalEntryId', v_journal_id
  );
END;
$fn$;

-- ── 3. Hardened Permissions ────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.invoice_return_create(uuid, uuid, integer, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoice_return_create(uuid, uuid, integer, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.invoice_return_create(uuid, uuid, integer, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_return_create(uuid, uuid, integer, jsonb, jsonb) TO service_role;
