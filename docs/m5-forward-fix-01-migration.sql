-- ============================================================================
-- docs/m5-forward-fix-01-migration.sql
--
-- M5 FORWARD-FIX. One idempotent file that brings the objects whose definition CHANGED after they were first written to their
-- CURRENT definition, for a database that ran an earlier copy of an M5 file. It is a no-op on a database that already runs the
-- current definitions, it is safe to run twice, and it is safe whether or not the edited originals were re-run. Additive: it only
-- replaces functions and re-creates triggers; no table, row or privilege is dropped or rewritten.
--
-- WHAT CHANGED AFTER FIRST AUTHORING (and why a forward-fix exists)
--   rev2 accounting_deferred_revenue_change / accounting_profit_ledger_totals
--        BUG FIXED: they summed only status = 'posted'. Cancelling a document sets the ORIGINAL entry to 'reversed' and posts the
--        offsetting entry as 'posted'; keeping one of the two deducted a cancelled amount twice. Both statuses now count.
--   rev2 package_credit_allocate        suspensions became append-only SUSPEND / RESUME events (was an interval shape)
--   rev2 invoice_write_document (11 arg) parameters after p_movements have no defaults (the first copy was not valid SQL), and the
--        GRANT rows are inserted inside the function (no dependency on the document_write_rows whitelist)
--   rev2 invoice_return_scrap_loss      unchanged logic; markers only
--
-- WHAT IT CANNOT FIX (the state probe reports these as S4 - do not hand-edit)
--   * a package_credit_suspensions table created by an earlier INTERVAL-shaped copy (CREATE TABLE IF NOT EXISTS never alters it)
--   * any M5 table or column that does not exist at all (run the originals first)
--
-- RUN ORDER: after the five original M5 files (it replaces functions that those files create). Verify with
-- docs/PROBE-m5-state.sql then docs/VERIFY-m5-combined.sql.
--
-- VERSION MARKERS: every replaced function gets COMMENT 'm5:<object>:rev<N>' so docs/PROBE-m5-state.sql can read the installed
-- version without writing anything. rev1 = the first authoring (no comment); rev2 = this file.
--
-- ORIGINALS THIS FILE WAS GENERATED FROM (sha256, at generation time; a guard test fails if a block below drifts from them):
--   a3ea12702d3ef18fa4eeeeb58379e34a2fbd76216bc433efa4e85bf57e586c7f  docs/accounts-role-deferred-and-loss-01-migration.sql
--   e48ece59b41a4fe7a63b63c612f87de8235a5598fb7cbed97136d80e2ac2878b  docs/invoice-write-grant-01-migration.sql
--   cfaaaca18d7beefb36ded28bff9b6b73cd4f810f72e6bb272465de21d38cd6c9  docs/package-deferred-revenue-01-migration.sql
--   01b48bb69ac7932d055e405a9385b6bb76acc6e67c5843a3785ce2ffa3a8ce96  docs/invoice-return-06-scrap-loss-migration.sql
--   55e1e0f7637f5d1944aa9df76a069b50ac5e7cd301ea766997f251335eca7a41  docs/profit-ledger-totals-01-migration.sql
--
-- ROLLBACK: none needed for history; to go back to an older function body re-run the older file copy. Nothing here edits data.
-- ============================================================================

-- 1. package_credit_allocate + its trigger -------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.package_credit_allocate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_grant        public.package_credit_ledger%ROWTYPE;
  v_need         numeric;
  v_legacy_left  numeric;
  v_activated    date;
  v_consumed     numeric;
  v_released     numeric;
  v_adjust       numeric;
  v_legacy_take  numeric;
  v_avail        numeric;
  v_take         numeric;
  v_remaining    numeric;
  v_release      numeric;
  v_total        numeric := 0;
  v_unattr       numeric;
  v_def_acct     uuid;
  v_sales_acct   uuid;
  v_orig_journal uuid;
  v_rev          record;
  v_orig         public.package_credit_ledger%ROWTYPE;
