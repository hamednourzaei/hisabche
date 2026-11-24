-- ============================================================================
-- docs/linter-2026-11-24-migration.sql — Supabase linter, reported 24 Nov 2026
--
-- Three advisory classes, all of them about HOW a rule is evaluated rather
-- than WHAT it allows:
--
--   auth_rls_initplan             Every policy in `public` that calls
--                                 auth.uid() (or current_setting()) directly
--                                 re-reads the value for every row it tests.
--   multiple_permissive_policies  4 tables carry two PERMISSIVE policies for
--                                 the same command and role.
--   duplicate_index               13 pairs of indexes with byte-identical
--                                 definitions.
--
-- ---------------------------------------------------------------------------
-- 1. auth_rls_initplan
--    `auth.uid()` is STABLE: it reads a per-request setting. Written bare in a
--    policy it is re-evaluated for every row. Written as (SELECT auth.uid())
--    the planner turns it into an InitPlan — one evaluation, one value, reused
--    for the whole statement. The rows returned are identical.
--
--    This section is catalogue-driven on purpose: pg_policies exposes every
--    policy expression in schema `public`, and the rewrite covers all of them,
--    including policies added later. A policy already in the wrapped form is
--    left alone, so a second run is a no-op.
--
-- ---------------------------------------------------------------------------
-- 2. multiple_permissive_policies
--    Postgres OR's two permissive policies for the same command and role, so
--    access is correct — but both are evaluated, and the pair is reported.
--    Each group below becomes ONE policy stating the same rule. Command is
--    preserved; a policy that can write carries no TO clause (default PUBLIC),
--    the same form `workspace-members-rls-migration.sql` uses. Its expression
--    requires auth.uid(), so anon cannot satisfy it, and
--    migration-client-lockdown.test.ts reserves `TO authenticated` on a write
--    policy for the closed legacy list. Access is unchanged.
--
--      invoice_items         via_parent FOR ALL  + workspace_members FOR ALL
--                            → workspace_members FOR ALL (same parent rule)
--      member_branches       own_rows SELECT     + workspace_members FOR ALL
--                            → SELECT (workspace OR own) + INSERT/UPDATE/DELETE
--                              (workspace only) — exactly the union the pair
--                              produced, split one policy per command
--      ui_visibility_profiles own ALL            + own_rows SELECT
--                            → one policy per command, scoped to the user AND
--                              an active membership (branch/personalization
--                              canonical form)
--      workspace_members     own_row SELECT      + colleagues SELECT
--                            → SELECT (own row OR colleague), TO authenticated
--
--    These definitions are the ones `branch-migration.sql`,
--    `personalization-migration.sql`, `child-table-rls-fix.sql` and
--    `rls-performance-migration.sql` now create on a fresh database. This file
--    makes an already-live database reach the same state.
--
-- ---------------------------------------------------------------------------
-- 3. duplicate_index
--    One of each pair is dropped. The drop happens ONLY when both indexes
--    exist, both are valid, their definitions are identical (columns, opclass,
--    ordering, uniqueness, predicate and expressions), and the one being
--    dropped is not owned by a constraint. A definition that drifted is not a
--    duplicate and is left alone.
--
-- IDEMPOTENT. SAFE TO RE-RUN.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- (docs/VERIFY-linter-2026-11-24.sql)
-- ============================================================================

BEGIN;

-- ─── 1. multiple_permissive_policies ────────────────────────────────────────

-- 1a. invoice_items — both policies reached the parent invoice's workspace.
--     Keep `invoice_items_workspace_members` (the name child-table-rls-fix.sql
--     owns going forward); retire `invoice_items_via_parent`.
DO $$
BEGIN
  IF to_regclass('public.invoice_items') IS NULL THEN
    RETURN;
  END IF;

  DROP POLICY IF EXISTS invoice_items_via_parent        ON invoice_items;
  DROP POLICY IF EXISTS invoice_items_workspace_members ON invoice_items;

  CREATE POLICY invoice_items_workspace_members ON invoice_items
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM invoices i
        WHERE i.id = invoice_items.invoice_id
          AND i.workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = (SELECT auth.uid())
              AND has_access = true
              AND suspended_at IS NULL
          )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM invoices i
        WHERE i.id = invoice_items.invoice_id
          AND i.workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = (SELECT auth.uid())
              AND has_access = true
              AND suspended_at IS NULL
          )
      )
    );
END $$;

