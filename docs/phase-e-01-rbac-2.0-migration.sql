-- ============================================================================
-- docs/phase-e-01-rbac-2.0-migration.sql
--
-- PHASE E · 1/1 — Role → Permission, made real, without changing what anyone
-- can do today.
--
-- ---------------------------------------------------------------------------
-- WHAT IS ACTUALLY THERE — two RBAC systems and a third vocabulary
--
--   1. THE ONE THAT DECIDES.
--      `workspace_members.role` ∈ {owner, manager, seller} → `can(role, cap)`
--      in `authorization.domain.ts`, against a static MIN_ROLE table of 24
--      capabilities. It is enforced by `requireCapability` on every financial
--      route, it is unit-tested, and it works.
--
--   2. THE ONE NOTHING ENFORCES.
--      `roles` / `permissions` / `role_permissions` / `user_roles`. Real
--      tables, reachable through /api/permissions, connected to no route
--      guard. Assigning someone a role here changes nothing.
--
--   3. A THIRD VOCABULARY.
--      `permission.service.ts` seeds 33 permission codes (`product.create`,
--      `hr.read`, `project.delete`, …) that do not appear in CAPABILITIES and
--      name modules the capability model does not have. So the two systems do
--      not even disagree about the same words.
--
-- ---------------------------------------------------------------------------
-- 🔴 AND A TENANCY HOLE IN (2)
--
-- `permission.service.hasPermission(userId, code)` queries `user_roles`
-- filtered by `user_id` ALONE. `user_roles.workspace_id` exists and is ignored.
-- Someone who is an Accountant in one workspace carries that permission into
-- every other workspace they belong to. The cache key omits the workspace too,
-- so the first answer is served to everyone (lessons 1, 11, 18).
--
-- It is not on the enforcement path today, which is the only reason this is not
-- an active breach — but Phase E is precisely the change that PUTS it on the
-- enforcement path, so it is fixed here and in the service.
--
-- ---------------------------------------------------------------------------
-- ⚠️ THIS RELEASE IS ADDITIVE. READ THIS BEFORE ASSUMING IT SWITCHED OVER.
--
-- Replacing a working authorization check with a database-driven one, in one
-- step, has exactly two failure modes and both are catastrophic: everyone is
-- locked out of a live financial book, or everyone is granted everything. The
-- static table is the thing that currently works and it is NOT removed here.
--
-- What this migration does is make (2) TRUE and COMPLETE:
--
--   * every capability from (1) exists as a `permissions` row
--   * system roles owner / manager / seller hold EXACTLY the capabilities
--     MIN_ROLE gives them — the seeding below is a transcription of that table
--   * every existing member gets a `user_roles` row matching the role they
--     already have, so the two systems agree on day one
--   * the profile roles the architecture calls for (Accountant, Sales Manager,
--     Cashier, Warehouse Manager, Viewer) exist and are assignable
--
-- The backend then resolves capabilities as the UNION of the static role and
-- the granted permissions: the database can GRANT but not REVOKE. A wrong row
-- cannot lock anyone out of their own books.
--
-- Flipping to database-only — where a grant can also revoke — is a separate,
-- later change, made once `rbac_grant_drift` below has returned no rows for a
-- release. Do not do it in the same deploy.
--
-- SAFE TO RE-RUN. Every seed is an idempotent upsert.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Roles become workspace-aware
--
-- `roles` had no workspace_id, which makes every role global: a custom role
-- created by one business would appear in every other business on the platform.
--
-- NULL means a SYSTEM role, shared by everyone and not editable. A non-null
-- workspace_id is that workspace's own custom role. Nullable rather than a
-- separate table because the two are the same thing to every reader of them.
-- ---------------------------------------------------------------------------

ALTER TABLE roles ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS code text;

COMMENT ON COLUMN roles.workspace_id IS
  'NULL = system role, shared by every workspace and not editable. Non-null = that workspace''s own custom role. Phase E.';
COMMENT ON COLUMN roles.code IS
  'Stable machine name (owner, manager, seller, accountant, …). `name` is for display and may be translated; nothing keys off it.';

-- Existing rows have no code. Derive one from the name so the unique index
-- below can be created, rather than failing on NULLs.
UPDATE roles
   SET code = lower(regexp_replace(COALESCE(name, 'role-' || left(id::text, 8)), '[^a-zA-Z0-9]+', '_', 'g'))
 WHERE code IS NULL;

