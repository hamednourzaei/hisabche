-- ============================================================================
-- T2 — RLS on `units`, the global reference table.
--
-- `phase-l-01` created `units` without enabling row level security. Nothing
-- tenant-specific is in it — a gram is a gram in every workspace — so this is
-- not a data-leak fix. Two things make it worth doing anyway:
--
--   1. Supabase's linter reports «RLS disabled in public» as an ERROR, and a
--      standing error trains people to ignore the report.
--   2. Without RLS the table is not merely readable through PostgREST, it is
--      WRITABLE by anyone holding an anon or authenticated key who has the
--      table grants. A reference table that callers can rewrite is a way to
--      change every conversion factor in the product.
--
-- So: read for everyone signed in, write for nobody but the service role
-- (which bypasses RLS and is what the backend and migrations use).
--
-- ---------------------------------------------------------------------------
-- ADDITIVE AND IDEMPOTENT. Re-runnable. Creates no table, drops no column,
-- changes no row.
--
-- ROLLBACK / MITIGATION
--   If enabling RLS makes units disappear in some client, that client is
--   reading with a key that has no SELECT grant. Restore with:
--
--     ALTER TABLE units DISABLE ROW LEVEL SECURITY;
--
--   Nothing is lost by doing so — the state before this migration.
--
--   The API path is unaffected either way: `GET /api/units` reads through the
--   backend's service client, and it degrades to the seeded list rather than
--   erroring if the table becomes unreadable.
-- ============================================================================

BEGIN;

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

-- Read: any signed-in user. There is no workspace column to scope by, and
-- inventing one would be the "undefined policy setting" guardrail (G4) — the
-- product has never said units are per-workspace.
DROP POLICY IF EXISTS units_read_authenticated ON units;
CREATE POLICY units_read_authenticated
  ON units FOR SELECT
  TO authenticated
  USING (true);

-- Write: NO policy at all, deliberately.
--
-- With RLS on and no INSERT/UPDATE/DELETE policy, every write from a user key
-- is refused. The service role bypasses RLS, so the backend and future
-- migrations are unaffected. Adding a unit is a deploy, not a user action.

COMMENT ON TABLE units IS
  'Units of measure (Phase L, L0.2; RLS added in T2). Global reference data — no workspace_id, readable by any authenticated user, writable only by the service role. conversion_factor is within a DIMENSION to that dimension''s base; a per-product factor («1 carton = 24 pieces») belongs in product_units. Read by GET /api/units.';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
--
-- Run in the Supabase SQL Editor and report the output.
-- ============================================================================

-- 1. RLS is on.  EXPECT: rowsecurity = true
SELECT relname, relrowsecurity AS rowsecurity
FROM   pg_class
WHERE  relname = 'units';

-- 2. Exactly one policy, and it is SELECT-only.  EXPECT: 1 row, cmd = 'SELECT'
SELECT policyname, cmd, roles::text
FROM   pg_policies
WHERE  tablename = 'units';

-- 3. No write policy exists.  EXPECT: 0
SELECT COUNT(*) AS write_policies
FROM   pg_policies
WHERE  tablename = 'units'
  AND  cmd <> 'SELECT';

-- 4. The rows are still all there.  EXPECT: 14, and 'ton' present
SELECT COUNT(*) AS unit_count,
       BOOL_OR(code = 'ton') AS tonne_present
FROM   units
WHERE  is_active;
