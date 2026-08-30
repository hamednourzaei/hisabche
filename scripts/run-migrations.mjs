#!/usr/bin/env node
// ============================================================================
// scripts/run-migrations.mjs
//
// Apply the SQL in docs/ to a database, in order, once each.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A SCRIPT YOU RUN AND NOT SOMETHING THE BUILD DOES
//
// Every file in docs/ is DDL against a live financial database. Some of it
// backfills columns and some of it enables row-level security, and a partly
// applied migration on a books-of-account database is worse than an
// unapplied one. That is a decision with a person's name on it, so it is a
// command a person types.
//
// ---------------------------------------------------------------------------
// HOW IT BEHAVES
//
//   * DRY RUN BY DEFAULT. It prints what it would do and exits. Applying
//     anything needs --apply, typed on purpose.
//   * Each file runs inside a transaction. A file that fails rolls back
//     whole; it never leaves half a migration behind.
//   * Applied files are recorded in `schema_migrations` by name and checksum,
//     so a second run skips them — and a file that CHANGED after being
//     applied is refused rather than silently re-run.
//   * It stops at the first failure. Continuing past a broken migration is
//     how a database ends up in a state nobody can reason about.
//
// USAGE
//   node scripts/run-migrations.mjs                  # dry run, always safe
//   node scripts/run-migrations.mjs --apply          # actually apply
//   node scripts/run-migrations.mjs --apply --only tax-engine-migration.sql
//
// ENVIRONMENT
//   DATABASE_URL   required. A direct Postgres connection string.
// ============================================================================

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs')

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null

/**
 * The order migrations must run in.
 *
 * Explicit rather than alphabetical: `tax-engine` adds columns to `invoices`
 * that only exist after the earlier files have run, and alphabetical order
 * would put `branch` before `accounting-core`. A list somebody maintains is
 * more honest than a naming convention somebody has to remember.
 *
 * Files not listed here run last, in name order, and are reported as such.
 */
const ORDER = [
  'tenancy-workspace-migration.sql',
  'tenancy-rls.sql',
  'unified-sale-purchase-migration.sql',
  'child-table-rls-fix.sql',
  'accounting-core-migration.sql',
  'inventory-costing-migration.sql',
  'payments-ar-ap-migration.sql',
  'sync-conflicts-migration.sql',
  'sod-migration.sql',
  'branch-migration.sql',
  'personalization-migration.sql',
  'rules-engine-migration.sql',
  'mdm-migration.sql',
  'tenant-isolation-closure-migration.sql',
  'tax-engine-migration.sql',
  'traceability-migration.sql',
  'finance-gaps-migration.sql',
  'tier2-gaps-migration.sql',
]

const DATABASE_URL = process.env.DATABASE_URL

function listMigrations() {
  const present = readdirSync(DOCS).filter((file) => file.endsWith('.sql'))

  const ordered = ORDER.filter((name) => present.includes(name))
  const extra = present.filter((name) => !ORDER.includes(name)).sort()

  return { ordered, extra, missing: ORDER.filter((name) => !present.includes(name)) }
}

function checksum(sql) {
  return createHash('sha256').update(sql).digest('hex').slice(0, 16)
}

const { ordered, extra, missing } = listMigrations()
const queue = (ONLY ? [ONLY] : [...ordered, ...extra]).filter((name) =>
  readdirSync(DOCS).includes(name),
)

console.log(`${queue.length} migration(s) in ${DOCS}\n`)

if (missing.length > 0) {
  console.log(`Listed in ORDER but not present: ${missing.join(', ')}\n`)
}
if (extra.length > 0 && !ONLY) {
  // Not an error — but worth saying, because an unordered file that depends on
  // an earlier one will fail and the reason will not be obvious.
  console.log(`Not in the explicit order, running last: ${extra.join(', ')}\n`)
}

if (!APPLY) {
  for (const name of queue) {
    const sql = readFileSync(join(DOCS, name), 'utf8')
    const statements = sql.split(';').filter((s) => s.trim().length > 0).length
    console.log(`  would apply  ${name}  (${statements} statements, ${checksum(sql)})`)
  }

  console.log('\nDRY RUN — nothing was executed.')
  console.log('Re-run with --apply to actually apply these, after taking a backup.')
  process.exit(0)
}

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required to apply migrations.')
  process.exit(2)
}

// `pg` is imported lazily so a dry run works with no driver installed.
const { default: pg } = await import('pg')
const client = new pg.Client({ connectionString: DATABASE_URL })

await client.connect()

// The ledger of what has run. Created first, outside any migration, because
// every other decision depends on being able to read it.
await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name        text PRIMARY KEY,
    checksum    text NOT NULL,
    applied_at  timestamptz NOT NULL DEFAULT now(),
    applied_by  text
  )
`)

const { rows: applied } = await client.query('SELECT name, checksum FROM schema_migrations')
const appliedByName = new Map(applied.map((row) => [row.name, row.checksum]))

let succeeded = 0
let skipped = 0

for (const name of queue) {
  const sql = readFileSync(join(DOCS, name), 'utf8')
  const sum = checksum(sql)
  const previous = appliedByName.get(name)

  if (previous === sum) {
    console.log(`  skip     ${name}  (already applied)`)
    skipped += 1
    continue
  }

  if (previous && previous !== sum) {
    // The file changed after it was applied. Re-running it could conflict with
    // what is already there, and pretending it is new would lose the fact that
    // two different versions have now touched this database.
    console.error(`\n  REFUSED  ${name}`)
    console.error(`  It was applied as ${previous} and is now ${sum}.`)
    console.error('  Write a NEW migration with the change rather than editing an applied one.')
    await client.end()
    process.exit(1)
  }

  process.stdout.write(`  apply    ${name} ... `)

  try {
    // Each file whole, inside a transaction. Several of these files open their
    // own BEGIN/COMMIT; nested transactions are harmless in Postgres and the
    // outer one still guarantees all-or-nothing for the file.
    await client.query('BEGIN')
    await client.query(sql)
    await client.query(
      'INSERT INTO schema_migrations (name, checksum, applied_by) VALUES ($1, $2, $3)',
      [name, sum, process.env.USER ?? process.env.USERNAME ?? 'unknown'],
    )
    await client.query('COMMIT')

    console.log('ok')
    succeeded += 1
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})

    console.log('FAILED')
    console.error(`\n  ${error.message}\n`)
    // Stopping is the point. Continuing past a broken migration leaves a
    // database in a state nobody can reason about.
    console.error(
      `  Stopped. ${succeeded} applied, ${queue.length - succeeded - skipped} not attempted.`,
    )

    await client.end()
    process.exit(1)
  }
}

await client.end()

console.log(`\n${succeeded} applied, ${skipped} already up to date.`)
console.log('Now run:  node scripts/verify-rls.mjs')
