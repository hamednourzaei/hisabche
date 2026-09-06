-- ============================================================================
-- docs/verify-phases-m-n-o.sql
--
-- Verification for the four migrations run together:
--
--   phase-m-01-shift-handover
--   phase-n-01-reconciliation-memory
--   phase-o-01-reporting-layer
--   phase-o-02-catalog-and-query-log
--
-- Returns ONE table: check · expected · actual · status.
-- Paste the whole result back.
--
-- ⚠️ THIS SCRIPT DOES NOT PROVE WORKSPACE ISOLATION. The SQL editor runs as a
-- privileged role, so `auth.uid()` is null and the reporting views return
-- nothing here — that is EXPECTED and is not a failure. The isolation test is
-- at the bottom and has to be run as a real signed-in user.
-- ============================================================================

WITH checks AS (

-- ─── phase-m-01 — shift handover ───────────────────────────────────────────

SELECT 1 AS ord, 'M3 · pos_sessions has the 5 frozen columns' AS check_name, '5' AS expected,
       COUNT(*)::text AS actual
FROM   information_schema.columns
WHERE  table_name = 'pos_sessions'
  AND  column_name IN ('expected_cash_minor','cash_sales_minor','cash_in_minor',
                       'cash_out_minor','variance_minor')

UNION ALL
SELECT 2, 'M3 · nothing backfilled (0, unless a shift closed since)', '0',
       COUNT(*)::text
FROM   pos_sessions WHERE expected_cash_minor IS NOT NULL

-- ─── phase-n-01 — reconciliation memory ────────────────────────────────────

UNION ALL
SELECT 3, 'N1 · bank_statement_lines.matched_party exists', '1',
       COUNT(*)::text
FROM   information_schema.columns
WHERE  table_name = 'bank_statement_lines' AND column_name = 'matched_party'

UNION ALL
SELECT 4, 'N1 · nothing backfilled (0, unless confirmed since)', '0',
       COUNT(*)::text
FROM   bank_statement_lines WHERE matched_party IS NOT NULL

-- ─── phase-o-01 — reporting layer ──────────────────────────────────────────

UNION ALL
SELECT 5, 'O2 · four reporting views exist', '4',
       COUNT(*)::text
FROM   information_schema.views WHERE table_schema = 'reporting'

UNION ALL
SELECT 6, 'O2 · every view filters on auth_workspace_ids()', '4',
       COUNT(*)::text
FROM   pg_views
WHERE  schemaname = 'reporting' AND definition LIKE '%auth_workspace_ids%'

UNION ALL
-- ⚠️ Without security_invoker a view runs as its OWNER and RLS never applies —
-- every one of these becomes a cross-workspace read.
SELECT 7, 'O2 · every view is security_invoker', '4',
       COUNT(*)::text
FROM   pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE  n.nspname = 'reporting' AND c.relkind = 'v'
  AND  c.reloptions::text LIKE '%security_invoker=true%'

UNION ALL
-- ⚠️ THE CORE OF PHASE O. A workspace parameter is what prompt injection
-- targets: it turns "read someone else's books" into a well-formed call.
SELECT 8, 'O2 · NO function in reporting takes a workspace arg', '0',
       COUNT(*)::text
FROM   pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'reporting'
  AND  pg_get_function_arguments(p.oid) ILIKE '%workspace%'

UNION ALL
-- ⚠️ FILTERED BY GRANTEE, AND THAT MATTERS.
--
-- The first version of this check counted EVERY non-SELECT privilege in the
-- schema and reported 24 — which looked like a hole and was not. A view's
-- OWNER holds every privilege implicitly, and the owner here is the role that
-- ran the migration. 4 views × 6 owner privileges = 24.
--
-- The real question is whether a USER-FACING role can write. A security check
-- that cries wolf gets muted, and a muted check protects nothing.
SELECT 9, 'O2 · no user role can write to reporting', '0',
       COUNT(*)::text
FROM   information_schema.role_table_grants
WHERE  table_schema = 'reporting'
  AND  privilege_type <> 'SELECT'
  AND  grantee IN ('authenticated', 'anon', 'PUBLIC', 'public')

-- ─── phase-o-02 — catalogue + query log ────────────────────────────────────

UNION ALL
SELECT 10, 'O1 · entity_catalog seeded', '13',
       COUNT(*)::text
FROM   metadata.entity_catalog

UNION ALL
SELECT 11, 'O1 · ledger_entries is marked FROZEN', '1',
       COUNT(*)::text
FROM   metadata.entity_catalog
WHERE  table_name = 'ledger_entries'
  AND  is_source_of_truth = false AND lifecycle = 'frozen'

UNION ALL
SELECT 12, 'O1 · stock_movements is the inventory truth', '1',
       COUNT(*)::text
FROM   metadata.entity_catalog
WHERE  table_name = 'stock_movements' AND is_source_of_truth = true

UNION ALL
SELECT 13, 'O1 · warehouse_stock derives from stock_movements', '1',
       COUNT(*)::text
FROM   metadata.entity_catalog
WHERE  table_name = 'warehouse_stock'
  AND  is_source_of_truth = false AND derived_from LIKE '%stock_movements%'

UNION ALL
-- Enforced by CHECK constraint: "not the truth" with no explanation is a
-- warning nobody can act on.
SELECT 14, 'O1 · every derived row explains its source', '0',
       COUNT(*)::text
FROM   metadata.entity_catalog
WHERE  is_source_of_truth = false AND derived_from IS NULL

UNION ALL
SELECT 15, 'O3 · ai_query_log exists', '1',
       COUNT(*)::text
FROM   information_schema.tables WHERE table_name = 'ai_query_log'

UNION ALL
SELECT 16, 'O3 · ai_query_log has RLS enabled', 'true',
       COALESCE(MAX(relrowsecurity::text), 'MISSING')
FROM   pg_class WHERE relname = 'ai_query_log'

UNION ALL
SELECT 17, 'O3 · query log is empty (no provider connected)', '0',
       COUNT(*)::text
FROM   ai_query_log

UNION ALL
SELECT 18, 'O1 · catalog is read-only for members', '0',
       COUNT(*)::text
FROM   information_schema.role_table_grants
WHERE  table_schema = 'metadata' AND privilege_type <> 'SELECT'

)
SELECT
  ord                                                   AS "#",
  check_name                                            AS "check",
  expected,
  actual,
  CASE WHEN expected = actual THEN 'PASS' ELSE '*** FAIL ***' END AS status