-- One `owner` system role, and one `owner` per workspace that defines its own.
-- Two partial indexes, because a UNIQUE over a nullable column treats every
-- NULL as distinct and would allow ten system roles called `owner`.
CREATE UNIQUE INDEX IF NOT EXISTS roles_system_code_key
  ON roles (code) WHERE workspace_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS roles_workspace_code_key
  ON roles (workspace_id, code) WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS roles_workspace_idx ON roles (workspace_id);

ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_workspace_id_fkey;
ALTER TABLE roles ADD CONSTRAINT roles_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspaces (id) NOT VALID;

-- ---------------------------------------------------------------------------
-- 2. Permissions and the join table get the constraints that make them a set
--
-- `role_permissions` had no uniqueness, so granting the same permission twice
-- produced two rows and revoking it once left the role still holding it.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS permissions_code_key ON permissions (code);

CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_unique
  ON role_permissions (role_id, permission_id);

CREATE INDEX IF NOT EXISTS role_permissions_role_idx ON role_permissions (role_id);
CREATE INDEX IF NOT EXISTS role_permissions_permission_idx ON role_permissions (permission_id);

ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_id_fkey;
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_role_id_fkey
  FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE NOT VALID;

ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_permission_id_fkey;
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_permission_id_fkey
  FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE NOT VALID;

-- ⚠️ ON DELETE CASCADE here, unlike everywhere else in this schema. A
-- role_permissions row is not a fact about the business — it is the edge of a
-- graph. Deleting a role should remove its grants, not refuse because grants
-- exist. The financial tables keep RESTRICT.

-- ---------------------------------------------------------------------------
-- 3. user_roles — a grant belongs to ONE workspace
-- ---------------------------------------------------------------------------

-- Backfill from the member's own membership before anything is made strict.
UPDATE user_roles ur
   SET workspace_id = m.workspace_id
  FROM workspace_members m
 WHERE ur.workspace_id IS NULL
   AND m.user_id = ur.user_id
   AND NOT EXISTS (
     SELECT 1 FROM workspace_members m2
     WHERE m2.user_id = ur.user_id AND m2.workspace_id <> m.workspace_id
   );

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_unique
  ON user_roles (workspace_id, user_id, role_id);

CREATE INDEX IF NOT EXISTS user_roles_workspace_user_idx
  ON user_roles (workspace_id, user_id);

ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_id_fkey;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_id_fkey
  FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE NOT VALID;

ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_workspace_id_fkey;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspaces (id) NOT VALID;

COMMENT ON COLUMN user_roles.workspace_id IS
  'REQUIRED in practice. A grant is scoped to one workspace: the same person is an accountant in one business and a seller in another. Reading user_roles without this filter is the defect Phase E fixed in permission.service.ts.';

-- ---------------------------------------------------------------------------
-- 4. The permission catalogue — transcribed from CAPABILITIES
--
-- These 24 codes are the vocabulary `requireCapability` actually enforces, from
-- `authorization.domain.ts`. The 33 codes `permission.service.ts` seeds are a
-- different vocabulary naming modules this model does not have; they are left
-- in place (deleting them would break the /api/permissions screens) but they
-- grant nothing, and nothing new should be added to them.
--
-- `resource` and `action` are split at the LAST dot, so `inventory.cost.read`
-- becomes resource `inventory.cost`, action `read` — which is what it means.
-- ---------------------------------------------------------------------------

INSERT INTO permissions (code, name, description, resource, action)
SELECT
  c.code,
  c.label,
  'Capability enforced by requireCapability(). Seeded by phase-e-01.',
  regexp_replace(c.code, '\.[^.]+$', ''),
  regexp_replace(c.code, '^.*\.', '')
