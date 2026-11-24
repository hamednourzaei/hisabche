-- ============================================================================
-- docs/VERIFY-linter-2026-11-24b.sql — read-only. Run AFTER the migration.
--
-- One row. `ok` must be true. Every other column is the evidence:
--
--   search_path_found          how many of the seven functions exist here
--   search_path_mutable        how many of those still have no fixed
--                              search_path. Must be 0.
--   secdef_found               how many of the four SECURITY DEFINER
--                              functions exist here
--   anon_executable            how many of those anon may EXECUTE. Must be 0.
--   authenticated_executable   how many of those authenticated may EXECUTE.
--                              Must be 0.
--   btree_gist_present         the extension exists
--   btree_gist_schema          where it lives. Must be `extensions`.
--
-- «Leaked Password Protection Disabled» is not represented here: it is an Auth
-- setting, not a database object. Enable it in the dashboard.
-- ============================================================================
WITH sp_wanted(name) AS (
  VALUES
    ('prevent_license_logs_mutation'),
    ('workspace_operational_dna_history_frozen'),
    ('trg_service_delivery_sessions_updated_at'),
    ('offline_license_signing_keys_guard'),
    ('remittance_events_append_only'),
    ('repair_ticket_events_append_only'),
    ('sync_record_workspace_keyed_change')
),
sp_found AS (
  SELECT p.proname,
         EXISTS (
           SELECT 1
             FROM unnest(coalesce(p.proconfig, '{}'::text[])) AS setting
            WHERE setting LIKE 'search_path=%'
         ) AS pinned
    FROM pg_proc p
    JOIN sp_wanted w ON w.name = p.proname
   WHERE p.pronamespace = 'public'::regnamespace
),
secdef_wanted(name) AS (
  VALUES
    ('prevent_package_credit_ledger_mutation'),
    ('prevent_package_credit_side_table_mutation'),
    ('canonical_provision_workspace'),
    ('package_credit_consume')
),
secdef_found AS (
  SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN secdef_wanted w ON w.name = p.proname
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.prosecdef
),
facts AS (
  SELECT
    (SELECT count(*) FROM sp_found)::int AS search_path_found,
    (SELECT count(*) FROM sp_found WHERE NOT pinned)::int AS search_path_mutable,
    (SELECT count(*) FROM secdef_found)::int AS secdef_found,
    (SELECT count(*)
       FROM secdef_found f
       JOIN pg_roles r ON r.rolname = 'anon'
      WHERE has_function_privilege(r.oid, f.oid, 'EXECUTE'))::int AS anon_executable,
    (SELECT count(*)
       FROM secdef_found f
       JOIN pg_roles r ON r.rolname = 'authenticated'
      WHERE has_function_privilege(r.oid, f.oid, 'EXECUTE'))::int AS authenticated_executable,
    coalesce(
      (SELECT n.nspname
         FROM pg_extension e
         JOIN pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname = 'btree_gist'),
      'absent'
    ) AS btree_gist_schema,
    EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') AS btree_gist_present
)
SELECT facts.*,
       (search_path_mutable = 0
        AND anon_executable = 0
        AND authenticated_executable = 0
        AND btree_gist_schema = 'extensions') AS ok
  FROM facts;
