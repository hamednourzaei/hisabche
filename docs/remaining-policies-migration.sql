-- ============================================================================
-- docs/remaining-policies-migration.sql
--
-- Policies for the tables that had RLS on and nothing else.
--
-- ---------------------------------------------------------------------------
-- FIRST: NOTHING WAS BROKEN
--
-- RLS on with no policy means DENY ALL. It is the strictest possible state,
-- not an open door — and the backend connects with `service_role`, which
-- bypasses RLS entirely, so every screen kept working.
--
-- The check that surfaced this was doing its job. The 26 tables it named were
-- locked, not leaking.
--
-- ---------------------------------------------------------------------------
-- SO WHY CHANGE ANYTHING
--
-- Because "locked and nobody noticed" is one realtime subscription away from
-- "silently empty". The moment somebody adds
--
--     useRealtime({ table: 'activities', … })
--
-- the subscription connects, delivers nothing, and reports no error. Realtime
-- respects RLS; `service_role` does not reach it. That is a bug that takes a
-- day to find and thirty seconds to prevent.
--
-- ⚠️ Verified before writing this: none of the 13 tables the client currently
-- subscribes to is in that list. Nothing is broken today.
--
-- ---------------------------------------------------------------------------
-- FOUR KINDS OF TABLE, FOUR ANSWERS
--
--   1. carries workspace_id      → the standard workspace policy
--   2. child of one that does    → reached through its parent
--   3. global configuration      → any authenticated user may read
--   4. service-role only         → LEFT WITH NO POLICY, deliberately
--
-- The fourth group is the important one. Adding a policy to
-- `password_reset_tokens` "for completeness" would turn a table nobody can
-- read into a table somebody can.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── 1. Tables that carry a workspace ───────────────────────────────────────
--
-- The same policy shape as every other tenant table.

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'activities',
    'user_roles',
    'subscriptions',
    'workflows',
    'workflow_instances'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_table AND column_name = 'workspace_id'
    ) THEN
      RAISE NOTICE 'skipped % — no workspace_id', v_table;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_workspace_members', v_table);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO authenticated
        USING (workspace_id IN (SELECT auth_workspace_ids()))
        WITH CHECK (workspace_id IN (SELECT auth_workspace_ids()))
    $p$, v_table || '_workspace_members', v_table);

    RAISE NOTICE 'workspace policy: %', v_table;
  END LOOP;
END $$;

-- ─── 2. Children, reached through their parent ──────────────────────────────
--
-- These have no `workspace_id` of their own — a workflow step belongs to a
-- workflow, and the workflow belongs to a workspace.
--
-- ⚠️ The parent's own policy is what makes this safe. An `EXISTS` against a
-- table the caller cannot read returns false, so the child is unreachable for
-- exactly the same rows the parent is.

DO $$
DECLARE
  v_child  TEXT;
  v_parent TEXT;
  v_fk     TEXT;
BEGIN
  FOR v_child, v_parent, v_fk IN
    SELECT * FROM (VALUES
      ('workflow_steps',       'workflows',           'workflow_id'),
      ('workflow_actions',     'workflow_instances',  'instance_id'),
      ('purchase_order_items', 'purchase_orders',     'purchase_order_id'),
      ('project_members',      'projects',            'project_id'),
      ('invoice_items',        'invoices',            'invoice_id')
    ) AS t(child, parent, fk)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_child AND column_name = v_fk
    ) THEN
      RAISE NOTICE 'skipped % — no %', v_child, v_fk;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_child);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_child || '_via_parent', v_child);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO authenticated
        USING (EXISTS (
          SELECT 1 FROM %I parent
          WHERE parent.id = %I.%I
            AND parent.workspace_id IN (SELECT auth_workspace_ids())
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM %I parent
          WHERE parent.id = %I.%I
            AND parent.workspace_id IN (SELECT auth_workspace_ids())
        ))
    $p$, v_child || '_via_parent', v_child,
         v_parent, v_child, v_fk,
         v_parent, v_child, v_fk);

    RAISE NOTICE 'parent policy: % via %', v_child, v_parent;
  END LOOP;
END $$;

-- ─── 3. Global configuration — readable, never writable ─────────────────────
--
-- Role names, permission names, billing plans. The same for every workspace,
-- and meaningless to hide: a user who can see the button already knows the
-- capability exists.
--
-- ⚠️ SELECT only. No INSERT, UPDATE or DELETE policy, so a client that could
-- read `roles` still cannot invent one — which is the difference between a
-- lookup table and a privilege escalation.

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'roles',
    'permissions',
    'role_permissions',
    'billing_plans',
    'event_types'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_table
    ) THEN CONTINUE; END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_readable', v_table);
    EXECUTE format($p$
      CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)
    $p$, v_table || '_readable', v_table);

    RAISE NOTICE 'read-only policy: %', v_table;
  END LOOP;
END $$;

-- ─── 4. Your own row ────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id'
  ) THEN
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS profiles_own_row ON profiles;
    -- `profiles.id` IS the auth user id in this schema — not a separate key.
    CREATE POLICY profiles_own_row ON profiles
      FOR SELECT TO authenticated
      USING (id = (SELECT auth.uid()));

    DROP POLICY IF EXISTS profiles_update_own ON profiles;
    CREATE POLICY profiles_update_own ON profiles
      FOR UPDATE TO authenticated
      USING (id = (SELECT auth.uid()))
      WITH CHECK (id = (SELECT auth.uid()));

    RAISE NOTICE 'own-row policy: profiles';
  END IF;
END $$;

-- ─── 5. The ones that stay locked ───────────────────────────────────────────
--
-- ⚠️ NO POLICY IS ADDED HERE, AND THAT IS THE POINT.
--
--   background_jobs          queue internals
--   checkout_sessions        payment flow, service-role only
--   invoice_pdf_cache        rendered files, served through the API
--   journal_lines_archive    the two amount-less lines removed before the
--                            one-sided constraint could be validated
--   ledger_entries           legacy; nothing reads it
--   password_reset_tokens    a readable reset token is an account takeover
--   schema_migrations        migration bookkeeping
--   sync_logs · sync_queue   sync internals, like sync_change_log
--   webhook_events           inbound payloads, may contain provider secrets
--   event_log                fan-out helper, written by the server only
--
-- RLS on with no policy means deny-all. Every one of these is reached by the
-- backend on `service_role`, which bypasses RLS. Adding a policy "for
-- completeness" would turn a table nobody can read into one somebody can —
-- and on `password_reset_tokens` that is the whole security model.

-- Belt and braces: make sure RLS is actually ON for them, so "no policy"
-- means deny-all rather than wide open.
DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'background_jobs', 'checkout_sessions', 'invoice_pdf_cache',
    'journal_lines_archive', 'ledger_entries', 'password_reset_tokens',
    'schema_migrations', 'sync_logs', 'sync_queue', 'webhook_events', 'event_log'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_table
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_table);
    END IF;
  END LOOP;
END $$;

COMMIT;