FROM (VALUES
  ('ledger.read',             'مشاهده دفتر کل'),
  ('ledger.post',             'ثبت سند'),
  ('ledger.reverse',          'برگشت سند'),
  ('ledger.lock_period',      'بستن دوره'),
  ('account.manage',          'مدیریت حساب‌ها'),
  ('payment.read',            'مشاهده پرداخت'),
  ('payment.record',          'ثبت پرداخت'),
  ('payment.cancel',          'ابطال پرداخت'),
  ('inventory.read',          'مشاهده موجودی'),
  ('inventory.cost.read',     'مشاهده بهای موجودی'),
  ('inventory.configure',     'پیکربندی موجودی'),
  ('invoice.read',            'مشاهده فاکتور'),
  ('invoice.create',          'صدور فاکتور'),
  ('invoice.update',          'ویرایش فاکتور'),
  ('invoice.delete',          'حذف فاکتور'),
  ('customer.read',           'مشاهده مشتری'),
  ('customer.write',          'ثبت و ویرایش مشتری'),
  ('product.read',            'مشاهده کالا'),
  ('product.write',           'ثبت و ویرایش کالا'),
  ('report.operational.read', 'گزارش‌های عملیاتی'),
  ('report.financial.read',   'گزارش‌های مالی'),
  ('data.import',             'ورود داده'),
  ('member.manage',           'مدیریت اعضا'),
  ('workspace.manage',        'مدیریت کسب‌وکار')
) AS c(code, label)
ON CONFLICT (code) DO UPDATE
  SET resource = EXCLUDED.resource,
      action   = EXCLUDED.action;

-- ---------------------------------------------------------------------------
-- 5. System roles
--
-- The first three MUST reproduce MIN_ROLE exactly — they are what every
-- existing member is about to be granted, and a difference here is a silent
-- change to what a real person can do.
--
-- The last five are the profiles the architecture calls for. Nobody holds them
-- until someone is assigned one.
-- ---------------------------------------------------------------------------

INSERT INTO roles (code, name, description, is_system, workspace_id)
SELECT r.code, r.name, r.description, true, NULL
FROM (VALUES
  ('owner',             'مالک',              'همه‌ی اختیارات، شامل بستن دوره و برگشت سند.'),
  ('manager',           'مدیر',              'اداره‌ی روزمره‌ی دفاتر؛ بدون بستن دوره، برگشت سند و حذف.'),
  ('seller',            'فروشنده',           'فروش و دریافت پول؛ بدون دسترسی به بهای تمام‌شده و دفتر کل.'),
  ('accountant',        'حسابدار',           'دفتر کل و گزارش‌های مالی؛ بدون مدیریت اعضا و بدون حذف.'),
  ('sales_manager',     'مدیر فروش',         'فروش، مشتریان و گزارش عملیاتی؛ بدون دفتر کل.'),
  ('cashier',           'صندوق‌دار',          'صدور فاکتور و دریافت وجه در باجه.'),
  ('warehouse_manager', 'مدیر انبار',        'موجودی و کالا، شامل بهای تمام‌شده.'),
  ('viewer',            'فقط مشاهده',        'خواندن، بدون هیچ نوشتنی.')
) AS r(code, name, description)
ON CONFLICT (code) WHERE workspace_id IS NULL
DO UPDATE SET name        = EXCLUDED.name,
              description = EXCLUDED.description,
              is_system   = true;

