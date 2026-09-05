-- ============================================================================
-- docs/phase-d-01-employee-branch-assignments-migration.sql
--
-- PHASE D · 1/1 — where each employee works, over time.
--
-- ---------------------------------------------------------------------------
-- WHAT IS ACTUALLY MISSING
--
-- The audit says "employees has no direct branch assignment" and suggests
-- replacing `employees.branch_id` with an assignment table. Reading the schema:
-- there is no `employees.branch_id` to replace. The column was never added.
--
-- What exists is `member_branches (workspace_id, user_id, branch_id)`, and it
-- answers a different question. `member_branches` is about a USER — someone who
-- logs in, and whose branch assignment decides what they are ALLOWED to see. An
-- EMPLOYEE is a person on the payroll. Most employees of a shop have no login
-- at all, and the two sets overlap only partly.
--
-- So the org chart cannot currently be drawn: "which branch does this employee
-- work at" has no answer anywhere in the database, and the People screen's
-- branch tree (🏢 branch → 👤 employees) has nothing to read.
--
-- ---------------------------------------------------------------------------
-- WHY A TABLE AND NOT A COLUMN
--
-- A column says an employee is at one branch, forever, with no record of when
-- that started. Real assignments are neither:
--
--   * an employee has a PRIMARY branch and can be temporarily lent to another
--     — during a holiday season, or to cover an absence;
--   * an assignment has a START and often an END, and last quarter's payroll
--     must be attributable to where they actually worked THEN, not to where
--     they sit now. A column overwritten on transfer rewrites history silently.
--
-- `is_primary` + `starts_at` + `ends_at` carries all three. An open assignment
-- (`ends_at IS NULL`) is the current one.
--
-- ---------------------------------------------------------------------------
-- WHAT IS DELIBERATELY NOT ENFORCED
--
-- No constraint forbids an employee having zero branches. Per the standing
-- decision in `.claude/README.md` — "a member with no branch is UNRESTRICTED,
-- otherwise everyone would have been locked out on release day" — an
-- unassigned employee means "not yet assigned", not "assigned to nothing", and
-- refusing to create one would block hiring someone before the branch exists.
--
-- SAFE TO RE-RUN. Creates a table; writes rows only from a source that exists.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The assignment
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS employee_branch_assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- workspace_id is the tenancy boundary, denormalised onto the row rather than
  -- reached through the employee. Every rule in this repo filters on it
  -- directly, and a policy that has to join to find it is a policy that gets
  -- written wrong (lesson 13).
  workspace_id uuid NOT NULL,

  employee_id  uuid NOT NULL,
  branch_id    uuid NOT NULL,

  -- Exactly one open primary per employee — enforced by the partial index
  -- below, not by convention.
  is_primary   boolean NOT NULL DEFAULT false,

  starts_at    date NOT NULL DEFAULT CURRENT_DATE,

  -- NULL means "still there". A closed assignment is history and stays
  -- readable: this is how last quarter's payroll knows where the person was.
  ends_at      date,

  notes        text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,

  CONSTRAINT employee_branch_assignments_period_check
    CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

COMMENT ON TABLE employee_branch_assignments IS
  'Where an employee works, and when. SOURCE OF TRUTH for the org chart (Phase D). Distinct from member_branches, which scopes what a logged-in USER may see — an employee usually has no login, and the two must not be merged.';

COMMENT ON COLUMN employee_branch_assignments.is_primary IS
  'The employee''s home branch. At most one open primary per employee, enforced by employee_branch_assignments_one_primary. A non-primary open row is a temporary posting alongside the home branch, not instead of it.';

COMMENT ON COLUMN employee_branch_assignments.ends_at IS
  'NULL means the assignment is current. A closed row is retained: payroll for a past period must resolve to where the person actually worked then.';

-- ---------------------------------------------------------------------------
-- 2. Constraints and indexes
-- ---------------------------------------------------------------------------

-- At most ONE open primary branch per employee. Partial, because a person may
-- have many CLOSED primaries over a career — that is their transfer history.
CREATE UNIQUE INDEX IF NOT EXISTS employee_branch_assignments_one_primary
  ON employee_branch_assignments (employee_id)
  WHERE is_primary AND ends_at IS NULL;

-- The same employee cannot be assigned to the same branch twice concurrently.
CREATE UNIQUE INDEX IF NOT EXISTS employee_branch_assignments_open_unique
  ON employee_branch_assignments (employee_id, branch_id)
  WHERE ends_at IS NULL;

-- "Who works at this branch" — the People screen's branch tree.
CREATE INDEX IF NOT EXISTS employee_branch_assignments_branch_idx
  ON employee_branch_assignments (workspace_id, branch_id)
  WHERE ends_at IS NULL;

-- "Where does this employee work" — the employee detail screen.
CREATE INDEX IF NOT EXISTS employee_branch_assignments_employee_idx
  ON employee_branch_assignments (employee_id, starts_at DESC);

CREATE INDEX IF NOT EXISTS employee_branch_assignments_workspace_idx
  ON employee_branch_assignments (workspace_id);

-- NOT VALID, per hardening-migration.sql. No ON DELETE CASCADE: deleting a
-- branch that still has people posted to it must REFUSE.
ALTER TABLE employee_branch_assignments
  DROP CONSTRAINT IF EXISTS employee_branch_assignments_employee_id_fkey;
ALTER TABLE employee_branch_assignments
  ADD CONSTRAINT employee_branch_assignments_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES employees (id) NOT VALID;

