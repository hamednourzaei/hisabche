-- ============================================================================
-- scripts/remediate-orphaned-workspace.sql
--
-- Gives ONE named user the workspace their onboarding failed to create, so the
-- four rows they own stop being unmappable.
--
--   user  fde9fff9-4679-4c31-9f0b-4618991faf89  (majidnorzaie@gmail.com)
--   owns  0 workspaces, 0 memberships
--   rows  2 invoices, 2 customers
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS NOT A GUESS
--
-- The rule is: never guess which workspace an existing row belongs to. This
-- script does not. It creates a NEW workspace whose only member is the row's
-- own creator, and attaches nothing to anyone else's book. The user belongs to
-- zero other workspaces, so there is no candidate to choose between and no
-- possibility of leaking their invoices into another business or another
-- business's invoices into theirs.
--
-- This is exactly what WorkspaceService.createWorkspace() does at signup
-- (backend/src/services/workspace.service.ts:95) — same columns, same
-- `role: 'owner'`. It is a repair of a missed onboarding step, not a merge.
--
-- ---------------------------------------------------------------------------
-- WHAT IT DOES AND DOES NOT DO
--
-- INSERTS   one `workspaces` row, one `workspace_members` row.
-- DELETES   nothing. UPDATES no business row. MERGES nothing.
-- SKIPS     itself entirely if the user already has any membership, so a
--           second run cannot create a second workspace.
--
-- It does NOT backfill. Re-run PART 3 of docs/tenancy-workspace-migration.sql
-- afterwards; with the membership in place those four rows become
-- deterministically mappable and the existing backfill fills them.
--
-- Runs in psql or the Supabase SQL editor. No backslash meta-commands.
-- ============================================================================

DO $$
DECLARE
  v_user  CONSTANT UUID := 'fde9fff9-4679-4c31-9f0b-4618991faf89';
  v_email TEXT;
  v_name  TEXT;
  v_slug  TEXT;
  v_ws    UUID;
BEGIN
  -- Guard 1: the user must exist. A typo'd UUID would otherwise create a
  -- workspace owned by nobody, and owner_id has no FK we can rely on here.
  SELECT email INTO v_email FROM auth.users WHERE id = v_user;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'user % does not exist — refusing to create a workspace for it', v_user;
  END IF;

  -- Guard 2: idempotency. If they already belong somewhere, the premise of
  -- this script is false and doing anything would be the guess it avoids.
  IF EXISTS (SELECT 1 FROM workspace_members WHERE user_id = v_user) THEN
    RAISE NOTICE 'user % already has a membership — nothing to do', v_user;
    RETURN;
  END IF;

  -- Name from the email local part, which is what the user recognises. The
  -- slug is derived from the user id, not the name: it is required and
  -- probably unique-constrained, and two shopkeepers called "majid" must not
  -- collide.
  v_name := split_part(v_email, '@', 1);
  v_slug := 'ws-' || replace(v_user::text, '-', '');

  IF EXISTS (SELECT 1 FROM workspaces WHERE slug = v_slug) THEN
    RAISE EXCEPTION 'slug % already taken — investigate before inserting', v_slug;
  END IF;

  INSERT INTO workspaces (name, slug, owner_id)
  VALUES (v_name, v_slug, v_user)
  RETURNING id INTO v_ws;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_ws, v_user, 'owner');

  RAISE NOTICE 'created workspace % (%) owned by %', v_ws, v_slug, v_email;
END $$;

-- ── Confirm ─────────────────────────────────────────────────────────────────
--
-- Expect owns = 1, memberships = 1, role = owner.

SELECT
  u.id,
  u.email,
  (SELECT count(*) FROM workspaces w        WHERE w.owner_id = u.id) AS owns,
  (SELECT count(*) FROM workspace_members m WHERE m.user_id  = u.id) AS memberships,
  (SELECT m.role   FROM workspace_members m WHERE m.user_id  = u.id LIMIT 1) AS role
FROM auth.users u
WHERE u.id = 'fde9fff9-4679-4c31-9f0b-4618991faf89';

-- ── Next ────────────────────────────────────────────────────────────────────
--
--   1. re-run PART 3 of docs/tenancy-workspace-migration.sql   (idempotent)
--   2. re-run scripts/check-tenancy-backfill.sql
--
-- After that only the 24 `user_id IS NULL` rows should remain unmapped. Those
-- are already unreachable under today's `.eq('user_id', userId)` filtering, so
-- they do not block the Phase 4 backend rewrite.
--
-- ── ROLLBACK ────────────────────────────────────────────────────────────────
--
-- Safe only BEFORE the backfill runs. Once invoices point at this workspace,
-- the ON DELETE RESTRICT foreign key will refuse the delete — deliberately.
--
-- DELETE FROM workspace_members WHERE user_id = 'fde9fff9-4679-4c31-9f0b-4618991faf89';
-- DELETE FROM workspaces        WHERE owner_id = 'fde9fff9-4679-4c31-9f0b-4618991faf89'
--                                 AND slug = 'ws-fde9fff946794c319f0b4618991faf89';
