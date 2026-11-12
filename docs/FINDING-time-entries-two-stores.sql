-- ============================================================================
-- FINDING-time-entries-two-stores.sql (READ-ONLY)
--
-- V60.1 §2 — Audit the two parallel time-entry stores before running
-- `docs/time-entries-unify-01-migration.sql`:
--   1. `project_time_entries` (historically written by /api/projects/:id/time-entries)
--   2. `time_entries`         (canonical billing store written by /api/operations/timesheets)
--
-- Run in Supabase SQL Editor (read-only) and save output for owner review.
-- ============================================================================

-- 1. Row counts & date ranges per workspace in both tables
WITH pte_stats AS (
  SELECT
    workspace_id,
    COUNT(*)::bigint                 AS pte_rows,
    COUNT(*) FILTER (WHERE billable) AS pte_billable_rows,
    MIN(date::date)                  AS pte_min_date,
    MAX(date::date)                  AS pte_max_date
  FROM project_time_entries
  GROUP BY workspace_id
),
te_stats AS (
  SELECT
    workspace_id,
    COUNT(*)::bigint                           AS te_rows,
    COUNT(*) FILTER (WHERE billable)           AS te_billable_rows,
    COUNT(*) FILTER (WHERE invoice_id IS NULL) AS te_unbilled_rows,
    MIN(on_date)                               AS te_min_date,
    MAX(on_date)                               AS te_max_date
  FROM time_entries
  WHERE deleted_at IS NULL
  GROUP BY workspace_id
)
SELECT
  COALESCE(p.workspace_id, t.workspace_id) AS workspace_id,
  COALESCE(p.pte_rows, 0)                  AS project_time_entries_count,
  COALESCE(p.pte_billable_rows, 0)         AS project_time_entries_billable,
  p.pte_min_date,
  p.pte_max_date,
  COALESCE(t.te_rows, 0)                   AS time_entries_count,
  COALESCE(t.te_billable_rows, 0)          AS time_entries_billable,
  COALESCE(t.te_unbilled_rows, 0)          AS time_entries_unbilled,
  t.te_min_date,
  t.te_max_date
FROM pte_stats p
FULL OUTER JOIN te_stats t
  ON t.workspace_id = p.workspace_id
ORDER BY workspace_id NULLS FIRST;

-- 2. Potential overlap: entries matching by same id OR same (workspace, project, employee, date, minutes)
SELECT
  p.workspace_id,
  COUNT(*) FILTER (WHERE t_by_id.id IS NOT NULL)::bigint  AS exact_id_overlap,
  COUNT(*) FILTER (
    WHERE t_by_id.id IS NULL AND t_by_sig.id IS NOT NULL
  )::bigint                                               AS heuristic_signature_overlap,
  COUNT(*) FILTER (
    WHERE t_by_id.id IS NULL AND t_by_sig.id IS NULL
  )::bigint                                               AS missing_from_canonical_time_entries
FROM project_time_entries p
LEFT JOIN time_entries t_by_id
  ON t_by_id.id = p.id
LEFT JOIN LATERAL (
  SELECT te.id
  FROM time_entries te
  WHERE te.deleted_at IS NULL
    AND te.workspace_id = p.workspace_id
    AND te.project_id   = p.project_id
    AND te.employee_id  = p.employee_id
    AND te.on_date      = p.date::date
    AND te.minutes      = GREATEST(1, ROUND(p.hours * 60)::integer)
  LIMIT 1
) t_by_sig ON true
GROUP BY p.workspace_id
ORDER BY p.workspace_id NULLS FIRST;
