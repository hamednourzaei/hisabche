-- ============================================================================
-- dashboard-fx-01 — the dashboard in the BOOKS currency, at each invoice's rate
--
-- WHY (owner, 18 Oct 2026). A 2,307,692.3 USD sale with its rate frozen at 65
-- AFN appeared on the dashboard's 7-day chart as «2.3 million», added raw to
-- the afghani: 302,320,512 instead of ~452,012,740. The headline «فروش کل»
-- showed books-currency invoices only and left the dollar sale out. Both
-- functions below (from perf-aggregates-analytics-migration.sql) summed
-- `total` without asking what currency it was in.
--
-- THE RULE — the same one the ledger, the cost layers and the profit report
-- already use (invoices.exchange_rate = books units per ONE invoice unit,
-- frozen when the invoice was recorded; NULL on a books-currency invoice):
--
--   invoice in the books currency      → total
--   invoice in another currency, rate  → total × exchange_rate
--   invoice in another currency, none  → NOT CONVERTIBLE: left out of every
--                                        books figure and COUNTED, never × 1
--                                        and never guessed (§12)
--
-- ADDITIVE. Two NEW functions with a `p_books_currency` parameter (the books
-- currency is resolved by the backend, `baseCurrencyOf`, with its default);
-- the v1 functions are untouched, so the backend keeps working before this
-- runs and falls back to v1 if it is rolled back. Raw per-currency buckets
-- (`currencies` / `by_currency`) are still returned, unchanged.
--
-- REQUIRES: invoices.exchange_rate (invoice-exchange-rate-01). SAFE TO RE-RUN.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.analytics_sales_summary_v2(uuid, timestamptz, timestamptz, timestamptz, text);
--   DROP FUNCTION IF EXISTS public.analytics_dashboard_kpis_v2(uuid, timestamptz, timestamptz, timestamptz, text);
--   DROP FUNCTION IF EXISTS public.invoice_books_amount(numeric, text, numeric, text);
--   (The backend reads v1 again on its own — it treats a missing function as
--   «not installed».)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. One amount of an invoice, in the books currency — or NULL.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoice_books_amount(
  p_amount         numeric,
  p_currency       text,
  p_exchange_rate  numeric,
  p_books_currency text
) RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT CASE
    WHEN p_amount IS NULL THEN NULL
    WHEN COALESCE(NULLIF(p_currency, ''), p_books_currency) = p_books_currency THEN p_amount
    WHEN p_exchange_rate IS NOT NULL AND p_exchange_rate > 0 THEN p_amount * p_exchange_rate
    ELSE NULL
  END;
$fn$;

REVOKE ALL ON FUNCTION public.invoice_books_amount(numeric, text, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoice_books_amount(numeric, text, numeric, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_books_amount(numeric, text, numeric, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 1. analytics_dashboard_kpis_v2 — v1's shape, plus `books`: every money
--    figure in the books currency, and how many invoices could not be.
-- ---------------------------------------------------------------------------
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
    'warehouse_value',  (SELECT COALESCE(SUM(q * bp), 0) FROM active_products)
  );
$fn$;

REVOKE ALL ON FUNCTION public.analytics_dashboard_kpis_v2(uuid, timestamptz, timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.analytics_dashboard_kpis_v2(uuid, timestamptz, timestamptz, timestamptz, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_dashboard_kpis_v2(uuid, timestamptz, timestamptz, timestamptz, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. analytics_sales_summary_v2 — every money figure (total, paid, months,
--    top customers, top items, the daily chart) in the books currency;
--    `by_currency` stays raw; `unconverted_count` names what was left out.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_sales_summary_v2(
  p_workspace_id    uuid,
  p_start           timestamptz,
  p_end_exclusive   timestamptz,
  p_chart_from      timestamptz,
  p_books_currency  text
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  WITH all_inv AS (
    SELECT i.id, i.total, i.status, COALESCE(NULLIF(i.currency, ''), p_books_currency) AS currency,
           i.exchange_rate, i.date, i.customer_id,
           public.invoice_books_amount(i.total, i.currency, i.exchange_rate, p_books_currency) AS total_b
    FROM invoices i
    WHERE i.workspace_id = p_workspace_id
      AND (i.type = 'sale' OR i.type IS NULL)
      AND i.date >= p_start
      AND i.date <  p_end_exclusive
  ),
  inv AS (SELECT * FROM all_inv WHERE total_b IS NOT NULL)
  SELECT jsonb_build_object(
    'total_invoices',    (SELECT COUNT(*) FROM inv),
    'unconverted_count', (SELECT COUNT(*) FROM all_inv WHERE total_b IS NULL),
    'total_revenue',     (SELECT COALESCE(SUM(total_b), 0) FROM inv),
    'total_paid',        (SELECT COALESCE(SUM(total_b) FILTER (WHERE status IS NOT DISTINCT FROM 'paid'), 0) FROM inv),
    'by_currency',       COALESCE((
        SELECT jsonb_object_agg(c.currency, c.revenue)
        FROM (SELECT currency, SUM(total) AS revenue FROM all_inv GROUP BY currency) c
      ), '{}'::jsonb),
    'by_period',         COALESCE((
        SELECT jsonb_agg(jsonb_build_object('period', p.period, 'revenue', p.revenue, 'count', p.cnt) ORDER BY p.period DESC)
        FROM (
          SELECT to_char(date AT TIME ZONE 'UTC', 'YYYY-MM') AS period, SUM(total_b) AS revenue, COUNT(*) AS cnt
          FROM inv GROUP BY 1
        ) p
      ), '[]'::jsonb),
    'top_customers',     COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'customer_id',   t.customer_id,
                 'customer_name', COALESCE(c.full_name, ''),
                 'revenue',       t.revenue,
                 'invoice_count', t.cnt
               ) ORDER BY t.revenue DESC)
        FROM (
          SELECT customer_id, SUM(total_b) AS revenue, COUNT(*) AS cnt
          FROM inv
          WHERE customer_id IS NOT NULL
          GROUP BY customer_id
          ORDER BY SUM(total_b) DESC
          LIMIT 10
        ) t
        LEFT JOIN customers c ON c.id = t.customer_id AND c.workspace_id = p_workspace_id
      ), '[]'::jsonb),
    'top_items',         COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'product_id',   x.product_id,
                 'product_name', COALESCE(x.product_name, ''),
                 'total_price',  COALESCE(x.total_price, 0)
               ) ORDER BY x.total_price DESC)
        FROM (
          SELECT ii.product_id, ii.product_name,
                 public.invoice_books_amount(ii.total_price, inv.currency, inv.exchange_rate, p_books_currency) AS total_price
          FROM invoice_items ii
          JOIN inv ON inv.id = ii.invoice_id
          ORDER BY 3 DESC NULLS LAST
          LIMIT 10
        ) x
      ), '[]'::jsonb),
    'chart',             COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'day', d.day, 'value', d.value, 'invoice_count', d.cnt, 'customer_count', d.cc
               ) ORDER BY d.day DESC)
        FROM (
          SELECT to_char(date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
                 SUM(total_b) AS value, COUNT(*) AS cnt, COUNT(DISTINCT customer_id) AS cc
          FROM inv
          WHERE date >= p_chart_from
          GROUP BY 1
        ) d
      ), '[]'::jsonb)
  );
$fn$;

REVOKE ALL ON FUNCTION public.analytics_sales_summary_v2(uuid, timestamptz, timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.analytics_sales_summary_v2(uuid, timestamptz, timestamptz, timestamptz, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_sales_summary_v2(uuid, timestamptz, timestamptz, timestamptz, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
