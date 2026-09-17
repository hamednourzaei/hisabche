-- ============================================================================
-- docs/customer-debt-cancelled-fix-migration.sql
--
-- BUG-011: the customer debt report (accounting_customer_debt) counted
-- CANCELLED invoices as debt (status <> 'paid' lets 'cancelled' through) and
-- PURCHASE invoices carrying a customer_id as money the customer owes us.
-- Customer 360 (payments.domain#summarizeParty) already excludes both, so the
-- two screens disagreed about the same customer.
--
-- CREATE OR REPLACE of the same signature: nothing dropped, safe to re-run.
-- Grants are re-stated exactly as in perf-aggregates-ledger-migration.sql.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.accounting_customer_debt(
  p_workspace_id uuid
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  WITH open_invoices AS (
    SELECT i.customer_id,
           SUM(i.total - COALESCE(i.paid_amount, 0)) AS open_balance,
           COUNT(*)                                  AS cnt
    FROM invoices i
    WHERE i.workspace_id = p_workspace_id
      AND i.status NOT IN ('paid', 'cancelled')
      AND COALESCE(i.type, 'sale') <> 'purchase'
      AND i.customer_id IS NOT NULL
    GROUP BY i.customer_id
  ),
  balances AS (
    SELECT c.full_name                                               AS name,
           COALESCE(c.opening_balance, 0) + COALESCE(o.open_balance, 0) AS balance,
           COALESCE(o.cnt, 0)                                        AS total_invoices
    FROM customers c
    LEFT JOIN open_invoices o ON o.customer_id = c.id
    WHERE c.workspace_id = p_workspace_id
      AND c.is_active = true
  )
  SELECT jsonb_build_object(
    'debtors',   COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', b.name, 'balance', b.balance, 'total_invoices', b.total_invoices) ORDER BY b.balance DESC)
        FROM balances b WHERE b.balance > 0
      ), '[]'::jsonb),
    'creditors', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', b.name, 'balance', b.balance, 'total_invoices', b.total_invoices) ORDER BY b.balance ASC)
        FROM balances b WHERE b.balance < 0
      ), '[]'::jsonb)
  );
$fn$;

REVOKE EXECUTE ON FUNCTION public.accounting_customer_debt(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accounting_customer_debt(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accounting_customer_debt(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.accounting_customer_debt(uuid) TO service_role;

COMMIT;

-- ============================================================================
-- ROLLBACK: re-run section 1 of docs/perf-aggregates-ledger-migration.sql
-- (the previous body). The backend works with either version.
--
-- VERIFY (read-only) — every row ok = true:
--
--   SELECT 'excludes cancelled' AS item,
--          pg_get_functiondef('public.accounting_customer_debt(uuid)'::regprocedure)
--            LIKE '%NOT IN (''paid'', ''cancelled'')%' AS ok
--   UNION ALL
--   SELECT 'excludes purchases',
--          pg_get_functiondef('public.accounting_customer_debt(uuid)'::regprocedure)
--            LIKE '%<> ''purchase''%'
--   UNION ALL
--   SELECT 'not executable by authenticated',
--          NOT has_function_privilege('authenticated', 'public.accounting_customer_debt(uuid)', 'EXECUTE');
-- ============================================================================
