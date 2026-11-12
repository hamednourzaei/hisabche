-- ============================================================================
-- docs/tenancy-02-migration.sql
--
-- V61 B.2.26 — Tenancy hardening:
--   - For every table in `public` where `workspace_id` is nullable:
--     1. Add `CHECK (workspace_id IS NOT NULL) NOT VALID` (protects all new writes).
--     2. If existing NULL row count is 0: `VALIDATE CONSTRAINT` and `SET NOT NULL`.
--     3. If existing NULL rows > 0: keep `NOT VALID` (never guess/backfill `workspace_id`).
--
-- Additive, idempotent. Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

DO $$
DECLARE
  r record;
  v_nulls bigint;
  v_cname text;
BEGIN
  FOR r IN
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public'
       AND t.table_type = 'BASE TABLE'
       AND c.column_name = 'workspace_id'
       AND c.is_nullable = 'YES'
     ORDER BY c.table_name
  LOOP
    v_cname := left(r.table_name, 40) || '_ws_not_null_chk';
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = v_cname AND conrelid = format('public.%I', r.table_name)::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (workspace_id IS NOT NULL) NOT VALID',
        r.table_name,
        v_cname
      );
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE workspace_id IS NULL',
      r.table_name
    ) INTO v_nulls;

    IF v_nulls = 0 THEN
      EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', r.table_name, v_cname);
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN workspace_id SET NOT NULL', r.table_name);
    END IF;
  END LOOP;
END $$;

-- Rollback (manual reference):
-- Reversing SET NOT NULL per table requires `ALTER TABLE public.<table> ALTER COLUMN workspace_id DROP NOT NULL;`