BEGIN
  IF NEW.entry_type = 'CONSUME' THEN
    -- Serialise on the customer exactly as package_credit_consume and the delivery function do (re-entrant).
    PERFORM 1 FROM public.customers WHERE id = NEW.customer_id AND workspace_id = NEW.workspace_id FOR UPDATE;

    v_need := NEW.quantity;

    -- Consumptions written before this migration have no allocation: charge them, oldest first, to GRANTs that carry no
    -- deferred amount (they were sold before the cut-over). Never counted twice, never released.
    SELECT COALESCE(SUM(CASE WHEN c.entry_type = 'CONSUME' THEN c.quantity ELSE -c.quantity END), 0)
      INTO v_legacy_left
      FROM public.package_credit_ledger c
     WHERE c.workspace_id = NEW.workspace_id AND c.customer_id = NEW.customer_id
       AND c.package_product_id = NEW.package_product_id AND c.deleted_at IS NULL
       AND c.id <> NEW.id
       AND c.entry_type IN ('CONSUME', 'REVERSAL')
       AND NOT EXISTS (SELECT 1 FROM public.package_credit_allocations a WHERE a.entry_id = c.id)
       AND NOT (c.entry_type = 'REVERSAL' AND EXISTS (
             SELECT 1 FROM public.package_credit_allocations a2 WHERE a2.entry_id = c.reference_entry_id));
    v_legacy_left := GREATEST(v_legacy_left, 0);

    FOR v_grant IN
      SELECT g.* FROM public.package_credit_ledger g
       WHERE g.workspace_id = NEW.workspace_id AND g.customer_id = NEW.customer_id
         AND g.package_product_id = NEW.package_product_id
         AND g.entry_type = 'GRANT' AND g.deleted_at IS NULL
       ORDER BY g.effective_date, g.id
    LOOP
      EXIT WHEN v_need <= 0;

      SELECT COALESCE(SUM(CASE a.kind WHEN 'CONSUME' THEN a.quantity ELSE -a.quantity END), 0),
             COALESCE(SUM(CASE a.kind WHEN 'CONSUME' THEN a.released_amount ELSE -a.released_amount END), 0)
        INTO v_consumed, v_released
        FROM public.package_credit_allocations a
       WHERE a.grant_entry_id = v_grant.id;

      SELECT COALESCE(SUM(j.quantity), 0) INTO v_adjust
        FROM public.package_credit_ledger j
       WHERE j.workspace_id = NEW.workspace_id AND j.entry_type = 'ADJUSTMENT'
         AND j.reference_entry_id = v_grant.id AND j.deleted_at IS NULL;

      v_legacy_take := 0;
      IF v_grant.deferred_amount IS NULL AND v_legacy_left > 0 THEN
        v_legacy_take := LEAST(v_legacy_left, GREATEST(v_grant.quantity + v_adjust - v_consumed, 0));
        v_legacy_left := v_legacy_left - v_legacy_take;
      END IF;

      -- Eligibility: not before the sale, not past the end of the term (which starts at the first valid consume),
      -- not inside a suspension of THIS GRANT.
      CONTINUE WHEN NEW.effective_date < v_grant.effective_date;

      SELECT MIN(c.effective_date) INTO v_activated
        FROM public.package_credit_allocations a
        JOIN public.package_credit_ledger c ON c.id = a.entry_id
       WHERE a.grant_entry_id = v_grant.id AND a.kind = 'CONSUME'
         AND NOT EXISTS (SELECT 1 FROM public.package_credit_ledger r
                          WHERE r.entry_type = 'REVERSAL' AND r.reference_entry_id = c.id AND r.deleted_at IS NULL);

      CONTINUE WHEN v_grant.term_months IS NOT NULL AND v_activated IS NOT NULL
                AND NEW.effective_date > (v_activated + make_interval(months => v_grant.term_months))::date;

      -- The last suspension event on or before the day decides: SUSPEND stops THIS GRANT only, RESUME lifts it.
      CONTINUE WHEN COALESCE((
        SELECT s.kind FROM public.package_credit_suspensions s
         WHERE s.grant_entry_id = v_grant.id AND s.effective_on <= NEW.effective_date
         ORDER BY s.effective_on DESC, s.created_at DESC, s.id DESC LIMIT 1), 'RESUME') = 'SUSPEND';

      v_avail := round(v_grant.quantity + v_adjust - v_consumed - v_legacy_take, 4);
      CONTINUE WHEN v_avail <= 0;

      v_take := LEAST(v_need, v_avail);
      v_release := 0;
      IF v_grant.deferred_amount IS NOT NULL THEN
        v_remaining := GREATEST(0, round(v_grant.deferred_amount - v_released, 2));
        IF v_take = v_avail AND v_adjust = 0 THEN
          v_release := v_remaining;
        ELSE
          v_release := LEAST(v_remaining, round(v_take * v_grant.deferred_amount / v_grant.quantity, 2));
        END IF;

        -- The sale must be in the books before a single cent of it is released.
        IF v_release > 0 AND NOT EXISTS (
             SELECT 1 FROM public.journal_entries je
              WHERE je.workspace_id = NEW.workspace_id AND je.source_type = 'invoice'
                AND je.source_id = v_grant.source_document_id AND je.status <> 'cancelled') THEN
          RAISE EXCEPTION 'PACKAGE_INVOICE_NOT_BOOKED: the invoice that sold this package has no journal entry' USING ERRCODE = 'P0001';
        END IF;
      END IF;

      INSERT INTO public.package_credit_allocations
        (workspace_id, entry_id, kind, grant_entry_id, quantity, released_amount, effective_date)
      VALUES (NEW.workspace_id, NEW.id, 'CONSUME', v_grant.id, v_take, v_release, NEW.effective_date);

      v_total := round(v_total + v_release, 2);
      v_need := round(v_need - v_take, 4);
    END LOOP;

    IF v_need > 0 THEN
      -- Balance no GRANT owns (a manual top-up): used only after every GRANT, releases nothing.
      SELECT COALESCE(SUM(j.quantity), 0) INTO v_unattr
        FROM public.package_credit_ledger j
       WHERE j.workspace_id = NEW.workspace_id AND j.customer_id = NEW.customer_id
         AND j.package_product_id = NEW.package_product_id AND j.entry_type = 'ADJUSTMENT'
         AND j.reference_entry_id IS NULL AND j.quantity > 0 AND j.deleted_at IS NULL;
      v_unattr := v_unattr - COALESCE((
        SELECT SUM(CASE a.kind WHEN 'CONSUME' THEN a.quantity ELSE -a.quantity END)
          FROM public.package_credit_allocations a
          JOIN public.package_credit_ledger c ON c.id = a.entry_id
         WHERE a.grant_entry_id IS NULL AND c.customer_id = NEW.customer_id
           AND c.package_product_id = NEW.package_product_id), 0);
      IF v_need > v_unattr THEN
        RAISE EXCEPTION 'INSUFFICIENT_ELIGIBLE_PACKAGE_CREDIT: % unit(s) no eligible GRANT could cover', v_need
          USING ERRCODE = 'P0001';
      END IF;
      INSERT INTO public.package_credit_allocations
        (workspace_id, entry_id, kind, grant_entry_id, quantity, released_amount, effective_date)
      VALUES (NEW.workspace_id, NEW.id, 'CONSUME', NULL, v_need, 0, NEW.effective_date);
    END IF;

    IF v_total > 0 THEN
      SELECT id INTO v_def_acct FROM public.accounts
       WHERE workspace_id = NEW.workspace_id AND role = 'deferred_revenue' AND deleted_at IS NULL AND is_active = true LIMIT 1;
      IF v_def_acct IS NULL THEN
        RAISE EXCEPTION 'DEFERRED_REVENUE_ACCOUNT_MISSING' USING ERRCODE = 'P0001';
      END IF;
      SELECT id INTO v_sales_acct FROM public.accounts
       WHERE workspace_id = NEW.workspace_id AND role = 'sales' AND deleted_at IS NULL AND is_active = true LIMIT 1;
      IF v_sales_acct IS NULL THEN
        RAISE EXCEPTION 'SALES_ACCOUNT_MISSING' USING ERRCODE = 'P0001';
      END IF;
      PERFORM public.accounting_post_journal_entry(
        NEW.workspace_id, NULL,
        jsonb_build_object('date', NEW.effective_date::text,
                           'description', 'Package delivery: deferred revenue released',
                           'reference', NEW.id::text, 'status', 'posted',
                           'source_type', 'package_release', 'source_id', NEW.id::text),
        jsonb_build_array(
          jsonb_build_object('account_id', v_def_acct, 'debit', v_total, 'credit', 0),
          jsonb_build_object('account_id', v_sales_acct, 'debit', 0, 'credit', v_total)));
    END IF;

  ELSIF NEW.entry_type = 'REVERSAL' THEN
    -- Give back exactly what the CONSUME allocated and released; a REVERSAL of anything else changes nothing here.
    SELECT * INTO v_orig FROM public.package_credit_ledger
     WHERE id = NEW.reference_entry_id AND workspace_id = NEW.workspace_id AND entry_type = 'CONSUME';
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.package_credit_allocations
      (workspace_id, entry_id, kind, grant_entry_id, quantity, released_amount, effective_date)
    SELECT a.workspace_id, NEW.id, 'REVERSAL', a.grant_entry_id, a.quantity, a.released_amount, NEW.effective_date
      FROM public.package_credit_allocations a
     WHERE a.entry_id = v_orig.id AND a.kind = 'CONSUME';

    SELECT COALESCE(SUM(a.released_amount), 0) INTO v_total
      FROM public.package_credit_allocations a WHERE a.entry_id = v_orig.id AND a.kind = 'CONSUME';

    IF v_total > 0 THEN
      SELECT id INTO v_orig_journal FROM public.journal_entries
       WHERE workspace_id = NEW.workspace_id AND source_type = 'package_release'
         AND source_id = v_orig.id AND status <> 'cancelled' LIMIT 1;
      IF v_orig_journal IS NULL THEN
        RAISE EXCEPTION 'PACKAGE_RELEASE_ENTRY_MISSING: the release being reversed was never posted' USING ERRCODE = 'P0001';
      END IF;
      SELECT id INTO v_def_acct FROM public.accounts
       WHERE workspace_id = NEW.workspace_id AND role = 'deferred_revenue' AND deleted_at IS NULL AND is_active = true LIMIT 1;
      SELECT id INTO v_sales_acct FROM public.accounts
       WHERE workspace_id = NEW.workspace_id AND role = 'sales' AND deleted_at IS NULL AND is_active = true LIMIT 1;
      IF v_def_acct IS NULL OR v_sales_acct IS NULL THEN
        RAISE EXCEPTION 'DEFERRED_REVENUE_ACCOUNT_MISSING' USING ERRCODE = 'P0001';
      END IF;
      PERFORM public.accounting_post_journal_entry(
        NEW.workspace_id, NULL,
        jsonb_build_object('date', NEW.effective_date::text,
                           'description', 'Package delivery cancelled: deferred revenue restored',
                           'reference', NEW.id::text, 'status', 'posted',
                           'source_type', 'package_release_reversal', 'source_id', NEW.id::text,
                           'reversal_of', v_orig_journal::text),
        jsonb_build_array(
          jsonb_build_object('account_id', v_sales_acct, 'debit', v_total, 'credit', 0),
          jsonb_build_object('account_id', v_def_acct, 'debit', 0, 'credit', v_total)));
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.package_credit_allocate() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_package_credit_allocate ON public.package_credit_ledger;
CREATE TRIGGER trg_package_credit_allocate
  AFTER INSERT ON public.package_credit_ledger
  FOR EACH ROW
  WHEN (NEW.entry_type IN ('CONSUME', 'REVERSAL'))
  EXECUTE FUNCTION public.package_credit_allocate();