FROM   checks
ORDER  BY ord;


-- ============================================================================
-- SECOND QUERY — run this one too, and paste its output.
--
-- The reporting views must be QUERYABLE without error. Row counts will be 0 in
-- the SQL editor (auth.uid() is null there) — that is expected. What is being
-- tested is that each view COMPILES and its columns resolve.
-- ============================================================================

SELECT 'inventory_summary'   AS view_name, COUNT(*) AS rows_visible FROM reporting.inventory_summary
UNION ALL
SELECT 'customer_balance',    COUNT(*) FROM reporting.customer_balance
UNION ALL
SELECT 'sales_summary',       COUNT(*) FROM reporting.sales_summary
UNION ALL
SELECT 'outstanding_invoices',COUNT(*) FROM reporting.outstanding_invoices;


-- ============================================================================
-- ⚠️ THIRD CHECK — THE ONE THAT ACTUALLY PROVES ISOLATION.
--
-- This CANNOT be run in the SQL editor. It must run as a REAL SIGNED-IN USER,
-- through the app or through PostgREST with that user's JWT — because it is
-- `auth.uid()` that the whole security model rests on.
--
-- Run it however you can as a normal member, and the two numbers must MATCH:
--
--   SELECT COUNT(*) FROM reporting.inventory_summary;
--
--   SELECT COUNT(*) FROM products
--   WHERE  workspace_id IN (SELECT auth_workspace_ids()) AND is_active;
--
-- Equal  → the view sees exactly that user's workspaces and nothing else.
-- Higher → the view is leaking across workspaces. Stop and report it.
-- ============================================================================
