-- ============================================================================
-- scripts/audit-remaining-tenancy.sql
--
-- READ-ONLY. Changes nothing. Safe on production.
--
-- Answers, from the DATABASE rather than from the code or the docs:
--
--     Which tables still use `user_id` as their tenancy boundary, and can each
--     one be migrated to `workspace_id` deterministically?
--
-- The four shared entities (invoices, customers, products, transactions) are
-- already done. This finds everything else — employees, warehouses, projects,
-- purchase orders, BOMs, journal entries — that a workspace member should be
-- able to see but currently cannot, because those tables are still scoped to
-- whoever created the row.
--
-- ---------------------------------------------------------------------------
-- WHY ASK THE DATABASE
--
-- documents/DATABASE_SCHEMA.md has been wrong twice: about `invoice_items`
-- having unit columns, and about the four core tables already having
-- `workspace_id`. Both were designed against and both had to be undone. The
-- table list below is discovered by query, not typed from a grep of the
-- services, so a table nobody remembered is still counted.
--
-- Runs in psql or the Supabase SQL editor. No backslash meta-commands.
-- ============================================================================


-- ############################################################################
-- PART 1 — WHICH TABLES CARRY WHICH TENANCY COLUMN
-- ############################################################################

WITH cols AS (
  SELECT
    c.table_name,
    bool_or(c.column_name = 'user_id')      AS has_user_id,
    bool_or(c.column_name = 'workspace_id') AS has_workspace_id
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
 WHERE c.table_schema = 'public'
   AND t.table_type = 'BASE TABLE'          -- views cannot be migrated directly
 GROUP BY c.table_name
)
SELECT
  table_name,
  has_user_id,
  has_workspace_id,
  CASE
    WHEN has_workspace_id AND has_user_id
      THEN 'DONE — workspace tenancy, user_id records the actor'
    WHEN has_workspace_id AND NOT has_user_id
      THEN 'DONE — workspace tenancy'
    WHEN has_user_id
      THEN 'TODO — still scoped to the creator; invisible to other members'
    ELSE 'N/A — no tenancy column (child table, lookup, or system)'
  END AS status
FROM cols
ORDER BY
  CASE
    WHEN has_user_id AND NOT has_workspace_id THEN 0   -- the work
    WHEN has_workspace_id THEN 1                       -- already done
    ELSE 2                                             -- not applicable
  END,
  table_name;


-- ############################################################################
-- PART 2 — HOW MUCH DATA IS AT STAKE, AND IS IT MAPPABLE
-- ############################################################################
--
-- For every TODO table, count the rows and how many map to exactly one
-- workspace through their creator — the same deterministic rule the four core
-- tables used. Anything that does not map is reported, never guessed.
--
-- Dynamic SQL because the table list comes from PART 1 rather than being
-- hardcoded. Read-only: it only ever runs SELECT count(*).

DO $$
DECLARE
  v_table   TEXT;
  v_total   BIGINT;
  v_map     BIGINT;
  v_orphan  BIGINT;
  v_ambig   BIGINT;
  v_nouser  BIGINT;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS tenancy_audit (
    table_name TEXT,
    total_rows BIGINT,
    mappable   BIGINT,
    no_creator BIGINT,
    orphaned   BIGINT,
    ambiguous  BIGINT,
    verdict    TEXT
  ) ON COMMIT DROP;

  FOR v_table IN
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public'
       AND t.table_type = 'BASE TABLE'
     GROUP BY c.table_name
    HAVING bool_or(c.column_name = 'user_id')
       AND NOT bool_or(c.column_name = 'workspace_id')
     ORDER BY c.table_name
  LOOP
    EXECUTE format($q$
      WITH membership AS (
        SELECT user_id, count(DISTINCT workspace_id) AS n
          FROM workspace_members
         WHERE has_access AND suspended_at IS NULL
         GROUP BY user_id
      )
      SELECT count(*),
             count(*) FILTER (WHERE m.n = 1),
             count(*) FILTER (WHERE t.user_id IS NULL),
             count(*) FILTER (WHERE t.user_id IS NOT NULL AND m.n IS NULL),
             count(*) FILTER (WHERE m.n > 1)
        FROM %I t LEFT JOIN membership m ON m.user_id = t.user_id
    $q$, v_table)
    INTO v_total, v_map, v_nouser, v_orphan, v_ambig;

    INSERT INTO tenancy_audit VALUES (
      v_table, v_total, v_map, v_nouser, v_orphan, v_ambig,
      CASE
        WHEN v_total = 0                      THEN 'EMPTY — trivial to migrate'
        WHEN v_map = v_total                  THEN 'CLEAN — every row maps to exactly one workspace'
        WHEN v_orphan > 0 OR v_ambig > 0      THEN 'NEEDS A HUMAN — see orphaned/ambiguous'
        ELSE 'PARTIAL — some rows have no creator; already invisible today'
      END
    );
  END LOOP;
END $$;

SELECT * FROM tenancy_audit ORDER BY total_rows DESC, table_name;

SELECT
  count(*)                                   AS tables_to_migrate,
  sum(total_rows)                            AS rows_affected,
  sum(mappable)                              AS deterministically_mappable,
  sum(no_creator)                            AS rows_with_no_creator,
  sum(orphaned)                              AS creator_without_workspace,
  sum(ambiguous)                             AS creator_in_many_workspaces,
  CASE
    WHEN sum(orphaned) + sum(ambiguous) = 0
      THEN 'SAFE — every row with a creator maps to exactly one workspace'
    ELSE 'STOP — ' || (sum(orphaned) + sum(ambiguous))::text ||
         ' rows need a human decision before NOT NULL'
  END AS verdict
FROM tenancy_audit;


-- ############################################################################
-- HOW TO READ THIS
-- ############################################################################
--
-- mappable     the creator belongs to exactly one active workspace, so the
--              backfill is deterministic — not a guess.
-- no_creator   user_id IS NULL. Already unreachable today, because
--              `WHERE user_id = $1` never matches NULL. Migrating cannot make
--              these worse and remediation cannot make them better: there is
--              no creator to derive a workspace from. A human must place or
--              archive them.
-- orphaned     a real creator with no active membership. VISIBLE today and
--              would disappear. Fix the membership first — see
--              scripts/remediate-orphaned-workspace.sql.
-- ambiguous    the creator is in several workspaces, so which book the row
--              belongs to is genuinely unknowable from the data.
--
-- Only `orphaned` and `ambiguous` block. The others are either fine or already
-- dark — the same distinction that turned 28 blocking rows into 4 on the core
-- migration.