-- 1b. member_branches — reads were "workspace rows OR my own rows"; writes
--     were workspace rows only. One policy per command states exactly that.
DO $$
BEGIN
  IF to_regclass('public.member_branches') IS NULL THEN
    RETURN;
  END IF;

  DROP POLICY IF EXISTS member_branches_workspace_members ON member_branches;
  DROP POLICY IF EXISTS member_branches_own_rows          ON member_branches;
  DROP POLICY IF EXISTS member_branches_select            ON member_branches;
  DROP POLICY IF EXISTS member_branches_insert            ON member_branches;
  DROP POLICY IF EXISTS member_branches_update            ON member_branches;
  DROP POLICY IF EXISTS member_branches_delete            ON member_branches;

  CREATE POLICY member_branches_select ON member_branches
    FOR SELECT TO authenticated
    USING (
      workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT auth.uid())
          AND has_access = true
          AND suspended_at IS NULL
      )
      OR user_id = (SELECT auth.uid())
    );

  CREATE POLICY member_branches_insert ON member_branches
    FOR INSERT
    WITH CHECK (
      workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT auth.uid())
          AND has_access = true
          AND suspended_at IS NULL
      )
    );

  CREATE POLICY member_branches_update ON member_branches
    FOR UPDATE
    USING (
      workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT auth.uid())
          AND has_access = true
          AND suspended_at IS NULL
      )
    )
    WITH CHECK (
      workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT auth.uid())
          AND has_access = true
          AND suspended_at IS NULL
      )
    );

  CREATE POLICY member_branches_delete ON member_branches
    FOR DELETE
    USING (
      workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT auth.uid())
          AND has_access = true
          AND suspended_at IS NULL
      )
    );
END $$;

-- 1c. ui_visibility_profiles — a preference belongs to one person, and the
--     person must still be an active member of the workspace (the rule every
--     other tenant table uses). One policy per command.
DO $$
BEGIN
  IF to_regclass('public.ui_visibility_profiles') IS NULL THEN
    RETURN;
  END IF;

  DROP POLICY IF EXISTS ui_visibility_profiles_own       ON ui_visibility_profiles;
  DROP POLICY IF EXISTS ui_visibility_profiles_own_rows  ON ui_visibility_profiles;
  DROP POLICY IF EXISTS ui_visibility_profiles_select    ON ui_visibility_profiles;
  DROP POLICY IF EXISTS ui_visibility_profiles_insert    ON ui_visibility_profiles;
  DROP POLICY IF EXISTS ui_visibility_profiles_update    ON ui_visibility_profiles;
  DROP POLICY IF EXISTS ui_visibility_profiles_delete    ON ui_visibility_profiles;

  CREATE POLICY ui_visibility_profiles_select ON ui_visibility_profiles
    FOR SELECT TO authenticated
    USING (
      user_id = (SELECT auth.uid())
      AND workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT auth.uid())
          AND has_access = true
          AND suspended_at IS NULL
      )
    );

  CREATE POLICY ui_visibility_profiles_insert ON ui_visibility_profiles
    FOR INSERT
    WITH CHECK (
      user_id = (SELECT auth.uid())
      AND workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT auth.uid())
          AND has_access = true
          AND suspended_at IS NULL
      )
    );

  CREATE POLICY ui_visibility_profiles_update ON ui_visibility_profiles
    FOR UPDATE
    USING (
      user_id = (SELECT auth.uid())
      AND workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT auth.uid())
          AND has_access = true
          AND suspended_at IS NULL
      )
    )
    WITH CHECK (
      user_id = (SELECT auth.uid())
      AND workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT auth.uid())
          AND has_access = true
          AND suspended_at IS NULL
      )
    );

  CREATE POLICY ui_visibility_profiles_delete ON ui_visibility_profiles
    FOR DELETE
    USING (
      user_id = (SELECT auth.uid())
      AND workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT auth.uid())
          AND has_access = true
          AND suspended_at IS NULL
      )
    );
END $$;

-- 1d. workspace_members — a member always reads their OWN row (the login path
--     needs it before it knows which workspaces exist) and every row of a
--     workspace they belong to. The helper is SECURITY DEFINER, so the
--     colleague branch does not re-enter this policy.
--
--     The helper moved to schema `private` in linter-2026-09-14; older
--     databases still have it in `public`. Pick whichever exists.
DO $$
DECLARE
  v_member_fn text;
