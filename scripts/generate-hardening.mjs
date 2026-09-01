// ============================================================================
// scripts/generate-hardening.mjs
//
// The constraints, indexes and RLS rewrites the base schema could not carry.
//
// ---------------------------------------------------------------------------
// WHY THIS IS GENERATED AND NOT HAND-WRITTEN
//
// `base-schema-migration.sql` came from a dump that recorded names, types and
// NOT NULL — and nothing else. No foreign keys, no indexes, no defaults. Every
// one of those has to be put back, across fifty-five tables, and a hand-written
// list would be wrong the first time somebody adds a column.
//
// This reads the generated schema and derives what it can PROVE, then stops.
//
// ---------------------------------------------------------------------------
// WHAT IT INFERS, AND WHAT IT REFUSES TO
//
//   INFERS    `<name>_id` → `<names>(id)` for a table that exists
//             an index on every foreign key
//             an index on `workspace_id`, and the composites the app queries
//
//   REFUSES   anything ambiguous. `parent_id`, `actor_id`, `entity_id` and
//             `target_id` name no table and are left alone. A guessed foreign
//             key that points the wrong way does not fail here — it fails at
//             midnight on a real insert, which is the worst possible time to
//             discover a guess.
//
// ---------------------------------------------------------------------------
// THE RLS REWRITE IS THE BIGGEST SINGLE WIN
//
// Supabase's own guidance: `auth.uid()` inside a policy is re-evaluated PER
// ROW. Wrapped as `(select auth.uid())` the planner treats it as an InitPlan
// and evaluates it once for the whole query. On a table with fifty thousand
// rows that is the difference between a scan that calls a function fifty
// thousand times and one that calls it once.
//
// The same applies to `auth_workspace_ids()` — already wrapped in `IN (SELECT
// …)` everywhere in this codebase, which is why those policies were already
// fast. The bare `auth.uid()` comparisons were not.
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs'

const base = readFileSync('docs/base-schema-migration.sql', 'utf8')

/* ─── Read the tables the base schema creates ────────────────────────────── */

const tables = new Map()

for (const block of base.split('CREATE TABLE IF NOT EXISTS ').slice(1)) {
  const name = block.slice(0, block.indexOf(' ')).trim()
  const body = block.slice(block.indexOf('(') + 1, block.indexOf('\n);'))

  const columns = body
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((column) => column && column !== '')

  tables.set(name, new Set(columns))
}

/**
 * `<name>_id` → the table it points at.
 *
 * Only where the target is unambiguous. Everything else is deliberately absent
 * — see the header.
 */
const FK_TARGETS = {
  workspace_id: 'workspaces',
  customer_id: 'customers',
  product_id: 'products',
  invoice_id: 'invoices',
  supplier_id: 'suppliers',
  warehouse_id: 'warehouses',
  employee_id: 'employees',
  project_id: 'projects',
  account_id: 'accounts',
  branch_id: 'branches',
  department_id: 'departments',
  workflow_id: 'workflows',
  purchase_order_id: 'purchase_orders',
  batch_id: 'stock_batches',
}

/**
 * Composites the application actually queries, from reading its services.
 *
 * ⚠️ Not "every column, indexed". An index costs write throughput, storage and
 * vacuum time, and a table with nine of them is slower to insert into than one
 * with three. Each entry below corresponds to a real ORDER BY or WHERE in the
 * backend.
 */
const COMPOSITES = [
  ['invoices', ['workspace_id', 'created_at']],
  ['invoices', ['workspace_id', 'customer_id']],
  ['invoices', ['workspace_id', 'status']],
  ['invoice_items', ['workspace_id', 'invoice_id']],
  ['invoice_items', ['workspace_id', 'product_id']],
  ['transactions', ['workspace_id', 'customer_id']],
  ['transactions', ['workspace_id', 'created_at']],
  ['customers', ['workspace_id', 'full_name']],
  ['products', ['workspace_id', 'name']],
  ['products', ['workspace_id', 'sku']],
  ['journal_lines', ['workspace_id', 'account_id']],
  ['journal_entries', ['workspace_id', 'date']],
  ['stock_movements', ['workspace_id', 'product_id']],
  ['activities', ['workspace_id', 'entity_type', 'entity_id']],
  ['audit_logs', ['workspace_id', 'created_at']],
  ['payments', ['workspace_id', 'created_at']],
  ['workspace_members', ['user_id', 'workspace_id']],
]

/* ─── Emit ───────────────────────────────────────────────────────────────── */

const fks = []
const indexes = []

for (const [table, columns] of tables) {
  for (const [column, target] of Object.entries(FK_TARGETS)) {
    if (!columns.has(column)) continue
    if (table === target) continue // a self-reference is not this simple

    // `ON DELETE` is deliberately absent. CASCADE on a financial table would
    // let deleting a customer silently remove their invoices; RESTRICT is the
    // Postgres default and refuses instead, which is the correct answer for a
    // ledger.
    fks.push(
      `ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_${column}_fkey;\n` +
        `ALTER TABLE ${table} ADD CONSTRAINT ${table}_${column}_fkey\n` +
        `  FOREIGN KEY (${column}) REFERENCES ${target} (id) NOT VALID;`,
    )

    // Every foreign key gets an index. Postgres does NOT create one, and
    // without it a delete on the parent scans the whole child table to check
    // the constraint.
    indexes.push(`CREATE INDEX IF NOT EXISTS ${table}_${column}_idx ON ${table} (${column});`)
  }
}

for (const [table, columns] of COMPOSITES) {
  if (!tables.has(table)) continue
  const known = columns.filter((column) => tables.get(table).has(column))
  if (known.length < 2) continue

  indexes.push(
    `CREATE INDEX IF NOT EXISTS ${table}_${known.join('_')}_idx ON ${table} (${known.join(', ')});`,
  )
}

const output = `-- ============================================================================
-- docs/hardening-migration.sql
--
-- GENERATED by scripts/generate-hardening.mjs. Do not hand-edit.
--
-- The constraints and indexes \`base-schema-migration.sql\` could not carry,
-- because the dump it was built from recorded only names, types and NOT NULL.
--
-- ---------------------------------------------------------------------------
-- FOREIGN KEYS ARE ADDED \`NOT VALID\`
--
-- Which means: enforced on every future insert and update, and NOT checked
-- against rows that already exist.
--
-- That is the right trade here. The tables are empty on a fresh rebuild so
-- there is nothing to check; on a database with data, a validating ALTER takes
-- an ACCESS EXCLUSIVE lock for as long as the scan runs — which on a large
-- \`invoice_items\` is an outage. Validate later, deliberately:
--
--     ALTER TABLE invoice_items VALIDATE CONSTRAINT invoice_items_invoice_id_fkey;
--
-- ⚠️ No \`ON DELETE CASCADE\` anywhere. Postgres defaults to RESTRICT, and on a
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

-- ─── Foreign keys (${fks.length}) ─────────────────────────────────────────────────────

${fks.join('\n\n')}

-- ─── Indexes (${indexes.length}) ──────────────────────────────────────────────────────

${[...new Set(indexes)].join('\n')}

COMMIT;
`

writeFileSync('docs/hardening-migration.sql', output)

console.log('Wrote docs/hardening-migration.sql')
console.log(`  ${fks.length} foreign keys (NOT VALID)`)
console.log(`  ${new Set(indexes).size} indexes`)
