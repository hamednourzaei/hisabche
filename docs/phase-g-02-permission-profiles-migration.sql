-- ============================================================================
-- docs/phase-g-02-permission-profiles-migration.sql
--
-- PHASE G · G3 — the permission profiles the matrix screen offers.
--
-- ---------------------------------------------------------------------------
-- WHY THIS FILE AND NOT AN EDIT TO phase-e-01
--
-- `phase-e-01` already ran on the live database. Editing an applied migration
-- changes its checksum and makes the ledger say something that is not true
-- about what was executed. New facts go in a new file.
--
-- ---------------------------------------------------------------------------
-- WHAT IS MISSING, AND WHAT IS NOT
--
-- Phase E seeded eight system roles: owner, manager, seller, accountant,
-- sales_manager, cashier, warehouse_manager, viewer.
--
-- G3 names seven profiles: Owner, General Manager, Accountant, Sales Manager,
-- Sales Agent, Warehouse Manager, HR Manager. Comparing the two lists, three
-- are genuinely new:
--
--   general_manager   runs the business day to day, short of closing periods
--   sales_agent       sells and takes money; no ledger, no cost, no margins
--   hr_manager        people and payroll; no ledger, no stock
--
-- `cashier` and `viewer` are NOT removed. They are seeded, possibly assigned,
-- and dropping a role would revoke whatever it grants from whoever holds it.
--
-- ---------------------------------------------------------------------------
-- ⚠️ WHAT A PROFILE CAN DO — the thing to understand before using this screen
--
-- Capability resolution is still ADDITIVE (Phase E, deliberately): the enforced
-- answer comes from `workspace_members.role` via the static table, and a
-- profile grant can only ADD on top. Giving someone the "Viewer" profile does
-- NOT restrict them — it grants read capabilities they may already have.
--
-- Profiles are therefore useful for WIDENING: making a seller into an
-- accountant for the ledger, without making them a manager everywhere. The
-- matrix screen says this on its face rather than implying otherwise.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
-- Additive only: three `roles` rows and their `role_permissions` edges. To undo,
-- delete the grants and then the roles by code:
--
--   DELETE FROM role_permissions rp USING roles r
--    WHERE rp.role_id = r.id AND r.workspace_id IS NULL
--      AND r.code IN ('general_manager', 'sales_agent', 'hr_manager');
--   DELETE FROM roles
--    WHERE workspace_id IS NULL
--      AND code IN ('general_manager', 'sales_agent', 'hr_manager');
--
-- ⚠️ Check `user_roles` first — deleting a role someone holds revokes whatever
-- it granted them, which is a permission change, not a cleanup.
--
-- SAFE TO RE-RUN. Every statement is an idempotent upsert.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The three missing profiles
-- ---------------------------------------------------------------------------

INSERT INTO roles (code, name, description, is_system, workspace_id)
SELECT r.code, r.name, r.description, true, NULL
FROM (VALUES
  ('general_manager',   'مدیر کل',   'اداره‌ی روزمره‌ی کسب‌وکار؛ بدون بستن دوره و برگشت سند.'),
  ('sales_agent',       'فروشنده',   'فروش و دریافت وجه؛ بدون دفتر کل و بدون بهای تمام‌شده.'),
  ('hr_manager',        'مدیر منابع انسانی', 'کارکنان، شعب و حقوق؛ بدون دفتر کل و بدون انبار.')
) AS r(code, name, description)
ON CONFLICT (code) WHERE workspace_id IS NULL
DO UPDATE SET name        = EXCLUDED.name,
              description = EXCLUDED.description,
              is_system   = true;

