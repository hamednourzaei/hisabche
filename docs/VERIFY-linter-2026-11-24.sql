-- ============================================================================
-- docs/VERIFY-linter-2026-11-24.sql — read-only. Run AFTER the migration.
--
-- One row. `ok` must be true. Every other column is the evidence:
--
--   initplan_policies            policies in `public` that still call
--                                auth.uid() / auth.jwt() / auth.role() /
--                                auth.email() / current_setting() directly.
--                                Must be 0.
--   multiple_permissive_tables   tables carrying two PERMISSIVE policies for
--                                the same effective command and an overlapping
--                                role set (`ALL` counted as all four commands,
--                                `public` as every role — the same way the
--                                linter groups them). Must be 0.
--   duplicate_index_groups       groups of valid indexes in `public` with an
--                                identical definition (table, columns, opclass,
--                                ordering, uniqueness, predicate, expressions).
--                                Must be 0.
--   canonical_indexes_present    how many of the 13 kept indexes exist. Must be
--                                13 — 0 duplicates is also true when both were
--                                dropped, and that would be worse.
--   retired_policies_remaining   the six superseded policy names that must be
--                                gone. Must be 0.
--   merged_policies_present      the four replacement policies. Must be 4.
-- ============================================================================
WITH policy_expr AS (
  SELECT schemaname, tablename, policyname, qual AS expr
    FROM pg_policies
   WHERE schemaname = 'public' AND qual IS NOT NULL
  UNION ALL
  SELECT schemaname, tablename, policyname, with_check
    FROM pg_policies
   WHERE schemaname = 'public' AND with_check IS NOT NULL
),
initplan AS (
  SELECT count(DISTINCT (tablename, policyname))::int AS policies
    FROM policy_expr
   WHERE regexp_replace(
           regexp_replace(
             expr,
             '\(\s*SELECT\s+auth\.(uid|jwt|role|email)\(\)(\s+AS\s+\w+)?\s*\)',
             'initplan', 'gi'),
           '\(\s*SELECT\s+(current_setting\([^)]*\))(\s+AS\s+\w+)?\s*\)',
           'initplan', 'gi')
         ~* '(auth\.(uid|jwt|role|email)\(\)|current_setting\()'
),
permissive AS (
  SELECT tablename, policyname, roles,
         unnest(
           CASE cmd
             WHEN 'ALL' THEN ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']::text[]
             ELSE ARRAY[cmd]::text[]
           END
         ) AS effective_cmd
    FROM pg_policies
   WHERE schemaname = 'public'
     AND permissive = 'PERMISSIVE'
),
multiple_permissive AS (
  SELECT count(DISTINCT a.tablename)::int AS tables
    FROM permissive a
    JOIN permissive b
      ON a.tablename = b.tablename
     AND a.effective_cmd = b.effective_cmd
     AND a.policyname < b.policyname
   WHERE (a.roles && b.roles
          OR 'public'::name = ANY (a.roles)
          OR 'public'::name = ANY (b.roles))
),
duplicate_index AS (
  SELECT count(*)::int AS groups
    FROM (
      SELECT i.indrelid,
             i.indkey::text,
             i.indclass::text,
             i.indoption::text,
             i.indisunique,
             i.indpred::text,
             i.indexprs::text
        FROM pg_index i
        JOIN pg_class c     ON c.oid = i.indexrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND i.indisvalid
       GROUP BY 1, 2, 3, 4, 5, 6, 7
      HAVING count(*) > 1
    ) g
),
kept AS (
  SELECT count(*)::int AS present
    FROM (VALUES
      ('checkout_sessions_workspace_id_idx'),
      ('customers_workspace_id_idx'),
      ('invoice_items_invoice_id_idx'),
      ('invoices_workspace_id_idx'),
      ('invoices_workspace_id_customer_id_idx'),
      ('journal_lines_workspace_id_account_id_idx'),
      ('products_workspace_id_idx'),
      ('stock_movements_workspace_product_idx'),
      ('subscriptions_workspace_id_idx'),
      ('sync_change_log_workspace_version_idx'),
      ('transactions_workspace_id_idx'),
      ('transactions_workspace_id_customer_id_idx'),
      ('workspace_members_workspace_id_idx')
    ) AS k(name)
   WHERE to_regclass('public.' || k.name) IS NOT NULL
),
retired AS (
  SELECT count(*)::int AS remaining
    FROM pg_policies
   WHERE schemaname = 'public'
     AND policyname IN (
       'invoice_items_via_parent',
       'member_branches_own_rows',
       'member_branches_workspace_members',
       'ui_visibility_profiles_own',
       'ui_visibility_profiles_own_rows',
       'workspace_members_colleagues'
     )
),
merged AS (
  SELECT count(*)::int AS present
    FROM (VALUES
      ('invoice_items_workspace_members'),
      ('member_branches_select'),
      ('ui_visibility_profiles_select'),
      ('workspace_members_own_row')
    ) AS m(name)
   WHERE EXISTS (
     SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.policyname = m.name
   )
)
SELECT initplan.policies                AS initplan_policies,
       multiple_permissive.tables       AS multiple_permissive_tables,
       duplicate_index.groups           AS duplicate_index_groups,
       kept.present                     AS canonical_indexes_present,
       retired.remaining                AS retired_policies_remaining,
       merged.present                   AS merged_policies_present,
       (initplan.policies = 0
        AND multiple_permissive.tables = 0
        AND duplicate_index.groups = 0
        AND kept.present = 13
        AND retired.remaining = 0
        AND merged.present = 4)         AS ok
  FROM initplan, multiple_permissive, duplicate_index, kept, retired, merged;
