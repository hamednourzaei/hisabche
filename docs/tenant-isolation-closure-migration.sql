-- ============================================================================
-- docs/tenant-isolation-closure-migration.sql
--
-- Closing the last tenancy holes: HR, projects and CRM.
--
-- These five tables held SHARED business data and were queried by `user_id`.
-- The consequences were the same shape every time and none of them looked like
-- a bug from the outside:
--
--   * an employee one member entered was invisible to the rest of the shop
--   * a project's tasks belonged to whoever typed them, not to the business
--   * a manager could not record an outcome on a task their seller created
--   * the CRM cache keys carried the user, so two colleagues looking at the
--     same pipeline saw two different pipelines
--
-- The application half of this is already done — every query filters on
-- `workspace_id` from a verified TenancyContext, and the static guard now
-- fails the build if one regresses. This file is the database half.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── 1. The column ──────────────────────────────────────────────────────────

ALTER TABLE departments   ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE employees     ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE attendance    ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE projects      ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE interactions  ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS workspace_id uuid;

-- ─── 2. Backfill, failing closed ────────────────────────────────────────────
-- Only rows whose creator maps to EXACTLY ONE workspace are filled. A user who
-- owns their own shop and also sells in somebody else's has two, and guessing
-- which one their rows belong to could move an employee record between
-- businesses. Those rows stay NULL and are counted in PART 4.

CREATE TEMP VIEW sole_membership AS
  SELECT user_id, MIN(workspace_id::text)::uuid AS workspace_id
  FROM workspace_members
  WHERE has_access = true AND suspended_at IS NULL
  GROUP BY user_id
  HAVING COUNT(DISTINCT workspace_id) = 1;

UPDATE departments t SET workspace_id = m.workspace_id
  FROM sole_membership m WHERE t.workspace_id IS NULL AND t.user_id = m.user_id;

UPDATE employees t SET workspace_id = m.workspace_id
  FROM sole_membership m WHERE t.workspace_id IS NULL AND t.user_id = m.user_id;

UPDATE projects t SET workspace_id = m.workspace_id
  FROM sole_membership m WHERE t.workspace_id IS NULL AND t.user_id = m.user_id;

UPDATE interactions t SET workspace_id = m.workspace_id
  FROM sole_membership m WHERE t.workspace_id IS NULL AND t.user_id = m.user_id;

UPDATE opportunities t SET workspace_id = m.workspace_id
  FROM sole_membership m WHERE t.workspace_id IS NULL AND t.user_id = m.user_id;

-- Children inherit from their parent, which is more reliable than their own
-- creator: a task typed by a colleague still belongs to the project's shop.
UPDATE attendance a SET workspace_id = e.workspace_id
  FROM employees e WHERE a.workspace_id IS NULL AND a.employee_id = e.id;

UPDATE project_tasks t SET workspace_id = p.workspace_id
  FROM projects p WHERE t.workspace_id IS NULL AND t.project_id = p.id;

-- ─── 3. Indexes ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS departments_workspace_idx   ON departments (workspace_id);
CREATE INDEX IF NOT EXISTS employees_workspace_idx     ON employees (workspace_id);
CREATE INDEX IF NOT EXISTS attendance_workspace_idx    ON attendance (workspace_id, employee_id);
CREATE INDEX IF NOT EXISTS projects_workspace_idx      ON projects (workspace_id);
CREATE INDEX IF NOT EXISTS project_tasks_workspace_idx ON project_tasks (workspace_id, project_id);
CREATE INDEX IF NOT EXISTS interactions_workspace_idx  ON interactions (workspace_id, customer_id);
CREATE INDEX IF NOT EXISTS opportunities_workspace_idx ON opportunities (workspace_id, customer_id);

-- ─── 4. Verify before enabling ──────────────────────────────────────────────
-- Run this and read it. A non-zero `unmapped` is not a failure of the
-- migration; it is a list of rows that need a human to say which business
-- they belong to.

SELECT 'departments'   AS table_name, count(*) FILTER (WHERE workspace_id IS NULL) AS unmapped, count(*) AS total FROM departments
UNION ALL SELECT 'employees',     count(*) FILTER (WHERE workspace_id IS NULL), count(*) FROM employees
UNION ALL SELECT 'attendance',    count(*) FILTER (WHERE workspace_id IS NULL), count(*) FROM attendance
UNION ALL SELECT 'projects',      count(*) FILTER (WHERE workspace_id IS NULL), count(*) FROM projects
UNION ALL SELECT 'project_tasks', count(*) FILTER (WHERE workspace_id IS NULL), count(*) FROM project_tasks
UNION ALL SELECT 'interactions',  count(*) FILTER (WHERE workspace_id IS NULL), count(*) FROM interactions
UNION ALL SELECT 'opportunities', count(*) FILTER (WHERE workspace_id IS NULL), count(*) FROM opportunities;

-- ─── 5. Row level security ──────────────────────────────────────────────────

ALTER TABLE departments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees     ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'departments', 'employees', 'attendance',
    'projects', 'project_tasks',
    'interactions', 'opportunities'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_workspace_members', v_table);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO authenticated
        USING (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
        ))
        WITH CHECK (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
        ))
    $p$, v_table || '_workspace_members', v_table);
  END LOOP;
END $$;

COMMIT;
