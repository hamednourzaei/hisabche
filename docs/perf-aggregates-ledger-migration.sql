-- ============================================================================
-- docs/perf-aggregates-ledger-migration.sql
--
-- Aggregate the customer-debt report and the budget consumption check IN
-- POSTGRES.
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- (docs/VERIFY-perf-aggregates.sql)
--
-- Run AFTER docs/perf-aggregates-analytics-migration.sql (order does not
-- matter technically; it is the documented order).
--
-- ---------------------------------------------------------------------------
-- WHY
--
--   accounting_customer_debt — accounting/operational-reports.ts
--     #getCustomerDebtReport read every active customer and every open
--     invoice with no `.range()`, so PostgREST `max-rows` (1000) truncated
--     both: debtors past row 1000 vanished and totals were understated.
--     Returns ONE jsonb value so the cap cannot truncate the lists either
--     (a RETURNS TABLE function would still be capped at 1000 rows).
--
--   budget_consumption — budgeting/budget.service.ts#consumptionFor
--     summed journal lines under `.limit(10_000)` (PostgREST cuts that to
--     1000) and commitments under `.limit(5000)`. That figure decides whether
--     spending is BLOCKED, so an understated actual let spending through.
--
-- ---------------------------------------------------------------------------
-- SECURITY — same pattern and same obligation as the analytics migration:
-- SECURITY DEFINER + trusted p_workspace_id, called only by the service-role
-- backend after requireWorkspaceContext. REVOKEd from PUBLIC / anon /
-- authenticated immediately after creation; guarded by
-- backend/src/__tests__/perf-aggregates-guard.test.ts.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
--   DROP FUNCTION IF EXISTS public.accounting_customer_debt(uuid);
--   DROP FUNCTION IF EXISTS public.budget_consumption(uuid, uuid, uuid, date, date);
--   DROP INDEX IF EXISTS public.journal_lines_workspace_id_account_id_idx;
--
-- Safe: a missing function (PGRST202 / 42883) makes the backend log and fall
-- back to the previous row-by-row path. No data is touched.
--
-- ADDITIVE / IDEMPOTENT. SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- The budget check filters journal lines by (workspace_id, account_id).
CREATE INDEX IF NOT EXISTS journal_lines_workspace_id_account_id_idx
  ON public.journal_lines (workspace_id, account_id);

-- ---------------------------------------------------------------------------
-- 1. accounting_customer_debt
--
-- balance = opening_balance + Σ(total − paid_amount) over invoices whose
-- status <> 'paid'. ⚠️ `<>` on purpose: the JS path used PostgREST
-- `.neq('status', 'paid')`, which EXCLUDES a NULL status. Kept identical.
-- Only active customers; a zero balance is neither debtor nor creditor.
-- ---------------------------------------------------------------------------
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
      AND i.status <> 'paid'
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

-- ---------------------------------------------------------------------------
-- 2. budget_consumption
--
-- actual_minor    = Σ ROUND((debit − credit) × 100) over POSTED journal lines
--                   of the budget's account, journal date in [p_start, p_end]
--                   (inclusive, as the JS `.gte/.lte`). Rounded per line,
--                   as the JS did.
-- committed_minor = Σ amount_minor over unreleased commitments of the budget.
-- Integers in minor units (§1.3).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.budget_consumption(
  p_workspace_id uuid,
  p_budget_id    uuid,
  p_account_id   uuid,
  p_start        date,
  p_end          date
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_build_object(
    'actual_minor', (
      SELECT COALESCE(SUM(ROUND((l.debit - l.credit) * 100)), 0)::bigint
      FROM journal_lines l
      JOIN journal_entries j ON j.id = l.journal_id
      WHERE l.workspace_id = p_workspace_id
        AND l.account_id   = p_account_id
        AND j.status       = 'posted'
        AND j.date >= p_start
        AND j.date <= p_end
    ),
    'committed_minor', (
      SELECT COALESCE(SUM(bc.amount_minor), 0)::bigint
      FROM budget_commitments bc
      WHERE bc.workspace_id = p_workspace_id
        AND bc.budget_id    = p_budget_id
        AND bc.released_at IS NULL
    )
  );
$fn$;

REVOKE EXECUTE ON FUNCTION public.budget_consumption(uuid, uuid, uuid, date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.budget_consumption(uuid, uuid, uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.budget_consumption(uuid, uuid, uuid, date, date) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.budget_consumption(uuid, uuid, uuid, date, date) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
