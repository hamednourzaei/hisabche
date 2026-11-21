-- ============================================================================
-- WORKSPACE PURGE — delete one business and every row it owns.
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor after
--    docs/subscription-upgrade-requests-migration.sql, then run
--    docs/VERIFY-workspace-purge.sql. Status: PENDING HUMAN CONFIRMATION.
--
-- WHY
--
--   The owner asked for «گزینه حذف کامل اشتراک و دیتابیسشون» — the admin panel
--   could suspend a business but never remove it. A business spans ~200 tables
--   (everything carrying workspace_id, plus children that carry only their
--   parent's id: journal_lines, invoice_items, bom_items, …). Deleting them one
--   request at a time from supabase-js is not a transaction (AGENTS.md §1.4)
--   and would leave half a business behind when one request failed.
--
-- HOW
--
--   One Postgres function, one transaction:
--
--   1. Lock the workspace row and require the typed name to match exactly.
--      A wrong or half-typed name aborts before anything is deleted.
--   2. Record the id of every row that belongs to this workspace, per table:
--      every table with workspace_id, plus the workspace row itself.
--   3. Repeatedly delete:
--        a. rows in child tables that carry NO workspace_id but point at a
--           recorded id (journal_lines → journal_entries, invoice_items →
--           invoices, bom_items → boms → products, …). Newly deleted rows are
--           recorded too, so grandchildren are reached on the next pass.
--        b. rows in every table that HAS workspace_id.
--      A pass that makes no progress ends the loop.
--   4. Refuse (WORKSPACE_PURGE_INCOMPLETE) if any workspace row survived —
--      better an error than a half-deleted business.
--   5. Delete the workspace row itself.
--
--   Auth users are NOT touched: the people may own or join other businesses.
--   The admin audit entry is written by the backend AFTER the commit
--   (AdminSecurityService), outside the workspace being removed.
--
-- ERRORS (raised, so the transaction rolls back completely)
--
--   WORKSPACE_NOT_FOUND        no such workspace
--   WORKSPACE_NAME_MISMATCH    the typed name is not this workspace's name
--   WORKSPACE_PURGE_INCOMPLETE a table still holds rows the function could not
--                              reach; nothing is deleted
--
-- ROLLBACK
--
--   DROP FUNCTION IF EXISTS public.purge_workspace(uuid, text);
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.purge_workspace(
  p_workspace_id uuid,
  p_confirm_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name     text;
  v_deleted  integer := 0;
  v_rows     integer;
  v_pass     integer := 0;
  v_progress boolean := true;
  v_tbl      record;
  v_fk       record;
BEGIN
  SELECT w.name INTO v_name
    FROM public.workspaces w
   WHERE w.id = p_workspace_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKSPACE_NOT_FOUND';
  END IF;
  IF v_name IS DISTINCT FROM p_confirm_name THEN
    RAISE EXCEPTION 'WORKSPACE_NAME_MISMATCH';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _purge_workspace_ids (
    table_name text NOT NULL,
    id         text NOT NULL,
    PRIMARY KEY (table_name, id)
  ) ON COMMIT DROP;
  TRUNCATE _purge_workspace_ids;

  -- The workspace row itself, so a child that points at workspaces(id) is
  -- reachable even when it has no workspace_id column.
  INSERT INTO _purge_workspace_ids (table_name, id)
  VALUES ('workspaces', p_workspace_id::text);

  -- Every row of every workspace-owned table, by primary key.
  FOR v_tbl IN
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema
       AND t.table_name = c.table_name
     WHERE c.table_schema = 'public'
       AND c.column_name = 'workspace_id'
       AND t.table_type = 'BASE TABLE'
       AND EXISTS (
         SELECT 1 FROM information_schema.columns k
          WHERE k.table_schema = 'public'
            AND k.table_name = c.table_name
            AND k.column_name = 'id'
       )
  LOOP
    EXECUTE format(
      'INSERT INTO _purge_workspace_ids (table_name, id)
       SELECT %L, t.id::text FROM public.%I t WHERE t.workspace_id = $1
       ON CONFLICT DO NOTHING',
      v_tbl.table_name, v_tbl.table_name
    ) USING p_workspace_id;
  END LOOP;

  WHILE v_progress AND v_pass < 40 LOOP
    v_progress := false;
    v_pass := v_pass + 1;

    -- (a) Child tables without workspace_id: rows that point at an id we have
    --     already recorded. Their own ids are recorded so the next pass can
    --     reach grandchildren.
    FOR v_fk IN
      SELECT child.relname  AS child_table,
             ca.attname     AS child_col,
             parent.relname AS parent_table,
             EXISTS (
               SELECT 1 FROM information_schema.columns ic
                WHERE ic.table_schema = 'public'
                  AND ic.table_name = child.relname
                  AND ic.column_name = 'id'
             ) AS child_has_id
        FROM pg_constraint con
        JOIN pg_class child      ON child.oid = con.conrelid
        JOIN pg_class parent     ON parent.oid = con.confrelid
        JOIN pg_namespace nsp    ON nsp.oid = con.connamespace
        JOIN pg_namespace pnsp   ON pnsp.oid = parent.relnamespace
        JOIN pg_attribute ca     ON ca.attrelid = con.conrelid  AND ca.attnum = con.conkey[1]
       WHERE con.contype = 'f'
         AND nsp.nspname = 'public'
         AND pnsp.nspname = 'public'
         AND array_length(con.conkey, 1) = 1
         AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns ic
            WHERE ic.table_schema = 'public'
              AND ic.table_name = child.relname
              AND ic.column_name = 'workspace_id'
         )
    LOOP
      BEGIN
        IF v_fk.child_has_id THEN
          EXECUTE format(
            'WITH del AS (
               DELETE FROM public.%I c
                WHERE c.%I::text IN (
                  SELECT i.id FROM _purge_workspace_ids i WHERE i.table_name = %L
                )
               RETURNING c.id::text AS id
             )
             INSERT INTO _purge_workspace_ids (table_name, id)
             SELECT %L, d.id FROM del d
             ON CONFLICT DO NOTHING',
            v_fk.child_table, v_fk.child_col, v_fk.parent_table, v_fk.child_table
          );
        ELSE
          -- No primary key to record: delete it, but nothing can reference it
          -- further down, so no id is needed.
          EXECUTE format(
            'DELETE FROM public.%I c
              WHERE c.%I::text IN (
                SELECT i.id FROM _purge_workspace_ids i WHERE i.table_name = %L
              )',
            v_fk.child_table, v_fk.child_col, v_fk.parent_table
          );
        END IF;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows > 0 THEN
          v_deleted := v_deleted + v_rows;
          v_progress := true;
        END IF;
      EXCEPTION WHEN foreign_key_violation THEN
        -- A row of this child is still referenced by its own child table.
        -- The next pass reaches it; if not, step 4 refuses.
        NULL;
      END;
    END LOOP;

    -- (b) Every table that carries workspace_id.
    FOR v_tbl IN
      SELECT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema
         AND t.table_name = c.table_name
       WHERE c.table_schema = 'public'
         AND c.column_name = 'workspace_id'
         AND t.table_type = 'BASE TABLE'
    LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE workspace_id = $1', v_tbl.table_name)
          USING p_workspace_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows > 0 THEN
          v_deleted := v_deleted + v_rows;
          v_progress := true;
        END IF;
      EXCEPTION WHEN foreign_key_violation THEN
        NULL;
      END;
    END LOOP;
  END LOOP;

  -- Step 4: nothing workspace-owned may remain.
  FOR v_tbl IN
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema
       AND t.table_name = c.table_name
     WHERE c.table_schema = 'public'
       AND c.column_name = 'workspace_id'
       AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE workspace_id = $1', v_tbl.table_name)
      INTO v_rows USING p_workspace_id;
    IF v_rows > 0 THEN
      RAISE EXCEPTION 'WORKSPACE_PURGE_INCOMPLETE';
    END IF;
  END LOOP;

  -- Step 5: the business itself.
  BEGIN
    DELETE FROM public.workspaces WHERE id = p_workspace_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RAISE EXCEPTION 'WORKSPACE_NOT_FOUND';
    END IF;
    v_deleted := v_deleted + v_rows;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'WORKSPACE_PURGE_INCOMPLETE';
  END;

  RETURN jsonb_build_object(
    'workspace_id', p_workspace_id,
    'deleted_rows', v_deleted,
    'passes', v_pass
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_workspace(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_workspace(uuid, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
