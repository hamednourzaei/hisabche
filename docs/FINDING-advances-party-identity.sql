-- ============================================================================
-- docs/FINDING-advances-party-identity.sql
--
-- Read-only finding query to audit party identity in order_deposits.
-- Specifically identifies rows where:
-- 1. source_type = 'pre_purchase' and customer_id is stored with a supplier's ID
--    (which lacks a supplier foreign key constraint).
-- 2. source_type = 'pre_purchase' where customer_id does NOT match any supplier
--    in the same workspace (unresolvable historical records).
-- 3. source_type = 'pre_sale' where customer_id does NOT match any customer
--    in the same workspace.
--
-- Owner Decision & Protocol:
-- Unresolved historical rows must be excluded from statements/aging and reported,
-- never silently re-pointed.
-- ============================================================================

-- 1. Summary Counts
SELECT
  od.source_type,
  COUNT(*) AS total_rows,
  COUNT(CASE WHEN s.id IS NOT NULL THEN 1 END) AS matching_suppliers,
  COUNT(CASE WHEN c.id IS NOT NULL THEN 1 END) AS matching_customers,
  COUNT(CASE WHEN s.id IS NULL AND c.id IS NULL THEN 1 END) AS orphaned_rows
FROM public.order_deposits od
LEFT JOIN public.suppliers s ON s.id = od.customer_id AND s.workspace_id = od.workspace_id
LEFT JOIN public.customers c ON c.id = od.customer_id AND c.workspace_id = od.workspace_id
GROUP BY od.source_type;

-- 2. Unresolved Pre-purchase Rows (Party is not a supplier in the same workspace)
SELECT
  od.id AS deposit_id,
  od.workspace_id,
  od.source_type,
  od.customer_id AS stored_party_id,
  od.amount_minor,
  od.currency,
  od.created_at,
  'NO_MATCHING_SUPPLIER' AS finding_reason
FROM public.order_deposits od
WHERE od.source_type = 'pre_purchase'
  AND NOT EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = od.customer_id
      AND s.workspace_id = od.workspace_id
  );
