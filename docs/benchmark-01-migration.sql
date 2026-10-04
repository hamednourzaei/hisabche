-- ============================================================================
-- BENCHMARK — 01 (capability #135). Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-benchmark-01.sql.
--
-- One function and no table. It counts, per business, the sale invoices issued
-- in the last N days — the one figure the benchmark compares, because it needs
-- no currency and no ledger.
--
-- ⚠️ IT IS FOR THE BACKEND ONLY. It reads across businesses, so no browser role
-- may execute it. The backend never returns its rows: it hands them to the
-- benchmark rule, which publishes ONLY a median, a percentile and how many
-- businesses were compared — and nothing at all below ten of them.
--
-- A sandbox business is not a business and is not counted. Cancelled invoices
-- are not sales.
--
-- No data is stored and none is changed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.benchmark_sale_counts(p_days integer)
RETURNS TABLE (workspace_id uuid, sale_count bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT i.workspace_id, count(*)::bigint AS sale_count
    FROM public.invoices i
    JOIN public.workspaces w ON w.id = i.workspace_id
   WHERE i.type = 'sale'
     AND i.status IS DISTINCT FROM 'cancelled'
     AND i.date >= (now() - make_interval(days => GREATEST(1, LEAST(COALESCE(p_days, 30), 365))))
     AND i.date <= now()
     -- Read through jsonb so the script runs whether or not the sandbox
     -- migration has added the column.
     AND COALESCE((to_jsonb(w) ->> 'is_sandbox')::boolean, false) = false
   GROUP BY i.workspace_id
   ORDER BY i.workspace_id
$$;

COMMENT ON FUNCTION public.benchmark_sale_counts(integer) IS
  'Sale invoices per business in the last N days. Backend only: its rows are never returned to a client.';

-- On Supabase a new function is executable by every API role; all are revoked
-- before the backend is granted back.
REVOKE ALL ON FUNCTION public.benchmark_sale_counts(integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.benchmark_sale_counts(integer) TO service_role;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Nothing was stored, so nothing is lost.
--
--   DROP FUNCTION IF EXISTS public.benchmark_sale_counts(integer);
