-- ============================================================================
-- docs/perf-aggregates-analytics-migration.sql
--
-- Aggregate the dashboard / analytics / invoice-summary figures IN POSTGRES.
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- (docs/VERIFY-perf-aggregates.sql)
--
-- ---------------------------------------------------------------------------
-- WHY
--
-- The backend used to SELECT every invoice / product row and sum in Node. A
-- supabase-js select with no `.range()` is capped by PostgREST `max-rows`
-- (1000 on Supabase), so once a shop passed 1000 invoices every KPI below was
-- computed from ONE PAGE — silently wrong, no error. Each function here
-- returns a single jsonb value, so the cap cannot truncate it.
--
-- ---------------------------------------------------------------------------
-- SECURITY — READ BEFORE CHANGING
--
-- These follow the `accounting_trial_balance(p_workspace_id …)` pattern:
-- SECURITY DEFINER, trusting p_workspace_id, called ONLY by the backend's
-- service-role client after `requireWorkspaceContext` has verified the
-- workspace. They bypass RLS, so each one is REVOKEd from PUBLIC, anon and
-- authenticated immediately after it is created. Without that, anyone with
-- the public anon key could call /rest/v1/rpc/<name> with another business's
-- workspace id. `backend/src/__tests__/perf-aggregates-guard.test.ts` fails if
-- a REVOKE is missing.
--
-- These are NOT in the `reporting` schema: that schema is the AI surface and
-- takes no workspace parameter. Never expose these to the AI layer.
--
-- ---------------------------------------------------------------------------
-- SEMANTICS — each mirrors the JS path in the named service EXACTLY
-- (the JS path is still there as the fallback when a function is missing):
--
--   analytics_dashboard_kpis    analytics.service.ts#getDashboardKpis
--   analytics_sales_summary     analytics.service.ts#getSalesSummary
--   analytics_inventory_summary analytics.service.ts#getInventorySummary
--   invoices_summary_kpis       invoice.service.ts#getSummary
--
-- Time boundaries («today», «this month», «14 days ago») are computed by the
-- backend and passed in, so the SQL and JS paths cannot disagree on a
-- timezone. Month/day labels use UTC, which is what PostgREST's timestamptz
-- output (and therefore the JS `.slice(0, 7)`) was already using.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
--   DROP FUNCTION IF EXISTS public.analytics_dashboard_kpis(uuid, timestamptz, timestamptz, timestamptz);
--   DROP FUNCTION IF EXISTS public.analytics_sales_summary(uuid, timestamptz, timestamptz, timestamptz);
--   DROP FUNCTION IF EXISTS public.analytics_inventory_summary(uuid);
--   DROP FUNCTION IF EXISTS public.invoices_summary_kpis(uuid, timestamptz, timestamptz);
--   DROP INDEX IF EXISTS public.invoices_workspace_id_date_idx;
--
-- Safe: the backend detects a missing function (PGRST202 / 42883), logs it,
-- and falls back to the previous row-by-row path. No data is touched.
--
-- ADDITIVE / IDEMPOTENT — CREATE OR REPLACE, IF NOT EXISTS, REVOKE/GRANT.
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- Range reads on the sales summary filter (workspace_id, date).
-- ⚠️ On a very large invoices table this takes a write lock while it builds;
-- run in a quiet window (or run it alone as CREATE INDEX CONCURRENTLY outside
-- this transaction).
CREATE INDEX IF NOT EXISTS invoices_workspace_id_date_idx ON public.invoices (workspace_id, date);

