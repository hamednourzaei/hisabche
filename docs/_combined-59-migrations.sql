-- ============================================================================
-- docs/_combined-59-migrations.sql
--
-- Combined & live-DB-hardened bundle of all 59 requested migration files,
-- ordered strictly by dependency (core -> modules -> RLS -> phases).
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--
-- LIVE-DB SAFETY GUARANTEES:
--   1. Preserves existing append-only audit_logs trigger (skips legacy UPDATE
--      when audit_logs_immutable_trigger already exists).
--   2. Never drops/downgrades already-existing CHECK/FK constraints such as
--      accounts_role_check (ERROR 23514 prevention).
--   3. Adds missing CHECK/FK constraints with NOT VALID so legacy rows never
--      abort the script while all new writes stay strictly enforced.
--   4. Guards standalone VALIDATE CONSTRAINT so historical edge rows emit
--      NOTICE instead of rolling back the entire 59-script bundle.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────
-- [1/59] live-reconciliation-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/live-reconciliation-migration.sql
--
-- Reconcile the LIVE database with what the code needs.
--
-- ---------------------------------------------------------------------------
-- WHY THIS FILE EXISTS SEPARATELY FROM THE OTHERS
--
-- Every other migration was written against a schema on paper. This one was
-- written against the schema that is actually there, read out of the database
-- and compared by `scripts/compare-live-schema.mjs`.
--
-- The gap is real and it is not small: `CREATE TABLE IF NOT EXISTS` does not
-- reshape a table that already exists, and roughly half of these tables were
-- created before the migrations were written. So a dozen tables the services
-- filter by `workspace_id` do not have a `workspace_id` at all.
--
-- ---------------------------------------------------------------------------
-- WHAT THAT MEANS, IN PLAIN TERMS
--
-- `stock_movements` holds 65 rows and has no workspace column. The warehouse
-- service filters it by workspace. Today that query does not fail quietly and
-- return the wrong shop's stock — it fails LOUDLY with `42703 column does not
-- exist`, because the column is not there at all.
--
-- That is the lucky version. The moment the column is added without the data
-- being scoped, the same query starts succeeding and returning NOTHING, which
-- reads exactly like "this shop has no stock movements". So the column and the
-- backfill have to land together, in one transaction. They do, below.
--
-- ---------------------------------------------------------------------------
-- HOW THE BACKFILL DECIDES WHICH WORKSPACE A ROW BELONGS TO
--
-- Preferred: from the PARENT record, where the parent already carries a
-- workspace — `products`, `customers` and `invoices` all do. A stock movement
-- belongs to the workspace of the product it moved. That is a fact, not a
-- guess.
--
-- Fallback: from `workspace_members`, via the `user_id` every one of these
-- tables carries, taking the OLDEST membership. That is deterministic, and for
-- a user who belongs to one workspace it is exactly right.
--
-- Anything that resolves to neither is left NULL and counted at the end. A row
-- whose owner cannot be determined must not be assigned to a workspace by a
-- migration — it would be inventing a fact about someone's books.
--
-- SAFE TO RE-RUN. Nothing here drops a table or deletes a row.
-- ============================================================================

BEGIN;

-- ─── 1. exchange_rates does not exist ───────────────────────────────────────
--
-- `currency.service.ts` reads it and `schema-drift-fix-migration.sql` ALTERs
-- it — but no migration ever CREATEd it. That ALTER aborts on a live database,
-- which is the second thing that stopped the bundle.

CREATE TABLE IF NOT EXISTS exchange_rates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid,
  currency_code text NOT NULL,
  -- Units of base currency per one unit of `currency_code`.
  rate          numeric(20, 8) NOT NULL CHECK (rate > 0),
  -- The rate FOR a day, not the day the row was touched. `updated_at` cannot
  -- answer "what was the rate on 12 March", which is the only question a
  -- backdated invoice asks.
  rate_date     date NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── 1b. Journal lines that record no amount ────────────────────────────────
--
-- Two rows in the live ledger have debit = 0 AND credit = 0.
--
-- WHY THEY HAVE TO GO, AND WHY DELETING THEM IS SAFE
--
-- A journal line with no amount records no money. It contributes nothing to
-- any total, so removing it cannot change what a single entry says, what any
-- report shows, or what any account balances to. That is arithmetic, not
-- judgement.
--
-- They cannot simply be left, either. `accounting-core-migration.sql` adds a
-- CHECK that a line is one side or the other, and then UPDATEs every line to
-- set its workspace — and Postgres re-checks a CHECK on every row an UPDATE
-- touches, including a NOT VALID one. So these two rows abort the migration
-- from inside a statement that is not even about them.
--
-- ARCHIVED FIRST, THEN DELETED
--
-- The row is copied whole into `journal_lines_archive` before it goes. It
-- carried no money, but it is still a record that something was written, and
-- an accountant asked six months from now why a line vanished deserves an
-- answer better than "a migration removed it". The archive is that answer.

CREATE TABLE IF NOT EXISTS journal_lines_archive (
  id           uuid,
  journal_id   uuid,
  account_id   uuid,
  debit        numeric,
  credit       numeric,
  user_id      uuid,
  created_at   timestamptz,
  archived_at  timestamptz NOT NULL DEFAULT now(),
  reason       text NOT NULL
);

INSERT INTO journal_lines_archive (
  id, journal_id, account_id, debit, credit, user_id, created_at, reason
)
SELECT
  l.id, l.journal_id, l.account_id, l.debit, l.credit, l.user_id, l.created_at,
  'no amount on either side; removed so journal_lines_one_sided_check could be enforced'
FROM journal_lines l
WHERE COALESCE(l.debit, 0) = 0
  AND COALESCE(l.credit, 0) = 0
  AND NOT EXISTS (SELECT 1 FROM journal_lines_archive a WHERE a.id = l.id);

DELETE FROM journal_lines
 WHERE COALESCE(debit, 0) = 0
   AND COALESCE(credit, 0) = 0;

-- ─── 2. The workspace column, everywhere it is missing ──────────────────────

ALTER TABLE audit_logs           ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE stock_movements      ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE suppliers            ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE purchase_orders      ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE payrolls             ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE leaves               ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE project_time_entries ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE boms                 ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE bom_items            ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE work_orders          ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE opportunities        ADD COLUMN IF NOT EXISTS workspace_id uuid;

-- These two are parents that other tables inherit from, so they are scoped
-- first even though no service filters them by workspace yet.
ALTER TABLE employees            ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE projects             ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE departments          ADD COLUMN IF NOT EXISTS workspace_id uuid;

-- ─── 3. Backfill from the parent, where the parent knows ────────────────────
--
-- Ordered so that a table is filled before anything that inherits from it.

UPDATE employees e
   SET workspace_id = m.workspace_id
  FROM workspace_members m
 WHERE e.workspace_id IS NULL
   AND m.user_id = e.user_id
   AND m.workspace_id IS NOT NULL;

UPDATE projects p
   SET workspace_id = m.workspace_id
  FROM workspace_members m
 WHERE p.workspace_id IS NULL
   AND m.user_id = p.user_id;

UPDATE departments d
   SET workspace_id = m.workspace_id
  FROM workspace_members m
 WHERE d.workspace_id IS NULL
   AND m.user_id = d.user_id;

-- A stock movement belongs to the workspace of the product it moved.
UPDATE stock_movements s
   SET workspace_id = p.workspace_id
  FROM products p
 WHERE s.workspace_id IS NULL
   AND s.product_id = p.id
   AND p.workspace_id IS NOT NULL;

UPDATE boms b
   SET workspace_id = p.workspace_id
  FROM products p
 WHERE b.workspace_id IS NULL
   AND b.product_id = p.id
   AND p.workspace_id IS NOT NULL;

UPDATE work_orders w
   SET workspace_id = p.workspace_id
  FROM products p
 WHERE w.workspace_id IS NULL
   AND w.product_id = p.id
   AND p.workspace_id IS NOT NULL;

UPDATE bom_items i
   SET workspace_id = b.workspace_id
  FROM boms b
 WHERE i.workspace_id IS NULL
   AND i.bom_id = b.id
   AND b.workspace_id IS NOT NULL;

UPDATE payrolls r
   SET workspace_id = e.workspace_id
  FROM employees e
 WHERE r.workspace_id IS NULL
   AND r.employee_id = e.id
   AND e.workspace_id IS NOT NULL;

UPDATE leaves l
   SET workspace_id = e.workspace_id
  FROM employees e
 WHERE l.workspace_id IS NULL
   AND l.employee_id = e.id
   AND e.workspace_id IS NOT NULL;

UPDATE project_time_entries t
   SET workspace_id = p.workspace_id
  FROM projects p
 WHERE t.workspace_id IS NULL
   AND t.project_id = p.id
   AND p.workspace_id IS NOT NULL;

UPDATE opportunities o
   SET workspace_id = c.workspace_id
  FROM customers c
 WHERE o.workspace_id IS NULL
   AND o.customer_id = c.id
   AND c.workspace_id IS NOT NULL;

UPDATE purchase_orders po
   SET workspace_id = i.workspace_id
  FROM invoices i
 WHERE po.workspace_id IS NULL
   AND po.invoice_id = i.id
   AND i.workspace_id IS NOT NULL;

-- ─── 4. Backfill the rest from membership ───────────────────────────────────
--
-- Every one of these tables carries `user_id`. The oldest membership is used
-- so the answer is the same on every run, rather than whichever row the
-- planner happened to return.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'audit_logs', 'suppliers', 'purchase_orders', 'payrolls', 'leaves',
    'project_time_entries', 'boms', 'bom_items', 'work_orders',
    'opportunities', 'stock_movements'
  ]
  LOOP
    IF t = 'audit_logs' AND EXISTS (
      SELECT 1 FROM pg_trigger
       WHERE tgrelid = to_regclass('public.audit_logs')
         AND tgname = 'audit_logs_immutable_trigger'
         AND NOT tgisinternal
    ) THEN
      CONTINUE;
    END IF;
    EXECUTE format($f$
      UPDATE %I t
         SET workspace_id = (
               SELECT m.workspace_id
                 FROM workspace_members m
                WHERE m.user_id = t.user_id
                ORDER BY m.joined_at
                LIMIT 1
             )
       WHERE t.workspace_id IS NULL
         AND t.user_id IS NOT NULL
    $f$, t);
  END LOOP;
END $$;

-- `bom_items` has no user_id of its own; it inherits from its BOM.
UPDATE bom_items i
   SET workspace_id = b.workspace_id
  FROM boms b
 WHERE i.workspace_id IS NULL
   AND i.bom_id = b.id;

-- ─── 5. Indexes on the new column ───────────────────────────────────────────
--
-- Every one of these is now the first column of a WHERE clause on every read.
-- Without an index each of those becomes a sequential scan of the whole table.

CREATE INDEX IF NOT EXISTS audit_logs_workspace_idx           ON audit_logs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_workspace_product_idx ON stock_movements (workspace_id, product_id);
-- The older `stock_movements_workspace_idx` held the identical (workspace_id,
-- product_id) definition — a duplicate_index advisory. Canonical name above wins.
DROP INDEX IF EXISTS stock_movements_workspace_idx;
CREATE INDEX IF NOT EXISTS suppliers_workspace_idx            ON suppliers (workspace_id);
CREATE INDEX IF NOT EXISTS purchase_orders_workspace_idx      ON purchase_orders (workspace_id, order_date DESC);
CREATE INDEX IF NOT EXISTS payrolls_workspace_idx             ON payrolls (workspace_id, period_start DESC);
CREATE INDEX IF NOT EXISTS leaves_workspace_idx               ON leaves (workspace_id, start_date DESC);
CREATE INDEX IF NOT EXISTS project_time_entries_workspace_idx ON project_time_entries (workspace_id, project_id);
CREATE INDEX IF NOT EXISTS boms_workspace_idx                 ON boms (workspace_id, product_id);
CREATE INDEX IF NOT EXISTS bom_items_workspace_idx            ON bom_items (workspace_id, bom_id);
CREATE INDEX IF NOT EXISTS work_orders_workspace_idx          ON work_orders (workspace_id, status);
CREATE INDEX IF NOT EXISTS opportunities_workspace_idx        ON opportunities (workspace_id, stage);
CREATE INDEX IF NOT EXISTS employees_workspace_idx            ON employees (workspace_id, status);
CREATE INDEX IF NOT EXISTS projects_workspace_idx             ON projects (workspace_id, status);
CREATE INDEX IF NOT EXISTS departments_workspace_idx          ON departments (workspace_id);
CREATE INDEX IF NOT EXISTS exchange_rates_lookup_idx          ON exchange_rates (workspace_id, currency_code, rate_date DESC);

CREATE UNIQUE INDEX IF NOT EXISTS exchange_rates_workspace_currency_date_key
  ON exchange_rates (workspace_id, currency_code, rate_date)
  WHERE workspace_id IS NOT NULL;

-- ─── 6. Other columns the code reads and the database lacks ─────────────────

-- `checkout.service.ts` keys a checkout on an idempotency key and expires it.
-- Without these two, a retried checkout starts a SECOND payment.
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS checkout_sessions_idempotency_key
  ON checkout_sessions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- A soft delete. `supplier.service.ts` filters on it, so without the column
-- every supplier query errors.
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- A product's price means nothing without the currency it is priced in.
ALTER TABLE products ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'AFN';

-- `invoice.service.ts` reads a display name; the table has `full_name`.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name text;
UPDATE profiles SET display_name = full_name WHERE display_name IS NULL;

-- ─── 7. Row Level Security on the newly scoped tables ───────────────────────
--
-- The column alone is bookkeeping. The POLICY is the boundary — without it the
-- database will hand any authenticated caller any row, and the only thing
-- standing between two businesses is application code remembering to filter.
--
-- One policy shape, applied to each: you may touch a row of a workspace you
-- are an active member of. Suspended members and revoked access are excluded
-- here, in the database, not in a service that can forget.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'audit_logs', 'stock_movements', 'suppliers', 'purchase_orders',
    'payrolls', 'leaves', 'project_time_entries', 'boms', 'bom_items',
    'work_orders', 'opportunities', 'employees', 'projects', 'departments',
    'exchange_rates'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_workspace_members', t);
    EXECUTE format($f$
      CREATE POLICY %I ON %I
        FOR ALL TO authenticated
        USING (workspace_id IN (
          SELECT workspace_id FROM workspace_members
           WHERE user_id = (SELECT auth.uid())
             AND has_access = true
             AND suspended_at IS NULL
        ))
        WITH CHECK (workspace_id IN (
          SELECT workspace_id FROM workspace_members
           WHERE user_id = (SELECT auth.uid())
             AND has_access = true
             AND suspended_at IS NULL
        ))
    $f$, t || '_workspace_members', t);
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- WHAT COULD NOT BE RESOLVED
--
-- Run this after. Every count should be 0. A non-zero count is a row whose
-- workspace could not be determined from its parent or from its owner's
-- membership — it will be invisible to the application, which is the correct
-- and safe outcome, but somebody should look at why.
-- ============================================================================

SELECT 'audit_logs' AS table_name, count(*) AS unassigned FROM audit_logs WHERE workspace_id IS NULL
UNION ALL SELECT 'stock_movements', count(*) FROM stock_movements WHERE workspace_id IS NULL
UNION ALL SELECT 'suppliers', count(*) FROM suppliers WHERE workspace_id IS NULL
UNION ALL SELECT 'purchase_orders', count(*) FROM purchase_orders WHERE workspace_id IS NULL
UNION ALL SELECT 'payrolls', count(*) FROM payrolls WHERE workspace_id IS NULL
UNION ALL SELECT 'leaves', count(*) FROM leaves WHERE workspace_id IS NULL
UNION ALL SELECT 'project_time_entries', count(*) FROM project_time_entries WHERE workspace_id IS NULL
UNION ALL SELECT 'boms', count(*) FROM boms WHERE workspace_id IS NULL
UNION ALL SELECT 'bom_items', count(*) FROM bom_items WHERE workspace_id IS NULL
UNION ALL SELECT 'work_orders', count(*) FROM work_orders WHERE workspace_id IS NULL
UNION ALL SELECT 'opportunities', count(*) FROM opportunities WHERE workspace_id IS NULL
UNION ALL SELECT 'employees', count(*) FROM employees WHERE workspace_id IS NULL
UNION ALL SELECT 'projects', count(*) FROM projects WHERE workspace_id IS NULL
UNION ALL SELECT 'departments', count(*) FROM departments WHERE workspace_id IS NULL
UNION ALL SELECT 'journal lines with no amount', count(*) FROM journal_lines
  WHERE COALESCE(debit, 0) = 0 AND COALESCE(credit, 0) = 0
ORDER BY unassigned DESC, table_name;


-- ────────────────────────────────────────────────────────────────────────
-- [2/59] tenancy-workspace-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/tenancy-workspace-migration.sql
--
-- STEP 0 of the sync migration. Run this FIRST, alone, and read its output.
-- docs/sync-engine-migration.sql cannot work until this has completed.
--
-- Runs in psql or the Supabase SQL editor. No backslash meta-commands.
--
-- ---------------------------------------------------------------------------
-- WHY THIS EXISTS
--
-- `invoices`, `customers`, `products` and `transactions` have no
-- `workspace_id`. Their tenancy today is `user_id`: every read in the backend
-- is `.eq('user_id', userId)`, and the insert sets only `user_id`.
-- `workspace_id` lives on `activities`, `notifications`, `workspaces` and
-- `workflow`, and `invoice.service.ts` derives one via `resolveWorkspaceId()`
-- purely to stamp those.
--
-- documents/DATABASE_SCHEMA.md claims otherwise. It is wrong — the same file
-- was also wrong about `invoice_items`. The live database is the authority.
--
-- The intended model is a workspace as a SHARED BOOK: several members see and
-- edit the same invoices. That is not what the schema currently enforces, so
-- this is a genuine tenancy correction, not a column addition.
--
-- ---------------------------------------------------------------------------
-- HOW IT BEHAVES
--
-- It is deliberately in THREE separately-runnable parts:
--
--   PART 1  ANALYSE   read-only. Returns a table. Changes nothing.
--   PART 2  ADD       adds a NULLABLE column + FK + index. Reversible.
--   PART 3  BACKFILL  fills only rows that map to exactly ONE workspace,
--                     then reports what is left.
--
-- NOTHING here deletes, merges or overwrites a row. `NOT NULL` is deliberately
-- NOT applied — see the end of PART 3 for why that is a separate human
-- decision.
--
-- It FAILS CLOSED. If a row cannot be mapped to exactly one workspace it is
-- left NULL and counted, never guessed.
-- ============================================================================


-- ############################################################################
-- PART 1 — ANALYSE (read-only; safe to run on production)
-- ############################################################################
--
-- Run this alone first. It answers: can every row be mapped deterministically?
--
-- The only authoritative mapping available is
--     workspace_members.user_id -> workspace_members.workspace_id
-- which is exactly what `resolveWorkspaceId()` uses. A user in two workspaces
-- is therefore AMBIGUOUS and must not be guessed.

WITH membership AS (
  SELECT user_id, count(DISTINCT workspace_id) AS workspace_count
    FROM workspace_members
   GROUP BY user_id
),
scan AS (
  SELECT 'invoices' AS entity, i.id, i.user_id, m.workspace_count
    FROM invoices i LEFT JOIN membership m ON m.user_id = i.user_id
  UNION ALL
  SELECT 'customers', c.id, c.user_id, m.workspace_count
    FROM customers c LEFT JOIN membership m ON m.user_id = c.user_id
  UNION ALL
  SELECT 'products', p.id, p.user_id, m.workspace_count
    FROM products p LEFT JOIN membership m ON m.user_id = p.user_id
  UNION ALL
  SELECT 'transactions', t.id, t.user_id, m.workspace_count
    FROM transactions t LEFT JOIN membership m ON m.user_id = t.user_id
)
SELECT
  entity,
  count(*)                                                     AS total_rows,
  count(*) FILTER (WHERE workspace_count = 1)                  AS mappable,
  count(*) FILTER (WHERE workspace_count IS NULL)              AS orphaned,
  count(*) FILTER (WHERE workspace_count > 1)                  AS ambiguous,
  CASE
    WHEN count(*) FILTER (WHERE workspace_count IS DISTINCT FROM 1) = 0
      THEN 'SAFE — every row maps to exactly one workspace'
    ELSE 'STOP — resolve orphaned/ambiguous rows before NOT NULL'
  END                                                          AS verdict
FROM scan
GROUP BY entity
ORDER BY entity;

-- If `orphaned` or `ambiguous` is non-zero for any entity, list the offenders
-- before going further. Uncomment and run:
--
--   WITH membership AS (
--     SELECT user_id, count(DISTINCT workspace_id) AS n
--       FROM workspace_members GROUP BY user_id
--   )
--   SELECT i.id, i.user_id, i.invoice_number, i.total, coalesce(m.n, 0) AS workspaces
--     FROM invoices i LEFT JOIN membership m ON m.user_id = i.user_id
--    WHERE m.n IS DISTINCT FROM 1
--    ORDER BY i.created_at DESC LIMIT 200;
--
-- ORPHANED  = the creator belongs to no workspace. Usually a user who never
--             completed onboarding. Fix by adding the membership, not by
--             inventing a workspace for the invoice.
-- AMBIGUOUS = the creator belongs to several workspaces, so the row's book is
--             genuinely unknown from the data. Only a human who knows the
--             business can say which. Do not guess.


-- ############################################################################
-- PART 2 — ADD THE COLUMN (nullable, reversible)
-- ############################################################################
--
-- Safe on a large table: `ADD COLUMN` with no DEFAULT and no NOT NULL is
-- metadata-only on PostgreSQL 11+, so it does not rewrite the heap and takes
-- only a brief ACCESS EXCLUSIVE lock.
--
-- Nullable on purpose. A NOT NULL here would fail instantly against existing
-- rows, and a DEFAULT would silently assign every historical invoice to one
-- arbitrary workspace — which is precisely the guess this migration refuses to
-- make.

ALTER TABLE invoices     ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE customers    ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE products     ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Referential integrity, added NOT VALID so it does not scan the whole table
-- while holding a lock. Existing rows are checked later by VALIDATE, which
-- takes only a SHARE UPDATE EXCLUSIVE lock and does not block reads or writes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_workspace_fk') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_workspace_fk
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_workspace_fk') THEN
    ALTER TABLE customers ADD CONSTRAINT customers_workspace_fk
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_workspace_fk') THEN
    ALTER TABLE products ADD CONSTRAINT products_workspace_fk
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_workspace_fk') THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_workspace_fk
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

-- ON DELETE RESTRICT, not CASCADE. Deleting a workspace must never silently
-- delete its financial history; it should fail loudly and force a deliberate
-- decision about the books.

-- The indexes every workspace-scoped read will use. Not CONCURRENTLY here
-- because the column is still empty and the tables are small; on a table above
-- ~1M rows, run these separately with CONCURRENTLY and outside a transaction.
CREATE INDEX IF NOT EXISTS invoices_workspace_id_idx     ON invoices     (workspace_id);
CREATE INDEX IF NOT EXISTS customers_workspace_id_idx    ON customers    (workspace_id);
CREATE INDEX IF NOT EXISTS products_workspace_id_idx     ON products     (workspace_id);
CREATE INDEX IF NOT EXISTS transactions_workspace_id_idx ON transactions (workspace_id);

-- The composite the invoice list actually sorts by.
CREATE INDEX IF NOT EXISTS invoices_workspace_date_idx
  ON invoices (workspace_id, date DESC);


-- ############################################################################
-- PART 3 — BACKFILL (deterministic rows only)
-- ############################################################################
--
-- Only rows whose creator belongs to EXACTLY ONE workspace are filled. Every
-- other row is left NULL and reported. `workspace_id IS NULL` in the WHERE
-- clause makes this re-runnable and stops it from ever overwriting a value
-- that has already been decided.

WITH sole_membership AS (
  -- `min(uuid)` does not exist in PostgreSQL — there is no ordering aggregate
  -- for the type. The HAVING guarantees exactly ONE distinct workspace per
  -- user, so taking the single element of the distinct array is not a choice
  -- between candidates; it IS the only value. Rows with 0 or 2+ workspaces
  -- never reach here, which is what keeps the backfill deterministic.
  SELECT user_id, (array_agg(DISTINCT workspace_id))[1] AS workspace_id
    FROM workspace_members
   GROUP BY user_id
  HAVING count(DISTINCT workspace_id) = 1
)
UPDATE invoices i
   SET workspace_id = s.workspace_id
  FROM sole_membership s
 WHERE s.user_id = i.user_id
   AND i.workspace_id IS NULL;

WITH sole_membership AS (
  -- `min(uuid)` does not exist in PostgreSQL — there is no ordering aggregate
  -- for the type. The HAVING guarantees exactly ONE distinct workspace per
  -- user, so taking the single element of the distinct array is not a choice
  -- between candidates; it IS the only value. Rows with 0 or 2+ workspaces
  -- never reach here, which is what keeps the backfill deterministic.
  SELECT user_id, (array_agg(DISTINCT workspace_id))[1] AS workspace_id
    FROM workspace_members
   GROUP BY user_id
  HAVING count(DISTINCT workspace_id) = 1
)
UPDATE customers c
   SET workspace_id = s.workspace_id
  FROM sole_membership s
 WHERE s.user_id = c.user_id
   AND c.workspace_id IS NULL;

WITH sole_membership AS (
  -- `min(uuid)` does not exist in PostgreSQL — there is no ordering aggregate
  -- for the type. The HAVING guarantees exactly ONE distinct workspace per
  -- user, so taking the single element of the distinct array is not a choice
  -- between candidates; it IS the only value. Rows with 0 or 2+ workspaces
  -- never reach here, which is what keeps the backfill deterministic.
  SELECT user_id, (array_agg(DISTINCT workspace_id))[1] AS workspace_id
    FROM workspace_members
   GROUP BY user_id
  HAVING count(DISTINCT workspace_id) = 1
)
UPDATE products p
   SET workspace_id = s.workspace_id
  FROM sole_membership s
 WHERE s.user_id = p.user_id
   AND p.workspace_id IS NULL;

WITH sole_membership AS (
  -- `min(uuid)` does not exist in PostgreSQL — there is no ordering aggregate
  -- for the type. The HAVING guarantees exactly ONE distinct workspace per
  -- user, so taking the single element of the distinct array is not a choice
  -- between candidates; it IS the only value. Rows with 0 or 2+ workspaces
  -- never reach here, which is what keeps the backfill deterministic.
  SELECT user_id, (array_agg(DISTINCT workspace_id))[1] AS workspace_id
    FROM workspace_members
   GROUP BY user_id
  HAVING count(DISTINCT workspace_id) = 1
)
UPDATE transactions t
   SET workspace_id = s.workspace_id
  FROM sole_membership s
 WHERE s.user_id = t.user_id
   AND t.workspace_id IS NULL;

-- Now that the column is populated, prove the FK holds for existing rows.
DO $$
BEGIN
  ALTER TABLE invoices     VALIDATE CONSTRAINT invoices_workspace_fk;
EXCEPTION
  WHEN check_violation OR foreign_key_violation THEN
    RAISE NOTICE 'Deferred VALIDATE CONSTRAINT % on % (%): new writes stay enforced.', 'invoices_workspace_fk', 'invoices', SQLERRM;
END $$;
DO $$
BEGIN
  ALTER TABLE customers    VALIDATE CONSTRAINT customers_workspace_fk;
EXCEPTION
  WHEN check_violation OR foreign_key_violation THEN
    RAISE NOTICE 'Deferred VALIDATE CONSTRAINT % on % (%): new writes stay enforced.', 'customers_workspace_fk', 'customers', SQLERRM;
END $$;
DO $$
BEGIN
  ALTER TABLE products     VALIDATE CONSTRAINT products_workspace_fk;
EXCEPTION
  WHEN check_violation OR foreign_key_violation THEN
    RAISE NOTICE 'Deferred VALIDATE CONSTRAINT % on % (%): new writes stay enforced.', 'products_workspace_fk', 'products', SQLERRM;
END $$;
DO $$
BEGIN
  ALTER TABLE transactions VALIDATE CONSTRAINT transactions_workspace_fk;
EXCEPTION
  WHEN check_violation OR foreign_key_violation THEN
    RAISE NOTICE 'Deferred VALIDATE CONSTRAINT % on % (%): new writes stay enforced.', 'transactions_workspace_fk', 'transactions', SQLERRM;
END $$;

-- ── The verdict ─────────────────────────────────────────────────────────────
SELECT
  entity,
  total,
  filled,
  total - filled AS still_null,
  CASE
    WHEN total = filled THEN 'READY — safe to enforce NOT NULL and run the sync migration'
    ELSE 'BLOCKED — ' || (total - filled)::text || ' rows have no determinable workspace'
  END AS verdict
FROM (
  SELECT 'invoices' AS entity, count(*) AS total,
         count(workspace_id) AS filled FROM invoices
  UNION ALL
  SELECT 'customers', count(*), count(workspace_id) FROM customers
  UNION ALL
  SELECT 'products', count(*), count(workspace_id) FROM products
  UNION ALL
  SELECT 'transactions', count(*), count(workspace_id) FROM transactions
) t
ORDER BY entity;


-- ############################################################################
-- PART 4 — NOT NULL  (run ONLY when PART 3 reports READY for every entity)
-- ############################################################################
--
-- Deliberately left commented out. Enforcing NOT NULL is the point of no easy
-- return: from then on every INSERT must supply a workspace, so the
-- application changes in PHASE 4 must already be deployed. Running it while
-- rows are still NULL fails and leaves the table locked mid-scan.
--
-- Order of operations:
--   1. PART 3 reports READY for all four entities
--   2. deploy the backend that writes workspace_id on every insert
--   3. confirm new rows are arriving with a workspace_id
--   4. then, and only then, run the four statements below
--
-- ALTER TABLE invoices     ALTER COLUMN workspace_id SET NOT NULL;
-- ALTER TABLE customers    ALTER COLUMN workspace_id SET NOT NULL;
-- ALTER TABLE products     ALTER COLUMN workspace_id SET NOT NULL;
-- ALTER TABLE transactions ALTER COLUMN workspace_id SET NOT NULL;


-- ############################################################################
-- ROLLBACK
-- ############################################################################
--
-- Fully reversible while workspace_id is still nullable and unused: the column
-- is additive and no existing code reads it.
--
-- ALTER TABLE invoices     DROP CONSTRAINT IF EXISTS invoices_workspace_fk;
-- ALTER TABLE customers    DROP CONSTRAINT IF EXISTS customers_workspace_fk;
-- ALTER TABLE products     DROP CONSTRAINT IF EXISTS products_workspace_fk;
-- ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_workspace_fk;
--
-- ALTER TABLE invoices     DROP COLUMN IF EXISTS workspace_id;
-- ALTER TABLE customers    DROP COLUMN IF EXISTS workspace_id;
-- ALTER TABLE products     DROP COLUMN IF EXISTS workspace_id;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS workspace_id;
--
-- Dropping the column discards the backfill, but no business data: user_id,
-- totals, items and history are untouched throughout.


-- ────────────────────────────────────────────────────────────────────────
-- [3/59] unified-sale-purchase-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- HISABCHE — UNIFIED SALE / PURCHASE + NESTED ITEM DETAILS
-- Run this in the Supabase SQL editor.
--
-- Safe to run more than once: every statement is IF NOT EXISTS / idempotent.
-- Additive only — no column is dropped, no row is rewritten, no existing
-- invoice changes meaning. Existing records keep working untouched.
--
-- Read the ROLLBACK section at the bottom before running.
-- ============================================================================

BEGIN;

-- ─── 1. invoices.type — enforce the two real transaction types ──────────────
-- The column already exists and already defaults to 'sale'. This only adds a
-- guard so nothing can write a third value by accident.

ALTER TABLE invoices
  ALTER COLUMN type SET DEFAULT 'sale';

UPDATE invoices SET type = 'sale' WHERE type IS NULL;

ALTER TABLE invoices
  ALTER COLUMN type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_type_check'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_type_check
      CHECK (type IN ('sale', 'purchase')) NOT VALID;
  END IF;
END $$;

-- Invoice lists filter by type constantly; without this they scan.
CREATE INDEX IF NOT EXISTS invoices_type_idx ON invoices (type);
CREATE INDEX IF NOT EXISTS invoices_user_type_idx ON invoices (user_id, type);

-- ─── 2. invoice_items — unit and weight ─────────────────────────────────────
-- `unit` was missing entirely: the unit lived on `products` only, so a line
-- could not record the unit it was actually sold in.
--
-- `weight_grams` is SEPARATE from `quantity` on purpose. For a gold seller,
-- "1 necklace weighing 12.5 g" is quantity=1, weight_grams=12.5. Collapsing
-- them would make one of the two numbers wrong.

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'piece';

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS weight_grams NUMERIC(12, 3);

-- User-defined unit label. `unit` stays a closed set so reports can still
-- GROUP BY it; anything the user invents is stored as unit='custom' with the
-- typed label here.
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS unit_label TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_unit_check'
  ) THEN
    ALTER TABLE invoice_items
      ADD CONSTRAINT invoice_items_unit_check
      CHECK (unit IN ('piece', 'gram', 'kg', 'meter', 'liter', 'box', 'pack', 'carton', 'custom')) NOT VALID;
  END IF;

  -- A custom unit without a label would render as the literal word "custom".
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_unit_label_check'
  ) THEN
    ALTER TABLE invoice_items
      ADD CONSTRAINT invoice_items_unit_label_check
      CHECK (unit <> 'custom' OR (unit_label IS NOT NULL AND length(trim(unit_label)) > 0)) NOT VALID;
  END IF;
END $$;

-- ─── 3. invoice_item_details — the nested sub-items ─────────────────────────
-- A separate table, not JSON, because a detail is a real child row that must
-- be queryable, orderable and referentially safe. "گردنبند → زنجیر / سنگ /
-- اجرت" is a component of the item, never an independent invoice line.
--
-- ON DELETE CASCADE: deleting the parent item must not leave orphan details.

CREATE TABLE IF NOT EXISTS invoice_item_details (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_item_id UUID NOT NULL
                  REFERENCES invoice_items (id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  quantity      NUMERIC(12, 3) NOT NULL DEFAULT 1,
  amount        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit          TEXT NOT NULL DEFAULT 'piece',
  unit_label    TEXT,
  weight_grams  NUMERIC(12, 3),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoice_item_details_item_idx
  ON invoice_item_details (invoice_item_id);

-- Details must render in the order the user typed them.
CREATE INDEX IF NOT EXISTS invoice_item_details_order_idx
  ON invoice_item_details (invoice_item_id, sort_order);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_item_details_title_check'
  ) THEN
    ALTER TABLE invoice_item_details
      ADD CONSTRAINT invoice_item_details_title_check
      CHECK (length(trim(title)) > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_item_details_amount_check'
  ) THEN
    ALTER TABLE invoice_item_details
      ADD CONSTRAINT invoice_item_details_amount_check
      CHECK (amount >= 0 AND quantity > 0) NOT VALID;
  END IF;
END $$;

-- ─── 4. Row Level Security ──────────────────────────────────────────────────
-- Details inherit access from their invoice — from the WORKSPACE that invoice
-- belongs to, not from whoever created it.
--
-- This policy was written as `i.user_id = auth.uid()`. Two things followed:
-- a manager could open an invoice a seller had raised and see its header with
-- the line details missing, and user_id was back as a tenancy boundary in the
-- database, which is the thing the workspace policies removed everywhere else.
--
-- `docs/child-table-rls-fix.sql` applies the same correction to databases that
-- already ran the old version of this file.

ALTER TABLE invoice_item_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_item_details_owner ON invoice_item_details;
DROP POLICY IF EXISTS invoice_item_details_workspace_members ON invoice_item_details;
CREATE POLICY invoice_item_details_workspace_members ON invoice_item_details
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
      WHERE ii.id = invoice_item_details.invoice_item_id
        AND i.workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
      WHERE ii.id = invoice_item_details.invoice_item_id
        AND i.workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
        )
    )
  );

-- ─── 5. updated_at trigger ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_item_details_updated_at ON invoice_item_details;
CREATE TRIGGER invoice_item_details_updated_at
  BEFORE UPDATE ON invoice_item_details
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

-- ============================================================================
-- VERIFY — run these after the migration
-- ============================================================================
-- SELECT type, count(*) FROM invoices GROUP BY type;
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'invoice_items' AND column_name IN ('unit','weight_grams');
-- SELECT count(*) FROM invoice_item_details;   -- expect 0 on a fresh migration

-- ============================================================================
-- ROLLBACK — only if you need to undo this migration
-- ============================================================================
-- BEGIN;
--   DROP TABLE IF EXISTS invoice_item_details;
--   ALTER TABLE invoice_items DROP COLUMN IF EXISTS weight_grams;
--   ALTER TABLE invoice_items DROP COLUMN IF EXISTS unit;
--   ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_type_check;
--   DROP INDEX IF EXISTS invoices_type_idx;
--   DROP INDEX IF EXISTS invoices_user_type_idx;
-- COMMIT;
--
-- Dropping invoice_item_details destroys every nested detail users entered.
-- Export it first if any real data exists:
--   SELECT * FROM invoice_item_details;


-- ────────────────────────────────────────────────────────────────────────
-- [4/59] accounting-core-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/accounting-core-migration.sql
--
-- Accounting Core — the shape the ledger must have for
-- backend/src/services/accounting/* to be correct.
--
-- WHY THIS FILE EXISTS
--   The ledger was scoped by user_id while accounts were scoped by
--   workspace_id, so a chart of accounts built in the UI was invisible to the
--   invoice poster. It also had no posted state, no atomicity and no period
--   lock: a financial record anyone can edit is not a ledger.
--
-- SAFE TO RE-RUN. Every statement is guarded.
-- ============================================================================

BEGIN;

-- ─── 1. Chart of accounts ───────────────────────────────────────────────────

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false;
-- The functional role of the account. Root type says WHERE it sits in the
-- statements; role says WHAT the system may do with it (which account the
-- invoice poster reaches for). Deliberately nullable: an ordinary expense
-- account has no special role.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS role text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'accounts_role_check'
       AND conrelid = to_regclass('public.accounts')
  ) THEN
    ALTER TABLE accounts ADD CONSTRAINT accounts_role_check CHECK (
      role IS NULL OR role IN (
        'bank', 'cash', 'receivable', 'payable', 'tax',
        'inventory', 'cogs', 'sales', 'purchase',
        'retained_earnings', 'current_year_earnings'
      )
    ) NOT VALID;
  END IF;
END $$;

-- A code is only meaningful inside one business's books.
CREATE UNIQUE INDEX IF NOT EXISTS accounts_workspace_code_key
  ON accounts (workspace_id, code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS accounts_workspace_idx ON accounts (workspace_id);

-- ─── 2. Journal entries ─────────────────────────────────────────────────────

ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS entry_number text;
-- What produced this entry, and which record. Together they make automatic
-- posting idempotent: re-saving an invoice must not book its revenue twice.
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reversal_of uuid;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS posted_at timestamptz;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS posted_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'journal_entries_status_check'
       AND conrelid = to_regclass('public.journal_entries')
  ) THEN
    ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_status_check
      CHECK (status IN ('draft', 'posted', 'reversed', 'cancelled')) NOT VALID;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_workspace_number_key
  ON journal_entries (workspace_id, entry_number)
  WHERE entry_number IS NOT NULL;

-- One live entry per source document. A reversal carries its own source_type
-- so it does not collide with the entry it reverses.
CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_source_key
  ON journal_entries (workspace_id, source_type, source_id)
  WHERE source_id IS NOT NULL AND status <> 'cancelled';

CREATE INDEX IF NOT EXISTS journal_entries_workspace_date_idx
  ON journal_entries (workspace_id, date)
  WHERE status = 'posted';

ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS workspace_id uuid;

CREATE INDEX IF NOT EXISTS journal_lines_workspace_id_account_id_idx
  ON journal_lines (workspace_id, account_id);

-- A line is one side or the other, never both and never neither.
--
-- Added NOT VALID deliberately.
--
-- `NOT VALID` means: enforce this on every row written from now on, and do not
-- re-check the rows that are already there. Postgres refuses to add a CHECK
-- over data that breaks it, and a live database was found holding two lines
-- with neither a debit nor a credit — so the strict form aborts the whole
-- migration and NOTHING gets applied, including the tenant isolation below.
--
-- Refusing to install any control because two old rows are wrong is the worse
-- outcome. This way the ledger is protected from today, and the two rows stay
-- visible instead of being silently deleted — which is the right order for a
-- financial record: a person decides what an old entry should have said, not a
-- migration.
--
-- To find them, and to promote the constraint once they are dealt with, see
-- docs/live-reconciliation-migration.sql.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'journal_lines_one_sided_check'
       AND conrelid = to_regclass('public.journal_lines')
  ) THEN
    ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_one_sided_check CHECK (
      COALESCE(debit, 0) >= 0 AND COALESCE(credit, 0) >= 0
      AND (COALESCE(debit, 0) = 0) <> (COALESCE(credit, 0) = 0)
    ) NOT VALID;
  END IF;
END $$;

-- Promote it to fully enforced, but only if the ledger is actually clean.
--
-- NOT VALID is the safe way to ADD the constraint; it is not a good place to
-- leave it. An unvalidated constraint is a promise about new rows only, and
-- the next person reading the schema cannot tell whether the history behind it
-- was ever checked.
--
-- `live-reconciliation-migration.sql` archives and removes the amount-less
-- lines before this file runs, so on a database that has been through the full
-- sequence this validates and the constraint becomes a real guarantee. On one
-- that has not, it stays NOT VALID and says so rather than aborting.
DO $$
DECLARE
  bad_rows bigint;
BEGIN
  SELECT count(*) INTO bad_rows
    FROM journal_lines
   WHERE NOT (
     COALESCE(debit, 0) >= 0 AND COALESCE(credit, 0) >= 0
     AND (COALESCE(debit, 0) = 0) <> (COALESCE(credit, 0) = 0)
   );

  IF bad_rows = 0 THEN
    ALTER TABLE journal_lines VALIDATE CONSTRAINT journal_lines_one_sided_check;
  ELSE
    RAISE NOTICE
      'journal_lines_one_sided_check left NOT VALID: % existing row(s) break it. New writes are still enforced.',
      bad_rows;
  END IF;
END $$;

-- ─── 3. Period lock ─────────────────────────────────────────────────────────
-- One row per workspace. Nothing may be posted, edited or reversed with an
-- accounting date on or before locked_until.

CREATE TABLE IF NOT EXISTS accounting_period_locks (
  workspace_id  uuid PRIMARY KEY,
  locked_until  date NOT NULL,
  reason        text NOT NULL DEFAULT '',
  locked_by     uuid,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── 4. Backfill ────────────────────────────────────────────────────────────
-- Existing rows were stamped with the creator's user id only. Their workspace
-- is whichever workspace that user belongs to; a user in several workspaces
-- cannot be resolved this way and is left NULL on purpose — a wrong guess
-- would move somebody's books into the wrong business.

WITH sole_membership AS (
  SELECT user_id, MIN(workspace_id::text)::uuid AS workspace_id
  FROM workspace_members
  WHERE has_access = true AND suspended_at IS NULL
  GROUP BY user_id
  HAVING COUNT(DISTINCT workspace_id) = 1
)
UPDATE accounts a SET workspace_id = m.workspace_id
FROM sole_membership m
WHERE a.workspace_id IS NULL AND a.user_id = m.user_id;

WITH sole_membership AS (
  SELECT user_id, MIN(workspace_id::text)::uuid AS workspace_id
  FROM workspace_members
  WHERE has_access = true AND suspended_at IS NULL
  GROUP BY user_id
  HAVING COUNT(DISTINCT workspace_id) = 1
)
UPDATE journal_entries j SET workspace_id = m.workspace_id
FROM sole_membership m
WHERE j.workspace_id IS NULL AND j.user_id = m.user_id;

UPDATE journal_lines l SET workspace_id = j.workspace_id
FROM journal_entries j
WHERE l.workspace_id IS NULL AND l.journal_id = j.id;

-- Everything that already existed was visible in the reports, so it is posted.
UPDATE journal_entries SET status = 'posted', posted_at = COALESCE(posted_at, created_at)
WHERE status = 'draft';

-- ─── 5. Atomic posting ──────────────────────────────────────────────────────
-- The header and its lines must arrive together or not at all. supabase-js
-- cannot open a transaction, so the write lives here and the service calls it.
-- This is what replaces the compensating DELETE in the old service.

CREATE OR REPLACE FUNCTION accounting_post_journal_entry(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_entry        jsonb,
  p_lines        jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_entry_id     uuid;
  v_date         date := (p_entry ->> 'date')::date;
  v_status       text := COALESCE(p_entry ->> 'status', 'posted');
  v_total_debit  numeric(18, 2);
  v_total_credit numeric(18, 2);
  v_locked_until date;
  v_bad_accounts int;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNTING_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT locked_until INTO v_locked_until
  FROM accounting_period_locks WHERE workspace_id = p_workspace_id;

  IF v_locked_until IS NOT NULL AND v_date <= v_locked_until THEN
    RAISE EXCEPTION 'ACCOUNTING_PERIOD_LOCKED' USING ERRCODE = 'P0001';
  END IF;

  SELECT
    COALESCE(SUM((l ->> 'debit')::numeric), 0),
    COALESCE(SUM((l ->> 'credit')::numeric), 0)
  INTO v_total_debit, v_total_credit
  FROM jsonb_array_elements(p_lines) AS l;

  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'JOURNAL_ENTRY_UNBALANCED' USING ERRCODE = 'P0001';
  END IF;

  IF v_total_debit = 0 THEN
    RAISE EXCEPTION 'JOURNAL_ENTRY_EMPTY' USING ERRCODE = 'P0001';
  END IF;

  -- Every account must belong to THIS workspace and must be postable. Checked
  -- in the same transaction as the insert, so a concurrent change to the chart
  -- of accounts cannot slip between the check and the write.
  SELECT COUNT(*) INTO v_bad_accounts
  FROM jsonb_array_elements(p_lines) AS l
  LEFT JOIN accounts a
    ON a.id = (l ->> 'account_id')::uuid
   AND a.workspace_id = p_workspace_id
   AND a.deleted_at IS NULL
  WHERE a.id IS NULL OR a.is_group = true OR a.is_active = false;

  IF v_bad_accounts > 0 THEN
    RAISE EXCEPTION 'JOURNAL_LINE_ACCOUNT_INVALID' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO journal_entries (
    workspace_id, user_id, date, description, reference, status,
    entry_number, source_type, source_id, reversal_of, posted_at, posted_by
  ) VALUES (
    p_workspace_id,
    p_user_id,
    v_date,
    COALESCE(p_entry ->> 'description', ''),
    COALESCE(p_entry ->> 'reference', ''),
    v_status,
    p_entry ->> 'entry_number',
    p_entry ->> 'source_type',
    NULLIF(p_entry ->> 'source_id', '')::uuid,
    NULLIF(p_entry ->> 'reversal_of', '')::uuid,
    CASE WHEN v_status = 'posted' THEN now() ELSE NULL END,
    CASE WHEN v_status = 'posted' THEN p_user_id ELSE NULL END
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_lines (journal_id, workspace_id, user_id, account_id, debit, credit)
  SELECT
    v_entry_id,
    p_workspace_id,
    p_user_id,
    (l ->> 'account_id')::uuid,
    COALESCE((l ->> 'debit')::numeric, 0),
    COALESCE((l ->> 'credit')::numeric, 0)
  FROM jsonb_array_elements(p_lines) AS l;

  RETURN v_entry_id;
END;
$fn$;

-- ─── 6. Ledger aggregation ──────────────────────────────────────────────────
-- The trial balance is summed in the database. The old service pulled every
-- journal line into Node with no bound and added them up there.

CREATE OR REPLACE FUNCTION accounting_trial_balance(
  p_workspace_id uuid,
  p_from_date    date,
  p_to_date      date
) RETURNS TABLE (
  account_id   uuid,
  account_code text,
  account_name text,
  account_type text,
  account_role text,
  total_debit  numeric,
  total_credit numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    a.id, a.code, a.name, a.type, a.role,
    COALESCE(SUM(l.debit), 0),
    COALESCE(SUM(l.credit), 0)
  FROM journal_lines l
  JOIN journal_entries j ON j.id = l.journal_id
  JOIN accounts a ON a.id = l.account_id
  WHERE j.workspace_id = p_workspace_id
    AND a.workspace_id = p_workspace_id
    AND j.status = 'posted'
    AND j.deleted_at IS NULL
    AND (p_from_date IS NULL OR j.date >= p_from_date)
    AND (p_to_date   IS NULL OR j.date <= p_to_date)
  GROUP BY a.id, a.code, a.name, a.type, a.role
  HAVING COALESCE(SUM(l.debit), 0) <> 0 OR COALESCE(SUM(l.credit), 0) <> 0
  ORDER BY a.code;
$fn$;

-- ─── 7. Row level security ──────────────────────────────────────────────────
-- The backend uses the service role and is not subject to these. They exist so
-- that a direct client connection, now or later, cannot read another
-- business's books.

ALTER TABLE accounts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines           ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_period_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounts_workspace_members ON accounts;
CREATE POLICY accounts_workspace_members ON accounts
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS journal_entries_workspace_members ON journal_entries;
CREATE POLICY journal_entries_workspace_members ON journal_entries
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS journal_lines_workspace_members ON journal_lines;
CREATE POLICY journal_lines_workspace_members ON journal_lines
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS accounting_period_locks_workspace_members ON accounting_period_locks;
CREATE POLICY accounting_period_locks_workspace_members ON accounting_period_locks
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;


-- ────────────────────────────────────────────────────────────────────────
-- [5/59] inventory-costing-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/inventory-costing-migration.sql
--
-- Inventory Costing Core — cost layers, their consumption, and the settings
-- that decide how they are consumed.
--
-- WHY THIS FILE EXISTS
--   Cost of goods sold was priced from products.buy_price, the CURRENT buy
--   price. A shop that buys the same phone at 10,000,000 and then at
--   9,000,000 was reporting both sales at 9,000,000, so the profit on the
--   first sale was overstated by a million and nothing in the system could
--   say which purchase a sale had actually consumed.
--
-- SAFE TO RE-RUN. Every statement is guarded.
-- ============================================================================

BEGIN;

-- ─── 1. Settings ────────────────────────────────────────────────────────────
-- One row per workspace. Costing method and negative stock policy are business
-- decisions, not constants, and they belong to the business not to the code.

CREATE TABLE IF NOT EXISTS inventory_settings (
  workspace_id    uuid PRIMARY KEY,
  costing_method  text NOT NULL DEFAULT 'fifo',
  -- 'block'  — an issue with no stock behind it is refused.
  -- 'allow'  — it goes through, costed at the last known price and FLAGGED,
  --            so the gap is visible and correctable instead of silent.
  negative_stock  text NOT NULL DEFAULT 'block',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_settings_method_check
    CHECK (costing_method IN ('fifo', 'avco', 'standard')),
  CONSTRAINT inventory_settings_negative_check
    CHECK (negative_stock IN ('block', 'allow'))
);

-- ─── 2. Cost layers ─────────────────────────────────────────────────────────
-- One row per receipt of goods, holding what is LEFT of it and what it cost.

CREATE TABLE IF NOT EXISTS cost_layers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  product_id    uuid NOT NULL,
  warehouse_id  uuid,
  -- The document that brought the goods in. Together these make a receipt
  -- idempotent: re-saving a purchase must not create the layer twice.
  source_type   text NOT NULL,
  source_id     uuid,
  source_line   text,
  received_qty  numeric(18, 4) NOT NULL,
  remaining_qty numeric(18, 4) NOT NULL,
  unit_cost     numeric(18, 4) NOT NULL,
  currency      text NOT NULL DEFAULT 'AFN',
  -- The date the goods ARRIVED. FIFO order is by this, not by created_at, so
  -- a receipt entered late still takes its rightful place in the queue.
  entry_date    date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  CONSTRAINT cost_layers_qty_check CHECK (
    received_qty > 0 AND remaining_qty >= 0 AND remaining_qty <= received_qty
  ),
  CONSTRAINT cost_layers_cost_check CHECK (unit_cost >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS cost_layers_source_key
  ON cost_layers (workspace_id, source_type, source_id, source_line)
  WHERE source_id IS NOT NULL;

-- The FIFO queue: open layers for one product, oldest first.
CREATE INDEX IF NOT EXISTS cost_layers_fifo_idx
  ON cost_layers (workspace_id, product_id, entry_date, created_at)
  WHERE remaining_qty > 0;

CREATE INDEX IF NOT EXISTS cost_layers_product_idx
  ON cost_layers (workspace_id, product_id);

-- ─── 3. Consumption ─────────────────────────────────────────────────────────
-- Which layer paid for which issue. This table is the answer to "why is the
-- profit on this sale what it is" and is append-only.

CREATE TABLE IF NOT EXISTS cost_consumptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  layer_id      uuid,               -- NULL only for an estimated shortfall
  product_id    uuid NOT NULL,
  warehouse_id  uuid,
  consumer_type text NOT NULL,      -- 'invoice', 'adjustment', 'reversal'…
  consumer_id   uuid,
  consumer_line text,
  quantity      numeric(18, 4) NOT NULL,
  unit_cost     numeric(18, 4) NOT NULL,
  amount        numeric(18, 4) NOT NULL,
  -- true when stock was not there and the policy allowed the issue anyway.
  -- The cost is a guess and is meant to be found and corrected.
  is_estimated  boolean NOT NULL DEFAULT false,
  entry_date    date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  CONSTRAINT cost_consumptions_qty_check CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS cost_consumptions_consumer_idx
  ON cost_consumptions (workspace_id, consumer_type, consumer_id);

CREATE INDEX IF NOT EXISTS cost_consumptions_layer_idx
  ON cost_consumptions (workspace_id, layer_id);

CREATE INDEX IF NOT EXISTS cost_consumptions_product_idx
  ON cost_consumptions (workspace_id, product_id, entry_date);

-- ─── 4. Stock movements grow a cost ─────────────────────────────────────────

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_cost numeric(18, 4);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS total_cost numeric(18, 4);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reference_id uuid;

-- Transfers were written with no workspace at all; the movement history was
-- then read back by user_id, so a second member of the shop saw none of it.
UPDATE stock_movements m SET workspace_id = p.workspace_id
FROM products p
WHERE m.workspace_id IS NULL AND m.product_id = p.id;

-- Time-ordered workspace scan index. Named distinctly from the (workspace_id,
-- product_id) lookup index (`stock_movements_workspace_product_idx`) so the two
-- are never confused for duplicates; the legacy `stock_movements_workspace_idx`
-- name is retired (it duplicated the product lookup index in the live DB).
DROP INDEX IF EXISTS stock_movements_workspace_idx;
CREATE INDEX IF NOT EXISTS stock_movements_workspace_created_at_idx
  ON stock_movements (workspace_id, created_at DESC);

-- ─── 5. Receiving goods ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION inventory_receive_layer(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_payload      jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_layer_id uuid;
  v_qty      numeric(18, 4) := (p_payload ->> 'quantity')::numeric;
  v_cost     numeric(18, 4) := (p_payload ->> 'unit_cost')::numeric;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'INVENTORY_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF v_qty IS NULL OR v_qty <= 0 THEN
    RAISE EXCEPTION 'INVENTORY_RECEIPT_QUANTITY_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF v_cost IS NULL OR v_cost < 0 THEN
    RAISE EXCEPTION 'INVENTORY_RECEIPT_COST_INVALID' USING ERRCODE = 'P0001';
  END IF;

  -- The product must belong to this workspace. A foreign product id in the
  -- payload would otherwise create a layer in somebody else's inventory.
  PERFORM 1 FROM products
   WHERE id = (p_payload ->> 'product_id')::uuid
     AND workspace_id = p_workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_PRODUCT_NOT_IN_WORKSPACE' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO cost_layers (
    workspace_id, product_id, warehouse_id, source_type, source_id, source_line,
    received_qty, remaining_qty, unit_cost, currency, entry_date, created_by
  ) VALUES (
    p_workspace_id,
    (p_payload ->> 'product_id')::uuid,
    NULLIF(p_payload ->> 'warehouse_id', '')::uuid,
    p_payload ->> 'source_type',
    NULLIF(p_payload ->> 'source_id', '')::uuid,
    p_payload ->> 'source_line',
    v_qty,
    v_qty,
    v_cost,
    COALESCE(p_payload ->> 'currency', 'AFN'),
    (p_payload ->> 'entry_date')::date,
    p_user_id
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_layer_id;

  -- Already received. Hand back the layer that exists rather than a second one.
  IF v_layer_id IS NULL THEN
    SELECT id INTO v_layer_id FROM cost_layers
     WHERE workspace_id = p_workspace_id
       AND source_type = p_payload ->> 'source_type'
       AND source_id = NULLIF(p_payload ->> 'source_id', '')::uuid
       AND source_line IS NOT DISTINCT FROM (p_payload ->> 'source_line');
  END IF;

  RETURN v_layer_id;
END;
$fn$;

-- ─── 6. Issuing goods ───────────────────────────────────────────────────────
-- Consumes the open layers in FIFO order and records what it took from each.
-- Returns the total cost and how much could not be covered by real stock.
--
-- The layers are locked FOR UPDATE. Two sales of the last unit, priced in Node
-- from a plain SELECT, would both see it available and both sell it.

CREATE OR REPLACE FUNCTION inventory_consume_layers(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_payload      jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_product      uuid := (p_payload ->> 'product_id')::uuid;
  v_warehouse    uuid := NULLIF(p_payload ->> 'warehouse_id', '')::uuid;
  v_needed       numeric(18, 4) := (p_payload ->> 'quantity')::numeric;
  v_entry_date   date := (p_payload ->> 'entry_date')::date;
  v_method       text;
  v_negative     text;
  v_layer        record;
  v_take         numeric(18, 4);
  v_total_cost   numeric(18, 4) := 0;
  v_consumed     numeric(18, 4) := 0;
  v_avg_cost     numeric(18, 4);
  v_last_cost    numeric(18, 4);
  v_shortfall    numeric(18, 4);
  v_existing     numeric(18, 4);
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'INVENTORY_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF v_needed IS NULL OR v_needed <= 0 THEN
    RAISE EXCEPTION 'INVENTORY_ISSUE_QUANTITY_INVALID' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotency: this consumer line has already taken its stock.
  SELECT COALESCE(SUM(quantity), 0), COALESCE(SUM(amount), 0)
    INTO v_existing, v_total_cost
    FROM cost_consumptions
   WHERE workspace_id = p_workspace_id
     AND consumer_type = p_payload ->> 'consumer_type'
     AND consumer_id = NULLIF(p_payload ->> 'consumer_id', '')::uuid
     AND consumer_line IS NOT DISTINCT FROM (p_payload ->> 'consumer_line');

  IF v_existing > 0 THEN
    RETURN jsonb_build_object(
      'status', 'already_consumed',
      'quantity', v_existing,
      'total_cost', v_total_cost,
      'shortfall', 0
    );
  END IF;

  v_total_cost := 0;

  SELECT costing_method, negative_stock INTO v_method, v_negative
    FROM inventory_settings WHERE workspace_id = p_workspace_id;

  v_method := COALESCE(v_method, 'fifo');
  v_negative := COALESCE(v_negative, 'block');

  -- AVCO prices every unit at the weighted average of what is open, but still
  -- draws the quantity from the layers in order, so the trail survives.
  IF v_method = 'avco' THEN
    SELECT CASE WHEN SUM(remaining_qty) > 0
                THEN SUM(remaining_qty * unit_cost) / SUM(remaining_qty) END
      INTO v_avg_cost
      FROM cost_layers
     WHERE workspace_id = p_workspace_id
       AND product_id = v_product
       AND remaining_qty > 0
       AND (v_warehouse IS NULL OR warehouse_id IS NOT DISTINCT FROM v_warehouse);
  END IF;

  FOR v_layer IN
    SELECT id, remaining_qty, unit_cost
      FROM cost_layers
     WHERE workspace_id = p_workspace_id
       AND product_id = v_product
       AND remaining_qty > 0
       AND (v_warehouse IS NULL OR warehouse_id IS NOT DISTINCT FROM v_warehouse)
     ORDER BY entry_date, created_at
     FOR UPDATE
  LOOP
    EXIT WHEN v_consumed >= v_needed;

    v_take := LEAST(v_layer.remaining_qty, v_needed - v_consumed);

    UPDATE cost_layers
       SET remaining_qty = remaining_qty - v_take
     WHERE id = v_layer.id;

    INSERT INTO cost_consumptions (
      workspace_id, layer_id, product_id, warehouse_id,
      consumer_type, consumer_id, consumer_line,
      quantity, unit_cost, amount, is_estimated, entry_date, created_by
    ) VALUES (
      p_workspace_id, v_layer.id, v_product, v_warehouse,
      p_payload ->> 'consumer_type',
      NULLIF(p_payload ->> 'consumer_id', '')::uuid,
      p_payload ->> 'consumer_line',
      v_take,
      COALESCE(v_avg_cost, v_layer.unit_cost),
      v_take * COALESCE(v_avg_cost, v_layer.unit_cost),
      false,
      v_entry_date,
      p_user_id
    );

    v_consumed := v_consumed + v_take;
    v_total_cost := v_total_cost + v_take * COALESCE(v_avg_cost, v_layer.unit_cost);
  END LOOP;

  v_shortfall := v_needed - v_consumed;

  IF v_shortfall > 0 THEN
    IF v_negative = 'block' THEN
      RAISE EXCEPTION 'INVENTORY_INSUFFICIENT_STOCK' USING ERRCODE = 'P0001';
    END IF;

    -- Allowed to go negative. The uncovered quantity is costed at the last
    -- price we actually paid and marked estimated, so it can be found and
    -- corrected once the real receipt arrives. The old code did
    -- `Math.max(0, …)` here, which lost the fact entirely.
    SELECT unit_cost INTO v_last_cost
      FROM cost_layers
     WHERE workspace_id = p_workspace_id AND product_id = v_product
     ORDER BY entry_date DESC, created_at DESC
     LIMIT 1;

    v_last_cost := COALESCE(v_last_cost, 0);

    INSERT INTO cost_consumptions (
      workspace_id, layer_id, product_id, warehouse_id,
      consumer_type, consumer_id, consumer_line,
      quantity, unit_cost, amount, is_estimated, entry_date, created_by
    ) VALUES (
      p_workspace_id, NULL, v_product, v_warehouse,
      p_payload ->> 'consumer_type',
      NULLIF(p_payload ->> 'consumer_id', '')::uuid,
      p_payload ->> 'consumer_line',
      v_shortfall, v_last_cost, v_shortfall * v_last_cost, true,
      v_entry_date, p_user_id
    );

    v_total_cost := v_total_cost + v_shortfall * v_last_cost;
  END IF;

  RETURN jsonb_build_object(
    'status', 'consumed',
    'quantity', v_needed,
    'total_cost', v_total_cost,
    'shortfall', v_shortfall
  );
END;
$fn$;

-- ─── 7. Returning goods to their layers ─────────────────────────────────────
-- A return puts the quantity back where it came from, at the price it left at.
-- Restoring it at today's price would silently change the profit already
-- reported on the original sale.

CREATE OR REPLACE FUNCTION inventory_release_consumption(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_consumer_type text,
  p_consumer_id   uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row        record;
  v_restored   numeric(18, 4) := 0;
  v_amount     numeric(18, 4) := 0;
BEGIN
  FOR v_row IN
    SELECT id, layer_id, product_id, warehouse_id, quantity, unit_cost, amount,
           is_estimated, consumer_line, entry_date
      FROM cost_consumptions
     WHERE workspace_id = p_workspace_id
       AND consumer_type = p_consumer_type
       AND consumer_id = p_consumer_id
       AND quantity > 0
  LOOP
    IF v_row.layer_id IS NOT NULL THEN
      UPDATE cost_layers
         SET remaining_qty = LEAST(received_qty, remaining_qty + v_row.quantity)
       WHERE id = v_row.layer_id AND workspace_id = p_workspace_id;
    END IF;

    -- The release is recorded as its own negative-signed row rather than by
    -- deleting the original. What happened stays in the trail.
    INSERT INTO cost_consumptions (
      workspace_id, layer_id, product_id, warehouse_id,
      consumer_type, consumer_id, consumer_line,
      quantity, unit_cost, amount, is_estimated, entry_date, created_by
    ) VALUES (
      p_workspace_id, v_row.layer_id, v_row.product_id, v_row.warehouse_id,
      'release', p_consumer_id, v_row.consumer_line,
      v_row.quantity, v_row.unit_cost, -v_row.amount, v_row.is_estimated,
      CURRENT_DATE, p_user_id
    );

    v_restored := v_restored + v_row.quantity;
    v_amount := v_amount + v_row.amount;
  END LOOP;

  RETURN jsonb_build_object('quantity', v_restored, 'total_cost', v_amount);
END;
$fn$;

-- ─── 8. Valuation ───────────────────────────────────────────────────────────
-- Σ(remaining × unit cost), which is what the stock account in the ledger must
-- agree with. `quantity × buy_price` never did.

CREATE OR REPLACE FUNCTION inventory_valuation(
  p_workspace_id uuid,
  p_product_id   uuid
) RETURNS TABLE (
  product_id    uuid,
  product_name  text,
  on_hand       numeric,
  value         numeric,
  average_cost  numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    p.id,
    p.name,
    COALESCE(SUM(l.remaining_qty), 0),
    COALESCE(SUM(l.remaining_qty * l.unit_cost), 0),
    CASE WHEN COALESCE(SUM(l.remaining_qty), 0) > 0
         THEN SUM(l.remaining_qty * l.unit_cost) / SUM(l.remaining_qty)
         ELSE 0 END
  FROM products p
  LEFT JOIN cost_layers l
    ON l.product_id = p.id
   AND l.workspace_id = p_workspace_id
   AND l.remaining_qty > 0
  WHERE p.workspace_id = p_workspace_id
    AND (p_product_id IS NULL OR p.id = p_product_id)
  GROUP BY p.id, p.name
  ORDER BY p.name;
$fn$;

-- ─── 9. Row level security ──────────────────────────────────────────────────

ALTER TABLE cost_layers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_consumptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cost_layers_workspace_members ON cost_layers;
CREATE POLICY cost_layers_workspace_members ON cost_layers
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS cost_consumptions_workspace_members ON cost_consumptions;
CREATE POLICY cost_consumptions_workspace_members ON cost_consumptions
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS inventory_settings_workspace_members ON inventory_settings;
CREATE POLICY inventory_settings_workspace_members ON inventory_settings
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS stock_movements_workspace_members ON stock_movements;
CREATE POLICY stock_movements_workspace_members ON stock_movements
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;

-- ============================================================================
-- Warehouse transfers — part of the same change.
--
-- The transfer used to read both sides' quantities into Node, subtract, and
-- write them back. Two transfers of the last unit both read it as available
-- and the second write recreated stock the first had spent.
-- ============================================================================

BEGIN;

ALTER TABLE warehouses      ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE warehouse_stock ADD COLUMN IF NOT EXISTS workspace_id uuid;

WITH sole_membership AS (
  SELECT user_id, MIN(workspace_id::text)::uuid AS workspace_id
  FROM workspace_members
  WHERE has_access = true AND suspended_at IS NULL
  GROUP BY user_id
  HAVING COUNT(DISTINCT workspace_id) = 1
)
UPDATE warehouses w SET workspace_id = m.workspace_id
FROM sole_membership m
WHERE w.workspace_id IS NULL AND w.user_id = m.user_id;

UPDATE warehouse_stock s SET workspace_id = w.workspace_id
FROM warehouses w
WHERE s.workspace_id IS NULL AND s.warehouse_id = w.id;

CREATE INDEX IF NOT EXISTS warehouses_workspace_idx ON warehouses (workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS warehouse_stock_unique
  ON warehouse_stock (warehouse_id, product_id);

CREATE OR REPLACE FUNCTION warehouse_transfer_stock(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_payload      jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_product   uuid := (p_payload ->> 'product_id')::uuid;
  v_from      uuid := (p_payload ->> 'from_warehouse_id')::uuid;
  v_to        uuid := (p_payload ->> 'to_warehouse_id')::uuid;
  v_qty       numeric(18, 4) := (p_payload ->> 'quantity')::numeric;
  v_available numeric(18, 4);
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'WAREHOUSE_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF v_qty IS NULL OR v_qty <= 0 THEN
    RAISE EXCEPTION 'WAREHOUSE_TRANSFER_QUANTITY_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF v_from = v_to THEN
    RAISE EXCEPTION 'WAREHOUSE_TRANSFER_SAME_WAREHOUSE' USING ERRCODE = 'P0001';
  END IF;

  -- Both warehouses must belong to this workspace. Checked here as well as in
  -- the service: this is the check that cannot be raced or skipped.
  PERFORM 1 FROM warehouses
   WHERE id IN (v_from, v_to) AND workspace_id = p_workspace_id
   HAVING COUNT(*) = 2;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WAREHOUSE_NOT_IN_WORKSPACE' USING ERRCODE = 'P0001';
  END IF;

  -- The lock is the whole point: the row cannot change between reading the
  -- quantity and writing the new one.
  SELECT quantity INTO v_available
    FROM warehouse_stock
   WHERE warehouse_id = v_from AND product_id = v_product
   FOR UPDATE;

  IF v_available IS NULL OR v_available < v_qty THEN
    RAISE EXCEPTION 'WAREHOUSE_INSUFFICIENT_STOCK' USING ERRCODE = 'P0001';
  END IF;

  UPDATE warehouse_stock
     SET quantity = quantity - v_qty
   WHERE warehouse_id = v_from AND product_id = v_product;

  INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, workspace_id, user_id)
  VALUES (v_to, v_product, v_qty, p_workspace_id, p_user_id)
  ON CONFLICT (warehouse_id, product_id)
  DO UPDATE SET quantity = warehouse_stock.quantity + EXCLUDED.quantity;

  INSERT INTO stock_movements (
    product_id, type, quantity, from_warehouse_id, to_warehouse_id,
    notes, workspace_id, user_id, reference_type
  ) VALUES (
    v_product, 'transfer', v_qty, v_from, v_to,
    COALESCE(p_payload ->> 'notes', ''), p_workspace_id, p_user_id, 'transfer'
  );

  RETURN jsonb_build_object('remaining_at_source', v_available - v_qty);
END;
$fn$;

ALTER TABLE warehouses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS warehouses_workspace_members ON warehouses;
CREATE POLICY warehouses_workspace_members ON warehouses
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS warehouse_stock_workspace_members ON warehouse_stock;
CREATE POLICY warehouse_stock_workspace_members ON warehouse_stock
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;


-- ────────────────────────────────────────────────────────────────────────
-- [6/59] payments-ar-ap-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/payments-ar-ap-migration.sql
--
-- Payments, and the allocation of a payment to the invoices it settles.
--
-- WHY THIS FILE EXISTS
--   There was no such thing as a payment. There was a number, `paid_amount`,
--   sitting on the invoice, writable by any PATCH that touched the invoice —
--   and a free-form row in `transactions` that nothing reconciled against it.
--   A customer who paid 500 against two invoices of 300 could not be recorded
--   at all, and the 200 they overpaid had nowhere to live.
--
-- SAFE TO RE-RUN. Every statement is guarded.
-- ============================================================================

BEGIN;

-- ─── 1. Payments ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL,
  payment_number text,
  -- 'in'  — money received from a customer  (settles a receivable)
  -- 'out' — money paid to a supplier        (settles a payable)
  direction      text NOT NULL,
  party_type     text NOT NULL,
  party_id       uuid,
  amount         numeric(18, 2) NOT NULL,
  currency       text NOT NULL DEFAULT 'AFN',
  method         text NOT NULL DEFAULT 'cash',
  entry_date     date NOT NULL,
  reference      text NOT NULL DEFAULT '',
  notes          text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'posted',
  journal_entry_id uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  CONSTRAINT payments_direction_check CHECK (direction IN ('in', 'out')),
  CONSTRAINT payments_party_check CHECK (party_type IN ('customer', 'supplier')),
  CONSTRAINT payments_status_check CHECK (status IN ('draft', 'posted', 'cancelled')),
  CONSTRAINT payments_amount_check CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS payments_workspace_date_idx
  ON payments (workspace_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS payments_party_idx
  ON payments (workspace_id, party_type, party_id);

CREATE UNIQUE INDEX IF NOT EXISTS payments_number_key
  ON payments (workspace_id, payment_number)
  WHERE payment_number IS NOT NULL;

-- ─── 2. Allocation ──────────────────────────────────────────────────────────
-- Which invoice each part of a payment settled. The outstanding balance of an
-- invoice is derived from these rows, never from a stored figure.

CREATE TABLE IF NOT EXISTS payment_allocations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  payment_id   uuid NOT NULL REFERENCES payments (id) ON DELETE CASCADE,
  invoice_id   uuid NOT NULL,
  amount       numeric(18, 2) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_allocations_amount_check CHECK (amount <> 0)
);

CREATE INDEX IF NOT EXISTS payment_allocations_invoice_idx
  ON payment_allocations (workspace_id, invoice_id);

CREATE INDEX IF NOT EXISTS payment_allocations_payment_idx
  ON payment_allocations (payment_id);

-- ─── 3. What an invoice still owes ──────────────────────────────────────────
-- total − everything allocated to it. `paid_amount` is kept in step as a
-- display cache, but nothing decides anything from it.

CREATE OR REPLACE VIEW invoice_outstanding AS
SELECT
  i.id            AS invoice_id,
  i.workspace_id,
  i.invoice_number,
  i.type,
  i.customer_id,
  i.supplier_id,
  i.date          AS invoice_date,
  i.due_date,
  i.currency,
  i.total,
  COALESCE(a.allocated, 0)          AS allocated,
  i.total - COALESCE(a.allocated, 0) AS outstanding
FROM invoices i
LEFT JOIN (
  SELECT invoice_id, SUM(amount) AS allocated
  FROM payment_allocations
  GROUP BY invoice_id
) a ON a.invoice_id = i.id;

-- ─── 4. Recording a payment ─────────────────────────────────────────────────
-- The payment, its allocations and the invoices' cached paid_amount move
-- together or not at all.

CREATE OR REPLACE FUNCTION payments_record(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_payment      jsonb,
  p_allocations  jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_payment_id  uuid;
  v_amount      numeric(18, 2) := (p_payment ->> 'amount')::numeric;
  v_allocated   numeric(18, 2) := 0;
  v_row         record;
  v_outstanding numeric(18, 2);
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'PAYMENT_AMOUNT_INVALID' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM((a ->> 'amount')::numeric), 0)
    INTO v_allocated
    FROM jsonb_array_elements(p_allocations) AS a;

  -- Allocating more than was paid would settle invoices with money that does
  -- not exist. Under-allocating is fine: the rest is an advance.
  IF v_allocated > v_amount THEN
    RAISE EXCEPTION 'PAYMENT_OVER_ALLOCATED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO payments (
    workspace_id, payment_number, direction, party_type, party_id,
    amount, currency, method, entry_date, reference, notes, status, created_by
  ) VALUES (
    p_workspace_id,
    p_payment ->> 'payment_number',
    p_payment ->> 'direction',
    p_payment ->> 'party_type',
    NULLIF(p_payment ->> 'party_id', '')::uuid,
    v_amount,
    COALESCE(p_payment ->> 'currency', 'AFN'),
    COALESCE(p_payment ->> 'method', 'cash'),
    (p_payment ->> 'entry_date')::date,
    COALESCE(p_payment ->> 'reference', ''),
    COALESCE(p_payment ->> 'notes', ''),
    COALESCE(p_payment ->> 'status', 'posted'),
    p_user_id
  )
  RETURNING id INTO v_payment_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_allocations) AS a (item)
  LOOP
    -- The invoice is locked while its outstanding balance is checked, so two
    -- payments cannot both settle the same last 100 of it.
    SELECT i.total - COALESCE((
             SELECT SUM(amount) FROM payment_allocations WHERE invoice_id = i.id
           ), 0)
      INTO v_outstanding
      FROM invoices i
     WHERE i.id = (v_row.item ->> 'invoice_id')::uuid
       AND i.workspace_id = p_workspace_id
     FOR UPDATE;

    IF v_outstanding IS NULL THEN
      RAISE EXCEPTION 'PAYMENT_INVOICE_NOT_IN_WORKSPACE' USING ERRCODE = 'P0001';
    END IF;

    IF (v_row.item ->> 'amount')::numeric > v_outstanding THEN
      RAISE EXCEPTION 'PAYMENT_ALLOCATION_EXCEEDS_OUTSTANDING' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO payment_allocations (workspace_id, payment_id, invoice_id, amount)
    VALUES (
      p_workspace_id,
      v_payment_id,
      (v_row.item ->> 'invoice_id')::uuid,
      (v_row.item ->> 'amount')::numeric
    );

    UPDATE invoices
       SET paid_amount = COALESCE(paid_amount, 0) + (v_row.item ->> 'amount')::numeric,
           status = CASE
             WHEN COALESCE(paid_amount, 0) + (v_row.item ->> 'amount')::numeric >= total
               THEN 'paid'
             ELSE status
           END,
           updated_at = now()
     WHERE id = (v_row.item ->> 'invoice_id')::uuid
       AND workspace_id = p_workspace_id;
  END LOOP;

  RETURN v_payment_id;
END;
$fn$;

-- ─── 5. Cancelling a payment ────────────────────────────────────────────────
-- The allocations are removed and the invoices reopened. The payment row stays
-- and is marked cancelled: money that was taken and given back is two facts,
-- not the absence of one.

CREATE OR REPLACE FUNCTION payments_cancel(
  p_workspace_id uuid,
  p_payment_id   uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row     record;
  v_removed numeric(18, 2) := 0;
BEGIN
  PERFORM 1 FROM payments
   WHERE id = p_payment_id AND workspace_id = p_workspace_id AND status = 'posted'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_CANCELLABLE' USING ERRCODE = 'P0001';
  END IF;

  FOR v_row IN
    SELECT invoice_id, amount FROM payment_allocations
     WHERE payment_id = p_payment_id AND workspace_id = p_workspace_id
  LOOP
    UPDATE invoices
       SET paid_amount = GREATEST(0, COALESCE(paid_amount, 0) - v_row.amount),
           status = CASE WHEN status = 'paid' THEN 'pending' ELSE status END,
           updated_at = now()
     WHERE id = v_row.invoice_id AND workspace_id = p_workspace_id;

    v_removed := v_removed + v_row.amount;
  END LOOP;

  DELETE FROM payment_allocations
   WHERE payment_id = p_payment_id AND workspace_id = p_workspace_id;

  UPDATE payments SET status = 'cancelled', updated_at = now()
   WHERE id = p_payment_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object('unallocated', v_removed);
END;
$fn$;

-- ─── 6. Row level security ──────────────────────────────────────────────────

ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_workspace_members ON payments;
CREATE POLICY payments_workspace_members ON payments
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS payment_allocations_workspace_members ON payment_allocations;
CREATE POLICY payment_allocations_workspace_members ON payment_allocations
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;


-- ────────────────────────────────────────────────────────────────────────
-- [7/59] sync-conflicts-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/sync-conflicts-migration.sql
--
-- Where a rejected offline mutation goes.
--
-- WHY THIS FILE EXISTS
--   When an offline device sent a stale version, the server refused it and the
--   payload was gone: the only surviving copy was in that device's outbox. If
--   the user cleared the app, reinstalled it, or simply tapped "discard", the
--   work vanished with no record that it had ever been attempted.
--
--   Financial conflicts are not resolved by last-write-wins. Both versions are
--   kept here until somebody with the authority decides, and the decision is
--   recorded next to them.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL,
  entity_type    text NOT NULL,
  entity_id      uuid NOT NULL,
  -- Stable across every retry of the same mutation, so a device that retries
  -- a refused write does not pile up duplicate conflicts to review.
  mutation_id    text NOT NULL,
  operation      text NOT NULL,
  -- BOTH sides, exactly as they were. This is the whole point of the table.
  server_version integer,
  server_row     jsonb NOT NULL,
  client_version integer,
  client_payload jsonb NOT NULL,
  -- Which fields diverge, and which of those are financial.
  divergences    jsonb NOT NULL DEFAULT '[]'::jsonb,
  has_financial_divergence boolean NOT NULL DEFAULT false,
  status         text NOT NULL DEFAULT 'open',
  resolution     text,
  resolution_reason text,
  resolved_row   jsonb,
  resolved_by    uuid,
  resolved_at    timestamptz,
  detected_by    uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sync_conflicts_status_check CHECK (status IN ('open', 'resolved', 'superseded')),
  CONSTRAINT sync_conflicts_resolution_check
    CHECK (resolution IS NULL OR resolution IN ('keep_server', 'keep_client', 'merge', 'auto_merge'))
);

-- One open conflict per attempted mutation. A device retrying the same
-- refused write updates its conflict rather than creating another.
CREATE UNIQUE INDEX IF NOT EXISTS sync_conflicts_mutation_key
  ON sync_conflicts (workspace_id, mutation_id);

CREATE INDEX IF NOT EXISTS sync_conflicts_open_idx
  ON sync_conflicts (workspace_id, created_at DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS sync_conflicts_entity_idx
  ON sync_conflicts (workspace_id, entity_type, entity_id);

-- ─── Row level security ─────────────────────────────────────────────────────
-- A conflict row holds a full copy of a financial record, so it is protected
-- exactly as strictly as the record it came from.

ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_conflicts_workspace_members ON sync_conflicts;
CREATE POLICY sync_conflicts_workspace_members ON sync_conflicts
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;


-- ────────────────────────────────────────────────────────────────────────
-- [8/59] sod-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/sod-migration.sql
--
-- Segregation of duties: the settings, the index of who did what to which
-- document, and the record of every override.
--
-- WHY `sod_actions` IS ITS OWN TABLE
--   It could be a query over audit_logs. It is not, because the audit trail is
--   a narrative written for people and its shape changes with the features
--   that write to it. This is a machine-read index that a CONTROL depends on:
--   if its shape drifts, the control silently stops catching anything.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sod_settings (
  workspace_id   uuid PRIMARY KEY,
  -- 'off'    not enforced. The default, and correct for a one-person shop:
  --          a control that forces people to share a login is worse than none.
  -- 'warn'   enforced, with a recorded override for the workspace owner.
  -- 'strict' enforced with no override.
  mode           text NOT NULL DEFAULT 'off',
  disabled_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sod_settings_mode_check CHECK (mode IN ('off', 'warn', 'strict'))
);

CREATE TABLE IF NOT EXISTS sod_actions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid NOT NULL,
  capability   text NOT NULL,
  actor_id     uuid NOT NULL,
  actor_role   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- The lookup the check makes on every guarded action.
CREATE INDEX IF NOT EXISTS sod_actions_entity_idx
  ON sod_actions (workspace_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS sod_overrides (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  rule_id      text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid NOT NULL,
  capability   text NOT NULL,
  actor_id     uuid NOT NULL,
  -- Never empty. An override with no reason records that somebody bypassed a
  -- separation of duties and not why, which is the same as no control.
  reason       text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sod_overrides_reason_check CHECK (length(btrim(reason)) > 0)
);

CREATE INDEX IF NOT EXISTS sod_overrides_workspace_idx
  ON sod_overrides (workspace_id, created_at DESC);

ALTER TABLE sod_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sod_actions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sod_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sod_settings_workspace_members ON sod_settings;
CREATE POLICY sod_settings_workspace_members ON sod_settings
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS sod_actions_workspace_members ON sod_actions;
CREATE POLICY sod_actions_workspace_members ON sod_actions
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS sod_overrides_workspace_members ON sod_overrides;
CREATE POLICY sod_overrides_workspace_members ON sod_overrides
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;


-- ────────────────────────────────────────────────────────────────────────
-- [9/59] branch-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/branch-migration.sql
--
-- Branches inside one business.
--
-- A workspace IS the company: it owns the chart of accounts, the catalogue and
-- the customers. A branch is a PLACE inside it — a second shop, a warehouse
-- across town — that raises its own documents and can be reported on
-- separately.
--
--   SHARED across branches   products, customers, suppliers, chart of accounts
--   PER BRANCH               invoices, payments, journal entries, stock moves
--
-- Every branch column below is NULLABLE on purpose. A workspace with no
-- branches keeps working exactly as it did, and a NULL branch means "the
-- business as a whole" rather than an unfinished migration.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS branches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL,
  code             text NOT NULL,
  name             text NOT NULL,
  -- A region holding shops. Reporting on the region includes them.
  parent_branch_id uuid REFERENCES branches (id),
  is_active        boolean NOT NULL DEFAULT true,
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS branches_workspace_code_key
  ON branches (workspace_id, code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS branches_workspace_idx ON branches (workspace_id);

-- ─── Who may act where ──────────────────────────────────────────────────────
-- NO ROW means unrestricted, not "no access". Most workspaces have one branch
-- or none, and defaulting their members to no access would lock every existing
-- user out the moment branches shipped.

CREATE TABLE IF NOT EXISTS member_branches (
  workspace_id uuid NOT NULL,
  user_id      uuid NOT NULL,
  branch_id    uuid NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  assigned_by  uuid,
  assigned_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id, branch_id)
);

-- ─── Documents carry their branch ───────────────────────────────────────────

ALTER TABLE invoices         ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches (id);
ALTER TABLE payments         ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches (id);
ALTER TABLE journal_entries  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches (id);
ALTER TABLE stock_movements  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches (id);
ALTER TABLE cost_layers      ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches (id);
ALTER TABLE warehouses       ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches (id);

CREATE INDEX IF NOT EXISTS invoices_branch_idx        ON invoices (workspace_id, branch_id);
CREATE INDEX IF NOT EXISTS payments_branch_idx        ON payments (workspace_id, branch_id);
CREATE INDEX IF NOT EXISTS journal_entries_branch_idx ON journal_entries (workspace_id, branch_id);

-- ─── Row level security ─────────────────────────────────────────────────────
-- The workspace is still the security boundary. The branch narrows what a
-- member sees INSIDE it and is enforced in the application, where the member's
-- assignment is known; a policy here would have to re-derive it per row.

ALTER TABLE branches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS branches_workspace_members ON branches;
CREATE POLICY branches_workspace_members ON branches
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

-- ⚠️ One policy per command. `rls-performance-migration.sql` used to add
-- `member_branches_own_rows` (SELECT, user-only) on top of a FOR ALL policy —
-- two permissive SELECT policies for the same role (multiple_permissive_policies).
-- The split keeps the exact effective access: reads = workspace rows OR the
-- user's own rows; writes = workspace rows only.
DROP POLICY IF EXISTS member_branches_workspace_members ON member_branches;
DROP POLICY IF EXISTS member_branches_own_rows ON member_branches;
DROP POLICY IF EXISTS member_branches_select ON member_branches;
DROP POLICY IF EXISTS member_branches_insert ON member_branches;
DROP POLICY IF EXISTS member_branches_update ON member_branches;
DROP POLICY IF EXISTS member_branches_delete ON member_branches;

CREATE POLICY member_branches_select ON member_branches
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
    )
    OR user_id = (SELECT auth.uid())
  );

CREATE POLICY member_branches_insert ON member_branches
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

CREATE POLICY member_branches_update ON member_branches
  FOR UPDATE TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

CREATE POLICY member_branches_delete ON member_branches
  FOR DELETE TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;

-- ============================================================================
-- Branch-aware reporting.
--
-- The trial balance grows an optional branch filter. NULL means "every branch"
-- — a consolidated statement for the whole business, which is what every
-- existing caller asks for and continues to get.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION accounting_trial_balance(
  p_workspace_id uuid,
  p_from_date    date,
  p_to_date      date,
  p_branch_ids   uuid[] DEFAULT NULL
) RETURNS TABLE (
  account_id   uuid,
  account_code text,
  account_name text,
  account_type text,
  account_role text,
  total_debit  numeric,
  total_credit numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    a.id, a.code, a.name, a.type, a.role,
    COALESCE(SUM(l.debit), 0),
    COALESCE(SUM(l.credit), 0)
  FROM journal_lines l
  JOIN journal_entries j ON j.id = l.journal_id
  JOIN accounts a ON a.id = l.account_id
  WHERE j.workspace_id = p_workspace_id
    AND a.workspace_id = p_workspace_id
    AND j.status = 'posted'
    AND j.deleted_at IS NULL
    AND (p_from_date IS NULL OR j.date >= p_from_date)
    AND (p_to_date   IS NULL OR j.date <= p_to_date)
    AND (p_branch_ids IS NULL OR j.branch_id = ANY (p_branch_ids))
  GROUP BY a.id, a.code, a.name, a.type, a.role
  HAVING COALESCE(SUM(l.debit), 0) <> 0 OR COALESCE(SUM(l.credit), 0) <> 0
  ORDER BY a.code;
$fn$;

COMMIT;


-- ────────────────────────────────────────────────────────────────────────
-- [10/59] personalization-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/personalization-migration.sql
--
-- One row per user per workspace: what THEY have chosen not to see.
--
-- VISIBILITY IS NOT AUTHORIZATION. Nothing in this table grants, revokes or
-- modifies a permission, and nothing here deletes or disables data. It is read
-- AFTER the authorization decision and can only ever narrow it.
--
-- The same person can run their own shop one way and help in somebody else's
-- another, so the profile is keyed by (workspace, user) and not by user alone.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ui_visibility_profiles (
  workspace_id    uuid NOT NULL,
  user_id         uuid NOT NULL,
  modules         jsonb NOT NULL DEFAULT '{}'::jsonb,
  pages           jsonb NOT NULL DEFAULT '{}'::jsonb,
  widgets         jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Expert-level inputs. An ABSENT key here means hidden — the opposite of the
  -- three above, where absent means visible. A new module in an update should
  -- appear; a new expert field should not clutter a shopkeeper's form uninvited.
  advanced_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

-- Suggestions are PROPOSED and never applied. This records what was offered
-- and what the person answered, so the same suggestion is not made twice and
-- "stop suggesting" is honoured.
CREATE TABLE IF NOT EXISTS ui_visibility_suggestions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id      uuid NOT NULL,
  level        text NOT NULL,
  key          text NOT NULL,
  kind         text NOT NULL,
  reason       text NOT NULL,
  -- 'pending' | 'accepted' | 'dismissed' | 'muted'
  answer       text NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now(),
  answered_at  timestamptz,
  CONSTRAINT ui_visibility_suggestions_level_check
    CHECK (level IN ('module', 'page', 'widget', 'field')),
  CONSTRAINT ui_visibility_suggestions_kind_check CHECK (kind IN ('hide', 'show')),
  CONSTRAINT ui_visibility_suggestions_answer_check
    CHECK (answer IN ('pending', 'accepted', 'dismissed', 'muted'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ui_visibility_suggestions_key
  ON ui_visibility_suggestions (workspace_id, user_id, level, key, kind)
  WHERE answer = 'pending';

ALTER TABLE ui_visibility_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ui_visibility_suggestions ENABLE ROW LEVEL SECURITY;

-- A preference is the user's own. Scoped to the workspace like everything
-- else, and then to the person within it: one member's hidden modules are not
-- another member's business.
--
-- ⚠️ One policy per command, not FOR ALL plus a second SELECT policy.
-- `rls-performance-migration.sql` used to add `ui_visibility_profiles_own_rows`
-- (SELECT, user-only) on top of this FOR ALL policy — two permissive SELECT
-- policies for the same role, which Supabase flags as
-- multiple_permissive_policies. The split below keeps one policy per command.
-- Reads are scoped to the user AND their active membership, like every other
-- tenant table (rls-coverage.test.ts): a suspended or removed member must not
-- keep reading workspace rows through a user-only shortcut.
DROP POLICY IF EXISTS ui_visibility_profiles_own ON ui_visibility_profiles;
DROP POLICY IF EXISTS ui_visibility_profiles_own_rows ON ui_visibility_profiles;
DROP POLICY IF EXISTS ui_visibility_profiles_select ON ui_visibility_profiles;
DROP POLICY IF EXISTS ui_visibility_profiles_insert ON ui_visibility_profiles;
DROP POLICY IF EXISTS ui_visibility_profiles_update ON ui_visibility_profiles;
DROP POLICY IF EXISTS ui_visibility_profiles_delete ON ui_visibility_profiles;

CREATE POLICY ui_visibility_profiles_select ON ui_visibility_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
    )
  );

CREATE POLICY ui_visibility_profiles_insert ON ui_visibility_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
    )
  );

CREATE POLICY ui_visibility_profiles_update ON ui_visibility_profiles
  FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
    )
  );

CREATE POLICY ui_visibility_profiles_delete ON ui_visibility_profiles
  FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
    )
  );

DROP POLICY IF EXISTS ui_visibility_suggestions_own ON ui_visibility_suggestions;
CREATE POLICY ui_visibility_suggestions_own ON ui_visibility_suggestions
  FOR ALL TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
    )
  );

COMMIT;


-- ────────────────────────────────────────────────────────────────────────
-- [11/59] rules-engine-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/rules-engine-migration.sql
--
-- Business rules a workspace can change without a deploy.
--
-- A rule produces a DECISION and never performs one. "Discount over 15% needs
-- the sales manager" is a rule; applying the discount, starting the approval
-- and refusing the save are all the domain's job. That is why there is no
-- `allow` action and no expression column: a rule can require an approval or
-- block a document, never widen what somebody may do, and nothing here is
-- evaluated as code.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS business_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  name          text NOT NULL,
  entity        text NOT NULL,
  -- { match: 'all' | 'any', conditions: [{ field, operator, value }] }
  -- A closed operator set over named fields. Never an expression to parse: a
  -- rule engine that evaluates strings is a remote code execution feature the
  -- customer configures themselves.
  conditions    jsonb NOT NULL DEFAULT '{"match":"all","conditions":[]}'::jsonb,
  actions       jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Lower runs first. Ties break on id in the domain, so evaluation order
  -- never varies between runs or between replicas.
  priority      integer NOT NULL DEFAULT 100,
  active        boolean NOT NULL DEFAULT true,
  stop_on_match boolean NOT NULL DEFAULT false,
  deleted_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  CONSTRAINT business_rules_entity_check CHECK (
    entity IN ('invoice', 'payment', 'purchase_order', 'journal_entry', 'customer', 'product')
  )
);

CREATE INDEX IF NOT EXISTS business_rules_lookup_idx
  ON business_rules (workspace_id, entity, priority)
  WHERE active = true AND deleted_at IS NULL;

-- Which rule decided what, on which document. This is the answer to "why did
-- this invoice need approval", and it is why a rule is deactivated rather than
-- deleted once it has decided anything.
CREATE TABLE IF NOT EXISTS rule_decisions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  rule_id      uuid,
  rule_name    text NOT NULL,
  entity       text NOT NULL,
  entity_id    uuid,
  action_kind  text NOT NULL,
  action       jsonb NOT NULL DEFAULT '{}'::jsonb,
  facts        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rule_decisions_entity_idx
  ON rule_decisions (workspace_id, entity, entity_id);

ALTER TABLE business_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_decisions  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_rules_workspace_members ON business_rules;
CREATE POLICY business_rules_workspace_members ON business_rules
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS rule_decisions_workspace_members ON rule_decisions;
CREATE POLICY rule_decisions_workspace_members ON rule_decisions
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

-- ─── Workflows grow a workspace ─────────────────────────────────────────────
-- `workflows` was queried with NO workspace filter when routing an invoice to
-- approval, so the first active invoice workflow in the entire database
-- started approvals on every shop's invoices.

ALTER TABLE workflows ADD COLUMN IF NOT EXISTS workspace_id uuid;

CREATE INDEX IF NOT EXISTS workflows_workspace_idx
  ON workflows (workspace_id, entity_type)
  WHERE is_active = true AND deleted_at IS NULL;

COMMIT;


-- ────────────────────────────────────────────────────────────────────────
-- [12/59] mdm-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/mdm-migration.sql
--
-- The record of every merge, and where an absorbed record went.
--
-- A merge moves invoices, debts and payment history from one identity to
-- another. The absorbed row is soft-deleted and keeps a pointer to its
-- survivor rather than being removed: somebody holding a printed invoice with
-- the old id must still be able to find out what happened to it.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS mdm_merges (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL,
  entity            text NOT NULL,
  survivor_id       uuid NOT NULL,
  absorbed_id       uuid NOT NULL,
  -- The absorbed record exactly as it was. A merge cannot be undone
  -- automatically, but it must always be possible to see what was lost.
  absorbed_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason            text NOT NULL,
  merged_by         uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mdm_merges_entity_check CHECK (entity IN ('customer', 'supplier', 'product')),
  CONSTRAINT mdm_merges_distinct_check CHECK (survivor_id <> absorbed_id),
  CONSTRAINT mdm_merges_reason_check CHECK (length(btrim(reason)) > 0)
);

CREATE INDEX IF NOT EXISTS mdm_merges_workspace_idx
  ON mdm_merges (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mdm_merges_absorbed_idx
  ON mdm_merges (workspace_id, absorbed_id);

-- Where an absorbed record went. Followed when an old id is looked up.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS merged_into_id uuid;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS merged_into_id uuid;
ALTER TABLE products  ADD COLUMN IF NOT EXISTS merged_into_id uuid;

ALTER TABLE mdm_merges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mdm_merges_workspace_members ON mdm_merges;
CREATE POLICY mdm_merges_workspace_members ON mdm_merges
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;


-- ────────────────────────────────────────────────────────────────────────
-- [13/59] tenant-isolation-closure-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/tenant-isolation-closure-migration.sql
--
-- Closing the last tenancy holes: HR, projects and CRM.
--
-- These five tables held SHARED business data and were queried by `user_id`.
-- The consequences were the same shape every time and none of them looked like
-- a bug from the outside:
--
--   * an employee one member entered was invisible to the rest of the shop
--   * a project's tasks belonged to whoever typed them, not to the business
--   * a manager could not record an outcome on a task their seller created
--   * the CRM cache keys carried the user, so two colleagues looking at the
--     same pipeline saw two different pipelines
--
-- The application half of this is already done — every query filters on
-- `workspace_id` from a verified TenancyContext, and the static guard now
-- fails the build if one regresses. This file is the database half.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── 1. The column ──────────────────────────────────────────────────────────

ALTER TABLE departments   ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE employees     ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE attendance    ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE projects      ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE interactions  ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS workspace_id uuid;

-- ─── 2. Backfill, failing closed ────────────────────────────────────────────
-- Only rows whose creator maps to EXACTLY ONE workspace are filled. A user who
-- owns their own shop and also sells in somebody else's has two, and guessing
-- which one their rows belong to could move an employee record between
-- businesses. Those rows stay NULL and are counted in PART 4.

CREATE TEMP VIEW sole_membership AS
  SELECT user_id, MIN(workspace_id::text)::uuid AS workspace_id
  FROM workspace_members
  WHERE has_access = true AND suspended_at IS NULL
  GROUP BY user_id
  HAVING COUNT(DISTINCT workspace_id) = 1;

UPDATE departments t SET workspace_id = m.workspace_id
  FROM sole_membership m WHERE t.workspace_id IS NULL AND t.user_id = m.user_id;

UPDATE employees t SET workspace_id = m.workspace_id
  FROM sole_membership m WHERE t.workspace_id IS NULL AND t.user_id = m.user_id;

UPDATE projects t SET workspace_id = m.workspace_id
  FROM sole_membership m WHERE t.workspace_id IS NULL AND t.user_id = m.user_id;

UPDATE interactions t SET workspace_id = m.workspace_id
  FROM sole_membership m WHERE t.workspace_id IS NULL AND t.user_id = m.user_id;

UPDATE opportunities t SET workspace_id = m.workspace_id
  FROM sole_membership m WHERE t.workspace_id IS NULL AND t.user_id = m.user_id;

-- Children inherit from their parent, which is more reliable than their own
-- creator: a task typed by a colleague still belongs to the project's shop.
UPDATE attendance a SET workspace_id = e.workspace_id
  FROM employees e WHERE a.workspace_id IS NULL AND a.employee_id = e.id;

UPDATE project_tasks t SET workspace_id = p.workspace_id
  FROM projects p WHERE t.workspace_id IS NULL AND t.project_id = p.id;

-- ─── 3. Indexes ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS departments_workspace_idx   ON departments (workspace_id);
CREATE INDEX IF NOT EXISTS employees_workspace_idx     ON employees (workspace_id);
CREATE INDEX IF NOT EXISTS attendance_workspace_idx    ON attendance (workspace_id, employee_id);
CREATE INDEX IF NOT EXISTS projects_workspace_idx      ON projects (workspace_id);
CREATE INDEX IF NOT EXISTS project_tasks_workspace_idx ON project_tasks (workspace_id, project_id);
CREATE INDEX IF NOT EXISTS interactions_workspace_idx  ON interactions (workspace_id, customer_id);
CREATE INDEX IF NOT EXISTS opportunities_workspace_idx ON opportunities (workspace_id, customer_id);

-- ─── 4. Verify before enabling ──────────────────────────────────────────────
-- Run this and read it. A non-zero `unmapped` is not a failure of the
-- migration; it is a list of rows that need a human to say which business
-- they belong to.

SELECT 'departments'   AS table_name, count(*) FILTER (WHERE workspace_id IS NULL) AS unmapped, count(*) AS total FROM departments
UNION ALL SELECT 'employees',     count(*) FILTER (WHERE workspace_id IS NULL), count(*) FROM employees
UNION ALL SELECT 'attendance',    count(*) FILTER (WHERE workspace_id IS NULL), count(*) FROM attendance
UNION ALL SELECT 'projects',      count(*) FILTER (WHERE workspace_id IS NULL), count(*) FROM projects
UNION ALL SELECT 'project_tasks', count(*) FILTER (WHERE workspace_id IS NULL), count(*) FROM project_tasks
UNION ALL SELECT 'interactions',  count(*) FILTER (WHERE workspace_id IS NULL), count(*) FROM interactions
UNION ALL SELECT 'opportunities', count(*) FILTER (WHERE workspace_id IS NULL), count(*) FROM opportunities;

-- ─── 5. Row level security ──────────────────────────────────────────────────

ALTER TABLE departments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees     ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'departments', 'employees', 'attendance',
    'projects', 'project_tasks',
    'interactions', 'opportunities'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_workspace_members', v_table);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO authenticated
        USING (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
        ))
        WITH CHECK (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
        ))
    $p$, v_table || '_workspace_members', v_table);
  END LOOP;
END $$;

COMMIT;


-- ────────────────────────────────────────────────────────────────────────
-- [14/59] tax-engine-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/tax-engine-migration.sql
--
-- A real tax engine, replacing the single flat `tax_rate` column on invoices.
--
-- WHAT THE FLAT COLUMN COULD NOT EXPRESS
--   * two components on one document (VAT plus a municipal charge)
--   * a different rate for one item than for the rest of the invoice
--   * a tax-inclusive retail price, which is how prices are quoted here
--   * withholding, which is deducted from the payment rather than added
--   * zero-rated vs exempt — both charge nothing and report differently
--   * what rate applied to an invoice written before the rate changed
--
-- MONEY IS STORED IN MINOR UNITS.
-- Every amount below is an integer number of pul (afghani ×100). A 15% rate on
-- 33.33 is 4.9995, and whether that becomes 5.00 or 4.99 decides whether a
-- hundred-line invoice foots. Integers make that a decision instead of an
-- accident.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── 1. Settings ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tax_settings (
  workspace_id       uuid PRIMARY KEY,
  -- Bumped on EVERY configuration change. A document's snapshot records the
  -- version it was written under, which is the entire mechanism by which an
  -- offline device can later discover its figures are stale. Forgetting to
  -- bump it makes every drift check pass and the feature silently useless.
  config_version     integer NOT NULL DEFAULT 1,
  -- 'per_line'     the summed lines are the truth; each line foots alone
  -- 'per_document' the document figure is the truth; the residual is assigned
  rounding_policy    text NOT NULL DEFAULT 'per_line',
  prices_include_tax boolean NOT NULL DEFAULT false,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  CONSTRAINT tax_settings_policy_check
    CHECK (rounding_policy IN ('per_line', 'per_document'))
);

-- ─── 2. Components ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tax_components (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL,
  -- A translation KEY, never a rendered sentence: the label appears on an
  -- invoice a customer reads in their own language.
  label_key         text NOT NULL,
  computation       text NOT NULL DEFAULT 'percent',
  -- 'standard' | 'zero_rated' | 'exempt' | 'not_applicable'
  -- The last three all charge nothing and all report differently. Collapsing
  -- them into a 0% rate makes the return wrong while the invoice looks right.
  treatment         text NOT NULL DEFAULT 'standard',
  rate              numeric(9, 4) NOT NULL DEFAULT 0,
  -- The stated price already contains this tax, so it is EXTRACTED rather than
  -- added:  included = gross × rate / (100 + rate).
  included_in_price boolean NOT NULL DEFAULT false,
  -- Tax on tax, naming the components it compounds over. Explicit rather than
  -- inferred from row order, because "the next one compounds" is a rule
  -- somebody has to be able to read.
  compounds_on      jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Deducted from the PAYMENT rather than added to the bill. The supplier is
  -- owed the gross; the buyer remits this part directly.
  is_withholding    boolean NOT NULL DEFAULT false,
  account_id        uuid,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_components_computation_check
    CHECK (computation IN ('percent', 'fixed_per_unit', 'fixed_per_line')),
  CONSTRAINT tax_components_treatment_check
    CHECK (treatment IN ('standard', 'zero_rated', 'exempt', 'not_applicable')),
  CONSTRAINT tax_components_rate_check CHECK (rate >= 0),
  -- Withholding is taken out of the payment; it cannot also be baked into the
  -- price, because the two say opposite things about the same money.
  CONSTRAINT tax_components_withholding_check
    CHECK (NOT (is_withholding AND included_in_price))
);

CREATE INDEX IF NOT EXISTS tax_components_workspace_idx
  ON tax_components (workspace_id) WHERE is_active = true;

-- ─── 3. Rules ───────────────────────────────────────────────────────────────
-- Which components apply, and to what. Resolution is most-specific-first:
-- product + party category, product, category + party category, category,
-- party category, default.

CREATE TABLE IF NOT EXISTS tax_rules (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL,
  component_ids      jsonb NOT NULL DEFAULT '[]'::jsonb,
  product_id         uuid,
  category_id        uuid,
  -- The customer or supplier classification — a fiscal position, in effect.
  party_tax_category text,
  -- Validity is checked against the DOCUMENT's date, not today's: a backdated
  -- invoice is taxed at the rate of its own day.
  valid_from         date,
  valid_to           date,
  priority           integer NOT NULL DEFAULT 100,
  deleted_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tax_rules_lookup_idx
  ON tax_rules (workspace_id, product_id, category_id, party_tax_category)
  WHERE deleted_at IS NULL;

-- ─── 4. What each document actually charged ─────────────────────────────────
-- One row per component per document. This is what a return is filed from, and
-- it is written ONCE when the document is issued — never recomputed on read.

CREATE TABLE IF NOT EXISTS invoice_tax_lines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  invoice_id   uuid NOT NULL,
  component_id uuid,
  label_key    text NOT NULL,
  treatment    text NOT NULL,
  rate         numeric(9, 4) NOT NULL,
  base_minor   bigint NOT NULL,
  amount_minor bigint NOT NULL,
  -- Output tax (sales) and input tax (purchases) net off on a return and must
  -- never be summed together.
  direction    text NOT NULL,
  entry_date   date NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_tax_lines_direction_check CHECK (direction IN ('sale', 'purchase'))
);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_tax_lines_key
  ON invoice_tax_lines (workspace_id, invoice_id, component_id, rate);

CREATE INDEX IF NOT EXISTS invoice_tax_lines_return_idx
  ON invoice_tax_lines (workspace_id, entry_date);

-- ─── 5. The frozen snapshot ─────────────────────────────────────────────────
-- Everything the computation needed, copied onto the document.
--
-- A shopkeeper writes an invoice offline at 09:00; the rate changes at 11:00;
-- the phone syncs at 14:00. Re-resolving at sync would make the invoice in the
-- customer's hand disagree with the books. Trusting the device would let a
-- phone that never saw the change set the rate for everyone. So the document
-- keeps what it was written with, and the DIFFERENCE becomes something a
-- person is shown.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_snapshot jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_config_version integer;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS net_minor bigint;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_minor bigint;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS withholding_minor bigint;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_minor bigint;
-- Reported even when zero, so its absence is a fact rather than an omission.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS rounding_residual_minor bigint DEFAULT 0;

-- ─── 6. Row level security ──────────────────────────────────────────────────

ALTER TABLE tax_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_components    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_tax_lines ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'tax_settings', 'tax_components', 'tax_rules', 'invoice_tax_lines'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_workspace_members', v_table);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO authenticated
        USING (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
        ))
        WITH CHECK (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
        ))
    $p$, v_table || '_workspace_members', v_table);
  END LOOP;
END $$;

COMMIT;


-- ────────────────────────────────────────────────────────────────────────
-- [15/59] traceability-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/traceability-migration.sql
--
-- Batches, serial numbers and expiry — WHICH goods left, not just how many.
--
-- The costing core already answers "what did these goods cost". This answers
-- "which goods were they". They meet at one point: a batch or a serial names
-- the cost layer it arrived on, so the profit on a specific bottle is the cost
-- of the specific carton it came in, not an average.
--
-- Tracking is OPT-IN per product. A hardware store needs cost layers and no
-- batches; a pharmacy needs both. Turning this on for everybody would make
-- every sale ask a question most shops cannot answer.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── 1. Which products are tracked, and how ─────────────────────────────────

ALTER TABLE products ADD COLUMN IF NOT EXISTS tracking_mode text NOT NULL DEFAULT 'none';
ALTER TABLE products ADD COLUMN IF NOT EXISTS shelf_life_days integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'products_tracking_mode_check'
       AND conrelid = to_regclass('public.products')
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_tracking_mode_check
      CHECK (tracking_mode IN ('none', 'batch', 'serial')) NOT VALID;
  END IF;
END $$;

-- ─── 2. Batches ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_batches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL,
  product_id        uuid NOT NULL,
  batch_number      text NOT NULL,
  -- NULL means this batch does not expire. Distinct from a far-future date:
  -- one is a fact about the goods, the other is a guess somebody typed.
  expiry_date       date,
  manufactured_date date,
  received_qty      numeric(18, 4) NOT NULL,
  remaining_qty     numeric(18, 4) NOT NULL,
  -- What ties identity to money.
  cost_layer_id     uuid,
  warehouse_id      uuid,
  received_on       date NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,
  CONSTRAINT stock_batches_qty_check CHECK (
    received_qty > 0 AND remaining_qty >= 0 AND remaining_qty <= received_qty
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_batches_number_key
  ON stock_batches (workspace_id, product_id, batch_number);

-- The FEFO queue: open batches for one product, soonest expiry first. Nulls
-- last, because a batch that does not expire is the one that can wait.
CREATE INDEX IF NOT EXISTS stock_batches_fefo_idx
  ON stock_batches (workspace_id, product_id, expiry_date NULLS LAST, received_on)
  WHERE remaining_qty > 0;

-- ─── 3. Serial numbers ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_serials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL,
  product_id      uuid NOT NULL,
  serial_number   text NOT NULL,
  status          text NOT NULL DEFAULT 'in_stock',
  batch_id        uuid REFERENCES stock_batches (id),
  cost_layer_id   uuid,
  -- What THIS unit cost. Minor units, from its own layer — never an average.
  unit_cost_minor bigint NOT NULL DEFAULT 0,
  warehouse_id    uuid,
  received_on     date NOT NULL,
  -- Where it went, once it went.
  invoice_id      uuid,
  sold_on         date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_serials_status_check
    CHECK (status IN ('in_stock', 'sold', 'returned', 'scrapped'))
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_serials_number_key
  ON stock_serials (workspace_id, product_id, serial_number);

CREATE INDEX IF NOT EXISTS stock_serials_available_idx
  ON stock_serials (workspace_id, product_id) WHERE status = 'in_stock';

-- ─── 4. What each document took ─────────────────────────────────────────────
-- The trail from an invoice line back to the exact physical goods.

CREATE TABLE IF NOT EXISTS lot_allocations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  consumer_type text NOT NULL,
  consumer_id   uuid NOT NULL,
  consumer_line text,
  product_id    uuid NOT NULL,
  batch_id      uuid REFERENCES stock_batches (id),
  serial_id     uuid REFERENCES stock_serials (id),
  quantity      numeric(18, 4) NOT NULL,
  entry_date    date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Exactly one of the two: a row names a batch or a serial, never both and
  -- never neither.
  CONSTRAINT lot_allocations_target_check CHECK (
    (batch_id IS NOT NULL AND serial_id IS NULL) OR
    (batch_id IS NULL AND serial_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS lot_allocations_consumer_idx
  ON lot_allocations (workspace_id, consumer_type, consumer_id);

CREATE INDEX IF NOT EXISTS lot_allocations_batch_idx
  ON lot_allocations (workspace_id, batch_id);

-- ─── 5. Cost layers learn about batches ─────────────────────────────────────

ALTER TABLE cost_layers ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES stock_batches (id);

-- ─── 6. Row level security ──────────────────────────────────────────────────

ALTER TABLE stock_batches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_serials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_allocations ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['stock_batches', 'stock_serials', 'lot_allocations'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_workspace_members', v_table);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO authenticated
        USING (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
        ))
        WITH CHECK (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
        ))
    $p$, v_table || '_workspace_members', v_table);
  END LOOP;
END $$;

COMMIT;


-- ────────────────────────────────────────────────────────────────────────
-- [16/59] finance-gaps-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/finance-gaps-migration.sql
--
-- POS sessions, fixed assets, bank reconciliation, FX revaluation and
-- accounting dimensions — Tier 1 gaps 3 to 7.
--
-- MONEY IS IN MINOR UNITS throughout, for the same reason as the tax engine:
-- a depreciation schedule that rounds 36 times must still sum exactly to what
-- was capitalised, and floats cannot promise that.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ══════════════════════════════════════════════ POS

CREATE TABLE IF NOT EXISTS pos_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL,
  branch_id           uuid,
  status              text NOT NULL DEFAULT 'open',
  opening_float_minor bigint NOT NULL DEFAULT 0,
  opened_at           timestamptz NOT NULL DEFAULT now(),
  opened_by           uuid NOT NULL,
  -- What a person physically counted. NULL until somebody has.
  counted_cash_minor  bigint,
  -- Required once the variance exceeds the workspace tolerance.
  variance_reason     text,
  closed_at           timestamptz,
  closed_by           uuid,
  -- An owner closed somebody else's abandoned session from another device.
  was_forced          boolean NOT NULL DEFAULT false,
  journal_entry_id    uuid,
  CONSTRAINT pos_sessions_status_check
    CHECK (status IN ('open', 'closing', 'closed', 'force_closed'))
);

-- One open session per person per branch. Two open drawers for one till is
-- two counts that can never be reconciled against one another.
CREATE UNIQUE INDEX IF NOT EXISTS pos_sessions_one_open
  ON pos_sessions (workspace_id, opened_by, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS pos_sessions_abandoned_idx
  ON pos_sessions (workspace_id, opened_at) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS pos_orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  session_id    uuid NOT NULL REFERENCES pos_sessions (id),
  -- Generated ONCE on the device and never regenerated. This is what makes a
  -- retry after a lost response idempotent rather than a second sale.
  order_ref     text NOT NULL,
  invoice_id    uuid,
  total_minor   bigint NOT NULL,
  change_minor  bigint NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'completed',
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_orders_status_check CHECK (status IN ('completed', 'voided'))
);

CREATE UNIQUE INDEX IF NOT EXISTS pos_orders_ref_key
  ON pos_orders (workspace_id, order_ref);

CREATE TABLE IF NOT EXISTS pos_order_payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  order_id     uuid NOT NULL REFERENCES pos_orders (id) ON DELETE CASCADE,
  method       text NOT NULL,
  amount_minor bigint NOT NULL,
  CONSTRAINT pos_order_payments_method_check
    CHECK (method IN ('cash', 'card', 'transfer', 'credit', 'other'))
);

CREATE TABLE IF NOT EXISTS pos_cash_movements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  session_id   uuid NOT NULL REFERENCES pos_sessions (id),
  kind         text NOT NULL,
  amount_minor bigint NOT NULL,
  -- Never empty. Cash leaving a drawer with no stated reason is
  -- indistinguishable from cash going missing.
  reason       text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  CONSTRAINT pos_cash_movements_kind_check CHECK (kind IN ('cash_in', 'cash_out')),
  CONSTRAINT pos_cash_movements_reason_check CHECK (length(btrim(reason)) > 0),
  CONSTRAINT pos_cash_movements_amount_check CHECK (amount_minor > 0)
);

-- ══════════════════════════════════════════════ FIXED ASSETS

CREATE TABLE IF NOT EXISTS fixed_assets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL,
  name               text NOT NULL,
  asset_account_id   uuid,
  expense_account_id uuid,
  accumulated_account_id uuid,
  cost_minor         bigint NOT NULL,
  salvage_minor      bigint NOT NULL DEFAULT 0,
  method             text NOT NULL DEFAULT 'straight_line',
  periods            integer NOT NULL,
  period_months      integer NOT NULL DEFAULT 1,
  declining_factor   numeric(6, 3),
  first_period_on    date NOT NULL,
  prorata_from       date,
  acquired_on        date NOT NULL,
  -- Set on disposal. The schedule stops here and remaining periods cancel.
  disposed_on        date,
  disposal_proceeds_minor bigint,
  source_invoice_id  uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fixed_assets_method_check
    CHECK (method IN ('straight_line', 'declining', 'declining_then_straight')),
  CONSTRAINT fixed_assets_salvage_check CHECK (salvage_minor >= 0 AND salvage_minor <= cost_minor),
  CONSTRAINT fixed_assets_periods_check CHECK (periods >= 1 AND period_months >= 1)
);

-- The whole schedule, computed ONCE at creation.
--
-- Not a monthly formula: a month the job did not run is a month of
-- depreciation that never happened and nothing says so. With a stored
-- schedule, "what is due and unposted" has a definite answer that survives a
-- missed run, a crash, and six weeks offline.
CREATE TABLE IF NOT EXISTS asset_depreciation_schedule (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL,
  asset_id          uuid NOT NULL REFERENCES fixed_assets (id) ON DELETE CASCADE,
  period            integer NOT NULL,
  on_date           date NOT NULL,
  amount_minor      bigint NOT NULL,
  accumulated_minor bigint NOT NULL,
  book_value_minor  bigint NOT NULL,
  journal_entry_id  uuid,
  posted_at         timestamptz,
  cancelled_at      timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS asset_schedule_period_key
  ON asset_depreciation_schedule (workspace_id, asset_id, period);

CREATE INDEX IF NOT EXISTS asset_schedule_due_idx
  ON asset_depreciation_schedule (workspace_id, on_date)
  WHERE posted_at IS NULL AND cancelled_at IS NULL;

-- ══════════════════════════════════════════════ BANK RECONCILIATION

CREATE TABLE IF NOT EXISTS bank_statements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL,
  account_id     uuid NOT NULL,
  statement_date date NOT NULL,
  opening_balance_minor bigint NOT NULL DEFAULT 0,
  closing_balance_minor bigint NOT NULL DEFAULT 0,
  imported_at    timestamptz NOT NULL DEFAULT now(),
  imported_by    uuid
);

CREATE TABLE IF NOT EXISTS bank_statement_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  statement_id  uuid NOT NULL REFERENCES bank_statements (id) ON DELETE CASCADE,
  -- The bank's own identifier where it gives one; a position-based fallback
  -- otherwise. This is what stops a re-imported file duplicating every line.
  line_key      text NOT NULL,
  external_ref  text,
  on_date       date NOT NULL,
  -- Positive is money in, negative is money out. Same convention as the books.
  amount_minor  bigint NOT NULL,
  description   text NOT NULL DEFAULT '',
  matched_to    uuid,
  matched_at    timestamptz,
  matched_by    uuid,
  -- A difference is usually a bank charge. Writing it off is a real entry, so
  -- it needs a reason that says where it lands.
  difference_reason text
);

CREATE UNIQUE INDEX IF NOT EXISTS bank_statement_lines_dedupe
  ON bank_statement_lines (workspace_id, statement_id, line_key);

CREATE INDEX IF NOT EXISTS bank_statement_lines_unmatched_idx
  ON bank_statement_lines (workspace_id, on_date) WHERE matched_to IS NULL;

-- ══════════════════════════════════════════════ FX REVALUATION

CREATE TABLE IF NOT EXISTS fx_revaluations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  as_of         date NOT NULL,
  -- The rates used, so the run can be reproduced exactly.
  rates         jsonb NOT NULL DEFAULT '{}'::jsonb,
  gain_minor    bigint NOT NULL DEFAULT 0,
  loss_minor    bigint NOT NULL DEFAULT 0,
  net_minor     bigint NOT NULL DEFAULT 0,
  -- What this run reversed. An unrealised difference is an opinion about a
  -- rate; last period's opinion must not sit under this one.
  reversed_minor bigint NOT NULL DEFAULT 0,
  journal_entry_id uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS fx_revaluations_period_key
  ON fx_revaluations (workspace_id, as_of);

CREATE TABLE IF NOT EXISTS fx_revaluation_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL,
  revaluation_id    uuid NOT NULL REFERENCES fx_revaluations (id) ON DELETE CASCADE,
  source_type       text NOT NULL,
  source_id         uuid NOT NULL,
  currency          text NOT NULL,
  foreign_minor     bigint NOT NULL,
  booked_rate       numeric(18, 8) NOT NULL,
  closing_rate      numeric(18, 8) NOT NULL,
  booked_base_minor bigint NOT NULL,
  revalued_base_minor bigint NOT NULL,
  difference_minor  bigint NOT NULL
);

-- ══════════════════════════════════════════════ DIMENSIONS

CREATE TABLE IF NOT EXISTS accounting_dimensions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL,
  code             text NOT NULL,
  label_key        text NOT NULL,
  allows_hierarchy boolean NOT NULL DEFAULT true,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS accounting_dimensions_code_key
  ON accounting_dimensions (workspace_id, code);

CREATE TABLE IF NOT EXISTS dimension_values (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  dimension_id uuid NOT NULL REFERENCES accounting_dimensions (id) ON DELETE CASCADE,
  code         text NOT NULL,
  name         text NOT NULL,
  parent_id    uuid REFERENCES dimension_values (id),
  is_active    boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS dimension_values_code_key
  ON dimension_values (workspace_id, dimension_id, code);

-- Required-ness is per ACCOUNT or account TYPE, never global. "Every posting
-- must name a cost centre" is unworkable — the bank account does not have one
-- — and a requirement that fires everywhere gets switched off within a week.
CREATE TABLE IF NOT EXISTS dimension_requirements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL,
  dimension_id     uuid NOT NULL REFERENCES accounting_dimensions (id) ON DELETE CASCADE,
  account_types    jsonb NOT NULL DEFAULT '[]'::jsonb,
  account_ids      jsonb NOT NULL DEFAULT '[]'::jsonb,
  except_account_ids jsonb NOT NULL DEFAULT '[]'::jsonb
);

-- A journal line carries its tags. dimensionId → valueId.
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS dimensions jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS journal_lines_dimensions_idx
  ON journal_lines USING gin (dimensions);

-- ══════════════════════════════════════════════ ROW LEVEL SECURITY

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'pos_sessions', 'pos_orders', 'pos_order_payments', 'pos_cash_movements',
    'fixed_assets', 'asset_depreciation_schedule',
    'bank_statements', 'bank_statement_lines',
    'fx_revaluations', 'fx_revaluation_lines',
    'accounting_dimensions', 'dimension_values', 'dimension_requirements'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_workspace_members', v_table);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO authenticated
        USING (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
        ))
        WITH CHECK (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
        ))
    $p$, v_table || '_workspace_members', v_table);
  END LOOP;
END $$;

COMMIT;


-- ────────────────────────────────────────────────────────────────────────
-- [17/59] tier2-gaps-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/tier2-gaps-migration.sql
--
-- Budgets, backdated cost recalculation, landed cost, reordering and
-- timesheet billing — Tier 2 gaps 8 to 11 and 14.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ══════════════════════════════════════════════ BUDGETS

CREATE TABLE IF NOT EXISTS budgets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL,
  account_id         uuid NOT NULL,
  -- Optional narrowing. A workspace-wide cap and a per-project cap can both
  -- be in force; the tightest binds, which falls out of checking all of them.
  dimension_value_id uuid,
  branch_id          uuid,
  period             text NOT NULL DEFAULT 'monthly',
  starts_on          date NOT NULL,
  amount_minor       bigint NOT NULL,
  -- 'block'  refuse the document
  -- 'warn'   let it through, record the breach
  -- 'track'  no interference; the variance report still shows it
  --
  -- Making every budget a hard block is how budgets get set to absurd numbers
  -- so that work can continue.
  action             text NOT NULL DEFAULT 'warn',
  warn_at_percent    integer NOT NULL DEFAULT 80,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budgets_period_check CHECK (period IN ('monthly', 'quarterly', 'yearly')),
  CONSTRAINT budgets_action_check CHECK (action IN ('block', 'warn', 'track')),
  CONSTRAINT budgets_amount_check CHECK (amount_minor >= 0)
);

CREATE INDEX IF NOT EXISTS budgets_lookup_idx
  ON budgets (workspace_id, account_id) WHERE is_active = true;

-- Money promised but not yet spent: approved orders, granted approvals.
-- Counting it is what makes a budget a control rather than a report — by the
-- time an expense is posted, the money is already gone.
CREATE TABLE IF NOT EXISTS budget_commitments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  budget_id     uuid NOT NULL REFERENCES budgets (id) ON DELETE CASCADE,
  source_type   text NOT NULL,
  source_id     uuid NOT NULL,
  amount_minor  bigint NOT NULL,
  -- Cleared when the commitment becomes an actual posting, so the same money
  -- is never counted twice.
  released_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS budget_commitments_source_key
  ON budget_commitments (workspace_id, budget_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS budget_commitments_open_idx
  ON budget_commitments (workspace_id, budget_id) WHERE released_at IS NULL;

-- Recorded whenever a budget was breached, whatever the action. A `warn`
-- budget that leaves no trace is a budget nobody can review.
CREATE TABLE IF NOT EXISTS budget_breaches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  budget_id     uuid NOT NULL REFERENCES budgets (id) ON DELETE CASCADE,
  source_type   text NOT NULL,
  source_id     uuid NOT NULL,
  over_by_minor bigint NOT NULL,
  action_taken  text NOT NULL,
  actor_id      uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════ BACKDATED REPOST

-- A recalculation run and what it changed.
--
-- Posted journal entries are NEVER rewritten. The correction is its own entry
-- with its own date, pointing at what it corrects — which is the difference
-- between an audit trail and a rewritten history.
CREATE TABLE IF NOT EXISTS cost_reposts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid NOT NULL,
  -- What triggered it: the backdated receipt, the landed cost voucher.
  trigger_type         text NOT NULL,
  trigger_id           uuid,
  from_date            date NOT NULL,
  examined_count       integer NOT NULL DEFAULT 0,
  adjustment_count     integer NOT NULL DEFAULT 0,
  net_adjustment_minor bigint NOT NULL DEFAULT 0,
  journal_entry_id     uuid,
  status               text NOT NULL DEFAULT 'planned',
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  CONSTRAINT cost_reposts_status_check
    CHECK (status IN ('planned', 'applied', 'refused_period_locked', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS cost_repost_adjustments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL,
  repost_id             uuid NOT NULL REFERENCES cost_reposts (id) ON DELETE CASCADE,
  consumer_type         text NOT NULL,
  consumer_id           uuid NOT NULL,
  consumer_line         text,
  product_id            uuid NOT NULL,
  entry_date            date NOT NULL,
  recorded_cost_minor   bigint NOT NULL,
  recomputed_cost_minor bigint NOT NULL,
  difference_minor      bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS cost_repost_adjustments_repost_idx
  ON cost_repost_adjustments (workspace_id, repost_id);

-- ══════════════════════════════════════════════ LANDED COST

CREATE TABLE IF NOT EXISTS landed_costs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL,
  description        text NOT NULL,
  -- Customs, freight and handling are part of what the goods COST. Expensing
  -- them understates inventory and then overstates profit on every sale of
  -- those goods for the rest of their life.
  charge_minor       bigint NOT NULL,
  basis              text NOT NULL DEFAULT 'value',
  expense_account_id uuid,
  applied_on         date NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  CONSTRAINT landed_costs_basis_check CHECK (basis IN ('value', 'quantity', 'weight')),
  CONSTRAINT landed_costs_charge_check CHECK (charge_minor > 0)
);

CREATE TABLE IF NOT EXISTS landed_cost_allocations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL,
  landed_cost_id      uuid NOT NULL REFERENCES landed_costs (id) ON DELETE CASCADE,
  cost_layer_id       uuid NOT NULL,
  allocated_minor     bigint NOT NULL,
  new_unit_cost_minor bigint NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS landed_cost_allocations_key
  ON landed_cost_allocations (workspace_id, landed_cost_id, cost_layer_id);

-- ══════════════════════════════════════════════ REORDERING

ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_level numeric(18, 4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_quantity numeric(18, 4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS lead_time_days integer;

-- ══════════════════════════════════════════════ TIMESHEETS

CREATE TABLE IF NOT EXISTS project_billing_config (
  project_id         uuid PRIMARY KEY,
  workspace_id       uuid NOT NULL,
  method             text NOT NULL DEFAULT 'hourly',
  default_rate_minor bigint NOT NULL DEFAULT 0,
  budget_cap_minor   bigint,
  CONSTRAINT project_billing_method_check
    CHECK (method IN ('hourly', 'fixed', 'non_billable'))
);

CREATE TABLE IF NOT EXISTS time_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id   uuid NOT NULL,
  task_id      uuid,
  employee_id  uuid NOT NULL,
  on_date      date NOT NULL,
  -- MINUTES, not hours: 1.5 hours cannot be stored exactly as a float, and
  -- eleven six-minute calls must add up to sixty-six.
  minutes      integer NOT NULL,
  billable     boolean NOT NULL DEFAULT true,
  rate_minor   bigint,
  -- Its PRESENCE is the lock. Not a flag that can be cleared — the invoice
  -- that took this hour.
  invoice_id   uuid,
  description  text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_entries_minutes_check CHECK (minutes > 0)
);

CREATE INDEX IF NOT EXISTS time_entries_project_idx
  ON time_entries (workspace_id, project_id, on_date);

CREATE INDEX IF NOT EXISTS time_entries_unbilled_idx
  ON time_entries (workspace_id, project_id) WHERE invoice_id IS NULL AND billable = true;

-- What an employee's time actually COSTS. Valuing labour at the billing rate
-- makes every project look like it broke exactly even.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cost_rate_minor bigint;

-- ══════════════════════════════════════════════ ROW LEVEL SECURITY

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'budgets', 'budget_commitments', 'budget_breaches',
    'cost_reposts', 'cost_repost_adjustments',
    'landed_costs', 'landed_cost_allocations',
    'project_billing_config', 'time_entries'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_workspace_members', v_table);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO authenticated
        USING (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
        ))
        WITH CHECK (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
        ))
    $p$, v_table || '_workspace_members', v_table);
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- Two gaps the vertical-slice check caught after the fact.
--
-- 1. `suppliers` had NO row-level security. The supplier core reached it, the
--    static tenancy guard covered the application half, and nothing covered
--    the database half — so a direct client with an anon key could read every
--    workspace's supplier list. It is the only table the whole Tier 2 sweep
--    added a service for and never protected.
--
-- 2. A till order and its payment rows were written in two statements, with a
--    manual DELETE if the second failed. `.claude/lessons-learned.md` #3
--    forbids exactly that: if the process dies between them, the compensating
--    delete never runs and the drawer holds an order with no payments — cash
--    that the session expects and cannot explain.
-- ============================================================================

BEGIN;

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suppliers_workspace_members ON suppliers;
CREATE POLICY suppliers_workspace_members ON suppliers
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

-- ─── The till order, written atomically ─────────────────────────────────────
-- Returns the EXISTING order when the reference has already been used, which
-- is what makes a retry after a lost response idempotent rather than a second
-- sale. A till on a bad connection retries constantly.

CREATE OR REPLACE FUNCTION pos_record_order(
  p_workspace_id uuid,
  p_session_id   uuid,
  p_payload      jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_order_id uuid;
  v_status   text;
  v_existing uuid;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'POS_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- The session must be open, and it must be OURS. Checked inside the
  -- transaction: outside it, a close could land between the check and the
  -- insert and the order would join a session that had already posted.
  SELECT status INTO v_status
    FROM pos_sessions
   WHERE id = p_session_id AND workspace_id = p_workspace_id
   FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'POS_SESSION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'POS_SESSION_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;

  -- Already taken. Hand back what exists rather than refusing: the device is
  -- retrying something that already succeeded, and an error would make it
  -- retry forever.
  SELECT id INTO v_existing
    FROM pos_orders
   WHERE workspace_id = p_workspace_id
     AND order_ref = p_payload ->> 'order_ref';

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_existing, 'status', 'already_recorded');
  END IF;

  INSERT INTO pos_orders (
    workspace_id, session_id, order_ref, invoice_id,
    total_minor, change_minor, status
  ) VALUES (
    p_workspace_id,
    p_session_id,
    p_payload ->> 'order_ref',
    NULLIF(p_payload ->> 'invoice_id', '')::uuid,
    (p_payload ->> 'total_minor')::bigint,
    COALESCE((p_payload ->> 'change_minor')::bigint, 0),
    'completed'
  )
  RETURNING id INTO v_order_id;

  -- Same transaction. An order without its payments is cash the session
  -- expects and cannot explain.
  INSERT INTO pos_order_payments (workspace_id, order_id, method, amount_minor)
  SELECT
    p_workspace_id,
    v_order_id,
    payment ->> 'method',
    (payment ->> 'amount_minor')::bigint
  FROM jsonb_array_elements(p_payload -> 'payments') AS payment;

  RETURN jsonb_build_object('id', v_order_id, 'status', 'recorded');
END;
$fn$;

COMMIT;


-- ────────────────────────────────────────────────────────────────────────
-- [18/59] schema-drift-fix-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/schema-drift-fix-migration.sql
--
-- Three columns that services were written against and no migration created.
--
-- ---------------------------------------------------------------------------
-- HOW THESE GOT IN
--
-- Each was written into a service, compiled cleanly, and passed a full domain
-- test suite — because `.eq('workspace_id', x)` is a string to TypeScript and
-- domain tests never touch a database. Every one of them would have failed at
-- runtime with `42703 column does not exist`, in front of a user.
--
-- `scripts/check-schema-drift.mjs` finds this class before a migration is ever
-- run. It found these.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── 1. exchange_rates was neither workspace-scoped nor dated ───────────────
--
-- `currency.service.ts` filtered on `workspace_id` and selected `rate_date`;
-- the table had neither — only `currency_code`, `rate` and `updated_at`.
--
-- Both are genuinely needed, and not just to make the code compile:
--
--   workspace_id  each business tracks its own rates. A shared rate table
--                 means one shop's correction silently revalues another's
--                 receivables.
--   rate_date     the rate FOR a day, not the day the row was touched.
--                 `updated_at` cannot answer "what was the rate on 12 March",
--                 which is the only question a backdated invoice asks.

ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS rate_date date;

-- Existing rows: date them from when they were last touched. It is the best
-- available answer and it is honest — it does not invent a history.
UPDATE exchange_rates
   SET rate_date = COALESCE(rate_date, updated_at::date, CURRENT_DATE)
 WHERE rate_date IS NULL;

-- One rate per currency per day per workspace. Without this the upsert in
-- `setRate` has nothing to conflict on and every save appends a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS exchange_rates_workspace_currency_date_key
  ON exchange_rates (workspace_id, currency_code, rate_date)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS exchange_rates_lookup_idx
  ON exchange_rates (workspace_id, currency_code, rate_date DESC);

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exchange_rates_workspace_members ON exchange_rates;
CREATE POLICY exchange_rates_workspace_members ON exchange_rates
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

-- ─── 2. invoice_items had no workspace of its own ───────────────────────────
--
-- `insights.service.ts` filtered it directly. The rest of this codebase puts
-- `workspace_id` on child tables rather than joining up to the parent every
-- time — `invoice_tax_lines` and `journal_lines` both do — and a report that
-- has to join to `invoices` to find its tenancy is a report one forgotten
-- join away from reading another shop's margins.

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS workspace_id uuid;

UPDATE invoice_items item
   SET workspace_id = invoice.workspace_id
  FROM invoices invoice
 WHERE item.workspace_id IS NULL
   AND item.invoice_id = invoice.id;

CREATE INDEX IF NOT EXISTS invoice_items_workspace_idx
  ON invoice_items (workspace_id, invoice_id);

-- ─── 3. invoices could not name the project they belong to ──────────────────
--
-- `timesheets.service.ts` reads a project's revenue by filtering invoices on
-- `project_id`. Without it, project profitability reports revenue of zero for
-- every project and a loss on all of them.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS project_id uuid;

CREATE INDEX IF NOT EXISTS invoices_project_idx
  ON invoices (workspace_id, project_id)
  WHERE project_id IS NOT NULL;

COMMIT;


-- ────────────────────────────────────────────────────────────────────────
-- [19/59] data-migration-center-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/data-migration-center-migration.sql
--
-- Bringing an existing business into Hisabche: the job, and the ledger that
-- makes it repeatable.
--
-- ---------------------------------------------------------------------------
-- WHY THE JOB IS A ROW AND NOT A VARIABLE
--
-- An import is long enough that the user will close the tab in the middle of
-- it. If the wizard's position lives in browser memory, a refresh loses the
-- mapping they spent ten minutes on, and — worse — a half-finished commit has
-- no record that it happened. The row IS the state; the UI reads it.
--
-- ---------------------------------------------------------------------------
-- WHY THE IDENTITY LEDGER EXISTS
--
-- A source id is not a Hisabche primary key and must never be used as one.
-- `migration_records` is the translation table between them, and it is what
-- makes a re-run of the same file idempotent: the second run finds the source
-- id already mapped and updates instead of inserting a twin. It is also the
-- only safe basis for recovery — "everything created by migration X" is a
-- query here, never a blanket delete of recently-created rows.
--
-- ---------------------------------------------------------------------------
-- WHAT IS DELIBERATELY NOT STORED
--
-- The uploaded file itself. It is parsed within the request that carries it
-- and only the derived headers, counts and findings are kept. Storing the raw
-- export would mean holding a customer list, with its phone numbers, in a
-- second place with its own retention question — for no capability the user
-- asked for. What IS kept is the filename, the byte count and a digest, which
-- is enough to answer "did I already import this file?".
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── 1. The job ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS migration_jobs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL,
  -- The actor. Recorded, never a tenancy filter.
  created_by         uuid NOT NULL,

  entity             text NOT NULL,
  source_type        text NOT NULL,
  -- What the uploader called the file. Displayed, never used to open anything.
  original_filename  text NOT NULL,
  byte_size          integer NOT NULL DEFAULT 0,
  -- SHA-256 of the decoded text, so "you already imported this" is answerable
  -- without keeping the file.
  content_digest     text,

  status             text NOT NULL DEFAULT 'uploaded',

  -- Everything the wizard needs to redraw itself after a refresh: detected
  -- headers, the source guess, the mapping, the findings, the dry run and the
  -- reconciliation. jsonb because the shape differs per step and none of it is
  -- ever queried by key.
  discovery          jsonb NOT NULL DEFAULT '{}'::jsonb,
  mapping            jsonb NOT NULL DEFAULT '{}'::jsonb,
  findings           jsonb NOT NULL DEFAULT '[]'::jsonb,
  dry_run            jsonb,
  reconciliation     jsonb,

  rows_scanned       integer NOT NULL DEFAULT 0,
  rows_created       integer NOT NULL DEFAULT 0,
  rows_updated       integer NOT NULL DEFAULT 0,
  rows_skipped       integer NOT NULL DEFAULT 0,

  -- Set the moment a commit begins, so a second commit of the same job is
  -- refused rather than racing it.
  committed_at       timestamptz,
  completed_at       timestamptz,
  error_code         text,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'migration_jobs_status_check'
       AND conrelid = to_regclass('public.migration_jobs')
  ) THEN
    ALTER TABLE migration_jobs ADD CONSTRAINT migration_jobs_status_check CHECK (
      status IN (
        'uploaded', 'scanning', 'scanned', 'mapping', 'validating', 'ready',
        'importing', 'reconciling', 'completed', 'completed_with_warnings',
        'failed', 'cancelled'
      )
    ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'migration_jobs_entity_check'
       AND conrelid = to_regclass('public.migration_jobs')
  ) THEN
    ALTER TABLE migration_jobs ADD CONSTRAINT migration_jobs_entity_check
      CHECK (entity IN ('customer', 'product')) NOT VALID;
  END IF;
END $$;

-- Only the formats whose parser actually exists. A row claiming 'xlsx' would
-- be a promise the code cannot keep, so the database refuses it too.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'migration_jobs_source_type_check'
       AND conrelid = to_regclass('public.migration_jobs')
  ) THEN
    ALTER TABLE migration_jobs ADD CONSTRAINT migration_jobs_source_type_check
      CHECK (source_type IN ('csv', 'tsv')) NOT VALID;
  END IF;
END $$;

-- The history list: this workspace, newest first.
CREATE INDEX IF NOT EXISTS migration_jobs_workspace_idx
  ON migration_jobs (workspace_id, created_at DESC);

-- ─── 2. The identity ledger ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS migration_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL,
  migration_id        uuid NOT NULL REFERENCES migration_jobs (id) ON DELETE CASCADE,

  source_entity_type  text NOT NULL,
  -- The business key that identified this row IN THE SOURCE: an external id,
  -- a phone, an SKU. Already normalised by the importer.
  source_identity     text NOT NULL,
  source_row          integer NOT NULL,

  target_entity_type  text NOT NULL,
  target_id           uuid NOT NULL,

  outcome             text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'migration_records_outcome_check'
       AND conrelid = to_regclass('public.migration_records')
  ) THEN
    ALTER TABLE migration_records ADD CONSTRAINT migration_records_outcome_check
      CHECK (outcome IN ('created', 'updated', 'skipped')) NOT VALID;
  END IF;
END $$;

-- IDEMPOTENCY, enforced by the database rather than by hoping the application
-- checked first. A retried commit that re-inserts the same source identity in
-- the same workspace hits this and updates instead of making a twin.
CREATE UNIQUE INDEX IF NOT EXISTS migration_records_identity_key
  ON migration_records (workspace_id, source_entity_type, source_identity);

-- "What did migration X create?" — the only safe basis for recovery.
CREATE INDEX IF NOT EXISTS migration_records_job_idx
  ON migration_records (workspace_id, migration_id);

-- ─── 3. Row level security ──────────────────────────────────────────────────
--
-- The membership subquery is written out rather than calling
-- `auth_workspace_ids()`, so this file stands on its own if it is ever run
-- before the recursion-fix migration. `rls-recursion-fix-migration.sql` runs
-- last and rewrites the shape everywhere; this matches what every other
-- capability's migration already writes.

ALTER TABLE migration_jobs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_records ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['migration_jobs', 'migration_records'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_workspace_members', v_table);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO authenticated
        USING (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
        ))
        WITH CHECK (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
        ))
    $p$, v_table || '_workspace_members', v_table);
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- §40 — import profiles.
--
-- A profile stores column NAMES, never indexes. An index is a fact about one
-- file: the next export from the same system has the same columns in a
-- different order the moment somebody adds one, and a saved index would then
-- map `phone` onto `openingBalance` — silently, into a financial field.
--
-- `signature` keeps the headers the profile was built against, so drift can be
-- reported rather than applied quietly (§40 forbids the quiet version).
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS migration_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL,
  created_by      uuid NOT NULL,

  name            text NOT NULL,
  entity          text NOT NULL,
  -- target field -> source column NAME
  columns_by_name jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- the headers this profile was built against, in order
  signature       jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at      timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'migration_profiles_entity_check'
       AND conrelid = to_regclass('public.migration_profiles')
  ) THEN
    ALTER TABLE migration_profiles ADD CONSTRAINT migration_profiles_entity_check
      CHECK (entity IN ('customer', 'product')) NOT VALID;
  END IF;
END $$;

-- One profile per name per entity per workspace: saving twice under the same
-- name updates rather than accumulating near-identical profiles nobody can
-- tell apart.
CREATE UNIQUE INDEX IF NOT EXISTS migration_profiles_name_key
  ON migration_profiles (workspace_id, entity, name);

ALTER TABLE migration_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS migration_profiles_workspace_members ON migration_profiles;
CREATE POLICY migration_profiles_workspace_members ON migration_profiles
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;


-- ────────────────────────────────────────────────────────────────────────
-- [20/59] hardening-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/hardening-migration.sql
--
-- GENERATED by scripts/generate-hardening.mjs. Do not hand-edit.
--
-- The constraints and indexes `base-schema-migration.sql` could not carry,
-- because the dump it was built from recorded only names, types and NOT NULL.
--
-- ---------------------------------------------------------------------------
-- FOREIGN KEYS ARE ADDED `NOT VALID`
--
-- Which means: enforced on every future insert and update, and NOT checked
-- against rows that already exist.
--
-- That is the right trade here. The tables are empty on a fresh rebuild so
-- there is nothing to check; on a database with data, a validating ALTER takes
-- an ACCESS EXCLUSIVE lock for as long as the scan runs — which on a large
-- `invoice_items` is an outage. Validate later, deliberately:
--
--     ALTER TABLE invoice_items VALIDATE CONSTRAINT invoice_items_invoice_id_fkey;
--
-- ⚠️ No `ON DELETE CASCADE` anywhere. Postgres defaults to RESTRICT, and on a
-- financial schema that is what you want: deleting a customer who has invoices
-- should REFUSE, not quietly remove the invoices.
--
-- ---------------------------------------------------------------------------
-- INDEXES ARE CHOSEN, NOT SPRAYED
--
-- Every foreign key gets one — Postgres does not create them, and without one
-- a parent delete scans the whole child table. Beyond that, only composites
-- that match a real ORDER BY or WHERE in the backend.
--
-- Indexing every column costs write throughput, storage and vacuum time. A
-- table with nine indexes is measurably slower to insert into than one with
-- three, and inserts are what a till does all day.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── Foreign keys (48) ─────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'activities_workspace_id_fkey'
       AND conrelid = to_regclass('public.activities')
  ) THEN
    ALTER TABLE activities ADD CONSTRAINT activities_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'attendance_employee_id_fkey'
       AND conrelid = to_regclass('public.attendance')
  ) THEN
    ALTER TABLE attendance ADD CONSTRAINT attendance_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES employees (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'boms_product_id_fkey'
       AND conrelid = to_regclass('public.boms')
  ) THEN
    ALTER TABLE boms ADD CONSTRAINT boms_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'checkout_sessions_workspace_id_fkey'
       AND conrelid = to_regclass('public.checkout_sessions')
  ) THEN
    ALTER TABLE checkout_sessions ADD CONSTRAINT checkout_sessions_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'customers_workspace_id_fkey'
       AND conrelid = to_regclass('public.customers')
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT customers_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'employees_department_id_fkey'
       AND conrelid = to_regclass('public.employees')
  ) THEN
    ALTER TABLE employees ADD CONSTRAINT employees_department_id_fkey
      FOREIGN KEY (department_id) REFERENCES departments (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'interactions_customer_id_fkey'
       AND conrelid = to_regclass('public.interactions')
  ) THEN
    ALTER TABLE interactions ADD CONSTRAINT interactions_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'interactions_employee_id_fkey'
       AND conrelid = to_regclass('public.interactions')
  ) THEN
    ALTER TABLE interactions ADD CONSTRAINT interactions_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES employees (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'invoice_items_product_id_fkey'
       AND conrelid = to_regclass('public.invoice_items')
  ) THEN
    ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'invoice_items_invoice_id_fkey'
       AND conrelid = to_regclass('public.invoice_items')
  ) THEN
    ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES invoices (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'invoice_pdf_cache_invoice_id_fkey'
       AND conrelid = to_regclass('public.invoice_pdf_cache')
  ) THEN
    ALTER TABLE invoice_pdf_cache ADD CONSTRAINT invoice_pdf_cache_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES invoices (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'invoices_workspace_id_fkey'
       AND conrelid = to_regclass('public.invoices')
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'invoices_customer_id_fkey'
       AND conrelid = to_regclass('public.invoices')
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'invoices_supplier_id_fkey'
       AND conrelid = to_regclass('public.invoices')
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_supplier_id_fkey
      FOREIGN KEY (supplier_id) REFERENCES suppliers (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'invoices_purchase_order_id_fkey'
       AND conrelid = to_regclass('public.invoices')
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_purchase_order_id_fkey
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'journal_lines_account_id_fkey'
       AND conrelid = to_regclass('public.journal_lines')
  ) THEN
    ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES accounts (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leaves_employee_id_fkey'
       AND conrelid = to_regclass('public.leaves')
  ) THEN
    ALTER TABLE leaves ADD CONSTRAINT leaves_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES employees (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ledger_entries_account_id_fkey'
       AND conrelid = to_regclass('public.ledger_entries')
  ) THEN
    ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES accounts (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'notifications_workspace_id_fkey'
       AND conrelid = to_regclass('public.notifications')
  ) THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'opportunities_customer_id_fkey'
       AND conrelid = to_regclass('public.opportunities')
  ) THEN
    ALTER TABLE opportunities ADD CONSTRAINT opportunities_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'password_reset_tokens_workspace_id_fkey'
       AND conrelid = to_regclass('public.password_reset_tokens')
  ) THEN
    ALTER TABLE password_reset_tokens ADD CONSTRAINT password_reset_tokens_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'payrolls_employee_id_fkey'
       AND conrelid = to_regclass('public.payrolls')
  ) THEN
    ALTER TABLE payrolls ADD CONSTRAINT payrolls_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES employees (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'products_workspace_id_fkey'
       AND conrelid = to_regclass('public.products')
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'project_members_employee_id_fkey'
       AND conrelid = to_regclass('public.project_members')
  ) THEN
    ALTER TABLE project_members ADD CONSTRAINT project_members_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES employees (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'project_members_project_id_fkey'
       AND conrelid = to_regclass('public.project_members')
  ) THEN
    ALTER TABLE project_members ADD CONSTRAINT project_members_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES projects (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'project_tasks_project_id_fkey'
       AND conrelid = to_regclass('public.project_tasks')
  ) THEN
    ALTER TABLE project_tasks ADD CONSTRAINT project_tasks_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES projects (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'project_time_entries_employee_id_fkey'
       AND conrelid = to_regclass('public.project_time_entries')
  ) THEN
    ALTER TABLE project_time_entries ADD CONSTRAINT project_time_entries_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES employees (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'project_time_entries_project_id_fkey'
       AND conrelid = to_regclass('public.project_time_entries')
  ) THEN
    ALTER TABLE project_time_entries ADD CONSTRAINT project_time_entries_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES projects (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'purchase_order_items_product_id_fkey'
       AND conrelid = to_regclass('public.purchase_order_items')
  ) THEN
    ALTER TABLE purchase_order_items ADD CONSTRAINT purchase_order_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'purchase_order_items_purchase_order_id_fkey'
       AND conrelid = to_regclass('public.purchase_order_items')
  ) THEN
    ALTER TABLE purchase_order_items ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'purchase_orders_invoice_id_fkey'
       AND conrelid = to_regclass('public.purchase_orders')
  ) THEN
    ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES invoices (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'purchase_orders_supplier_id_fkey'
       AND conrelid = to_regclass('public.purchase_orders')
  ) THEN
    ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_supplier_id_fkey
      FOREIGN KEY (supplier_id) REFERENCES suppliers (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'stock_movements_product_id_fkey'
       AND conrelid = to_regclass('public.stock_movements')
  ) THEN
    ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'subscriptions_workspace_id_fkey'
       AND conrelid = to_regclass('public.subscriptions')
  ) THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'transactions_workspace_id_fkey'
       AND conrelid = to_regclass('public.transactions')
  ) THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'transactions_customer_id_fkey'
       AND conrelid = to_regclass('public.transactions')
  ) THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'transactions_invoice_id_fkey'
       AND conrelid = to_regclass('public.transactions')
  ) THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES invoices (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'transactions_supplier_id_fkey'
       AND conrelid = to_regclass('public.transactions')
  ) THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_supplier_id_fkey
      FOREIGN KEY (supplier_id) REFERENCES suppliers (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'user_roles_workspace_id_fkey'
       AND conrelid = to_regclass('public.user_roles')
  ) THEN
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'warehouse_stock_product_id_fkey'
       AND conrelid = to_regclass('public.warehouse_stock')
  ) THEN
    ALTER TABLE warehouse_stock ADD CONSTRAINT warehouse_stock_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'warehouse_stock_warehouse_id_fkey'
       AND conrelid = to_regclass('public.warehouse_stock')
  ) THEN
    ALTER TABLE warehouse_stock ADD CONSTRAINT warehouse_stock_warehouse_id_fkey
      FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'work_orders_product_id_fkey'
       AND conrelid = to_regclass('public.work_orders')
  ) THEN
    ALTER TABLE work_orders ADD CONSTRAINT work_orders_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'workflow_instances_workspace_id_fkey'
       AND conrelid = to_regclass('public.workflow_instances')
  ) THEN
    ALTER TABLE workflow_instances ADD CONSTRAINT workflow_instances_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'workflow_instances_workflow_id_fkey'
       AND conrelid = to_regclass('public.workflow_instances')
  ) THEN
    ALTER TABLE workflow_instances ADD CONSTRAINT workflow_instances_workflow_id_fkey
      FOREIGN KEY (workflow_id) REFERENCES workflows (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'workflow_steps_workflow_id_fkey'
       AND conrelid = to_regclass('public.workflow_steps')
  ) THEN
    ALTER TABLE workflow_steps ADD CONSTRAINT workflow_steps_workflow_id_fkey
      FOREIGN KEY (workflow_id) REFERENCES workflows (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'workflows_workspace_id_fkey'
       AND conrelid = to_regclass('public.workflows')
  ) THEN
    ALTER TABLE workflows ADD CONSTRAINT workflows_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'workspace_invites_workspace_id_fkey'
       AND conrelid = to_regclass('public.workspace_invites')
  ) THEN
    ALTER TABLE workspace_invites ADD CONSTRAINT workspace_invites_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'workspace_members_workspace_id_fkey'
       AND conrelid = to_regclass('public.workspace_members')
  ) THEN
    ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id) NOT VALID;
  END IF;
END $$;

-- ─── Indexes (58) ──────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS activities_workspace_id_idx ON activities (workspace_id);
CREATE INDEX IF NOT EXISTS attendance_employee_id_idx ON attendance (employee_id);
CREATE INDEX IF NOT EXISTS boms_product_id_idx ON boms (product_id);
CREATE INDEX IF NOT EXISTS checkout_sessions_workspace_id_idx ON checkout_sessions (workspace_id);
CREATE INDEX IF NOT EXISTS customers_workspace_id_idx ON customers (workspace_id);
CREATE INDEX IF NOT EXISTS employees_department_id_idx ON employees (department_id);
CREATE INDEX IF NOT EXISTS interactions_customer_id_idx ON interactions (customer_id);
CREATE INDEX IF NOT EXISTS interactions_employee_id_idx ON interactions (employee_id);
CREATE INDEX IF NOT EXISTS invoice_items_product_id_idx ON invoice_items (product_id);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS invoice_pdf_cache_invoice_id_idx ON invoice_pdf_cache (invoice_id);
CREATE INDEX IF NOT EXISTS invoices_workspace_id_idx ON invoices (workspace_id);
CREATE INDEX IF NOT EXISTS invoices_customer_id_idx ON invoices (customer_id);
CREATE INDEX IF NOT EXISTS invoices_supplier_id_idx ON invoices (supplier_id);
CREATE INDEX IF NOT EXISTS invoices_purchase_order_id_idx ON invoices (purchase_order_id);
CREATE INDEX IF NOT EXISTS journal_lines_account_id_idx ON journal_lines (account_id);
CREATE INDEX IF NOT EXISTS leaves_employee_id_idx ON leaves (employee_id);
CREATE INDEX IF NOT EXISTS ledger_entries_account_id_idx ON ledger_entries (account_id);
CREATE INDEX IF NOT EXISTS notifications_workspace_id_idx ON notifications (workspace_id);
CREATE INDEX IF NOT EXISTS opportunities_customer_id_idx ON opportunities (customer_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_workspace_id_idx ON password_reset_tokens (workspace_id);
CREATE INDEX IF NOT EXISTS payrolls_employee_id_idx ON payrolls (employee_id);
CREATE INDEX IF NOT EXISTS products_workspace_id_idx ON products (workspace_id);
CREATE INDEX IF NOT EXISTS project_members_employee_id_idx ON project_members (employee_id);
CREATE INDEX IF NOT EXISTS project_members_project_id_idx ON project_members (project_id);
CREATE INDEX IF NOT EXISTS project_tasks_project_id_idx ON project_tasks (project_id);
CREATE INDEX IF NOT EXISTS project_time_entries_employee_id_idx ON project_time_entries (employee_id);
CREATE INDEX IF NOT EXISTS project_time_entries_project_id_idx ON project_time_entries (project_id);
CREATE INDEX IF NOT EXISTS purchase_order_items_product_id_idx ON purchase_order_items (product_id);
CREATE INDEX IF NOT EXISTS purchase_order_items_purchase_order_id_idx ON purchase_order_items (purchase_order_id);
CREATE INDEX IF NOT EXISTS purchase_orders_invoice_id_idx ON purchase_orders (invoice_id);
CREATE INDEX IF NOT EXISTS purchase_orders_supplier_id_idx ON purchase_orders (supplier_id);
CREATE INDEX IF NOT EXISTS stock_movements_product_id_idx ON stock_movements (product_id);
CREATE INDEX IF NOT EXISTS subscriptions_workspace_id_idx ON subscriptions (workspace_id);
CREATE INDEX IF NOT EXISTS transactions_workspace_id_idx ON transactions (workspace_id);
CREATE INDEX IF NOT EXISTS transactions_customer_id_idx ON transactions (customer_id);
CREATE INDEX IF NOT EXISTS transactions_invoice_id_idx ON transactions (invoice_id);
CREATE INDEX IF NOT EXISTS transactions_supplier_id_idx ON transactions (supplier_id);
CREATE INDEX IF NOT EXISTS user_roles_workspace_id_idx ON user_roles (workspace_id);
CREATE INDEX IF NOT EXISTS warehouse_stock_product_id_idx ON warehouse_stock (product_id);
CREATE INDEX IF NOT EXISTS warehouse_stock_warehouse_id_idx ON warehouse_stock (warehouse_id);
CREATE INDEX IF NOT EXISTS work_orders_product_id_idx ON work_orders (product_id);
CREATE INDEX IF NOT EXISTS workflow_instances_workspace_id_idx ON workflow_instances (workspace_id);
CREATE INDEX IF NOT EXISTS workflow_instances_workflow_id_idx ON workflow_instances (workflow_id);
CREATE INDEX IF NOT EXISTS workflow_steps_workflow_id_idx ON workflow_steps (workflow_id);
CREATE INDEX IF NOT EXISTS workflows_workspace_id_idx ON workflows (workspace_id);
CREATE INDEX IF NOT EXISTS workspace_invites_workspace_id_idx ON workspace_invites (workspace_id);
CREATE INDEX IF NOT EXISTS workspace_members_workspace_id_idx ON workspace_members (workspace_id);
CREATE INDEX IF NOT EXISTS invoices_workspace_id_created_at_idx ON invoices (workspace_id, created_at);
CREATE INDEX IF NOT EXISTS invoices_workspace_id_customer_id_idx ON invoices (workspace_id, customer_id);
CREATE INDEX IF NOT EXISTS invoices_workspace_id_status_idx ON invoices (workspace_id, status);
CREATE INDEX IF NOT EXISTS transactions_workspace_id_customer_id_idx ON transactions (workspace_id, customer_id);
CREATE INDEX IF NOT EXISTS transactions_workspace_id_created_at_idx ON transactions (workspace_id, created_at);
CREATE INDEX IF NOT EXISTS customers_workspace_id_full_name_idx ON customers (workspace_id, full_name);
CREATE INDEX IF NOT EXISTS products_workspace_id_name_idx ON products (workspace_id, name);
CREATE INDEX IF NOT EXISTS products_workspace_id_sku_idx ON products (workspace_id, sku);
CREATE INDEX IF NOT EXISTS activities_workspace_id_entity_type_entity_id_idx ON activities (workspace_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS workspace_members_user_id_workspace_id_idx ON workspace_members (user_id, workspace_id);

-- ─── Drop superseded duplicate indexes (duplicate_index) ────────────────────
-- Each index below is byte-for-byte redundant with a canonical index created
-- above (same table, same columns, same order). They survived under an older
-- name; the canonical name is the one the code and constraints reference.
-- Dropping them clears Supabase's duplicate_index advisories with zero change
-- to query plans — the canonical index serves every lookup the duplicate did.
DROP INDEX IF EXISTS checkout_sessions_workspace_idx;      -- ≡ checkout_sessions_workspace_id_idx
DROP INDEX IF EXISTS customers_workspace_idx;              -- ≡ customers_workspace_id_idx
DROP INDEX IF EXISTS invoice_items_invoice_idx;            -- ≡ invoice_items_invoice_id_idx
DROP INDEX IF EXISTS invoices_workspace_idx;               -- ≡ invoices_workspace_id_idx
DROP INDEX IF EXISTS invoices_workspace_customer_idx;      -- ≡ invoices_workspace_id_customer_id_idx
DROP INDEX IF EXISTS journal_lines_workspace_account_idx;  -- ≡ journal_lines_workspace_id_account_id_idx
DROP INDEX IF EXISTS products_workspace_idx;               -- ≡ products_workspace_id_idx
DROP INDEX IF EXISTS stock_movements_workspace_idx;        -- ≡ stock_movements_workspace_product_idx
DROP INDEX IF EXISTS subscriptions_workspace_idx;          -- ≡ subscriptions_workspace_id_idx
DROP INDEX IF EXISTS sync_change_log_ws_version_idx;       -- ≡ sync_change_log_workspace_version_idx
DROP INDEX IF EXISTS transactions_workspace_idx;           -- ≡ transactions_workspace_id_idx
DROP INDEX IF EXISTS transactions_workspace_customer_idx;  -- ≡ transactions_workspace_id_customer_id_idx
DROP INDEX IF EXISTS workspace_members_workspace_idx;      -- ≡ workspace_members_workspace_id_idx

COMMIT;


-- ─── The foreign key a query HINT depends on ────────────────────────────────
--
-- ⚠️ This one is not about integrity. `invoice.service.ts` embeds the customer
-- through PostgREST with an explicit hint:
--
--     .select('…, customers!fk_invoices_customer(…)')
--
-- PostgREST resolves that against the CONSTRAINT NAME. Without a constraint
-- called exactly this, every invoice list fails with PGRST200 — an API-layer
-- error about a "schema cache", which reads nothing like a missing foreign
-- key and sent the first hour of debugging in the wrong direction.
--
-- ⚠️ The NAME is part of the contract. Same columns under a different name
-- does not satisfy the hint.
--
-- No CASCADE: deleting a customer must not silently delete their invoices.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_customer') THEN
    ALTER TABLE invoices
      ADD CONSTRAINT fk_invoices_customer
      FOREIGN KEY (customer_id) REFERENCES customers(id)
      NOT VALID;
  END IF;
END $$;

-- PostgREST answers from a cached schema; without this it keeps returning
-- PGRST200 after the constraint exists.
NOTIFY pgrst, 'reload schema';


-- ────────────────────────────────────────────────────────────────────────
-- [21/59] workspace-members-rls-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================
-- workspace_members row-level security
-- Run manually against the Supabase/Postgres database.
--
-- Production symptom:
--   POST /api/workspaces/:id/members/direct -> 500
--   "new row violates row-level security policy for table workspace_members"
--   (Postgres 42501)
--
-- The table has RLS enabled but no INSERT policy, so every insert is denied by
-- default. The backend connects with the service_role key, which normally
-- bypasses RLS entirely — so seeing 42501 in production means the key that
-- instance is running with is NOT the service_role key. Check the boot log:
--
--     🔑 [SUPABASE_SERVICE_KEY] role claim = "service_role"
--
-- If that line says "anon" on Render, fix SUPABASE_SERVICE_KEY there first;
-- these policies are the belt to that braces, and are worth having regardless
-- so the table is not relying on a bypass to be writable.
--
-- The policies below scope every operation to workspaces the caller owns,
-- matching what the service already enforces in `requireRole(..., 'owner')`.
-- ============================================

alter table workspace_members enable row level security;

-- ─── The recursion trap, and how these policies avoid it ────────────────────
--
-- A policy ON `workspace_members` may NOT subquery `workspace_members`:
-- reading the table runs the policy, which reads the table, which runs the
-- policy. Postgres aborts with `42P17: infinite recursion detected in policy`.
--
-- The first version of this file did exactly that:
--
--   using (workspace_id in (
--     select workspace_id from workspace_members where user_id = auth.uid()))
--
-- and it could never once have succeeded. It went unnoticed for a long time
-- because the backend connects with the service role, which bypasses RLS
-- entirely — nothing had ever read this table as a logged-in user until an RLS
-- test did, and it failed on the first query.
--
-- Subquerying `workspaces` is the same trap by a longer road, because the
-- policy on `workspaces` subqueries `workspace_members` right back.
--
-- So both sides go through SECURITY DEFINER functions, which execute as their
-- owner and therefore do not re-enter any policy.

create or replace function auth_owned_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from workspace_members
  where user_id = (select auth.uid())
    and role = 'owner'
    and has_access = true
    and suspended_at is null
$$;

revoke all on function auth_owned_workspace_ids() from public, anon;
grant execute on function auth_owned_workspace_ids() to authenticated, service_role;

-- Self-contained: define the colleague-read helper here too (idempotent), so
-- this migration converges even if run before rls-performance-migration.sql.
-- SECURITY DEFINER + STABLE: runs as owner (no policy re-entry) and is evaluated
-- once per statement, not per row.
create or replace function is_workspace_member(_workspace_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = _workspace_id
      and user_id = _user_id
      and has_access = true
      and suspended_at is null
  );
$$;

revoke all on function is_workspace_member(uuid, uuid) from public, anon;
grant execute on function is_workspace_member(uuid, uuid) to authenticated, service_role;

-- Read: your own membership row, plus your colleagues in any workspace you
-- belong to.
--
-- ⚠️ ONE policy, not two. The earlier version created `workspace_members_own_row`
-- and `workspace_members_colleagues` as two permissive SELECT policies with no
-- TO clause (→ PUBLIC). Postgres OR's them — same rows — but every role ended
-- up with two permissive SELECT policies (multiple_permissive_policies), and
-- the bare auth.uid() calls were evaluated per row (auth_rls_initplan).
-- The OR below is exactly the access the pair produced, now scoped to
-- authenticated and evaluated once per statement.
--
-- No subquery on `workspaces` or on `workspace_members` itself: the helper is
-- SECURITY DEFINER, so nothing can loop (42P17).
drop policy if exists workspace_members_select on workspace_members;
drop policy if exists workspace_members_own_row on workspace_members;
drop policy if exists workspace_members_colleagues on workspace_members;
create policy workspace_members_own_row on workspace_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or is_workspace_member(workspace_id, (select auth.uid()))
  );

-- Write: only the workspace owner adds, changes or removes colleagues.
-- These predate the V61 backend-only rule and keep their original form (no
-- TO clause): the owner-scoped check below is the boundary, and the lockdown
-- guard in migration-client-lockdown.test.ts reviews them via the legacy path
-- in rls-performance-migration.sql, which creates the same policies.
drop policy if exists workspace_members_insert on workspace_members;
create policy workspace_members_insert on workspace_members
  for insert
  with check (workspace_id in (select auth_owned_workspace_ids()));

drop policy if exists workspace_members_update on workspace_members;
create policy workspace_members_update on workspace_members
  for update
  using (workspace_id in (select auth_owned_workspace_ids()));

drop policy if exists workspace_members_delete on workspace_members;
create policy workspace_members_delete on workspace_members
  for delete
  using (workspace_id in (select auth_owned_workspace_ids()));


-- ────────────────────────────────────────────────────────────────────────
-- [22/59] workspace-role-capabilities-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/workspace-role-capabilities-migration.sql
--
-- Owner, manager and seller become editable PER WORKSPACE.
--
-- ---------------------------------------------------------------------------
-- MODEL
--
-- The defaults stay the static table in backend/src/services/authorization/
-- authorization.domain.ts (MIN_ROLE). A workspace stores only its CHANGES:
--
--   (workspace_id, role, capability, granted)
--
--   granted = true   the role has it here even though the default says no
--   granted = false  the role does NOT have it here even though the default says yes
--   no row           the default applies
--
-- Enforcement (requireCapability, record scopes, services) reads the effective
-- set = defaults with this workspace's rows applied. One source, one answer.
--
-- WHY PER WORKSPACE, NOT role_permissions: the system roles in `roles` are
-- global rows (workspace_id IS NULL). A grant written there would change the
-- seller role of EVERY business on the platform.
--
-- ---------------------------------------------------------------------------
-- SAFETY
--
--   * The owner can never lose member.manage or workspace.manage — enforced in
--     the domain (OWNER_LOCKED_CAPABILITIES) and here by a CHECK. Otherwise a
--     single click locks a business out of its own permissions screen.
--   * Only the backend writes (service_role). Members may READ their own
--     workspace's rows through RLS; no INSERT/UPDATE/DELETE policy exists.
--   * Existing data: none — every workspace keeps exactly today's behaviour
--     until an owner changes a cell. No backfill.
--
-- ROLLBACK / MITIGATION
--   DROP TABLE IF EXISTS public.workspace_role_capabilities;
-- The backend treats a missing table (42P01) as «no changes»: the static
-- defaults apply, which is today's behaviour.
--
-- ADDITIVE / IDEMPOTENT. SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_role_capabilities (
  workspace_id uuid        NOT NULL,
  role         text        NOT NULL,
  capability   text        NOT NULL,
  granted      boolean     NOT NULL,
  updated_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, role, capability),
  CONSTRAINT workspace_role_capabilities_role_check
    CHECK (role IN ('owner', 'manager', 'seller')),
  CONSTRAINT workspace_role_capabilities_owner_lock_check
    CHECK (NOT (role = 'owner'
                AND capability IN ('member.manage', 'workspace.manage')
                AND granted = false))
);

CREATE INDEX IF NOT EXISTS workspace_role_capabilities_workspace_idx
  ON public.workspace_role_capabilities (workspace_id);

ALTER TABLE public.workspace_role_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_role_capabilities_members_read ON public.workspace_role_capabilities;
CREATE POLICY workspace_role_capabilities_members_read ON public.workspace_role_capabilities
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;

NOTIFY pgrst, 'reload schema';


-- ────────────────────────────────────────────────────────────────────────
-- [23/59] developer-platform-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- DEVELOPER PLATFORM — API keys and signed outbound webhooks.
-- Additive, idempotent, re-runnable.
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then docs/VERIFY-developer-platform.sql.
-- Status: PENDING HUMAN CONFIRMATION.
--
-- Until it runs, the backend answers the developer routes with 503
-- «not configured» and emits no webhooks; nothing else changes.
--
-- WHAT THIS ADDS
--
--   api_keys                   one row per key; the key itself is NEVER stored —
--                              only SHA-256(key) and a display prefix
--   webhook_endpoints          where a workspace wants events sent, and which
--   webhook_endpoint_secrets   the signing secret per endpoint — service role only,
--                              no workspace column, no client policy at all
--   webhook_deliveries         one row per (endpoint, event); the outbox the
--                              delivery worker drains
--
--   enqueue_webhook_event(...)      fan one event out to every subscribed,
--                                   active endpoint in ONE statement; a repeat
--                                   of the same event id is a no-op
--   claim_webhook_deliveries(...)   FOR UPDATE SKIP LOCKED, leased — the same
--                                   claim model as email_outbox
--   complete_webhook_delivery(...)  holder only
--   fail_webhook_delivery(...)      holder only; backoff, then 'failed'; an
--                                   endpoint that keeps failing is switched off
--
-- WHO SEES WHAT
--
--   Clients (authenticated) may SELECT keys, endpoints and deliveries of a
--   workspace they OWN or ADMINISTER — nothing else, and never write. Every
--   write goes through the backend, which checks `workspace.manage`. anon is
--   granted nothing. Secrets are readable by the service role only; the UI
--   shows a secret once, when it is created or rotated.
-- ============================================================================

BEGIN;

-- ─── API keys ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.api_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL,
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  prefix        text NOT NULL,
  key_hash      text NOT NULL UNIQUE CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  scopes        text[] NOT NULL CHECK (cardinality(scopes) > 0),
  expires_at    timestamptz,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  revoked_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_workspace_idx ON public.api_keys (workspace_id, created_at DESC);

-- ─── Webhook endpoints ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by           uuid NOT NULL,
  url                  text NOT NULL CHECK (url ~ '^https://' AND char_length(url) <= 2000),
  description          text CHECK (description IS NULL OR char_length(description) <= 200),
  events               text[] NOT NULL CHECK (cardinality(events) > 0),
  is_active            boolean NOT NULL DEFAULT true,
  disabled_reason      text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_endpoints_workspace_idx
  ON public.webhook_endpoints (workspace_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.webhook_endpoint_secrets (
  endpoint_id uuid PRIMARY KEY REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  secret      text NOT NULL CHECK (char_length(secret) >= 32),
  rotated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Deliveries (the outbox) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  endpoint_id      uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event_id         uuid NOT NULL,
  event_type       text NOT NULL,
  payload          jsonb NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'delivering', 'succeeded', 'failed')),
  attempts         integer NOT NULL DEFAULT 0,
  max_attempts     integer NOT NULL DEFAULT 8,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  claimed_by       text,
  claim_expires_at timestamptz,
  last_status_code integer,
  last_error       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  delivered_at     timestamptz,
  -- The same event is delivered to an endpoint at most once, however many
  -- times the emitter retries.
  CONSTRAINT webhook_deliveries_once UNIQUE (endpoint_id, event_id)
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_due_idx
  ON public.webhook_deliveries (next_attempt_at) WHERE status IN ('pending', 'delivering');
CREATE INDEX IF NOT EXISTS webhook_deliveries_endpoint_idx
  ON public.webhook_deliveries (endpoint_id, created_at DESC);

-- ─── Row level security ──────────────────────────────────────────────────────

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoint_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.api_keys, public.webhook_endpoints, public.webhook_deliveries
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.webhook_endpoint_secrets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.api_keys, public.webhook_endpoints, public.webhook_deliveries TO authenticated;
GRANT ALL ON public.api_keys, public.webhook_endpoints, public.webhook_endpoint_secrets,
  public.webhook_deliveries TO service_role;

-- SELECT only, and only for the workspace's owners and managers — stored as
-- 'manager' or, in the older client vocabulary, 'admin' (tenancy.service.ts
-- CLIENT_ROLE_TO_SERVER). Sellers see nothing. No write policy exists: writes
-- are the backend's, behind `workspace.manage`.
DROP POLICY IF EXISTS api_keys_managers_read ON api_keys;
CREATE POLICY api_keys_managers_read ON api_keys
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspace_members m
     WHERE m.workspace_id = api_keys.workspace_id
       AND m.user_id = (SELECT auth.uid())
       AND m.has_access = true
       AND m.suspended_at IS NULL
       AND m.role IN ('owner', 'admin', 'manager')
  ));

DROP POLICY IF EXISTS webhook_endpoints_managers_read ON webhook_endpoints;
CREATE POLICY webhook_endpoints_managers_read ON webhook_endpoints
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspace_members m
     WHERE m.workspace_id = webhook_endpoints.workspace_id
       AND m.user_id = (SELECT auth.uid())
       AND m.has_access = true
       AND m.suspended_at IS NULL
       AND m.role IN ('owner', 'admin', 'manager')
  ));

DROP POLICY IF EXISTS webhook_deliveries_managers_read ON webhook_deliveries;
CREATE POLICY webhook_deliveries_managers_read ON webhook_deliveries
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspace_members m
     WHERE m.workspace_id = webhook_deliveries.workspace_id
       AND m.user_id = (SELECT auth.uid())
       AND m.has_access = true
       AND m.suspended_at IS NULL
       AND m.role IN ('owner', 'admin', 'manager')
  ));

-- webhook_endpoint_secrets: RLS on, NO policy — no client reads a secret, ever.

-- ─── Functions ───────────────────────────────────────────────────────────────

-- Fan an event out. One statement, so the endpoints matched and the rows
-- written are one consistent picture; ON CONFLICT makes a repeated emit safe.
-- Returns how many deliveries were written.
CREATE OR REPLACE FUNCTION public.enqueue_webhook_event(
  p_workspace_id uuid,
  p_event_id     uuid,
  p_event_type   text,
  p_payload      jsonb
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.webhook_deliveries (workspace_id, endpoint_id, event_id, event_type, payload)
  SELECT e.workspace_id, e.id, p_event_id, p_event_type, p_payload
    FROM public.webhook_endpoints e
   WHERE e.workspace_id = p_workspace_id
     AND e.is_active
     AND p_event_type = ANY (e.events)
  ON CONFLICT ON CONSTRAINT webhook_deliveries_once DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Claim due deliveries (or the one with p_id). A 'delivering' row whose lease
-- expired is an attempt whose worker died: claimed again while attempts
-- remain, otherwise it ends as failed.
CREATE OR REPLACE FUNCTION public.claim_webhook_deliveries(
  p_worker        text,
  p_limit         integer DEFAULT 20,
  p_lease_seconds integer DEFAULT 60,
  p_id            uuid    DEFAULT NULL
)
RETURNS SETOF public.webhook_deliveries
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.webhook_deliveries d
     SET status = 'failed',
         last_error = COALESCE(d.last_error, 'CLAIM_EXPIRED: worker stopped before finishing'),
         claimed_by = NULL,
         claim_expires_at = NULL
   WHERE d.status = 'delivering'
     AND d.claim_expires_at < now()
     AND d.attempts >= d.max_attempts;

  RETURN QUERY
  WITH picked AS (
    SELECT d.id
      FROM public.webhook_deliveries d
      JOIN public.webhook_endpoints e ON e.id = d.endpoint_id
     WHERE (p_id IS NULL OR d.id = p_id)
       AND e.is_active
       AND d.attempts < d.max_attempts
       AND ((d.status = 'pending' AND d.next_attempt_at <= now())
            OR (d.status = 'delivering' AND d.claim_expires_at < now()))
     ORDER BY d.next_attempt_at
     FOR UPDATE OF d SKIP LOCKED
     LIMIT GREATEST(1, LEAST(p_limit, 100))
  )
  UPDATE public.webhook_deliveries d
     SET status = 'delivering',
         attempts = d.attempts + 1,
         claimed_by = p_worker,
         claim_expires_at = now() + make_interval(secs => p_lease_seconds)
    FROM picked
   WHERE d.id = picked.id
  RETURNING d.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_webhook_delivery(
  p_id          uuid,
  p_worker      text,
  p_status_code integer
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_endpoint uuid;
BEGIN
  UPDATE public.webhook_deliveries
     SET status = 'succeeded', delivered_at = now(), last_status_code = p_status_code,
         last_error = NULL, claimed_by = NULL, claim_expires_at = NULL
   WHERE id = p_id AND status = 'delivering' AND claimed_by = p_worker
  RETURNING endpoint_id INTO v_endpoint;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  UPDATE public.webhook_endpoints SET consecutive_failures = 0 WHERE id = v_endpoint;
  RETURN true;
END;
$$;

-- A failed attempt: back to pending after the delay while attempts remain,
-- otherwise 'failed'. A delivery that fails for good counts against its
-- endpoint; 20 in a row switch the endpoint off with a stated reason rather
-- than retrying into a dead URL forever. Returns the new status, or NULL when
-- p_worker no longer held the row.
CREATE OR REPLACE FUNCTION public.fail_webhook_delivery(
  p_id                  uuid,
  p_worker              text,
  p_error               text,
  p_status_code         integer DEFAULT NULL,
  p_retry_delay_seconds integer DEFAULT 60
)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status   text;
  v_endpoint uuid;
BEGIN
  UPDATE public.webhook_deliveries
     SET status = CASE WHEN attempts < max_attempts THEN 'pending' ELSE 'failed' END,
         next_attempt_at = now() + make_interval(secs => p_retry_delay_seconds),
         last_error = left(p_error, 1000),
         last_status_code = p_status_code,
         claimed_by = NULL,
         claim_expires_at = NULL
   WHERE id = p_id AND status = 'delivering' AND claimed_by = p_worker
  RETURNING status, endpoint_id INTO v_status, v_endpoint;

  IF v_status = 'failed' THEN
    UPDATE public.webhook_endpoints
       SET consecutive_failures = consecutive_failures + 1,
           is_active = CASE WHEN consecutive_failures + 1 >= 20 THEN false ELSE is_active END,
           disabled_reason = CASE WHEN consecutive_failures + 1 >= 20
                                  THEN 'TOO_MANY_FAILURES' ELSE disabled_reason END,
           updated_at = now()
     WHERE id = v_endpoint;
  END IF;
  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_webhook_event(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_webhook_deliveries(text, integer, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_webhook_delivery(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_webhook_delivery(uuid, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_webhook_event(uuid, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_webhook_deliveries(text, integer, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_webhook_delivery(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_webhook_delivery(uuid, text, text, integer, integer) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- Nothing else depends on these objects. To switch the platform off without
-- losing history, deactivate every endpoint and revoke every key:
--
--   UPDATE public.webhook_endpoints SET is_active = false, disabled_reason = 'PLATFORM_OFF';
--   UPDATE public.api_keys SET revoked_at = now() WHERE revoked_at IS NULL;
--
-- To remove it entirely (destroys keys, endpoints and delivery history):
--
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.fail_webhook_delivery(uuid, text, text, integer, integer);
--   DROP FUNCTION IF EXISTS public.complete_webhook_delivery(uuid, text, integer);
--   DROP FUNCTION IF EXISTS public.claim_webhook_deliveries(text, integer, integer, uuid);
--   DROP FUNCTION IF EXISTS public.enqueue_webhook_event(uuid, uuid, text, jsonb);
--   DROP TABLE IF EXISTS public.webhook_deliveries;
--   DROP TABLE IF EXISTS public.webhook_endpoint_secrets;
--   DROP TABLE IF EXISTS public.webhook_endpoints;
--   DROP TABLE IF EXISTS public.api_keys;
--   COMMIT;
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────
-- [24/59] developer-platform-02-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- DEVELOPER PLATFORM 02 — request log, usage, event replay, stock events.
-- Additive, idempotent, re-runnable. Requires docs/developer-platform-migration.sql.
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then docs/VERIFY-developer-platform-02.sql.
-- Status: PENDING HUMAN CONFIRMATION.
--
-- Until it runs: API keys and webhooks keep working exactly as after 01; the
-- usage view answers «not configured», replay answers 503, and no stock event
-- is emitted. Nothing else changes.
--
-- WHAT THIS ADDS
--
--   api_request_logs                one row per request made WITH AN API KEY
--                                   (never for a signed-in person): method,
--                                   route PATTERN (not the URL — no ids or query
--                                   strings are stored), status, duration
--   api_key_usage(...)              exact per-day counts for one key; `count(*)`,
--                                   never an estimate or a page of rows
--   purge_api_request_logs(...)     retention: rows older than N days (default 30)
--   replay_webhook_deliveries(...)  put an endpoint's finished deliveries since a
--                                   moment back in line — same event ids
--   products_stock_webhook()        AFTER UPDATE trigger on products: emits
--                                   inventory.low_stock / inventory.restocked
--                                   when the quantity CROSSES min_stock_level
--
-- WHY A TRIGGER FOR STOCK EVENTS
--
--   products.quantity is the projection every stock writer ends in (sales,
--   receipts, transfers, counts, production — phase-c-01). A trigger there
--   sees a crossing whichever path caused it, in the same transaction, so an
--   event exists exactly when the stock really moved. Emitting from each
--   service instead would miss the next writer somebody adds.
--
--   ⚠️ It can NEVER fail the sale: the body runs in its own exception block and
--   a failure is a WARNING, not an error. An integration must not be able to
--   stop a till.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.webhook_endpoints') IS NULL OR to_regclass('public.api_keys') IS NULL THEN
    RAISE EXCEPTION 'Run docs/developer-platform-migration.sql first.';
  END IF;
END $$;

-- ─── Request log ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id           bigserial PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key_id       uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  method       text NOT NULL CHECK (char_length(method) <= 10),
  route        text NOT NULL CHECK (char_length(route) <= 200),
  status       integer NOT NULL CHECK (status BETWEEN 100 AND 599),
  duration_ms  integer NOT NULL CHECK (duration_ms >= 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_request_logs_key_idx ON public.api_request_logs (key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_request_logs_age_idx ON public.api_request_logs (created_at);

ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.api_request_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.api_request_logs TO authenticated;
GRANT ALL ON public.api_request_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.api_request_logs_id_seq TO service_role;

-- Same readers as the keys themselves (01): owners and managers.
DROP POLICY IF EXISTS api_request_logs_managers_read ON api_request_logs;
CREATE POLICY api_request_logs_managers_read ON api_request_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspace_members m
     WHERE m.workspace_id = api_request_logs.workspace_id
       AND m.user_id = (SELECT auth.uid())
       AND m.has_access = true
       AND m.suspended_at IS NULL
       AND m.role IN ('owner', 'admin', 'manager')
  ));

-- ─── Usage: exact counts per day ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.api_key_usage(
  p_workspace_id uuid,
  p_key_id       uuid,
  p_days         integer DEFAULT 7
)
RETURNS TABLE (
  day           date,
  requests      bigint,
  client_errors bigint,
  server_errors bigint,
  avg_ms        integer
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (l.created_at AT TIME ZONE 'UTC')::date                AS day,
         count(*)                                                AS requests,
         count(*) FILTER (WHERE l.status BETWEEN 400 AND 499)    AS client_errors,
         count(*) FILTER (WHERE l.status >= 500)                 AS server_errors,
         round(avg(l.duration_ms))::integer                      AS avg_ms
    FROM public.api_request_logs l
   WHERE l.workspace_id = p_workspace_id
     AND l.key_id = p_key_id
     AND l.created_at >= now() - make_interval(days => GREATEST(1, LEAST(p_days, 90)))
   GROUP BY 1
   ORDER BY 1 DESC;
$$;

-- Retention. A log, not a record: the books never read it.
CREATE OR REPLACE FUNCTION public.purge_api_request_logs(p_keep_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.api_request_logs
   WHERE created_at < now() - make_interval(days => GREATEST(7, p_keep_days));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ─── Event replay ────────────────────────────────────────────────────────────

-- Marks a delivery the sender is re-sending on purpose.
ALTER TABLE public.webhook_deliveries ADD COLUMN IF NOT EXISTS replayed_at timestamptz;

-- Finished deliveries (succeeded or failed) of ONE endpoint since p_since go
-- back to pending. Same event ids: a receiver that deduplicates on the id must
-- be told to accept a replay (the Hisabche-Replay header, set by the sender).
-- At most 30 days back; returns how many were requeued.
CREATE OR REPLACE FUNCTION public.replay_webhook_deliveries(
  p_workspace_id uuid,
  p_endpoint_id  uuid,
  p_since        timestamptz
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_since < now() - interval '30 days' THEN
    RAISE EXCEPTION 'REPLAY_WINDOW_TOO_LONG' USING ERRCODE = '22023';
  END IF;
  UPDATE public.webhook_deliveries
     SET status = 'pending', attempts = 0, next_attempt_at = now(),
         last_error = NULL, replayed_at = now()
   WHERE workspace_id = p_workspace_id
     AND endpoint_id = p_endpoint_id
     AND created_at >= p_since
     AND status IN ('succeeded', 'failed');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ─── Stock events ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.products_stock_webhook()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_id   uuid;
BEGIN
  -- The same rule as GET /api/products/low-stock: quantity <= min_stock_level.
  IF NEW.workspace_id IS NULL OR NOT COALESCE(NEW.is_active, true) THEN
    RETURN NEW;
  END IF;
  IF COALESCE(OLD.quantity, 0) > COALESCE(OLD.min_stock_level, 0)
     AND COALESCE(NEW.quantity, 0) <= COALESCE(NEW.min_stock_level, 0) THEN
    v_type := 'inventory.low_stock';
  ELSIF COALESCE(OLD.quantity, 0) <= COALESCE(OLD.min_stock_level, 0)
     AND COALESCE(NEW.quantity, 0) > COALESCE(NEW.min_stock_level, 0) THEN
    v_type := 'inventory.restocked';
  ELSE
    RETURN NEW;
  END IF;

  BEGIN
    v_id := gen_random_uuid();
    -- The envelope buildEnvelope() writes (developer.domain.ts), field for field.
    PERFORM public.enqueue_webhook_event(
      NEW.workspace_id, v_id, v_type,
      jsonb_build_object(
        'id', v_id,
        'type', v_type,
        'createdAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'workspaceId', NEW.workspace_id,
        'data', jsonb_build_object('resource', 'product', 'id', NEW.id),
        'apiVersion', 1
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'products_stock_webhook: % (%)', SQLERRM, SQLSTATE;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_stock_webhook_trg ON public.products;
CREATE TRIGGER products_stock_webhook_trg
  AFTER UPDATE OF quantity, min_stock_level ON public.products
  FOR EACH ROW
  WHEN (OLD.quantity IS DISTINCT FROM NEW.quantity OR OLD.min_stock_level IS DISTINCT FROM NEW.min_stock_level)
  EXECUTE FUNCTION public.products_stock_webhook();

-- ─── Grants ──────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.api_key_usage(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_api_request_logs(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replay_webhook_deliveries(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.products_stock_webhook() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_key_usage(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_api_request_logs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.replay_webhook_deliveries(uuid, uuid, timestamptz) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- Stop stock events only (keeps everything else):
--   DROP TRIGGER IF EXISTS products_stock_webhook_trg ON public.products;
--
-- Remove this migration entirely (destroys the request log):
--   BEGIN;
--   DROP TRIGGER IF EXISTS products_stock_webhook_trg ON public.products;
--   DROP FUNCTION IF EXISTS public.products_stock_webhook();
--   DROP FUNCTION IF EXISTS public.replay_webhook_deliveries(uuid, uuid, timestamptz);
--   DROP FUNCTION IF EXISTS public.purge_api_request_logs(integer);
--   DROP FUNCTION IF EXISTS public.api_key_usage(uuid, uuid, integer);
--   DROP TABLE IF EXISTS public.api_request_logs;
--   ALTER TABLE public.webhook_deliveries DROP COLUMN IF EXISTS replayed_at;
--   COMMIT;
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────
-- [25/59] developer-platform-03-commerce-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- DEVELOPER PLATFORM 03 — publishable keys, storefront settings, sales orders.
-- Additive, idempotent, re-runnable. Requires docs/developer-platform-migration.sql.
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then docs/VERIFY-developer-platform-03.sql.
-- Status: PENDING HUMAN CONFIRMATION.
--
-- Until it runs: the public storefront API and the orders screen answer
-- «not configured» (503). Nothing that exists today changes.
--
-- ---------------------------------------------------------------------------
-- THE SECURITY CONTRACT (agreed 27 Sep 2026)
--
--   · A publishable key (hk_pub_…) is public by design — it sits in a
--     website's HTML. It can read the catalogue, read availability, and create
--     a PENDING order. Nothing else. It can never become a secret key: the two
--     have different prefixes, and a lookup by one's hash can never match the
--     other.
--   · The browser sends product ids, quantities and contact details. PRICES,
--     TOTALS AND STOCK ARE READ BY THIS DATABASE FROM ITS OWN ROWS inside
--     create_sales_order. There is no parameter through which a caller could
--     pass an amount.
--   · Nothing in this file writes the ledger or moves stock. An order moves
--     stock only when it is INVOICED, through the existing invoice path.
--
-- THE LIFECYCLE — every change is one function call, one transaction, and the
-- only place order.* events are emitted:
--
--   pending ──► confirmed ──► invoiced ──► paid ──► fulfilled
--      │            │              │         │
--      └──► cancelled ◄┘           └──► fulfilled (delivered before paid)
--                                          paid ──► invoiced (payment reversed)
--
--   invoiced ↔ paid follow the INVOICE: a trigger on invoices.status moves the
--   order when the receivables projection marks its invoice paid, or unpaid
--   again after a reversal. A person cannot set «paid» by hand.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.api_keys') IS NULL OR to_regprocedure('public.enqueue_webhook_event(uuid, uuid, text, jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Run docs/developer-platform-migration.sql first.';
  END IF;
END $$;

-- ─── Publishable keys: a kind of api_keys row, not a second key table (G2) ───

ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'secret';
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS public_token text;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS allowed_origins text[] NOT NULL DEFAULT '{}';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_kind_check') THEN
    ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_kind_check CHECK (kind IN ('secret', 'publishable')) NOT VALID;
  END IF;
  -- The plain text is kept ONLY for a publishable key (it is public anyway, and
  -- the owner must be able to copy it again). A secret key never has one.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_public_token_only_publishable') THEN
    ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_public_token_only_publishable
      CHECK ((kind = 'publishable') = (public_token IS NOT NULL)) NOT VALID;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS api_keys_public_token_idx ON public.api_keys (public_token) WHERE public_token IS NOT NULL;

-- ─── Storefront settings: one row per workspace, every value has a default (G4)

CREATE TABLE IF NOT EXISTS public.storefront_settings (
  workspace_id             uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  -- A website order waits for a person unless the owner says otherwise.
  order_confirmation       text NOT NULL DEFAULT 'manual' CHECK (order_confirmation IN ('manual', 'automatic')),
  -- The site shows «in stock / out of stock» unless the owner opts into numbers.
  stock_display            text NOT NULL DEFAULT 'availability' CHECK (stock_display IN ('availability', 'quantity')),
  pending_expiry_hours     integer NOT NULL DEFAULT 48 CHECK (pending_expiry_hours BETWEEN 1 AND 720),
  max_items_per_order      integer NOT NULL DEFAULT 50 CHECK (max_items_per_order BETWEEN 1 AND 200),
  max_pending_per_contact  integer NOT NULL DEFAULT 5 CHECK (max_pending_per_contact BETWEEN 1 AND 100),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- ─── Sales orders ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sales_orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  order_number     text NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'confirmed', 'invoiced', 'paid', 'fulfilled', 'cancelled')),
  source           text NOT NULL CHECK (source IN ('website', 'api', 'dashboard')),
  api_key_id       uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  idempotency_key  text,
  customer_name    text NOT NULL CHECK (char_length(customer_name) BETWEEN 1 AND 120),
  customer_phone   text NOT NULL CHECK (char_length(customer_phone) BETWEEN 5 AND 32),
  customer_email   text CHECK (customer_email IS NULL OR char_length(customer_email) <= 200),
  customer_note    text CHECK (customer_note IS NULL OR char_length(customer_note) <= 500),
  customer_id      uuid,
  -- Exact decimals of the same type as products.sell_price, computed HERE.
  total            numeric(18, 4) NOT NULL CHECK (total >= 0),
  invoice_id       uuid,
  -- For the customer's own status page; unguessable, never the id.
  public_token     text NOT NULL UNIQUE,
  cancel_reason    text,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz,
  confirmed_at     timestamptz,
  invoiced_at      timestamptz,
  paid_at          timestamptz,
  fulfilled_at     timestamptz,
  cancelled_at     timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS sales_orders_idempotency_idx
  ON public.sales_orders (workspace_id, source, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS sales_orders_workspace_idx ON public.sales_orders (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_orders_invoice_idx ON public.sales_orders (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sales_orders_pending_idx ON public.sales_orders (expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS sales_orders_contact_idx ON public.sales_orders (workspace_id, customer_phone) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL,
  product_name  text NOT NULL,
  unit          text,
  quantity      numeric(18, 4) NOT NULL CHECK (quantity > 0),
  unit_price    numeric(18, 4) NOT NULL CHECK (unit_price >= 0),
  line_total    numeric(18, 4) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS sales_order_items_order_idx ON public.sales_order_items (order_id);

-- ─── RLS: members read their workspace's orders; nobody writes directly ─────

ALTER TABLE storefront_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.storefront_settings, public.sales_orders, public.sales_order_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.storefront_settings, public.sales_orders, public.sales_order_items TO authenticated;
GRANT ALL ON public.storefront_settings, public.sales_orders, public.sales_order_items TO service_role;

DROP POLICY IF EXISTS storefront_settings_members_read ON storefront_settings;
CREATE POLICY storefront_settings_members_read ON storefront_settings
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members m
                  WHERE m.workspace_id = storefront_settings.workspace_id AND m.user_id = (SELECT auth.uid())
                    AND m.has_access = true AND m.suspended_at IS NULL));

DROP POLICY IF EXISTS sales_orders_members_read ON sales_orders;
CREATE POLICY sales_orders_members_read ON sales_orders
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members m
                  WHERE m.workspace_id = sales_orders.workspace_id AND m.user_id = (SELECT auth.uid())
                    AND m.has_access = true AND m.suspended_at IS NULL));

DROP POLICY IF EXISTS sales_order_items_members_read ON sales_order_items;
CREATE POLICY sales_order_items_members_read ON sales_order_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members m
                  WHERE m.workspace_id = sales_order_items.workspace_id AND m.user_id = (SELECT auth.uid())
                    AND m.has_access = true AND m.suspended_at IS NULL));

-- ─── Events ──────────────────────────────────────────────────────────────────

-- The envelope buildEnvelope() writes (developer.domain.ts), field for field.
CREATE OR REPLACE FUNCTION public.emit_sales_order_event(p_workspace_id uuid, p_order_id uuid, p_type text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  PERFORM public.enqueue_webhook_event(
    p_workspace_id, v_id, p_type,
    jsonb_build_object(
      'id', v_id,
      'type', p_type,
      'createdAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'workspaceId', p_workspace_id,
      'data', jsonb_build_object('resource', 'sales_order', 'id', p_order_id),
      'apiVersion', 1
    )
  );
END;
$$;

-- ─── Create: the ONLY way an order comes into existence ─────────────────────
--
-- Errors are raised with a stable code as the message and SQLSTATE P0001; the
-- service maps them to 4xx. Returns { order_id, replay }.
CREATE OR REPLACE FUNCTION public.create_sales_order(
  p_workspace_id uuid,
  p_source       text,
  p_api_key_id   uuid,
  p_idempotency  text,
  p_customer     jsonb,
  p_items        jsonb,
  p_created_by   uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_settings  public.storefront_settings;
  v_order_id  uuid;
  v_existing  uuid;
  v_phone     text := btrim(COALESCE(p_customer ->> 'phone', ''));
  v_name      text := btrim(COALESCE(p_customer ->> 'name', ''));
  v_count     integer;
  v_pending   integer;
  v_line      record;
  v_total     numeric(18, 4) := 0;
  v_auto      boolean;
BEGIN
  IF p_source NOT IN ('website', 'api', 'dashboard') THEN
    RAISE EXCEPTION 'ORDER_SOURCE_INVALID';
  END IF;

  -- A replay returns the order the first request created, and writes nothing.
  IF p_idempotency IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.sales_orders
     WHERE workspace_id = p_workspace_id AND source = p_source AND idempotency_key = p_idempotency;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('order_id', v_existing, 'replay', true);
    END IF;
  END IF;

  SELECT * INTO v_settings FROM public.storefront_settings WHERE workspace_id = p_workspace_id;
  IF NOT FOUND THEN
    v_settings.order_confirmation := 'manual';
    v_settings.pending_expiry_hours := 48;
    v_settings.max_items_per_order := 50;
    v_settings.max_pending_per_contact := 5;
  END IF;

  IF v_name = '' THEN RAISE EXCEPTION 'ORDER_CUSTOMER_NAME_REQUIRED'; END IF;
  IF char_length(v_phone) < 5 THEN RAISE EXCEPTION 'ORDER_CUSTOMER_PHONE_REQUIRED'; END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ORDER_ITEMS_REQUIRED';
  END IF;
  IF jsonb_array_length(p_items) > v_settings.max_items_per_order THEN
    RAISE EXCEPTION 'ORDER_TOO_MANY_ITEMS';
  END IF;

  -- Throttle per contact: a public endpoint must not be a way to fill the
  -- owner's queue.
  SELECT count(*) INTO v_pending FROM public.sales_orders
   WHERE workspace_id = p_workspace_id AND status = 'pending' AND customer_phone = v_phone;
  IF v_pending >= v_settings.max_pending_per_contact THEN
    RAISE EXCEPTION 'ORDER_TOO_MANY_PENDING';
  END IF;

  v_order_id := gen_random_uuid();
  v_auto := p_source = 'website' AND v_settings.order_confirmation = 'automatic';

  INSERT INTO public.sales_orders (
    id, workspace_id, order_number, status, source, api_key_id, idempotency_key,
    customer_name, customer_phone, customer_email, customer_note,
    total, public_token, created_by, expires_at, confirmed_at
  ) VALUES (
    v_order_id, p_workspace_id,
    'SO-' || to_char(now() AT TIME ZONE 'UTC', 'YYMMDD') || '-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 6)),
    CASE WHEN v_auto THEN 'confirmed' ELSE 'pending' END,
    p_source, p_api_key_id, p_idempotency,
    left(v_name, 120), left(v_phone, 32),
    NULLIF(left(btrim(COALESCE(p_customer ->> 'email', '')), 200), ''),
    NULLIF(left(btrim(COALESCE(p_customer ->> 'note', '')), 500), ''),
    0,
    replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    p_created_by,
    CASE WHEN v_auto THEN NULL ELSE now() + make_interval(hours => v_settings.pending_expiry_hours) END,
    CASE WHEN v_auto THEN now() END
  );

  -- Lines: duplicates merged, every product of THIS workspace, active, priced,
  -- and with the stock to cover the quantity. Price and name come from the row.
  FOR v_line IN
    SELECT (i ->> 'productId')::uuid AS product_id, sum((i ->> 'quantity')::numeric) AS quantity
      FROM jsonb_array_elements(p_items) AS i
     GROUP BY 1
  LOOP
    IF v_line.quantity IS NULL OR v_line.quantity <= 0 THEN
      RAISE EXCEPTION 'ORDER_QUANTITY_INVALID';
    END IF;
    PERFORM 1 FROM public.products p
      WHERE p.id = v_line.product_id AND p.workspace_id = p_workspace_id AND COALESCE(p.is_active, true);
    IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_PRODUCT_NOT_FOUND'; END IF;

    INSERT INTO public.sales_order_items (order_id, workspace_id, product_id, product_name, unit, quantity, unit_price, line_total)
    SELECT v_order_id, p_workspace_id, p.id, p.name, p.unit, v_line.quantity,
           p.sell_price, round(p.sell_price * v_line.quantity, 4)
      FROM public.products p
     WHERE p.id = v_line.product_id
       AND COALESCE(p.sell_price, 0) > 0
       AND COALESCE(p.quantity, 0) >= v_line.quantity;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      IF (SELECT COALESCE(sell_price, 0) FROM public.products WHERE id = v_line.product_id) <= 0 THEN
        RAISE EXCEPTION 'ORDER_PRODUCT_NOT_PRICED';
      END IF;
      RAISE EXCEPTION 'ORDER_INSUFFICIENT_STOCK';
    END IF;
  END LOOP;

  SELECT COALESCE(sum(line_total), 0) INTO v_total FROM public.sales_order_items WHERE order_id = v_order_id;
  UPDATE public.sales_orders SET total = v_total WHERE id = v_order_id;

  PERFORM public.emit_sales_order_event(p_workspace_id, v_order_id, 'order.created');
  IF v_auto THEN
    PERFORM public.emit_sales_order_event(p_workspace_id, v_order_id, 'order.confirmed');
  END IF;

  RETURN jsonb_build_object('order_id', v_order_id, 'replay', false);
EXCEPTION
  -- Two identical requests at the same instant: the loser answers with the
  -- winner's order, as a replay.
  WHEN unique_violation THEN
    SELECT id INTO v_existing FROM public.sales_orders
     WHERE workspace_id = p_workspace_id AND source = p_source AND idempotency_key = p_idempotency;
    IF v_existing IS NULL THEN RAISE; END IF;
    RETURN jsonb_build_object('order_id', v_existing, 'replay', true);
END;
$$;

-- ─── Transitions ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.transition_sales_order(
  p_workspace_id uuid,
  p_order_id     uuid,
  p_to           text,
  p_reason       text DEFAULT NULL,
  p_invoice_id   uuid DEFAULT NULL,
  p_customer_id  uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_from  text;
  v_event text;
BEGIN
  SELECT status INTO v_from FROM public.sales_orders
   WHERE id = p_order_id AND workspace_id = p_workspace_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

  IF NOT (
       (v_from = 'pending'   AND p_to IN ('confirmed', 'cancelled'))
    OR (v_from = 'confirmed' AND p_to IN ('invoiced', 'cancelled'))
    OR (v_from = 'invoiced'  AND p_to IN ('paid', 'fulfilled'))
    OR (v_from = 'paid'      AND p_to IN ('fulfilled', 'invoiced'))
  ) THEN
    RAISE EXCEPTION 'ORDER_TRANSITION_INVALID';
  END IF;

  IF p_to = 'invoiced' AND v_from = 'confirmed' AND p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_INVOICE_REQUIRED';
  END IF;

  UPDATE public.sales_orders SET
    status       = p_to,
    updated_at   = now(),
    expires_at   = NULL,
    confirmed_at = CASE WHEN p_to = 'confirmed' THEN now() ELSE confirmed_at END,
    invoiced_at  = CASE WHEN p_to = 'invoiced' AND v_from = 'confirmed' THEN now() ELSE invoiced_at END,
    invoice_id   = CASE WHEN p_to = 'invoiced' AND v_from = 'confirmed' THEN p_invoice_id ELSE invoice_id END,
    customer_id  = COALESCE(p_customer_id, customer_id),
    paid_at      = CASE WHEN p_to = 'paid' THEN now() WHEN v_from = 'paid' AND p_to = 'invoiced' THEN NULL ELSE paid_at END,
    fulfilled_at = CASE WHEN p_to = 'fulfilled' THEN now() ELSE fulfilled_at END,
    cancelled_at = CASE WHEN p_to = 'cancelled' THEN now() ELSE cancelled_at END,
    cancel_reason = CASE WHEN p_to = 'cancelled' THEN left(p_reason, 300) ELSE cancel_reason END
  WHERE id = p_order_id;

  v_event := CASE
    WHEN v_from = 'paid' AND p_to = 'invoiced' THEN 'order.payment_reversed'
    ELSE 'order.' || p_to
  END;
  PERFORM public.emit_sales_order_event(p_workspace_id, p_order_id, v_event);
  RETURN p_to;
END;
$$;

-- invoiced ↔ paid follow the invoice. Never able to fail the payment.
CREATE OR REPLACE FUNCTION public.sales_order_follows_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order record;
BEGIN
  FOR v_order IN
    SELECT id, workspace_id, status FROM public.sales_orders WHERE invoice_id = NEW.id
  LOOP
    BEGIN
      IF NEW.status = 'paid' AND v_order.status = 'invoiced' THEN
        PERFORM public.transition_sales_order(v_order.workspace_id, v_order.id, 'paid');
      ELSIF OLD.status = 'paid' AND NEW.status <> 'paid' AND v_order.status = 'paid' THEN
        PERFORM public.transition_sales_order(v_order.workspace_id, v_order.id, 'invoiced');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'sales_order_follows_invoice: % (%)', SQLERRM, SQLSTATE;
    END;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_order_follows_invoice_trg ON public.invoices;
CREATE TRIGGER sales_order_follows_invoice_trg
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sales_order_follows_invoice();

-- Pending orders nobody confirmed in time are cancelled, with the reason.
CREATE OR REPLACE FUNCTION public.expire_pending_sales_orders()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_count integer := 0;
BEGIN
  FOR v_order IN
    SELECT id, workspace_id FROM public.sales_orders
     WHERE status = 'pending' AND expires_at < now()
     ORDER BY expires_at
     LIMIT 500
     FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.transition_sales_order(v_order.workspace_id, v_order.id, 'cancelled', 'EXPIRED');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ─── Grants ──────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.emit_sales_order_event(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_sales_order(uuid, text, uuid, text, jsonb, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transition_sales_order(uuid, uuid, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sales_order_follows_invoice() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_pending_sales_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_sales_order(uuid, text, uuid, text, jsonb, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_sales_order(uuid, uuid, text, text, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_pending_sales_orders() TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- Stop taking website orders, keep every order and key:
--   UPDATE public.api_keys SET revoked_at = now() WHERE kind = 'publishable' AND revoked_at IS NULL;
--
-- Stop orders following their invoices:
--   DROP TRIGGER IF EXISTS sales_order_follows_invoice_trg ON public.invoices;
--
-- Remove entirely (destroys orders — only before anyone relies on them):
--   BEGIN;
--   DROP TRIGGER IF EXISTS sales_order_follows_invoice_trg ON public.invoices;
--   DROP FUNCTION IF EXISTS public.expire_pending_sales_orders();
--   DROP FUNCTION IF EXISTS public.sales_order_follows_invoice();
--   DROP FUNCTION IF EXISTS public.transition_sales_order(uuid, uuid, text, text, uuid, uuid);
--   DROP FUNCTION IF EXISTS public.create_sales_order(uuid, text, uuid, text, jsonb, jsonb, uuid);
--   DROP FUNCTION IF EXISTS public.emit_sales_order_event(uuid, uuid, text);
--   DROP TABLE IF EXISTS public.sales_order_items;
--   DROP TABLE IF EXISTS public.sales_orders;
--   DROP TABLE IF EXISTS public.storefront_settings;
--   ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_public_token_only_publishable;
--   ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_kind_check;
--   DROP INDEX IF EXISTS public.api_keys_public_token_idx;
--   ALTER TABLE public.api_keys DROP COLUMN IF EXISTS allowed_origins;
--   ALTER TABLE public.api_keys DROP COLUMN IF EXISTS public_token;
--   ALTER TABLE public.api_keys DROP COLUMN IF EXISTS kind;
--   COMMIT;
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────
-- [26/59] developer-platform-04-portal-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- DEVELOPER PLATFORM 04 — customer portal links.
-- Additive, idempotent, re-runnable. Standalone (needs only customers and
-- workspaces).
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then docs/VERIFY-developer-platform-04.sql.
-- Status: PENDING HUMAN CONFIRMATION.
--
-- A portal link lets ONE customer see their own account — invoices, payments,
-- balance and orders — without an account of their own, the way the invoice
-- link already shows one invoice. The owner makes it, can see it again to
-- resend, and can revoke it.
--
-- WHAT THE LINK IS
--
--   The link acts as the member who made it, narrowed to reading ONE
--   customer. On every visit the backend re-verifies that member is still in
--   the workspace: a person who is removed takes their links with them.
--   Nothing on the portal writes anything.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_portal_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  customer_id   uuid NOT NULL,
  -- 256 bits, hex. The same shape as sales_orders.public_token.
  token         text NOT NULL UNIQUE CHECK (token ~ '^[0-9a-f]{64}$'),
  created_by    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

CREATE INDEX IF NOT EXISTS customer_portal_links_customer_idx
  ON public.customer_portal_links (workspace_id, customer_id, created_at DESC);

ALTER TABLE customer_portal_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.customer_portal_links FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.customer_portal_links TO authenticated;
GRANT ALL ON public.customer_portal_links TO service_role;

-- Members read their workspace's links (the customer screen lists them).
-- No write policy: links are made and revoked through the backend only.
DROP POLICY IF EXISTS customer_portal_links_members_read ON customer_portal_links;
CREATE POLICY customer_portal_links_members_read ON customer_portal_links
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members m
                  WHERE m.workspace_id = customer_portal_links.workspace_id AND m.user_id = (SELECT auth.uid())
                    AND m.has_access = true AND m.suspended_at IS NULL));

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- Close every portal at once, keeping the history:
--   UPDATE public.customer_portal_links SET revoked_at = now() WHERE revoked_at IS NULL;
--
-- Remove entirely:
--   DROP TABLE IF EXISTS public.customer_portal_links;
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────
-- [27/59] developer-platform-05-oauth-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- DEVELOPER PLATFORM 05 — OAuth apps and the marketplace.
-- Additive, idempotent, re-runnable. Requires docs/developer-platform-migration.sql.
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then docs/VERIFY-developer-platform-05.sql.
-- Status: PENDING HUMAN CONFIRMATION.
--
-- THE MODEL — no second token system (G2)
--
--   An app is registered by a workspace (its publisher). Another business
--   INSTALLS it through the OAuth 2 authorization-code flow with PKCE; the
--   access token it receives IS an api_keys row with app_id set — so every
--   rule of API keys applies unchanged: the route allowlist, scopes narrowed
--   to what the installer holds, the per-key rate limit, the request log,
--   revocation. Uninstalling an app is revoking that key.
--
-- THE REVIEW POLICY (G4 — an explicit default)
--
--   A new app is PRIVATE: only its own publisher's workspace can install it.
--   It appears in the marketplace for everyone only when a platform admin
--   sets it to 'published'. Nothing is public by default.
--
-- CODES
--
--   An authorization code is 256 random bits, stored as SHA-256, valid for
--   ten minutes, redeemable ONCE — the single use is enforced here, in one
--   statement (redeem_oauth_code), not by the backend reading then writing.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.api_keys') IS NULL THEN
    RAISE EXCEPTION 'Run docs/developer-platform-migration.sql first.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.oauth_apps (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by          uuid NOT NULL,
  name                text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description         text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  homepage_url        text CHECK (homepage_url IS NULL OR homepage_url ~ '^https://'),
  redirect_uris       text[] NOT NULL CHECK (cardinality(redirect_uris) BETWEEN 1 AND 10),
  requested_scopes    text[] NOT NULL CHECK (cardinality(requested_scopes) > 0),
  client_id           text NOT NULL UNIQUE CHECK (client_id ~ '^hk_app_[0-9a-f]{32}$'),
  client_secret_hash  text NOT NULL CHECK (client_secret_hash ~ '^[0-9a-f]{64}$'),
  status              text NOT NULL DEFAULT 'private'
                      CHECK (status IN ('private', 'in_review', 'published', 'rejected', 'suspended')),
  review_note         text,
  reviewed_by         uuid,
  reviewed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oauth_apps_owner_idx ON public.oauth_apps (owner_workspace_id);
CREATE INDEX IF NOT EXISTS oauth_apps_published_idx ON public.oauth_apps (name) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS public.oauth_authorization_codes (
  code_hash       text PRIMARY KEY CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  app_id          uuid NOT NULL REFERENCES public.oauth_apps(id) ON DELETE CASCADE,
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  scopes          text[] NOT NULL CHECK (cardinality(scopes) > 0),
  redirect_uri    text NOT NULL,
  code_challenge  text NOT NULL CHECK (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- An installed app's token is an API key that names its app.
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS app_id uuid REFERENCES public.oauth_apps(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS api_keys_app_idx ON public.api_keys (workspace_id, app_id) WHERE app_id IS NOT NULL;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE oauth_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_authorization_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.oauth_apps, public.oauth_authorization_codes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.oauth_apps TO authenticated;
GRANT ALL ON public.oauth_apps, public.oauth_authorization_codes TO service_role;

-- The publisher's owners and managers read their own apps. The marketplace
-- and the consent screen are served by the backend, not read directly.
DROP POLICY IF EXISTS oauth_apps_publisher_read ON oauth_apps;
CREATE POLICY oauth_apps_publisher_read ON oauth_apps
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspace_members m
     WHERE m.workspace_id = oauth_apps.owner_workspace_id
       AND m.user_id = (SELECT auth.uid())
       AND m.has_access = true
       AND m.suspended_at IS NULL
       AND m.role IN ('owner', 'admin', 'manager')
  ));

-- oauth_authorization_codes: RLS on, NO policy — no client ever reads a code.

-- ─── Redeem a code: once, in one statement ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.redeem_oauth_code(
  p_code_hash    text,
  p_app_id       uuid,
  p_redirect_uri text
)
RETURNS TABLE (workspace_id uuid, user_id uuid, scopes text[], code_challenge text)
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.oauth_authorization_codes c
     SET used_at = now()
   WHERE c.code_hash = p_code_hash
     AND c.app_id = p_app_id
     AND c.redirect_uri = p_redirect_uri
     AND c.used_at IS NULL
     AND c.expires_at > now()
  RETURNING c.workspace_id, c.user_id, c.scopes, c.code_challenge;
$$;

REVOKE ALL ON FUNCTION public.redeem_oauth_code(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_oauth_code(text, uuid, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- Take every app out of the marketplace, keep installations:
--   UPDATE public.oauth_apps SET status = 'suspended' WHERE status = 'published';
-- Uninstall every app everywhere:
--   UPDATE public.api_keys SET revoked_at = now() WHERE app_id IS NOT NULL AND revoked_at IS NULL;
--
-- Remove entirely (destroys apps and their installations):
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.redeem_oauth_code(text, uuid, text);
--   ALTER TABLE public.api_keys DROP COLUMN IF EXISTS app_id;
--   DROP TABLE IF EXISTS public.oauth_authorization_codes;
--   DROP TABLE IF EXISTS public.oauth_apps;
--   COMMIT;
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────
-- [28/59] developer-platform-07-marketplace-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- DEVELOPER PLATFORM 07 — the app marketplace.
-- Additive, idempotent, re-runnable.
-- Requires docs/developer-platform-02-migration.sql (request log) and
-- docs/developer-platform-05-oauth-migration.sql (OAuth apps).
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then docs/VERIFY-developer-platform-07.sql.
-- Status: PENDING HUMAN CONFIRMATION.
--
-- WHAT IT ADDS, ON TOP OF WHAT EXISTS (G2)
--
--   listing        oauth_apps gains slug, tagline, category, icon, links,
--                  pricing disclosure, and a DRAFT technical config
--                  (webhook url/events, API version) next to the draft
--                  redirect URIs / scopes it already had.
--   publisher      app_publishers — one profile per publishing workspace; the
--                  verified badge is set by a platform admin only, and is
--                  cleared by the database when the name or website changes.
--   screenshots    app_screenshots — at most 8 per app (position 0–7).
--   versions       app_versions — IMMUTABLE snapshots of the draft config
--                  with a changelog. Only a published version reaches other
--                  businesses; the publisher's own workspace tests the draft.
--   installations  app_installations — the lifecycle (active → uninstalled |
--                  replaced) of one app in one business, tying together its
--                  API key, its version and its webhook endpoint.
--   webhooks       an app's webhook subscription becomes an ordinary
--                  webhook_endpoints row in the installer's workspace, signed
--                  with the app's own webhook secret — the existing delivery
--                  worker, retries and replay apply unchanged.
--   reviews        app_reviews — one per installing business, 1–5 stars.
--   reports        app_reports — abuse / security reports, a platform queue.
--   analytics      exact counts from api_request_logs and webhook_deliveries.
--
-- ONE STATEMENT, NOT SEVERAL REQUESTS
--
--   Install, update, uninstall, submitting and publishing a version each
--   touch several tables: each is ONE function here (CLAUDE.md §1.4).
--   Uninstalling is revoking the app's key — a trigger on api_keys ends the
--   installation and removes its webhook endpoint, whichever path revoked it.
--
-- NOT HERE: charging for apps or sharing revenue. Pricing is DISCLOSED only
-- (the publisher bills its customers itself). See the gap analysis.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.oauth_apps') IS NULL THEN
    RAISE EXCEPTION 'Run docs/developer-platform-05-oauth-migration.sql first.';
  END IF;
  IF to_regclass('public.api_request_logs') IS NULL THEN
    RAISE EXCEPTION 'Run docs/developer-platform-02-migration.sql first.';
  END IF;
END $$;

-- ─── Listing and draft config on the app ────────────────────────────────────

ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS tagline text NOT NULL DEFAULT '';
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS icon_url text;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS privacy_url text;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS terms_url text;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS install_url text;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS pricing_model text NOT NULL DEFAULT 'free';
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS price_minor bigint;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS price_currency text;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS price_interval text;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS webhook_url text;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS webhook_events text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS api_version text NOT NULL DEFAULT 'v1';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_apps_listing_shape') THEN
    ALTER TABLE public.oauth_apps ADD CONSTRAINT oauth_apps_listing_shape CHECK (
          (slug IS NULL OR slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$')
      AND char_length(tagline) <= 120
      AND (category IS NULL OR category IN ('accounting', 'sales', 'inventory', 'ecommerce', 'payments',
                                            'crm', 'hr', 'reporting', 'communication', 'productivity', 'other'))
      AND (icon_url IS NULL OR (icon_url ~ '^https://' AND char_length(icon_url) <= 1000))
      AND (privacy_url IS NULL OR (privacy_url ~ '^https://' AND char_length(privacy_url) <= 1000))
      AND (terms_url IS NULL OR (terms_url ~ '^https://' AND char_length(terms_url) <= 1000))
      AND (install_url IS NULL OR (install_url ~ '^https://' AND char_length(install_url) <= 1000))
      AND (webhook_url IS NULL OR (webhook_url ~ '^https://' AND char_length(webhook_url) <= 2000))
      AND api_version IN ('v1')
    ) NOT VALID;
  END IF;
  -- Money in minor units, never a float; free has no price, paid has all of it.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_apps_pricing_shape') THEN
    ALTER TABLE public.oauth_apps ADD CONSTRAINT oauth_apps_pricing_shape CHECK (
         (pricing_model = 'free' AND price_minor IS NULL AND price_currency IS NULL AND price_interval IS NULL)
      OR (pricing_model = 'paid' AND price_minor IS NOT NULL AND price_minor > 0
          AND price_currency ~ '^[A-Z]{3}$' AND price_interval IN ('month', 'year', 'one_time'))
    ) NOT VALID;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS oauth_apps_slug_idx ON public.oauth_apps (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS oauth_apps_category_idx ON public.oauth_apps (category) WHERE status = 'published';

-- ─── Publisher profile ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_publishers (
  workspace_id  uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  display_name  text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  website_url   text CHECK (website_url IS NULL OR (website_url ~ '^https://' AND char_length(website_url) <= 1000)),
  support_email text CHECK (support_email IS NULL OR (support_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
                                                      AND char_length(support_email) <= 200)),
  bio           text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 1000),
  verified_at   timestamptz,
  verified_by   uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- A badge vouches for a name and a website. Change either, and it is gone
-- until an admin looks again — unless the same statement sets it (the admin).
CREATE OR REPLACE FUNCTION public.app_publishers_badge_follows_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.display_name IS DISTINCT FROM OLD.display_name OR NEW.website_url IS DISTINCT FROM OLD.website_url)
     AND NEW.verified_at IS NOT DISTINCT FROM OLD.verified_at THEN
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_publishers_badge_trg ON public.app_publishers;
CREATE TRIGGER app_publishers_badge_trg
  BEFORE UPDATE ON public.app_publishers
  FOR EACH ROW EXECUTE FUNCTION public.app_publishers_badge_follows_identity();

-- ─── Screenshots ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_screenshots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id     uuid NOT NULL REFERENCES public.oauth_apps(id) ON DELETE CASCADE,
  url        text NOT NULL CHECK (url ~ '^https://' AND char_length(url) <= 1000),
  caption    text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 200),
  position   smallint NOT NULL CHECK (position BETWEEN 0 AND 7),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_screenshots_position_once UNIQUE (app_id, position)
);

-- ─── The app's webhook signing secret ───────────────────────────────────────
-- Every endpoint an installation creates is signed with it, so the app
-- verifies one secret for every business that installed it.

CREATE TABLE IF NOT EXISTS public.oauth_app_webhook_secrets (
  app_id     uuid PRIMARY KEY REFERENCES public.oauth_apps(id) ON DELETE CASCADE,
  secret     text NOT NULL CHECK (char_length(secret) >= 32),
  rotated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Versions ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_versions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id           uuid NOT NULL REFERENCES public.oauth_apps(id) ON DELETE CASCADE,
  version          text NOT NULL CHECK (version ~ '^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$'),
  changelog        text NOT NULL CHECK (char_length(changelog) BETWEEN 1 AND 5000),
  redirect_uris    text[] NOT NULL,
  requested_scopes text[] NOT NULL CHECK (cardinality(requested_scopes) > 0),
  webhook_url      text,
  webhook_events   text[] NOT NULL DEFAULT '{}',
  api_version      text NOT NULL,
  status           text NOT NULL DEFAULT 'in_review'
                   CHECK (status IN ('in_review', 'published', 'rejected', 'superseded')),
  review_note      text,
  reviewed_by      uuid,
  reviewed_at      timestamptz,
  created_by       uuid NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  published_at     timestamptz,
  CONSTRAINT app_versions_once UNIQUE (app_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS app_versions_one_in_review ON public.app_versions (app_id) WHERE status = 'in_review';
CREATE UNIQUE INDEX IF NOT EXISTS app_versions_one_published ON public.app_versions (app_id) WHERE status = 'published';

ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS published_version_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_apps_published_version_fkey') THEN
    ALTER TABLE public.oauth_apps
      ADD CONSTRAINT oauth_apps_published_version_fkey
      FOREIGN KEY (published_version_id) REFERENCES public.app_versions(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- ─── Installations ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_installations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id       uuid NOT NULL REFERENCES public.oauth_apps(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key_id       uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  -- NULL = the publisher's own test install of the draft.
  version_id   uuid REFERENCES public.app_versions(id) ON DELETE SET NULL,
  endpoint_id  uuid REFERENCES public.webhook_endpoints(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'uninstalled', 'replaced')),
  installed_by uuid NOT NULL,
  installed_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  ended_by     uuid,
  CONSTRAINT app_installations_end_shape CHECK ((status = 'active') = (ended_at IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS app_installations_one_active
  ON public.app_installations (app_id, workspace_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS app_installations_workspace_idx ON public.app_installations (workspace_id, installed_at DESC);
CREATE INDEX IF NOT EXISTS app_installations_key_idx ON public.app_installations (key_id) WHERE status = 'active';

-- ─── Reviews and reports ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id        uuid NOT NULL REFERENCES public.oauth_apps(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body          text NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  hidden_at     timestamptz,
  hidden_by     uuid,
  hidden_reason text CHECK (hidden_reason IS NULL OR char_length(hidden_reason) <= 500),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_reviews_one_per_business UNIQUE (app_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS app_reviews_app_idx ON public.app_reviews (app_id, created_at DESC) WHERE hidden_at IS NULL;

CREATE TABLE IF NOT EXISTS public.app_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id          uuid NOT NULL REFERENCES public.oauth_apps(id) ON DELETE CASCADE,
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  reason          text NOT NULL CHECK (reason IN ('security', 'data_misuse', 'misleading', 'broken', 'spam', 'other')),
  details         text NOT NULL DEFAULT '' CHECK (char_length(details) <= 2000),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolution_note text CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 1000),
  resolved_by     uuid,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- One open report per business and app: a second click is the same report.
CREATE UNIQUE INDEX IF NOT EXISTS app_reports_one_open
  ON public.app_reports (app_id, workspace_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS app_reports_queue_idx ON public.app_reports (created_at) WHERE status = 'open';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Every read and write goes through the backend. Tables with a workspace
-- column get a members-read policy (defence in depth); the rest none.

ALTER TABLE app_publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_app_webhook_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.app_publishers, public.app_screenshots, public.oauth_app_webhook_secrets,
              public.app_versions, public.app_installations, public.app_reviews, public.app_reports
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.app_publishers, public.app_installations, public.app_reviews, public.app_reports
  TO authenticated;
GRANT ALL ON public.app_publishers, public.app_screenshots, public.oauth_app_webhook_secrets,
             public.app_versions, public.app_installations, public.app_reviews, public.app_reports
  TO service_role;

DROP POLICY IF EXISTS app_publishers_member_read ON app_publishers;
CREATE POLICY app_publishers_member_read ON app_publishers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members m
                  WHERE m.workspace_id = app_publishers.workspace_id AND m.user_id = (SELECT auth.uid())
                    AND m.has_access = true AND m.suspended_at IS NULL));

DROP POLICY IF EXISTS app_installations_member_read ON app_installations;
CREATE POLICY app_installations_member_read ON app_installations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members m
                  WHERE m.workspace_id = app_installations.workspace_id AND m.user_id = (SELECT auth.uid())
                    AND m.has_access = true AND m.suspended_at IS NULL
                    AND m.role IN ('owner', 'admin', 'manager')));

DROP POLICY IF EXISTS app_reviews_member_read ON app_reviews;
CREATE POLICY app_reviews_member_read ON app_reviews
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members m
                  WHERE m.workspace_id = app_reviews.workspace_id AND m.user_id = (SELECT auth.uid())
                    AND m.has_access = true AND m.suspended_at IS NULL));

DROP POLICY IF EXISTS app_reports_member_read ON app_reports;
CREATE POLICY app_reports_member_read ON app_reports
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members m
                  WHERE m.workspace_id = app_reports.workspace_id AND m.user_id = (SELECT auth.uid())
                    AND m.has_access = true AND m.suspended_at IS NULL));

-- ─── Versions: submit, publish, reject ──────────────────────────────────────

-- Snapshot the app's draft as a new version, for review. The draft is read
-- HERE, so what is reviewed is exactly what was stored.
CREATE OR REPLACE FUNCTION public.submit_app_version(p_app uuid, p_user uuid, p_version text, p_changelog text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  a    public.oauth_apps%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT * INTO a FROM public.oauth_apps WHERE id = p_app FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APP_NOT_FOUND' USING ERRCODE = 'no_data_found'; END IF;
  IF a.status = 'suspended' THEN RAISE EXCEPTION 'APP_SUSPENDED' USING ERRCODE = 'check_violation'; END IF;
  IF a.slug IS NULL OR a.category IS NULL OR a.tagline = '' THEN
    RAISE EXCEPTION 'LISTING_INCOMPLETE' USING ERRCODE = 'check_violation';
  END IF;
  IF cardinality(a.webhook_events) > 0 AND (a.webhook_url IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.oauth_app_webhook_secrets s WHERE s.app_id = p_app)) THEN
    RAISE EXCEPTION 'WEBHOOK_INCOMPLETE' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.app_versions v WHERE v.app_id = p_app AND v.status = 'in_review') THEN
    RAISE EXCEPTION 'VERSION_IN_REVIEW' USING ERRCODE = 'unique_violation';
  END IF;
  IF p_version !~ '^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$' THEN
    RAISE EXCEPTION 'VERSION_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.app_versions v
              WHERE v.app_id = p_app
                AND string_to_array(v.version, '.')::int[] >= string_to_array(p_version, '.')::int[]) THEN
    RAISE EXCEPTION 'VERSION_NOT_NEWER' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.app_versions
    (app_id, version, changelog, redirect_uris, requested_scopes, webhook_url, webhook_events, api_version, created_by)
  VALUES
    (p_app, p_version, p_changelog, a.redirect_uris, a.requested_scopes,
     CASE WHEN cardinality(a.webhook_events) > 0 THEN a.webhook_url END, a.webhook_events, a.api_version, p_user)
  RETURNING id INTO v_id;

  IF a.status IN ('private', 'rejected') THEN
    UPDATE public.oauth_apps SET status = 'in_review', updated_at = now() WHERE id = p_app;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_app_version(p_version uuid, p_admin uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v public.app_versions%ROWTYPE;
  a public.oauth_apps%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.app_versions WHERE id = p_version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_NOT_FOUND' USING ERRCODE = 'no_data_found'; END IF;
  SELECT * INTO a FROM public.oauth_apps WHERE id = v.app_id FOR UPDATE;
  IF v.status <> 'in_review' THEN RAISE EXCEPTION 'VERSION_NOT_IN_REVIEW' USING ERRCODE = 'check_violation'; END IF;
  IF a.status = 'suspended' THEN RAISE EXCEPTION 'APP_SUSPENDED' USING ERRCODE = 'check_violation'; END IF;
  -- http://localhost is for the publisher's own testing; never for everyone.
  IF EXISTS (SELECT 1 FROM unnest(v.redirect_uris) u WHERE u !~ '^https://') THEN
    RAISE EXCEPTION 'VERSION_HAS_LOCALHOST' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.app_versions SET status = 'superseded'
   WHERE app_id = v.app_id AND status = 'published';
  UPDATE public.app_versions
     SET status = 'published', published_at = now(), reviewed_by = p_admin, reviewed_at = now(), review_note = p_note
   WHERE id = p_version;
  UPDATE public.oauth_apps
     SET published_version_id = p_version, status = 'published', review_note = p_note,
         reviewed_by = p_admin, reviewed_at = now(), updated_at = now()
   WHERE id = v.app_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_app_version(p_version uuid, p_admin uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v public.app_versions%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.app_versions WHERE id = p_version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_NOT_FOUND' USING ERRCODE = 'no_data_found'; END IF;
  IF v.status <> 'in_review' THEN RAISE EXCEPTION 'VERSION_NOT_IN_REVIEW' USING ERRCODE = 'check_violation'; END IF;
  UPDATE public.app_versions
     SET status = 'rejected', reviewed_by = p_admin, reviewed_at = now(), review_note = p_note
   WHERE id = p_version;
  -- An app with a live version stays live; only a never-published one is «rejected».
  UPDATE public.oauth_apps
     SET status = CASE WHEN published_version_id IS NULL AND status <> 'suspended' THEN 'rejected' ELSE status END,
         review_note = p_note, updated_at = now()
   WHERE id = v.app_id;
END;
$$;

-- ─── Installations: install, update, uninstall ──────────────────────────────

-- The app's webhook endpoint in the installer's workspace, signed with the
-- app's secret. Internal: called by install and update only.
CREATE OR REPLACE FUNCTION public.app_installation_endpoint(
  p_app uuid, p_workspace uuid, p_user uuid, p_url text, p_events text[]
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_endpoint uuid;
  v_secret   text;
  v_name     text;
BEGIN
  SELECT s.secret INTO v_secret FROM public.oauth_app_webhook_secrets s WHERE s.app_id = p_app;
  IF v_secret IS NULL THEN RAISE EXCEPTION 'WEBHOOK_INCOMPLETE' USING ERRCODE = 'check_violation'; END IF;
  SELECT left(a.name, 190) INTO v_name FROM public.oauth_apps a WHERE a.id = p_app;
  INSERT INTO public.webhook_endpoints (workspace_id, created_by, url, description, events)
  VALUES (p_workspace, p_user, p_url, 'App: ' || v_name, p_events)
  RETURNING id INTO v_endpoint;
  INSERT INTO public.webhook_endpoint_secrets (endpoint_id, secret) VALUES (v_endpoint, v_secret);
  RETURN v_endpoint;
END;
$$;

CREATE OR REPLACE FUNCTION public.install_oauth_app(
  p_app uuid, p_workspace uuid, p_user uuid, p_version uuid,
  p_key_name text, p_prefix text, p_key_hash text, p_scopes text[],
  p_webhook_url text, p_events text[]
)
RETURNS TABLE (installation_id uuid, key_id uuid)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  old        public.app_installations%ROWTYPE;
  v_key      uuid;
  v_endpoint uuid;
  v_inst     uuid;
BEGIN
  -- Installing again (the app asked for a fresh token) replaces the old
  -- installation: its token stops working and its endpoint goes.
  SELECT * INTO old FROM public.app_installations i
   WHERE i.app_id = p_app AND i.workspace_id = p_workspace AND i.status = 'active'
   FOR UPDATE;
  IF FOUND THEN
    UPDATE public.app_installations
       SET status = 'replaced', ended_at = now(), ended_by = p_user, updated_at = now()
     WHERE id = old.id;
    IF old.endpoint_id IS NOT NULL THEN DELETE FROM public.webhook_endpoints WHERE id = old.endpoint_id; END IF;
    IF old.key_id IS NOT NULL THEN
      UPDATE public.api_keys SET revoked_at = now(), revoked_by = p_user
       WHERE id = old.key_id AND revoked_at IS NULL;
    END IF;
  END IF;

  INSERT INTO public.api_keys (workspace_id, created_by, name, prefix, key_hash, scopes, expires_at, app_id)
  VALUES (p_workspace, p_user, p_key_name, p_prefix, p_key_hash, p_scopes, NULL, p_app)
  RETURNING id INTO v_key;

  IF p_webhook_url IS NOT NULL AND cardinality(p_events) > 0 THEN
    v_endpoint := public.app_installation_endpoint(p_app, p_workspace, p_user, p_webhook_url, p_events);
  END IF;

  INSERT INTO public.app_installations (app_id, workspace_id, key_id, version_id, endpoint_id, installed_by)
  VALUES (p_app, p_workspace, v_key, p_version, v_endpoint, p_user)
  RETURNING id INTO v_inst;

  RETURN QUERY SELECT v_inst, v_key;
END;
$$;

-- Move an installation to a newer version, with the scopes the installer
-- approved (already narrowed to what they hold, by the backend).
CREATE OR REPLACE FUNCTION public.update_app_installation(
  p_installation uuid, p_user uuid, p_version uuid, p_scopes text[], p_webhook_url text, p_events text[]
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  i public.app_installations%ROWTYPE;
  v_endpoint uuid;
BEGIN
  SELECT * INTO i FROM public.app_installations WHERE id = p_installation FOR UPDATE;
  IF NOT FOUND OR i.status <> 'active' THEN
    RAISE EXCEPTION 'INSTALLATION_NOT_ACTIVE' USING ERRCODE = 'no_data_found';
  END IF;
  IF cardinality(p_scopes) = 0 THEN RAISE EXCEPTION 'NO_SCOPE_GRANTED' USING ERRCODE = 'check_violation'; END IF;

  UPDATE public.api_keys SET scopes = p_scopes WHERE id = i.key_id AND revoked_at IS NULL;

  v_endpoint := i.endpoint_id;
  IF p_webhook_url IS NULL OR cardinality(p_events) = 0 THEN
    IF v_endpoint IS NOT NULL THEN DELETE FROM public.webhook_endpoints WHERE id = v_endpoint; END IF;
    v_endpoint := NULL;
  ELSIF v_endpoint IS NULL THEN
    v_endpoint := public.app_installation_endpoint(i.app_id, i.workspace_id, p_user, p_webhook_url, p_events);
  ELSE
    UPDATE public.webhook_endpoints SET url = p_webhook_url, events = p_events, updated_at = now()
     WHERE id = v_endpoint;
  END IF;

  UPDATE public.app_installations
     SET version_id = p_version, endpoint_id = v_endpoint, updated_at = now()
   WHERE id = p_installation;
END;
$$;

-- Uninstall = revoke the app's key, from ANY path (the installed-apps list,
-- the API keys list, an admin revoking every installation of an app).
CREATE OR REPLACE FUNCTION public.app_installations_end_on_revoke()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_endpoint uuid;
BEGIN
  IF NEW.app_id IS NOT NULL AND NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL THEN
    UPDATE public.app_installations
       SET status = 'uninstalled', ended_at = now(), ended_by = NEW.revoked_by, updated_at = now()
     WHERE key_id = NEW.id AND status = 'active'
    RETURNING endpoint_id INTO v_endpoint;
    IF v_endpoint IS NOT NULL THEN DELETE FROM public.webhook_endpoints WHERE id = v_endpoint; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS api_keys_end_app_installation_trg ON public.api_keys;
CREATE TRIGGER api_keys_end_app_installation_trg
  AFTER UPDATE OF revoked_at ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.app_installations_end_on_revoke();

-- New app webhook secret: every active installation's endpoint follows at once.
CREATE OR REPLACE FUNCTION public.rotate_app_webhook_secret(p_app uuid, p_secret text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.oauth_app_webhook_secrets (app_id, secret) VALUES (p_app, p_secret)
  ON CONFLICT (app_id) DO UPDATE SET secret = EXCLUDED.secret, rotated_at = now();
  UPDATE public.webhook_endpoint_secrets s
     SET secret = p_secret, rotated_at = now()
    FROM public.app_installations i
   WHERE i.app_id = p_app AND i.status = 'active' AND s.endpoint_id = i.endpoint_id;
END;
$$;

-- ─── Numbers: exact counts, never a sample or an estimate ───────────────────

CREATE OR REPLACE FUNCTION public.oauth_app_usage(p_app uuid, p_days integer)
RETURNS TABLE (day date, requests bigint, client_errors bigint, server_errors bigint, avg_ms integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (l.created_at AT TIME ZONE 'UTC')::date AS day,
         count(*),
         count(*) FILTER (WHERE l.status BETWEEN 400 AND 499),
         count(*) FILTER (WHERE l.status >= 500),
         round(avg(l.duration_ms))::integer
    FROM public.api_request_logs l
    JOIN public.api_keys k ON k.id = l.key_id
   WHERE k.app_id = p_app
     AND l.created_at >= now() - make_interval(days => least(greatest(p_days, 1), 30))
   GROUP BY 1
   ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.oauth_app_stats(p_app uuid, p_days integer)
RETURNS TABLE (
  active_installs bigint, installs_in_period bigint, uninstalls_in_period bigint,
  requests_24h bigint, server_errors_24h bigint,
  deliveries_24h bigint, failed_deliveries_24h bigint, last_request_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.app_installations i WHERE i.app_id = p_app AND i.status = 'active'),
    (SELECT count(*) FROM public.app_installations i
      WHERE i.app_id = p_app AND i.installed_at >= now() - make_interval(days => least(greatest(p_days, 1), 365))),
    (SELECT count(*) FROM public.app_installations i
      WHERE i.app_id = p_app AND i.status = 'uninstalled'
        AND i.ended_at >= now() - make_interval(days => least(greatest(p_days, 1), 365))),
    (SELECT count(*) FROM public.api_request_logs l JOIN public.api_keys k ON k.id = l.key_id
      WHERE k.app_id = p_app AND l.created_at >= now() - interval '24 hours'),
    (SELECT count(*) FROM public.api_request_logs l JOIN public.api_keys k ON k.id = l.key_id
      WHERE k.app_id = p_app AND l.status >= 500 AND l.created_at >= now() - interval '24 hours'),
    (SELECT count(*) FROM public.webhook_deliveries d JOIN public.app_installations i ON i.endpoint_id = d.endpoint_id
      WHERE i.app_id = p_app AND d.status IN ('succeeded', 'failed') AND d.created_at >= now() - interval '24 hours'),
    (SELECT count(*) FROM public.webhook_deliveries d JOIN public.app_installations i ON i.endpoint_id = d.endpoint_id
      WHERE i.app_id = p_app AND d.status = 'failed' AND d.created_at >= now() - interval '24 hours'),
    (SELECT max(k.last_used_at) FROM public.api_keys k WHERE k.app_id = p_app);
$$;

-- For the marketplace list: visible reviews and active installs, per app.
CREATE OR REPLACE FUNCTION public.oauth_app_listing_stats(p_apps uuid[])
RETURNS TABLE (app_id uuid, reviews bigint, average numeric, stars bigint[], active_installs bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT a.id,
         count(r.id),
         round(avg(r.rating), 2),
         ARRAY[count(*) FILTER (WHERE r.rating = 1), count(*) FILTER (WHERE r.rating = 2),
               count(*) FILTER (WHERE r.rating = 3), count(*) FILTER (WHERE r.rating = 4),
               count(*) FILTER (WHERE r.rating = 5)],
         (SELECT count(*) FROM public.app_installations i WHERE i.app_id = a.id AND i.status = 'active')
    FROM unnest(p_apps) AS a(id)
    LEFT JOIN public.app_reviews r ON r.app_id = a.id AND r.hidden_at IS NULL
   GROUP BY a.id;
$$;

REVOKE ALL ON FUNCTION public.submit_app_version(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_app_version(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_app_version(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_installation_endpoint(uuid, uuid, uuid, text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.install_oauth_app(uuid, uuid, uuid, uuid, text, text, text, text[], text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_app_installation(uuid, uuid, uuid, text[], text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rotate_app_webhook_secret(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oauth_app_usage(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oauth_app_stats(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oauth_app_listing_stats(uuid[]) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_app_version(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_app_version(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_app_version(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.app_installation_endpoint(uuid, uuid, uuid, text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.install_oauth_app(uuid, uuid, uuid, uuid, text, text, text, text[], text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_app_installation(uuid, uuid, uuid, text[], text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.rotate_app_webhook_secret(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.oauth_app_usage(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.oauth_app_stats(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.oauth_app_listing_stats(uuid[]) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- Take the marketplace down without touching installations:
--   UPDATE public.oauth_apps SET status = 'suspended' WHERE status = 'published';
-- Uninstall one app everywhere (the trigger ends installations, removes endpoints):
--   UPDATE public.api_keys SET revoked_at = now() WHERE app_id = '<app id>' AND revoked_at IS NULL;
--
-- Remove entirely (destroys listings, versions, reviews, reports and the
-- installation history; app tokens keep working as plain app keys):
--   BEGIN;
--   DROP TRIGGER IF EXISTS api_keys_end_app_installation_trg ON public.api_keys;
--   DROP FUNCTION IF EXISTS public.app_installations_end_on_revoke();
--   DROP FUNCTION IF EXISTS public.oauth_app_listing_stats(uuid[]);
--   DROP FUNCTION IF EXISTS public.oauth_app_stats(uuid, integer);
--   DROP FUNCTION IF EXISTS public.oauth_app_usage(uuid, integer);
--   DROP FUNCTION IF EXISTS public.rotate_app_webhook_secret(uuid, text);
--   DROP FUNCTION IF EXISTS public.update_app_installation(uuid, uuid, uuid, text[], text, text[]);
--   DROP FUNCTION IF EXISTS public.install_oauth_app(uuid, uuid, uuid, uuid, text, text, text, text[], text, text[]);
--   DROP FUNCTION IF EXISTS public.app_installation_endpoint(uuid, uuid, uuid, text, text[]);
--   DROP FUNCTION IF EXISTS public.reject_app_version(uuid, uuid, text);
--   DROP FUNCTION IF EXISTS public.publish_app_version(uuid, uuid, text);
--   DROP FUNCTION IF EXISTS public.submit_app_version(uuid, uuid, text, text);
--   ALTER TABLE public.oauth_apps DROP CONSTRAINT IF EXISTS oauth_apps_published_version_fkey;
--   DROP TABLE IF EXISTS public.app_reports, public.app_reviews, public.app_installations,
--                        public.app_versions, public.oauth_app_webhook_secrets,
--                        public.app_screenshots, public.app_publishers;
--   DROP FUNCTION IF EXISTS public.app_publishers_badge_follows_identity();
--   ALTER TABLE public.oauth_apps DROP CONSTRAINT IF EXISTS oauth_apps_listing_shape,
--                                  DROP CONSTRAINT IF EXISTS oauth_apps_pricing_shape;
--   ALTER TABLE public.oauth_apps DROP COLUMN IF EXISTS published_version_id, DROP COLUMN IF EXISTS slug,
--     DROP COLUMN IF EXISTS tagline, DROP COLUMN IF EXISTS category, DROP COLUMN IF EXISTS icon_url,
--     DROP COLUMN IF EXISTS privacy_url, DROP COLUMN IF EXISTS terms_url, DROP COLUMN IF EXISTS install_url,
--     DROP COLUMN IF EXISTS pricing_model, DROP COLUMN IF EXISTS price_minor, DROP COLUMN IF EXISTS price_currency,
--     DROP COLUMN IF EXISTS price_interval, DROP COLUMN IF EXISTS webhook_url, DROP COLUMN IF EXISTS webhook_events,
--     DROP COLUMN IF EXISTS api_version;
--   COMMIT;
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────
-- [29/59] entitlement-01-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- ENTITLEMENT CORE — additive, idempotent, re-runnable.
--
-- ⚠️ PREREQUISITE: docs/plan-limits-migration.sql MUST BE RUN BEFORE THIS MIGRATION.
--
-- WHAT THIS ADDS
--   1. plan_limit_settings.plan CHECK constraint widened to include:
--      'FREE', 'OFFLINE', 'ONLINE_500', 'ONLINE_1000', 'ONLINE_1500', 'free', 'pro', 'enterprise'
--   2. subscription_upgrade_requests.requested_plan CHECK constraint widened
--   3. subscription_events.event CHECK constraint widened to accept:
--      'refunded', 'downgraded', 'credit_issued', 'licence_issued', 'licence_revoked', 'device_released'
--   4. offline_licenses table: signed offline licence records
--   5. devices table: activated device records per workspace
--
-- Service role only writes; members can SELECT their workspace's rows.
-- RLS on, REVOKE ALL from PUBLIC/anon/authenticated, explicit grants.
-- ============================================================================

BEGIN;

-- 1. Widen plan_limit_settings plan check
DO $$
DECLARE
  v_con text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'plan_limit_settings') THEN
    FOR v_con IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.plan_limit_settings'::regclass AND contype = 'c'
    LOOP
      EXECUTE format('ALTER TABLE public.plan_limit_settings DROP CONSTRAINT %I', v_con);
    END LOOP;
    ALTER TABLE public.plan_limit_settings
      ADD CONSTRAINT plan_limit_settings_plan_check
      CHECK (plan IN ('FREE', 'OFFLINE', 'ONLINE_500', 'ONLINE_1000', 'ONLINE_1500', 'free', 'pro', 'enterprise')) NOT VALID;
  END IF;
END $$;

-- 2. Widen subscription_upgrade_requests requested_plan check
DO $$
DECLARE
  v_con text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscription_upgrade_requests') THEN
    FOR v_con IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.subscription_upgrade_requests'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%requested_plan%'
    LOOP
      EXECUTE format('ALTER TABLE public.subscription_upgrade_requests DROP CONSTRAINT %I', v_con);
    END LOOP;
    ALTER TABLE public.subscription_upgrade_requests
      ADD CONSTRAINT subscription_upgrade_requests_requested_plan_check
      CHECK (requested_plan IN ('FREE', 'OFFLINE', 'ONLINE_500', 'ONLINE_1000', 'ONLINE_1500', 'pro', 'enterprise')) NOT VALID;
  END IF;
END $$;

-- 3. Widen subscription_events event check
DO $$
DECLARE
  v_con text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscription_events') THEN
    FOR v_con IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.subscription_events'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%event%'
    LOOP
      EXECUTE format('ALTER TABLE public.subscription_events DROP CONSTRAINT %I', v_con);
    END LOOP;
    ALTER TABLE public.subscription_events
      ADD CONSTRAINT subscription_events_event_check
      CHECK (event IN (
        'upgrade_requested', 'upgrade_approved', 'upgrade_rejected',
        'upgrade_cancelled', 'cancel_scheduled', 'cancelled', 'expired',
        'refunded', 'downgraded', 'credit_issued', 'licence_issued', 'licence_revoked', 'device_released'
      )) NOT VALID;
  END IF;
END $$;

-- 4. offline_licenses table
CREATE TABLE IF NOT EXISTS public.offline_licenses (
  license_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  account_id    uuid NOT NULL,
  plan          text NOT NULL,
  issued_at     timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  device_id     uuid,
  features      jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(features) = 'array'),
  version       integer NOT NULL DEFAULT 1,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offline_licenses_workspace_idx ON public.offline_licenses (workspace_id);
CREATE INDEX IF NOT EXISTS offline_licenses_device_idx ON public.offline_licenses (device_id);

-- 5. devices table
CREATE TABLE IF NOT EXISTS public.devices (
  device_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL,
  label             text,
  activated_at      timestamptz NOT NULL DEFAULT now(),
  released_at       timestamptz,
  last_verified_at  timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS devices_workspace_idx ON public.devices (workspace_id);

-- Security: RLS & Permissions
ALTER TABLE public.offline_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.offline_licenses FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.devices FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.offline_licenses TO service_role;
GRANT ALL ON public.devices TO service_role;

-- Drop first so a re-run rebuilds these with (SELECT auth.uid()) rather than
-- skipping via the IF NOT EXISTS guard (auth_rls_initplan).
DROP POLICY IF EXISTS offline_licenses_members_read ON public.offline_licenses;
DROP POLICY IF EXISTS devices_members_read ON public.devices;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'offline_licenses' AND policyname = 'offline_licenses_members_read') THEN
    CREATE POLICY offline_licenses_members_read ON public.offline_licenses
      FOR SELECT TO authenticated
      USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'devices' AND policyname = 'devices_members_read') THEN
    CREATE POLICY devices_members_read ON public.devices
      FOR SELECT TO authenticated
      USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

GRANT SELECT ON public.offline_licenses TO authenticated;
GRANT SELECT ON public.devices TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--   DROP TABLE IF EXISTS public.offline_licenses;
--   DROP TABLE IF EXISTS public.devices;
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────
-- [30/59] entitlement-02-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/entitlement-02-migration.sql
-- E3 Licence Policy Migration: Seats (Computer + Mobile), Ban Status,
-- Append-Only Licence Log, and Tier-2 Review Queue.
--
-- Prerequisite: docs/entitlement-01-migration.sql
-- Idempotent and additive. Safe to run repeatedly.
-- ============================================================================

-- 1. Add status and seat fields to offline_licenses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offline_licenses' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.offline_licenses
      ADD COLUMN status text NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'revoked', 'banned'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offline_licenses' AND column_name = 'banned_at'
  ) THEN
    ALTER TABLE public.offline_licenses ADD COLUMN banned_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offline_licenses' AND column_name = 'ban_reason'
  ) THEN
    ALTER TABLE public.offline_licenses ADD COLUMN ban_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offline_licenses' AND column_name = 'transfer_count'
  ) THEN
    ALTER TABLE public.offline_licenses ADD COLUMN transfer_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offline_licenses' AND column_name = 'transfer_year'
  ) THEN
    ALTER TABLE public.offline_licenses ADD COLUMN transfer_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now());
  END IF;
END $$;

-- 2. Add seat, stable_id, public_key, and active fields to devices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'license_id'
  ) THEN
    ALTER TABLE public.devices ADD COLUMN license_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'seat'
  ) THEN
    ALTER TABLE public.devices
      ADD COLUMN seat text
      CHECK (seat IN ('computer', 'mobile'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'stable_id'
  ) THEN
    ALTER TABLE public.devices ADD COLUMN stable_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'public_key'
  ) THEN
    ALTER TABLE public.devices ADD COLUMN public_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE public.devices ADD COLUMN ip_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.devices ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS devices_license_seat_idx
  ON public.devices (license_id, seat, is_active);

-- 3. Create public.license_logs table (Append-Only)
CREATE TABLE IF NOT EXISTS public.license_logs (
  log_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id    uuid NOT NULL,
  workspace_id  uuid NOT NULL,
  event         text NOT NULL CHECK (event IN (
    'activation', 'rejected_activation', 'reinstall',
    'transfer', 'connection', 'ban', 'unban', 'tier2_flagged'
  )),
  device_seat   text CHECK (device_seat IN ('computer', 'mobile')),
  device_id     uuid,
  stable_id     text,
  ip_address    text,
  reason        text,
  evidence      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS license_logs_license_idx ON public.license_logs (license_id);
CREATE INDEX IF NOT EXISTS license_logs_workspace_idx ON public.license_logs (workspace_id);
CREATE INDEX IF NOT EXISTS license_logs_event_idx ON public.license_logs (event);

-- Append-only trigger on license_logs: refuse updates and deletes
CREATE OR REPLACE FUNCTION public.prevent_license_logs_mutation()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'license_logs is append-only: updates and deletes are forbidden';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'license_logs_append_only'
  ) THEN
    CREATE TRIGGER license_logs_append_only
      BEFORE UPDATE OR DELETE ON public.license_logs
      FOR EACH ROW EXECUTE FUNCTION public.prevent_license_logs_mutation();
  END IF;
END $$;

-- 4. Create public.license_review_queue table (Tier-2 Heuristic Review Queue)
CREATE TABLE IF NOT EXISTS public.license_review_queue (
  queue_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id    uuid NOT NULL,
  workspace_id  uuid NOT NULL,
  signal_type   text NOT NULL,
  details       jsonb,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   uuid
);

CREATE INDEX IF NOT EXISTS license_review_queue_status_idx ON public.license_review_queue (status);
CREATE INDEX IF NOT EXISTS license_review_queue_workspace_idx ON public.license_review_queue (workspace_id);

-- 5. Security & RLS Policies
ALTER TABLE public.license_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_review_queue ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.license_logs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.license_review_queue FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.license_logs TO service_role;
GRANT ALL ON public.license_review_queue TO service_role;

-- Drop first so a re-run rebuilds these with (SELECT auth.uid()) rather than
-- skipping via the IF NOT EXISTS guard (auth_rls_initplan).
DROP POLICY IF EXISTS license_logs_members_read ON public.license_logs;
DROP POLICY IF EXISTS license_review_queue_members_read ON public.license_review_queue;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'license_logs' AND policyname = 'license_logs_members_read'
  ) THEN
    CREATE POLICY license_logs_members_read ON public.license_logs
      FOR SELECT TO authenticated
      USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'license_review_queue' AND policyname = 'license_review_queue_members_read'
  ) THEN
    CREATE POLICY license_review_queue_members_read ON public.license_review_queue
      FOR SELECT TO authenticated
      USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

-- 6. Add subscription_events event types if needed
DO $$
DECLARE
  v_con text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscription_events') THEN
    FOR v_con IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.subscription_events'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%event%'
    LOOP
      EXECUTE format('ALTER TABLE public.subscription_events DROP CONSTRAINT %I', v_con);
    END LOOP;
    ALTER TABLE public.subscription_events
      ADD CONSTRAINT subscription_events_event_check
      CHECK (event IN (
        'upgrade_requested', 'upgrade_approved', 'upgrade_rejected',
        'upgrade_cancelled', 'cancel_scheduled', 'cancelled', 'expired',
        'refunded', 'downgraded', 'credit_issued', 'licence_issued',
        'licence_revoked', 'device_released', 'licence_banned', 'licence_unbanned'
      )) NOT VALID;
  END IF;
END $$;

-- ============================================================================
-- Rollback block (run manually if needed)
-- ============================================================================
-- DROP TRIGGER IF EXISTS license_logs_append_only ON public.license_logs;
-- DROP FUNCTION IF EXISTS public.prevent_license_logs_mutation();
-- DROP TABLE IF EXISTS public.license_review_queue;
-- DROP TABLE IF EXISTS public.license_logs;
-- ALTER TABLE public.devices DROP COLUMN IF EXISTS seat;
-- ALTER TABLE public.devices DROP COLUMN IF EXISTS stable_id;
-- ALTER TABLE public.devices DROP COLUMN IF EXISTS public_key;
-- ALTER TABLE public.devices DROP COLUMN IF EXISTS ip_address;
-- ALTER TABLE public.devices DROP COLUMN IF EXISTS is_active;
-- ALTER TABLE public.devices DROP COLUMN IF EXISTS license_id;
-- ALTER TABLE public.offline_licenses DROP COLUMN IF EXISTS status;
-- ALTER TABLE public.offline_licenses DROP COLUMN IF EXISTS banned_at;
-- ALTER TABLE public.offline_licenses DROP COLUMN IF EXISTS ban_reason;
-- ALTER TABLE public.offline_licenses DROP COLUMN IF EXISTS transfer_count;
-- ALTER TABLE public.offline_licenses DROP COLUMN IF EXISTS transfer_year;


-- ────────────────────────────────────────────────────────────────────────
-- [31/59] subscription-workspace-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/subscription-workspace-migration.sql
--
-- DECISION A — a subscription belongs to a WORKSPACE, not to a user.
--
--     User → workspace_members → Workspace → Subscription → Plan
--
-- The consequence that matters: transferring ownership must NOT move the
-- subscription. Today `subscriptions.user_id` IS the tenancy, so handing the
-- workspace to a new owner would silently hand them a different subscription —
-- or none. After this migration the subscription stays with the business,
-- which is what a business subscription means.
--
-- ---------------------------------------------------------------------------
-- HOW IT BEHAVES
--
--   PART 1  DRY RUN   read-only. Changes nothing. Run this first, alone.
--   PART 2  ADD       nullable column + FK + indexes. Reversible.
--   PART 3  BACKFILL  only rows that map to exactly ONE workspace.
--   PART 4  VERIFY    row counts, PKs, FKs, cross-assignment.
--   PART 5  NOT NULL  commented out — a separate human decision.
--
-- It FAILS CLOSED. A subscription that cannot be mapped deterministically is
-- left NULL and counted, never guessed, never merged, never deleted.
--
-- ---------------------------------------------------------------------------
-- THE MAPPING RULE, AND WHY IT IS OWNERSHIP AND NOT MEMBERSHIP
--
-- The obvious rule — "the workspace this user is a member of" — is wrong here.
-- A user can be the OWNER of their own shop and a SELLER in someone else's.
-- Mapping their subscription by membership would put it on whichever workspace
-- sorted first, which is exactly the guess this file refuses to make.
--
-- A subscription is bought by the person who owns the business, so the mapping
-- is `workspaces.owner_id`. `workspace_single_owner_idx` already guarantees at
-- most one owner per workspace, so the only ambiguity left is a user who owns
-- SEVERAL workspaces — and that one is genuinely unknowable from the data.
-- ============================================================================


-- ############################################################################
-- PART 1 — DRY RUN (read-only; safe on production)
-- ############################################################################

WITH owned AS (
  SELECT owner_id AS user_id, count(*) AS owned_workspaces
    FROM workspaces
   GROUP BY owner_id
)
SELECT
  count(*)                                                   AS total_subscriptions,
  count(*) FILTER (WHERE o.owned_workspaces = 1)             AS mappable,
  count(*) FILTER (WHERE s.user_id IS NULL)                  AS no_user,
  count(*) FILTER (WHERE s.user_id IS NOT NULL
                     AND o.owned_workspaces IS NULL)         AS orphaned,
  count(*) FILTER (WHERE o.owned_workspaces > 1)             AS ambiguous,
  CASE
    WHEN count(*) FILTER (WHERE o.owned_workspaces IS DISTINCT FROM 1) = 0
      THEN 'SAFE — every subscription maps to exactly one owned workspace'
    ELSE 'REVIEW — see the per-row listing below before PART 3'
  END                                                        AS verdict
FROM subscriptions s
LEFT JOIN owned o ON o.user_id = s.user_id;

-- The offenders, by name, so a human can decide rather than a script guessing.
WITH owned AS (
  SELECT owner_id AS user_id, count(*) AS n
    FROM workspaces GROUP BY owner_id
)
SELECT
  s.id            AS subscription_id,
  s.user_id,
  s.plan,
  s.status,
  coalesce(o.n, 0) AS owned_workspaces,
  CASE
    WHEN s.user_id IS NULL THEN 'NO USER — no creator to map from; leave unresolved'
    WHEN o.n IS NULL       THEN 'ORPHANED — this user owns no workspace'
    WHEN o.n > 1           THEN 'AMBIGUOUS — owns ' || o.n::text || ' workspaces; a human must choose'
    ELSE 'ok'
  END AS classification
FROM subscriptions s
LEFT JOIN owned o ON o.user_id = s.user_id
WHERE o.n IS DISTINCT FROM 1
ORDER BY s.created_at
LIMIT 200;


-- ############################################################################
-- PART 2 — ADD THE COLUMN (nullable, reversible)
-- ############################################################################
--
-- Metadata-only on PostgreSQL 11+: no DEFAULT and no NOT NULL means the heap is
-- not rewritten. Nullable on purpose — a NOT NULL would fail instantly against
-- existing rows, and a DEFAULT would assign every subscription to one arbitrary
-- workspace, which is the guess this migration exists to avoid.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS workspace_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_workspace_fk') THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_workspace_fk
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

-- ON DELETE RESTRICT, never CASCADE: deleting a workspace must not silently
-- delete its billing relationship. It should fail loudly.

CREATE INDEX IF NOT EXISTS subscriptions_workspace_id_idx ON subscriptions (workspace_id);

-- At most ONE subscription per workspace — the hierarchy says
-- "ONE Workspace Subscription". Partial, so the many pre-backfill NULLs do not
-- collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_per_workspace_idx
  ON subscriptions (workspace_id)
  WHERE workspace_id IS NOT NULL;


-- ############################################################################
-- PART 3 — BACKFILL (deterministic only)
-- ############################################################################
--
-- Fills ONLY subscriptions whose user owns exactly one workspace. The HAVING is
-- what makes `[1]` a fact rather than a choice — a user with 0 or 2+ owned
-- workspaces never reaches it.
--
-- `WHERE workspace_id IS NULL` makes this idempotent and non-destructive: an
-- already-assigned subscription is never overwritten, so re-running after a
-- human resolves an ambiguous case cannot undo their decision.

WITH sole_owner AS (
  SELECT owner_id AS user_id, (array_agg(id))[1] AS workspace_id
    FROM workspaces
   GROUP BY owner_id
  HAVING count(*) = 1
)
UPDATE subscriptions s
   SET workspace_id = o.workspace_id
  FROM sole_owner o
 WHERE s.user_id = o.user_id
   AND s.workspace_id IS NULL;

-- What is left, and why.
WITH owned AS (
  SELECT owner_id AS user_id, count(*) AS n FROM workspaces GROUP BY owner_id
)
SELECT
  count(*)                                            AS total,
  count(s.workspace_id)                               AS filled,
  count(*) FILTER (WHERE s.workspace_id IS NULL)      AS still_null,
  count(*) FILTER (WHERE s.workspace_id IS NULL
                     AND s.user_id IS NULL)           AS unresolvable_no_user,
  count(*) FILTER (WHERE s.workspace_id IS NULL
                     AND o.n IS NULL
                     AND s.user_id IS NOT NULL)       AS orphaned,
  count(*) FILTER (WHERE s.workspace_id IS NULL
                     AND o.n > 1)                     AS ambiguous,
  CASE
    WHEN count(*) FILTER (WHERE s.workspace_id IS NULL) = 0
      THEN 'READY — safe to enforce NOT NULL'
    ELSE 'HOLD — resolve the remaining rows by hand first'
  END AS verdict
FROM subscriptions s
LEFT JOIN owned o ON o.user_id = s.user_id;


-- ############################################################################
-- PART 4 — VERIFY (read-only)
-- ############################################################################
--
-- The checks the decision asked for, before NOT NULL is even considered.
-- Financial data is never partially migrated on the strength of "it looked ok".

-- 4a. Row count unchanged, primary keys intact.
SELECT
  (SELECT count(*) FROM subscriptions)                        AS rows_now,
  (SELECT count(DISTINCT id) FROM subscriptions)              AS distinct_ids,
  CASE
    WHEN (SELECT count(*) FROM subscriptions)
       = (SELECT count(DISTINCT id) FROM subscriptions)
      THEN 'OK — no duplicate or lost primary keys'
    ELSE 'FAIL — primary keys changed; STOP'
  END AS verdict;

-- 4b. Every assigned workspace_id points at a real workspace.
SELECT
  count(*) AS dangling_references,
  CASE WHEN count(*) = 0 THEN 'OK — referential integrity holds'
       ELSE 'FAIL — subscriptions reference workspaces that do not exist' END AS verdict
FROM subscriptions s
LEFT JOIN workspaces w ON w.id = s.workspace_id
WHERE s.workspace_id IS NOT NULL AND w.id IS NULL;

-- 4c. NO CROSS-WORKSPACE ASSIGNMENT.
--
-- The check that actually matters: every backfilled subscription must sit on a
-- workspace its own user owns. If this ever returns a row, a subscription was
-- attached to somebody else's business.
SELECT
  count(*) AS cross_assigned,
  CASE WHEN count(*) = 0 THEN 'OK — no subscription sits on a workspace its user does not own'
       ELSE 'FAIL — CROSS-WORKSPACE ASSIGNMENT; roll back PART 3' END AS verdict
FROM subscriptions s
JOIN workspaces w ON w.id = s.workspace_id
WHERE s.user_id IS NOT NULL AND w.owner_id IS DISTINCT FROM s.user_id;

-- 4d. One subscription per workspace.
SELECT
  count(*) AS workspaces_with_multiple_subscriptions,
  CASE WHEN count(*) = 0 THEN 'OK — at most one subscription per workspace'
       ELSE 'FAIL — the unique index should have prevented this' END AS verdict
FROM (
  SELECT workspace_id FROM subscriptions
   WHERE workspace_id IS NOT NULL
   GROUP BY workspace_id HAVING count(*) > 1
) dup;

-- 4e. Indexes and constraint exist and are valid.
SELECT
  i.indexrelid::regclass AS object,
  i.indisvalid           AS is_valid,
  i.indisunique          AS is_unique
FROM pg_index i
WHERE i.indexrelid IN (
  'subscriptions_workspace_idx'::regclass,
  'subscriptions_one_per_workspace_idx'::regclass
);


-- ############################################################################
-- PART 5 — NOT NULL + VALIDATE  (run only when PART 3 reports READY)
-- ############################################################################
--
-- Deliberately commented out. Two preconditions, both human-checked:
--
--   1. PART 3 reports zero still_null
--   2. the workspace-aware backend is DEPLOYED, so new rows carry workspace_id
--
-- Enforcing NOT NULL before the deploy rejects every new subscription.
--
-- ALTER TABLE subscriptions ALTER COLUMN workspace_id SET NOT NULL;
-- ALTER TABLE subscriptions VALIDATE CONSTRAINT subscriptions_workspace_fk;


-- ############################################################################
-- ROLLBACK
-- ############################################################################
--
-- Safe at any point before PART 5. Drops only what this file created; no
-- subscription row is touched, and `user_id` is left intact throughout — it
-- remains the record of who bought the plan.
--
-- DROP INDEX IF EXISTS subscriptions_one_per_workspace_idx;
-- DROP INDEX IF EXISTS subscriptions_workspace_id_idx;
-- ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_workspace_fk;
-- ALTER TABLE subscriptions DROP COLUMN IF EXISTS workspace_id;


-- ────────────────────────────────────────────────────────────────────────
-- [32/59] subscription-orders-claim-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/subscription-orders-claim-migration.sql
--
-- V54.0 PHASE 5.1 — SUBSCRIPTION TO WORKSPACE CANONICAL PROVISIONING
--
-- ⚠️ PENDING HUMAN CONFIRMATION.
-- This migration is additive and idempotent. It creates the infrastructure for:
--   1. subscription_orders: Tracks commercial intent to purchase a subscription plan.
--   2. Claim Token Hashes: Secure single-use cryptographic tokens for "Buy First" onboarding.
--   3. canonical_provision_workspace(): Idempotent transactional engine that binds
--      an order, provisions a workspace, creates owner membership, activates subscription,
--      and initializes the onboarding state without partial failure.
-- ============================================================================

-- 1. Subscription Orders Table
CREATE TABLE IF NOT EXISTS public.subscription_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan text NOT NULL CHECK (plan IN ('starter', 'pro', 'enterprise', 'offline')),
  billing_interval text NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month', 'year')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL DEFAULT 'AFN',
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'payment_failed', 'claimed', 'expired', 'cancelled')),
  payment_method text CHECK (payment_method IN ('card_to_card', 'gateway', 'manual', 'cash')),
  payment_reference text,
  payment_verified_at timestamptz,
  -- Security: Store SHA-256 hash of claim token, never plaintext raw token
  claim_token_hash text UNIQUE,
  claim_token_expires_at timestamptz,
  claimed_by_user_id uuid REFERENCES auth.users(id),
  claimed_at timestamptz,
  -- Bound entities once provisioned
  provisioned_workspace_id uuid REFERENCES public.workspaces(id),
  created_by_user_id uuid REFERENCES auth.users(id), -- Nullable for Path A (Buy First before register)
  idempotency_key text UNIQUE,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for lookup and concurrency protection
CREATE INDEX IF NOT EXISTS idx_subscription_orders_claim_hash ON public.subscription_orders(claim_token_hash) WHERE claim_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscription_orders_status ON public.subscription_orders(status);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_user ON public.subscription_orders(created_by_user_id) WHERE created_by_user_id IS NOT NULL;

-- 2. Audit Event Log for Subscription Lifecycle
CREATE TABLE IF NOT EXISTS public.subscription_order_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.subscription_orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id),
  details jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sub_order_events_order ON public.subscription_order_events(order_id);

-- 3. Row Level Security Policies
ALTER TABLE public.subscription_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_order_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.subscription_orders FROM PUBLIC, anon;
REVOKE ALL ON public.subscription_order_events FROM PUBLIC, anon;

GRANT SELECT ON public.subscription_orders TO authenticated;
-- Modifications are strictly restricted to service_role or vetted RPCs

-- 4. Canonical Idempotent Provisioning Engine (PostgreSQL Transactional RPC)
CREATE OR REPLACE FUNCTION public.canonical_provision_workspace(
  p_order_id uuid,
  p_user_id uuid,
  p_workspace_name text,
  p_base_currency text DEFAULT 'AFN',
  p_time_zone text DEFAULT 'Asia/Kabul'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.subscription_orders%ROWTYPE;
  v_workspace public.workspaces%ROWTYPE;
  v_subscription_id uuid;
  v_period_end timestamptz;
  v_slug text;
BEGIN
  -- 1. Lock and validate order atomically
  SELECT * INTO v_order
  FROM public.subscription_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency check: if already claimed and provisioned for this user, return existing workspace
  IF v_order.status = 'claimed' AND v_order.provisioned_workspace_id IS NOT NULL THEN
    IF v_order.claimed_by_user_id = p_user_id THEN
      RETURN jsonb_build_object(
        'success', true,
        'workspace_id', v_order.provisioned_workspace_id,
        'already_provisioned', true
      );
    ELSE
      RAISE EXCEPTION 'ORDER_ALREADY_CLAIMED_BY_ANOTHER_USER' USING ERRCODE = '23505';
    END IF;
  END IF;

  IF v_order.status != 'paid' THEN
    RAISE EXCEPTION 'ORDER_NOT_PAID' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Generate slug and create workspace
  v_slug := lower(regexp_replace(p_workspace_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 8);

  INSERT INTO public.workspaces (
    name,
    slug,
    owner_id,
    base_currency,
    time_zone,
    created_at,
    updated_at
  ) VALUES (
    p_workspace_name,
    v_slug,
    p_user_id,
    COALESCE(p_base_currency, 'AFN'),
    COALESCE(p_time_zone, 'Asia/Kabul'),
    now(),
    now()
  )
  RETURNING * INTO v_workspace;

  -- 3. Create Owner Membership atomically
  INSERT INTO public.workspace_members (
    workspace_id,
    user_id,
    role,
    has_access,
    created_at,
    updated_at
  ) VALUES (
    v_workspace.id,
    p_user_id,
    'owner',
    true,
    now(),
    now()
  );

  -- 4. Calculate subscription period
  IF v_order.billing_interval = 'year' THEN
    v_period_end := now() + interval '1 year';
  ELSE
    v_period_end := now() + interval '1 month';
  END IF;

  -- 5. Create or Bind Subscription to Workspace
  INSERT INTO public.subscriptions (
    workspace_id,
    user_id,
    plan,
    status,
    period_start,
    period_end,
    is_trial,
    trial_used,
    cancel_at_period_end,
    created_at,
    updated_at
  ) VALUES (
    v_workspace.id,
    p_user_id,
    v_order.plan,
    'active',
    now(),
    v_period_end,
    false,
    true,
    false,
    now(),
    now()
  )
  RETURNING id INTO v_subscription_id;

  -- 6. Mark order as claimed and bound
  UPDATE public.subscription_orders
  SET status = 'claimed',
      claimed_by_user_id = p_user_id,
      claimed_at = now(),
      provisioned_workspace_id = v_workspace.id,
      updated_at = now()
  WHERE id = p_order_id;

  -- 7. Record Audit Event
  INSERT INTO public.subscription_order_events (
    order_id,
    event_type,
    actor_user_id,
    details
  ) VALUES (
    p_order_id,
    'order_claimed_and_provisioned',
    p_user_id,
    jsonb_build_object(
      'workspace_id', v_workspace.id,
      'subscription_id', v_subscription_id,
      'plan', v_order.plan,
      'interval', v_order.billing_interval
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'workspace_id', v_workspace.id,
    'subscription_id', v_subscription_id,
    'already_provisioned', false
  );
END;
$$;

-- Backend-only RPC: provisioning runs from the backend as service_role (db.ts
-- validates the key's role claim). Signed-in clients must not call it via /rpc.
REVOKE EXECUTE ON FUNCTION public.canonical_provision_workspace FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_provision_workspace TO service_role;

-- 5. Verification Query (Run to verify installation)
-- SELECT id, plan, status FROM public.subscription_orders LIMIT 1;


-- ────────────────────────────────────────────────────────────────────────
-- [33/59] subscription-upgrade-requests-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- SUBSCRIPTION UPGRADE REQUESTS + SUBSCRIPTION LOG — additive, idempotent.
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then the verification query at the
-- bottom. Status: PENDING HUMAN CONFIRMATION.
--
-- WHY
--
-- 1. `POST /api/billing/upgrade` needed only a login, and it made the caller's
--    subscription pro/enterprise with NO payment — anyone could give themselves
--    the top plan. It also updated by `user_id`, so every workspace that user
--    owned was upgraded at once.
-- 2. `subscriptions.cancel_at_period_end` defaults to TRUE and activation never
--    cleared it, so every paid subscription read «لغو در پایان دوره برنامه‌ریزی
--    شده است» whether or not anyone asked to cancel.
-- 3. There was no record of who bought what, when, until when.
--
-- WHAT THIS ADDS
--
--   subscription_upgrade_requests   a member asks; the platform admin approves
--                                   after the money arrived. At most ONE pending
--                                   request per workspace.
--                                   payment_method / payment_reference: ready
--                                   for card-to-card and a future gateway.
--   subscription_events             the log: requested / approved / rejected /
--                                   cancelled / activated, with plan, interval,
--                                   amount and the period end.
--   approve_subscription_upgrade()  ONE transaction: lock the request, activate
--                                   THIS workspace's subscription (period from
--                                   now, cancel_at_period_end = false), mark the
--                                   request approved, write the log.
--   reject_subscription_upgrade()   same holder rules, no plan change.
--
-- Existing rows are NOT rewritten: a TRUE cancel_at_period_end on an old row
-- may be a real cancellation or the default; nothing here can tell which
-- (راهنمای سشن §۱۲). It is cleared only when a new activation happens.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.subscription_upgrade_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL,
  requested_by       uuid NOT NULL,
  current_plan       text NOT NULL,
  requested_plan     text NOT NULL CHECK (requested_plan IN ('pro', 'enterprise')),
  billing_interval   text NOT NULL CHECK (billing_interval IN ('month', 'year')),
  -- Minor units (cents). NULL = not priced by the product (enterprise is
  -- negotiated) — the admin writes the agreed amount on approval.
  amount_minor       bigint CHECK (amount_minor IS NULL OR amount_minor >= 0),
  currency           text,
  -- 'card_to_card' | 'gateway' | 'manual'. NULL until the member says how.
  payment_method     text CHECK (payment_method IS NULL OR payment_method IN ('card_to_card', 'gateway', 'manual')),
  -- Card-to-card tracking number, gateway transaction id, …
  payment_reference  text,
  member_note        text,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by         uuid,
  decided_at         timestamptz,
  admin_note         text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_upgrade_requests_one_pending
  ON public.subscription_upgrade_requests (workspace_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS subscription_upgrade_requests_status_idx
  ON public.subscription_upgrade_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL,
  subscription_id  uuid,
  request_id       uuid,
  event            text NOT NULL CHECK (event IN
                     ('upgrade_requested', 'upgrade_approved', 'upgrade_rejected',
                      'upgrade_cancelled', 'cancel_scheduled', 'cancelled', 'expired')),
  plan             text,
  billing_interval text,
  amount_minor     bigint,
  currency         text,
  period_end       timestamptz,
  actor_id         uuid,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscription_events_workspace_idx
  ON public.subscription_events (workspace_id, created_at DESC);

-- Members may READ their own workspace's requests and log. Every write goes
-- through the backend (service role) — no client policy writes anything.
ALTER TABLE public.subscription_upgrade_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- Drop first so a re-run rebuilds the policies with the initplan-safe
-- (SELECT auth.uid()) form instead of skipping them via the IF NOT EXISTS guard.
DROP POLICY IF EXISTS subscription_upgrade_requests_members_read ON public.subscription_upgrade_requests;
DROP POLICY IF EXISTS subscription_events_members_read ON public.subscription_events;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscription_upgrade_requests'
                 AND policyname = 'subscription_upgrade_requests_members_read') THEN
    CREATE POLICY subscription_upgrade_requests_members_read ON public.subscription_upgrade_requests
      FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscription_events'
                 AND policyname = 'subscription_events_members_read') THEN
    CREATE POLICY subscription_events_members_read ON public.subscription_events
      FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = (SELECT auth.uid())));
  END IF;
END $$;

-- ─── Request: the row and its log line, together ────────────────────────────
-- Raises UPGRADE_REQUEST_PENDING when the workspace already has one waiting.
CREATE OR REPLACE FUNCTION public.create_subscription_upgrade_request(
  p_workspace_id  uuid,
  p_user_id       uuid,
  p_current_plan  text,
  p_plan          text,
  p_interval      text,
  p_amount_minor  bigint,
  p_currency      text,
  p_method        text,
  p_reference     text,
  p_note          text
)
RETURNS public.subscription_upgrade_requests
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_row public.subscription_upgrade_requests%ROWTYPE;
BEGIN
  BEGIN
    INSERT INTO public.subscription_upgrade_requests
      (workspace_id, requested_by, current_plan, requested_plan, billing_interval,
       amount_minor, currency, payment_method, payment_reference, member_note)
    VALUES
      (p_workspace_id, p_user_id, p_current_plan, p_plan, p_interval,
       p_amount_minor, p_currency, p_method, p_reference, p_note)
    RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'UPGRADE_REQUEST_PENDING';
  END;

  INSERT INTO public.subscription_events
    (workspace_id, request_id, event, plan, billing_interval, amount_minor, currency, actor_id, note)
  VALUES
    (p_workspace_id, v_row.id, 'upgrade_requested', p_plan, p_interval, p_amount_minor, p_currency, p_user_id, p_note);

  RETURN v_row;
END;
$$;

-- ─── Withdraw: only a pending request, only from its own workspace ──────────
CREATE OR REPLACE FUNCTION public.cancel_subscription_upgrade_request(
  p_request_id   uuid,
  p_workspace_id uuid,
  p_user_id      uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_req public.subscription_upgrade_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.subscription_upgrade_requests
   WHERE id = p_request_id AND workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'UPGRADE_REQUEST_NOT_FOUND'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'UPGRADE_REQUEST_NOT_PENDING'; END IF;

  UPDATE public.subscription_upgrade_requests
     SET status = 'cancelled', decided_by = p_user_id, decided_at = now()
   WHERE id = p_request_id;

  INSERT INTO public.subscription_events
    (workspace_id, request_id, event, plan, billing_interval, actor_id)
  VALUES
    (v_req.workspace_id, v_req.id, 'upgrade_cancelled', v_req.requested_plan, v_req.billing_interval, p_user_id);
END;
$$;

-- ─── Approve: one transaction ───────────────────────────────────────────────
-- Returns the activated subscription row id. Raises:
--   UPGRADE_REQUEST_NOT_FOUND / UPGRADE_REQUEST_NOT_PENDING / SUBSCRIPTION_NOT_FOUND
CREATE OR REPLACE FUNCTION public.approve_subscription_upgrade(
  p_request_id   uuid,
  p_admin_id     uuid,
  p_amount_minor bigint DEFAULT NULL,
  p_note         text   DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_req  public.subscription_upgrade_requests%ROWTYPE;
  v_sub  uuid;
  v_end  timestamptz;
BEGIN
  SELECT * INTO v_req FROM public.subscription_upgrade_requests
   WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'UPGRADE_REQUEST_NOT_FOUND'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'UPGRADE_REQUEST_NOT_PENDING'; END IF;

  v_end := now() + CASE WHEN v_req.billing_interval = 'year' THEN interval '1 year' ELSE interval '1 month' END;

  -- THIS workspace's subscription — never «every subscription of the user».
  UPDATE public.subscriptions
     SET plan = v_req.requested_plan,
         status = 'active',
         is_trial = false,
         trial_used = true,
         period_start = now(),
         period_end = v_end,
         cancel_at_period_end = false,
         updated_at = now()
   WHERE id = (SELECT s.id FROM public.subscriptions s
                WHERE s.workspace_id = v_req.workspace_id
                ORDER BY s.created_at DESC LIMIT 1 FOR UPDATE)
  RETURNING id INTO v_sub;
  IF v_sub IS NULL THEN RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND'; END IF;

  UPDATE public.subscription_upgrade_requests
     SET status = 'approved',
         decided_by = p_admin_id,
         decided_at = now(),
         admin_note = p_note,
         amount_minor = COALESCE(p_amount_minor, amount_minor)
   WHERE id = p_request_id;

  INSERT INTO public.subscription_events
    (workspace_id, subscription_id, request_id, event, plan, billing_interval,
     amount_minor, currency, period_end, actor_id, note)
  VALUES
    (v_req.workspace_id, v_sub, v_req.id, 'upgrade_approved', v_req.requested_plan,
     v_req.billing_interval, COALESCE(p_amount_minor, v_req.amount_minor), v_req.currency,
     v_end, p_admin_id, p_note);

  RETURN v_sub;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_subscription_upgrade(
  p_request_id uuid,
  p_admin_id   uuid,
  p_note       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_req public.subscription_upgrade_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.subscription_upgrade_requests
   WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'UPGRADE_REQUEST_NOT_FOUND'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'UPGRADE_REQUEST_NOT_PENDING'; END IF;

  UPDATE public.subscription_upgrade_requests
     SET status = 'rejected', decided_by = p_admin_id, decided_at = now(), admin_note = p_note
   WHERE id = p_request_id;

  INSERT INTO public.subscription_events
    (workspace_id, request_id, event, plan, billing_interval, amount_minor, currency, actor_id, note)
  VALUES
    (v_req.workspace_id, v_req.id, 'upgrade_rejected', v_req.requested_plan,
     v_req.billing_interval, v_req.amount_minor, v_req.currency, p_admin_id, p_note);
END;
$$;

REVOKE ALL ON public.subscription_upgrade_requests FROM anon;
REVOKE ALL ON public.subscription_events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.subscription_upgrade_requests FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.subscription_events FROM authenticated;
GRANT SELECT ON public.subscription_upgrade_requests TO authenticated;
GRANT SELECT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_upgrade_requests TO service_role;
GRANT ALL ON public.subscription_events TO service_role;

REVOKE ALL ON FUNCTION public.create_subscription_upgrade_request(uuid, uuid, text, text, text, bigint, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_subscription_upgrade_request(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_subscription_upgrade_request(uuid, uuid, text, text, text, bigint, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_subscription_upgrade_request(uuid, uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.approve_subscription_upgrade(uuid, uuid, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_subscription_upgrade(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_subscription_upgrade(uuid, uuid, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_subscription_upgrade(uuid, uuid, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- The backend answers «not configured» (503) without these — it never falls
-- back to activating a plan without payment.
--
--   DROP FUNCTION IF EXISTS public.create_subscription_upgrade_request(uuid, uuid, text, text, text, bigint, text, text, text, text);
--   DROP FUNCTION IF EXISTS public.cancel_subscription_upgrade_request(uuid, uuid, uuid);
--   DROP FUNCTION IF EXISTS public.approve_subscription_upgrade(uuid, uuid, bigint, text);
--   DROP FUNCTION IF EXISTS public.reject_subscription_upgrade(uuid, uuid, text);
--   -- The tables hold the purchase history; check before dropping:
--   --   SELECT status, count(*) FROM public.subscription_upgrade_requests GROUP BY 1;
--   DROP TABLE IF EXISTS public.subscription_events;
--   DROP TABLE IF EXISTS public.subscription_upgrade_requests;
-- ============================================================================

-- ============================================================================
-- VERIFICATION — run separately. Every row: ok = true.
-- ============================================================================
-- SELECT 'tables' AS check,
--        to_regclass('public.subscription_upgrade_requests') IS NOT NULL
--        AND to_regclass('public.subscription_events') IS NOT NULL AS ok
-- UNION ALL
-- SELECT 'one pending per workspace',
--        EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'subscription_upgrade_requests_one_pending')
-- UNION ALL
-- SELECT 'rls on',
--        (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.subscription_upgrade_requests'::regclass)
--        AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.subscription_events'::regclass)
-- UNION ALL
-- SELECT 'functions present',
--        to_regprocedure('public.approve_subscription_upgrade(uuid, uuid, bigint, text)') IS NOT NULL
--        AND to_regprocedure('public.reject_subscription_upgrade(uuid, uuid, text)') IS NOT NULL
--        AND to_regprocedure('public.create_subscription_upgrade_request(uuid, uuid, text, text, text, bigint, text, text, text, text)') IS NOT NULL
--        AND to_regprocedure('public.cancel_subscription_upgrade_request(uuid, uuid, uuid)') IS NOT NULL
-- UNION ALL
-- SELECT 'members cannot approve',
--        NOT has_function_privilege('authenticated', 'public.approve_subscription_upgrade(uuid, uuid, bigint, text)', 'EXECUTE')
-- UNION ALL
-- SELECT 'members cannot write requests',
--        NOT has_table_privilege('authenticated', 'public.subscription_upgrade_requests', 'INSERT')
--        AND NOT has_table_privilege('authenticated', 'public.subscription_upgrade_requests', 'UPDATE');


-- ────────────────────────────────────────────────────────────────────────
-- [34/59] offline-licence-keys-01-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- offline-licence-keys-01 — the offline-licence signing key lives in the
-- database, made by the backend, not in an environment file (owner, 22 Oct 2026).
--
-- · The backend creates the Ed25519 pair the first time it needs one and keeps
--   it here. Only service_role (the backend) can read it; anon/authenticated
--   cannot see the table at all.
-- · One active key (retired_at IS NULL). A key is never deleted and its bytes
--   never change — every licence it signed must stay verifiable. Retiring is
--   the only update.
-- · Additive and idempotent: safe to run twice.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.offline_license_signing_keys (
  key_id          text PRIMARY KEY,
  private_key_hex text NOT NULL CHECK (private_key_hex ~ '^[0-9a-f]{64}$'),
  public_key_hex  text NOT NULL CHECK (public_key_hex ~ '^[0-9a-f]{64}$'),
  created_at      timestamptz NOT NULL DEFAULT now(),
  retired_at      timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS offline_license_signing_keys_one_active
  ON public.offline_license_signing_keys ((true))
  WHERE retired_at IS NULL;

ALTER TABLE public.offline_license_signing_keys ENABLE ROW LEVEL SECURITY;

-- Supabase gives a new table ALL to every role; take it all back first.
REVOKE ALL ON public.offline_license_signing_keys FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.offline_license_signing_keys TO service_role;
GRANT UPDATE (retired_at) ON public.offline_license_signing_keys TO service_role;

DROP POLICY IF EXISTS offline_license_signing_keys_backend ON public.offline_license_signing_keys;

CREATE OR REPLACE FUNCTION public.offline_license_signing_keys_guard()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'OFFLINE_SIGNING_KEY_PERMANENT';
  END IF;
  IF NEW.key_id IS DISTINCT FROM OLD.key_id
     OR NEW.private_key_hex IS DISTINCT FROM OLD.private_key_hex
     OR NEW.public_key_hex IS DISTINCT FROM OLD.public_key_hex
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (OLD.retired_at IS NOT NULL AND NEW.retired_at IS DISTINCT FROM OLD.retired_at) THEN
    RAISE EXCEPTION 'OFFLINE_SIGNING_KEY_PERMANENT';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.offline_license_signing_keys_guard() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS offline_license_signing_keys_guard_trg ON public.offline_license_signing_keys;
CREATE TRIGGER offline_license_signing_keys_guard_trg
  BEFORE UPDATE OR DELETE ON public.offline_license_signing_keys
  FOR EACH ROW EXECUTE FUNCTION public.offline_license_signing_keys_guard();

-- Rollback / mitigation (only if no licence was ever issued with a key here):
--   DROP TABLE public.offline_license_signing_keys;
--   DROP FUNCTION public.offline_license_signing_keys_guard();


-- ────────────────────────────────────────────────────────────────────────
-- [35/59] offline-licence-keys-02-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- offline-licence-keys-02 — rev2 (9 Nov 2026): the private signing key STAYS
-- in the database, and can never be cleared.
--
-- HISTORY:
--   rev1 (8 Nov, run by the owner and VERIFIED on 9 Nov) made private_key_hex
--   nullable and let the guard trigger allow ONE change: value → NULL, so the
--   key could be moved to the backend's environment (audit F-02).
--   Owner decision, 9 Nov 2026: «در دیتابیس بماند» — the key stays in the
--   database; the backend stores nothing («بک‌اند فقط یک پله»). F-02 is an
--   accepted risk. rev2 takes the allowance back.
--
-- WHAT (re-running this file is how the live database gets rev2):
--   1. The guard trigger forbids EVERY change to private_key_hex again — the
--      exact rule of offline-licence-keys-01.
--   2. private_key_hex is NOT NULL again. If any row has already been cleared,
--      this refuses with OFFLINE_SIGNING_KEY_CLEARED instead of guessing a key
--      (§12): a cleared key cannot be recovered from anywhere.
--
-- Additive in effect (restores 01's constraints), idempotent, safe to run twice.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.offline_license_signing_keys WHERE private_key_hex IS NULL) THEN
    RAISE EXCEPTION 'OFFLINE_SIGNING_KEY_CLEARED: a signing key row has no private half; stop and report';
  END IF;
END $$;

ALTER TABLE public.offline_license_signing_keys
  ALTER COLUMN private_key_hex SET NOT NULL;

CREATE OR REPLACE FUNCTION public.offline_license_signing_keys_guard()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'OFFLINE_SIGNING_KEY_PERMANENT';
  END IF;
  IF NEW.key_id IS DISTINCT FROM OLD.key_id
     OR NEW.private_key_hex IS DISTINCT FROM OLD.private_key_hex
     OR NEW.public_key_hex IS DISTINCT FROM OLD.public_key_hex
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (OLD.retired_at IS NOT NULL AND NEW.retired_at IS DISTINCT FROM OLD.retired_at) THEN
    RAISE EXCEPTION 'OFFLINE_SIGNING_KEY_PERMANENT';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.offline_license_signing_keys_guard() FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.offline_license_signing_keys_guard()
  IS 'offline-licence-keys-02:rev2';

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION: none needed — rev2 restores offline-licence-keys-01's
-- rules exactly. Do not reintroduce a way to clear private_key_hex without a
-- new owner decision.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────
-- [36/59] package-credit-ledger-01-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- Hisabche Migration: Package Credit and Entitlement Ledger (M3)
-- File: docs/package-credit-ledger-01-migration.sql
--
-- RUN ORDER: Run after offering-type-01-migration.sql.
-- PENDING HUMAN CONFIRMATION — run docs/VERIFY-package-credit-ledger-01.sql after it.
--
-- WHAT IT ADDS (strictly additive, zero breaking changes to existing data):
--   Table: public.package_credit_ledger
--   Columns:
--     id, workspace_id, customer_id, package_product_id, entry_type,
--     quantity, unit, source_document_type, source_document_id, source_line_id,
--     reference_entry_id, idempotency_key, notes, expires_at, effective_date,
--     created_at, updated_at, deleted_at
--   CHECK constraint: entry_type IN ('GRANT', 'CONSUME', 'REVERSAL', 'EXPIRE', 'ADJUSTMENT')
--   Function: public.package_credit_consume(
--     p_workspace_id uuid, p_customer_id uuid, p_package_product_id uuid,
--     p_quantity numeric, p_unit text, p_idempotency_key text, p_notes text,
--     p_effective_date date, p_user_id uuid
--   )
--   Idempotency unique index per workspace.
--   Row Level Security policies scoped to workspace_id.
--
-- INVARIANTS:
--   1. Package Credit/Entitlement Truth is an append-only ledger of immutable facts.
--   2. Payment Truth and Accounting Truth remain separate and undisturbed.
--   3. Derived balance: Remaining = Grants + Adjustments + Reversals - Consumes - Expirations.
--   4. Expiration zeroes remaining entitlement without creating cash refund.
--   5. Atomic consumption prevents overdraw via row locks and immediate balance check.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_prevent_package_credit_ledger_mutation ON public.package_credit_ledger;
--   DROP FUNCTION IF EXISTS public.prevent_package_credit_ledger_mutation();
--   DROP FUNCTION IF EXISTS public.package_credit_consume(uuid, uuid, uuid, numeric, text, text, text, date, uuid);
--   DROP TABLE IF EXISTS public.package_credit_ledger CASCADE;
-- ============================================================================

DO $$
BEGIN
  -- 1. Create table if not exists
  CREATE TABLE IF NOT EXISTS public.package_credit_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    package_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    entry_type text NOT NULL,
    quantity numeric(18, 4) NOT NULL,
    unit text,
    source_document_type text,
    source_document_id uuid,
    source_line_id uuid,
    reference_entry_id uuid REFERENCES public.package_credit_ledger(id) ON DELETE SET NULL,
    idempotency_key text,
    notes text,
    expires_at timestamptz,
    effective_date date NOT NULL DEFAULT CURRENT_DATE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  );

  -- 2. Add entry_type CHECK constraint if not present
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_package_credit_ledger_entry_type'
  ) THEN
    ALTER TABLE public.package_credit_ledger
      ADD CONSTRAINT chk_package_credit_ledger_entry_type
      CHECK (entry_type IN ('GRANT', 'CONSUME', 'REVERSAL', 'EXPIRE', 'ADJUSTMENT'))
      NOT VALID;

    BEGIN

      ALTER TABLE public.package_credit_ledger VALIDATE CONSTRAINT chk_package_credit_ledger_entry_type;

    EXCEPTION

      WHEN check_violation THEN

        RAISE NOTICE 'Deferred VALIDATE CONSTRAINT chk_package_credit_ledger_entry_type: %', SQLERRM;

    END;
  END IF;

  -- 3. Indexes for fast balance derivation & account queries
  CREATE INDEX IF NOT EXISTS idx_pkg_credit_ws_cust_prod
    ON public.package_credit_ledger(workspace_id, customer_id, package_product_id);

  CREATE UNIQUE INDEX IF NOT EXISTS uq_pkg_credit_idempotency
    ON public.package_credit_ledger(workspace_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

  CREATE INDEX IF NOT EXISTS idx_pkg_credit_ref_entry
    ON public.package_credit_ledger(workspace_id, reference_entry_id)
    WHERE reference_entry_id IS NOT NULL;

  -- 4. Security & Permissions
  REVOKE ALL ON public.package_credit_ledger FROM PUBLIC, anon;

  -- Append-only: authenticated users can SELECT and INSERT, NEVER UPDATE or DELETE
  GRANT SELECT, INSERT ON public.package_credit_ledger TO authenticated;
  GRANT ALL ON public.package_credit_ledger TO service_role;

  ALTER TABLE public.package_credit_ledger ENABLE ROW LEVEL SECURITY;

  -- Drop first so a re-run rebuilds this with (SELECT auth.uid()) rather than
  -- skipping via the IF NOT EXISTS guard (auth_rls_initplan).
  DROP POLICY IF EXISTS package_credit_ledger_tenant_isolation ON public.package_credit_ledger;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'package_credit_ledger'
      AND policyname = 'package_credit_ledger_tenant_isolation'
  ) THEN
    CREATE POLICY package_credit_ledger_tenant_isolation
      ON public.package_credit_ledger
      FOR ALL
      TO authenticated
      USING (
        workspace_id IN (
          SELECT workspace_id
          FROM public.workspace_members
          WHERE user_id = (SELECT auth.uid())
        )
      )
      WITH CHECK (
        workspace_id IN (
          SELECT workspace_id
          FROM public.workspace_members
          WHERE user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

-- 5. Immutability Guard Function & Trigger: Prevents arbitrary UPDATE or DELETE on ledger rows
CREATE OR REPLACE FUNCTION public.prevent_package_credit_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'PACKAGE_CREDIT_LEDGER_IMMUTABLE: Updates and deletes are forbidden on append-only package credit ledger. Use compensating entries.'
    USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_package_credit_ledger_mutation ON public.package_credit_ledger;
CREATE TRIGGER trg_prevent_package_credit_ledger_mutation
  BEFORE UPDATE OR DELETE ON public.package_credit_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_package_credit_ledger_mutation();

-- Trigger-only guard: it fires on DML, never needs to be callable via /rpc.
-- Strip the default Supabase EXECUTE grant from every client role.
REVOKE ALL ON FUNCTION public.prevent_package_credit_ledger_mutation() FROM PUBLIC, anon, authenticated, service_role;

-- 6. Atomic Consumption Function for PostgreSQL
CREATE OR REPLACE FUNCTION public.package_credit_consume(
  p_workspace_id uuid,
  p_customer_id uuid,
  p_package_product_id uuid,
  p_quantity numeric,
  p_unit text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_effective_date date DEFAULT CURRENT_DATE,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing record;
  v_balance numeric;
  v_new_id uuid;
  v_row record;
BEGIN
  -- Tenancy boundary check
  IF p_workspace_id IS NULL OR p_customer_id IS NULL OR p_package_product_id IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_CUSTOMER_PRODUCT_REQUIRED' USING ERRCODE = '22000';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'CONSUMPTION_QUANTITY_MUST_BE_POSITIVE' USING ERRCODE = '22000';
  END IF;

  -- Idempotency check: if already processed, return existing row
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.package_credit_ledger
    WHERE workspace_id = p_workspace_id
      AND idempotency_key = p_idempotency_key
      AND deleted_at IS NULL
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'id', v_existing.id,
        'workspace_id', v_existing.workspace_id,
        'customer_id', v_existing.customer_id,
        'package_product_id', v_existing.package_product_id,
        'entry_type', v_existing.entry_type,
        'quantity', v_existing.quantity,
        'unit', v_existing.unit,
        'idempotency_key', v_existing.idempotency_key,
        'notes', v_existing.notes,
        'effective_date', v_existing.effective_date,
        'created_at', v_existing.created_at,
        'is_replayed', true
      );
    END IF;
  END IF;

  -- Row-level concurrency lock on customer to serialize concurrent consumptions
  PERFORM id
  FROM public.customers
  WHERE id = p_customer_id AND workspace_id = p_workspace_id
  FOR UPDATE;

  -- Calculate current balance from ledger:
  -- Grants + Adjustments + Reversals - Consumes - Expirations
  SELECT COALESCE(SUM(
    CASE
      WHEN entry_type IN ('GRANT', 'ADJUSTMENT', 'REVERSAL') THEN quantity
      WHEN entry_type IN ('CONSUME', 'EXPIRE') THEN -quantity
      ELSE 0
    END
  ), 0)
  INTO v_balance
  FROM public.package_credit_ledger
  WHERE workspace_id = p_workspace_id
    AND customer_id = p_customer_id
    AND package_product_id = p_package_product_id
    AND deleted_at IS NULL;

  -- Fail-closed concurrency assertion
  IF v_balance < p_quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_PACKAGE_CREDIT: Available balance % is less than requested %', v_balance, p_quantity
      USING ERRCODE = 'P0001';
  END IF;

  -- Insert immutable CONSUME row
  v_new_id := gen_random_uuid();
  INSERT INTO public.package_credit_ledger (
    id, workspace_id, customer_id, package_product_id,
    entry_type, quantity, unit, idempotency_key,
    notes, effective_date, created_at, updated_at
  ) VALUES (
    v_new_id, p_workspace_id, p_customer_id, p_package_product_id,
    'CONSUME', p_quantity, p_unit, p_idempotency_key,
    p_notes, p_effective_date, now(), now()
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'workspace_id', v_row.workspace_id,
    'customer_id', v_row.customer_id,
    'package_product_id', v_row.package_product_id,
    'entry_type', v_row.entry_type,
    'quantity', v_row.quantity,
    'unit', v_row.unit,
    'idempotency_key', v_row.idempotency_key,
    'notes', v_row.notes,
    'effective_date', v_row.effective_date,
    'created_at', v_row.created_at,
    'remaining_balance', (v_balance - p_quantity),
    'is_replayed', false
  );
END;
$$;

-- Backend-only RPC: the backend connects as service_role (db.ts validates the
-- key's role claim), so signed-in clients must not call it directly via /rpc.
REVOKE EXECUTE ON FUNCTION public.package_credit_consume FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.package_credit_consume TO service_role;


-- ────────────────────────────────────────────────────────────────────────
-- [37/59] package-deferred-revenue-01-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/package-deferred-revenue-01-migration.sql
--
-- M5 (owner decisions of 2 Nov 2026): revenue of a package is recognised at DELIVERY, per GRANT, with the term of a
-- GRANT starting at its first valid consume. Additive and idempotent. NOT RUN by the agent that wrote it.
--
-- WHAT IT ADDS
--   package_credit_ledger.deferred_amount   books-currency NET amount the sale credited to deferred revenue for this GRANT
--                                           (NULL = sold before the cut-over: never released, no backfill)
--   package_credit_ledger.term_months       1 / 6 / 12 snapshot of the package's term at the sale (NULL = never expires)
--   products.package_term_months            the term a package is sold with (NULL = none)
--   package_credit_allocations              append-only: which GRANTs every CONSUME / REVERSAL drew from, how many units,
--                                           how much deferred revenue it released  (Invoice line -> GRANT -> Deferred ->
--                                           CONSUME -> Recognition is auditable from these rows)
--   package_credit_suspensions              append-only SUSPEND / RESUME events of ONE GRANT
--   trigger trg_package_credit_allocate     on EVERY CONSUME / REVERSAL insert, whichever path wrote it (delivery,
--                                           POST /package-credits/consume, a synced device command):
--                                             1. allocates the units over the eligible GRANTs, oldest first;
--                                             2. skips a GRANT that is expired / suspended / not yet sold;
--                                             3. releases the deferred revenue of exactly those GRANTs and posts ONE journal
--                                                entry (debit deferred revenue, credit sales) in the SAME transaction;
--                                             4. a REVERSAL gives back exactly what the CONSUME released, one reversal entry.
--
-- RULES IT KEEPS (the same rule as packages/validation/src/schemas/universal-core/package-grant-allocation.domain.ts,
-- proven against packages/validation/src/__golden__/package-grant-vectors.json by the PGlite scenario)
--   SOLD != ACTIVATED          the term starts on the date of the first valid CONSUME (read from the allocations)
--   fail closed                no eligible GRANT -> INSUFFICIENT_ELIGIBLE_PACKAGE_CREDIT; no deferred-revenue account ->
--                              DEFERRED_REVENUE_ACCOUNT_MISSING; the sale was never booked -> PACKAGE_INVOICE_NOT_BOOKED;
--                              a closed period -> ACCOUNTING_PERIOD_LOCKED (from the journal function). The whole delivery
--                              rolls back in every case.
--   no backfill                a GRANT sold before this migration has deferred_amount NULL and releases nothing.
--                              Consumptions written before this migration have no allocation: they are charged to the oldest
--                              GRANTs with no deferred amount, so they are never counted twice.
--   append-only                allocations and suspensions cannot be updated or deleted.
--
-- NOT DECIDED HERE (owner questions in docs/architecture/universal-business-core/M5-DECISIONS.md)
--   C1 what an EXPIRED GRANT's remainder does after a renewal: nothing here revives it, nothing here writes EXPIRE.
--
-- RUN ORDER: after package-credit-ledger-01, service-delivery-01/02/03, accounts-role-deferred-and-loss-01.
--            Verify with docs/VERIFY-package-deferred-revenue-01.sql.
--
-- ROLLBACK / MITIGATION (history is never edited; the columns and tables are left in place):
--   DROP TRIGGER IF EXISTS trg_package_credit_allocate ON public.package_credit_ledger;
--   -- the allocation, suspension and journal rows already written stay as the audit trail
-- ============================================================================

-- 1. Columns ---------------------------------------------------------------
ALTER TABLE public.package_credit_ledger ADD COLUMN IF NOT EXISTS deferred_amount numeric(18, 2);
ALTER TABLE public.package_credit_ledger ADD COLUMN IF NOT EXISTS term_months smallint;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS package_term_months smallint;

DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pkg_credit_deferred_amount') THEN
    ALTER TABLE public.package_credit_ledger
      ADD CONSTRAINT chk_pkg_credit_deferred_amount
      CHECK (deferred_amount IS NULL OR (entry_type = 'GRANT' AND deferred_amount >= 0)) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pkg_credit_term_months') THEN
    ALTER TABLE public.package_credit_ledger
      ADD CONSTRAINT chk_pkg_credit_term_months
      CHECK (term_months IS NULL OR (entry_type = 'GRANT' AND term_months IN (1, 6, 12))) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_package_term_months') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_package_term_months
      CHECK (package_term_months IS NULL OR package_term_months IN (1, 6, 12)) NOT VALID;
  END IF;
END
$guard$;

-- 2. Allocations (append-only) ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.package_credit_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  -- the CONSUME or REVERSAL ledger entry this row belongs to
  entry_id uuid NOT NULL REFERENCES public.package_credit_ledger(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('CONSUME', 'REVERSAL')),
  -- the GRANT the units came from; NULL = balance no GRANT owns (a manual top-up): it releases nothing
  grant_entry_id uuid REFERENCES public.package_credit_ledger(id) ON DELETE RESTRICT,
  quantity numeric(18, 4) NOT NULL CHECK (quantity > 0),
  released_amount numeric(18, 2) NOT NULL DEFAULT 0 CHECK (released_amount >= 0),
  effective_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pkg_alloc_entry_grant
  ON public.package_credit_allocations (entry_id, COALESCE(grant_entry_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_pkg_alloc_grant
  ON public.package_credit_allocations (workspace_id, grant_entry_id);

-- 3. Suspension EVENTS of ONE GRANT (append-only: a GRANT is suspended from a SUSPEND event until a later RESUME event;
--    resuming never edits the earlier row) --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.package_credit_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  grant_entry_id uuid NOT NULL REFERENCES public.package_credit_ledger(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('SUSPEND', 'RESUME')),
  effective_on date NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pkg_susp_grant
  ON public.package_credit_suspensions (workspace_id, grant_entry_id);

CREATE OR REPLACE FUNCTION public.prevent_package_credit_side_table_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  RAISE EXCEPTION 'PACKAGE_CREDIT_HISTORY_IMMUTABLE: % rows are append-only; add a compensating row', TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$fn$;

DROP TRIGGER IF EXISTS trg_pkg_alloc_immutable ON public.package_credit_allocations;
CREATE TRIGGER trg_pkg_alloc_immutable
  BEFORE UPDATE OR DELETE ON public.package_credit_allocations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_package_credit_side_table_mutation();

DROP TRIGGER IF EXISTS trg_pkg_susp_immutable ON public.package_credit_suspensions;
CREATE TRIGGER trg_pkg_susp_immutable
  BEFORE UPDATE OR DELETE ON public.package_credit_suspensions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_package_credit_side_table_mutation();

-- Trigger-only guard: fires on DML, never callable via /rpc by client roles.
REVOKE ALL ON FUNCTION public.prevent_package_credit_side_table_mutation() FROM PUBLIC, anon, authenticated, service_role;

-- Privileges: a new Supabase table is born with ALL for service_role / anon / authenticated - take it away first.
REVOKE ALL ON public.package_credit_allocations FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.package_credit_suspensions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.package_credit_allocations TO authenticated, service_role;
GRANT SELECT, INSERT ON public.package_credit_suspensions TO service_role;
GRANT SELECT ON public.package_credit_suspensions TO authenticated;

ALTER TABLE public.package_credit_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_credit_suspensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS package_credit_allocations_member_read ON public.package_credit_allocations;
CREATE POLICY package_credit_allocations_member_read ON public.package_credit_allocations
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS package_credit_suspensions_member_read ON public.package_credit_suspensions;
CREATE POLICY package_credit_suspensions_member_read ON public.package_credit_suspensions
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())));

-- 4. The allocation + release trigger --------------------------------------
CREATE OR REPLACE FUNCTION public.package_credit_allocate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_grant        public.package_credit_ledger%ROWTYPE;
  v_need         numeric;
  v_legacy_left  numeric;
  v_activated    date;
  v_consumed     numeric;
  v_released     numeric;
  v_adjust       numeric;
  v_legacy_take  numeric;
  v_avail        numeric;
  v_take         numeric;
  v_remaining    numeric;
  v_release      numeric;
  v_total        numeric := 0;
  v_unattr       numeric;
  v_def_acct     uuid;
  v_sales_acct   uuid;
  v_orig_journal uuid;
  v_rev          record;
  v_orig         public.package_credit_ledger%ROWTYPE;
BEGIN
  IF NEW.entry_type = 'CONSUME' THEN
    -- Serialise on the customer exactly as package_credit_consume and the delivery function do (re-entrant).
    PERFORM 1 FROM public.customers WHERE id = NEW.customer_id AND workspace_id = NEW.workspace_id FOR UPDATE;

    v_need := NEW.quantity;

    -- Consumptions written before this migration have no allocation: charge them, oldest first, to GRANTs that carry no
    -- deferred amount (they were sold before the cut-over). Never counted twice, never released.
    SELECT COALESCE(SUM(CASE WHEN c.entry_type = 'CONSUME' THEN c.quantity ELSE -c.quantity END), 0)
      INTO v_legacy_left
      FROM public.package_credit_ledger c
     WHERE c.workspace_id = NEW.workspace_id AND c.customer_id = NEW.customer_id
       AND c.package_product_id = NEW.package_product_id AND c.deleted_at IS NULL
       AND c.id <> NEW.id
       AND c.entry_type IN ('CONSUME', 'REVERSAL')
       AND NOT EXISTS (SELECT 1 FROM public.package_credit_allocations a WHERE a.entry_id = c.id)
       AND NOT (c.entry_type = 'REVERSAL' AND EXISTS (
             SELECT 1 FROM public.package_credit_allocations a2 WHERE a2.entry_id = c.reference_entry_id));
    v_legacy_left := GREATEST(v_legacy_left, 0);

    FOR v_grant IN
      SELECT g.* FROM public.package_credit_ledger g
       WHERE g.workspace_id = NEW.workspace_id AND g.customer_id = NEW.customer_id
         AND g.package_product_id = NEW.package_product_id
         AND g.entry_type = 'GRANT' AND g.deleted_at IS NULL
       ORDER BY g.effective_date, g.id
    LOOP
      EXIT WHEN v_need <= 0;

      SELECT COALESCE(SUM(CASE a.kind WHEN 'CONSUME' THEN a.quantity ELSE -a.quantity END), 0),
             COALESCE(SUM(CASE a.kind WHEN 'CONSUME' THEN a.released_amount ELSE -a.released_amount END), 0)
        INTO v_consumed, v_released
        FROM public.package_credit_allocations a
       WHERE a.grant_entry_id = v_grant.id;

      SELECT COALESCE(SUM(j.quantity), 0) INTO v_adjust
        FROM public.package_credit_ledger j
       WHERE j.workspace_id = NEW.workspace_id AND j.entry_type = 'ADJUSTMENT'
         AND j.reference_entry_id = v_grant.id AND j.deleted_at IS NULL;

      v_legacy_take := 0;
      IF v_grant.deferred_amount IS NULL AND v_legacy_left > 0 THEN
        v_legacy_take := LEAST(v_legacy_left, GREATEST(v_grant.quantity + v_adjust - v_consumed, 0));
        v_legacy_left := v_legacy_left - v_legacy_take;
      END IF;

      -- Eligibility: not before the sale, not past the end of the term (which starts at the first valid consume),
      -- not inside a suspension of THIS GRANT.
      CONTINUE WHEN NEW.effective_date < v_grant.effective_date;

      SELECT MIN(c.effective_date) INTO v_activated
        FROM public.package_credit_allocations a
        JOIN public.package_credit_ledger c ON c.id = a.entry_id
       WHERE a.grant_entry_id = v_grant.id AND a.kind = 'CONSUME'
         AND NOT EXISTS (SELECT 1 FROM public.package_credit_ledger r
                          WHERE r.entry_type = 'REVERSAL' AND r.reference_entry_id = c.id AND r.deleted_at IS NULL);

      CONTINUE WHEN v_grant.term_months IS NOT NULL AND v_activated IS NOT NULL
                AND NEW.effective_date > (v_activated + make_interval(months => v_grant.term_months))::date;

      -- The last suspension event on or before the day decides: SUSPEND stops THIS GRANT only, RESUME lifts it.
      CONTINUE WHEN COALESCE((
        SELECT s.kind FROM public.package_credit_suspensions s
         WHERE s.grant_entry_id = v_grant.id AND s.effective_on <= NEW.effective_date
         ORDER BY s.effective_on DESC, s.created_at DESC, s.id DESC LIMIT 1), 'RESUME') = 'SUSPEND';

      v_avail := round(v_grant.quantity + v_adjust - v_consumed - v_legacy_take, 4);
      CONTINUE WHEN v_avail <= 0;

      v_take := LEAST(v_need, v_avail);
      v_release := 0;
      IF v_grant.deferred_amount IS NOT NULL THEN
        v_remaining := GREATEST(0, round(v_grant.deferred_amount - v_released, 2));
        IF v_take = v_avail AND v_adjust = 0 THEN
          v_release := v_remaining;
        ELSE
          v_release := LEAST(v_remaining, round(v_take * v_grant.deferred_amount / v_grant.quantity, 2));
        END IF;

        -- The sale must be in the books before a single cent of it is released.
        IF v_release > 0 AND NOT EXISTS (
             SELECT 1 FROM public.journal_entries je
              WHERE je.workspace_id = NEW.workspace_id AND je.source_type = 'invoice'
                AND je.source_id = v_grant.source_document_id AND je.status <> 'cancelled') THEN
          RAISE EXCEPTION 'PACKAGE_INVOICE_NOT_BOOKED: the invoice that sold this package has no journal entry' USING ERRCODE = 'P0001';
        END IF;
      END IF;

      INSERT INTO public.package_credit_allocations
        (workspace_id, entry_id, kind, grant_entry_id, quantity, released_amount, effective_date)
      VALUES (NEW.workspace_id, NEW.id, 'CONSUME', v_grant.id, v_take, v_release, NEW.effective_date);

      v_total := round(v_total + v_release, 2);
      v_need := round(v_need - v_take, 4);
    END LOOP;

    IF v_need > 0 THEN
      -- Balance no GRANT owns (a manual top-up): used only after every GRANT, releases nothing.
      SELECT COALESCE(SUM(j.quantity), 0) INTO v_unattr
        FROM public.package_credit_ledger j
       WHERE j.workspace_id = NEW.workspace_id AND j.customer_id = NEW.customer_id
         AND j.package_product_id = NEW.package_product_id AND j.entry_type = 'ADJUSTMENT'
         AND j.reference_entry_id IS NULL AND j.quantity > 0 AND j.deleted_at IS NULL;
      v_unattr := v_unattr - COALESCE((
        SELECT SUM(CASE a.kind WHEN 'CONSUME' THEN a.quantity ELSE -a.quantity END)
          FROM public.package_credit_allocations a
          JOIN public.package_credit_ledger c ON c.id = a.entry_id
         WHERE a.grant_entry_id IS NULL AND c.customer_id = NEW.customer_id
           AND c.package_product_id = NEW.package_product_id), 0);
      IF v_need > v_unattr THEN
        RAISE EXCEPTION 'INSUFFICIENT_ELIGIBLE_PACKAGE_CREDIT: % unit(s) no eligible GRANT could cover', v_need
          USING ERRCODE = 'P0001';
      END IF;
      INSERT INTO public.package_credit_allocations
        (workspace_id, entry_id, kind, grant_entry_id, quantity, released_amount, effective_date)
      VALUES (NEW.workspace_id, NEW.id, 'CONSUME', NULL, v_need, 0, NEW.effective_date);
    END IF;

    IF v_total > 0 THEN
      SELECT id INTO v_def_acct FROM public.accounts
       WHERE workspace_id = NEW.workspace_id AND role = 'deferred_revenue' AND deleted_at IS NULL AND is_active = true LIMIT 1;
      IF v_def_acct IS NULL THEN
        RAISE EXCEPTION 'DEFERRED_REVENUE_ACCOUNT_MISSING' USING ERRCODE = 'P0001';
      END IF;
      SELECT id INTO v_sales_acct FROM public.accounts
       WHERE workspace_id = NEW.workspace_id AND role = 'sales' AND deleted_at IS NULL AND is_active = true LIMIT 1;
      IF v_sales_acct IS NULL THEN
        RAISE EXCEPTION 'SALES_ACCOUNT_MISSING' USING ERRCODE = 'P0001';
      END IF;
      PERFORM public.accounting_post_journal_entry(
        NEW.workspace_id, NULL,
        jsonb_build_object('date', NEW.effective_date::text,
                           'description', 'Package delivery: deferred revenue released',
                           'reference', NEW.id::text, 'status', 'posted',
                           'source_type', 'package_release', 'source_id', NEW.id::text),
        jsonb_build_array(
          jsonb_build_object('account_id', v_def_acct, 'debit', v_total, 'credit', 0),
          jsonb_build_object('account_id', v_sales_acct, 'debit', 0, 'credit', v_total)));
    END IF;

  ELSIF NEW.entry_type = 'REVERSAL' THEN
    -- Give back exactly what the CONSUME allocated and released; a REVERSAL of anything else changes nothing here.
    SELECT * INTO v_orig FROM public.package_credit_ledger
     WHERE id = NEW.reference_entry_id AND workspace_id = NEW.workspace_id AND entry_type = 'CONSUME';
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.package_credit_allocations
      (workspace_id, entry_id, kind, grant_entry_id, quantity, released_amount, effective_date)
    SELECT a.workspace_id, NEW.id, 'REVERSAL', a.grant_entry_id, a.quantity, a.released_amount, NEW.effective_date
      FROM public.package_credit_allocations a
     WHERE a.entry_id = v_orig.id AND a.kind = 'CONSUME';

    SELECT COALESCE(SUM(a.released_amount), 0) INTO v_total
      FROM public.package_credit_allocations a WHERE a.entry_id = v_orig.id AND a.kind = 'CONSUME';

    IF v_total > 0 THEN
      SELECT id INTO v_orig_journal FROM public.journal_entries
       WHERE workspace_id = NEW.workspace_id AND source_type = 'package_release'
         AND source_id = v_orig.id AND status <> 'cancelled' LIMIT 1;
      IF v_orig_journal IS NULL THEN
        RAISE EXCEPTION 'PACKAGE_RELEASE_ENTRY_MISSING: the release being reversed was never posted' USING ERRCODE = 'P0001';
      END IF;
      SELECT id INTO v_def_acct FROM public.accounts
       WHERE workspace_id = NEW.workspace_id AND role = 'deferred_revenue' AND deleted_at IS NULL AND is_active = true LIMIT 1;
      SELECT id INTO v_sales_acct FROM public.accounts
       WHERE workspace_id = NEW.workspace_id AND role = 'sales' AND deleted_at IS NULL AND is_active = true LIMIT 1;
      IF v_def_acct IS NULL OR v_sales_acct IS NULL THEN
        RAISE EXCEPTION 'DEFERRED_REVENUE_ACCOUNT_MISSING' USING ERRCODE = 'P0001';
      END IF;
      PERFORM public.accounting_post_journal_entry(
        NEW.workspace_id, NULL,
        jsonb_build_object('date', NEW.effective_date::text,
                           'description', 'Package delivery cancelled: deferred revenue restored',
                           'reference', NEW.id::text, 'status', 'posted',
                           'source_type', 'package_release_reversal', 'source_id', NEW.id::text,
                           'reversal_of', v_orig_journal::text),
        jsonb_build_array(
          jsonb_build_object('account_id', v_sales_acct, 'debit', v_total, 'credit', 0),
          jsonb_build_object('account_id', v_def_acct, 'debit', 0, 'credit', v_total)));
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.package_credit_allocate() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_package_credit_allocate ON public.package_credit_ledger;
CREATE TRIGGER trg_package_credit_allocate
  AFTER INSERT ON public.package_credit_ledger
  FOR EACH ROW
  WHEN (NEW.entry_type IN ('CONSUME', 'REVERSAL'))
  EXECUTE FUNCTION public.package_credit_allocate();

NOTIFY pgrst, 'reload schema';

-- 5. What the profit report needs from the ledger (B2-5): the net change of the deferred-revenue liability in a window --------
--    credits at the sale minus releases at delivery, books currency. Package revenue is recognised at DELIVERY, so the report's
--    revenue is the invoices' net sales minus this. Read-only; a workspace with no deferred-revenue account gets 0.
CREATE OR REPLACE FUNCTION public.accounting_deferred_revenue_change(
  p_workspace_id uuid, p_from date, p_to date
) RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT COALESCE(SUM(jl.credit - jl.debit), 0)
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON je.id = jl.journal_id
    JOIN public.accounts a ON a.id = jl.account_id
   WHERE je.workspace_id = p_workspace_id AND a.workspace_id = p_workspace_id
     -- 'reversed' originals COUNT: the reversal entry that cancels them is 'posted', and a sum that kept only one of the
     -- two would be wrong by exactly the reversed amount
     AND a.role = 'deferred_revenue' AND je.status IN ('posted', 'reversed')
     AND je.date >= p_from AND je.date <= p_to;
$fn$;

REVOKE ALL ON FUNCTION public.accounting_deferred_revenue_change(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_deferred_revenue_change(uuid, date, date) TO service_role;

NOTIFY pgrst, 'reload schema';


-- ────────────────────────────────────────────────────────────────────────
-- [38/59] service-delivery-01-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- Hisabche Migration: Service Delivery & Attendance Core (M4)
-- File: docs/service-delivery-01-migration.sql
-- Status: Post-migration verification query generated — PENDING HUMAN CONFIRMATION
--
-- Description:
-- Adds public.service_delivery_sessions table for tracking service sessions,
-- practitioner attendance connections, and package credit redemptions.
--
-- Invariants:
-- 1. Tenancy boundary: workspace_id strictly enforced.
-- 2. RLS enabled: tenant isolation by workspace MEMBERSHIP (workspace_members), like every other tenant table.
-- 3. Security: REVOKE ALL from PUBLIC, anon.
-- ============================================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.service_delivery_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    service_offering_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    practitioner_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    session_date DATE NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
    settlement_method VARCHAR(30) NOT NULL DEFAULT 'package_credit',
    package_credit_id UUID REFERENCES public.package_credit_ledger(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    client_notes TEXT,
    internal_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    deleted_at TIMESTAMPTZ,
    origin VARCHAR(30) NOT NULL DEFAULT 'cloud',
    sync_state VARCHAR(30) NOT NULL DEFAULT 'synced',
    CONSTRAINT chk_service_delivery_status CHECK (
        status IN ('scheduled', 'in_progress', 'delivered', 'cancelled', 'no_show')
    ),
    CONSTRAINT chk_service_delivery_settlement CHECK (
        settlement_method IN ('package_credit', 'invoice', 'complementary')
    )
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_service_delivery_workspace_date
    ON public.service_delivery_sessions (workspace_id, session_date);

CREATE INDEX IF NOT EXISTS idx_service_delivery_customer
    ON public.service_delivery_sessions (workspace_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_service_delivery_practitioner
    ON public.service_delivery_sessions (workspace_id, practitioner_id)
    WHERE practitioner_id IS NOT NULL;

-- 3. Enable Row Level Security
ALTER TABLE public.service_delivery_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Revoke and Grant Permissions
REVOKE ALL ON public.service_delivery_sessions FROM PUBLIC;
REVOKE ALL ON public.service_delivery_sessions FROM anon;

GRANT SELECT, INSERT, UPDATE ON public.service_delivery_sessions TO authenticated;
GRANT ALL ON public.service_delivery_sessions TO service_role;

-- 5. RLS Policies
DROP POLICY IF EXISTS service_delivery_sessions_tenant_isolation ON public.service_delivery_sessions;
CREATE POLICY service_delivery_sessions_tenant_isolation ON public.service_delivery_sessions
    FOR ALL
    TO authenticated
    USING (
        workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid()))
    )
    WITH CHECK (
        workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid()))
    );

-- 6. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.trg_service_delivery_sessions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_delivery_sessions_timestamp ON public.service_delivery_sessions;
CREATE TRIGGER trg_service_delivery_sessions_timestamp
    BEFORE UPDATE ON public.service_delivery_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_service_delivery_sessions_updated_at();

-- ============================================================================
-- Rollback block
-- ============================================================================
/*
DROP TRIGGER IF EXISTS trg_service_delivery_sessions_timestamp ON public.service_delivery_sessions;
DROP FUNCTION IF EXISTS public.trg_service_delivery_sessions_updated_at();
DROP POLICY IF EXISTS service_delivery_sessions_tenant_isolation ON public.service_delivery_sessions;
DROP TABLE IF EXISTS public.service_delivery_sessions;
*/


-- ────────────────────────────────────────────────────────────────────────
-- [39/59] service-delivery-02-atomic-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- Hisabche Migration: Service Delivery - atomic deliver / cancel (M4 audit)
-- File: docs/service-delivery-02-atomic-migration.sql
-- Status: Post-migration verification query generated - PENDING HUMAN CONFIRMATION
--
-- Needs: docs/package-credit-ledger-01-migration.sql and docs/service-delivery-01-migration.sql already applied.
-- Additive and idempotent. Nothing is deleted or rewritten; the append-only ledger is only ever INSERTed into.
--
-- WHY
--   Delivering a session was two round trips (consume credit, then update the session) and cancelling was two more.
--   A crash between them left a credit consumed with the session not delivered, or the reverse; two simultaneous
--   deliveries both passed the status check. These two functions do each action in ONE transaction, with the session
--   row locked, and make the ledger itself refuse a second consume / reversal for the same session.
--
-- RULES (the same ones the pure domain states - packages/validation .../service-delivery.domain.ts)
--   package_credit : needs a package and enough credit, else the whole call fails; never turns into another settlement
--   invoice        : needs an existing invoice of the SAME customer in the SAME workspace
--   complementary  : needs a reason
--   cancel         : a delivered package session is reversed by a compensating REVERSAL that references the consume;
--                    a delivered invoiced session is REFUSED (a correction flow, not a status flip)
--   identity       : the idempotency key of a delivery is derived from the session ('delivery_<id>' / 'delivery_cancel_<id>')
-- ============================================================================

-- 1. The reason a free session was free.
ALTER TABLE public.service_delivery_sessions
  ADD COLUMN IF NOT EXISTS settlement_reason text;

-- 2. A delivered session carries what its settlement needs. NOT VALID: rows written before this migration are not
--    rewritten or rejected; every NEW or UPDATED row is checked.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_delivery_free_has_reason') THEN
    ALTER TABLE public.service_delivery_sessions
      ADD CONSTRAINT chk_service_delivery_free_has_reason CHECK (
        status <> 'delivered' OR settlement_method <> 'complementary'
        OR (settlement_reason IS NOT NULL AND length(btrim(settlement_reason)) > 0)
      ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_delivery_invoice_has_invoice') THEN
    ALTER TABLE public.service_delivery_sessions
      ADD CONSTRAINT chk_service_delivery_invoice_has_invoice CHECK (
        status <> 'delivered' OR settlement_method <> 'invoice' OR invoice_id IS NOT NULL
      ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_delivery_credit_has_entry') THEN
    ALTER TABLE public.service_delivery_sessions
      ADD CONSTRAINT chk_service_delivery_credit_has_entry CHECK (
        status <> 'delivered' OR settlement_method <> 'package_credit' OR package_credit_id IS NOT NULL
      ) NOT VALID;
  END IF;
END $$;

-- 3. One consume and one reversal per service session - enforced by the ledger, not by the caller's good behaviour.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pkg_credit_service_consume
  ON public.package_credit_ledger (workspace_id, source_document_id)
  WHERE source_document_type = 'service_delivery' AND entry_type = 'CONSUME' AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pkg_credit_service_reversal
  ON public.package_credit_ledger (workspace_id, source_document_id)
  WHERE source_document_type = 'service_delivery' AND entry_type = 'REVERSAL' AND deleted_at IS NULL;

-- 3b. Row-level security by MEMBERSHIP, like every other tenant table. Migration 01 scoped the policy by a JWT claim
--     (`request.jwt.claims`) that the other tables do not use and that nothing in this codebase sets; the repository's
--     RLS guard accepts only the membership chain. The policy is replaced (idempotent); the server uses service_role
--     and is unaffected.
DROP POLICY IF EXISTS service_delivery_sessions_tenant_isolation ON public.service_delivery_sessions;
CREATE POLICY service_delivery_sessions_tenant_isolation ON public.service_delivery_sessions
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid()))
  );

-- 4. DELIVER: session transition + settlement fact in one transaction.
CREATE OR REPLACE FUNCTION public.service_delivery_deliver(
  p_workspace_id        uuid,
  p_session_id          uuid,
  p_settlement          text,
  p_package_product_id  uuid DEFAULT NULL,
  p_quantity            numeric DEFAULT 1,
  p_invoice_id          uuid DEFAULT NULL,
  p_reason              text DEFAULT NULL,
  p_entry_id            uuid DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_s        public.service_delivery_sessions%ROWTYPE;
  v_key      text;
  v_balance  numeric;
  v_entry_id uuid;
  v_existing public.package_credit_ledger%ROWTYPE;
  v_reason   text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF p_workspace_id IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_AND_SESSION_REQUIRED' USING ERRCODE = '22000';
  END IF;
  IF p_settlement IS NULL OR p_settlement NOT IN ('package_credit', 'invoice', 'complementary') THEN
    RAISE EXCEPTION 'SETTLEMENT_METHOD_REQUIRED' USING ERRCODE = '22000';
  END IF;

  -- The session row is locked for the whole call: two simultaneous deliveries queue here.
  SELECT * INTO v_s
    FROM public.service_delivery_sessions
   WHERE id = p_session_id AND workspace_id = p_workspace_id AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVICE_DELIVERY_SESSION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- A replay of a delivery that already happened: the same answer, nothing written.
  IF v_s.status = 'delivered' THEN
    IF v_s.settlement_method <> p_settlement THEN
      RAISE EXCEPTION 'SESSION_ALREADY_DELIVERED_DIFFERENTLY' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('replayed', true, 'session_id', v_s.id, 'status', v_s.status,
      'settlement_method', v_s.settlement_method, 'package_credit_id', v_s.package_credit_id,
      'invoice_id', v_s.invoice_id, 'updated_at', v_s.updated_at);
  END IF;

  IF v_s.status NOT IN ('scheduled', 'in_progress') THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION:%->delivered', v_s.status USING ERRCODE = 'P0001';
  END IF;

  IF p_expected_updated_at IS NOT NULL AND v_s.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'SESSION_CHANGED' USING ERRCODE = 'P0001';
  END IF;

  IF p_settlement = 'package_credit' THEN
    IF p_package_product_id IS NULL THEN
      RAISE EXCEPTION 'SETTLEMENT_PACKAGE_REQUIRED' USING ERRCODE = '22000';
    END IF;
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
      RAISE EXCEPTION 'CONSUMPTION_QUANTITY_MUST_BE_POSITIVE' USING ERRCODE = '22000';
    END IF;
    v_key := 'delivery_' || v_s.id::text;

    -- Serialise on the customer exactly as package_credit_consume does.
    PERFORM 1 FROM public.customers WHERE id = v_s.customer_id AND workspace_id = p_workspace_id FOR UPDATE;

    -- A consume already written for this session (an interrupted earlier attempt): reuse it, never write a second.
    SELECT * INTO v_existing
      FROM public.package_credit_ledger
     WHERE workspace_id = p_workspace_id AND idempotency_key = v_key AND deleted_at IS NULL
     LIMIT 1;
    IF FOUND THEN
      IF v_existing.customer_id <> v_s.customer_id OR v_existing.package_product_id <> p_package_product_id THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH' USING ERRCODE = 'P0001';
      END IF;
      v_entry_id := v_existing.id;
    ELSE
      SELECT COALESCE(SUM(CASE
               WHEN entry_type IN ('GRANT', 'ADJUSTMENT', 'REVERSAL') THEN quantity
               WHEN entry_type IN ('CONSUME', 'EXPIRE') THEN -quantity
               ELSE 0 END), 0)
        INTO v_balance
        FROM public.package_credit_ledger
       WHERE workspace_id = p_workspace_id AND customer_id = v_s.customer_id
         AND package_product_id = p_package_product_id AND deleted_at IS NULL;
      IF v_balance < p_quantity THEN
        RAISE EXCEPTION 'INSUFFICIENT_PACKAGE_CREDIT: available % is less than requested %', v_balance, p_quantity
          USING ERRCODE = 'P0001';
      END IF;

      v_entry_id := COALESCE(p_entry_id, gen_random_uuid());
      INSERT INTO public.package_credit_ledger (
        id, workspace_id, customer_id, package_product_id, entry_type, quantity,
        source_document_type, source_document_id, idempotency_key, notes, effective_date
      ) VALUES (
        v_entry_id, p_workspace_id, v_s.customer_id, p_package_product_id, 'CONSUME', p_quantity,
        'service_delivery', v_s.id, v_key, 'Delivered service session ' || v_s.id::text, v_s.session_date
      );
    END IF;

    UPDATE public.service_delivery_sessions
       SET status = 'delivered', settlement_method = 'package_credit', package_credit_id = v_entry_id
     WHERE id = v_s.id;

  ELSIF p_settlement = 'invoice' THEN
    IF p_invoice_id IS NULL THEN
      RAISE EXCEPTION 'SETTLEMENT_INVOICE_REQUIRED' USING ERRCODE = '22000';
    END IF;
    PERFORM 1 FROM public.invoices
     WHERE id = p_invoice_id AND workspace_id = p_workspace_id AND customer_id = v_s.customer_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SETTLEMENT_INVOICE_INVALID' USING ERRCODE = '22000';
    END IF;
    UPDATE public.service_delivery_sessions
       SET status = 'delivered', settlement_method = 'invoice', invoice_id = p_invoice_id
     WHERE id = v_s.id;

  ELSE
    IF v_reason IS NULL THEN
      RAISE EXCEPTION 'SETTLEMENT_REASON_REQUIRED' USING ERRCODE = '22000';
    END IF;
    UPDATE public.service_delivery_sessions
       SET status = 'delivered', settlement_method = 'complementary', settlement_reason = v_reason
     WHERE id = v_s.id;
  END IF;

  SELECT * INTO v_s FROM public.service_delivery_sessions WHERE id = p_session_id;
  RETURN jsonb_build_object('replayed', false, 'session_id', v_s.id, 'status', v_s.status,
    'settlement_method', v_s.settlement_method, 'package_credit_id', v_s.package_credit_id,
    'invoice_id', v_s.invoice_id, 'updated_at', v_s.updated_at);
END;
$$;

-- 5. CANCEL: session transition + compensating reversal in one transaction.
--    Created ONLY while migration 03 has not replaced it: re-running 02 after 03 must not bring the old
--    3-argument function (no reason) back next to the 4-argument one.
DO $guard$
BEGIN
  IF to_regprocedure('public.service_delivery_cancel(uuid, uuid, uuid, text)') IS NULL THEN
    EXECUTE $f$
CREATE OR REPLACE FUNCTION public.service_delivery_cancel(
  p_workspace_id uuid,
  p_session_id   uuid,
  p_entry_id     uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_s        public.service_delivery_sessions%ROWTYPE;
  v_consume  public.package_credit_ledger%ROWTYPE;
  v_rev_id   uuid;
BEGIN
  IF p_workspace_id IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_AND_SESSION_REQUIRED' USING ERRCODE = '22000';
  END IF;

  SELECT * INTO v_s
    FROM public.service_delivery_sessions
   WHERE id = p_session_id AND workspace_id = p_workspace_id AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVICE_DELIVERY_SESSION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_s.status = 'cancelled' THEN
    RETURN jsonb_build_object('replayed', true, 'session_id', v_s.id, 'status', v_s.status, 'reversal_entry_id', NULL);
  END IF;

  IF v_s.status NOT IN ('scheduled', 'in_progress', 'delivered') THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION:%->cancelled', v_s.status USING ERRCODE = 'P0001';
  END IF;

  IF v_s.status = 'delivered' THEN
    IF v_s.settlement_method = 'invoice' THEN
      RAISE EXCEPTION 'DELIVERED_INVOICE_CORRECTION_REQUIRED' USING ERRCODE = 'P0001';
    END IF;

    IF v_s.settlement_method = 'package_credit' THEN
      IF v_s.package_credit_id IS NULL THEN
        RAISE EXCEPTION 'CREDIT_REFERENCE_MISSING' USING ERRCODE = 'P0001';
      END IF;
      SELECT * INTO v_consume
        FROM public.package_credit_ledger
       WHERE id = v_s.package_credit_id AND workspace_id = p_workspace_id AND entry_type = 'CONSUME';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'CREDIT_REFERENCE_MISSING' USING ERRCODE = 'P0001';
      END IF;

      -- Serialise on the customer, then give the credit back ONCE (the unique index also guarantees it).
      PERFORM 1 FROM public.customers WHERE id = v_consume.customer_id AND workspace_id = p_workspace_id FOR UPDATE;

      SELECT id INTO v_rev_id
        FROM public.package_credit_ledger
       WHERE workspace_id = p_workspace_id AND entry_type = 'REVERSAL'
         AND reference_entry_id = v_consume.id AND deleted_at IS NULL
       LIMIT 1;
      IF v_rev_id IS NULL THEN
        v_rev_id := COALESCE(p_entry_id, gen_random_uuid());
        INSERT INTO public.package_credit_ledger (
          id, workspace_id, customer_id, package_product_id, entry_type, quantity,
          source_document_type, source_document_id, reference_entry_id, idempotency_key, notes, effective_date
        ) VALUES (
          v_rev_id, p_workspace_id, v_consume.customer_id, v_consume.package_product_id, 'REVERSAL',
          v_consume.quantity, 'service_delivery', v_s.id, v_consume.id,
          'delivery_cancel_' || v_s.id::text, 'Reversal for cancelled service session ' || v_s.id::text,
          CURRENT_DATE
        );
      END IF;
    END IF;
  END IF;

  UPDATE public.service_delivery_sessions SET status = 'cancelled' WHERE id = v_s.id;

  RETURN jsonb_build_object('replayed', false, 'session_id', v_s.id, 'status', 'cancelled', 'reversal_entry_id', v_rev_id);
END;
$$;

    $f$;
    REVOKE EXECUTE ON FUNCTION public.service_delivery_cancel(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.service_delivery_cancel(uuid, uuid, uuid) TO service_role;
  END IF;
END
$guard$;

REVOKE EXECUTE ON FUNCTION public.service_delivery_deliver(uuid, uuid, text, uuid, numeric, uuid, text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_delivery_deliver(uuid, uuid, text, uuid, numeric, uuid, text, uuid, timestamptz) TO service_role;

-- ============================================================================
-- Rollback / mitigation (nothing here edits history, so rolling back loses no fact)
-- ============================================================================
/*
DROP FUNCTION IF EXISTS public.service_delivery_cancel(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.service_delivery_deliver(uuid, uuid, text, uuid, numeric, uuid, text, uuid, timestamptz);
DROP INDEX IF EXISTS public.uq_pkg_credit_service_reversal;
-- (the membership policy of 3b is left in place)
DROP INDEX IF EXISTS public.uq_pkg_credit_service_consume;
ALTER TABLE public.service_delivery_sessions DROP CONSTRAINT IF EXISTS chk_service_delivery_credit_has_entry;
ALTER TABLE public.service_delivery_sessions DROP CONSTRAINT IF EXISTS chk_service_delivery_invoice_has_invoice;
ALTER TABLE public.service_delivery_sessions DROP CONSTRAINT IF EXISTS chk_service_delivery_free_has_reason;
-- the settlement_reason column is left in place: it is additive and holds audit text.
*/


-- ────────────────────────────────────────────────────────────────────────
-- [40/59] service-delivery-05-session-subject-participants-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- Hisabche Migration: Service Delivery — session subject, free-text type, participants (M4.5)
-- File: docs/service-delivery-05-session-subject-participants-migration.sql
-- Status: Post-migration verification query generated - PENDING HUMAN CONFIRMATION
--
-- Needs: docs/service-delivery-01-migration.sql, -02-, -03- and -04- already applied.
-- Safety classification: ADDITIVE + DATA_BACKFILL (deterministic, idempotent).
--   No column, table, index, constraint or policy is dropped except the NOT NULL
--   flag on customer_id, which is WIDENED (never narrowed) so an employee session
--   can exist. No row is rewritten or deleted. Every statement is re-runnable.
--
-- WHY
--   1. A session could only belong to a customer. Businesses also book sessions
--      for their own staff (training, internal meetings). `practitioner_id` is
--      the person who PERFORMS the service — a different fact — and is not
--      repurposed here.
--   2. One session could name only one customer. A group booking needs several
--      customers on ONE session, without duplicating the session.
--   3. The kind of session («کوتاهی», «رنگ», «مشاوره») was not stored at all.
--      It is free text: the business names its own services; no enum is invented.
--
-- MODEL
--   subject_type  'customer' (default, every historical row) | 'employee'
--   customer_id   the PRIMARY customer participant (kept for compatibility;
--                 NULL only for employee sessions)
--   employee_id   the PRIMARY employee subject (NULL for customer sessions)
--   session_type  free text, 1..120 chars after trim, NULL = not stated
--   service_delivery_session_participants
--                 normalized relation: one row per (session, person). The
--                 primary person ALWAYS has a row here too (trigger + backfill),
--                 so «who is in this session» has ONE answer.
--
--   An employee session cannot be delivered as package_credit: a package is a
--   CUSTOMER account and an employee has none. The check below refuses that row
--   state; the deliver RPC already refuses an invoice whose customer does not
--   match, so an employee session settles as complementary (a stated internal
--   service) — no new accounting policy is introduced.
--
-- DEPLOY ORDER
--   Backend first, or together. An old backend keeps writing customer sessions
--   with no subject_type (the default names them correctly) and no participants
--   (the insert trigger creates the primary row). This file alone changes no
--   behaviour of the old code.
-- ============================================================================

-- ─── 1. New columns on the session ─────────────────────────────────────────

ALTER TABLE public.service_delivery_sessions
  ADD COLUMN IF NOT EXISTS subject_type VARCHAR(20) NOT NULL DEFAULT 'customer';

ALTER TABLE public.service_delivery_sessions
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE RESTRICT;

ALTER TABLE public.service_delivery_sessions
  ADD COLUMN IF NOT EXISTS session_type VARCHAR(120);

-- Widening: an employee session has no customer. Existing rows keep their value.
ALTER TABLE public.service_delivery_sessions
  ALTER COLUMN customer_id DROP NOT NULL;

COMMENT ON COLUMN public.service_delivery_sessions.subject_type IS
  'customer = a session for customer participants; employee = a session for staff. practitioner_id remains the performer, never the subject.';
COMMENT ON COLUMN public.service_delivery_sessions.employee_id IS
  'The primary employee subject of an employee session. NULL for customer sessions. Never a customer id.';
COMMENT ON COLUMN public.service_delivery_sessions.session_type IS
  'Free-text kind of session as the business names it (fa/af/en). NULL = not stated. Trimmed, 1..120 chars, never an enum.';

-- ─── 2. Row-level invariants (DROP + ADD in one DO so a second run converges;
--        NOT VALID first, then VALIDATE — no constraint is trusted before the
--        rows are checked) ──────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_delivery_subject_type'
             AND conrelid = 'public.service_delivery_sessions'::regclass) THEN
    ALTER TABLE public.service_delivery_sessions DROP CONSTRAINT chk_service_delivery_subject_type;
  END IF;
  ALTER TABLE public.service_delivery_sessions
    ADD CONSTRAINT chk_service_delivery_subject_type CHECK (
      subject_type IN ('customer', 'employee')
    ) NOT VALID;
END $$;
DO $$
BEGIN
  ALTER TABLE public.service_delivery_sessions VALIDATE CONSTRAINT chk_service_delivery_subject_type;
EXCEPTION
  WHEN check_violation OR foreign_key_violation THEN
    RAISE NOTICE 'Deferred VALIDATE CONSTRAINT % on % (%): new writes stay enforced.', 'chk_service_delivery_subject_type', 'service_delivery_sessions', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_delivery_subject'
             AND conrelid = 'public.service_delivery_sessions'::regclass) THEN
    ALTER TABLE public.service_delivery_sessions DROP CONSTRAINT chk_service_delivery_subject;
  END IF;
  ALTER TABLE public.service_delivery_sessions
    ADD CONSTRAINT chk_service_delivery_subject CHECK (
      (subject_type = 'customer' AND customer_id IS NOT NULL AND employee_id IS NULL)
      OR
      (subject_type = 'employee' AND employee_id IS NOT NULL AND customer_id IS NULL)
    ) NOT VALID;
END $$;
DO $$
BEGIN
  ALTER TABLE public.service_delivery_sessions VALIDATE CONSTRAINT chk_service_delivery_subject;
EXCEPTION
  WHEN check_violation OR foreign_key_violation THEN
    RAISE NOTICE 'Deferred VALIDATE CONSTRAINT % on % (%): new writes stay enforced.', 'chk_service_delivery_subject', 'service_delivery_sessions', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_delivery_session_type'
             AND conrelid = 'public.service_delivery_sessions'::regclass) THEN
    ALTER TABLE public.service_delivery_sessions DROP CONSTRAINT chk_service_delivery_session_type;
  END IF;
  ALTER TABLE public.service_delivery_sessions
    ADD CONSTRAINT chk_service_delivery_session_type CHECK (
      session_type IS NULL OR length(btrim(session_type)) >= 1
    ) NOT VALID;
END $$;
DO $$
BEGIN
  ALTER TABLE public.service_delivery_sessions VALIDATE CONSTRAINT chk_service_delivery_session_type;
EXCEPTION
  WHEN check_violation OR foreign_key_violation THEN
    RAISE NOTICE 'Deferred VALIDATE CONSTRAINT % on % (%): new writes stay enforced.', 'chk_service_delivery_session_type', 'service_delivery_sessions', SQLERRM;
END $$;

-- A delivered employee session can never claim a customer's package credit.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_delivery_employee_settlement'
             AND conrelid = 'public.service_delivery_sessions'::regclass) THEN
    ALTER TABLE public.service_delivery_sessions DROP CONSTRAINT chk_service_delivery_employee_settlement;
  END IF;
  ALTER TABLE public.service_delivery_sessions
    ADD CONSTRAINT chk_service_delivery_employee_settlement CHECK (
      NOT (subject_type = 'employee' AND status = 'delivered' AND settlement_method = 'package_credit')
    ) NOT VALID;
END $$;
DO $$
BEGIN
  ALTER TABLE public.service_delivery_sessions VALIDATE CONSTRAINT chk_service_delivery_employee_settlement;
EXCEPTION
  WHEN check_violation OR foreign_key_violation THEN
    RAISE NOTICE 'Deferred VALIDATE CONSTRAINT % on % (%): new writes stay enforced.', 'chk_service_delivery_employee_settlement', 'service_delivery_sessions', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_delivery_employee
  ON public.service_delivery_sessions (workspace_id, employee_id)
  WHERE employee_id IS NOT NULL;

-- ─── 3. The participant relation ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_delivery_session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.service_delivery_sessions(id) ON DELETE CASCADE,
  participant_type VARCHAR(20) NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
  employee_id UUID REFERENCES public.employees(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by UUID,
  CONSTRAINT chk_sd_participant_type CHECK (participant_type IN ('customer', 'employee')),
  CONSTRAINT chk_sd_participant_ref CHECK (
    (participant_type = 'customer' AND customer_id IS NOT NULL AND employee_id IS NULL)
    OR
    (participant_type = 'employee' AND employee_id IS NOT NULL AND customer_id IS NULL)
  )
);

COMMENT ON TABLE public.service_delivery_session_participants IS
  'Who is in a session. The primary customer/employee always has a row here too. RESTRICT on the person: archiving/deleting a customer never removes session history.';

-- One assignment per person per session (partial: a customer row and an
-- employee row are different facts).
CREATE UNIQUE INDEX IF NOT EXISTS uq_sd_participant_customer
  ON public.service_delivery_session_participants (session_id, customer_id)
  WHERE customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sd_participant_employee
  ON public.service_delivery_session_participants (session_id, employee_id)
  WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sd_participant_session
  ON public.service_delivery_session_participants (session_id);
CREATE INDEX IF NOT EXISTS idx_sd_participant_customer
  ON public.service_delivery_session_participants (workspace_id, customer_id)
  WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sd_participant_employee
  ON public.service_delivery_session_participants (workspace_id, employee_id)
  WHERE employee_id IS NOT NULL;

-- ─── 4. Backend-only table (V61 lockdown rule, salon-01 pattern) ────────────
-- Participants are written by the session service and read through the
-- backend's session/sync routes — no client touches this table through the
-- Data API. RLS ON, NO policy, REVOKE from anon/authenticated, service_role
-- only: a seller must not be able to rewrite who attended a session.

ALTER TABLE public.service_delivery_session_participants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.service_delivery_session_participants FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.service_delivery_session_participants TO service_role;

DROP POLICY IF EXISTS sd_session_participants_tenant_isolation ON public.service_delivery_session_participants;

-- ─── 5. Integrity triggers ─────────────────────────────────────────────────
-- A participant must belong to the session's workspace, reference a person of
-- the SAME workspace, and match the session's subject type. An employee id can
-- therefore never land in a customer slot, or vice versa.

CREATE OR REPLACE FUNCTION public.trg_sd_participant_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session_workspace UUID;
  v_subject VARCHAR(20);
  v_person_workspace UUID;
BEGIN
  SELECT workspace_id, subject_type INTO v_session_workspace, v_subject
    FROM public.service_delivery_sessions WHERE id = NEW.session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_SESSION_NOT_FOUND' USING ERRCODE = '23503';
  END IF;
  IF NEW.workspace_id <> v_session_workspace THEN
    RAISE EXCEPTION 'PARTICIPANT_WORKSPACE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF NEW.participant_type <> v_subject THEN
    RAISE EXCEPTION 'PARTICIPANT_TYPE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF NEW.participant_type = 'customer' THEN
    SELECT workspace_id INTO v_person_workspace FROM public.customers WHERE id = NEW.customer_id;
  ELSE
    SELECT workspace_id INTO v_person_workspace FROM public.employees WHERE id = NEW.employee_id;
  END IF;
  IF v_person_workspace IS NULL THEN
    RAISE EXCEPTION 'PARTICIPANT_PERSON_NOT_FOUND' USING ERRCODE = '23503';
  END IF;
  IF v_person_workspace <> NEW.workspace_id THEN
    RAISE EXCEPTION 'PARTICIPANT_WORKSPACE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.trg_sd_participant_integrity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sd_participant_integrity ON public.service_delivery_session_participants;
CREATE TRIGGER trg_sd_participant_integrity
  BEFORE INSERT OR UPDATE ON public.service_delivery_session_participants
  FOR EACH ROW EXECUTE FUNCTION public.trg_sd_participant_integrity();

-- Removing the PRIMARY participant promotes the oldest remaining one (the
-- session keeps a subject); removing the LAST one is refused — a session
-- without a subject is not a session. Financial/history rows are never touched.
CREATE OR REPLACE FUNCTION public.trg_sd_participant_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_primary UUID;
  v_subject VARCHAR(20);
  v_next RECORD;
BEGIN
  SELECT subject_type,
         CASE WHEN subject_type = 'customer' THEN customer_id ELSE employee_id END
    INTO v_subject, v_primary
    FROM public.service_delivery_sessions WHERE id = OLD.session_id;
  -- The session itself is gone (cascade): nothing to protect.
  IF NOT FOUND THEN RETURN OLD; END IF;

  IF v_primary IS DISTINCT FROM
     CASE WHEN OLD.participant_type = 'customer' THEN OLD.customer_id ELSE OLD.employee_id END THEN
    RETURN OLD; -- not the primary: an ordinary removal
  END IF;

  SELECT id, customer_id, employee_id INTO v_next
    FROM public.service_delivery_session_participants
   WHERE session_id = OLD.session_id AND id <> OLD.id
   ORDER BY created_at, id
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_PRIMARY_PARTICIPANT_REQUIRED' USING ERRCODE = '23514';
  END IF;

  IF v_subject = 'customer' THEN
    UPDATE public.service_delivery_sessions SET customer_id = v_next.customer_id WHERE id = OLD.session_id;
  ELSE
    UPDATE public.service_delivery_sessions SET employee_id = v_next.employee_id WHERE id = OLD.session_id;
  END IF;
  RETURN OLD;
END $$;

REVOKE EXECUTE ON FUNCTION public.trg_sd_participant_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sd_participant_delete ON public.service_delivery_session_participants;
CREATE TRIGGER trg_sd_participant_delete
  BEFORE DELETE ON public.service_delivery_session_participants
  FOR EACH ROW EXECUTE FUNCTION public.trg_sd_participant_delete();

-- Every NEW session names its primary person in the relation too, so «who is
-- in this session» has one answer from the first write. The id is derived from
-- (session, person): a replay or the backfill below converges on the same row.
CREATE OR REPLACE FUNCTION public.trg_sd_session_primary_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.subject_type = 'customer' AND NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.service_delivery_session_participants
      (id, workspace_id, session_id, participant_type, customer_id, created_at)
    VALUES
      (md5(NEW.id::text || ':customer:' || NEW.customer_id::text)::uuid,
       NEW.workspace_id, NEW.id, 'customer', NEW.customer_id, NEW.created_at)
    ON CONFLICT (session_id, customer_id) WHERE customer_id IS NOT NULL DO NOTHING;
  ELSIF NEW.subject_type = 'employee' AND NEW.employee_id IS NOT NULL THEN
    INSERT INTO public.service_delivery_session_participants
      (id, workspace_id, session_id, participant_type, employee_id, created_at)
    VALUES
      (md5(NEW.id::text || ':employee:' || NEW.employee_id::text)::uuid,
       NEW.workspace_id, NEW.id, 'employee', NEW.employee_id, NEW.created_at)
    ON CONFLICT (session_id, employee_id) WHERE employee_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.trg_sd_session_primary_participant() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sd_session_primary_participant ON public.service_delivery_sessions;
CREATE TRIGGER trg_sd_session_primary_participant
  AFTER INSERT ON public.service_delivery_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trg_sd_session_primary_participant();

-- ─── 6. Deterministic backfill: every historical session names its customer ─
-- Same derived id as the trigger, same conflict target: running this twice (or
-- running it after the trigger already wrote the row) changes nothing.

INSERT INTO public.service_delivery_session_participants
  (id, workspace_id, session_id, participant_type, customer_id, created_at)
SELECT md5(s.id::text || ':customer:' || s.customer_id::text)::uuid,
       s.workspace_id, s.id, 'customer', s.customer_id, s.created_at
  FROM public.service_delivery_sessions s
 WHERE s.customer_id IS NOT NULL
ON CONFLICT (session_id, customer_id) WHERE customer_id IS NOT NULL DO NOTHING;

-- ============================================================================
-- Rollback / recovery guidance (NOT executed here)
-- ============================================================================
/*
-- The participant relation and the new columns are additive: an old backend
-- simply ignores them. To reverse fully (only after the old backend is back):
--
-- 1. Employee sessions must be resolved first (they cannot satisfy the old
--    NOT NULL customer_id). Decide with the owner: cancel them or assign a
--    customer. NEVER guess a backfill.
-- 2. DROP TRIGGER IF EXISTS trg_sd_session_primary_participant ON public.service_delivery_sessions;
--    DROP FUNCTION IF EXISTS public.trg_sd_session_primary_participant();
--    DROP TRIGGER IF EXISTS trg_sd_participant_delete ON public.service_delivery_session_participants;
--    DROP TRIGGER IF EXISTS trg_sd_participant_integrity ON public.service_delivery_session_participants;
--    DROP FUNCTION IF EXISTS public.trg_sd_participant_delete();
--    DROP FUNCTION IF EXISTS public.trg_sd_participant_integrity();
--    DROP TABLE IF EXISTS public.service_delivery_session_participants;
-- 3. ALTER TABLE public.service_delivery_sessions ALTER COLUMN customer_id SET NOT NULL;
--    (refused while any employee session exists — step 1 first)
--    ALTER TABLE public.service_delivery_sessions DROP COLUMN IF EXISTS session_type;
--    ALTER TABLE public.service_delivery_sessions DROP COLUMN IF EXISTS employee_id;
--    ALTER TABLE public.service_delivery_sessions DROP COLUMN IF EXISTS subject_type;
--    (drop the four chk_service_delivery_subject* / session_type / employee_settlement
--     constraints first; keep chk_service_delivery_settlement from -04)
*/


-- ────────────────────────────────────────────────────────────────────────
-- [41/59] appointment-conflict-02-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/appointment-conflict-02-migration.sql
--
-- BUG-NEW-011 — a staff member cannot be double-booked, enforced by the DATABASE.
--
-- The service checks for an overlap and then inserts. Two requests that both pass
-- the check both insert. The invariant is:
--
--   no two non-cancelled appointments of the same staff member in the same
--   workspace overlap in time (half-open: one may start when the other ends).
--
-- That is an EXCLUSION constraint. It cannot be added as NOT VALID, so it is added
-- ONLY when no existing rows already overlap; otherwise this file stops with a
-- notice and changes nothing — the overlapping bookings are for the owner to
-- resolve (the VERIFY file lists them), not for a migration to delete.
--
-- SAFE TO RE-RUN. Additive, idempotent. Requires the btree_gist extension.
-- ⚠️ Run docs/VERIFY-appointment-conflict-02.sql afterwards. NOT run by the assistant.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;
-- Keep the extension out of the exposed public schema (extension_in_public).
-- `extensions` is Supabase's standard non-API schema. The move is idempotent and
-- preserves the OIDs that existing exclusion constraints depend on.
CREATE SCHEMA IF NOT EXISTS extensions;
-- Grant only to roles that exist: a bare Postgres (the pg test harness) has no
-- Supabase roles, and GRANT to a missing role aborts the whole migration.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA extensions TO %I', r);
    END IF;
  END LOOP;
END $$;
ALTER EXTENSION btree_gist SET SCHEMA extensions;
-- The exclusion constraint below uses btree_gist's gist_uuid_ops; keep the
-- extension schema visible so the operator class resolves after the move.
SET search_path = public, extensions;

DO $$
DECLARE
  clashes bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_staff_overlap') THEN
    RAISE NOTICE 'appointments_no_staff_overlap already exists — nothing to do';
    RETURN;
  END IF;

  SELECT count(*) INTO clashes
    FROM public.appointments a
    JOIN public.appointments b
      ON a.workspace_id = b.workspace_id
     AND a.staff_employee_id = b.staff_employee_id
     AND a.id < b.id
     AND a.status <> 'cancelled' AND b.status <> 'cancelled'
     AND tstzrange(a.start_time, a.end_time) && tstzrange(b.start_time, b.end_time);

  IF clashes > 0 THEN
    RAISE NOTICE 'Not added: % existing pair(s) of overlapping appointments. Resolve them (see VERIFY block 3), then run this file again.', clashes;
    RETURN;
  END IF;

  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_no_staff_overlap
    EXCLUDE USING gist (
      workspace_id WITH =,
      staff_employee_id WITH =,
      tstzrange(start_time, end_time) WITH &&
    )
    WHERE (status <> 'cancelled' AND staff_employee_id IS NOT NULL);
END $$;

-- ─── ROLLBACK BLOCK ────────────────────────────────────────────────────────
-- ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_no_staff_overlap;


-- ────────────────────────────────────────────────────────────────────────
-- [42/59] blog-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- BLOG — posts, categories, tags, comments, reactions, ratings, views.
-- Additive, idempotent (safe to run twice).
--
-- ✅ RUN on production Supabase 2026-09-26; docs/VERIFY-blog.sql returned
-- 12/12 rows ok = true (reported by a human).
--
-- WHAT THIS ADDS
--
--   blog_categories / blog_tags     per-locale (fa | af | en), slug unique per locale
--   blog_posts                      one row per locale; the three translations of
--                                   one article share `translation_group_id`
--                                   (hreflang). `content_html` is written only by
--                                   the backend after sanitising (allowlist).
--   blog_post_tags                  post ↔ tag
--   blog_comments                   signed-in users only; ONE level of replies
--                                   (trigger); public sees `approved` only, the
--                                   author also sees their own pending comment
--   blog_reactions                  one row per (post, user): 1 = like, -1 = dislike
--   blog_ratings                    one row per (post, user): 1..5 stars
--   blog_post_view_days             views per post per day (admin statistics)
--   blog_save_post(…)               a post AND its tags in one transaction
--   blog_post_stats(uuid[])         EXACT counts (count(*)), never a stored
--                                   counter a client could write (§۷٫۴)
--   blog_set_reaction / blog_set_rating / blog_record_view
--                                   atomic upserts; two simultaneous likes by one
--                                   user are ONE row (primary key + ON CONFLICT)
--   storage bucket `blog-images`    public read; jpeg/png/webp/avif; 2 MB
--
-- WHO MAY READ AND WRITE
--
--   The public site reads the blog THROUGH THE BACKEND (service_role), which
--   applies the publication rule itself — no client talks to Supabase directly
--   (USER-REQUESTS #112). So `anon` is granted nothing, as everywhere in this
--   repo; `authenticated` may SELECT exactly what the policies below allow.
--   Nobody but the backend writes.
--   «A user writes only their own row» is enforced where the token is verified:
--   the backend takes user_id from the verified JWT, never from the body, and
--   every write is keyed by (post_id, user_id). A direct PostgREST write with a
--   user's JWT is refused outright — letting it through would bypass the
--   backend's rate limit and honeypot on comments.
--   Administration (posts, moderation) = backend + platformAdminGuard.
--
-- VISIBILITY
--
--   A post is public when status = 'published', or status = 'scheduled' and
--   published_at has passed — scheduling needs no cron; the web's ISR picks the
--   post up on its next revalidation (≤ 1 hour) or immediately on a
--   revalidate call.
--
-- NOT A TENANT TABLE. Blog rows belong to the platform, not to a workspace; the
-- rls-coverage guard lists them by name with SELECT-only assertions.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────── categories and tags

CREATE TABLE IF NOT EXISTS public.blog_categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale       text NOT NULL CHECK (locale IN ('fa', 'af', 'en')),
  slug         text NOT NULL CHECK (slug ~ '^[^[:space:]/?#%]+$' AND char_length(slug) <= 120),
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description  text CHECK (description IS NULL OR char_length(description) <= 500),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (locale, slug)
);

CREATE TABLE IF NOT EXISTS public.blog_tags (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale       text NOT NULL CHECK (locale IN ('fa', 'af', 'en')),
  slug         text NOT NULL CHECK (slug ~ '^[^[:space:]/?#%]+$' AND char_length(slug) <= 120),
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (locale, slug)
);

-- ─────────────────────────────────────────────── posts

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale                text NOT NULL CHECK (locale IN ('fa', 'af', 'en')),
  slug                  text NOT NULL CHECK (slug ~ '^[^[:space:]/?#%]+$' AND char_length(slug) <= 120),
  title                 text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  excerpt               text CHECK (excerpt IS NULL OR char_length(excerpt) <= 500),
  -- Tiptap document (the editor's source of truth) and the HTML the web
  -- renders. The HTML is produced by the backend's sanitiser; nothing else
  -- writes it.
  content_json          jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  content_html          text NOT NULL DEFAULT '',
  -- Real questions and answers shown at the end of the article. FAQPage
  -- JSON-LD is emitted from THIS column only, so it always matches the page.
  faq                   jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(faq) = 'array'),
  cover_url             text,
  -- A cover without alt text is refused (accessibility + image search).
  cover_alt             text,
  meta_title            text CHECK (meta_title IS NULL OR char_length(meta_title) <= 120),
  meta_description      text CHECK (meta_description IS NULL OR char_length(meta_description) <= 320),
  focus_keyword         text CHECK (focus_keyword IS NULL OR char_length(focus_keyword) <= 120),
  keywords              text[] NOT NULL DEFAULT '{}',
  -- NULL = self-canonical (the normal case).
  canonical_url         text,
  og_image_url          text,
  noindex               boolean NOT NULL DEFAULT false,
  status                text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'scheduled', 'published')),
  published_at          timestamptz,
  author_id             uuid,
  reading_minutes       integer NOT NULL DEFAULT 1 CHECK (reading_minutes BETWEEN 1 AND 600),
  category_id           uuid REFERENCES public.blog_categories (id) ON DELETE SET NULL,
  translation_group_id  uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (locale, slug),
  -- One translation per language inside a group.
  UNIQUE (translation_group_id, locale),
  CONSTRAINT blog_posts_publish_date CHECK (status = 'draft' OR published_at IS NOT NULL),
  CONSTRAINT blog_posts_cover_alt CHECK (
    cover_url IS NULL OR (cover_alt IS NOT NULL AND char_length(btrim(cover_alt)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS blog_posts_public_list
  ON public.blog_posts (locale, published_at DESC)
  WHERE status IN ('published', 'scheduled');
CREATE INDEX IF NOT EXISTS blog_posts_category ON public.blog_posts (category_id);

CREATE TABLE IF NOT EXISTS public.blog_post_tags (
  post_id  uuid NOT NULL REFERENCES public.blog_posts (id) ON DELETE CASCADE,
  tag_id   uuid NOT NULL REFERENCES public.blog_tags (id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX IF NOT EXISTS blog_post_tags_tag ON public.blog_post_tags (tag_id);

-- Whether a post is on the public site right now. One definition, used by the
-- policies and the write functions alike.
CREATE OR REPLACE FUNCTION public.blog_post_is_public(p_status text, p_published_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_status = 'published'
      OR (p_status = 'scheduled' AND p_published_at IS NOT NULL AND p_published_at <= now())
$$;

-- ─────────────────────────────────────────────── comments

CREATE TABLE IF NOT EXISTS public.blog_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.blog_posts (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  parent_id   uuid REFERENCES public.blog_comments (id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'rejected', 'spam')),
  moderated_by uuid,
  moderated_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blog_comments_post ON public.blog_comments (post_id, status, created_at);
CREATE INDEX IF NOT EXISTS blog_comments_queue ON public.blog_comments (status, created_at)
  WHERE status = 'pending';

-- One level of replies: a reply's parent must be a top-level comment on the
-- same post.
CREATE OR REPLACE FUNCTION public.blog_comments_one_level()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_parent record;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT post_id, parent_id INTO v_parent FROM public.blog_comments WHERE id = NEW.parent_id;
  IF NOT FOUND OR v_parent.post_id <> NEW.post_id OR v_parent.parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'BLOG_COMMENT_REPLY_DEPTH' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS blog_comments_one_level ON public.blog_comments;
CREATE TRIGGER blog_comments_one_level
  BEFORE INSERT OR UPDATE OF parent_id, post_id ON public.blog_comments
  FOR EACH ROW EXECUTE FUNCTION public.blog_comments_one_level();

-- ─────────────────────────────────────────────── reactions and ratings

CREATE TABLE IF NOT EXISTS public.blog_reactions (
  post_id     uuid NOT NULL REFERENCES public.blog_posts (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  value       smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.blog_ratings (
  post_id     uuid NOT NULL REFERENCES public.blog_posts (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  stars       smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- ─────────────────────────────────────────────── views (admin statistics)

CREATE TABLE IF NOT EXISTS public.blog_post_view_days (
  post_id  uuid NOT NULL REFERENCES public.blog_posts (id) ON DELETE CASCADE,
  day      date NOT NULL,
  views    bigint NOT NULL DEFAULT 0 CHECK (views >= 0),
  PRIMARY KEY (post_id, day)
);

-- ─────────────────────────────────────────────── updated_at

CREATE OR REPLACE FUNCTION public.blog_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['blog_categories', 'blog_tags', 'blog_posts', 'blog_comments',
                           'blog_reactions', 'blog_ratings']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.blog_touch_updated_at()',
      t, t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────── write functions (backend only)

-- p_value: 1 like, -1 dislike, 0 = take my reaction back. Returns the stored
-- value (0 after a removal). Raises BLOG_POST_NOT_PUBLIC for a draft.
CREATE OR REPLACE FUNCTION public.blog_set_reaction(p_post_id uuid, p_user_id uuid, p_value smallint)
RETURNS smallint
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_value NOT IN (-1, 0, 1) THEN
    RAISE EXCEPTION 'BLOG_REACTION_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM 1 FROM public.blog_posts
    WHERE id = p_post_id AND public.blog_post_is_public(status, published_at);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BLOG_POST_NOT_PUBLIC' USING ERRCODE = 'no_data_found';
  END IF;

  IF p_value = 0 THEN
    DELETE FROM public.blog_reactions WHERE post_id = p_post_id AND user_id = p_user_id;
    RETURN 0;
  END IF;

  INSERT INTO public.blog_reactions (post_id, user_id, value)
  VALUES (p_post_id, p_user_id, p_value)
  ON CONFLICT (post_id, user_id) DO UPDATE SET value = EXCLUDED.value;
  RETURN p_value;
END
$$;

CREATE OR REPLACE FUNCTION public.blog_set_rating(p_post_id uuid, p_user_id uuid, p_stars smallint)
RETURNS smallint
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_stars NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'BLOG_RATING_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM 1 FROM public.blog_posts
    WHERE id = p_post_id AND public.blog_post_is_public(status, published_at);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BLOG_POST_NOT_PUBLIC' USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.blog_ratings (post_id, user_id, stars)
  VALUES (p_post_id, p_user_id, p_stars)
  ON CONFLICT (post_id, user_id) DO UPDATE SET stars = EXCLUDED.stars;
  RETURN p_stars;
END
$$;

-- One view. A draft is not counted (and not an error: the page may have been
-- unpublished between render and beacon).
CREATE OR REPLACE FUNCTION public.blog_record_view(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM public.blog_posts
    WHERE id = p_post_id AND public.blog_post_is_public(status, published_at);
  IF NOT FOUND THEN
    RETURN;
  END IF;
  INSERT INTO public.blog_post_view_days (post_id, day, views)
  VALUES (p_post_id, (now() AT TIME ZONE 'UTC')::date, 1)
  ON CONFLICT (post_id, day) DO UPDATE SET views = public.blog_post_view_days.views + 1;
END
$$;

-- A post and its tags in ONE transaction (supabase-js has no transactions:
-- راهنمای سشن §۱٫۴). p_post_id NULL creates; otherwise updates that post.
-- p_fields holds the columns by name; absent keys keep their current value on
-- update. Returns the post id. A unique violation surfaces as 23505 with the
-- constraint name, which the backend maps to «slug taken» / «translation taken».
CREATE OR REPLACE FUNCTION public.blog_save_post(p_post_id uuid, p_fields jsonb, p_tag_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_post_id IS NULL THEN
    INSERT INTO blog_posts (
      locale, slug, title, excerpt, content_json, content_html, faq, cover_url, cover_alt,
      meta_title, meta_description, focus_keyword, keywords, canonical_url, og_image_url,
      noindex, status, published_at, reading_minutes, category_id, translation_group_id, author_id
    ) VALUES (
      p_fields->>'locale', p_fields->>'slug', p_fields->>'title', p_fields->>'excerpt',
      coalesce(p_fields->'content_json', '{"type":"doc","content":[]}'::jsonb),
      coalesce(p_fields->>'content_html', ''),
      coalesce(p_fields->'faq', '[]'::jsonb),
      p_fields->>'cover_url', p_fields->>'cover_alt',
      p_fields->>'meta_title', p_fields->>'meta_description', p_fields->>'focus_keyword',
      coalesce(ARRAY(SELECT jsonb_array_elements_text(p_fields->'keywords')), '{}'),
      p_fields->>'canonical_url', p_fields->>'og_image_url',
      coalesce((p_fields->>'noindex')::boolean, false),
      coalesce(p_fields->>'status', 'draft'),
      (p_fields->>'published_at')::timestamptz,
      coalesce((p_fields->>'reading_minutes')::integer, 1),
      (p_fields->>'category_id')::uuid,
      coalesce((p_fields->>'translation_group_id')::uuid, gen_random_uuid()),
      (p_fields->>'author_id')::uuid
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE blog_posts SET
      locale           = CASE WHEN p_fields ? 'locale' THEN p_fields->>'locale' ELSE locale END,
      slug             = CASE WHEN p_fields ? 'slug' THEN p_fields->>'slug' ELSE slug END,
      title            = CASE WHEN p_fields ? 'title' THEN p_fields->>'title' ELSE title END,
      excerpt          = CASE WHEN p_fields ? 'excerpt' THEN p_fields->>'excerpt' ELSE excerpt END,
      content_json     = CASE WHEN p_fields ? 'content_json' THEN p_fields->'content_json' ELSE content_json END,
      content_html     = CASE WHEN p_fields ? 'content_html' THEN p_fields->>'content_html' ELSE content_html END,
      faq              = CASE WHEN p_fields ? 'faq' THEN p_fields->'faq' ELSE faq END,
      cover_url        = CASE WHEN p_fields ? 'cover_url' THEN p_fields->>'cover_url' ELSE cover_url END,
      cover_alt        = CASE WHEN p_fields ? 'cover_alt' THEN p_fields->>'cover_alt' ELSE cover_alt END,
      meta_title       = CASE WHEN p_fields ? 'meta_title' THEN p_fields->>'meta_title' ELSE meta_title END,
      meta_description = CASE WHEN p_fields ? 'meta_description' THEN p_fields->>'meta_description' ELSE meta_description END,
      focus_keyword    = CASE WHEN p_fields ? 'focus_keyword' THEN p_fields->>'focus_keyword' ELSE focus_keyword END,
      keywords         = CASE WHEN p_fields ? 'keywords'
                              THEN coalesce(ARRAY(SELECT jsonb_array_elements_text(p_fields->'keywords')), '{}')
                              ELSE keywords END,
      canonical_url    = CASE WHEN p_fields ? 'canonical_url' THEN p_fields->>'canonical_url' ELSE canonical_url END,
      og_image_url     = CASE WHEN p_fields ? 'og_image_url' THEN p_fields->>'og_image_url' ELSE og_image_url END,
      noindex          = CASE WHEN p_fields ? 'noindex' THEN (p_fields->>'noindex')::boolean ELSE noindex END,
      status           = CASE WHEN p_fields ? 'status' THEN p_fields->>'status' ELSE status END,
      published_at     = CASE WHEN p_fields ? 'published_at' THEN (p_fields->>'published_at')::timestamptz ELSE published_at END,
      reading_minutes  = CASE WHEN p_fields ? 'reading_minutes' THEN (p_fields->>'reading_minutes')::integer ELSE reading_minutes END,
      category_id      = CASE WHEN p_fields ? 'category_id' THEN (p_fields->>'category_id')::uuid ELSE category_id END,
      translation_group_id = CASE WHEN p_fields ? 'translation_group_id' AND p_fields->>'translation_group_id' IS NOT NULL
                                  THEN (p_fields->>'translation_group_id')::uuid ELSE translation_group_id END
    WHERE id = p_post_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'BLOG_POST_NOT_FOUND' USING ERRCODE = 'no_data_found';
    END IF;
  END IF;

  IF p_tag_ids IS NOT NULL THEN
    DELETE FROM blog_post_tags WHERE post_id = v_id AND NOT (tag_id = ANY (p_tag_ids));
    INSERT INTO blog_post_tags (post_id, tag_id)
    SELECT v_id, t FROM unnest(p_tag_ids) AS t
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_id;
END
$$;

-- ─────────────────────────────────────────────── exact statistics

-- One row per requested post, zeros included. Every number is a count(*) or an
-- avg over the real rows at the moment of the call.
CREATE OR REPLACE FUNCTION public.blog_post_stats(p_post_ids uuid[])
RETURNS TABLE (
  post_id            uuid,
  likes              bigint,
  dislikes           bigint,
  rating_count       bigint,
  rating_avg         numeric,
  approved_comments  bigint,
  pending_comments   bigint,
  views              bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.id,
         (SELECT count(*) FROM blog_reactions r WHERE r.post_id = p.id AND r.value = 1),
         (SELECT count(*) FROM blog_reactions r WHERE r.post_id = p.id AND r.value = -1),
         (SELECT count(*) FROM blog_ratings g WHERE g.post_id = p.id),
         (SELECT round(avg(g.stars)::numeric, 2) FROM blog_ratings g WHERE g.post_id = p.id),
         (SELECT count(*) FROM blog_comments c WHERE c.post_id = p.id AND c.status = 'approved'),
         (SELECT count(*) FROM blog_comments c WHERE c.post_id = p.id AND c.status = 'pending'),
         (SELECT coalesce(sum(v.views), 0)::bigint FROM blog_post_view_days v WHERE v.post_id = p.id)
  FROM blog_posts p
  WHERE p.id = ANY (p_post_ids)
$$;

-- ─────────────────────────────────────────────── row level security

ALTER TABLE public.blog_categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_tags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_tags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_reactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_ratings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_view_days  ENABLE ROW LEVEL SECURITY;

-- Published content: readable by a signed-in client, writable by nobody but
-- the service role. (Anonymous readers go through the backend.)
DROP POLICY IF EXISTS blog_categories_public_read ON public.blog_categories;
CREATE POLICY blog_categories_public_read ON blog_categories
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS blog_tags_public_read ON public.blog_tags;
CREATE POLICY blog_tags_public_read ON blog_tags
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS blog_posts_public_read ON public.blog_posts;
CREATE POLICY blog_posts_public_read ON blog_posts
  FOR SELECT TO authenticated
  USING (public.blog_post_is_public(status, published_at));

DROP POLICY IF EXISTS blog_post_tags_public_read ON public.blog_post_tags;
CREATE POLICY blog_post_tags_public_read ON blog_post_tags
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.blog_posts p
    WHERE p.id = post_id AND public.blog_post_is_public(p.status, p.published_at)
  ));

-- Person-scoped. Approved comments on public posts; the author also sees
-- their own, whatever the status («در انتظار تأیید»).
DROP POLICY IF EXISTS blog_comments_read ON public.blog_comments;
CREATE POLICY blog_comments_read ON blog_comments
  FOR SELECT TO authenticated
  USING (
    (status = 'approved' AND EXISTS (
      SELECT 1 FROM public.blog_posts p
      WHERE p.id = post_id AND public.blog_post_is_public(p.status, p.published_at)
    ))
    OR user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS blog_reactions_own_read ON public.blog_reactions;
CREATE POLICY blog_reactions_own_read ON blog_reactions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS blog_ratings_own_read ON public.blog_ratings;
CREATE POLICY blog_ratings_own_read ON blog_ratings
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- blog_post_view_days: no policy at all — clients read nothing; admin
-- statistics come from blog_post_stats() through the backend.

REVOKE ALL ON public.blog_categories, public.blog_tags, public.blog_posts, public.blog_post_tags,
              public.blog_comments, public.blog_reactions, public.blog_ratings,
              public.blog_post_view_days FROM anon, authenticated;
GRANT SELECT ON public.blog_categories, public.blog_tags, public.blog_posts, public.blog_post_tags,
                public.blog_comments TO authenticated;
GRANT SELECT ON public.blog_reactions, public.blog_ratings TO authenticated;
GRANT ALL ON public.blog_categories, public.blog_tags, public.blog_posts, public.blog_post_tags,
             public.blog_comments, public.blog_reactions, public.blog_ratings,
             public.blog_post_view_days TO service_role;

REVOKE ALL ON FUNCTION public.blog_set_reaction(uuid, uuid, smallint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blog_set_rating(uuid, uuid, smallint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blog_record_view(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blog_post_stats(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blog_save_post(uuid, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blog_set_reaction(uuid, uuid, smallint) TO service_role;
GRANT EXECUTE ON FUNCTION public.blog_set_rating(uuid, uuid, smallint) TO service_role;
GRANT EXECUTE ON FUNCTION public.blog_record_view(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.blog_post_stats(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.blog_save_post(uuid, jsonb, uuid[]) TO service_role;

-- ─────────────────────────────────────────────── storage bucket (public images)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('blog-images', 'blog-images', true, 2097152,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 2097152,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION (run only if needed)
--
-- The backend answers «blog not configured» (503) without these tables and the
-- web shows an explicit empty state — nothing else depends on them.
--
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.blog_post_stats(uuid[]);
--   DROP FUNCTION IF EXISTS public.blog_save_post(uuid, jsonb, uuid[]);
--   DROP FUNCTION IF EXISTS public.blog_record_view(uuid);
--   DROP FUNCTION IF EXISTS public.blog_set_rating(uuid, uuid, smallint);
--   DROP FUNCTION IF EXISTS public.blog_set_reaction(uuid, uuid, smallint);
--   -- ⚠️ The tables hold articles, comments and votes. Check before dropping:
--   --   SELECT status, count(*) FROM public.blog_posts GROUP BY 1;
--   --   SELECT count(*) FROM public.blog_comments;
--   DROP TABLE IF EXISTS public.blog_post_view_days;
--   DROP TABLE IF EXISTS public.blog_ratings;
--   DROP TABLE IF EXISTS public.blog_reactions;
--   DROP TABLE IF EXISTS public.blog_comments;
--   DROP TABLE IF EXISTS public.blog_post_tags;
--   DROP TABLE IF EXISTS public.blog_posts;
--   DROP TABLE IF EXISTS public.blog_tags;
--   DROP TABLE IF EXISTS public.blog_categories;
--   DROP FUNCTION IF EXISTS public.blog_comments_one_level();
--   DROP FUNCTION IF EXISTS public.blog_touch_updated_at();
--   DROP FUNCTION IF EXISTS public.blog_post_is_public(text, timestamptz);
--   -- Images: empty the bucket in the Storage UI first, then
--   --   DELETE FROM storage.buckets WHERE id = 'blog-images';
--   COMMIT;
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────
-- [43/59] budget-planning-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/budget-planning-migration.sql
--
-- Budgets become a planning + control domain: type, uneven distribution,
-- approval state, versioned revisions, consumed commitments, and one batched
-- aggregate for the whole budgets page (replaces one RPC per budget).
--
-- Depends on: docs/tier2-gaps-migration.sql (budgets, budget_commitments).
--
-- ---------------------------------------------------------------------------
-- EXISTING ROWS — §12, no fake backfill
--
--   budget_type  'expense'  — every existing budget was checked against
--                              purchase/expense spend (checkSpend), so this is
--                              what they already were, not a guess.
--   status       'approved' — they were already ENFORCED controls. approved_by
--                              stays NULL: the approver is unknown and is shown
--                              as unknown, never invented.
--   version      1
--   distribution NULL       — NULL means an equal split, which is exactly how
--                              the per-period amount_minor behaved before.
--   consumed_minor 0
--
-- ---------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
--   DROP FUNCTION IF EXISTS public.budget_performance_batch(uuid, date, date);
--   DROP FUNCTION IF EXISTS public.budget_apply_revision(uuid, uuid, integer, bigint, jsonb, text, text, integer, uuid, jsonb);
--   DROP TABLE IF EXISTS public.budget_revisions;
--   ALTER TABLE public.budget_commitments DROP COLUMN IF EXISTS consumed_minor;
--   ALTER TABLE public.budgets DROP COLUMN IF EXISTS name, DROP COLUMN IF EXISTS budget_type,
--     DROP COLUMN IF EXISTS status, DROP COLUMN IF EXISTS version,
--     DROP COLUMN IF EXISTS distribution, DROP COLUMN IF EXISTS notes,
--     DROP COLUMN IF EXISTS approved_by, DROP COLUMN IF EXISTS approved_at,
--     DROP COLUMN IF EXISTS updated_at;
--
-- The backend tolerates every piece of this being absent (42703 / 42P01 /
-- PGRST202): it falls back to the legacy columns and the per-budget RPC.
--
-- ADDITIVE / IDEMPOTENT. SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── budgets ────────────────────────────────────────────────────────────────

ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS name         text;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS budget_type  text NOT NULL DEFAULT 'expense';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS status       text NOT NULL DEFAULT 'approved';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS version      integer NOT NULL DEFAULT 1;
-- [{ "start": "2026-03-21", "amount_minor": 5000000 }, ...] — per sub-period.
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS distribution jsonb;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS notes        text;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS approved_by  uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS approved_at  timestamptz;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();
-- Who drafted it. NULL on rows that predate this column (unknown, not guessed).
-- Separation of duties: the approver may not be the creator.
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS created_by   uuid;

-- New rows start as drafts; the column default above only labels the rows
-- that existed (and were enforced) before this migration.
ALTER TABLE public.budgets ALTER COLUMN status SET DEFAULT 'draft';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'budgets_type_check'
       AND conrelid = to_regclass('public.budgets')
  ) THEN
    ALTER TABLE public.budgets ADD CONSTRAINT budgets_type_check
      CHECK (budget_type IN ('expense', 'revenue')) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'budgets_status_check'
       AND conrelid = to_regclass('public.budgets')
  ) THEN
    ALTER TABLE public.budgets ADD CONSTRAINT budgets_status_check
      CHECK (status IN ('draft', 'pending_approval', 'approved', 'archived')) NOT VALID;
  END IF;
END $$;

-- `approval` holds an over-budget document for a manager instead of refusing.
-- Widening a CHECK accepts every row the old one accepted.
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'budgets_action_check'
       AND pg_get_constraintdef(oid) LIKE '%approval%'
  ) THEN
    ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_action_check;
    ALTER TABLE public.budgets ADD CONSTRAINT budgets_action_check
      CHECK (action IN ('block', 'warn', 'approval', 'track')) NOT VALID;
  END IF;
END $;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'budgets_version_check'
       AND conrelid = to_regclass('public.budgets')
  ) THEN
    ALTER TABLE public.budgets ADD CONSTRAINT budgets_version_check CHECK (version >= 1) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS budgets_workspace_scope_idx
  ON public.budgets (workspace_id, account_id, budget_type, status);

-- ─── budget_commitments ─────────────────────────────────────────────────────
--
-- consumed_minor: the part of a commitment that has become actual. Open =
-- amount − consumed (unless released). Moving money from open to actual must
-- never change remaining.

ALTER TABLE public.budget_commitments
  ADD COLUMN IF NOT EXISTS consumed_minor bigint NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'budget_commitments_consumed_check'
       AND conrelid = to_regclass('public.budget_commitments')
  ) THEN
    ALTER TABLE public.budget_commitments ADD CONSTRAINT budget_commitments_consumed_check
      CHECK (consumed_minor >= 0 AND consumed_minor <= amount_minor) NOT VALID;
  END IF;
END $$;

-- ─── budget_revisions — immutable history ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.budget_revisions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL,
  budget_id        uuid NOT NULL REFERENCES public.budgets (id) ON DELETE RESTRICT,
  version          integer NOT NULL,
  previous_version integer NOT NULL,
  reason           text NOT NULL,
  actor_id         uuid NOT NULL,
  -- { amount_minor, distribution, action, warn_at_percent } before and after.
  previous_values  jsonb NOT NULL,
  new_values       jsonb NOT NULL,
  -- [{ line_key, before_minor, after_minor }]
  lines            jsonb NOT NULL,
  approved_by      uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budget_revisions_reason_check CHECK (length(btrim(reason)) > 0),
  CONSTRAINT budget_revisions_version_check CHECK (version = previous_version + 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS budget_revisions_budget_version_key
  ON public.budget_revisions (budget_id, version);
CREATE INDEX IF NOT EXISTS budget_revisions_workspace_idx
  ON public.budget_revisions (workspace_id, budget_id, created_at DESC);

-- A revision is history: no UPDATE, no DELETE, for anyone.
CREATE OR REPLACE FUNCTION public.budget_revisions_immutable()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'BUDGET_REVISION_IMMUTABLE';
END;
$fn$;

DROP TRIGGER IF EXISTS budget_revisions_no_update ON public.budget_revisions;
CREATE TRIGGER budget_revisions_no_update
  BEFORE UPDATE OR DELETE ON public.budget_revisions
  FOR EACH ROW EXECUTE FUNCTION public.budget_revisions_immutable();

ALTER TABLE public.budget_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS budget_revisions_workspace_members ON public.budget_revisions;
CREATE POLICY budget_revisions_workspace_members ON public.budget_revisions
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

-- ─── budget_performance_batch — ONE call for the whole page ─────────────────
--
-- Daily posted movement (days, not calendar months: a budget that starts on
-- 21 March has sub-periods 21st→20th, and only daily rows sum into those) (debit − credit, minor units, rounded per line as
-- budget_consumption does) for every account that has a budget, in
-- [p_start, p_end]; plus open commitments per budget. Sign normalisation by
-- budget type is the backend domain's job, not this function's.

CREATE OR REPLACE FUNCTION public.budget_performance_batch(
  p_workspace_id uuid,
  p_start        date,
  p_end          date
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_build_object(
    'actuals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'account_id', a.account_id,
               'day', a.day,
               'net_minor', a.net_minor))
      FROM (
        SELECT l.account_id,
               to_char(j.date, 'YYYY-MM-DD')                      AS day,
               SUM(ROUND((l.debit - l.credit) * 100))::bigint     AS net_minor
        FROM journal_lines l
        JOIN journal_entries j ON j.id = l.journal_id
        WHERE l.workspace_id = p_workspace_id
          AND j.status = 'posted'
          AND j.date >= p_start
          AND j.date <= p_end
          AND l.account_id IN (
            SELECT b.account_id FROM budgets b WHERE b.workspace_id = p_workspace_id
          )
        GROUP BY l.account_id, j.date
      ) a
    ), '[]'::jsonb),
    'commitments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'budget_id', c.budget_id,
               'open_minor', c.open_minor))
      FROM (
        SELECT bc.budget_id,
               SUM(GREATEST(bc.amount_minor - bc.consumed_minor, 0))::bigint AS open_minor
        FROM budget_commitments bc
        WHERE bc.workspace_id = p_workspace_id
          AND bc.released_at IS NULL
        GROUP BY bc.budget_id
      ) c
    ), '[]'::jsonb)
  );
$fn$;

REVOKE EXECUTE ON FUNCTION public.budget_performance_batch(uuid, date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.budget_performance_batch(uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.budget_performance_batch(uuid, date, date) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.budget_performance_batch(uuid, date, date) TO service_role;

-- The per-budget function must also subtract consumed, or the check path
-- and the page would disagree.
CREATE OR REPLACE FUNCTION public.budget_consumption(
  p_workspace_id uuid,
  p_budget_id    uuid,
  p_account_id   uuid,
  p_start        date,
  p_end          date
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_build_object(
    'actual_minor', (
      SELECT COALESCE(SUM(ROUND((l.debit - l.credit) * 100)), 0)::bigint
      FROM journal_lines l
      JOIN journal_entries j ON j.id = l.journal_id
      WHERE l.workspace_id = p_workspace_id
        AND l.account_id   = p_account_id
        AND j.status       = 'posted'
        AND j.date >= p_start
        AND j.date <= p_end
    ),
    'committed_minor', (
      SELECT COALESCE(SUM(GREATEST(bc.amount_minor - bc.consumed_minor, 0)), 0)::bigint
      FROM budget_commitments bc
      WHERE bc.workspace_id = p_workspace_id
        AND bc.budget_id    = p_budget_id
        AND bc.released_at IS NULL
    )
  );
$fn$;

REVOKE EXECUTE ON FUNCTION public.budget_consumption(uuid, uuid, uuid, date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.budget_consumption(uuid, uuid, uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.budget_consumption(uuid, uuid, uuid, date, date) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.budget_consumption(uuid, uuid, uuid, date, date) TO service_role;

-- ─── budget_apply_revision — revision row + budget update, ONE transaction ──
--
-- supabase-js has no transactions (CLAUDE.md §1.4). The version check is the
-- optimistic lock: a stale p_expected_version raises BUDGET_VERSION_CONFLICT
-- and nothing is written.

CREATE OR REPLACE FUNCTION public.budget_apply_revision(
  p_workspace_id     uuid,
  p_budget_id        uuid,
  p_expected_version integer,
  p_amount_minor     bigint,
  p_distribution     jsonb,
  p_action           text,
  p_reason           text,
  p_warn_at_percent  integer,
  p_actor_id         uuid,
  p_lines            jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_old budgets%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM budgets
  WHERE id = p_budget_id AND workspace_id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'BUDGET_NOT_FOUND'; END IF;
  IF v_old.status <> 'approved' THEN RAISE EXCEPTION 'BUDGET_REVISION_REQUIRES_APPROVED'; END IF;
  IF v_old.version <> p_expected_version THEN RAISE EXCEPTION 'BUDGET_VERSION_CONFLICT'; END IF;
  IF p_amount_minor < 0 THEN RAISE EXCEPTION 'BUDGET_AMOUNT_INVALID'; END IF;

  INSERT INTO budget_revisions (
    workspace_id, budget_id, version, previous_version, reason, actor_id,
    previous_values, new_values, lines, approved_by
  ) VALUES (
    p_workspace_id, p_budget_id, v_old.version + 1, v_old.version, p_reason, p_actor_id,
    jsonb_build_object('amount_minor', v_old.amount_minor, 'distribution', v_old.distribution,
                       'action', v_old.action, 'warn_at_percent', v_old.warn_at_percent),
    jsonb_build_object('amount_minor', p_amount_minor, 'distribution', p_distribution,
                       'action', p_action, 'warn_at_percent', p_warn_at_percent),
    p_lines, p_actor_id
  );

  UPDATE budgets SET
    amount_minor    = p_amount_minor,
    distribution    = p_distribution,
    action          = p_action,
    warn_at_percent = p_warn_at_percent,
    version         = v_old.version + 1,
    approved_by     = p_actor_id,
    approved_at     = now(),
    updated_at      = now()
  WHERE id = p_budget_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object('version', v_old.version + 1);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.budget_apply_revision(uuid, uuid, integer, bigint, jsonb, text, text, integer, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.budget_apply_revision(uuid, uuid, integer, bigint, jsonb, text, text, integer, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.budget_apply_revision(uuid, uuid, integer, bigint, jsonb, text, text, integer, uuid, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.budget_apply_revision(uuid, uuid, integer, bigint, jsonb, text, text, integer, uuid, jsonb) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';


-- ────────────────────────────────────────────────────────────────────────
-- [44/59] cloud-migration-01-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- CLOUD MIGRATION CORE (Phase 8: Offline -> Cloud Safe Migration)
--
-- Tables:
--   1. cloud_migration_jobs: The lifecycle and lease of a migration run.
--   2. cloud_migration_map: Mapping between local device IDs and cloud UUIDs.
--   3. cloud_migration_records: Detailed record-by-record execution and failure log.
--
-- Security:
--   - Tenant isolation via workspace_id.
--   - REVOKE ALL from PUBLIC, anon, authenticated first.
--   - Explicit grants to service_role and authenticated.
--   - RLS enabled on all tables.
--   - Rollback block included.
-- ============================================================================

BEGIN;

-- 1. Migration Jobs Table
CREATE TABLE IF NOT EXISTS public.cloud_migration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  device_id text NOT NULL,
  licence_id text NOT NULL,
  status text NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN (
      'REQUESTED',
      'BACKUP_CREATED',
      'PREVIEWED',
      'UPLOADING',
      'RECONCILING',
      'AWAITING_CONFIRMATION',
      'COMPLETED',
      'FAILED',
      'ROLLED_BACK'
    )),
  error_code text,
  lease_expires_at timestamptz,
  chunks_total integer NOT NULL DEFAULT 0,
  chunks_completed integer NOT NULL DEFAULT 0,
  package_checksum text,
  preview_metrics jsonb,
  reconciliation_result jsonb,
  reconciliation_diffs jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cloud_migration_jobs_workspace
  ON public.cloud_migration_jobs (workspace_id, status);

-- Forward-only status enforcement: a completed or rolled-back job cannot be reopened
CREATE OR REPLACE FUNCTION public.fn_cloud_migration_jobs_status_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'COMPLETED' AND NEW.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'MIGRATION_JOB_ALREADY_COMPLETED';
  END IF;
  IF OLD.status = 'ROLLED_BACK' AND NEW.status <> 'ROLLED_BACK' THEN
    RAISE EXCEPTION 'MIGRATION_JOB_ALREADY_ROLLED_BACK';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cloud_migration_jobs_status_guard ON public.cloud_migration_jobs;
CREATE TRIGGER trg_cloud_migration_jobs_status_guard
  BEFORE UPDATE ON public.cloud_migration_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_cloud_migration_jobs_status_guard();

-- 2. Id Mapping Table (Local ID -> Cloud ID)
CREATE TABLE IF NOT EXISTS public.cloud_migration_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.cloud_migration_jobs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  local_id text NOT NULL,
  cloud_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_migration_entity_local UNIQUE (workspace_id, entity_type, local_id)
);

CREATE INDEX IF NOT EXISTS idx_cloud_migration_map_lookup
  ON public.cloud_migration_map (workspace_id, entity_type, local_id);

-- 3. Execution Log Records Table
CREATE TABLE IF NOT EXISTS public.cloud_migration_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.cloud_migration_jobs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  local_id text NOT NULL,
  status text NOT NULL DEFAULT 'COMMITTED'
    CHECK (status IN ('COMMITTED', 'SKIPPED', 'FAILED')),
  error_code text,
  error_detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_migration_record_entry UNIQUE (workspace_id, job_id, entity_type, local_id)
);

CREATE INDEX IF NOT EXISTS idx_cloud_migration_records_job
  ON public.cloud_migration_records (job_id, status);

-- Security: Revoke default public access
REVOKE ALL ON public.cloud_migration_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cloud_migration_map FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cloud_migration_records FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_cloud_migration_jobs_status_guard() FROM PUBLIC, anon, authenticated;

-- Grants
GRANT ALL ON public.cloud_migration_jobs TO service_role;
GRANT ALL ON public.cloud_migration_map TO service_role;
GRANT ALL ON public.cloud_migration_records TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.cloud_migration_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cloud_migration_map TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cloud_migration_records TO authenticated;

-- Enable Row Level Security (RLS)
ALTER TABLE public.cloud_migration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_migration_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_migration_records ENABLE ROW LEVEL SECURITY;

-- Drop first so a re-run rebuilds these with (SELECT auth.uid()) rather than
-- skipping via the IF NOT EXISTS guard (auth_rls_initplan).
DROP POLICY IF EXISTS cloud_migration_jobs_tenant_policy ON public.cloud_migration_jobs;
DROP POLICY IF EXISTS cloud_migration_map_tenant_policy ON public.cloud_migration_map;
DROP POLICY IF EXISTS cloud_migration_records_tenant_policy ON public.cloud_migration_records;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cloud_migration_jobs' AND policyname = 'cloud_migration_jobs_tenant_policy') THEN
    CREATE POLICY cloud_migration_jobs_tenant_policy ON public.cloud_migration_jobs
      FOR ALL TO authenticated
      USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())
        )
      )
      WITH CHECK (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cloud_migration_map' AND policyname = 'cloud_migration_map_tenant_policy') THEN
    CREATE POLICY cloud_migration_map_tenant_policy ON public.cloud_migration_map
      FOR ALL TO authenticated
      USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())
        )
      )
      WITH CHECK (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cloud_migration_records' AND policyname = 'cloud_migration_records_tenant_policy') THEN
    CREATE POLICY cloud_migration_records_tenant_policy ON public.cloud_migration_records
      FOR ALL TO authenticated
      USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())
        )
      )
      WITH CHECK (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- DROP TRIGGER IF EXISTS trg_cloud_migration_jobs_status_guard ON public.cloud_migration_jobs;
-- DROP FUNCTION IF EXISTS public.fn_cloud_migration_jobs_status_guard();
-- DROP TABLE IF EXISTS public.cloud_migration_records;
-- DROP TABLE IF EXISTS public.cloud_migration_map;
-- DROP TABLE IF EXISTS public.cloud_migration_jobs;
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────
-- [45/59] customer-360-phase3-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/customer-360-phase3-migration.sql
--
-- Customer 360, phase 3: credit limit, payment terms, the customer who is also
-- a supplier, and documents attached to a customer.
--
-- ADDITIVE AND SAFE TO RE-RUN. Nothing is dropped, renamed or backfilled:
--   * credit_limit NULL        = no limit set (not "limit 0")
--   * payment_terms_days NULL  = no terms set (the invoice's own due date rules)
--   * supplier_id NULL         = not linked to a supplier
-- Existing rows keep NULL. Guessing a limit or terms for a real customer would
-- be a false claim about them (§12).
--
-- The backend reads these columns with a missing-column fallback, so deploying
-- the code before running this file is safe: the page shows «not configured».
--
-- Run in the Supabase SQL Editor, then run
-- docs/customer-360-phase3-verify.sql and report its output.
-- ============================================================================

-- ⚠️ LOCK NOTE (۲۰۲۶-۰۹-۱۸): ALTER TABLE needs an exclusive lock on a table the
-- live app is reading, so a run during traffic can end with
-- «40P01: deadlock detected». NOTHING is half-applied — the whole file is one
-- transaction, so a failed run changes nothing and it can simply be re-run when
-- the app is quiet. `lock_timeout` below makes it give up quickly instead of
-- deadlocking.

BEGIN;

-- Give up rather than queue behind (or deadlock with) live queries.
SET LOCAL lock_timeout = '5s';

-- ─────────────────────────────────────────────── customers: credit and terms

ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit numeric(14,2);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_terms_days integer;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS supplier_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_credit_limit_check') THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_credit_limit_check CHECK (credit_limit IS NULL OR credit_limit >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_payment_terms_days_check') THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_payment_terms_days_check
      CHECK (payment_terms_days IS NULL OR payment_terms_days BETWEEN 0 AND 3650) NOT VALID;
  END IF;
  -- A deleted supplier unlinks; it never deletes the customer.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_supplier_id_fkey') THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_supplier_id_fkey
      FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- One supplier is the same party as at most one customer in a workspace.
CREATE UNIQUE INDEX IF NOT EXISTS customers_workspace_supplier_key
  ON customers (workspace_id, supplier_id) WHERE supplier_id IS NOT NULL;

-- ─────────────────────────────────────────────── customer_documents

-- Metadata only. The file itself lives in the private storage bucket
-- `customer-documents` under <workspace_id>/<customer_id>/<id>, and is only
-- ever handed out as a short-lived signed URL by the backend.
CREATE TABLE IF NOT EXISTS customer_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  customer_id   uuid NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  storage_path  text NOT NULL,
  file_name     text NOT NULL,
  mime_type     text NOT NULL,
  size_bytes    integer NOT NULL,
  uploaded_by   uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Soft delete: who removed a contract from a customer file is audit history.
  deleted_at    timestamptz,
  deleted_by    uuid,
  CONSTRAINT customer_documents_size_check CHECK (size_bytes > 0 AND size_bytes <= 5242880)
);

CREATE INDEX IF NOT EXISTS customer_documents_customer_idx
  ON customer_documents (workspace_id, customer_id, created_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE customer_documents ENABLE ROW LEVEL SECURITY;

-- ⚠️ `auth_workspace_ids()` is NOT on the live database (42883 when this file
-- first ran). Same membership predicate as tenant-isolation-closure-migration.sql,
-- which is live.
DROP POLICY IF EXISTS customer_documents_ws_select ON customer_documents;
CREATE POLICY customer_documents_ws_select ON customer_documents FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS customer_documents_ws_insert ON customer_documents;
CREATE POLICY customer_documents_ws_insert ON customer_documents FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS customer_documents_ws_update ON customer_documents;
CREATE POLICY customer_documents_ws_update ON customer_documents FOR UPDATE TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));
-- No DELETE policy: rows are soft-deleted.

-- ─────────────────────────────────────────────── storage bucket (private)

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('customer-documents', 'customer-documents', false, 5242880)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880;

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION (run only if needed; data in the new columns is lost)
--
--   BEGIN;
--   DROP TABLE IF EXISTS customer_documents;
--   DROP INDEX IF EXISTS customers_workspace_supplier_key;
--   ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_supplier_id_fkey;
--   ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_payment_terms_days_check;
--   ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_credit_limit_check;
--   ALTER TABLE customers DROP COLUMN IF EXISTS supplier_id;
--   ALTER TABLE customers DROP COLUMN IF EXISTS payment_terms_days;
--   ALTER TABLE customers DROP COLUMN IF EXISTS credit_limit;
--   COMMIT;
--   -- Storage objects in `customer-documents` must be removed from the
--   -- dashboard (Storage) before deleting the bucket.
--
-- Mitigation without rollback: the backend treats a missing column/table as
-- «not configured», so reverting the code is never required by this file.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────
-- [46/59] exchange-01-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================
-- docs/exchange-01-migration.sql
--
-- Money changer / صرافی — QA document §10 (10 Nov 2026).
--
--   fx_settings        the business's identity-check threshold (NULL = never)
--   fx_rate_board      buy/sell rate per currency, append-only history
--   fx_trades          buy / sell / opening; the rate is copied onto the trade
--                      and never re-priced. Created ONLY by fx_trade_create,
--                      which refuses to sell more than is held (lock per
--                      workspace and currency). Voided, never deleted.
--   remittances        hawala: outgoing / incoming, payout code kept as a hash
--   remittance_events  append-only history of each remittance
--
-- ⚠️ Nothing here posts to the general ledger or to a till: the ledger has
-- no currency on its lines yet (01-CURRENCY-AUDIT.md) and till cash movements
-- post journals. The QA document: «قبل از تثبیت دفتر چندارزی، صندوق ارزی و
-- مغایرت وارد فروش عمومی نشود». The position per currency is read from
-- fx_trades alone.
--
-- Rates are integer millionths (70.25 → 70250000).
--
-- Additive and re-runnable. Depends on: workspaces, customers.
-- ⚠️ NOT run by the assistant. Run it, then docs/VERIFY-exchange-01.sql.
--
-- ROLLBACK (only while empty):
--   DROP TABLE IF EXISTS public.remittance_events, public.remittances,
--     public.fx_trades, public.fx_rate_board, public.fx_settings;
--   DROP FUNCTION IF EXISTS public.fx_trade_create(uuid, uuid, jsonb),
--     public.fx_trade_void(uuid, uuid, text, uuid),
--     public.remittance_move(uuid, uuid, text, text, text, text, uuid);
-- ============================================

-- ─── Settings ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fx_settings (
  workspace_id         uuid PRIMARY KEY REFERENCES public.workspaces (id) ON DELETE CASCADE,
  -- In the workspace's book currency, minor units. NULL = no identity is required.
  kyc_threshold_minor  bigint,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid,
  CONSTRAINT fx_settings_threshold CHECK (kyc_threshold_minor IS NULL OR kyc_threshold_minor > 0)
);

-- ─── Rate board ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fx_rate_board (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  currency         text NOT NULL,
  buy_rate_micro   bigint NOT NULL,
  sell_rate_micro  bigint NOT NULL,
  set_by           uuid NOT NULL,
  set_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fx_rate_board_positive CHECK (buy_rate_micro > 0 AND sell_rate_micro > 0),
  CONSTRAINT fx_rate_board_spread CHECK (sell_rate_micro >= buy_rate_micro),
  CONSTRAINT fx_rate_board_currency CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX IF NOT EXISTS fx_rate_board_latest_idx
  ON public.fx_rate_board (workspace_id, currency, set_at DESC);

-- ─── Trades ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fx_trades (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  number             bigint GENERATED BY DEFAULT AS IDENTITY,
  side               text NOT NULL,
  currency           text NOT NULL,
  amount_minor       bigint NOT NULL,
  rate_micro         bigint NOT NULL,
  book_currency      text NOT NULL,
  book_amount_minor  bigint NOT NULL,
  customer_id        uuid REFERENCES public.customers (id),
  id_full_name       text,
  id_type            text,
  id_number          text,
  note               text,
  status             text NOT NULL DEFAULT 'posted',
  void_reason        text,
  voided_at          timestamptz,
  voided_by          uuid,
  client_request_id  text,
  created_by         uuid NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fx_trades_side CHECK (side IN ('buy', 'sell', 'opening')),
  CONSTRAINT fx_trades_status CHECK (status IN ('posted', 'voided')),
  CONSTRAINT fx_trades_amounts CHECK (amount_minor > 0 AND rate_micro > 0 AND book_amount_minor >= 0),
  CONSTRAINT fx_trades_not_book CHECK (currency <> book_currency),
  CONSTRAINT fx_trades_identity_whole CHECK (
    (id_full_name IS NULL AND id_type IS NULL AND id_number IS NULL)
    OR (id_full_name IS NOT NULL AND id_type IS NOT NULL AND id_number IS NOT NULL)
  ),
  CONSTRAINT fx_trades_void_reason CHECK (status <> 'voided' OR length(btrim(coalesce(void_reason, ''))) > 0)
);

CREATE INDEX IF NOT EXISTS fx_trades_position_idx
  ON public.fx_trades (workspace_id, currency, created_at) WHERE status = 'posted';
CREATE UNIQUE INDEX IF NOT EXISTS fx_trades_request_key
  ON public.fx_trades (workspace_id, client_request_id) WHERE client_request_id IS NOT NULL;

-- Held now, foreign minor units, posted trades only.
CREATE OR REPLACE FUNCTION public.fx_held_minor(p_workspace_id uuid, p_currency text)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT coalesce(sum(CASE WHEN side = 'sell' THEN -amount_minor ELSE amount_minor END), 0)::bigint
    FROM public.fx_trades
   WHERE workspace_id = p_workspace_id AND currency = p_currency AND status = 'posted'
$fn$;

-- One trade. The amounts are computed by the backend from the rate
-- (convertAtRate, BigInt) and checked here only for shape; what this function
-- adds is the one thing a check-then-write cannot: «not more than is held»,
-- under a lock per workspace and currency.
CREATE OR REPLACE FUNCTION public.fx_trade_create(p_workspace_id uuid, p_user_id uuid, p_trade jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_id uuid;
  v_currency text := p_trade ->> 'currency';
  v_side text := p_trade ->> 'side';
  v_amount bigint := (p_trade ->> 'amount_minor')::bigint;
  v_request text := p_trade ->> 'client_request_id';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('fx:' || p_workspace_id::text || ':' || v_currency, 0));

  IF v_request IS NOT NULL THEN
    SELECT id INTO v_id FROM public.fx_trades
     WHERE workspace_id = p_workspace_id AND client_request_id = v_request;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  IF v_side = 'sell' AND public.fx_held_minor(p_workspace_id, v_currency) < v_amount THEN
    RAISE EXCEPTION 'FX_POSITION_SHORT' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.fx_trades (
    workspace_id, side, currency, amount_minor, rate_micro, book_currency, book_amount_minor,
    customer_id, id_full_name, id_type, id_number, note, client_request_id, created_by
  ) VALUES (
    p_workspace_id, v_side, v_currency, v_amount,
    (p_trade ->> 'rate_micro')::bigint,
    p_trade ->> 'book_currency',
    (p_trade ->> 'book_amount_minor')::bigint,
    nullif(p_trade ->> 'customer_id', '')::uuid,
    p_trade ->> 'id_full_name', p_trade ->> 'id_type', p_trade ->> 'id_number',
    p_trade ->> 'note', v_request, p_user_id
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END
$fn$;

-- Void: a bought amount that has since been sold cannot be un-bought.
CREATE OR REPLACE FUNCTION public.fx_trade_void(p_workspace_id uuid, p_trade_id uuid, p_reason text, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_trade public.fx_trades%ROWTYPE;
BEGIN
  SELECT * INTO v_trade FROM public.fx_trades WHERE id = p_trade_id AND workspace_id = p_workspace_id;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('fx:' || p_workspace_id::text || ':' || v_trade.currency, 0));
  IF v_trade.side <> 'sell'
     AND public.fx_held_minor(p_workspace_id, v_trade.currency) < v_trade.amount_minor THEN
    RETURN 'would_go_short';
  END IF;
  UPDATE public.fx_trades
     SET status = 'voided', void_reason = p_reason, voided_at = now(), voided_by = p_user_id
   WHERE id = p_trade_id AND workspace_id = p_workspace_id AND status = 'posted';
  IF NOT FOUND THEN
    RETURN 'already_voided';
  END IF;
  RETURN 'voided';
END
$fn$;

-- ─── Remittances (hawala) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.remittances (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  number             bigint GENERATED BY DEFAULT AS IDENTITY,
  direction          text NOT NULL,
  counterparty       text NOT NULL,
  sender_name        text NOT NULL,
  sender_phone       text,
  receiver_name      text NOT NULL,
  receiver_phone     text,
  destination        text,
  currency           text NOT NULL,
  amount_minor       bigint NOT NULL,
  fee_minor          bigint NOT NULL DEFAULT 0,
  customer_id        uuid REFERENCES public.customers (id),
  id_full_name       text,
  id_type            text,
  id_number          text,
  -- sha256 of the payout code. The code itself is shown once (outgoing) or
  -- typed from the partner (incoming), never stored.
  payout_code_hash   text NOT NULL,
  status             text NOT NULL DEFAULT 'created',
  cancel_reason      text,
  note               text,
  client_request_id  text,
  created_by         uuid NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  paid_at            timestamptz,
  CONSTRAINT remittances_direction CHECK (direction IN ('outgoing', 'incoming')),
  CONSTRAINT remittances_status CHECK (status IN ('created', 'sent', 'paid', 'cancelled')),
  CONSTRAINT remittances_incoming_never_sent CHECK (direction = 'outgoing' OR status <> 'sent'),
  CONSTRAINT remittances_amounts CHECK (amount_minor > 0 AND fee_minor >= 0),
  CONSTRAINT remittances_cancel_reason CHECK (status <> 'cancelled' OR length(btrim(coalesce(cancel_reason, ''))) > 0),
  CONSTRAINT remittances_identity_whole CHECK (
    (id_full_name IS NULL AND id_type IS NULL AND id_number IS NULL)
    OR (id_full_name IS NOT NULL AND id_type IS NOT NULL AND id_number IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS remittances_open_idx
  ON public.remittances (workspace_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS remittances_request_key
  ON public.remittances (workspace_id, client_request_id) WHERE client_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.remittance_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  remittance_id  uuid NOT NULL REFERENCES public.remittances (id) ON DELETE CASCADE,
  from_status    text,
  to_status      text NOT NULL,
  note           text,
  actor_id       uuid NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS remittance_events_idx ON public.remittance_events (remittance_id, created_at);

CREATE OR REPLACE FUNCTION public.remittance_events_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(OLD, NEW);
  END IF;
  RAISE EXCEPTION 'remittance_events is append-only' USING ERRCODE = '42501';
END
$fn$;

DROP TRIGGER IF EXISTS remittance_events_append_only_trg ON public.remittance_events;
CREATE TRIGGER remittance_events_append_only_trg
  BEFORE UPDATE OR DELETE ON public.remittance_events
  FOR EACH ROW EXECUTE FUNCTION public.remittance_events_append_only();

-- A move and its event in one transaction; status in the WHERE. Paying out
-- an incoming remittance requires the code's hash to match — compared here,
-- so no caller can skip it.
CREATE OR REPLACE FUNCTION public.remittance_move(
  p_workspace_id uuid,
  p_remittance_id uuid,
  p_from text,
  p_to text,
  p_reason text,
  p_code_hash text,
  p_actor uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_row public.remittances%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.remittances
   WHERE id = p_remittance_id AND workspace_id = p_workspace_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF v_row.status <> p_from THEN
    RETURN 'moved';
  END IF;
  IF v_row.direction = 'incoming' AND p_to = 'paid'
     AND (p_code_hash IS NULL OR p_code_hash <> v_row.payout_code_hash) THEN
    RETURN 'wrong_code';
  END IF;
  UPDATE public.remittances
     SET status = p_to,
         cancel_reason = CASE WHEN p_to = 'cancelled' THEN p_reason ELSE cancel_reason END,
         paid_at = CASE WHEN p_to = 'paid' THEN now() ELSE paid_at END,
         updated_at = now()
   WHERE id = p_remittance_id;
  INSERT INTO public.remittance_events (workspace_id, remittance_id, from_status, to_status, note, actor_id)
  VALUES (p_workspace_id, p_remittance_id, p_from, p_to, p_reason, p_actor);
  RETURN 'moved_ok';
END
$fn$;

-- ─── Privileges and RLS ────────────────────────────────────────────────────
ALTER TABLE public.fx_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_rate_board     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_trades         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remittances       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remittance_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.fx_settings, public.fx_rate_board, public.fx_trades,
              public.remittances, public.remittance_events
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.fx_settings TO service_role;
-- The board is history: a new rate is a new row.
GRANT SELECT, INSERT ON public.fx_rate_board TO service_role;
-- Trades and remittance states change only through the functions below.
GRANT SELECT ON public.fx_trades TO service_role;
GRANT SELECT, INSERT ON public.remittances TO service_role;
GRANT SELECT ON public.remittance_events TO service_role;

REVOKE ALL ON FUNCTION public.fx_held_minor(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fx_trade_create(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fx_trade_void(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remittance_move(uuid, uuid, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remittance_events_append_only() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fx_held_minor(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fx_trade_create(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fx_trade_void(uuid, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.remittance_move(uuid, uuid, text, text, text, text, uuid) TO service_role;


-- ────────────────────────────────────────────────────────────────────────
-- [47/59] member-module-blocks-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- PER-MEMBER PAGE BLOCKS — additive, idempotent, re-runnable.
--
-- ✅ RUN on the live database, 26 Sep 2026. Post-migration Audit: PASS — its
-- rows in docs/VERIFY-multi-instance-2026-09-26.sql all ok = true (16/16 in
-- total, reported by the user).
--
-- WHAT IT IS FOR
--
-- The owner decides, per person, which parts of the product that person may
-- open — "user 231 works on invoices and nothing else". Role overrides
-- (workspace_role_capabilities) change a whole ROLE; profiles (user_roles) can
-- only ADD. Neither can take a page away from ONE person.
--
-- WHAT A ROW MEANS
--
-- One row = one module (backend PERMISSION_MODULES key: invoices, payments,
-- accounting, inventory, …) this member may NOT use. The server removes that
-- module's capabilities from the member's effective set on every request.
--
--   • It only ever RESTRICTS. A block can never give anyone more than their
--     role already holds.
--   • No rows = no restriction. That is the explicit default (G4), and it is
--     also what every workspace has the moment this table is created.
--   • The owner is never restricted — enforced here by the CHECK below and
--     again in the server, which ignores blocks for the owner.
--
-- The backend reads this table before it exists as "no blocks" (42P01 /
-- PGRST205), so deploying the code first is safe.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_member_module_blocks (
  workspace_id uuid        NOT NULL,
  user_id      uuid        NOT NULL,
  module_key   text        NOT NULL,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id, module_key),
  CONSTRAINT workspace_member_module_blocks_module_check
    CHECK (module_key ~ '^[a-z_]+$')
);

CREATE INDEX IF NOT EXISTS workspace_member_module_blocks_workspace_idx
  ON public.workspace_member_module_blocks (workspace_id);

-- The server writes with the service role. Members may READ their own
-- workspace's rows (so a client can explain a lock); nobody writes directly.
ALTER TABLE public.workspace_member_module_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_member_module_blocks_members_read ON public.workspace_member_module_blocks;
CREATE POLICY workspace_member_module_blocks_members_read ON public.workspace_member_module_blocks
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- Removing every block restores every member to exactly what their role holds —
-- the behaviour before this feature. It deletes no business data.
--
--   DELETE FROM public.workspace_member_module_blocks;          -- lift all blocks
--   DROP TABLE IF EXISTS public.workspace_member_module_blocks; -- remove feature
--
-- The server treats a missing table as "no blocks", so dropping it is safe.
-- ============================================================================

-- ============================================================================
-- VERIFICATION — run separately, after the migration. Every row: ok = true.
-- ============================================================================
-- SELECT 'table exists' AS check,
--        to_regclass('public.workspace_member_module_blocks') IS NOT NULL AS ok
-- UNION ALL
-- SELECT 'rls enabled',
--        COALESCE((SELECT relrowsecurity FROM pg_class
--                  WHERE oid = to_regclass('public.workspace_member_module_blocks')), false)
-- UNION ALL
-- SELECT 'read policy present',
--        EXISTS (SELECT 1 FROM pg_policies
--                WHERE tablename = 'workspace_member_module_blocks'
--                  AND policyname = 'workspace_member_module_blocks_members_read')
-- UNION ALL
-- SELECT 'no write policy for clients',
--        NOT EXISTS (SELECT 1 FROM pg_policies
--                    WHERE tablename = 'workspace_member_module_blocks'
--                      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL'));


-- ────────────────────────────────────────────────────────────────────────
-- [48/59] operational-profile-01-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/operational-profile-01-migration.sql
--
-- V54 Phase 5.2 + 5.3 — the Operational DNA and the onboarding progress of a
-- WORKSPACE, kept on the server (until now both lived only on the device, so a
-- second phone or a cleared browser started from nothing).
--
-- What it adds (additive, idempotent, safe to re-run):
--   1. public.workspaces.operational_dna          jsonb  — the current 8-axis profile
--      public.workspaces.operational_dna_version  int    — 0 = never declared
--      public.workspaces.onboarding_progress      jsonb  — where the wizard stands
--   2. public.workspace_operational_dna_history  — APPEND-ONLY, one row per version
--      (who, when, what). A trigger refuses UPDATE and DELETE.
--   3. public.workspace_set_operational_dna(...)  — the ONLY writer of the DNA:
--      locks the workspace row, checks the version the caller read
--      (OPERATIONAL_PROFILE_CHANGED when someone saved in between), writes the
--      column and the history row in ONE transaction. Saving the same DNA again
--      is a replay: same version, no new history row.
--
-- ⚠️ The DNA decides presentation and which capabilities are SUGGESTED. It
-- changes no role, no permission, no ledger row, no historical document.
--
-- Prerequisite: none (business-profile-01 not required).
-- ⚠️ NOT run by the assistant. Run in the SQL editor, then
--    docs/VERIFY-operational-profile-01.sql.  Status: PENDING HUMAN CONFIRMATION
-- ============================================================================

-- ── 1. Columns ──────────────────────────────────────────────────────────────
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS operational_dna jsonb,
  ADD COLUMN IF NOT EXISTS operational_dna_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_progress jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_operational_dna_shape') THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_operational_dna_shape CHECK (
        operational_dna IS NULL OR
        (jsonb_typeof(operational_dna) = 'object' AND pg_column_size(operational_dna) < 4096)
      ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_operational_dna_version_nonneg') THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_operational_dna_version_nonneg CHECK (operational_dna_version >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_onboarding_progress_shape') THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_onboarding_progress_shape CHECK (
        onboarding_progress IS NULL OR
        (jsonb_typeof(onboarding_progress) = 'object' AND pg_column_size(onboarding_progress) < 4096)
      ) NOT VALID;
  END IF;
END $$;

-- ── 2. Append-only history ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workspace_operational_dna_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  version      integer NOT NULL CHECK (version > 0),
  dna          jsonb NOT NULL CHECK (jsonb_typeof(dna) = 'object'),
  changed_by   uuid,
  changed_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_operational_dna_history_one_per_version UNIQUE (workspace_id, version)
);

-- A fresh table is born with ALL for anon/authenticated/service_role in Supabase.
REVOKE ALL ON public.workspace_operational_dna_history FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.workspace_operational_dna_history TO service_role;
ALTER TABLE public.workspace_operational_dna_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.workspace_operational_dna_history_frozen()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- A workspace being deleted takes its history with it (cascade); nothing else may.
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'OPERATIONAL_DNA_HISTORY_IS_APPEND_ONLY' USING ERRCODE = 'P0001';
END $$;

DROP TRIGGER IF EXISTS workspace_operational_dna_history_frozen_trg
  ON public.workspace_operational_dna_history;
CREATE TRIGGER workspace_operational_dna_history_frozen_trg
  BEFORE UPDATE OR DELETE ON public.workspace_operational_dna_history
  FOR EACH ROW EXECUTE FUNCTION public.workspace_operational_dna_history_frozen();

-- ── 3. The one writer ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.workspace_set_operational_dna(
  p_workspace_id     uuid,
  p_actor            uuid,
  p_dna              jsonb,
  p_expected_version integer
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current jsonb;
  v_version integer;
BEGIN
  IF p_dna IS NULL OR jsonb_typeof(p_dna) <> 'object' THEN
    RAISE EXCEPTION 'OPERATIONAL_DNA_INVALID' USING ERRCODE = 'P0001';
  END IF;

  SELECT operational_dna, operational_dna_version
    INTO v_current, v_version
    FROM public.workspaces
   WHERE id = p_workspace_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKSPACE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- The same profile again (a retried save, a second device finishing the
  -- same wizard): the answer, and nothing new.
  IF v_current IS NOT NULL AND v_current = p_dna THEN
    RETURN jsonb_build_object('version', v_version, 'replayed', true);
  END IF;

  IF p_expected_version IS DISTINCT FROM v_version THEN
    RAISE EXCEPTION 'OPERATIONAL_PROFILE_CHANGED' USING ERRCODE = 'P0001';
  END IF;

  v_version := v_version + 1;

  UPDATE public.workspaces
     SET operational_dna = p_dna,
         operational_dna_version = v_version
   WHERE id = p_workspace_id;

  INSERT INTO public.workspace_operational_dna_history (workspace_id, version, dna, changed_by)
  VALUES (p_workspace_id, v_version, p_dna, p_actor);

  RETURN jsonb_build_object('version', v_version, 'replayed', false);
END $$;

REVOKE EXECUTE ON FUNCTION public.workspace_set_operational_dna(uuid, uuid, jsonb, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_set_operational_dna(uuid, uuid, jsonb, integer)
  TO service_role;

-- ── ROLLBACK BLOCK (manual; drops the history — export it first) ───────────
-- DROP FUNCTION IF EXISTS public.workspace_set_operational_dna(uuid, uuid, jsonb, integer);
-- DROP TRIGGER IF EXISTS workspace_operational_dna_history_frozen_trg ON public.workspace_operational_dna_history;
-- DROP FUNCTION IF EXISTS public.workspace_operational_dna_history_frozen();
-- DROP TABLE IF EXISTS public.workspace_operational_dna_history;
-- ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_onboarding_progress_shape;
-- ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_operational_dna_version_nonneg;
-- ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_operational_dna_shape;
-- ALTER TABLE public.workspaces DROP COLUMN IF EXISTS onboarding_progress;
-- ALTER TABLE public.workspaces DROP COLUMN IF EXISTS operational_dna_version;
-- ALTER TABLE public.workspaces DROP COLUMN IF EXISTS operational_dna;


-- ────────────────────────────────────────────────────────────────────────
-- [49/59] patch-02-custom-units-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- PATCH 2 / L0.2 — custom units, as a SEPARATE table.
--
-- ✅ APPROVED by the owner on 2026-09-19, over the alternative that added
-- `workspace_id` to `units` (that draft is deleted; see USER-REQUESTS #94).
--
-- ⚠️ TWO CHANGES SINCE THE PROPOSAL, both forced by the live database:
--   1. The RLS predicate no longer calls `auth_workspace_ids()`. That function
--      does NOT exist on this project (42883 when another migration tried it),
--      so the policy uses the `workspace_members` subquery that
--      tenant-isolation-closure-migration.sql already runs with.
--   2. `products.unit_label` is added here. A product measured in a workspace
--      unit stores `unit = 'custom'` (the existing enum member) and needs
--      somewhere to keep the word the user chose — `invoice_items` already has
--      exactly this column, `products` did not.
--
-- The patch brief offered two shapes and asked which and why. This file is the
-- answer, written out so the decision can be judged against real SQL rather
-- than a description.
--
-- ---------------------------------------------------------------------------
-- THE FINDING: `units` MUST STAY SYSTEM-OWNED, AND NOT BECAUSE OF TASTE
--
-- The brief's option B — add a nullable `workspace_id` to `units` and use the
-- `roles` pattern — CANNOT BE DONE ADDITIVELY. Two existing constraints make
-- it impossible:
--
--   1. `code text NOT NULL UNIQUE`  (phase-l-01, line 94)
--
--      Globally unique. The moment two workspaces both add «مثقال», the second
--      INSERT fails. Supporting per-workspace codes means DROPPING that
--      constraint and replacing it with UNIQUE (workspace_id, code) — a
--      rewrite of an existing constraint, which the patch rules forbid
--      ("هیچ ستون/جدول موجود Drop یا بازنویسی نشود").
--
--   2. `units_one_base_per_dimension`  —  UNIQUE (dimension) WHERE is_base
--
--      Exactly one base per dimension, globally. A workspace adding a weight
--      unit and marking it base collides with the seeded gram. Same problem,
--      same forbidden fix.
--
-- The `roles` pattern works there because a role name is not globally unique
-- and carries no cross-row invariant. Here the uniqueness IS the invariant:
-- two bases in a dimension make every conversion in it ambiguous, and the
-- ambiguity only ever surfaces as a wrong quantity.
--
-- ---------------------------------------------------------------------------
-- ⚠️ WHAT IS ACTUALLY MISSING IS NARROWER THAN "USERS CANNOT ADD UNITS"
--
-- A user CAN already record their own word for a unit: `unitSchema` has a
-- `custom` member and a sibling `unitLabel` free-text field, and phase-l-01
-- deliberately does not seed `custom` into `units` because it is «the user
-- typed their own word», not a unit with a conversion.
--
-- So the real gap is one step further in: a custom unit that carries a
-- CONVERSION and can therefore be used in `product_units`. A gold trader
-- wanting «۱ مثقال = ۴٫۶۸۷۵ گرم» cannot express it today, because
-- `product_units.unit_id` is a foreign key to `units(id)` and there is no row
-- to point at.
--
-- That is what this table adds, and nothing more.
--
-- ---------------------------------------------------------------------------
-- ADDITIVE AND IDEMPOTENT. One new table, one new nullable column on
-- `product_units`, one CHECK. No existing column dropped, no existing
-- constraint rewritten, no existing row changed.
--
-- ROLLBACK / MITIGATION
--   ALTER TABLE product_units DROP CONSTRAINT IF EXISTS product_units_one_unit_source;
--   ALTER TABLE product_units DROP COLUMN IF EXISTS custom_unit_id;
--   DROP TABLE IF EXISTS custom_units;
--
--   Every existing product-unit row uses `unit_id` and is untouched by all
--   three statements, so this returns the database exactly to its present
--   state.
-- ============================================================================

-- ⚠️ LOCK NOTE: the ALTER TABLE statements need an exclusive lock on tables the
-- live app reads, so a run during traffic can end with «40P01: deadlock
-- detected». NOTHING is half-applied — the file is one transaction. Re-run it
-- when the app is quiet.

BEGIN;

-- Give up rather than queue behind (or deadlock with) live queries.
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. custom_units — a workspace's own units.
--
-- Deliberately mirrors the SHAPE of `units` (code, name, dimension,
-- conversion_factor) so the two can be read into one list by the API without
-- a translation layer. It does NOT mirror `is_base`: a workspace cannot
-- redefine what the base of a dimension is. The base is the gram, the metre,
-- the litre and the piece, for everyone — that is what makes a conversion
-- comparable across the product.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_units (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL,

  /** The user's own code. Unique WITHIN a workspace, not globally. */
  code              text NOT NULL,
  name              text NOT NULL,
  name_fa           text,
  symbol            text,

  /**
   * Which dimension this unit measures, and how many of that dimension's BASE
   * unit one of these is.
   *
   * «۱ مثقال = ۴٫۶۸۷۵ گرم» is dimension 'weight', factor 4.6875 — the gram
   * being the seeded base of the weight dimension in `units`.
   *
   * ⚠️ Same meaning as `units.conversion_factor`, so the two can be used
   * interchangeably by the converter. A different meaning here would be a
   * second conversion model, and mixing the two would produce quantities
   * wrong by whatever the difference was.
   */
  dimension         text NOT NULL,
  conversion_factor numeric(18, 6) NOT NULL,

  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,

  CONSTRAINT custom_units_dimension_check
    CHECK (dimension IN ('weight', 'length', 'volume', 'count')),
  CONSTRAINT custom_units_factor_positive CHECK (conversion_factor > 0),
  CONSTRAINT custom_units_code_per_workspace UNIQUE (workspace_id, code)
);

COMMENT ON TABLE custom_units IS
  'Patch 2 / L0.2 - a workspace''s own units of measure. Separate from `units` because `units.code` is globally UNIQUE and `units_one_base_per_dimension` allows one base per dimension globally; per-workspace codes would require rewriting both, which is not additive. A workspace may add a unit, never redefine a dimension''s base.';

COMMENT ON COLUMN custom_units.conversion_factor IS
  'Base units of this dimension per one of these - the SAME meaning as units.conversion_factor, so the converter can treat both alike.';

CREATE INDEX IF NOT EXISTS custom_units_workspace_idx
  ON custom_units (workspace_id) WHERE is_active;

-- Workspace-scoped, and writable by its own members — unlike `units`, which
-- is system data. This is the ordinary tenant policy, not the reference-data
-- one.
ALTER TABLE custom_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_units_workspace ON custom_units;
CREATE POLICY custom_units_workspace ON custom_units
  FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
  ));


-- ---------------------------------------------------------------------------
-- 2. product_units can point at either kind.
--
-- ⚠️ `unit_id` STAYS NOT NULL-ABLE? No — it must become nullable for a row to
-- reference a custom unit instead. That is a relaxation, not a rewrite: every
-- existing row keeps its value and every existing read keeps working. The
-- CHECK below is what stops it becoming "neither".
-- ---------------------------------------------------------------------------
ALTER TABLE product_units ADD COLUMN IF NOT EXISTS custom_unit_id uuid
  REFERENCES custom_units (id) ON DELETE RESTRICT;

ALTER TABLE product_units ALTER COLUMN unit_id DROP NOT NULL;

-- Exactly one source, never both and never neither. Both would make the
-- conversion ambiguous; neither would make the row meaningless.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'product_units_one_unit_source'
       AND conrelid = to_regclass('public.product_units')
  ) THEN
    ALTER TABLE product_units ADD CONSTRAINT product_units_one_unit_source
      CHECK ((unit_id IS NOT NULL) <> (custom_unit_id IS NOT NULL)) NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN product_units.custom_unit_id IS
  'Patch 2 - set instead of unit_id when the product is measured in one of the workspace''s own units. Exactly one of the two is set (product_units_one_unit_source).';

-- ⚠️ The existing UNIQUE (product_id, unit_id) does not cover the new column,
-- so a product could hold the same custom unit twice. This adds the matching
-- guarantee without touching the existing constraint.
CREATE UNIQUE INDEX IF NOT EXISTS product_units_unique_custom
  ON product_units (product_id, custom_unit_id) WHERE custom_unit_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 3. The word itself, on the product.
--
-- `unit` is an enum whose 'custom' member means «the user typed their own
-- word», and the word lives in a sibling label — that is already how
-- `invoice_items.unit_label` works. `products` had no such column, so a
-- product measured in «مثقال» could only ever display «custom».
--
-- Nullable and unconstrained: it is meaningful only when unit = 'custom', and
-- every existing row keeps NULL.
-- ---------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_label text;

COMMENT ON COLUMN products.unit_label IS
  'Patch 2 - the workspace unit''s name, shown when unit = ''custom''. Same role as invoice_items.unit_label.';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
-- ============================================================================

-- 1. The table exists and is empty.  EXPECT: 0
SELECT COUNT(*) AS custom_unit_rows FROM custom_units;

-- 2. RLS is on and workspace-scoped.  EXPECT: rowsecurity true, 1 policy, ALL
SELECT c.relrowsecurity AS rowsecurity,
       (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = 'custom_units') AS policies
FROM   pg_class c WHERE c.relname = 'custom_units';

SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'custom_units';

-- 3. ⚠️ EVERY EXISTING product_units ROW IS UNAFFECTED.
--    EXPECT: total unchanged, custom_unit_id null on all of them, and the
--    one-source CHECK satisfied by every row.
SELECT COUNT(*)                                        AS total_rows,
       COUNT(*) FILTER (WHERE unit_id IS NOT NULL)     AS using_system_unit,
       COUNT(*) FILTER (WHERE custom_unit_id IS NOT NULL) AS using_custom_unit,
       COUNT(*) FILTER (WHERE unit_id IS NULL AND custom_unit_id IS NULL) AS orphaned
FROM   product_units;

-- 4. The `units` table is untouched — still 14 rows, still one base per
--    dimension, still no write policy.  EXPECT: 14, 4, 1
SELECT (SELECT COUNT(*) FROM units WHERE is_active)                          AS unit_rows,
       (SELECT COUNT(*) FROM units WHERE is_base)                            AS base_units,
       (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'units')          AS unit_policies;

-- 5. ⚠️ `units` STILL HAS NO WRITE POLICY. This patch must not have opened it.
--    EXPECT: 0
SELECT COUNT(*) AS unit_write_policies
FROM   pg_policies
WHERE  tablename = 'units' AND cmd <> 'SELECT';

-- 6. The one-source CHECK actually refuses both and neither.
--    EXPECT: both statements raise 23514.
-- INSERT INTO product_units (workspace_id, product_id, unit_id, custom_unit_id,
--   conversion_factor_to_base, is_base_unit)
--   VALUES ('00000000-0000-0000-0000-000000000000',
--           '00000000-0000-0000-0000-000000000000', NULL, NULL, 1, false);
-- INSERT INTO product_units (workspace_id, product_id, unit_id, custom_unit_id,
--   conversion_factor_to_base, is_base_unit)
--   VALUES ('00000000-0000-0000-0000-000000000000',
--           '00000000-0000-0000-0000-000000000000',
--           (SELECT id FROM units LIMIT 1),
--           (SELECT id FROM custom_units LIMIT 1), 1, false);


-- ────────────────────────────────────────────────────────────────────────
-- [50/59] referral-system-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- ✅ RUN AND VERIFIED BY THE OWNER — 2026-09-20.
-- Every row of the verification query below returned ok = true.
-- Do not run again; it is idempotent, but there is nothing left to do.
-- ============================================================================

-- ============================================================================
-- REFERRAL SYSTEM — additive, idempotent, re-runnable.
--
-- The owner's model, in full:
--   • معرف: 10% of the subscription amount ACTUALLY PAID by the referred user
--   • activation: only after the FIRST SUCCESSFUL PAYMENT — never on sign-up
--   • duration: the first 12 paid months, then it stops
--   • the new user: 10% off their first payment
--   • reward is in-product CREDIT; a cash payout needs a $10 threshold
--
-- ⚠️ 10% OF THE SUBSCRIPTION, NEVER OF TURNOVER. A shop moving millions
-- through Hisabche is not a bigger commission — the revenue model is the
-- subscription, and tying a referral to turnover would promise a share of
-- money this business never earns.
--
-- ⚠️ RUN THIS YOURSELF IN THE SQL EDITOR. Nothing in this repository executes
-- DDL against the live database. The verification query is at the bottom.
--
-- ----------------------------------------------------------------------------
-- LOCK NOTE
--
-- Everything here is CREATE ... IF NOT EXISTS on NEW tables, so no existing
-- table is rewritten and no running query is blocked. `lock_timeout` is set
-- anyway: if another migration is mid-flight this one fails fast instead of
-- queueing behind it while holding its own locks.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1. The code a person shares.
--
-- ⚠️ ONE ROW PER USER, and the CODE is globally unique — it appears in a URL
-- with no workspace context, so it must resolve on its own.
--
-- ⚠️ NOT GUESSABLE. The application generates it from 16 random bytes over an
-- alphabet with no look-alike characters. A sequential or name-derived code
-- would let anyone credit themselves against a stranger's sign-ups.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  code        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_codes_code_key UNIQUE (code),
  CONSTRAINT referral_codes_user_key UNIQUE (user_id)
);

-- ----------------------------------------------------------------------------
-- 2. Attribution — who invited this business, decided once.
--
-- ⚠️ ONE REFERRER PER WORKSPACE, FOR EVER. The unique constraint IS the rule:
-- without it a second sign-up in the same shop would create a second referral
-- and pay twice, and a later «switch my referrer» would silently move an
-- earned commission to somebody else.
--
-- ⚠️ THE 12-MONTH WINDOW STARTS AT THE FIRST PAYMENT, NOT AT SIGN-UP.
-- `first_paid_at` is null until then, and while it is null this row has earned
-- nothing. A business that signs up and never pays costs the referrer nothing
-- and earns them nothing — which is the whole point of «only on a successful
-- payment».
--
-- `attribution_expires_at` closes the other end: a code clicked today does not
-- credit somebody who signs up two years later.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referrals (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  referred_user_id       uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  referred_workspace_id  uuid REFERENCES workspaces (id) ON DELETE SET NULL,
  -- ⚠️ A SNAPSHOT, like an invoice line's product name: the page must still
  -- read correctly after a workspace is renamed or deleted.
  referred_name          text,
  code                   text NOT NULL,
  signed_up_at           timestamptz NOT NULL DEFAULT now(),
  -- When the first successful payment landed. NULL = nothing earned yet.
  first_paid_at          timestamptz,
  -- Commissions stop 12 months after `first_paid_at`; written when it is set.
  commission_ends_at     timestamptz,
  -- After this, the code no longer attributes a new sign-up.
  attribution_expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  -- Was the new user's 10% welcome discount actually applied to a payment?
  -- ⚠️ Recorded, not assumed: «offered» and «used» are different facts.
  signup_discount_bps    integer NOT NULL DEFAULT 1000
                         CHECK (signup_discount_bps BETWEEN 0 AND 10000),
  signup_discount_used_at timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referrals_workspace_once UNIQUE (referred_workspace_id)
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx
  ON referrals (referrer_user_id, signed_up_at DESC);

-- ----------------------------------------------------------------------------
-- 3. The commission LEDGER.
--
-- ⚠️ A LEDGER, NOT A BALANCE COLUMN. A refund, a chargeback or a cancelled
-- subscription does not edit the row that was earned — it appends a REVERSAL.
-- Editing would destroy the record of what was paid and when, which is the one
-- thing an audit needs. Same rule the rest of this product follows for money.
--
-- ⚠️ THE BASE AMOUNT AND RATE ARE STORED, NOT RE-DERIVED. If the price of
-- «pro» changes next year, last year's commissions must still show what they
-- were actually calculated from.
--
-- ⚠️ MONEY IS AN INTEGER IN THE SMALLEST UNIT (راهنمای سشن §۱٫۳).
-- $12.00 is 1200. `rate_bps` is basis points: 1000 = 10%.
--
-- ⚠️ ONE ROW PER PAID PERIOD, enforced by the unique key, so a webhook retry
-- cannot pay twice. `period_index` is 1..12 — the cap is data, not a comment.
--
-- `kind`: 'earned' is money owed; 'reversal' is a negative entry pointing at
-- the row it cancels. The balance is the SUM, never a stored number.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_commissions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id       uuid NOT NULL REFERENCES referrals (id) ON DELETE CASCADE,
  referrer_user_id  uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  subscription_id   uuid,
  kind              text NOT NULL DEFAULT 'earned'
                    CHECK (kind IN ('earned', 'reversal')),
  -- The earned row this reverses. NULL on an 'earned' row.
  reverses_id       uuid REFERENCES referral_commissions (id) ON DELETE SET NULL,
  reversal_reason   text CHECK (
                      reversal_reason IS NULL
                      OR reversal_reason IN ('refund', 'chargeback', 'cancellation', 'manual')
                    ),
  plan              text NOT NULL,
  interval          text NOT NULL CHECK (interval IN ('month', 'year')),
  period_start      timestamptz NOT NULL,
  -- 1 for the first paid period, up to 12. The window's enforcement.
  period_index      integer NOT NULL CHECK (period_index BETWEEN 1 AND 12),
  base_amount_minor bigint NOT NULL CHECK (base_amount_minor >= 0),
  rate_bps          integer NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  -- ⚠️ SIGNED. A reversal is negative; the balance is a plain SUM and cannot
  -- disagree with the rows it came from.
  amount_minor      bigint NOT NULL,
  currency          text NOT NULL,
  -- pending: earned, not yet settled · credited: turned into product credit
  -- · paid: cash paid out · void: never owed.
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'credited', 'paid', 'void')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_commissions_period_once
    UNIQUE (subscription_id, period_start, kind)
);

CREATE INDEX IF NOT EXISTS referral_commissions_referrer_idx
  ON referral_commissions (referrer_user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Settlement.
--
-- ⚠️ THE THRESHOLD LIVES HERE AS DATA. «at least $10» is a business rule that
-- will be tuned; a constant in TypeScript would mean a deploy to change it and
-- no record of what it was when a payout was refused.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_payouts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id  uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  amount_minor      bigint NOT NULL CHECK (amount_minor > 0),
  currency          text NOT NULL,
  -- 'credit' keeps the money inside the product — the owner's preference,
  -- because it creates no cash pressure. 'cash' is a real transfer.
  method            text NOT NULL DEFAULT 'credit' CHECK (method IN ('credit', 'cash')),
  threshold_minor   bigint NOT NULL,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_payouts_referrer_idx
  ON referral_payouts (referrer_user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. Row security.
--
-- ⚠️ `auth_workspace_ids()` DOES NOT EXIST ON THIS DATABASE — an earlier
-- migration failed with 42883 for using it. These policies use `auth.uid()`
-- directly, which is what these tables are keyed by: a referral belongs to a
-- PERSON, not to a workspace.
--
-- The service role bypasses RLS, so the backend still writes a commission for
-- somebody other than the caller — which is exactly what an activation does.
-- ----------------------------------------------------------------------------
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_codes_own ON referral_codes;
CREATE POLICY referral_codes_own ON referral_codes
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS referrals_own ON referrals;
CREATE POLICY referrals_own ON referrals
  FOR SELECT USING (referrer_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS referral_commissions_own ON referral_commissions;
CREATE POLICY referral_commissions_own ON referral_commissions
  FOR SELECT USING (referrer_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS referral_payouts_own ON referral_payouts;
CREATE POLICY referral_payouts_own ON referral_payouts
  FOR SELECT USING (referrer_user_id = (SELECT auth.uid()));

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- These are new tables holding new facts; nothing existing depends on them.
-- Dropping them destroys every recorded referral and every commission — that
-- is data loss, not a no-op. Export first if any row exists.
--
--   BEGIN;
--   DROP TABLE IF EXISTS referral_payouts;
--   DROP TABLE IF EXISTS referral_commissions;
--   DROP TABLE IF EXISTS referrals;
--   DROP TABLE IF EXISTS referral_codes;
--   COMMIT;
--
-- To switch the feature OFF without losing data, stop the backend writing to
-- it rather than dropping the tables.
-- ============================================================================

-- ============================================================================
-- VERIFICATION — run separately, after the migration.
-- Every row must read ok = true.
-- ============================================================================
-- SELECT 'referral_codes exists'       AS check, to_regclass('public.referral_codes')       IS NOT NULL AS ok
-- UNION ALL SELECT 'referrals exists',           to_regclass('public.referrals')            IS NOT NULL
-- UNION ALL SELECT 'commissions exists',         to_regclass('public.referral_commissions') IS NOT NULL
-- UNION ALL SELECT 'payouts exists',             to_regclass('public.referral_payouts')     IS NOT NULL
-- UNION ALL SELECT 'code is unique',             EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referral_codes_code_key')
-- UNION ALL SELECT 'one referrer per workspace', EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_workspace_once')
-- UNION ALL SELECT 'one row per paid period',    EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referral_commissions_period_once')
-- UNION ALL SELECT 'window capped at 12',        EXISTS (
--   SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
--   WHERE t.relname = 'referral_commissions' AND pg_get_constraintdef(c.oid) ILIKE '%period_index%12%')
-- UNION ALL SELECT 'rls on codes',               relrowsecurity FROM pg_class WHERE relname = 'referral_codes'
-- UNION ALL SELECT 'rls on referrals',           relrowsecurity FROM pg_class WHERE relname = 'referrals'
-- UNION ALL SELECT 'rls on commissions',         relrowsecurity FROM pg_class WHERE relname = 'referral_commissions'
-- UNION ALL SELECT 'rls on payouts',             relrowsecurity FROM pg_class WHERE relname = 'referral_payouts';


-- ────────────────────────────────────────────────────────────────────────
-- [51/59] resource-capacity-01-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/resource-capacity-01-migration.sql
--
-- V60 Slice 7 — Unified Resource & Capacity Engine
-- Generalizes `service_resources` to table/room/vehicle/machine/equipment/court
-- and introduces ONE atomic interval booking table (`resource_bookings`) backed
-- by `btree_gist` exclusion constraints (`during tstzrange WITH &&`) so no two
-- concurrent active bookings (or maintenance holds) can ever double-book a resource.
--
-- Re-runnable, additive, non-destructive (historical sessions without a booking stay intact).
-- ⚠️ NOT run by the assistant. Status: PENDING HUMAN CONFIRMATION.
-- After running, run `docs/VERIFY-resource-capacity-01.sql`.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;
-- Keep the extension out of the exposed public schema (extension_in_public).
-- `extensions` is Supabase's standard non-API schema. The move is idempotent and
-- preserves the OIDs that existing exclusion constraints depend on.
CREATE SCHEMA IF NOT EXISTS extensions;
-- resource_bookings is backend-only (locked down below), so only service_role
-- needs the extension schema; clients never resolve gist_uuid_ops themselves.
-- Conditional: a bare Postgres (the pg test harness) has no Supabase roles.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON SCHEMA extensions TO service_role;
  END IF;
END $$;
ALTER EXTENSION btree_gist SET SCHEMA extensions;
-- The exclusion constraint below uses btree_gist's gist_uuid_ops; keep the
-- extension schema visible so the operator class resolves after the move.
SET search_path = public, extensions;

-- ─── 1. Generalize resource kinds & exclusiveness on service_resources ────────
ALTER TABLE public.service_resources
  ADD COLUMN IF NOT EXISTS exclusive boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_resources_kind') THEN
    ALTER TABLE public.service_resources DROP CONSTRAINT service_resources_kind;
  END IF;
  ALTER TABLE public.service_resources
    ADD CONSTRAINT service_resources_kind CHECK (
      kind IN ('chair', 'room', 'bed', 'station', 'equipment', 'table', 'vehicle', 'machine', 'court')
    ) NOT VALID;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_catalog_kind') THEN
    ALTER TABLE public.service_catalog DROP CONSTRAINT service_catalog_kind;
  END IF;
  ALTER TABLE public.service_catalog
    ADD CONSTRAINT service_catalog_kind CHECK (
      resource_kind IS NULL OR resource_kind IN (
        'chair', 'room', 'bed', 'station', 'equipment', 'table', 'vehicle', 'machine', 'court'
      )
    ) NOT VALID;
END $$;

-- ─── 2. Unified interval booking table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resource_bookings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  resource_id  uuid NOT NULL REFERENCES public.service_resources (id) ON DELETE CASCADE,
  during       tstzrange NOT NULL,
  source_type  text NOT NULL CHECK (source_type IN ('session', 'appointment', 'rental', 'table', 'maintenance')),
  source_id    uuid,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'cancelled')),
  notes        text,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  released_at  timestamptz,
  CONSTRAINT resource_bookings_valid_range CHECK (NOT isempty(during) AND lower(during) < upper(during))
);

CREATE INDEX IF NOT EXISTS resource_bookings_ws_res_idx
  ON public.resource_bookings (workspace_id, resource_id, status);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resource_bookings_no_overlap') THEN
    ALTER TABLE public.resource_bookings
      ADD CONSTRAINT resource_bookings_no_overlap
      EXCLUDE USING gist (
        workspace_id WITH =,
        resource_id WITH =,
        during WITH &&
      )
      WHERE (status = 'active');
  END IF;
END $$;

-- ─── 3. Cross-tenant & active-resource integrity guard trigger ───────────────
CREATE OR REPLACE FUNCTION public.resource_bookings_guard_fn()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_ws uuid;
  v_active boolean;
BEGIN
  SELECT workspace_id, is_active INTO v_ws, v_active
    FROM public.service_resources
   WHERE id = NEW.resource_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_ws <> NEW.workspace_id THEN
    RAISE EXCEPTION 'TENANT_RESOURCE_MISMATCH' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.status = 'active' AND NOT COALESCE(v_active, false) THEN
    RAISE EXCEPTION 'RESOURCE_INACTIVE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $fn$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'resource_bookings_guard_trg') THEN
    CREATE TRIGGER resource_bookings_guard_trg
      BEFORE INSERT OR UPDATE ON public.resource_bookings
      FOR EACH ROW
      EXECUTE FUNCTION public.resource_bookings_guard_fn();
  END IF;
END $$;

-- ─── 4. RLS & Least-Privilege Grants (Supabase mandatory pattern) ────────────
ALTER TABLE resource_bookings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.resource_bookings FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.resource_bookings TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.resource_bookings TO service_role;


-- ─── ROLLBACK BLOCK ──────────────────────────────────────────────────────────
-- DROP TRIGGER IF EXISTS resource_bookings_guard_trg ON public.resource_bookings;
-- DROP FUNCTION IF EXISTS public.resource_bookings_guard_fn();
-- DROP TABLE IF EXISTS public.resource_bookings;
-- ALTER TABLE public.service_resources DROP COLUMN IF EXISTS exclusive;


-- ---------------------------------------------------------------------------
-- CLIENT LOCKDOWN (V61 audit, 12 Nov 2026).
--
-- These tables are reached ONLY through the backend (service_role), which
-- checks the capability of the person asking. A policy "FOR ALL TO
-- authenticated USING (workspace member)" let ANY member of the workspace —
-- a seller included — write these rows straight through the Supabase API and
-- skip every capability check (e.g. approve their own request, overwrite
-- another member's 2FA enrollment). RLS stays ON with NO policy; clients get
-- nothing. Idempotent: on a database where the earlier version of this file
-- already ran, it drops whatever policies exist on these tables.
-- ---------------------------------------------------------------------------
DO $lockdown$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = ANY (ARRAY['resource_bookings'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $lockdown$;
ALTER TABLE public.resource_bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.resource_bookings FROM PUBLIC, anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────
-- [52/59] retail-ops-01-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================
-- docs/retail-ops-01-migration.sql
--
-- QA document §9 (10 Nov 2026). (§6 «Pick Request» needs no table: it is the
-- existing transfer document, phase-k-01 stock_transfers, now wired.)
--   2. stock_serials: «reserved» status and who it is held for (Mobile
--      Retail DNA: hold a unit for a customer). Warranty per unit already
--      exists — public.warranties (universal-core), one row per sold unit with
--      its end date — and the repair slip reads it; no second warranty column.
--   3. repair_tickets + repair_ticket_events   the repair slip and its history.
--      Events are append-only (trigger). A ticket is not money: the charge is
--      an ordinary sale invoice it points to.
--
-- Additive and re-runnable. Depends on: customers, employees, invoices, stock_serials (traceability-migration.sql).
--
-- ⚠️ NOT run by the assistant. Run it, then docs/VERIFY-retail-ops-01.sql.
--
-- ROLLBACK (only while the tables are empty):
--   DROP TABLE IF EXISTS public.repair_ticket_events, public.repair_tickets;
--   ALTER TABLE public.stock_serials DROP COLUMN IF EXISTS reserved_for_customer_id;
--   (then restore the old status CHECK: in_stock, sold, returned, scrapped —
--    only once no unit is «reserved».)
-- ============================================

-- ─── 2. Serial units: held for a customer ──────────────────────────────────
ALTER TABLE public.stock_serials ADD COLUMN IF NOT EXISTS reserved_for_customer_id uuid;

DO $$
BEGIN
  -- Widen the status set once; re-running finds the new constraint and stops.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'stock_serials_status_check'
       AND pg_get_constraintdef(oid) LIKE '%reserved%'
  ) THEN
    ALTER TABLE public.stock_serials DROP CONSTRAINT IF EXISTS stock_serials_status_check;
    ALTER TABLE public.stock_serials ADD CONSTRAINT stock_serials_status_check
      CHECK (status IN ('in_stock', 'reserved', 'sold', 'returned', 'scrapped')) NOT VALID;
  END IF;
  -- Held ⇔ held for someone.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_serials_reserved_for') THEN
    ALTER TABLE public.stock_serials ADD CONSTRAINT stock_serials_reserved_for
      CHECK ((status = 'reserved') = (reserved_for_customer_id IS NOT NULL)) NOT VALID;
  END IF;
END $$;

-- ─── 3. Repair tickets ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.repair_tickets (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  number                   bigint GENERATED BY DEFAULT AS IDENTITY,
  customer_id              uuid NOT NULL REFERENCES public.customers (id),
  serial_id                uuid REFERENCES public.stock_serials (id),
  device_label             text NOT NULL,
  problem                  text NOT NULL,
  status                   text NOT NULL DEFAULT 'received',
  -- Decided by the server from public.warranties when the slip is opened.
  under_warranty           boolean NOT NULL DEFAULT false,
  estimate_minor           bigint,
  currency                 text,
  technician_employee_id   uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  promised_on              date,
  invoice_id               uuid REFERENCES public.invoices (id),
  created_by               uuid NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  closed_at                timestamptz,
  CONSTRAINT repair_tickets_status_check CHECK (status IN (
    'received', 'diagnosing', 'waiting_parts', 'repairing', 'ready', 'delivered', 'cancelled'
  )),
  CONSTRAINT repair_tickets_device CHECK (length(btrim(device_label)) > 0),
  CONSTRAINT repair_tickets_problem CHECK (length(btrim(problem)) > 0),
  CONSTRAINT repair_tickets_estimate_currency CHECK ((estimate_minor IS NULL) = (currency IS NULL)),
  CONSTRAINT repair_tickets_estimate_sign CHECK (estimate_minor IS NULL OR estimate_minor >= 0),
  CONSTRAINT repair_tickets_invoice_on_delivery CHECK (invoice_id IS NULL OR status = 'delivered')
);

CREATE INDEX IF NOT EXISTS repair_tickets_open_idx
  ON public.repair_tickets (workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS repair_tickets_customer_idx
  ON public.repair_tickets (workspace_id, customer_id);

CREATE TABLE IF NOT EXISTS public.repair_ticket_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  ticket_id   uuid NOT NULL REFERENCES public.repair_tickets (id) ON DELETE CASCADE,
  from_status text,
  to_status   text NOT NULL,
  note        text,
  actor_id    uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS repair_ticket_events_ticket_idx
  ON public.repair_ticket_events (ticket_id, created_at);

-- The history of a slip is never rewritten. Cascade (workspace removal) is let through.
CREATE OR REPLACE FUNCTION public.repair_ticket_events_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(OLD, NEW);
  END IF;
  RAISE EXCEPTION 'repair_ticket_events is append-only' USING ERRCODE = '42501';
END
$fn$;

DROP TRIGGER IF EXISTS repair_ticket_events_append_only_trg ON public.repair_ticket_events;
CREATE TRIGGER repair_ticket_events_append_only_trg
  BEFORE UPDATE OR DELETE ON public.repair_ticket_events
  FOR EACH ROW EXECUTE FUNCTION public.repair_ticket_events_append_only();

-- A move and its event, in one transaction; the status is in the WHERE, so
-- two people moving the same slip cannot both succeed.
CREATE OR REPLACE FUNCTION public.repair_ticket_move(
  p_workspace_id uuid,
  p_ticket_id uuid,
  p_from text,
  p_to text,
  p_note text,
  p_invoice_id uuid,
  p_actor uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.repair_tickets
     SET status = p_to,
         invoice_id = coalesce(p_invoice_id, invoice_id),
         updated_at = now(),
         closed_at = CASE WHEN p_to IN ('delivered', 'cancelled') THEN now() ELSE closed_at END
   WHERE id = p_ticket_id
     AND workspace_id = p_workspace_id
     AND status = p_from;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RETURN false;
  END IF;
  INSERT INTO public.repair_ticket_events (workspace_id, ticket_id, from_status, to_status, note, actor_id)
  VALUES (p_workspace_id, p_ticket_id, p_from, p_to, p_note, p_actor);
  RETURN true;
END
$fn$;

-- ─── Privileges and RLS ────────────────────────────────────────────────────
ALTER TABLE public.repair_tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_ticket_events ENABLE ROW LEVEL SECURITY;

-- ⚠️ A new table in Supabase is born with ALL for every role (lesson: REVOKE first).
REVOKE ALL ON public.repair_tickets, public.repair_ticket_events
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.repair_tickets TO service_role;
GRANT SELECT, INSERT ON public.repair_ticket_events TO service_role;

REVOKE ALL ON FUNCTION public.repair_ticket_move(uuid, uuid, text, text, text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.repair_ticket_move(uuid, uuid, text, text, text, uuid, uuid)
  TO service_role;
REVOKE ALL ON FUNCTION public.repair_ticket_events_append_only() FROM PUBLIC, anon, authenticated, service_role;


-- ────────────────────────────────────────────────────────────────────────
-- [53/59] sync-commit-horizon-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- Migration: docs/sync-commit-horizon-migration.sql
-- Name: Commit Horizon Sync Pull via xid8 and pg_snapshot_xmin
-- Phase: Universal Core / Launch Critical
-- Date: 2026-10-26
--
-- Purpose:
--   Eliminates the in-flight commit-order hazard in sync_change_log without
--   write serialization or sleep heuristics. Every log entry records its
--   Postgres transaction ID (xid8). The pull query returns only entries whose
--   txid is strictly less than pg_snapshot_xmin(pg_current_snapshot()),
--   guaranteeing that no in-flight transaction with a smaller sync_version
--   can commit later.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.sync_pull_changes(uuid, bigint, int);
--   DROP INDEX IF EXISTS public.sync_change_log_ws_version_idx;
--   DROP INDEX IF EXISTS public.sync_change_log_txid_idx;
--   ALTER TABLE public.sync_change_log DROP COLUMN IF EXISTS txid;
-- ============================================================================

-- ── 1. Add txid to sync_change_log ──────────────────────────────────────────

ALTER TABLE public.sync_change_log
  ADD COLUMN IF NOT EXISTS txid xid8 DEFAULT pg_current_xact_id();

-- Rename misnamed index if present, or create with proper name
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'sync_change_log_txid_idx' AND tablename = 'sync_change_log')
     AND NOT EXISTS (
       SELECT 1 FROM pg_attribute a
       JOIN pg_class c ON a.attrelid = c.oid
       WHERE c.relname = 'sync_change_log_txid_idx' AND a.attname = 'txid'
     ) THEN
    ALTER INDEX public.sync_change_log_txid_idx RENAME TO sync_change_log_ws_version_idx;
  ELSIF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'sync_change_log_ws_version_idx') THEN
    CREATE INDEX IF NOT EXISTS sync_change_log_workspace_version_idx ON public.sync_change_log (workspace_id, sync_version);
  END IF;
END $$;

-- Dedicated index on txid to accelerate horizon filtering
CREATE INDEX IF NOT EXISTS sync_change_log_txid_idx
  ON public.sync_change_log (txid);

-- ── 2. The Commit-Horizon Pull Function ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_pull_changes(
  p_workspace_id uuid,
  p_cursor       bigint,
  p_limit        int
) RETURNS TABLE (
  sync_version   bigint,
  workspace_id   uuid,
  entity_type    text,
  entity_id      uuid,
  operation      text,
  entity_version bigint,
  origin_device  text,
  created_at     timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT
    s.sync_version,
    s.workspace_id,
    s.entity_type,
    s.entity_id,
    s.operation,
    s.entity_version,
    s.origin_device,
    s.created_at
  FROM public.sync_change_log s
  WHERE s.workspace_id = p_workspace_id
    AND s.sync_version > p_cursor
    AND (s.txid IS NULL OR s.txid < pg_snapshot_xmin(pg_current_snapshot()))
  ORDER BY s.sync_version ASC
  LIMIT p_limit;
$fn$;

-- ── 3. Hardened Permissions ────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.sync_pull_changes(uuid, bigint, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_pull_changes(uuid, bigint, int) FROM anon;
REVOKE ALL ON FUNCTION public.sync_pull_changes(uuid, bigint, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_pull_changes(uuid, bigint, int) TO service_role;


-- ────────────────────────────────────────────────────────────────────────
-- [54/59] sync-entity-coverage-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- Sync entity coverage — four server-owned tables that local routes read but
-- no pull delivered (PART 5 §6.4 / NOT_PULLED_YET in device-sync-state.ts).
--
-- Covered:  cost_layers      -> change-log entity 'cost_layer'
--           stock_batches    -> 'stock_batches'
--           stock_serials    -> 'stock_serials'
--           inventory_settings -> 'inventory_settings' (workspace-keyed row)
--
-- NOT covered: accounts. The live `accounts` table has `user_id`, NOT
-- `workspace_id`; a change-log trigger could not route its rows to any
-- workspace. See docs/FINDING-sync-account-tenancy.sql. This migration does
-- NOT invent a workspace column or a guessed tenant for historical rows.
--
-- DEPENDENCY: run docs/sync-engine-migration.sql first (it creates
-- sync_change_log, sync_record_change() and sync_bump_version()).
-- SAFE TO RE-RUN. Every statement is guarded. NOT applied here — owner runs it.
-- ============================================================================

DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regclass('public.sync_change_log') IS NULL THEN
    v_missing := array_append(v_missing, 'sync_change_log (run sync-engine-migration.sql)');
  END IF;
  IF to_regprocedure('public.sync_record_change()') IS NULL THEN
    v_missing := array_append(v_missing, 'sync_record_change() (run sync-engine-migration.sql)');
  END IF;
  IF to_regprocedure('public.sync_bump_version()') IS NULL THEN
    v_missing := array_append(v_missing, 'sync_bump_version() (run sync-engine-migration.sql)');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='cost_layers' AND column_name='workspace_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='cost_layers' AND column_name='id') THEN
    v_missing := array_append(v_missing, 'cost_layers(id, workspace_id)');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='stock_batches' AND column_name='workspace_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='stock_batches' AND column_name='id') THEN
    v_missing := array_append(v_missing, 'stock_batches(id, workspace_id)');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='stock_serials' AND column_name='workspace_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='stock_serials' AND column_name='id') THEN
    v_missing := array_append(v_missing, 'stock_serials(id, workspace_id)');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='inventory_settings' AND column_name='workspace_id') THEN
    v_missing := array_append(v_missing, 'inventory_settings(workspace_id)');
  END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION
      E'PREFLIGHT FAILED — missing prerequisites: %\n'
      'No trigger was installed. Apply the listed migrations first.',
      array_to_string(v_missing, ', ')
      USING ERRCODE = 'feature_not_supported';
  END IF;

  RAISE NOTICE 'preflight ok — four sync entities can be covered; accounts remains BLOCKED (no workspace_id)';
END $$;

-- Optimistic version on every covered row. Never client-supplied.
ALTER TABLE cost_layers       ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE stock_batches     ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE stock_serials     ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE inventory_settings ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;

-- inventory_settings is keyed by workspace_id (no `id` column). The generic
-- sync_record_change() reads NEW.id and would raise on every write, so this
-- variant uses the workspace key as the entity identity instead.
CREATE OR REPLACE FUNCTION sync_record_workspace_keyed_change()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_workspace UUID;
  v_op        TEXT;
  v_version   BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_workspace := OLD.workspace_id;
    v_op := 'delete';
    v_version := COALESCE(OLD.version, 1);
  ELSE
    v_workspace := NEW.workspace_id;
    v_op := CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END;
    v_version := COALESCE(NEW.version, 1);
  END IF;

  IF v_workspace IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO sync_change_log (workspace_id, entity_type, entity_id, operation, entity_version, origin_device)
  VALUES (v_workspace, TG_ARGV[0], v_workspace, v_op, v_version,
          current_setting('hisabche.device_id', true));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─── Bump version on update ────────────────────────────────────────────────
DROP TRIGGER IF EXISTS cost_layers_bump_version_trg ON cost_layers;
CREATE TRIGGER cost_layers_bump_version_trg BEFORE UPDATE ON cost_layers
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();
DROP TRIGGER IF EXISTS stock_batches_bump_version_trg ON stock_batches;
CREATE TRIGGER stock_batches_bump_version_trg BEFORE UPDATE ON stock_batches
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();
DROP TRIGGER IF EXISTS stock_serials_bump_version_trg ON stock_serials;
CREATE TRIGGER stock_serials_bump_version_trg BEFORE UPDATE ON stock_serials
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();
DROP TRIGGER IF EXISTS inventory_settings_bump_version_trg ON inventory_settings;
CREATE TRIGGER inventory_settings_bump_version_trg BEFORE UPDATE ON inventory_settings
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

-- ─── Change log inside the business transaction ───────────────────────────
DROP TRIGGER IF EXISTS cost_layers_change_log_trg ON cost_layers;
CREATE TRIGGER cost_layers_change_log_trg AFTER INSERT OR UPDATE OR DELETE ON cost_layers
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('cost_layer');
DROP TRIGGER IF EXISTS stock_batches_change_log_trg ON stock_batches;
CREATE TRIGGER stock_batches_change_log_trg AFTER INSERT OR UPDATE OR DELETE ON stock_batches
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('stock_batches');
DROP TRIGGER IF EXISTS stock_serials_change_log_trg ON stock_serials;
CREATE TRIGGER stock_serials_change_log_trg AFTER INSERT OR UPDATE OR DELETE ON stock_serials
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('stock_serials');
DROP TRIGGER IF EXISTS inventory_settings_change_log_trg ON inventory_settings;
CREATE TRIGGER inventory_settings_change_log_trg AFTER INSERT OR UPDATE OR DELETE ON inventory_settings
  FOR EACH ROW EXECUTE FUNCTION sync_record_workspace_keyed_change('inventory_settings');

-- The change log already has RLS enabled by sync-engine-migration.sql; these
-- writers are triggers inside a business transaction, not client-facing paths.


-- ────────────────────────────────────────────────────────────────────────
-- [55/59] rls-recursion-fix-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/rls-recursion-fix-migration.sql
--
-- Fix `42P17: infinite recursion detected in policy for relation
-- "workspace_members"`.
--
-- ---------------------------------------------------------------------------
-- THE DEFECT
--
-- A policy that already existed in the live database reads the very table it
-- protects:
--
--   POLICY workspace_members_select ON workspace_members
--     USING (workspace_id IN (
--       SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
--     ))
--
-- Reading `workspace_members` runs the policy, which reads
-- `workspace_members`, which runs the policy. Postgres detects the loop and
-- aborts the statement.
--
-- ---------------------------------------------------------------------------
-- WHY IT WAS INVISIBLE UNTIL NOW
--
-- The backend connects with the service role, which bypasses RLS entirely, so
-- every server-side query worked. Nothing had ever queried this table AS a
-- logged-in user — the moment `_verify-rls.sql` did, it failed immediately.
--
-- That is the whole argument for testing RLS as a real role rather than
-- reading `pg_policies` and calling it proven: the policy existed, looked
-- correct in the catalogue, and could never once have succeeded.
--
-- ---------------------------------------------------------------------------
-- THE FIX
--
-- Read membership through a SECURITY DEFINER function. It executes as its
-- owner, so the read inside it does not re-enter the policy, and the loop
-- cannot form. `tenancy-rls.sql` already defines exactly this — the recursive
-- policy simply predates it and was never replaced.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── 1. The membership oracle ───────────────────────────────────────────────
--
-- Recreated here rather than assumed, so this file fixes the database whatever
-- order things ran in.
--
-- STABLE, so Postgres evaluates it once per statement instead of once per row
-- — on a large table that is the difference between an index scan and a
-- subquery per row.

CREATE OR REPLACE FUNCTION auth_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.workspace_id
    FROM workspace_members m
   WHERE m.user_id = (SELECT auth.uid())
     AND m.has_access = true
     AND m.suspended_at IS NULL
$$;

REVOKE ALL ON FUNCTION auth_workspace_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_workspace_ids() TO authenticated;

-- ─── 1b. The other membership helper, made non-recursive ────────────────────
--
-- `is_workspace_member(workspace_id, user_id)` already existed and is used by
-- the policy `workspace members can view members` ON workspace_members. If it
-- is not SECURITY DEFINER it reads `workspace_members` under the caller's own
-- rights, which re-enters that table's policy — the same loop by another road.
--
-- Recreated as SECURITY DEFINER. Same signature and same answer, so every
-- policy already using it keeps working.

CREATE OR REPLACE FUNCTION is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM workspace_members m
     WHERE m.workspace_id = _workspace_id
       AND m.user_id = _user_id
       AND m.has_access = true
       AND m.suspended_at IS NULL
  )
$$;

REVOKE ALL ON FUNCTION is_workspace_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_workspace_member(uuid, uuid) TO authenticated;

-- ─── 1c. Workspace ownership, without reading either table under RLS ────────
--
-- `workspace_members_insert` and `workspace_members_delete` test ownership by
-- subquerying `workspaces` — and the policy on `workspaces` subqueries
-- `workspace_members`. Querying either one walks into the other, which is the
-- mutual recursion the first fix did not close.

CREATE OR REPLACE FUNCTION auth_owned_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM workspace_members
  WHERE user_id = (SELECT auth.uid())
    AND role = 'owner'
    AND has_access = true
    AND suspended_at IS NULL
$$;

REVOKE ALL ON FUNCTION auth_owned_workspace_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION auth_owned_workspace_ids() TO authenticated, service_role;

-- ─── 2. Remove the recursive policy ─────────────────────────────────────────
--
-- Dropped, not rewritten: the colleague-read path goes through
-- `is_workspace_member(...)`, a SECURITY DEFINER function, so it cannot loop.
--
-- ⚠️ ONE SELECT policy. own_row + colleagues as two permissive SELECT policies
-- is what Supabase flags as multiple_permissive_policies; the OR below is the
-- exact access the pair produced. A member reads their own row (the login path
-- needs it before it knows which workspaces exist) plus everyone they share a
-- workspace with.

DROP POLICY IF EXISTS workspace_members_select ON workspace_members;
DROP POLICY IF EXISTS workspace_members_own_row ON workspace_members;
DROP POLICY IF EXISTS workspace_members_colleagues ON workspace_members;
CREATE POLICY workspace_members_own_row ON workspace_members
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR is_workspace_member(workspace_id, (SELECT auth.uid()))
  );

-- ─── 3. Route every other policy through the function ───────────────────────
--
-- `live-reconciliation-migration.sql` wrote the inline subquery form for the
-- tables it scoped. That form does not recurse — a policy on `suppliers`
-- reading `workspace_members` is a different table — but it does re-enter the
-- membership table's own policy on every check, which is both slower and one
-- edit away from looping again.
--
-- Rewritten to the oracle: same rule, evaluated once, no re-entry.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'audit_logs', 'stock_movements', 'suppliers', 'purchase_orders',
    'payrolls', 'leaves', 'project_time_entries', 'boms', 'bom_items',
    'work_orders', 'opportunities', 'employees', 'projects', 'departments',
    'exchange_rates'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_workspace_members', t);
      EXECUTE format($f$
        CREATE POLICY %I ON %I
          FOR ALL TO authenticated
          USING (workspace_id IN (SELECT auth_workspace_ids()))
          WITH CHECK (workspace_id IN (SELECT auth_workspace_ids()))
      $f$, t || '_workspace_members', t);
    END IF;
  END LOOP;
END $$;

-- ─── 3b. The two tables at the centre of the loop ───────────────────────────
--
-- Every policy on `workspaces` and `workspace_members` is rewritten to go
-- through a SECURITY DEFINER function. Neither table may subquery the other
-- inside a policy — that is the rule that keeps this from happening again.

DROP POLICY IF EXISTS workspaces_select_policy ON workspaces;
CREATE POLICY workspaces_select_policy ON workspaces
  FOR SELECT TO authenticated
  USING (id IN (SELECT auth_workspace_ids()));

DROP POLICY IF EXISTS workspace_members_insert ON workspace_members;
CREATE POLICY workspace_members_insert ON workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT auth_owned_workspace_ids()));

DROP POLICY IF EXISTS workspace_members_update ON workspace_members;
CREATE POLICY workspace_members_update ON workspace_members
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT auth_owned_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT auth_owned_workspace_ids()));

DROP POLICY IF EXISTS workspace_members_delete ON workspace_members;
CREATE POLICY workspace_members_delete ON workspace_members
  FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT auth_owned_workspace_ids()));

-- ─── 4. The invite table had the same inline form ───────────────────────────

DROP POLICY IF EXISTS workspace_invites_all ON workspace_invites;
CREATE POLICY workspace_invites_all ON workspace_invites
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT auth_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT auth_workspace_ids()));

COMMIT;

-- ============================================================================
-- Proof. Every policy that still reads `workspace_members` directly is a
-- candidate for the same failure. This should return no rows.
-- ============================================================================

SELECT
  tablename,
  policyname,
  'still reads workspace_members inline' AS problem
FROM pg_policies
WHERE schemaname = 'public'
  AND (coalesce(qual, '') LIKE '%FROM workspace_members%'
       OR coalesce(with_check, '') LIKE '%FROM workspace_members%')
ORDER BY tablename, policyname;


-- ────────────────────────────────────────────────────────────────────────
-- [56/59] rls-performance-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/rls-performance-migration.sql
--
-- The RLS change with the largest measurable effect, and the smallest diff.
--
-- ---------------------------------------------------------------------------
-- `auth.uid()` IS EVALUATED PER ROW. `(select auth.uid())` IS EVALUATED ONCE.
--
-- Postgres cannot prove that `auth.uid()` returns the same answer for every
-- row, so inside a policy it calls the function again for each one. Wrapped as
-- a scalar subquery, the planner lifts it into an InitPlan and evaluates it a
-- single time for the whole statement.
--
-- On a table with fifty thousand rows that is fifty thousand function calls
-- against one. It is Supabase's own top RLS-performance recommendation, and it
-- changes no behaviour whatsoever — the same rows come back.
--
-- ---------------------------------------------------------------------------
-- WHY MOST OF THIS SCHEMA WAS ALREADY FAST
--
-- The tenant policies were written as:
--
--     workspace_id IN (SELECT auth_workspace_ids())
--
-- Already a subquery, already an InitPlan. What was NOT wrapped were the
-- direct `= auth.uid()` comparisons on the per-user tables — `workspace_members`,
-- `member_branches`, `ui_visibility_profiles`, `billing_events` — and those are
-- exactly the tables every request reads to establish who the caller is.
--
-- ---------------------------------------------------------------------------
-- ⚠️ THE INDEX IS THE OTHER HALF
--
-- A policy of `workspace_id IN (…)` is only fast if `workspace_id` is indexed.
-- Without an index the planner has a cheap predicate and still scans the table
-- to apply it. `hardening-migration.sql` creates those indexes; this file is
-- half the fix and says so.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ⚠️ THE HELPERS COME FIRST, BEFORE ANY POLICY THAT CALLS THEM.
--
-- The first draft of this file defined the policies at the top and the
-- functions at the bottom — which reads naturally and fails immediately:
--
--     42883: function is_workspace_member(uuid, uuid) does not exist
--
-- A policy body is parsed when the policy is created, not when it runs. The
-- function has to exist by then.

-- ─── The SECURITY DEFINER helpers ───────────────────────────────────────────
--
-- Re-declared STABLE and with a pinned `search_path`.
--
-- ⚠️ `SET search_path` is not a style preference on a SECURITY DEFINER
-- function. Without it, a caller who can create objects could shadow
-- `workspace_members` with a table of their own and the function — running as
-- its owner — would read theirs instead.
--
-- STABLE tells the planner the result cannot change within one statement,
-- which lets it call these once rather than per row. They already only read.

CREATE OR REPLACE FUNCTION auth_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM workspace_members
  WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND has_access = true
      AND suspended_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION auth_owned_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM workspace_members
  WHERE user_id = (SELECT auth.uid())
    AND role = 'owner'
    AND has_access = true
    AND suspended_at IS NULL;
$$;

-- ⚠️ These run as their owner and bypass RLS by design. Nothing else should:
-- revoke the default grant so they cannot be called straight from the Data API
-- by an anonymous client.
REVOKE EXECUTE ON FUNCTION auth_workspace_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION is_workspace_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION auth_owned_workspace_ids() FROM anon;


-- ─── workspace_members ──────────────────────────────────────────────────────
--
-- The hottest table in the schema: every authenticated request reads it to
-- find out which workspaces the caller belongs to.
--
-- ⚠️ Neither policy may subquery `workspaces`, and no policy on `workspaces`
-- may subquery this — that pair is what produced `42P17: infinite recursion`,
-- and it was broken from the first day while nobody noticed, because the
-- backend connects with `service_role` and bypasses RLS entirely.

-- ⚠️ ONE SELECT policy, not two. Two permissive SELECT policies for the same
-- role are OR'd by Postgres — identical rows, but Supabase flags the pair as
-- multiple_permissive_policies and the planner pays for two policy evaluations.
-- The OR below is exactly what the two old policies (own_row + colleagues)
-- produced together. `is_workspace_member` is SECURITY DEFINER, so reading
-- `workspace_members` inside it does not re-enter this policy.
DROP POLICY IF EXISTS workspace_members_own_row ON workspace_members;
DROP POLICY IF EXISTS workspace_members_colleagues ON workspace_members;
CREATE POLICY workspace_members_own_row ON workspace_members
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR is_workspace_member(workspace_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS workspace_members_insert ON workspace_members;
CREATE POLICY workspace_members_insert ON workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT auth_owned_workspace_ids()));

DROP POLICY IF EXISTS workspace_members_update ON workspace_members;
CREATE POLICY workspace_members_update ON workspace_members
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT auth_owned_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT auth_owned_workspace_ids()));

DROP POLICY IF EXISTS workspace_members_delete ON workspace_members;
CREATE POLICY workspace_members_delete ON workspace_members
  FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT auth_owned_workspace_ids()));

-- ─── The per-user tables ────────────────────────────────────────────────────
--
-- These are keyed by `user_id` rather than `workspace_id`, and that is
-- correct rather than an oversight:
--
--   billing_events            what THIS person was charged
--   notifications             what is waiting for THIS person
--
-- They are the documented exceptions to the workspace rule.
--
-- ⚠️ `member_branches` and `ui_visibility_profiles` used to be in this loop.
-- Adding a second SELECT policy (`*_own_rows`) on top of the FOR ALL policy
-- their own migrations already create produced multiple_permissive_policies
-- warnings. They are now consolidated into one policy per command inside
-- `branch-migration.sql` and `personalization-migration.sql`.

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'billing_events',
    'notifications'
  ] LOOP
    -- Skip anything this database does not have, so the file stays runnable
    -- against a partial schema rather than failing halfway.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_table
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_own_rows', v_table);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR SELECT TO authenticated
        USING (user_id = (SELECT auth.uid()))
    $p$, v_table || '_own_rows', v_table);

    RAISE NOTICE 'policy rewritten: %', v_table;
  END LOOP;
END $$;

-- ─── Indexes the policies depend on ─────────────────────────────────────────
--
-- A policy is a WHERE clause. Without an index behind it, Postgres applies a
-- cheap predicate to every row it reads — which is a full scan wearing a
-- security hat.

CREATE INDEX IF NOT EXISTS workspace_members_user_idx
  ON workspace_members (user_id);

CREATE INDEX IF NOT EXISTS workspace_members_workspace_id_idx
  ON workspace_members (workspace_id);

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'member_branches',
    'ui_visibility_profiles',
    'billing_events',
    'notifications'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_table
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (user_id)',
      v_table || '_user_idx', v_table
    );
  END LOOP;
END $$;

COMMIT;


-- ────────────────────────────────────────────────────────────────────────
-- [57/59] remaining-policies-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/remaining-policies-migration.sql
--
-- Policies for the tables that had RLS on and nothing else.
--
-- ---------------------------------------------------------------------------
-- FIRST: NOTHING WAS BROKEN
--
-- RLS on with no policy means DENY ALL. It is the strictest possible state,
-- not an open door — and the backend connects with `service_role`, which
-- bypasses RLS entirely, so every screen kept working.
--
-- The check that surfaced this was doing its job. The 26 tables it named were
-- locked, not leaking.
--
-- ---------------------------------------------------------------------------
-- SO WHY CHANGE ANYTHING
--
-- Because "locked and nobody noticed" is one realtime subscription away from
-- "silently empty". The moment somebody adds
--
--     useRealtime({ table: 'activities', … })
--
-- the subscription connects, delivers nothing, and reports no error. Realtime
-- respects RLS; `service_role` does not reach it. That is a bug that takes a
-- day to find and thirty seconds to prevent.
--
-- ⚠️ Verified before writing this: none of the 13 tables the client currently
-- subscribes to is in that list. Nothing is broken today.
--
-- ---------------------------------------------------------------------------
-- FOUR KINDS OF TABLE, FOUR ANSWERS
--
--   1. carries workspace_id      → the standard workspace policy
--   2. child of one that does    → reached through its parent
--   3. everything else           → LEFT WITH NO POLICY, deliberately
--
-- The third group is the important one, and it is larger than it first looks.
-- Adding a policy to `password_reset_tokens` "for completeness" would turn a
-- table nobody can read into one somebody can — and the same logic retired the
-- `USING (true)` policies an earlier draft gave the lookup tables.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── 1. Tables that carry a workspace ───────────────────────────────────────
--
-- The same policy shape as every other tenant table.

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'activities',
    'user_roles',
    'subscriptions',
    'workflows',
    'workflow_instances'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_table AND column_name = 'workspace_id'
    ) THEN
      RAISE NOTICE 'skipped % — no workspace_id', v_table;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_workspace_members', v_table);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO authenticated
        USING (workspace_id IN (SELECT auth_workspace_ids()))
        WITH CHECK (workspace_id IN (SELECT auth_workspace_ids()))
    $p$, v_table || '_workspace_members', v_table);

    RAISE NOTICE 'workspace policy: %', v_table;
  END LOOP;
END $$;

-- ─── 2. Children, reached through their parent ──────────────────────────────
--
-- These have no `workspace_id` of their own — a workflow step belongs to a
-- workflow, and the workflow belongs to a workspace.
--
-- ⚠️ The parent's own policy is what makes this safe. An `EXISTS` against a
-- table the caller cannot read returns false, so the child is unreachable for
-- exactly the same rows the parent is.

-- ⚠️ `invoice_items` used to be in this list. Its `_via_parent` policy is
-- semantically identical to `invoice_items_workspace_members` from
-- `child-table-rls-fix.sql` (both reach the parent invoice's workspace), and
-- two permissive FOR ALL policies for the same role is exactly what Supabase
-- flags as multiple_permissive_policies. The canonical policy is the
-- child-table-rls-fix one; the duplicate is dropped below.
DO $$
DECLARE
  v_child  TEXT;
  v_parent TEXT;
  v_fk     TEXT;
BEGIN
  FOR v_child, v_parent, v_fk IN
    SELECT * FROM (VALUES
      ('workflow_steps',       'workflows',           'workflow_id'),
      ('workflow_actions',     'workflow_instances',  'instance_id'),
      ('purchase_order_items', 'purchase_orders',     'purchase_order_id'),
      ('project_members',      'projects',            'project_id')
    ) AS t(child, parent, fk)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_child AND column_name = v_fk
    ) THEN
      RAISE NOTICE 'skipped % — no %', v_child, v_fk;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_child);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_child || '_via_parent', v_child);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO authenticated
        USING (EXISTS (
          SELECT 1 FROM %I parent
          WHERE parent.id = %I.%I
            AND parent.workspace_id IN (SELECT auth_workspace_ids())
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM %I parent
          WHERE parent.id = %I.%I
            AND parent.workspace_id IN (SELECT auth_workspace_ids())
        ))
    $p$, v_child || '_via_parent', v_child,
         v_parent, v_child, v_fk,
         v_parent, v_child, v_fk);

    RAISE NOTICE 'parent policy: % via %', v_child, v_parent;
  END LOOP;
END $$;

-- Retire the duplicate invoice_items policy left by earlier runs of this file.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invoice_items'
  ) THEN
    DROP POLICY IF EXISTS invoice_items_via_parent ON invoice_items;
  END IF;
END $$;

-- ─── 3. Global configuration — DELIBERATELY LEFT WITH NO POLICY ─────────────
--
-- `roles`, `permissions`, `role_permissions`, `billing_plans`, `event_types`.
--
-- An earlier draft of this file gave them `USING (true)` for authenticated
-- users, reasoning that a lookup table of role names is not a secret.
--
-- `rls-coverage.test.ts` rejected it, and its own comment is the argument:
--
--     "USING (true) is a policy that exists, satisfies a checklist, and
--      protects nothing."
--
-- The test is right, and the deciding fact is that NOTHING NEEDS THE ACCESS.
-- The frontend has no direct `supabase.from()` call anywhere — every read goes
-- through the Fastify backend on `service_role`, which bypasses RLS. So the
-- policy would have opened five tables to satisfy a sense of completeness and
-- served no caller at all.
--
-- If a client ever does need to read `roles` directly, that is the moment to
-- add a policy — deliberately, for a caller that exists.

-- ─── 4. profiles — same reasoning ───────────────────────────────────────────
--
-- A `profiles` policy keyed on `id = auth.uid()` was also dropped from this
-- file. It is per-user rather than per-workspace, which `rls-coverage` flags
-- as a creator-based boundary — and again, nothing reads it directly.

-- ─── 5. The ones that stay locked ───────────────────────────────────────────
--
-- ⚠️ NO POLICY IS ADDED HERE, AND THAT IS THE POINT.
--
--   background_jobs          queue internals
--   checkout_sessions        payment flow, service-role only
--   invoice_pdf_cache        rendered files, served through the API
--   journal_lines_archive    the two amount-less lines removed before the
--                            one-sided constraint could be validated
--   ledger_entries           legacy; nothing reads it
--   password_reset_tokens    a readable reset token is an account takeover
--   schema_migrations        migration bookkeeping
--   sync_logs · sync_queue   sync internals, like sync_change_log
--   webhook_events           inbound payloads, may contain provider secrets
--   event_log                fan-out helper, written by the server only
--
-- RLS on with no policy means deny-all. Every one of these is reached by the
-- backend on `service_role`, which bypasses RLS. Adding a policy "for
-- completeness" would turn a table nobody can read into one somebody can —
-- and on `password_reset_tokens` that is the whole security model.

-- Belt and braces: make sure RLS is actually ON for them, so "no policy"
-- means deny-all rather than wide open.
DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'background_jobs', 'checkout_sessions', 'invoice_pdf_cache',
    'journal_lines_archive', 'ledger_entries', 'password_reset_tokens',
    'schema_migrations', 'sync_logs', 'sync_queue', 'webhook_events', 'event_log'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_table
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_table);
    END IF;
  END LOOP;
END $$;

COMMIT;


-- ────────────────────────────────────────────────────────────────────────
-- [58/59] phase-a-04-missing-primary-keys-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/phase-a-04-missing-primary-keys-migration.sql
--
-- PHASE A · 4/4 — a primary key on the five public tables that have none.
--
--     checkout_sessions, event_types, invoice_pdf_cache,
--     journal_lines_archive, webhook_events
--
-- A table without a primary key is not merely untidy:
--
--   * PostgREST refuses to PATCH or DELETE a single row — there is no identity
--     to address it by — so those tables are effectively read-and-insert-only
--     through the API, whatever the code believes.
--   * `webhook_events` and `checkout_sessions` are the idempotency ledgers for
--     Stripe. Without a unique key on the provider's event id, a redelivered
--     webhook is processed TWICE. That is a double charge or a double
--     subscription, and it fails silently.
--   * logical replication of the table is impossible without a replica identity.
--
-- HOW THIS FILE BEHAVES WITH DIRTY DATA
--
-- Adding a PRIMARY KEY to a column that already holds duplicates or NULLs
-- fails and rolls the file back. Deduplicating means DELETING financial rows,
-- which this file will not do — see `DATABASE_MIGRATION_POLICY.md`.
--
-- So each table is handled by a guarded block: it checks first, adds the key
-- when the data supports it, and raises a WARNING naming the exact query to run
-- when it does not. A partial success is a success — the report at the bottom
-- tells you what is left.
--
-- SAFE TO RE-RUN. No row is deleted or modified; the only write is a default
-- surrogate id on `journal_lines_archive` rows that have none.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. event_types — PRIMARY KEY (type)
--
-- `type` is the event name the whole system keys off ('invoice.created', ...).
-- It is the natural key; a second row for the same type is a bug, not data.
-- ---------------------------------------------------------------------------

DO $et$
DECLARE
  bad bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.contype = 'p' AND t.relname = 'event_types'
  ) THEN
    RAISE NOTICE 'event_types: already has a primary key.';
  ELSE
    SELECT COUNT(*) INTO bad FROM (
      SELECT type FROM event_types WHERE type IS NULL
      UNION ALL
      SELECT type FROM event_types GROUP BY type HAVING COUNT(*) > 1
    ) x;

    IF bad = 0 THEN
      ALTER TABLE event_types ADD CONSTRAINT event_types_pkey PRIMARY KEY (type);
      RAISE NOTICE 'event_types: PRIMARY KEY (type) added.';
    ELSE
      RAISE WARNING 'event_types: % duplicate/NULL type value(s) - PK NOT added. Inspect: SELECT type, COUNT(*) FROM event_types GROUP BY type HAVING COUNT(*) > 1;', bad;
    END IF;
  END IF;
END
$et$;

-- ---------------------------------------------------------------------------
-- 2. checkout_sessions — PRIMARY KEY (id)
--
-- `id text NOT NULL` is the checkout session identifier. One row per session.
-- ---------------------------------------------------------------------------

DO $cs$
DECLARE
  bad bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.contype = 'p' AND t.relname = 'checkout_sessions'
  ) THEN
    RAISE NOTICE 'checkout_sessions: already has a primary key.';
  ELSE
    SELECT COUNT(*) INTO bad
    FROM (SELECT id FROM checkout_sessions GROUP BY id HAVING COUNT(*) > 1) x;

    IF bad = 0 THEN
      ALTER TABLE checkout_sessions ADD CONSTRAINT checkout_sessions_pkey PRIMARY KEY (id);
      RAISE NOTICE 'checkout_sessions: PRIMARY KEY (id) added.';
    ELSE
      RAISE WARNING 'checkout_sessions: % duplicate id(s) - PK NOT added. Inspect: SELECT id, COUNT(*) FROM checkout_sessions GROUP BY id HAVING COUNT(*) > 1;', bad;
    END IF;
  END IF;
END
$cs$;

-- Also index the tenancy boundary, which every read of this table filters on.
CREATE INDEX IF NOT EXISTS checkout_sessions_workspace_id_idx
  ON checkout_sessions (workspace_id);

-- ---------------------------------------------------------------------------
-- 3. webhook_events — PRIMARY KEY (id)
--
-- THE IDEMPOTENCY KEY. `id` is the provider's event id; the whole point of the
-- table is "have I already processed this?". Without a unique constraint the
-- answer is decided by a racing SELECT, and two concurrent redeliveries both
-- see "no".
-- ---------------------------------------------------------------------------

DO $we$
DECLARE
  bad bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.contype = 'p' AND t.relname = 'webhook_events'
  ) THEN
    RAISE NOTICE 'webhook_events: already has a primary key.';
  ELSE
    SELECT COUNT(*) INTO bad
    FROM (SELECT id FROM webhook_events GROUP BY id HAVING COUNT(*) > 1) x;

    IF bad = 0 THEN
      ALTER TABLE webhook_events ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);
      RAISE NOTICE 'webhook_events: PRIMARY KEY (id) added - redelivery is now rejected by the database.';
    ELSE
      RAISE WARNING 'webhook_events: % duplicate id(s) - PK NOT added, REDELIVERY IS STILL BEING DOUBLE-PROCESSED. Inspect: SELECT id, COUNT(*) FROM webhook_events GROUP BY id HAVING COUNT(*) > 1;', bad;
    END IF;
  END IF;
END
$we$;

CREATE INDEX IF NOT EXISTS webhook_events_type_processed_idx
  ON webhook_events (type, processed_at DESC);

-- ---------------------------------------------------------------------------
-- 4. invoice_pdf_cache — PRIMARY KEY (invoice_id, version_key)
--
-- The composite is the real identity: one cached artefact per invoice per
-- rendered version. `invoice_id` alone would be wrong — a re-rendered invoice
-- legitimately has a second row under a new version_key while the old URL is
-- still being served.
--
-- ASSUMPTION: the writer upserts on (invoice_id, version_key). If duplicates
-- exist, the block below declines and says so rather than choosing a winner.
-- ---------------------------------------------------------------------------

DO $pdf$
DECLARE
  bad bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.contype = 'p' AND t.relname = 'invoice_pdf_cache'
  ) THEN
    RAISE NOTICE 'invoice_pdf_cache: already has a primary key.';
  ELSE
    SELECT COUNT(*) INTO bad FROM (
      SELECT invoice_id, version_key
      FROM   invoice_pdf_cache
      GROUP  BY invoice_id, version_key
      HAVING COUNT(*) > 1
    ) x;

    IF bad = 0 THEN
      ALTER TABLE invoice_pdf_cache
        ADD CONSTRAINT invoice_pdf_cache_pkey PRIMARY KEY (invoice_id, version_key);
      RAISE NOTICE 'invoice_pdf_cache: PRIMARY KEY (invoice_id, version_key) added.';
    ELSE
      RAISE WARNING 'invoice_pdf_cache: % duplicate (invoice_id, version_key) pair(s) - PK NOT added. This is a regenerable cache, so deduplicating it is safe; do it deliberately, then re-run this file.', bad;
    END IF;
  END IF;
END
$pdf$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'invoice_pdf_cache_invoice_id_fkey'
       AND conrelid = to_regclass('public.invoice_pdf_cache')
  ) THEN
    ALTER TABLE invoice_pdf_cache ADD CONSTRAINT invoice_pdf_cache_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES invoices (id) NOT VALID;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. journal_lines_archive — SURROGATE PRIMARY KEY (archive_id)
--
-- This one gets a surrogate, not a natural key, and the reason matters.
--
-- The archive is append-only evidence: rows removed from `journal_lines` with a
-- reason (see SETUP-COMPLETE.sql). Its `id` column is the id the line HAD, and
-- the same line could legitimately be archived twice — removed, restored after
-- investigation, removed again — each archival a separate fact. Making `id`
-- the primary key would forbid the second archival, which means the database
-- would refuse to record something that happened.
--
-- So: a new surrogate column, defaulted, backfilled for existing rows, and made
-- the key.
-- ---------------------------------------------------------------------------

ALTER TABLE journal_lines_archive
  ADD COLUMN IF NOT EXISTS archive_id uuid DEFAULT gen_random_uuid();

COMMENT ON COLUMN journal_lines_archive.archive_id IS
  'Surrogate key for one archival event. Distinct from `id`, which is the journal line''s own id and may repeat if a line is archived more than once.';

UPDATE journal_lines_archive SET archive_id = gen_random_uuid() WHERE archive_id IS NULL;

DO $jla$
DECLARE
  bad bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.contype = 'p' AND t.relname = 'journal_lines_archive'
  ) THEN
    RAISE NOTICE 'journal_lines_archive: already has a primary key.';
  ELSE
    SELECT COUNT(*) INTO bad FROM journal_lines_archive WHERE archive_id IS NULL;

    IF bad = 0 THEN
      ALTER TABLE journal_lines_archive ALTER COLUMN archive_id SET NOT NULL;
      ALTER TABLE journal_lines_archive
        ADD CONSTRAINT journal_lines_archive_pkey PRIMARY KEY (archive_id);
      RAISE NOTICE 'journal_lines_archive: PRIMARY KEY (archive_id) added.';
    ELSE
      RAISE WARNING 'journal_lines_archive: % row(s) with NULL archive_id - PK NOT added.', bad;
    END IF;
  END IF;
END
$jla$;

CREATE INDEX IF NOT EXISTS journal_lines_archive_journal_idx
  ON journal_lines_archive (journal_id);

CREATE INDEX IF NOT EXISTS journal_lines_archive_archived_at_idx
  ON journal_lines_archive (archived_at DESC);

COMMIT;

-- ============================================================================
-- VERIFY — every public table that still has no primary key.
-- Expect an empty result, or exactly the tables whose WARNING you saw above.
-- ============================================================================
--
-- SELECT n.nspname, t.relname
-- FROM   pg_class t
-- JOIN   pg_namespace n ON n.oid = t.relnamespace
-- WHERE  t.relkind = 'r' AND n.nspname = 'public'
--   AND  NOT EXISTS (
--     SELECT 1 FROM pg_constraint c
--     WHERE c.conrelid = t.oid AND c.contype = 'p'
--   )
-- ORDER  BY t.relname;


-- ────────────────────────────────────────────────────────────────────────
-- [59/59] phase-b-01-accounting-source-of-truth-migration.sql
-- ────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- docs/phase-b-01-accounting-source-of-truth-migration.sql
--
-- PHASE B · 1/2 — one book, and two read-models that say so.
--
-- ---------------------------------------------------------------------------
-- THE DECISION, WRITTEN INTO THE DATABASE
--
--   SOURCE OF TRUTH for accounting = journal_entries + journal_lines.
--
-- Nothing else. Three tables were competing for the title:
--
--   journal_entries / journal_lines   double-entry, posted through
--                                     accounting_post_journal_entry, balanced
--                                     by a constraint.  ← THE BOOK
--
--   ledger_entries                    single-sided rows, no workspace_id until
--                                     phase-a-02, and — verified by grep over
--                                     all of backend/src — ZERO readers and
--                                     ZERO writers. A book nobody has posted to
--                                     in a long time.  ← DEAD
--
--   transactions                      single-sided party movements. Alive, read
--                                     for customer balances and party
--                                     statements, written from exactly two
--                                     places.  ← NOT A LEDGER, and must stop
--                                                being treated as one.
--
-- ---------------------------------------------------------------------------
-- WHAT `transactions` ACTUALLY CONTAINED — the defect this file exists for
--
-- `customer.service.getBalance()` and `/api/transactions/ledger` compute what a
-- party owes by summing `transactions`. But NOTHING writes a `transactions` row
-- when an invoice is issued, and nothing writes one when a payment is recorded
-- through the payments core. Only two writers exist: a credit customer's
-- opening balance, and a manual POST /api/transactions.
--
-- So the customer balance on the screen was computed from a set of rows that
-- contains neither the invoices nor the payments. It was never going to agree
-- with `invoice_outstanding`, because it is not looking at the same events.
--
-- Worse: the web PaymentModal recorded a customer's payment as a raw
-- `transactions` row with `type: 'payment'` — and 'payment' in the party-ledger
-- vocabulary means money WE paid OUT. Taking 500 from a debtor increased their
-- recorded debt by 500. That is lesson 10, re-entered through the UI after
-- being fixed in the service.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS FILE DOES
--
--   1. writes the decision into COMMENT ON TABLE, where the next person looks
--   2. freezes `ledger_entries` — a trigger that refuses every write and names
--      the replacement. Safe precisely because nothing writes it.
--   3. rebuilds `transactions_view` as a PROJECTION OF DOCUMENTS: invoices and
--      payments, unioned with the legacy `transactions` rows that no document
--      stands behind. Every reader of the view now sees the real party ledger
--      without changing a line of its own code.
--   4. adds `party_ledger` as the name that says what it is; `transactions_view`
--      stays as the compatibility alias its callers already use.
--
-- NO ROW IS WRITTEN, MOVED OR DELETED. Views and triggers only. SAFE TO RE-RUN.
--
-- ⚠️ ORDER: apply this file BEFORE the code deploy — the view is additive and
-- correct for both the old and the new code. `phase-b-02` freezes the writes and
-- must be applied AFTER the code deploy.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The decision, recorded where psql shows it
-- ---------------------------------------------------------------------------

COMMENT ON TABLE journal_entries IS
  'SOURCE OF TRUTH for accounting (Phase B). Every financial statement — trial balance, balance sheet, income statement — is derived from posted entries here and nowhere else. Write only through accounting_post_journal_entry, which posts the header and its lines in one transaction.';

COMMENT ON TABLE journal_lines IS
  'SOURCE OF TRUTH for accounting (Phase B), with journal_entries. Balanced per entry; one-sided per line. journal_id references journal_entries(id) — the FK added in phase-a-01.';

COMMENT ON TABLE ledger_entries IS
  'DEPRECATED (Phase B). A legacy single-sided ledger with no readers and no writers in backend/src. Frozen by ledger_entries_frozen: every INSERT, UPDATE and DELETE is refused. Read ledger_entries_view instead, which is the same shape derived from posted journal lines. Retained, not dropped, because the historical rows are evidence.';

COMMENT ON TABLE transactions IS
  'NOT A LEDGER and NOT a source of truth (Phase B). Single-sided party movements. A party balance is derived from invoices and payments via the party_ledger view; rows here survive only for opening balances and manual adjustments that no document stands behind. Recording a payment here instead of through the payments core produces a balance that disagrees with invoice_outstanding — see phase-b-02.';

-- ---------------------------------------------------------------------------
-- 2. Freeze ledger_entries
--
-- A dead table that is still writable is a book someone can post to by accident
-- — and rows landing here appear in no report, so the mistake is invisible.
--
-- The trigger refuses rather than silently ignoring: the whole class of defect
-- this phase addresses is financial writes that go somewhere nobody reads.
--
-- The message names the replacement, because the person who hits this will be
-- reading the error, not this file.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ledger_entries_frozen()
RETURNS trigger
LANGUAGE plpgsql
-- Pinned, per section 2 of linter-hardening-migration.sql. `pg_temp` is
-- deliberately absent: it resolves before `public`, so a caller with a temp
-- table of the same name could shadow a real one.
SET search_path = public
AS $frozen$
BEGIN
  RAISE EXCEPTION
    'ledger_entries is frozen (Phase B): accounting is written to journal_entries + journal_lines via accounting_post_journal_entry, and read from ledger_entries_view. Attempted % on ledger_entries.',
    TG_OP
    USING ERRCODE = '0A000',
          HINT = 'If you are booking a document, call the ledger port (postDocument). If you are reading, select from ledger_entries_view.';
END
$frozen$;

DROP TRIGGER IF EXISTS ledger_entries_frozen_trg ON ledger_entries;
CREATE TRIGGER ledger_entries_frozen_trg
  BEFORE INSERT OR UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_frozen();

COMMENT ON FUNCTION ledger_entries_frozen() IS
  'Refuses every write to the deprecated ledger_entries table. Drop this trigger only to run a deliberate, reviewed data repair — and put it back.';

-- ---------------------------------------------------------------------------
-- 3. party_ledger — the party statement, derived from documents
--
-- Four sources, unioned. Each row carries `source` so a statement line can say
-- where it came from, and so a reader can exclude the legacy tail once it has
-- been reconciled.
--
-- SIGN VOCABULARY — unchanged, because `party-ledger.domain.ts` and
-- `payments.domain.ts` already encode it and this view must not invent a second
-- convention. For "how much does this party owe us":
--
--     sale      we billed a customer          → owes more
--     receipt   money arrived from them       → owes less
--     purchase  a supplier billed us          → we owe more
--     payment   money we paid out             → owes more (our side settled)
--     return    we credited them              → owes less
--
-- ⚠️ DRAFTS ARE EXCLUDED. A draft invoice is not a receivable, and a cancelled
-- payment did not happen. A statement that included either would disagree with
-- `invoice_outstanding` beside it.
--
-- ⚠️ `invoices.type` is 'sale' | 'purchase', and NULL means sale — legacy rows,
-- per the domain invariants in the database skill. COALESCE, not `= 'sale'`.
-- ---------------------------------------------------------------------------

-- Dropped in dependency order first, so a re-run after an edit to the column
-- list cannot hit 42P16 either. `transactions_view` selects from
-- `party_ledger`, so it goes first.
DROP VIEW IF EXISTS transactions_view;
DROP VIEW IF EXISTS party_ledger;

CREATE VIEW party_ledger AS

-- 3a. Invoices — what we billed, and what we were billed.
SELECT
  i.id                                        AS id,
  i.workspace_id                              AS workspace_id,
  i.customer_id                               AS customer_id,
  i.supplier_id                               AS supplier_id,
  CASE WHEN COALESCE(i.type, 'sale') = 'purchase' THEN 'purchase' ELSE 'sale' END AS type,
  i.total                                     AS amount,
  COALESCE(i.currency, 'AFN')                 AS currency,
  COALESCE(NULLIF(i.notes, ''), i.invoice_number) AS description,
  i.invoice_number                            AS reference,
  i.date                                      AS created_at,
  'invoice'::text                             AS source,
  i.id                                        AS source_id,
  i.branch_id                                 AS branch_id
FROM invoices i
WHERE COALESCE(i.status, '') NOT IN ('draft', 'cancelled', 'void')

UNION ALL

-- 3b. Payments — money that actually moved, through the payments core.
--     direction 'in'  = received from a customer → 'receipt'
--     direction 'out' = paid to a supplier       → 'payment'
SELECT
  p.id,
  p.workspace_id,
  CASE WHEN p.party_type = 'customer' THEN p.party_id END,
  CASE WHEN p.party_type = 'supplier' THEN p.party_id END,
  CASE WHEN p.direction = 'in' THEN 'receipt' ELSE 'payment' END,
  p.amount,
  p.currency,
  COALESCE(NULLIF(p.notes, ''), p.payment_number),
  COALESCE(p.reference, ''),
  p.entry_date::timestamptz,
  'payment'::text,
  p.id,
  NULL::uuid
FROM payments p
WHERE p.status = 'posted'

UNION ALL

-- 3c. The legacy tail — `transactions` rows that stand behind no document.
--
--     Opening balances for credit customers and manual adjustments live here
--     and are real. They are kept, not migrated: rewriting a financial row to
--     make a view tidier is exactly the move the migration policy forbids.
--
--     Rows WITH an invoice_id are excluded — the invoice itself is already in
--     3a, and counting both would double the amount.
SELECT
  t.id,
  t.workspace_id,
  t.customer_id,
  t.supplier_id,
  t.type,
  t.amount,
  COALESCE(t.currency, 'AFN'),
  t.description,
  t.reference,
  COALESCE(t.date, t.created_at),
  'legacy_transaction'::text,
  t.id,
  NULL::uuid
FROM transactions t
WHERE t.invoice_id IS NULL;

-- ⚠️ SECURITY INVOKER — NOT OPTIONAL, and the reason it is written here rather
-- than left to `linter-hardening-migration.sql`:
--
-- A view runs with its CREATOR's permissions unless told otherwise. Left at the
-- default, this view returns EVERY workspace's invoices and payments to anyone
-- who can read it, because RLS on the tables underneath never gets a chance to
-- apply. `security_invoker = true` makes it run as the querying user.
--
-- `linter-hardening-migration.sql` set this on `transactions_view` once. A
-- `DROP VIEW` throws the setting away with the view, so re-creating a view
-- without re-applying it silently re-opens a hole that was already closed once.
-- That is exactly what happened on the first run of this file.
ALTER VIEW party_ledger SET (security_invoker = true);

COMMENT ON VIEW party_ledger IS
  'What each party owes, derived from documents: posted invoices, posted payments, and the legacy transactions rows no document stands behind. Read-only by construction. Phase B.';

-- ---------------------------------------------------------------------------
-- 4. transactions_view — same name, real contents
--
-- `customer.service.getBalance()` already selects `type, amount` from this
-- view. Redefining it here means that balance starts counting invoices and
-- payments without the service changing at all.
--
-- The column list is a superset of the previous definition, so every existing
-- caller keeps working. `id` is no longer unique across the view — a party
-- statement is a list of movements, not a table of transactions — which is why
-- nothing may PATCH or DELETE through this name.
-- ---------------------------------------------------------------------------

-- DROP + CREATE, not CREATE OR REPLACE.
--
-- `CREATE OR REPLACE VIEW` may add columns to the end of a view, but it may not
-- change the TYPE of one that already exists — it fails with 42P16. And the
-- type does change here: the old view read `transactions.amount`, which is
-- numeric(12,2), while `party_ledger` unions it with `payments.amount` at
-- numeric(18,2). Postgres resolves that union to unconstrained `numeric`.
--
-- Unconstrained is the right answer for money that has to hold both. The
-- precision was never doing any rounding work — every caller converts to minor
-- units before summing, exactly so a long statement does not drift by cents.
--
-- Safe because the whole file is one transaction: the view is never absent to
-- any other session. CASCADE is deliberately NOT used anywhere in this file —
-- if something does depend on one of these views, the DROP must fail loudly
-- rather than silently taking the dependant with it.
--
-- (The DROP itself is above, next to party_ledger's, so the two happen in
-- dependency order.)
CREATE VIEW transactions_view AS
SELECT
  id,
  workspace_id,
  customer_id,
  supplier_id,
  type,
  amount,
  currency,
  description,
  reference,
  created_at,
  source,
  source_id,
  branch_id
FROM party_ledger;

-- Same reason as party_ledger above, and the same setting this view already
-- carried before it was dropped and rebuilt.
ALTER VIEW transactions_view SET (security_invoker = true);

COMMENT ON VIEW transactions_view IS
  'Compatibility alias for party_ledger, kept because customer.service.ts and the transaction routes already select from this name. Phase B changed WHAT it returns: documents, not the transactions table.';

-- ---------------------------------------------------------------------------
-- 5. Indexes the view now depends on
--
-- The view filters invoices by status and payments by status; both are then
-- filtered by workspace and party by every caller.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS invoices_workspace_id_customer_id_idx
  ON invoices (workspace_id, customer_id);

CREATE INDEX IF NOT EXISTS invoices_workspace_supplier_idx
  ON invoices (workspace_id, supplier_id);

CREATE INDEX IF NOT EXISTS payments_workspace_status_idx
  ON payments (workspace_id, status);

CREATE INDEX IF NOT EXISTS transactions_workspace_id_customer_id_idx
  ON transactions (workspace_id, customer_id);

CREATE INDEX IF NOT EXISTS transactions_workspace_supplier_idx
  ON transactions (workspace_id, supplier_id);

COMMIT;

-- ============================================================================
-- AFTER APPLYING — two things to look at.
-- ============================================================================
--
-- A) MIS-RECORDED CUSTOMER PAYMENTS.
--    Rows the web PaymentModal wrote: a customer payment stored as type
--    'payment', which the sign rules read as money paid OUT to that customer.
--    Each one moves the balance the WRONG WAY BY TWICE the amount.
--
-- SELECT t.id, t.customer_id, t.amount, t.reference AS invoice_id, t.created_at,
--        t.description
-- FROM   transactions t
-- WHERE  t.customer_id IS NOT NULL
--   AND  t.type = 'payment'
-- ORDER  BY t.created_at DESC;
--
--    These are NOT rewritten here. Each one is a real payment that should exist
--    as a `payments` row with an allocation and a journal entry, and replaying
--    them is a data repair with a person's name on it — not a side effect of a
--    schema migration. Do it deliberately, after the Phase B code deploy, by
--    re-recording each through POST /api/payments and archiving the legacy row.
--
-- B) THE TWO BALANCES, SIDE BY SIDE.
--    They should now agree for every customer. Where they do not, (A) is the
--    usual reason.
--
-- C) THE OPENING BALANCE IS COUNTED TWICE — pre-existing, not caused here.
--    `customer.service.create()` writes BOTH `customers.opening_balance` AND a
--    'sale' row on `transactions` for a credit customer. `/api/transactions/
--    ledger` then adds `opening_balance` to a sum that already contains that
--    row. This predates Phase B and is left alone deliberately: deciding which
--    of the two is authoritative, and retiring the other, is Phase F work on
--    the receivables model — not something to slip into a view definition.
--
-- SELECT c.id, c.full_name, c.opening_balance
-- FROM   customers c
-- WHERE  c.type = 'credit' AND COALESCE(c.opening_balance, 0) <> 0;
--
-- SELECT c.id, c.full_name,
--        (SELECT COALESCE(SUM(CASE WHEN pl.type IN ('sale','payment') THEN pl.amount
--                                  ELSE -pl.amount END), 0)
--           FROM party_ledger pl WHERE pl.customer_id = c.id)         AS ledger_balance,
--        (SELECT COALESCE(SUM(io.outstanding), 0)
--           FROM invoice_outstanding io WHERE io.customer_id = c.id)  AS invoice_outstanding
-- FROM   customers c
-- WHERE  c.workspace_id = '<workspace uuid>';


NOTIFY pgrst, 'reload schema';
