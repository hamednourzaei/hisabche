-- ═══════════════════════════════════════════════════════════════════════════
-- HISABCHE — STRUCTURE DUMP (NO ROW DATA)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHAT THIS IS FOR
--
-- Every migration in this project has been designed against MIGRATION FILES
-- rather than the database they were supposed to run against. That produced
-- real defects: `check-schema-drift.mjs` exists because three services were
-- written against columns that did not exist (BUG-041, and the eleven-orphan
-- issue in STATE.md), and `HANDOFF-PHASES-G-TO-O.md` records four migrations
-- marked "✅ اجرا شد" whose tables are not in `SETUP-COMPLETE.sql`.
--
-- The rule this file serves is already written down:
--
--   «مستندات را باور نکن، کد را بخوان» — and this goes one better:
--   «کد را هم باور نکن، دیتابیس را بپرس».
--
-- WHAT IT DOES NOT CONTAIN
--
-- ⚠️ NO ROW DATA. Not one invoice, customer, payment, product or password hash.
-- Structure and behaviour only. This is a shop ledger: if the output of this
-- query leaves your machine, it is a schema description and nothing else.
--
-- HOW TO RUN
--
-- Supabase → SQL Editor → New query → paste all of this → Run.
-- Then: Result → Copy cell value, or use the CSV/download button.
--
-- If the output is large, run the SECTIONS separately — each is independent and
-- has a heading you can search for. Section 6 (functions) is the one that has
-- answered questions nothing else could.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — WHAT RUN, AND WHAT DID NOT
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ THIS IS THE FIRST THING TO READ. Every other section describes a
-- POSSIBILITY; this one says what actually happened on THIS database.
--
-- `scripts/run-migrations.mjs` has an ORDER array and a
-- `docs/bundle-migrations.mjs`. Neither is proof — the record below is.
--
-- ⚠️ `SELECT *` WITH NO COLUMN NAMES, DELIBERATELY.
--
-- The first version of this section said `ORDER BY version`, and it failed with
-- `42703: column "version" does not exist`. `run-migrations.mjs:270` is what
-- creates the table, and it creates `name, checksum, applied_at, applied_by` —
-- there is no `version` column, and there never was. Naming a column that the
-- code does not use is exactly the mistake this dump exists to catch, so the
-- query does not name one. If `schema_migrations` does not exist at all, that is
-- also an answer, and the query below reports it rather than failing.

