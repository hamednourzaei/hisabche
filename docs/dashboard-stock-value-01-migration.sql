-- ============================================================================
-- dashboard-stock-value-01 — «ارزش کل انبار» never goes below zero
--
-- WHY (QA report, 9 Nov 2026 — QA-DASH-NEG). The dashboard showed the
-- warehouse worth −199,000. The value was SUM(quantity × buy_price) over every
-- active product, and a product sold past its stock (a sale is recorded, not
-- refused — M2.4) has a negative quantity: its «value» was subtracted from the
-- stock that really is on the shelves.
--
-- THE RULE. Value = stock on hand: GREATEST(quantity, 0) × buy_price. The
-- products below zero are not hidden — the function returns how many there
-- are (`negative_stock_products`) and the dashboard card says so, so the
-- owner fixes the count with a stock document (§13: report, don't repair).
--
-- REPLACES analytics_dashboard_kpis_v2 only (same signature, same grants).
-- REQUIRES: dashboard-fx-01 (which created v2). SAFE TO RE-RUN.
--
-- ROLLBACK: re-run section 1 of docs/dashboard-fx-01-migration.sql (the
--   previous body). The backend reads `negative_stock_products` as optional.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.analytics_dashboard_kpis_v2(
  p_workspace_id     uuid,
  p_today_start      timestamptz,
  p_month_start      timestamptz,
  p_prev_month_start timestamptz,
  p_books_currency   text
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  WITH inv AS (
    SELECT
      COALESCE(NULLIF(i.currency, ''), p_books_currency)                       AS currency,
      (i.type IS NOT DISTINCT FROM 'purchase')                                 AS is_purchase,
      i.total                                                                  AS total,
      COALESCE(i.paid_amount, 0)                                               AS paid,
      public.invoice_books_amount(i.total, i.currency, i.exchange_rate, p_books_currency) AS total_b,
      public.invoice_books_amount(i.total - COALESCE(i.paid_amount, 0), i.currency, i.exchange_rate, p_books_currency) AS open_b,
      i.status                                                                 AS status,
      i.date                                                                   AS date,
      i.customer_id                                                            AS customer_id
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
  books AS (
    -- SUM skips NULL: a non-convertible invoice adds nothing and is counted below.
    SELECT
      COALESCE(SUM(total_b) FILTER (WHERE NOT is_purchase), 0) AS total_sales,
      COALESCE(SUM(total_b) FILTER (WHERE is_purchase), 0)     AS total_purchases,
      COALESCE(SUM(open_b)  FILTER (WHERE NOT is_purchase AND status IS DISTINCT FROM 'paid'), 0) AS customer_debt,
      COALESCE(SUM(open_b)  FILTER (WHERE is_purchase AND status IS DISTINCT FROM 'paid'), 0)     AS supplier_payable,
      COALESCE(SUM(total_b) FILTER (WHERE NOT is_purchase AND date >= p_today_start), 0) AS today_sales,
      COUNT(*)              FILTER (WHERE NOT is_purchase AND date >= p_today_start AND total_b IS NOT NULL) AS today_invoices,
      COALESCE(SUM(total_b) FILTER (WHERE NOT is_purchase AND date >= p_month_start), 0) AS monthly_revenue,
      COALESCE(SUM(total_b) FILTER (WHERE NOT is_purchase AND date >= p_prev_month_start AND date < p_month_start), 0) AS prev_month_revenue,
      COALESCE(SUM(open_b)  FILTER (WHERE NOT is_purchase AND status IS DISTINCT FROM 'cancelled' AND total - paid > 0), 0) AS pending_payments,
      COUNT(*)              FILTER (WHERE NOT is_purchase AND status IS DISTINCT FROM 'cancelled' AND total - paid > 0 AND open_b IS NOT NULL) AS pending_payments_count,
      COUNT(*)              FILTER (WHERE is_purchase AND total_b IS NOT NULL) AS purchase_count,
      COUNT(*)              FILTER (WHERE total_b IS NULL) AS unconverted_count
    FROM inv
  ),
  active_products AS (
    SELECT COALESCE(p.quantity, 0) AS q, COALESCE(p.min_stock_level, 0) AS m, COALESCE(p.buy_price, 0) AS bp
    FROM products p
    WHERE p.workspace_id = p_workspace_id
      AND p.is_active = true
  )
  SELECT jsonb_build_object(
    'currencies',       COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.currency) FROM by_currency b), '[]'::jsonb),
    'books',            (SELECT to_jsonb(k) FROM books k),
    'active_customers', (SELECT COUNT(DISTINCT customer_id) FROM inv WHERE NOT is_purchase),
    'low_stock_alerts', (SELECT COUNT(*) FROM active_products WHERE q <= m),
    -- Stock on hand only: a product sold below zero owns nothing to value.
    'warehouse_value',  (SELECT COALESCE(SUM(GREATEST(q, 0) * bp), 0) FROM active_products),
    -- ...and is COUNTED, so the dashboard says so instead of hiding it (§13).
    'negative_stock_products', (SELECT COUNT(*) FROM active_products WHERE q < 0)
  );
$fn$;

REVOKE ALL ON FUNCTION public.analytics_dashboard_kpis_v2(uuid, timestamptz, timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.analytics_dashboard_kpis_v2(uuid, timestamptz, timestamptz, timestamptz, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_dashboard_kpis_v2(uuid, timestamptz, timestamptz, timestamptz, text) TO service_role;

COMMIT;
