-- ============================================================================
-- docs/phase-g-01-branch-manager-migration.sql
--
-- PHASE G · G2 — a branch can name the employee who runs it.
--
-- ---------------------------------------------------------------------------
-- WHY
--
-- The People screen's «شعب» tab renders the branch tree with an «افزودن شعبه»
-- form whose fields are: name, code, optional parent, optional MANAGER. The
-- first three exist on `branches`; the fourth does not — the table has
-- (id, workspace_id, code, name, parent_branch_id, is_active, deleted_at,
-- created_at, updated_at, created_by) and nothing else.
--
-- ---------------------------------------------------------------------------
-- WHY manager_employee_id AND NOT manager_user_id
--
-- The same distinction Phase D drew, and for the same reason. A branch manager
-- is a PERSON ON THE PAYROLL, and most of them have no login at all — a shop
-- with four staff typically has one account. Pointing this at `auth.users`
-- would make it impossible to name the actual manager of most branches, and
-- would quietly turn an org-chart fact into a login fact.
--
-- `member_branches` remains what it was: which BRANCHES a signed-in user may
-- see. That is authorization. This is the org chart. They are not the same
-- column and must not be merged.
--
-- ---------------------------------------------------------------------------
-- NULLABLE, DELIBERATELY
--
-- A branch with no named manager is normal — it is how every branch starts,
-- and a shop owner who runs all three of their branches themselves has no
-- reason to name anyone. Requiring it would block creating a branch before
-- hiring, which is backwards: you open the shop, then you staff it.
--
-- SAFE TO RE-RUN. Additive only.
-- ============================================================================

BEGIN;

ALTER TABLE branches ADD COLUMN IF NOT EXISTS manager_employee_id uuid;

COMMENT ON COLUMN branches.manager_employee_id IS
  'The employee who runs this branch. NULL means nobody is named yet, which is normal. References employees, NOT auth.users: a branch manager is a person on the payroll and most have no login. Phase G (G2).';

-- The tree read joins the manager in to show a name beside each branch.
CREATE INDEX IF NOT EXISTS branches_manager_employee_idx
  ON branches (manager_employee_id);

-- NOT VALID, per hardening-migration.sql, and NO cascade: deleting an employee
-- who still manages a branch must REFUSE rather than silently leaving the
-- branch unmanaged with no record that it ever had one.
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_manager_employee_id_fkey;
ALTER TABLE branches ADD CONSTRAINT branches_manager_employee_id_fkey
  FOREIGN KEY (manager_employee_id) REFERENCES employees (id) NOT VALID;

-- ---------------------------------------------------------------------------
-- The tree read, as one query
--
-- The «شعب» tab needs, per branch: the branch, its parent (to nest it), its
-- manager's name, and how many people are posted to it. Assembling that in the
-- client would be one request per branch plus one per manager.
--
-- Head count comes from `employee_branch_assignments` with `ends_at IS NULL`
-- and `is_primary` — the people whose HOME this branch is. Someone on a
-- temporary posting appears under their home branch, not twice.
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS branch_tree;

CREATE VIEW branch_tree AS
SELECT
  b.id                                   AS branch_id,
  b.workspace_id,
  b.code,
  b.name,
  b.parent_branch_id,
  b.is_active,
  b.manager_employee_id,
  m.first_name                           AS manager_first_name,
  m.last_name                            AS manager_last_name,
  COALESCE(hc.head_count, 0)             AS head_count
FROM   branches b
LEFT   JOIN employees m ON m.id = b.manager_employee_id
LEFT   JOIN (
  SELECT a.branch_id, COUNT(*) AS head_count
  FROM   employee_branch_assignments a
  WHERE  a.ends_at IS NULL AND a.is_primary
  GROUP  BY a.branch_id
) hc ON hc.branch_id = b.id
WHERE  b.deleted_at IS NULL;

-- Without this the view runs as its creator and returns every workspace's
-- branch structure to anyone who can read it. See phase-b-03 for the incident
-- that made this a standing rule.
ALTER VIEW branch_tree SET (security_invoker = true);

COMMENT ON VIEW branch_tree IS
  'Branches with their manager''s name and primary head count, ready to nest by parent_branch_id. Soft-deleted branches excluded. Phase G (G2).';

COMMIT;

-- ============================================================================
-- VERIFY
-- ============================================================================
--
-- 1) The tree as the «شعب» tab will draw it.
--
-- SELECT code, name, parent_branch_id, manager_last_name, head_count
-- FROM   branch_tree
-- WHERE  workspace_id = '<workspace uuid>'
-- ORDER  BY parent_branch_id NULLS FIRST, code;
--
-- 2) A manager who is not posted to the branch they manage. Not an error — a
--    regional manager legitimately sits elsewhere — but worth eyeballing.
--
-- SELECT b.name AS branch, m.first_name, m.last_name
-- FROM   branches b
-- JOIN   employees m ON m.id = b.manager_employee_id
-- WHERE  NOT EXISTS (
--   SELECT 1 FROM employee_branch_assignments a
--   WHERE  a.employee_id = b.manager_employee_id
--     AND  a.branch_id = b.id AND a.ends_at IS NULL
-- );
