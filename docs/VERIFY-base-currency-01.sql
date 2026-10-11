-- ============================================================================
-- VERIFY-base-currency-01.sql — read-only. Run AFTER the migration.
-- One row; `ok` must be true.
--   column_exists       workspaces.base_currency is there, NOT NULL
--   default_is_afn      a new workspace starts in AFN
--   format_guarded      the three-letter check is in place
--   workspaces          how many workspaces there are
--   not_afn             how many hold something other than AFN (0 right after the run)
-- ============================================================================
WITH col AS (
  SELECT is_nullable, column_default
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'base_currency'
),
facts AS (
  SELECT
    EXISTS (SELECT 1 FROM col WHERE is_nullable = 'NO') AS column_exists,
    EXISTS (SELECT 1 FROM col WHERE column_default LIKE '%AFN%') AS default_is_afn,
    EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = 'workspaces_base_currency_format'
         AND conrelid = 'public.workspaces'::regclass
    ) AS format_guarded,
    (SELECT count(*) FROM public.workspaces)::int AS workspaces,
    (SELECT count(*) FROM public.workspaces w
      WHERE to_jsonb(w) ->> 'base_currency' IS DISTINCT FROM 'AFN')::int AS not_afn
)
SELECT facts.*, (column_exists AND default_is_afn AND format_guarded) AS ok
  FROM facts;
