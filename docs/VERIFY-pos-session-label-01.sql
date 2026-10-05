-- ============================================================================
-- docs/VERIFY-pos-session-label-01.sql   (read-only)
--
-- Run after docs/pos-session-label-01-migration.sql. One row; `ok` must be true.
-- ============================================================================

SELECT
  col.exists                                   AS label_column_exists,
  col.is_nullable                              AS label_is_nullable,
  chk.exists                                   AS length_check_exists,
  (col.exists AND col.is_nullable AND chk.exists) AS ok
FROM
  (
    SELECT
      count(*) = 1                         AS exists,
      coalesce(bool_and(is_nullable = 'YES'), false) AS is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pos_sessions'
      AND column_name = 'label'
      AND data_type = 'text'
  ) AS col,
  (
    SELECT count(*) = 1 AS exists
    FROM pg_constraint
    WHERE conname = 'pos_sessions_label_length_check'
      AND conrelid = 'public.pos_sessions'::regclass
  ) AS chk;
