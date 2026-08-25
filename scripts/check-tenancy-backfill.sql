-- ============================================================================
-- scripts/check-tenancy-backfill.sql
--
-- READ-ONLY. Changes nothing. Safe on production.
--
-- Answers the one question that gates the backend rewrite:
--
--     Does every row now have a workspace_id?
--
-- PHASE 4 replaces `.eq('user_id', userId)` with `.eq('workspace_id', wsId)`
-- across the invoice, customer, product and transaction services. If a single
-- row still has `workspace_id IS NULL`, that rewrite makes it invisible to its
-- owner — a real invoice that silently disappears from a real shopkeeper's
-- books. No error, no warning, just gone from every list and every total.
--
-- So this must read READY for all four entities before that change ships.
--
-- Runs in psql or the Supabase SQL editor.
-- ============================================================================

WITH counts AS (
  SELECT 'invoices' AS entity,
         count(*) AS total,
         count(workspace_id) AS with_workspace,
         count(*) FILTER (WHERE workspace_id IS NULL) AS still_null
    FROM invoices
  UNION ALL
  SELECT 'customers', count(*), count(workspace_id),
         count(*) FILTER (WHERE workspace_id IS NULL)
    FROM customers
  UNION ALL
  SELECT 'products', count(*), count(workspace_id),
         count(*) FILTER (WHERE workspace_id IS NULL)
    FROM products
  UNION ALL
  SELECT 'transactions', count(*), count(workspace_id),
         count(*) FILTER (WHERE workspace_id IS NULL)
    FROM transactions
)
SELECT
  entity,
  total,
  with_workspace,
  still_null,
  CASE
    WHEN total = 0          THEN 'EMPTY — nothing to migrate'
    WHEN still_null = 0     THEN 'READY — safe to switch this service to workspace filtering'
    ELSE 'BLOCKED — ' || still_null::text ||
         ' rows would become invisible if the backend filters on workspace_id'
  END AS verdict
FROM counts
ORDER BY entity;


-- ── Why any row is still NULL ───────────────────────────────────────────────
--
-- Three causes are possible, and they need different fixes. Run this only
-- if the query above reports BLOCKED.
--
--   user_id IS NULL  the row has no creator at all. It is ALREADY invisible
--                    today: every read is `.eq('user_id', userId)`, and SQL
--                    equality never matches NULL. So these rows are existing
--                    dark data, not a regression the workspace rewrite causes.
--                    Only a human who knows the business can place them.
--   workspaces = 0   the creator exists but belongs to no workspace. These rows
--                    ARE visible today and WOULD disappear. Fix by adding the
--                    membership, then re-running the backfill.
--   workspaces = 1   NOT ambiguous — the backfill would have filled this. The
--                    row is NULL only because it was inserted after PART 3 ran.
--                    Re-run PART 3. This keeps recurring until the Phase 4
--                    backend, which writes workspace_id on insert, is deployed.
--   workspaces > 1   genuinely ambiguous; a human must decide.

WITH membership AS (
  SELECT user_id, count(DISTINCT workspace_id) AS workspace_count
    FROM workspace_members
   GROUP BY user_id
),
unmapped AS (
  SELECT 'invoices' AS entity, i.user_id, coalesce(m.workspace_count, 0) AS workspaces
    FROM invoices i LEFT JOIN membership m ON m.user_id = i.user_id
   WHERE i.workspace_id IS NULL
  UNION ALL
  SELECT 'customers', c.user_id, coalesce(m.workspace_count, 0)
    FROM customers c LEFT JOIN membership m ON m.user_id = c.user_id
   WHERE c.workspace_id IS NULL
  UNION ALL
  SELECT 'products', p.user_id, coalesce(m.workspace_count, 0)
    FROM products p LEFT JOIN membership m ON m.user_id = p.user_id
   WHERE p.workspace_id IS NULL
  UNION ALL
  SELECT 'transactions', t.user_id, coalesce(m.workspace_count, 0)
    FROM transactions t LEFT JOIN membership m ON m.user_id = t.user_id
   WHERE t.workspace_id IS NULL
)
SELECT
  entity,
  user_id,
  workspaces,
  count(*) AS orphaned_rows,
  CASE
    WHEN user_id IS NULL
      THEN 'NO CREATOR — user_id is NULL, so there is no creator to map. These rows are ALREADY unreachable today (user_id = $1 never matches NULL), so workspace filtering does not regress them. A human must place or archive them.'
    WHEN workspaces = 0
      THEN 'ORPHANED — creator has no workspace_members row. These rows ARE visible today and WOULD disappear. Fix: add the membership, then re-run the backfill.'
    WHEN workspaces = 1
      THEN 'DRIFT — creator maps to exactly one workspace, so the backfill WOULD have filled this. It is NULL only because the row was written after PART 3 ran; the backend still inserts user_id alone. Fix: re-run PART 3. This recurs until the Phase 4 backend deploys.'
    ELSE 'AMBIGUOUS — creator belongs to ' || workspaces::text ||
         ' workspaces. Which book these rows belong to is not knowable from the data; a human must decide.'
  END AS cause_and_fix
FROM unmapped
GROUP BY entity, user_id, workspaces
ORDER BY count(*) DESC, entity
LIMIT 100;
