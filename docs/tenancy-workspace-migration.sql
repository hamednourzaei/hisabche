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
CREATE INDEX IF NOT EXISTS invoices_workspace_idx     ON invoices     (workspace_id);
CREATE INDEX IF NOT EXISTS customers_workspace_idx    ON customers    (workspace_id);
CREATE INDEX IF NOT EXISTS products_workspace_idx     ON products     (workspace_id);
CREATE INDEX IF NOT EXISTS transactions_workspace_idx ON transactions (workspace_id);

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
ALTER TABLE invoices     VALIDATE CONSTRAINT invoices_workspace_fk;
ALTER TABLE customers    VALIDATE CONSTRAINT customers_workspace_fk;
ALTER TABLE products     VALIDATE CONSTRAINT products_workspace_fk;
ALTER TABLE transactions VALIDATE CONSTRAINT transactions_workspace_fk;

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
