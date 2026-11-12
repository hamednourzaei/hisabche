-- ============================================================================
-- docs/FINDING-workspace-id-nulls.sql
--
-- V61 B.2.26 — Read-only audit of every public table with a `workspace_id` column:
-- reports nullability, NULL row count, and total rows before running tenancy-02.
-- ============================================================================

DO $$
DECLARE
  r record;
  v_nulls bigint;
  v_total bigint;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _ws_null_audit (
    table_name text,
    is_nullable text,
    null_rows bigint,
    total_rows bigint
  ) ON COMMIT DROP;
  TRUNCATE _ws_null_audit;

  FOR r IN
    SELECT c.table_name, c.is_nullable
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public'
       AND t.table_type = 'BASE TABLE'
       AND c.column_name = 'workspace_id'
     ORDER BY c.table_name
  LOOP
    EXECUTE format(
      'SELECT count(*) FILTER (WHERE workspace_id IS NULL), count(*) FROM public.%I',
      r.table_name
    ) INTO v_nulls, v_total;

    INSERT INTO _ws_null_audit VALUES (r.table_name, r.is_nullable, v_nulls, v_total);
  END LOOP;
END $$;

SELECT * FROM _ws_null_audit ORDER BY null_rows DESC, table_name;