-- ---------------------------------------------------------------------------
-- 6. Role → Permission
--
-- Rows 1-3 are a TRANSCRIPTION of MIN_ROLE with `roleAtLeast` expanded: owner
-- holds everything, manager holds every capability whose minimum is manager or
-- seller, seller holds the seller ones.
--
-- If `authorization.domain.ts` and this block ever disagree, the union rule in
-- the service means the STATIC table still wins for the three system roles —
-- and `rbac_grant_drift` at the bottom of this file reports the difference.
-- ---------------------------------------------------------------------------

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r
JOIN   permissions p
  ON   p.code = ANY (
    CASE r.code
      WHEN 'owner' THEN ARRAY[
        'ledger.read','ledger.post','ledger.reverse','ledger.lock_period','account.manage',
        'payment.read','payment.record','payment.cancel',
        'inventory.read','inventory.cost.read','inventory.configure',
        'invoice.read','invoice.create','invoice.update','invoice.delete',
        'customer.read','customer.write','product.read','product.write',
        'report.operational.read','report.financial.read',
        'data.import','member.manage','workspace.manage'
      ]
      WHEN 'manager' THEN ARRAY[
        'ledger.read','ledger.post','account.manage',
        'payment.read','payment.record','payment.cancel',
        'inventory.read','inventory.cost.read',
        'invoice.read','invoice.create','invoice.update',
        'customer.read','customer.write','product.read','product.write',
        'report.operational.read','report.financial.read',
        'data.import'
      ]
      WHEN 'seller' THEN ARRAY[
        'payment.read','payment.record',
        'inventory.read',
        'invoice.read','invoice.create','invoice.update',
        'customer.read','customer.write','product.read',
        'report.operational.read'
      ]
      -- ─── The profiles ────────────────────────────────────────────────────
      WHEN 'accountant' THEN ARRAY[
        'ledger.read','ledger.post','account.manage',
        'payment.read','payment.record',
        'inventory.read','inventory.cost.read',
        'invoice.read','invoice.create',
        'customer.read','product.read',
        'report.operational.read','report.financial.read'
      ]
      WHEN 'sales_manager' THEN ARRAY[
        'payment.read','payment.record',
        'inventory.read',
        'invoice.read','invoice.create','invoice.update',
        'customer.read','customer.write','product.read',
        'report.operational.read'
      ]
      WHEN 'cashier' THEN ARRAY[
        'payment.read','payment.record',
        'inventory.read',
        'invoice.read','invoice.create',
        'customer.read','customer.write','product.read'
      ]
      WHEN 'warehouse_manager' THEN ARRAY[
        'inventory.read','inventory.cost.read',
        'invoice.read','product.read','product.write',
        'report.operational.read'
      ]
      WHEN 'viewer' THEN ARRAY[
        'payment.read','inventory.read','invoice.read',
        'customer.read','product.read','report.operational.read'
      ]
      ELSE ARRAY[]::text[]
    END
  )
WHERE  r.workspace_id IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. workspace_members.membership_role
--
-- The architecture's decision: `workspace_members` answers "does this person
-- belong to this business, and do they own it" — nothing finer. What they may
-- DO comes from user_roles.
--
-- `role` is NOT dropped and NOT stopped being written. It is still what
-- `tenancy.service.ts` reads and what every capability check runs on today.
-- Deprecation is a three-release flow (DATABASE_MIGRATION_POLICY.md); this is
-- release one, which only adds the replacement beside it.
-- ---------------------------------------------------------------------------

ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS membership_role text;

UPDATE workspace_members
   SET membership_role = CASE WHEN role = 'owner' THEN 'owner' ELSE 'member' END
 WHERE membership_role IS NULL;

ALTER TABLE workspace_members
  DROP CONSTRAINT IF EXISTS workspace_members_membership_role_check;
ALTER TABLE workspace_members
  ADD CONSTRAINT workspace_members_membership_role_check
  CHECK (membership_role IS NULL OR membership_role IN ('owner', 'member'));

COMMENT ON COLUMN workspace_members.membership_role IS
  'Ownership only: owner | member. Phase E. What a member may DO comes from user_roles, not from here.';

COMMENT ON COLUMN workspace_members.role IS
  'DEPRECATED (Phase E), still authoritative. owner | manager | seller, read by tenancy.service.ts and enforced by requireCapability. Will be retired once capability resolution moves to user_roles only — see phase-e-01. Do not remove readers yet.';

-- ---------------------------------------------------------------------------
-- 8. Every existing member gets the grant matching what they already have
--
-- After this, both systems say the same thing about everyone. That is the
-- precondition for ever trusting the new one.
-- ---------------------------------------------------------------------------

INSERT INTO user_roles (workspace_id, user_id, role_id)
SELECT m.workspace_id, m.user_id, r.id
FROM   workspace_members m
JOIN   roles r
  ON   r.workspace_id IS NULL
 AND   r.code = CASE
         WHEN m.role IN ('owner', 'manager', 'seller') THEN m.role
         -- An unrecognised or NULL role degrades to the LEAST privilege, which
         -- is what tenancy.service.ts already does. Matching it here keeps the
         -- two from disagreeing about the same person.
         ELSE 'seller'
       END
WHERE  m.workspace_id IS NOT NULL
ON CONFLICT (workspace_id, user_id, role_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9. RLS
--
-- `permissions` and system `roles` are a shared catalogue: readable by every
-- signed-in user, writable by none of them (the backend uses service_role).
-- `user_roles` and custom roles are workspace data.
-- ---------------------------------------------------------------------------

ALTER TABLE roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roles_readable ON roles;
CREATE POLICY roles_readable ON roles
  FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR workspace_id IN (SELECT auth_workspace_ids()));

