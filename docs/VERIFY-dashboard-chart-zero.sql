-- ============================================================================
-- READ-ONLY. Why does the sales chart show 0 when the shop has 5+ invoices?
--
-- The dashboard asks for  date >= <start> AND date < <end + 1 day>
-- with  type = 'sale' OR type IS NULL,  scoped by workspace_id.
-- An invoice is invisible to the chart if ANY of those does not hold.
--
-- One confirmed suspect in code: a new invoice's date was stamped when the
-- PREVIOUS invoice was saved (the persisted draft), so an invoice started days
-- later — date field untouched — was saved dated days ago, outside the 7-day
-- window. That is fixed for new invoices. This query shows whether it (or
-- something else) is what hides yours.
-- ============================================================================

-- 1. Every invoice, with the fields the chart filters on.
--    Compare `date` with `created_at` (when it was actually saved):
--    a large gap = the stale-draft-date bug.
SELECT  invoice_number,
        type,
        status,
        total,
        date,
        created_at,
        (created_at::date - date::date) AS days_between_saved_and_dated,
        workspace_id
FROM    invoices
ORDER BY invoice_number DESC
LIMIT 20;

-- 2. How many would the dashboard's 7-day window include, per reason.
SELECT
  COUNT(*)                                                         AS all_invoices,
  COUNT(*) FILTER (WHERE type = 'sale' OR type IS NULL)            AS sales,
  COUNT(*) FILTER (WHERE (type = 'sale' OR type IS NULL)
                     AND date >= (CURRENT_DATE - INTERVAL '7 days')) AS sales_in_last_7_days,
  COUNT(*) FILTER (WHERE (type = 'sale' OR type IS NULL)
                     AND date >= (CURRENT_DATE - INTERVAL '30 days')) AS sales_in_last_30_days,
  COUNT(DISTINCT workspace_id)                                     AS workspaces_seen
FROM invoices;