COMMENT ON FUNCTION public.package_credit_allocate() IS 'm5:package_credit_allocate:rev2';

-- 2. the two ledger sums the profit report reads ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_deferred_revenue_change(
  p_workspace_id uuid, p_from date, p_to date
) RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT COALESCE(SUM(jl.credit - jl.debit), 0)
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON je.id = jl.journal_id
    JOIN public.accounts a ON a.id = jl.account_id
   WHERE je.workspace_id = p_workspace_id AND a.workspace_id = p_workspace_id
     -- 'reversed' originals COUNT: the reversal entry that cancels them is 'posted', and a sum that kept only one of the
     -- two would be wrong by exactly the reversed amount
     AND a.role = 'deferred_revenue' AND je.status IN ('posted', 'reversed')
     AND je.date >= p_from AND je.date <= p_to;
$fn$;

REVOKE ALL ON FUNCTION public.accounting_deferred_revenue_change(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_deferred_revenue_change(uuid, date, date) TO service_role;
COMMENT ON FUNCTION public.accounting_deferred_revenue_change(uuid, date, date) IS 'm5:accounting_deferred_revenue_change:rev2';

CREATE OR REPLACE FUNCTION public.accounting_profit_ledger_totals(
  p_workspace_id uuid, p_from date, p_to date
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_build_object(
    'revenue',        COALESCE(SUM(jl.credit - jl.debit) FILTER (WHERE a.role = 'sales'), 0),
    'cost',           COALESCE(SUM(jl.debit - jl.credit) FILTER (WHERE a.role = 'cogs'), 0),
    'inventory_loss', COALESCE(SUM(jl.debit - jl.credit) FILTER (WHERE a.role = 'inventory_loss'), 0)
  )
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON je.id = jl.journal_id
    JOIN public.accounts a ON a.id = jl.account_id
   WHERE je.workspace_id = p_workspace_id AND a.workspace_id = p_workspace_id
     -- 'reversed' originals COUNT: the reversal entry that cancels them is 'posted'
     AND je.status IN ('posted', 'reversed') AND je.date >= p_from AND je.date <= p_to
     AND a.role IN ('sales', 'cogs', 'inventory_loss');
$fn$;

REVOKE ALL ON FUNCTION public.accounting_profit_ledger_totals(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_profit_ledger_totals(uuid, date, date) TO service_role;
COMMENT ON FUNCTION public.accounting_profit_ledger_totals(uuid, date, date) IS 'm5:accounting_profit_ledger_totals:rev2';

-- 3. the invoice write with GRANT rows inside the same transaction ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoice_write_document(
  p_workspace_id uuid,
  p_invoice_id uuid,
  -- The actor, recorded on reversal movements. Never a filter.
  p_user_id uuid,
  -- The header row for a NEW invoice. NULL for an edit.
  p_header jsonb,
  p_items jsonb,
  p_details jsonb,
  p_movements jsonb,
  -- Edit: delete the old lines and give back EXACTLY the stock they moved.
  p_replace_items boolean,
  -- Edit: the header's money, derived from the new lines by the backend.
  p_header_patch jsonb,
  -- Edit: the version the editor read. NULL = no check (metadata-free callers).
  p_expected_version bigint,
  -- M5 Slice D: Atomic Package Credit Grants
  p_grants jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bad int;
  v_row jsonb;
  v_cols text;
  v_grant_cols text;
BEGIN
  IF p_workspace_id IS NULL OR p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'invoice_write_document: workspace and invoice are required' USING ERRCODE = '22023';
  END IF;

  -- ── Every row belongs to THIS workspace and THIS invoice ─────────────────
  IF p_header IS NOT NULL AND (
       (p_header ->> 'workspace_id')::uuid IS DISTINCT FROM p_workspace_id
    OR (p_header ->> 'id')::uuid IS DISTINCT FROM p_invoice_id) THEN
    RAISE EXCEPTION 'invoice_write_document: header does not match workspace/invoice' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_bad FROM jsonb_array_elements(coalesce(p_items, '[]')) r
   WHERE (r ->> 'invoice_id')::uuid IS DISTINCT FROM p_invoice_id OR (r ->> 'id') IS NULL;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'invoice_write_document: an item names another invoice' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_bad FROM jsonb_array_elements(coalesce(p_details, '[]')) d
   WHERE NOT EXISTS (
     SELECT 1 FROM jsonb_array_elements(coalesce(p_items, '[]')) r
      WHERE r ->> 'id' = d ->> 'invoice_item_id');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'invoice_write_document: a detail names an item outside this write' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_bad FROM jsonb_array_elements(coalesce(p_movements, '[]')) m
   WHERE (m ->> 'workspace_id')::uuid IS DISTINCT FROM p_workspace_id
      OR (m ->> 'reference_id')::uuid IS DISTINCT FROM p_invoice_id
      OR (m ->> 'reference_type') IS DISTINCT FROM 'invoice';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'invoice_write_document: a stock movement names another workspace or document' USING ERRCODE = '42501';
  END IF;

  -- M5 SLICE D: Validate atomic grant rows
  SELECT count(*) INTO v_bad FROM jsonb_array_elements(coalesce(p_grants, '[]')) g
   WHERE (g ->> 'workspace_id')::uuid IS DISTINCT FROM p_workspace_id
      OR (g ->> 'source_document_id')::uuid IS DISTINCT FROM p_invoice_id
      OR (g ->> 'source_document_type') IS DISTINCT FROM 'invoice'
      OR (g ->> 'entry_type') IS DISTINCT FROM 'GRANT';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'invoice_write_document: a grant names another workspace or document' USING ERRCODE = '42501';
  END IF;

  -- ── The document ─────────────────────────────────────────────────────────
  IF p_header IS NOT NULL THEN
    PERFORM public.document_write_rows('invoices', jsonb_build_array(p_header));
  ELSE
    SELECT to_jsonb(i) INTO v_row
      FROM public.invoices i
     WHERE i.id = p_invoice_id AND i.workspace_id = p_workspace_id
       FOR UPDATE;
    IF v_row IS NULL THEN
      RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF p_expected_version IS NOT NULL
       AND (v_row ->> 'version')::bigint IS DISTINCT FROM p_expected_version THEN
      RAISE EXCEPTION 'INVOICE_VERSION_CONFLICT' USING ERRCODE = '40001';
    END IF;
    IF p_replace_items AND (v_row ->> 'finalized_at') IS NOT NULL THEN
      RAISE EXCEPTION 'INVOICE_FINALIZED' USING ERRCODE = '55000';
    END IF;

    IF p_header_patch IS NOT NULL AND p_header_patch <> '{}'::jsonb THEN
      IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_header_patch) k
                  WHERE k NOT IN ('subtotal', 'discount_total', 'tax_total', 'total', 'updated_at')) THEN
        RAISE EXCEPTION 'invoice_write_document: the patch may only set the derived money' USING ERRCODE = '42501';
      END IF;
      SELECT string_agg(quote_ident(k), ', ' ORDER BY k) INTO v_cols
        FROM jsonb_object_keys(p_header_patch) k;
      EXECUTE format(
        'UPDATE public.invoices SET (%s) = (SELECT %s FROM jsonb_populate_record(NULL::public.invoices, $1)) WHERE id = $2 AND workspace_id = $3',
        v_cols, v_cols
      ) USING p_header_patch, p_invoice_id, p_workspace_id;
    END IF;
  END IF;

  IF p_replace_items THEN
    INSERT INTO public.stock_movements
      (product_id, type, quantity, reference_type, reference_id,
       from_warehouse_id, to_warehouse_id, workspace_id, user_id)
    SELECT t.product_id,
           CASE WHEN t.net < 0 THEN 'purchase' ELSE 'sale' END,
           -t.net,
           'invoice',
           p_invoice_id,
           CASE WHEN t.net > 0 THEN t.wh END,
           CASE WHEN t.net < 0 THEN t.wh END,
           p_workspace_id,
           p_user_id
      FROM (
        SELECT product_id,
               coalesce(from_warehouse_id, to_warehouse_id) AS wh,
               sum(quantity) AS net
          FROM public.stock_movements
         WHERE workspace_id = p_workspace_id
           AND reference_type = 'invoice'
           AND reference_id = p_invoice_id
         GROUP BY 1, 2
      ) t
     WHERE t.net <> 0;

    DELETE FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  END IF;

  PERFORM public.document_write_rows('invoice_items', p_items);
  PERFORM public.document_write_rows('invoice_item_details', p_details);
  PERFORM public.document_write_rows('stock_movements', p_movements);

  -- M5 SLICE D: Write package credit grant rows in same transaction
  IF p_grants IS NOT NULL AND jsonb_typeof(p_grants) = 'array' AND jsonb_array_length(p_grants) > 0 THEN
    SELECT string_agg(quote_ident(k), ', ' ORDER BY k)
      INTO v_grant_cols
      FROM (SELECT DISTINCT jsonb_object_keys(g) AS k FROM jsonb_array_elements(p_grants) g) keys;
    EXECUTE format(
      'INSERT INTO public.package_credit_ledger (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.package_credit_ledger, $1)',
      v_grant_cols, v_grant_cols
    ) USING p_grants;
  END IF;

  RETURN p_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb) TO service_role;
COMMENT ON FUNCTION public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb) IS 'm5:invoice_write_document_11:rev2';

