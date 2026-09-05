-- ============================================================================
-- docs/FIX-INVOICES.sql
--
-- The last two things the rebuild lost. Run it once.
--
-- ---------------------------------------------------------------------------
-- WHERE THINGS STAND
--
-- The 403s are gone — `workspaceId: 3f19d3ca-…` is in every log line now, and
-- `/api/products` and `/api/customers` return 200. Two errors are left, and
-- both are the same story as `has_access`: the dump recorded columns and types
-- and nothing else.
--
--   1. PGRST200  no foreign key `fk_invoices_customer`
--   2. 23502     `invoices.public_token` is NOT NULL with no default
--
-- ⚠️ THE SECOND ONE IS MY MISTAKE, AND IT IS WORTH NAMING.
--
-- An earlier version of `_generate-default-fixes.sql` emitted `DROP NOT NULL`
-- for every text column in this state — about two hundred, including foreign
-- keys like `invoice_items.invoice_id`. That was dangerous, so I removed the
-- whole section.
--
-- Removing all of it was also wrong. `public_token` is exactly the case the
-- section existed for: NOT NULL, no default, and NEVER set by the application
-- because the database always supplied it. The right move was to narrow the
-- filter to columns the code does not write, not to delete the idea.
--
-- And the fix is not `DROP NOT NULL` either. A null share token would make
-- `/invoice/public/:token` match on nothing, or worse, match the wrong row —
-- so this restores a RANDOM default instead. Unguessable per row, which is
-- what a share token is for.
--
-- SAFE TO RE-RUN.
-- ============================================================================

SET lock_timeout = '5s';

-- ─── 1. The foreign key PostgREST needs by name ─────────────────────────────
--
-- `invoice.service.ts` embeds the customer with an explicit hint:
--
--     .select('…, customers!fk_invoices_customer(…)')
--
-- PostgREST resolves that hint against the CONSTRAINT NAME. Recreating the
-- tables without foreign keys left nothing to resolve, so every invoice list
-- fails with PGRST200 — and it fails at the API layer, not in Postgres, which
-- is why the error mentions a "schema cache" rather than a missing column.
--
-- ⚠️ The name is not cosmetic. `fk_invoices_customer` is written into the
-- query; a constraint with the same columns under a different name would not
-- satisfy the hint.
--
-- ⚠️ NOT VALID, deliberately: it enforces the constraint on new rows without
-- scanning the existing ones, so it cannot block on a large table. Validate
-- later with `ALTER TABLE invoices VALIDATE CONSTRAINT fk_invoices_customer`.
--
-- ⚠️ And no ON DELETE CASCADE. Deleting a customer must not silently delete
-- their invoices — those are financial records, and the correct behaviour is
-- to refuse the delete and make somebody decide.

DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_customer'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT fk_invoices_customer
      FOREIGN KEY (customer_id) REFERENCES customers(id)
      NOT VALID;
    RAISE NOTICE 'fk_invoices_customer created';
  ELSE
    RAISE NOTICE 'fk_invoices_customer already exists';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'could not create fk_invoices_customer: %', SQLERRM;
END $fk$;

-- ⚠️ PostgREST caches the schema. Without this it keeps answering PGRST200
-- from memory even though the constraint now exists — which reads exactly like
-- the fix not working.
NOTIFY pgrst, 'reload schema';

-- ─── 2. Share tokens: a random default, not a relaxed constraint ────────────
--
-- Every `*_token` column that is NOT NULL with no default. The application
-- reads them and never writes them:
--
--     invoices.public_token       the invoice share link
--     interactions.public_token   the interaction share link
--
-- `gen_random_uuid()::text` gives each row an unguessable value, which is the
-- entire security property these columns carry — they are looked up BY token
-- precisely so a sequential id cannot be walked.

DO $tokens$
DECLARE
  r RECORD;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name, a.attname AS column_name,
           format_type(a.atttypid, a.atttypmod) AS data_type
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attnotnull
      AND a.attname LIKE '%\_token'
      AND format_type(a.atttypid, a.atttypmod) IN ('text', 'uuid')
      AND NOT EXISTS (
        SELECT 1 FROM pg_attrdef d WHERE d.adrelid = a.attrelid AND d.adnum = a.attnum
      )
  LOOP
    -- ⚠️ The cast matches the column type. These are `uuid` in this schema,
    -- and `gen_random_uuid()::text` would round-trip through text and back
    -- for no reason — or fail outright if the assignment cast were missing.
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT %s',
      r.table_name, r.column_name,
      CASE WHEN r.data_type = 'uuid' THEN 'gen_random_uuid()' ELSE 'gen_random_uuid()::text' END
    );
    v_count := v_count + 1;
    RAISE NOTICE 'random default: %.%', r.table_name, r.column_name;
  END LOOP;

  RAISE NOTICE '% token columns given a random default', v_count;
END $tokens$;

-- ─── 3. Backfill rows that already exist without one ────────────────────────
--
-- A default only applies to new rows. Any invoice created before this — there
-- should be none after the reset, but the script must not assume it — would
-- still have a null token and a share link that matches nothing.

UPDATE invoices SET public_token = gen_random_uuid() WHERE public_token IS NULL;

-- ============================================================================
-- PROOF — one result set, because the editor shows only the last.
-- ============================================================================

SELECT check_name, result, detail FROM (

  SELECT 1 AS ord, 'fk_invoices_customer exists' AS check_name,
    CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_customer')
      THEN 'PASS' ELSE 'FAIL' END AS result,
    'the name the query hint resolves against' AS detail

  UNION ALL
  SELECT 2, 'token columns have defaults',
    CASE WHEN (
      SELECT count(*) FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0
        AND NOT a.attisdropped AND a.attnotnull AND a.attname LIKE '%\_token'
        AND NOT EXISTS (SELECT 1 FROM pg_attrdef d WHERE d.adrelid = a.attrelid AND d.adnum = a.attnum)
    ) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'invoices and interactions share links'

  UNION ALL
  -- ⚠️ NOT pass/fail. These are the remaining NOT NULL text/uuid columns with
  -- no default. MOST are fine — foreign keys and required fields the code
  -- sets itself. They are listed so that when one of them raises 23502, you
  -- recognise it as this same class and fix that column with the error as
  -- evidence, rather than relaxing two hundred constraints on a guess.
  SELECT 3, 'columns that could raise 23502', 'INFO',
    (SELECT count(*)::text || ' NOT NULL text/uuid columns with no default'
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_attribute a ON a.attrelid = c.oid
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0
       AND NOT a.attisdropped AND a.attnotnull
       AND a.attname NOT IN ('id', 'workspace_id')
       AND format_type(a.atttypid, a.atttypmod) IN ('text', 'uuid')
       AND NOT EXISTS (SELECT 1 FROM pg_attrdef d WHERE d.adrelid = a.attrelid AND d.adnum = a.attnum))

) checks
ORDER BY ord;
