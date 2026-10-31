-- ============================================================================
-- Hisabche Migration: Correct Purchase Return Accounting in invoice_return_create
-- File: docs/invoice-return-02-purchase-return-accounting-migration.sql
--
-- TARGET A1: In invoice-return-01, both sale_return and purchase_return were
-- booked as Dr Sales / Cr Accounts Receivable.
-- For a purchase return (returning merchandise to supplier):
--   • Debit Accounts Payable (reduces liability to supplier)
--   • Credit Inventory (reduces inventory asset at return value)
-- Description is 'برگشت فاکتور خرید ...'.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.invoice_return_create(
  p_workspace_id     uuid,
  p_user_id          uuid,
  p_fraction_digits  integer,
  p_return           jsonb,
  p_lines            jsonb
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
  v_orig_discount_rate  numeric(18, 6);
  v_orig_tax_rate       numeric(18, 6);
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

  IF v_invoice_id IS NULL OR v_return_type IS NULL OR v_return_number IS NULL THEN
    RAISE EXCEPTION 'INVALID_RETURN_PARAMETERS' USING ERRCODE = 'P0001';
  END IF;

  IF v_return_type NOT IN ('sale_return', 'purchase_return') THEN
    RAISE EXCEPTION 'INVALID_RETURN_TYPE: %', v_return_type USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_invoice
    FROM public.invoices
   WHERE id = v_invoice_id AND workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING ERRCODE = 'P0001';
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

    IF v_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_item
      FROM public.invoice_items
     WHERE id = v_orig_line_id AND invoice_id = v_invoice_id AND workspace_id = p_workspace_id;

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
    v_orig_tax_rate := CASE WHEN (v_item.quantity * v_item.unit_price - COALESCE(v_item.discount, 0)) > 0
                            THEN COALESCE(v_item.tax, 0) / (v_item.quantity * v_item.unit_price - COALESCE(v_item.discount, 0))
                            ELSE 0 END;

    v_subtotal_minor := ROUND((v_qty * v_orig_unit_price) * v_factor);
    v_discount_minor := ROUND((v_subtotal_minor::numeric * v_orig_discount_rate));
    v_tax_minor      := ROUND(((v_subtotal_minor - v_discount_minor)::numeric * v_orig_tax_rate));
    v_total_minor    := v_subtotal_minor - v_discount_minor + v_tax_minor;

    v_tot_subtotal_minor := v_tot_subtotal_minor + v_subtotal_minor;
    v_tot_discount_minor := v_tot_discount_minor + v_discount_minor;
    v_tot_tax_minor      := v_tot_tax_minor + v_tax_minor;
    v_tot_grand_minor    := v_tot_grand_minor + v_total_minor;

    IF v_return_type = 'sale_return' AND v_restock_choice = 'restock' AND v_item.product_id IS NOT NULL THEN
      IF v_item.buy_price IS NOT NULL AND v_item.buy_price > 0 THEN
        v_line_restored_minor := ROUND((v_qty * v_item.buy_price) * v_factor);
        v_tot_restored_cost   := v_tot_restored_cost + (v_qty * v_item.buy_price);
        v_has_restored_cost   := true;
      ELSE
        v_has_unknown_cost    := true;
        v_line_restored_minor := NULL;
      END IF;
    ELSE
      v_line_restored_minor := NULL;
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
    total_tax_minor, grand_total_minor, created_at
  ) VALUES (
    v_return_id, p_workspace_id, v_invoice_id, v_return_type, v_return_number,
    v_return_date, v_tot_subtotal_minor, v_tot_discount_minor,
    v_tot_tax_minor, v_tot_grand_minor, now()
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
    'grandTotalMinor', v_tot_grand_minor,
    'restoredCostMinor', CASE WHEN v_cost_status = 'restored' THEN ROUND(v_tot_restored_cost * v_factor) ELSE NULL END,
    'costStatus', v_cost_status,
    'journalEntryId', v_journal_id
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.invoice_return_create(uuid, uuid, integer, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoice_return_create(uuid, uuid, integer, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.invoice_return_create(uuid, uuid, integer, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_return_create(uuid, uuid, integer, jsonb, jsonb) TO service_role;
