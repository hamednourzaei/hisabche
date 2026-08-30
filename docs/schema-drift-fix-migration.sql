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
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
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