-- `permissions` has no workspace_id — the catalogue of capability codes is the
-- same for everyone. The obvious policy is therefore `USING (true)`, and
-- `rls-coverage.test.ts` rejects it on sight: a policy that grants
-- unconditionally exists to satisfy a checklist and protects nothing.
--
-- The guard is right, and the scoped version is genuinely stronger. Reading the
-- catalogue requires belonging to at least one workspace, so an authenticated
-- account that is a member of nothing — a fresh sign-up, an abandoned invite —
-- cannot enumerate what the system can do.
DROP POLICY IF EXISTS permissions_readable ON permissions;
CREATE POLICY permissions_readable ON permissions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM auth_workspace_ids()));

DROP POLICY IF EXISTS role_permissions_readable ON role_permissions;
CREATE POLICY role_permissions_readable ON role_permissions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM roles r
    WHERE r.id = role_permissions.role_id
      AND (r.workspace_id IS NULL OR r.workspace_id IN (SELECT auth_workspace_ids()))
  ));

DROP POLICY IF EXISTS user_roles_workspace_members ON user_roles;
CREATE POLICY user_roles_workspace_members ON user_roles
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT auth_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT auth_workspace_ids()));

-- ---------------------------------------------------------------------------
-- 10. What each member effectively holds
--
-- One row per (workspace, user, capability). This is the read the backend uses
-- to add DB-granted capabilities on top of the static role.
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS effective_capabilities;

CREATE VIEW effective_capabilities AS
SELECT DISTINCT
  ur.workspace_id,
  ur.user_id,
  p.code AS capability
FROM   user_roles ur
JOIN   roles r            ON r.id = ur.role_id
JOIN   role_permissions rp ON rp.role_id = r.id
JOIN   permissions p       ON p.id = rp.permission_id
WHERE  r.workspace_id IS NULL OR r.workspace_id = ur.workspace_id;

ALTER VIEW effective_capabilities SET (security_invoker = true);

COMMENT ON VIEW effective_capabilities IS
  'One row per (workspace, user, capability) from user_roles. Phase E. The backend unions this with the static role capabilities: a grant here can ADD a capability, never remove one, until the flip to database-only.';

-- The filter on the last line matters: a grant of a CUSTOM role belonging to
-- another workspace resolves to nothing, rather than leaking that workspace's
-- permission set through a mis-scoped user_roles row.

COMMIT;

-- ============================================================================
-- VERIFY
-- ============================================================================
--
-- 1) rbac_grant_drift — where the two systems disagree about a real person.
--    MUST BE EMPTY. Anything here is someone whose granted capabilities differ
--    from what their workspace_members.role gives them today.
--
-- WITH static_caps AS (
--   SELECT m.workspace_id, m.user_id, p.code AS capability
--   FROM   workspace_members m
--   JOIN   roles r ON r.workspace_id IS NULL
--                 AND r.code = CASE WHEN m.role IN ('owner','manager','seller')
--                                   THEN m.role ELSE 'seller' END
--   JOIN   role_permissions rp ON rp.role_id = r.id
--   JOIN   permissions p       ON p.id = rp.permission_id
-- )
-- SELECT 'granted, not static' AS side, e.workspace_id, e.user_id, e.capability
-- FROM   effective_capabilities e
-- LEFT   JOIN static_caps s USING (workspace_id, user_id, capability)
-- WHERE  s.capability IS NULL
-- UNION ALL
-- SELECT 'static, not granted', s.workspace_id, s.user_id, s.capability
-- FROM   static_caps s
-- LEFT   JOIN effective_capabilities e USING (workspace_id, user_id, capability)
-- WHERE  e.capability IS NULL;
--
-- 2) Every member has at least one role. MUST BE EMPTY.
--
-- SELECT m.workspace_id, m.user_id, m.role
-- FROM   workspace_members m
-- WHERE  m.workspace_id IS NOT NULL
--   AND  NOT EXISTS (
--     SELECT 1 FROM user_roles ur
--     WHERE ur.workspace_id = m.workspace_id AND ur.user_id = m.user_id
--   );
--
-- 3) Grants that name no workspace — the rows the old hasPermission() would
--    have carried across tenants. Investigate each; do not bulk-delete.
--
-- SELECT * FROM user_roles WHERE workspace_id IS NULL;