-- ---------------------------------------------------------------------------
-- 1. analytics_dashboard_kpis
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_dashboard_kpis(
  p_workspace_id     uuid,
  p_today_start      timestamptz,
  p_month_start      timestamptz,
  p_prev_month_start timestamptz
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  WITH inv AS (
    SELECT
      COALESCE(NULLIF(i.currency, ''), 'AFN')        AS currency,
      (i.type IS NOT DISTINCT FROM 'purchase')       AS is_purchase,
      i.total                                        AS total,
      COALESCE(i.paid_amount, 0)                     AS paid,
      i.status                                       AS status,
      i.date                                         AS date,
      i.customer_id                                  AS customer_id
    FROM invoices i
    WHERE i.workspace_id = p_workspace_id
  ),
  by_currency AS (
    SELECT
      currency,
      COALESCE(SUM(total)        FILTER (WHERE NOT is_purchase), 0) AS total_sales,
      COALESCE(SUM(total)        FILTER (WHERE is_purchase), 0)     AS total_purchases,
      COALESCE(SUM(total - paid) FILTER (WHERE NOT is_purchase AND status IS DISTINCT FROM 'paid'), 0) AS customer_debt,
      COALESCE(SUM(total - paid) FILTER (WHERE is_purchase AND status IS DISTINCT FROM 'paid'), 0)     AS supplier_payable,
      COALESCE(SUM(total)        FILTER (WHERE NOT is_purchase AND date >= p_today_start), 0) AS today_sales,
      COUNT(*)                   FILTER (WHERE NOT is_purchase AND date >= p_today_start)     AS today_invoices,
      COALESCE(SUM(total)        FILTER (WHERE NOT is_purchase AND date >= p_month_start), 0) AS monthly_revenue,
      COALESCE(SUM(total)        FILTER (WHERE NOT is_purchase AND date >= p_prev_month_start AND date < p_month_start), 0) AS prev_month_revenue,
      COALESCE(SUM(total - paid) FILTER (WHERE NOT is_purchase AND status IS DISTINCT FROM 'cancelled' AND total - paid > 0), 0) AS pending_payments,
      COUNT(*)                   FILTER (WHERE NOT is_purchase AND status IS DISTINCT FROM 'cancelled' AND total - paid > 0)     AS pending_payments_count,
      COUNT(*)                   FILTER (WHERE is_purchase) AS purchase_count
    FROM inv
    GROUP BY currency
  ),
  active_products AS (
    SELECT COALESCE(p.quantity, 0) AS q, COALESCE(p.min_stock_level, 0) AS m, COALESCE(p.buy_price, 0) AS bp
    FROM products p
    WHERE p.workspace_id = p_workspace_id
      AND p.is_active = true
  )
  SELECT jsonb_build_object(
    'currencies',       COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.currency) FROM by_currency b), '[]'::jsonb),
    'active_customers', (SELECT COUNT(DISTINCT customer_id) FROM inv WHERE NOT is_purchase),
    'low_stock_alerts', (SELECT COUNT(*) FROM active_products WHERE q <= m),
    'warehouse_value',  (SELECT COALESCE(SUM(q * bp), 0) FROM active_products)
  );
$fn$;

REVOKE EXECUTE ON FUNCTION public.analytics_dashboard_kpis(uuid, timestamptz, timestamptz, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.analytics_dashboard_kpis(uuid, timestamptz, timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.analytics_dashboard_kpis(uuid, timestamptz, timestamptz, timestamptz) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.analytics_dashboard_kpis(uuid, timestamptz, timestamptz, timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. analytics_sales_summary
--
-- Sales only (`type = 'sale' OR type IS NULL`), date in [p_start, p_end_exclusive).
-- Lists are ordered the way the JS path produced them (newest first) and the
-- top lists are LIMIT 10 exactly as before.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_sales_summary(
  p_workspace_id    uuid,
  p_start           timestamptz,
  p_end_exclusive   timestamptz,
  p_chart_from      timestamptz
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  WITH inv AS (
    SELECT i.id, i.total, i.status, COALESCE(NULLIF(i.currency, ''), 'AFN') AS currency, i.date, i.customer_id
    FROM invoices i
    WHERE i.workspace_id = p_workspace_id
      AND (i.type = 'sale' OR i.type IS NULL)
      AND i.date >= p_start
      AND i.date <  p_end_exclusive
  )
  SELECT jsonb_build_object(
    'total_invoices', (SELECT COUNT(*) FROM inv),
    'total_revenue',  (SELECT COALESCE(SUM(total), 0) FROM inv),
    'total_paid',     (SELECT COALESCE(SUM(total) FILTER (WHERE status IS NOT DISTINCT FROM 'paid'), 0) FROM inv),
    'by_currency',    COALESCE((
        SELECT jsonb_object_agg(c.currency, c.revenue)
        FROM (SELECT currency, SUM(total) AS revenue FROM inv GROUP BY currency) c
      ), '{}'::jsonb),
    'by_period',      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('period', p.period, 'revenue', p.revenue, 'count', p.cnt) ORDER BY p.period DESC)
        FROM (
          SELECT to_char(date AT TIME ZONE 'UTC', 'YYYY-MM') AS period, SUM(total) AS revenue, COUNT(*) AS cnt
          FROM inv GROUP BY 1
        ) p
      ), '[]'::jsonb),
    'top_customers',  COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'customer_id',   t.customer_id,
                 'customer_name', COALESCE(c.full_name, ''),
                 'revenue',       t.revenue,
                 'invoice_count', t.cnt
               ) ORDER BY t.revenue DESC)
        FROM (
          SELECT customer_id, SUM(total) AS revenue, COUNT(*) AS cnt
          FROM inv
          WHERE customer_id IS NOT NULL
          GROUP BY customer_id
          ORDER BY SUM(total) DESC
          LIMIT 10
        ) t
        -- Scoped to the workspace, not just joined by id.
        LEFT JOIN customers c ON c.id = t.customer_id AND c.workspace_id = p_workspace_id
      ), '[]'::jsonb),
    'top_items',      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'product_id',   x.product_id,
                 'product_name', COALESCE(x.product_name, ''),
                 'total_price',  COALESCE(x.total_price, 0)
               ) ORDER BY x.total_price DESC)
        FROM (
          SELECT ii.product_id, ii.product_name, ii.total_price
          FROM invoice_items ii
          JOIN inv ON inv.id = ii.invoice_id
          ORDER BY ii.total_price DESC
          LIMIT 10
        ) x
      ), '[]'::jsonb),
    'chart',          COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'day', d.day, 'value', d.value, 'invoice_count', d.cnt, 'customer_count', d.cc
               ) ORDER BY d.day DESC)
        FROM (
          SELECT to_char(date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
                 SUM(total) AS value, COUNT(*) AS cnt, COUNT(DISTINCT customer_id) AS cc
          FROM inv
          WHERE date >= p_chart_from
          GROUP BY 1
        ) d
      ), '[]'::jsonb)
  );
