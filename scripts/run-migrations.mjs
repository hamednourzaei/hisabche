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
//   DATABASE_URL   required to apply. A Postgres connection string.
//                  Read from the shell, or from `.env.migrate` / `.env.local`
//                  in the repository root if it is not already set.
//
//   WHICH SUPABASE HOST TO USE
//
//   On the free plan the DIRECT host (`db.<ref>.supabase.co`) resolves to an
//   IPv6 address only — a dedicated IPv4 address is a paid add-on. On a
//   network without IPv6 that fails as ENETUNREACH or ENOTFOUND, which reads
//   like a wrong password and is not.
//
//   Use the SESSION pooler instead:
//
//     aws-0-<region>.pooler.supabase.com:5432   session mode — IPv4, full SQL
//     aws-0-<region>.pooler.supabase.com:6543   transaction mode — DO NOT USE
//
//   Session mode holds one connection for the whole session, so multi-statement
//   DDL, `BEGIN … COMMIT` and `CREATE FUNCTION` all behave normally.
//   Transaction mode hands the connection back between statements and will
//   leave a migration half-applied.
// ============================================================================

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadEnv } from './lib/load-env.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')

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
  // ⚠️ ABSOLUTELY FIRST.
  //
  // The ~55 tables that were created by hand in the Supabase dashboard before
  // `docs/*.sql` existed. Every other file in this list ALTERs them, and none
  // of them creates them — which stayed invisible for as long as the database
  // was alive, and became a rebuild that produced eleven tables out of
  // sixty-five the moment the schema was dropped.
  //
  // Generated from a dump by `scripts/generate-base-schema.mjs`.
  'base-schema-migration.sql',
  // FIRST. It creates `exchange_rates`, which `schema-drift-fix` ALTERs and no
  // other file creates, and it scopes a dozen pre-existing tables to a
  // workspace before anything else builds on them.
  'live-reconciliation-migration.sql',
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
  // Adds columns three services already query. Must run after every CREATE
  // TABLE it alters, which is why it is last of the schema files.
  'schema-drift-fix-migration.sql',
  // Needs `time_entries` (tier2-gaps) AND the sync trigger functions
  // (sync-engine). Listed rather than left to name order, because the name
  // order that happens to work today is not a guarantee.
  'sync-engine-migration.sql',
  'timesheet-sync-migration.sql',
  // The migration centre. Last of the schema files: it references nothing the
  // earlier ones create, but it is the newest capability and keeping new work
  // at the end makes the order readable as a history.
  'data-migration-center-migration.sql',
  // Views over tables the files above create, plus the one table the dump
  // never reached. Must come after those tables exist and before the policy
  // rewrite below.
  'views-and-billing-events-migration.sql',
  // Foreign keys and indexes the dump could not carry. After every CREATE
  // TABLE, before the policy work that depends on the indexes.
  'hardening-migration.sql',
  // LAST, deliberately. It rewrites policies that the earlier files create, so
  // it has to run after all of them or its work is overwritten.
  'rls-recursion-fix-migration.sql',
  // ABSOLUTELY LAST.
  //
  // It rewrites the same policies `rls-recursion-fix` creates, wrapping
  // `auth.uid()` as `(select auth.uid())` so the planner evaluates it once per
  // statement rather than once per row. Running it EARLIER means the recursion
  // fix overwrites this work and the per-row evaluation comes back.
  'rls-performance-migration.sql',
  // Policies for the tables that had RLS on and nothing else. After the
  // helpers exist, since every policy here calls `auth_workspace_ids()`.
  'remaining-policies-migration.sql',
  // ABSOLUTELY LAST. It revokes grants on every SECURITY DEFINER function that
  // exists, so it has to run after the last one is created — and it pins
  // search_path on whatever is still unpinned by then.
  'linter-hardening-migration.sql',

  // ─── The consolidation phases (A–D) are DELIBERATELY NOT LISTED ───────────
  //
  // `phase-a-*` … `phase-d-*` are left to `extra`, which sorts by name and runs
  // AFTER everything in this array. That is not laziness — it is the only
  // correct position, and listing them here would break the rebuild:
  //
  //   * `SETUP-COMPLETE.sql` is also an extra, and it re-creates
  //     `warehouse_transfer_stock` and `transactions_view` in their
  //     pre-consolidation form. Anything in ORDER runs before every extra, so
  //     promoting the phase files would let SETUP-COMPLETE overwrite Phase B
  //     and Phase C on every rebuild — silently, since both statements are
  //     CREATE OR REPLACE and neither errors.
  //   * uppercase sorts before lowercase, so `SETUP-COMPLETE.sql` already runs
  //     before `phase-a-01…`, and `a < b < c < d` gives the phases their own
  //     order for free.
  //
  // If a phase file ever needs to run before an extra, promote BOTH — do not
  // promote the phase alone.
]

loadEnv()

const DATABASE_URL = process.env.DATABASE_URL

function listMigrations() {
  // A leading underscore means "generated, not a migration".
  //
  // `_bundle.sql` is every migration concatenated for pasting into the SQL
  // Editor. Without this filter the runner treats it as a thirty-first
  // migration and applies the whole set a second time — after the individual
  // files have already run.
  const present = readdirSync(DOCS).filter((file) => file.endsWith('.sql') && !file.startsWith('_'))

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

// Supabase requires TLS and presents a certificate chain Node does not carry a
// root for by default, so a plain connection fails with SELF_SIGNED_CERT_IN_CHAIN.
//
// The transport is still encrypted; what is skipped is verifying the server's
// identity. That is acceptable for a one-off migration run to a host the
// operator typed themselves, and NOT acceptable for the application — which is
// why this is here and not in `src/db.ts`.
const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
} catch (error) {
  console.error(`\nCould not connect: ${error.message}\n`)

  if (error.code === 'ENOTFOUND' || error.code === 'ENETUNREACH') {
    console.error(
      'That host did not resolve, or resolved to an address this network cannot reach.\n' +
        'On the Supabase free plan the direct host is IPv6-only. Use the SESSION\n' +
        'pooler instead — Project Settings → Database → Connection string →\n' +
        'Session pooler (port 5432, host aws-0-<region>.pooler.supabase.com).\n' +
        'Do not use port 6543: transaction mode leaves DDL half-applied.',
    )
  }

  if (error.code === '28P01') {
    console.error(
      'The password was rejected. Reset it under Project Settings → Database,\n' +
        'and URL-encode any @ : / ? # characters in it.',
    )
  }

  process.exit(1)
}

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
