-- ============================================================================
-- time-entries-unify-01-migration.sql
--
-- V60.1 §2 — Additive, idempotent migration unifying `project_time_entries`
-- into the canonical `time_entries` billing store.
--
-- SAFETY:
--   - Additive only: NEVER deletes or truncates `project_time_entries`.
--   - Idempotent: re-running copies zero duplicate rows (`ON CONFLICT (id) DO NOTHING`
--     and signature deduplication guard).
--   - Run `docs/FINDING-time-entries-two-stores.sql` first so the owner has the
--     exact pre-migration counts.
-- ============================================================================

-- Record provenance when a row is copied from project_time_entries
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS legacy_project_time_entry_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS time_entries_legacy_pte_uidx
  ON time_entries (legacy_project_time_entry_id)
  WHERE legacy_project_time_entry_id IS NOT NULL;

INSERT INTO time_entries (
  id,
  workspace_id,
  project_id,
  task_id,
  employee_id,
  on_date,
  minutes,
  billable,
  rate_minor,
  description,
  legacy_project_time_entry_id,
  created_at
)
SELECT
  p.id,
  p.workspace_id,
  p.project_id,
  p.task_id,
  p.employee_id,
  p.date::date,
  GREATEST(1, ROUND(p.hours * 60)::integer),
  COALESCE(p.billable, true),
  CASE
    WHEN p.hourly_rate IS NULL THEN NULL
    ELSE ROUND(p.hourly_rate * 100)::bigint
  END,
  COALESCE(p.description, ''),
  p.id,
  COALESCE(p.created_at, now())
FROM project_time_entries p
WHERE p.workspace_id IS NOT NULL
  AND p.project_id IS NOT NULL
  AND p.employee_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM time_entries existing
    WHERE existing.id = p.id
       OR existing.legacy_project_time_entry_id = p.id
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Rollback block (safe: only removes rows copied by this migration if unbilled)
-- ============================================================================
-- DELETE FROM time_entries
-- WHERE legacy_project_time_entry_id IS NOT NULL
--   AND invoice_id IS NULL;
-- DROP INDEX IF EXISTS time_entries_legacy_pte_uidx;
-- ALTER TABLE time_entries DROP COLUMN IF EXISTS legacy_project_time_entry_id;