$fn$;

REVOKE EXECUTE ON FUNCTION public.analytics_sales_summary(uuid, timestamptz, timestamptz, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.analytics_sales_summary(uuid, timestamptz, timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.analytics_sales_summary(uuid, timestamptz, timestamptz, timestamptz) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.analytics_sales_summary(uuid, timestamptz, timestamptz, timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. analytics_inventory_summary (active products only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_inventory_summary(
  p_workspace_id uuid
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  WITH p AS (
    SELECT COALESCE(pr.quantity, 0)                    AS q,
           COALESCE(pr.buy_price, 0)                   AS bp,
           COALESCE(pr.min_stock_level, 0)             AS m,
           COALESCE(NULLIF(pr.category, ''), 'general') AS cat
    FROM products pr
    WHERE pr.workspace_id = p_workspace_id
      AND pr.is_active = true
  )
  SELECT jsonb_build_object(
    'total_products',        (SELECT COUNT(*) FROM p),
    'total_stock_value',     (SELECT COALESCE(SUM(q * bp), 0) FROM p),
    'low_stock_products',    (SELECT COUNT(*) FROM p WHERE q <= m),
    'out_of_stock_products', (SELECT COUNT(*) FROM p WHERE q = 0),
    'by_category',           COALESCE((
        SELECT jsonb_agg(jsonb_build_object('category', c.cat, 'count', c.cnt, 'total_value', c.total_value) ORDER BY c.cat)
        FROM (SELECT cat, COUNT(*) AS cnt, SUM(q * bp) AS total_value FROM p GROUP BY cat) c
      ), '[]'::jsonb)
  );
$fn$;

REVOKE EXECUTE ON FUNCTION public.analytics_inventory_summary(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.analytics_inventory_summary(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.analytics_inventory_summary(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.analytics_inventory_summary(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. invoices_summary_kpis
--
-- «Today» is [p_day_start, p_day_end). Debt/payable clamp each invoice at 0
-- (GREATEST) exactly like the JS `Math.max(0, …)`. Low stock counts ALL
-- products with a positive minimum, active or not — as the JS path did.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoices_summary_kpis(
  p_workspace_id uuid,
  p_day_start    timestamptz,
  p_day_end      timestamptz
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_build_object(
    'today_sales',     COALESCE(SUM(i.total) FILTER (WHERE i.type IS DISTINCT FROM 'purchase' AND i.date >= p_day_start AND i.date < p_day_end), 0),
    'today_purchases', COALESCE(SUM(i.total) FILTER (WHERE i.type IS NOT DISTINCT FROM 'purchase' AND i.date >= p_day_start AND i.date < p_day_end), 0),
    'total_debt',      COALESCE(SUM(GREATEST(0, i.total - COALESCE(i.paid_amount, 0))) FILTER (WHERE i.type IS DISTINCT FROM 'purchase' AND i.status IS DISTINCT FROM 'paid'), 0),
    'total_payable',   COALESCE(SUM(GREATEST(0, i.total - COALESCE(i.paid_amount, 0))) FILTER (WHERE i.type IS NOT DISTINCT FROM 'purchase' AND i.status IS DISTINCT FROM 'paid'), 0),
    'low_stock_count', (
      SELECT COUNT(*) FROM products p
      WHERE p.workspace_id = p_workspace_id
        AND COALESCE(p.min_stock_level, 0) > 0
        AND COALESCE(p.quantity, 0) <= COALESCE(p.min_stock_level, 0)
    )
  )
  FROM invoices i
  WHERE i.workspace_id = p_workspace_id;
$fn$;

REVOKE EXECUTE ON FUNCTION public.invoices_summary_kpis(uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invoices_summary_kpis(uuid, timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.invoices_summary_kpis(uuid, timestamptz, timestamptz) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.invoices_summary_kpis(uuid, timestamptz, timestamptz) TO service_role;

COMMIT;

-- Tell PostgREST the new functions exist (otherwise it answers PGRST202 until
-- its schema cache refreshes, and the backend keeps using the fallback).
NOTIFY pgrst, 'reload schema';
