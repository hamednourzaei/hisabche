-- ============================================================================
-- docs/profit-ledger-totals-01-migration.sql
--
-- M5 / C2: the profit report takes its headline figures from the LEDGER. This adds ONE read-only function that sums the posted
-- journal by account role over a window, in the books currency:
--   revenue        net credit of the sales accounts   (package revenue appears here only when a delivery released it)
--   cost           net debit of the cost-of-sales accounts
--   inventory_loss net debit of the inventory-loss accounts (scrapped returns; moved out of cost of sales, total expense unchanged)
-- Additive, idempotent, no table touched. NOT RUN by the agent.
-- RUN ORDER: after the four M5 migrations (it only reads accounts and the journal). Verify with docs/VERIFY-profit-ledger-totals-01.sql.
-- ROLLBACK: DROP FUNCTION IF EXISTS public.accounting_profit_ledger_totals(uuid, date, date);
-- ============================================================================
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

NOTIFY pgrst, 'reload schema';