-- ---------------------------------------------------------------------------
-- 2. What each grants
--
-- Transcribed from the same 24-code vocabulary `requireCapability` enforces.
--
-- `sales_agent` deliberately lacks `inventory.cost.read`: an agent sells at the
-- sell price and has no reason to know the buy price. That single omission is
-- the difference between a sales role and a manager one.
--
-- `hr_manager` deliberately lacks every ledger and inventory capability. Payroll
-- is people work; posting the payroll JOURNAL is accounting work, and the two
-- being one role is how one person both runs and books the payroll with nobody
-- checking (§ SoD).
-- ---------------------------------------------------------------------------

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r
JOIN   permissions p
  ON   p.code = ANY (
    CASE r.code
      WHEN 'general_manager' THEN ARRAY[
        'ledger.read','ledger.post','account.manage',
        'payment.read','payment.record','payment.cancel',
        'inventory.read','inventory.cost.read',
        'invoice.read','invoice.create','invoice.update',
        'customer.read','customer.write','product.read','product.write',
        'report.operational.read','report.financial.read',
        'data.import','member.manage'
      ]
      WHEN 'sales_agent' THEN ARRAY[
        'payment.read','payment.record',
        'inventory.read',
        'invoice.read','invoice.create',
        'customer.read','customer.write','product.read',
        'report.operational.read'
      ]
      WHEN 'hr_manager' THEN ARRAY[
        'report.operational.read',
        'member.manage'
      ]
      ELSE ARRAY[]::text[]
    END
  )
WHERE  r.workspace_id IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Documentation, for the Phase O catalogue
-- ---------------------------------------------------------------------------

COMMENT ON TABLE roles IS
  'Named permission profiles. workspace_id NULL = system role shared by every workspace; non-null = that workspace''s own. ⚠️ owner/manager/seller mirror the ENFORCED static capability table (authorization.domain.ts) and their grants are read-only in the Permission Matrix — editing them would show one thing and enforce another. Every other role is a PROFILE: additive only, it can widen what a member holds and cannot narrow it. Phase E / G3.';

COMMENT ON TABLE role_permissions IS
  'Which capabilities a role grants. Additive: a member''s effective capability set is the union of their workspace_members.role (enforced) and every role granted through user_roles. Removing a row here cannot take away a capability the base role already gives. Phase E / G3.';

COMMENT ON TABLE user_roles IS
  'Which profiles a USER holds, per workspace. Keyed to a user, not an employee — most employees have no login, and a profile is meaningless without one. Phase E / G3.';

COMMIT;

-- ============================================================================
-- VERIFY
-- ============================================================================
--
-- 1) The eleven system roles and what each grants. Expect 11 rows.
--
-- SELECT r.code, r.name, COUNT(rp.permission_id) AS capabilities
-- FROM   roles r
-- LEFT   JOIN role_permissions rp ON rp.role_id = r.id
-- WHERE  r.workspace_id IS NULL
-- GROUP  BY r.code, r.name
-- ORDER  BY capabilities DESC;
--
-- 2) Any grant naming a capability that no longer exists in the enforced
--    vocabulary. MUST BE EMPTY — a grant nothing enforces is a cell in the
--    matrix that does nothing.
--
-- SELECT DISTINCT p.code
-- FROM   role_permissions rp
-- JOIN   permissions p ON p.id = rp.permission_id
-- WHERE  p.code NOT IN (
--   'ledger.read','ledger.post','ledger.reverse','ledger.lock_period','account.manage',
--   'payment.read','payment.record','payment.cancel',
--   'inventory.read','inventory.cost.read','inventory.configure',
--   'invoice.read','invoice.create','invoice.update','invoice.delete',
--   'customer.read','customer.write','product.read','product.write',
--   'report.operational.read','report.financial.read',
--   'data.import','member.manage','workspace.manage'
-- );
--
--    ⚠️ Rows here are EXPECTED on a database that ran the old
--    `permission.service.seedDefaultPermissions()` — it seeds 33 codes
--    (hr.read, project.delete, …) from a vocabulary nothing enforces. They are
--    harmless (no route checks them) and are NOT deleted here. Phase E
--    documented them; this query is how you tell them apart from a real
--    mismatch.
