-- ═══════════════════════════════════════════════════════════════════════════
-- FINDING 3 — RLS FLAG vs POLICY COUNT
-- ═══════════════════════════════════════════════════════════════════════════
--
-- "Has a policy" and "is protected" are DIFFERENT QUESTIONS, and only the
-- first one decides whether a query from a browser succeeds:
--
--   · RLS ON  + no policy  → every statement DENIED. Safe but broken.
--   · RLS OFF + no policy  → everything GRANTED, including to the public anon
--                            key. Unguarded.
--
-- The table below pairs the two so each one is read against the other. It is
-- built from the specific tables the dump and the code disagree about, rather
-- than all of them, so the answer is a short list rather than a hundred rows.
--
-- ⚠️ RUN THIS ALONE.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
  '=== RLS FLAG vs POLICY COUNT ==='                                        AS section,
  c.relname                                                                 AS table,
  c.relrowsecurity                                                           AS rls_on,
  c.relforcerowsecurity                                                     AS rls_forced,
  (SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname)              AS policies,
  CASE
    WHEN NOT c.relrowsecurity AND (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = c.relname) = 0
      THEN 'UNGUARDED - RLS off and no policy'
    WHEN c.relrowsecurity AND (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = c.relname) = 0
      THEN 'DENY-ALL - RLS on, nothing granted'
    ELSE 'policies present'
  END                                                                       AS verdict
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND c.relname IN (
    'sync_queue','sync_logs','webhook_events','event_types',
    'ledger_entries','cost_reposts','cost_repost_adjustments',
    'attendance','cycle_counts','cycle_count_lines',
    'inventory_settings','accounting_period_locks',
    'stock_movements','workspace_members','sync_conflicts'
  )
ORDER BY verdict DESC, c.relname;
