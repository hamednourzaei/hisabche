-- VERIFY user-guide-progress-01 — one row, every column must be true.
SELECT
  to_regclass('public.user_guide_progress') IS NOT NULL AS table_exists,
  COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.user_guide_progress')), false) AS rls_on,
  NOT has_table_privilege('anon', 'public.user_guide_progress', 'SELECT')
    AND NOT has_table_privilege('authenticated', 'public.user_guide_progress', 'SELECT') AS locked_down,
  has_table_privilege('service_role', 'public.user_guide_progress', 'INSERT')
    AND NOT has_table_privilege('service_role', 'public.user_guide_progress', 'DELETE') AS service_append_only,
  (
    to_regclass('public.user_guide_progress') IS NOT NULL
    AND COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.user_guide_progress')), false)
    AND NOT has_table_privilege('anon', 'public.user_guide_progress', 'SELECT')
    AND NOT has_table_privilege('authenticated', 'public.user_guide_progress', 'SELECT')
    AND has_table_privilege('service_role', 'public.user_guide_progress', 'INSERT')
    AND NOT has_table_privilege('service_role', 'public.user_guide_progress', 'DELETE')
  ) AS ok;
