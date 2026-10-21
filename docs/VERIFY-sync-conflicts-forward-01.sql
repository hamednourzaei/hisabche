-- ============================================================================
-- docs/VERIFY-sync-conflicts-forward-01.sql
--
-- READ ONLY. Run after docs/sync-conflicts-forward-01-migration.sql.
-- Nothing here writes; every statement is a question with a number for an
-- answer, so a person can decide whether the rule is in place.
-- ============================================================================

-- 1. The trigger exists, on the right table, enabled.
SELECT
  t.tgname                                   AS trigger_name,
  c.relname                                  AS table_name,
  t.tgenabled                                AS enabled
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE t.tgname = 'sync_conflicts_forward_only';

-- 2. The function exists and cannot be called by a client role.
SELECT
  p.proname                                  AS function_name,
  p.prosecdef                                AS security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE')  AS service_role_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'sync_conflicts_forward_only';

-- 3. Every conflict, by the two storage words, so the derived state can be
--    read off it: open -> PENDING_REVIEW, resolved+keep_client -> ACCEPTED,
--    resolved+keep_server -> REJECTED, resolved+merge/auto_merge -> RESOLVED,
--    superseded -> SUPERSEDED.
SELECT
  status,
  resolution,
  COUNT(*) AS conflicts
FROM sync_conflicts
GROUP BY status, resolution
ORDER BY status, resolution;

-- 4. MUST BE 0. A HUMAN decision with no decider is a decision nobody made.
--    An `auto_merge` is the machine's decision on a non-financial field and is
--    filed without a decider, so it is excluded here and counted in 6.
SELECT COUNT(*) AS human_resolutions_without_decider
FROM sync_conflicts
WHERE status = 'resolved'
  AND resolution IS DISTINCT FROM 'auto_merge'
  AND resolved_by IS NULL;

-- 5. MUST BE 0. Nothing is resolved at no time - an auto-merge included.
SELECT COUNT(*) AS resolved_without_moment
FROM sync_conflicts
WHERE status = 'resolved'
  AND resolved_at IS NULL;

-- 6. What the machine decided on its own. Informational: the screen reads these
--    as RESOLVED, and each one still has the merged row it wrote.
SELECT COUNT(*) AS auto_merged
FROM sync_conflicts
WHERE resolution = 'auto_merge';