BEGIN
  IF to_regclass('public.workspace_members') IS NULL THEN
    RETURN;
  END IF;

  IF to_regprocedure('private.is_workspace_member(uuid, uuid)') IS NOT NULL THEN
    v_member_fn := 'private.is_workspace_member';
  ELSIF to_regprocedure('public.is_workspace_member(uuid, uuid)') IS NOT NULL THEN
    v_member_fn := 'public.is_workspace_member';
  ELSE
    v_member_fn := NULL;
  END IF;

  DROP POLICY IF EXISTS workspace_members_colleagues ON workspace_members;
  DROP POLICY IF EXISTS workspace_members_own_row    ON workspace_members;
  DROP POLICY IF EXISTS workspace_members_select     ON workspace_members;

  IF v_member_fn IS NULL THEN
    -- No colleague oracle in this database. Keep the login guarantee; the
    -- colleague policy could not have worked without the helper either.
    CREATE POLICY workspace_members_own_row ON workspace_members
      FOR SELECT TO authenticated
      USING (user_id = (SELECT auth.uid()));
  ELSE
    EXECUTE format($ddl$
      CREATE POLICY workspace_members_own_row ON workspace_members
        FOR SELECT TO authenticated
        USING (
          user_id = (SELECT auth.uid())
          OR %s(workspace_id, (SELECT auth.uid()))
        )
    $ddl$, v_member_fn);
  END IF;
END $$;

-- ─── 2. auth_rls_initplan — one evaluation per statement, not per row ───────
--
-- Postgres stores a policy expression as a tree and prints it back with
-- pg_get_expr, which renders `(SELECT auth.uid())` as
--     ( SELECT auth.uid() AS uid)
-- Both spellings are normalised to the bare call and then wrapped exactly
-- once, so the file converges instead of nesting a subquery per run.
--
-- The mask below replaces an already-wrapped call with `initplan` and then
-- asks whether a direct call is still visible. That is the condition the
-- linter tests, and it is what keeps a second run silent.
DO $$
DECLARE
  v_policy    record;
  v_using     text;
  v_check     text;
  v_flat      text;
  v_fix_using boolean;
  v_fix_check boolean;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
  LOOP
    v_fix_using := false;
    v_fix_check := false;

    IF v_policy.qual IS NOT NULL THEN
      v_flat := regexp_replace(
        v_policy.qual,
        '\(\s*SELECT\s+auth\.(uid|jwt|role|email)\(\)(\s+AS\s+\w+)?\s*\)',
        'initplan', 'gi');
      v_flat := regexp_replace(
        v_flat,
        '\(\s*SELECT\s+(current_setting\([^)]*\))(\s+AS\s+\w+)?\s*\)',
        'initplan', 'gi');
      v_fix_using := v_flat ~* '(auth\.(uid|jwt|role|email)\(\)|current_setting\()';
    END IF;

    IF v_policy.with_check IS NOT NULL THEN
      v_flat := regexp_replace(
        v_policy.with_check,
        '\(\s*SELECT\s+auth\.(uid|jwt|role|email)\(\)(\s+AS\s+\w+)?\s*\)',
        'initplan', 'gi');
      v_flat := regexp_replace(
        v_flat,
        '\(\s*SELECT\s+(current_setting\([^)]*\))(\s+AS\s+\w+)?\s*\)',
        'initplan', 'gi');
      v_fix_check := v_flat ~* '(auth\.(uid|jwt|role|email)\(\)|current_setting\()';
    END IF;

    CONTINUE WHEN NOT (v_fix_using OR v_fix_check);

    v_using := v_policy.qual;
    v_check := v_policy.with_check;

    IF v_using IS NOT NULL THEN
      v_using := regexp_replace(
        v_using,
        '\(\s*SELECT\s+auth\.(uid|jwt|role|email)\(\)(\s+AS\s+\w+)?\s*\)',
        'auth.\1()', 'gi');
      v_using := regexp_replace(
        v_using,
        '\(\s*SELECT\s+(current_setting\([^)]*\))(\s+AS\s+\w+)?\s*\)',
        '\1', 'gi');
      v_using := regexp_replace(
        v_using,
        '(auth\.(uid|jwt|role|email)\(\)|current_setting\([^)]*\))',
        '(SELECT \1)', 'gi');
    END IF;

    IF v_check IS NOT NULL THEN
      v_check := regexp_replace(
        v_check,
        '\(\s*SELECT\s+auth\.(uid|jwt|role|email)\(\)(\s+AS\s+\w+)?\s*\)',
        'auth.\1()', 'gi');
      v_check := regexp_replace(
        v_check,
        '\(\s*SELECT\s+(current_setting\([^)]*\))(\s+AS\s+\w+)?\s*\)',
        '\1', 'gi');
      v_check := regexp_replace(
        v_check,
        '(auth\.(uid|jwt|role|email)\(\)|current_setting\([^)]*\))',
        '(SELECT \1)', 'gi');
    END IF;

    EXECUTE format(
      'ALTER POLICY %I ON %I.%I%s%s',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename,
      CASE WHEN v_using IS NOT NULL THEN format(' USING (%s)', v_using) ELSE '' END,
      CASE WHEN v_check IS NOT NULL THEN format(' WITH CHECK (%s)', v_check) ELSE '' END
    );
  END LOOP;