-- 4. the scrap loss trigger ------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoice_return_scrap_loss()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_line     record;
  v_amount   numeric;
  v_qty      numeric;
  v_total    numeric := 0;
  v_loss     uuid;
  v_cogs     uuid;
  v_scrapped boolean := false;
BEGIN
  IF NEW.return_type <> 'sale_return' THEN
    RETURN NEW;
  END IF;

  FOR v_line IN
    SELECT product_id, SUM(quantity) AS qty
      FROM public.invoice_return_lines
     WHERE return_id = NEW.id AND workspace_id = NEW.workspace_id AND restock_choice = 'scrap'
     GROUP BY product_id
  LOOP
    v_scrapped := true;
    SELECT SUM(amount), SUM(quantity) INTO v_amount, v_qty
      FROM public.cost_consumptions
     WHERE workspace_id = NEW.workspace_id AND consumer_type = 'invoice'
       AND consumer_id = NEW.original_invoice_id AND product_id = v_line.product_id AND quantity > 0;

    IF COALESCE(v_qty, 0) <= 0 THEN
      RAISE EXCEPTION 'SCRAP_COST_UNKNOWN: the sale recorded no cost for product %, so its loss cannot be valued', v_line.product_id
        USING ERRCODE = 'P0001';
    END IF;
    v_total := v_total + ROUND(v_line.qty * (v_amount / v_qty), 4);
  END LOOP;

  IF NOT v_scrapped THEN
    RETURN NEW;
  END IF;

  v_total := ROUND(v_total, 2);
  IF v_total <= 0 THEN
    RETURN NEW; -- goods that cost nothing lose nothing
  END IF;

  SELECT id INTO v_loss FROM public.accounts
   WHERE workspace_id = NEW.workspace_id AND role = 'inventory_loss' AND deleted_at IS NULL AND is_active = true LIMIT 1;
  IF v_loss IS NULL THEN
    RAISE EXCEPTION 'RETURN_ACCOUNTS_MISSING: inventory_loss' USING ERRCODE = 'P0001';
  END IF;
  SELECT id INTO v_cogs FROM public.accounts
   WHERE workspace_id = NEW.workspace_id AND role = 'cogs' AND deleted_at IS NULL AND is_active = true LIMIT 1;
  IF v_cogs IS NULL THEN
    RAISE EXCEPTION 'RETURN_ACCOUNTS_MISSING: cogs' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.accounting_post_journal_entry(
    NEW.workspace_id, NULL,
    jsonb_build_object('date', NEW.return_date::text,
                       'description', 'Returned goods scrapped: cost moved from cost of sales to loss',
                       'reference', NEW.return_number, 'status', 'posted',
                       'source_type', 'return_scrap_loss', 'source_id', NEW.id::text),
    jsonb_build_array(
      jsonb_build_object('account_id', v_loss, 'debit', v_total, 'credit', 0),
      jsonb_build_object('account_id', v_cogs, 'debit', 0, 'credit', v_total)));

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.invoice_return_scrap_loss() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_invoice_return_scrap_loss ON public.invoice_returns;
CREATE TRIGGER trg_invoice_return_scrap_loss
  AFTER INSERT ON public.invoice_returns
  FOR EACH ROW EXECUTE FUNCTION public.invoice_return_scrap_loss();

COMMENT ON FUNCTION public.invoice_return_scrap_loss() IS 'm5:invoice_return_scrap_loss:rev2';

NOTIFY pgrst, 'reload schema';