ALTER TABLE employee_branch_assignments
  DROP CONSTRAINT IF EXISTS employee_branch_assignments_branch_id_fkey;
ALTER TABLE employee_branch_assignments
  ADD CONSTRAINT employee_branch_assignments_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES branches (id) NOT VALID;

ALTER TABLE employee_branch_assignments
  DROP CONSTRAINT IF EXISTS employee_branch_assignments_workspace_id_fkey;
ALTER TABLE employee_branch_assignments
  ADD CONSTRAINT employee_branch_assignments_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspaces (id) NOT VALID;

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE employee_branch_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_branch_assignments_workspace_members
  ON employee_branch_assignments;
CREATE POLICY employee_branch_assignments_workspace_members
  ON employee_branch_assignments
  FOR ALL TO authenticated
  -- auth_workspace_ids() rather than an inline subquery on workspace_members:
  -- the inline form re-enters that table's own policy, which is the recursion
  -- rls-recursion-fix-migration.sql exists to prevent.
  USING (workspace_id IN (SELECT auth_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT auth_workspace_ids()));

-- ---------------------------------------------------------------------------
-- 4. Backfill — guarded, because the source may not exist
--
-- If `employees.branch_id` was added by some migration this file does not know
-- about, its values become primary assignments. If it does not exist — which is
-- the case on the schema as audited — this block says so and does nothing.
--
-- Written as dynamic SQL because a plain UPDATE naming a column that does not
-- exist fails at PARSE time, before any IF could skip it.
-- ---------------------------------------------------------------------------

DO $backfill$
DECLARE
  v_rows bigint := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees'
      AND column_name = 'branch_id'
  ) THEN
    RAISE NOTICE 'phase-d: employees.branch_id does not exist — nothing to migrate. Assignments start empty and are made through the People screen.';
    RETURN;
  END IF;

  EXECUTE $sql$
    INSERT INTO employee_branch_assignments (
      workspace_id, employee_id, branch_id, is_primary, starts_at, notes
    )
    SELECT
      e.workspace_id,
      e.id,
      e.branch_id,
      true,
      COALESCE(e.hire_date, CURRENT_DATE),
      'Migrated from employees.branch_id by phase-d-01. The start date is the hire date because the column recorded no date of its own.'
    FROM   employees e
    WHERE  e.branch_id IS NOT NULL
      AND  e.workspace_id IS NOT NULL
      AND  NOT EXISTS (
        SELECT 1 FROM employee_branch_assignments a
        WHERE  a.employee_id = e.id AND a.ends_at IS NULL
      )
  $sql$;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RAISE NOTICE 'phase-d: % assignment(s) migrated from employees.branch_id. The column is NOT dropped — deprecate first (DATABASE_MIGRATION_POLICY.md).', v_rows;
END
$backfill$;

-- ---------------------------------------------------------------------------
-- 5. The read the screens actually want
--
-- "Who is at this branch right now", with the primary flag, ready to render as
-- the branch tree. A screen that assembled this by hand would be a fourth place
-- that has to agree about what "current" means.
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS employee_current_branches;

CREATE VIEW employee_current_branches AS
SELECT
  a.workspace_id,
  a.employee_id,
  e.employee_code,
  e.first_name,
  e.last_name,
  e.position,
  e.status              AS employment_status,
  a.branch_id,
  b.code                AS branch_code,
  b.name                AS branch_name,
  b.parent_branch_id,
  a.is_primary,
  a.starts_at
FROM   employee_branch_assignments a
JOIN   employees e ON e.id = a.employee_id
JOIN   branches  b ON b.id = a.branch_id
WHERE  a.ends_at IS NULL
  AND  b.deleted_at IS NULL;

-- Without this the view runs as its creator and returns every workspace's staff
-- list to anyone who can read it. See phase-b-03.
ALTER VIEW employee_current_branches SET (security_invoker = true);

COMMENT ON VIEW employee_current_branches IS
  'Current branch postings, joined to the employee and the branch. One row per open assignment, so an employee on temporary posting appears twice — once primary, once not. Phase D.';

COMMIT;

-- ============================================================================
-- VERIFY
-- ============================================================================
--
-- 1) The branch tree, as the People screen will draw it.
--
-- SELECT branch_name, COUNT(*) FILTER (WHERE is_primary) AS home_staff,
--        COUNT(*) FILTER (WHERE NOT is_primary)          AS visiting_staff
-- FROM   employee_current_branches
-- GROUP  BY branch_id, branch_name
-- ORDER  BY branch_name;
--
-- 2) Employees with no branch at all. NOT an error — an unassigned employee is
--    unrestricted by the standing decision — but it is the list to work
--    through when setting the org chart up.
--
-- SELECT e.id, e.employee_code, e.first_name, e.last_name
-- FROM   employees e
-- WHERE  NOT EXISTS (
--   SELECT 1 FROM employee_branch_assignments a
--   WHERE  a.employee_id = e.id AND a.ends_at IS NULL
-- );
--
-- 3) Anyone with more than one open PRIMARY. Must return nothing — the partial
--    unique index makes it impossible — so this is a check on the index, not on
--    the data.
--
-- SELECT employee_id, COUNT(*)
-- FROM   employee_branch_assignments
-- WHERE  is_primary AND ends_at IS NULL
-- GROUP  BY employee_id HAVING COUNT(*) > 1;