END $$;

-- ─── 3. duplicate_index — drop one of each identical pair ───────────────────
--
-- `hardening-migration.sql` carries the same list for a fresh database. This
-- block exists because a database that already ran hardening did so before the
-- list was added, and re-running that file is not how a live database is
-- patched.
--
-- The definition check is deliberate: an index whose columns, opclass,
-- ordering, uniqueness, predicate or expressions differ is NOT a duplicate and
-- must not be dropped. A constraint-owned index is skipped too — its
-- constraint would have to go with it.
DO $$
DECLARE
  v_pair  record;
  v_keep  regclass;
  v_drop  regclass;
  v_same  boolean;
BEGIN
  FOR v_pair IN
    SELECT *
      FROM (VALUES
        ('checkout_sessions_workspace_id_idx',        'checkout_sessions_workspace_idx'),
        ('customers_workspace_id_idx',                'customers_workspace_idx'),
        ('invoice_items_invoice_id_idx',              'invoice_items_invoice_idx'),
        ('invoices_workspace_id_idx',                 'invoices_workspace_idx'),
        ('invoices_workspace_id_customer_id_idx',     'invoices_workspace_customer_idx'),
        ('journal_lines_workspace_id_account_id_idx', 'journal_lines_workspace_account_idx'),
        ('products_workspace_id_idx',                 'products_workspace_idx'),
        ('stock_movements_workspace_product_idx',     'stock_movements_workspace_idx'),
        ('subscriptions_workspace_id_idx',            'subscriptions_workspace_idx'),
        ('sync_change_log_workspace_version_idx',     'sync_change_log_ws_version_idx'),
        ('transactions_workspace_id_idx',             'transactions_workspace_idx'),
        ('transactions_workspace_id_customer_id_idx', 'transactions_workspace_customer_idx'),
        ('workspace_members_workspace_id_idx',        'workspace_members_workspace_idx')
      ) AS t(keep_name, drop_name)
  LOOP
    v_keep := to_regclass('public.' || v_pair.keep_name);
    v_drop := to_regclass('public.' || v_pair.drop_name);

    CONTINUE WHEN v_keep IS NULL OR v_drop IS NULL;

    CONTINUE WHEN EXISTS (
      SELECT 1 FROM pg_constraint WHERE conindid = v_drop
    );

    SELECT
      k.indrelid = d.indrelid
      AND k.indkey::text = d.indkey::text
      AND k.indclass::text = d.indclass::text
      AND k.indoption::text = d.indoption::text
      AND k.indisunique = d.indisunique
      AND k.indisvalid AND d.indisvalid
      AND k.indpred IS NOT DISTINCT FROM d.indpred
      AND k.indexprs IS NOT DISTINCT FROM d.indexprs
      INTO v_same
      FROM pg_index k, pg_index d
     WHERE k.indexrelid = v_keep
       AND d.indexrelid = v_drop;

    IF v_same THEN
      EXECUTE format('DROP INDEX public.%I', v_pair.drop_name);
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- Recreating a dropped index (run each alone, outside a transaction):
--
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS products_workspace_idx
--     ON products (workspace_id);
--   …and the same shape for every other dropped name, from
--   `hardening-migration.sql`'s list.
--
-- Undoing an auth.uid() wrap is not necessary: (SELECT auth.uid()) and
-- auth.uid() return the same value. If one policy hypothetically misbehaves,
-- re-create that single policy from its feature migration; nothing else in
-- this file depends on the rewrite.
-- ============================================================================
