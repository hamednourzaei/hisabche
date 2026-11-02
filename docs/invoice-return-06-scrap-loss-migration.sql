-- ============================================================================
-- docs/invoice-return-06-scrap-loss-migration.sql
--
-- M5 / RG-1 (owner, 2 Nov 2026): returned goods that are of no use leave the warehouse and their PURCHASE cost is booked
-- as a LOSS. Additive and idempotent. NOT RUN by the agent that wrote it.
--
-- WHAT IT DOES
--   A trigger on public.invoice_returns (AFTER INSERT) posts ONE journal entry per sale return that has `scrap` lines:
--       debit  inventory_loss   (expense)
--       credit cogs             (cost of sales)
--   at the cost the SALE consumed, valued by the same rule invoice-return-05-core-migration.sql uses to restore a
--   `restock` line (the weighted unit cost of what the invoice consumed from its cost layers - the existing costing source,
--   no new average, no manual price).
--
-- WHY CREDIT COGS AND NOT INVENTORY
--   The return core restores inventory and COGS ONLY for `restock` lines (05, the `restock` branch). For `scrap` it restores
--   nothing, so the sale's cost already sits in COGS and inventory was already credited when the goods were sold.
--   Crediting inventory again would take the goods out of stock twice. Net effect of this entry: total expense unchanged,
--   moved from cost of sales to loss; inventory untouched.
--
-- FAIL CLOSED
--   cost not determinable (the invoice consumed nothing of that product) -> SCRAP_COST_UNKNOWN, the whole return rolls back;
--   a missing inventory_loss / cogs account -> RETURN_ACCOUNTS_MISSING; a closed period -> ACCOUNTING_PERIOD_LOCKED
--   (from the journal function). Never zero, never the selling price, never a guess.
--
-- RE-RUN SAFETY: this file does not redefine invoice_return_create, so re-running 05 before or after it changes nothing here.
-- RUN ORDER: after invoice-return-05-core-migration.sql and accounts-role-deferred-and-loss-01-migration.sql.
-- Verify with docs/VERIFY-invoice-return-06.sql.
--
-- ROLLBACK:  DROP TRIGGER IF EXISTS trg_invoice_return_scrap_loss ON public.invoice_returns;
--            (entries already posted stay: they are history)
-- ============================================================================

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

NOTIFY pgrst, 'reload schema';
