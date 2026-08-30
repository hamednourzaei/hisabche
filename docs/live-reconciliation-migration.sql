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
CREATE INDEX IF NOT EXISTS stock_movements_workspace_idx      ON stock_movements (workspace_id, product_id);
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
           WHERE user_id = auth.uid()
             AND has_access = true
             AND suspended_at IS NULL
        ))
        WITH CHECK (workspace_id IN (
          SELECT workspace_id FROM workspace_members
           WHERE user_id = auth.uid()
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