SELECT '=== MIGRATION LEDGER SHAPE ===' AS section,
  to_regclass('public.schema_migrations')                              AS ledger_table,
  to_regclass('private.auth_workspace_ids')                           AS auth_fn_private,
  to_regclass('public.auth_workspace_ids')                            AS auth_fn_public,
  to_regclass('private.is_workspace_member')                         AS member_fn_private,
  to_regclass('public.is_workspace_member')                          AS member_fn_public,
  to_regnamespace('private')                                          AS private_schema_exists,
  (SELECT count(*) FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema'))       AS function_count;

-- ⚠️ RUN THIS THIRD. Safe whether or not the ledger exists, which is why it is
-- shaped this way: `to_regclass` returns NULL for a table that is not there,
-- and the row count is guarded by the CASE rather than by a subquery that would
-- raise 42P01.
--
-- If `ledger_table` is NULL, or `applied_count` is 0, then NO migration was ever
-- run through the script on this database — everything came from
-- `SETUP-COMPLETE.sql` pasted into the SQL Editor, which records nothing. That
-- is the state `HANDOFF-PHASES-G-TO-O.md` describes when it marks a migration
-- "✅ اجرا شد" on the strength of the author's word.
--
-- The three other facts here have each already cost real time:
--   · which schema `auth_workspace_ids` lives in — `public` or `private`.
--     BUG-065: every policy written with the wrong prefix fails 42883, and the
--     Postgres test passed because the stub was created in `public`.
--   · whether `is_workspace_member` is in the same schema as its callers expect.
--   · whether the `private` schema exists at all.

SELECT '=== APPLIED MIGRATIONS ===' AS section, t.*
FROM schema_migrations t
ORDER BY t.applied_at;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 2 — TABLES AND COLUMNS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ INCLUDES COLUMNS THAT MAY NOT EXIST ANYWHERE IN THE MIGRATIONS. That is
-- the point: `state` on `pos_sessions`, `workspace_id` on tables that were not
-- given one, a column renamed by hand. Code written against the files rather
-- than against this table is where the silent breakage lives.

SELECT
  '=== COLUMNS ===' AS section,
  c.table_schema                                   AS schema,
  c.table_name,
  c.ordinal_position                               AS pos,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default,
  c.character_maximum_length                      AS max_len
FROM information_schema.columns c
WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
  AND c.table_schema NOT LIKE 'pg_toast%'
ORDER BY c.table_schema, c.table_name, c.ordinal_position;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 3 — ROW COUNTS ONLY
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ COUNT, NEVER CONTENT. This section exists because "the table exists" and
-- "the table has anything in it" are different facts, and both have been assumed
-- for each other in this project. `audit_logs` held 235 rows before a reset;
-- `stock_movements` held 65. Whether they still do is not recorded anywhere.
--
-- EXACT COUNTS, NOT ESTIMATES. `count: 'estimated'` is the planner's guess and
-- has already caused one bug here (C-04, deleted in Phase 0). For a structure
-- dump this query must be exact or it is not worth running.

SELECT
  '=== ROW COUNTS ===' AS section,
  schemaname                                       AS schema,
  relname                                          AS table,
  n_live_tup                                       AS approx_rows,
  (SELECT count(*) FROM pg_class c2
    WHERE c2.oid = c.oid)                          AS exact_rows_hint
FROM pg_stat_user_tables c
WHERE schemaname NOT LIKE 'pg_toast%'
ORDER BY schemaname, relname;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 4 — KEYS, CONSTRAINTS, INDEXES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ THIS SECTION EXPLAINS BUG-059 AND BUG-061, BOTH OF WHICH ARE STILL IN
-- `HANDOFF-PHASES-G-TO-O.md` AS OPEN.
--
-- The embed `table!left(...)` in a PostgREST query resolves ONLY against a real
-- foreign key. The doc already warns about this: `invoices → customers` has no
-- FK and the generalisation about `boms`/`pos_*` was wrong. This query settles
-- it for every pair at once.
--
-- The unique indexes matter just as much: `payments_record_keyed` is only
-- idempotent because of one, and `invoice_write_document` only because of
-- `journal_entries_source_key`.

SELECT
  '=== CONSTRAINTS ===' AS section,
  con.conname                                       AS constraint_name,
  src_ns.nspname                                    AS schema,
  src.relname                                      AS table,
  con.contype                                      AS type_code,
  CASE con.contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'c' THEN 'CHECK'
    WHEN 'x' THEN 'EXCLUDE'
  END                                              AS type,
  tgt_ns.nspname                                    AS ref_schema,
  tgt.relname                                      AS ref_table,
  pg_get_constraintdef(con.oid)                     AS definition
FROM pg_constraint con
JOIN pg_class src      ON src.oid = con.conrelid
JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
LEFT JOIN pg_class tgt      ON tgt.oid = con.confrelid
LEFT JOIN pg_namespace tgt_ns ON tgt_ns.oid = tgt.relnamespace
WHERE src_ns.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY src_ns.nspname, src.relname, con.contype, con.conname;


SELECT
  '=== INDEXES ===' AS section,
  schemaname                                       AS schema,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename, indexname;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 5 — ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ NOT OPTIONAL. `§1` of the project guide says `workspace_id` is the only
-- security boundary, and `rls-coverage.test.ts` reads this database's
-- definitions — not the migration files — to check it.
--
-- Two policies that subquery each other caused `42P17 infinite recursion` and
-- were invisible until someone ran a query as a real logged-in user, because
-- the backend connects with `service_role` and bypasses RLS entirely. Whether
-- that is still true is answerable here and nowhere else.

SELECT
  '=== RLS ENABLED ===' AS section,
  n.nspname                                         AS schema,
  c.relname                                         AS table,
  c.relrowsecurity                                   AS rls_enabled,
  c.relforcerowsecurity                             AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
ORDER BY n.nspname, c.relname;


SELECT
  '=== POLICIES ===' AS section,
  schemaname                                       AS schema,
  tablename,
  policyname,
  permissive,
  roles::text                                      AS applies_to,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename, policyname;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 6 — FUNCTIONS  ← THE SECTION THAT ANSWERS THE MOST
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ THIS IS THE ONE NOBODY HAS BEEN ABLE TO ANSWER FROM THE FILES.
--
-- The 54 SQL files in `docs/` describe functions that may or may not exist on
-- this database. Without this section, every statement of the form "it is
-- idempotent" is a statement about a text file.
--
-- Specifically, this settles:
--   · does `invoice_write_document` exist?        (capability #69 depends on it)
--   · does `payments_record_keyed` exist?         (idempotent payments)
--   · does `purchase_order_write` exist?          (#59)
--   · does `warehouse_transfer_stock_keyed` exist? (#92 fixed a retry bug here)
--   · does `budget_consumption` exist?            (#128 reads from it)
--   · is `auth_workspace_ids` in `public` or in `private`?  (BUG-065: the answer
--     changed, and every new policy written with the wrong prefix fails 42883)

SELECT
  '=== FUNCTIONS ===' AS section,
  n.nspname                                         AS schema,
  p.proname                                         AS function,
  pg_get_function_identity_arguments(p.oid)         AS args,
  l.lanname                                         AS language,
  CASE p.prosecdef
    WHEN true  THEN 'SECURITY DEFINER'
    WHEN false THEN 'SECURITY INVOKER'
  END                                              AS security,
  CASE p.provolatile
    WHEN 'v' THEN 'VOLATILE'
    WHEN 's' THEN 'STABLE'
    WHEN 'i' THEN 'IMMUTABLE'
  END                                              AS volatility,
  COALESCE(array_to_string(p.proconfig, ', '), '-')  AS config,
  p.prosrc                                          AS body
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language  l ON l.oid = p.prolang
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND p.prokind = 'f'
ORDER BY n.nspname, p.proname;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 7 — TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ `stock_movements_project` is why `products.quantity` is a projection and
-- not a column anyone writes. If it is absent on this database, every quantity
-- in the product is a manually-maintained guess, and the whole Phase C
-- consolidation is theoretical here.

SELECT
  '=== TRIGGERS ===' AS section,
  n.nspname                                         AS schema,
  c.relname                                         AS table,
  t.tgname                                          AS trigger,
  pg_get_triggerdef(t.oid)                         AS definition,
  t.tgenabled
FROM pg_trigger t
JOIN pg_class      c ON c.oid = t.tgrelid
JOIN pg_namespace  n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, c.relname, t.tgname;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 8 — VIEWS, AND WHAT THEY DEPEND ON
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ `phase-b-01` dropped `transactions_view` and the rebuilt view came back
-- WITHOUT `security_invoker`, so every logged-in user could read every
-- workspace's ledger through it. The file it happened in is dated 5 September
-- and the lesson is recorded; whether the view on THIS database has the flag is
-- not recorded anywhere.
--
-- ⚠️ `O1` built a `metadata.entity_catalog` whose whole purpose is to stop
-- an AI answering a question from a table that is `frozen` or `legacy`. If the
-- catalog does not exist here, that protection does not exist here either.

SELECT
  '=== VIEWS ===' AS section,
  n.nspname                                         AS schema,
  c.relname                                         AS view,
  c.reloptions                                      AS options,
  pg_get_viewdef(c.oid, true)                      AS definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, c.relname;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 9 — THE CATALOGUE AND THE ENUMS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `metadata.entity_catalog` carries a CHECK that a non-source-of-truth table
-- must declare what it is derived from. A table with `is_source_of_truth = false`
-- and no derivation is the exact shape the constraint is meant to forbid, so it
-- is worth reading the rows rather than trusting the migration.

-- ⚠️ GUARDED, because the catalog may not exist. `to_regclass` returns NULL and
-- the CASE short-circuits, so a missing table reports NULL instead of raising
-- 42P01 and killing the whole run — which is what happened twice while this
-- file was being written.
SELECT
  '=== ENTITY CATALOG ===' AS section,
  to_regclass('metadata.entity_catalog') AS catalog_table,
  CASE WHEN to_regclass('metadata.entity_catalog') IS NOT NULL
    THEN (SELECT count(*)::int FROM metadata.entity_catalog)
  END AS catalog_rows;

-- ⚠️ RUN THIS ONLY IF THE LINE ABOVE REPORTED A NON-NULL `catalog_rows`. The
-- CHECK constraint on that table says a table which is not the source of truth
-- must declare what it is derived from — so a row with `false` and no
-- derivation is exactly the shape the constraint exists to forbid, and reading
-- the rows is the only way to know whether it holds.
--
-- If `catalog_rows` is 0 or NULL, skip this query: it will fail, and nothing
-- else in this dump depends on it.
SELECT '=== ENTITY CATALOG ROWS ===' AS section, * FROM metadata.entity_catalog
ORDER BY schema_name, table_name;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 10 — EXTENSIONS, SCHEMAS, ENUMS, SERVER
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Small, but three things here have caused real time loss: whether the `private`
-- schema exists (BUG-065's whole argument), which extensions are installed (an
-- extension missing means every function using it is missing), and the server
-- version, because `has_function_privilege` and `to_regrole` behave differently
-- across major versions.

SELECT '=== EXTENSIONS ===' AS section, extname, extversion FROM pg_extension ORDER BY extname;

SELECT '=== SCHEMAS ===' AS section, nspname, pg_get_userbyid(nspowner) AS owner
FROM pg_namespace
WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'
ORDER BY nspname;

SELECT '=== ENUMS ===' AS section, t.typname AS enum, e.enumlabel AS label, e.enumsortorder::int AS position
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY t.typname, e.enumsortorder;

SELECT '=== SERVER ===' AS section,
  current_database() AS database,
  current_user      AS connected_as,
  version()         AS server_version,
  current_setting('search_path') AS search_path,
  (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser;
