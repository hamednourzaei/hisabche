#!/usr/bin/env node
// ============================================================================
// performance/scripts/parity/prod-vs-lab-defaults.mjs
//
// Mechanical check of the claim docs/semantic-null-defaults-migration.sql
// rests on: «production carries no DEFAULT now() on those 29 columns, and the
// rebuilt database matches production on the whole class.»
//
// Reads performance/raw/production-schema-dump.sql (the verbatim production
// snapshot captured 2026-10-17) — this dump is a snapshot for COMPARISON and
// is never executed — parses its column definitions, and compares them with
// the running capacity lab through information_schema.
//
// Output: JSON report → performance/raw/M2-prod-vs-lab-defaults.json and a
// human summary on stdout. Exits non-zero when a CRITICAL assertion fails:
//   1. a column the migration fixes still carries a DEFAULT in production
//      (the fix would CREATE a divergence instead of removing one);
//   2. a column the migration fixes still carries a DEFAULT in the lab
//      (the migration was not applied);
//   3. a nullable timestamp still defaults to now() in the lab — the
//      whole-class invariant, created_at / updated_at excluded because both
//      schemas default those on purpose.
//
// Everything else (nullability mismatches, default-text differences, tables
// that exist only on one side) is REPORTED for the parity chapter of the
// database-source-map report — not acted on here.
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import pg from 'pg'

import { LAB_URL, REPO_ROOT, assertLocal } from '../lib/lab-config.mjs'

const { Client } = pg

const DUMP_FILE = join(REPO_ROOT, 'performance', 'raw', 'production-schema-dump.sql')
const OUT_FILE = join(REPO_ROOT, 'performance', 'raw', 'M2-prod-vs-lab-defaults.json')

// Kept in sync with backend/src/__tests__/semantic-null-defaults.pg.test.ts.
const FIXED = [
  'workspace_members.suspended_at',
  'accounts.deleted_at',
  'journal_entries.deleted_at',
  'invoices.finalized_at',
  'invoices.lock_expires_at',
  'profiles.onboarding_completed_at',
  'workflows.deleted_at',
  'password_reset_tokens.used_at',
  'password_reset_tokens.revoked_at',
  'password_reset_tokens.deleted_at',
  'background_jobs.completed_at',
  'background_jobs.started_at',
  'customers.synced_at',
  'event_log.completed_at',
  'event_log.next_retry_at',
  'invoices.synced_at',
  'leaves.approved_at',
  'notifications.read_at',
  'products.synced_at',
  'project_members.joined_at',
  'project_tasks.completed_at',
  'purchase_orders.received_at',
  'sync_logs.completed_at',
  'sync_queue.processed_at',
  'transactions.synced_at',
  'webhook_events.processed_at',
  'workflow_instances.completed_at',
  'workspace_invites.accepted_at',
  'workspace_members.joined_at',
]

const EXCLUDE_FROM_INVARIANT = ['created_at', 'updated_at']

function parseDump(text) {
  const tables = new Map()
  let current = null

  for (const line of text.split(/\r?\n/)) {
    const create = /^CREATE TABLE public\.([a-z_]+) \($/.exec(line)
    if (create) {
      current = new Map()
      tables.set(create[1], current)
      continue
    }
    if (!current) continue
    if (/^\);$/.test(line)) {
      current = null
      continue
    }
    if (line.startsWith('--')) continue

    const column = /^ {2}([a-z_]+) (.*)$/.exec(line)
    if (!column || column[1] === 'CONSTRAINT') continue

    const rest = column[2].replace(/,$/, '')
    // A column definition ends with CHECK (...) when it has one; the default
    // sits before it. The jsonb literals in this dump never contain the
    // literal string " CHECK ", so splitting there is safe.
    const beforeCheck = rest.split(' CHECK ')[0]
    const defaultMatch = / DEFAULT (.*)$/.exec(beforeCheck)

    current.set(column[1], {
      notNull: /\bNOT NULL\b/.test(beforeCheck),
      defaultText: defaultMatch ? defaultMatch[1].trim() : null,
    })
  }

  return tables
}

const normalize = (text) => text.replace(/\s+/g, ' ').trim()

async function main() {
  const dumpText = readFileSync(DUMP_FILE, 'utf8')
  const prodTables = parseDump(dumpText)

  const client = new Client({
    connectionString: assertLocal(LAB_URL),
    application_name: 'parity:prod-vs-lab-defaults',
  })
  await client.connect()

  const { rows } = await client.query(`
    SELECT table_name, column_name, is_nullable, column_default
      FROM information_schema.columns
     WHERE table_schema = 'public'
  `)
  await client.end()

  const labTables = new Map()
  for (const row of rows) {
    if (!labTables.has(row.table_name)) labTables.set(row.table_name, new Map())
    labTables.get(row.table_name).set(row.column_name, {
      notNull: row.is_nullable === 'NO',
      defaultText: row.column_default,
    })
  }

  const labNullableNow = rows
    .filter(
      (r) =>
        r.is_nullable === 'YES' &&
        r.column_default === 'now()' &&
        !EXCLUDE_FROM_INVARIANT.includes(r.column_name),
    )
    .map((r) => `${r.table_name}.${r.column_name}`)
    .sort()

  const prodNullableNow = []
  for (const [table, columns] of prodTables) {
    for (const [column, def] of columns) {
      if (!def.notNull && def.defaultText === 'now()' && !EXCLUDE_FROM_INVARIANT.includes(column)) {
        prodNullableNow.push(`${table}.${column}`)
      }
    }
  }
  prodNullableNow.sort()

  const criticalFixedProdDefault = []
  const criticalFixedLabDefault = []
  const fixedDetail = []
  for (const key of FIXED) {
    const [table, column] = key.split('.')
    const prod = prodTables.get(table)?.get(column)
    const lab = labTables.get(table)?.get(column)
    if (!prod) criticalFixedProdDefault.push(`${key} (missing from the production dump)`)
    if (!lab) criticalFixedLabDefault.push(`${key} (missing from the lab)`)
    if (prod?.defaultText != null)
      criticalFixedProdDefault.push(`${key} (prod: ${prod.defaultText})`)
    if (lab?.defaultText != null) criticalFixedLabDefault.push(`${key} (lab: ${lab.defaultText})`)
    fixedDetail.push({
      column: key,
      prod_default: prod?.defaultText ?? null,
      lab_default: lab?.defaultText ?? null,
      prod_not_null: prod?.notNull ?? null,
      lab_not_null: lab?.notNull ?? null,
    })
  }

  const notNullMismatches = []
  const defaultPresenceMismatches = []
  const nowMismatches = []
  const textDiffers = []
  let sharedColumns = 0

  for (const [table, prodColumns] of prodTables) {
    const labColumns = labTables.get(table)
    if (!labColumns) continue
    for (const [column, prod] of prodColumns) {
      const lab = labColumns.get(column)
      if (!lab) continue
      sharedColumns += 1
      const key = `${table}.${column}`
      if (prod.notNull !== lab.notNull) {
        notNullMismatches.push({
          column: key,
          prod_not_null: prod.notNull,
          lab_not_null: lab.notNull,
        })
      }
      const prodHas = prod.defaultText !== null
      const labHas = lab.defaultText !== null
      if (prodHas !== labHas) {
        defaultPresenceMismatches.push({
          column: key,
          prod_default: prod.defaultText,
          lab_default: lab.defaultText,
        })
      } else if (prodHas && labHas) {
        const prodIsNow = prod.defaultText === 'now()'
        const labIsNow = lab.defaultText === 'now()'
        if (prodIsNow !== labIsNow) {
          nowMismatches.push({
            column: key,
            prod_default: prod.defaultText,
            lab_default: lab.defaultText,
          })
        } else if (normalize(prod.defaultText) !== normalize(lab.defaultText)) {
          textDiffers.push({
            column: key,
            prod_default: prod.defaultText,
            lab_default: lab.defaultText,
          })
        }
      }
    }
  }

  const dumpOnly = [...prodTables.keys()].filter((t) => !labTables.has(t)).sort()
  const labOnly = [...labTables.keys()].filter((t) => !prodTables.has(t)).sort()

  const criticals = [
    ...criticalFixedProdDefault.map((c) => `fixed column still defaults in PRODUCTION: ${c}`),
    ...criticalFixedLabDefault.map((c) => `fixed column still defaults in the LAB: ${c}`),
    ...labNullableNow.map((c) => `nullable now() default still in the LAB: ${c}`),
  ]

  const report = {
    generated_at: new Date().toISOString(),
    dump_file: 'performance/raw/production-schema-dump.sql',
    dump_tables: prodTables.size,
    lab_tables: labTables.size,
    shared_columns_compared: sharedColumns,
    fixed_columns_checked: FIXED.length,
    criticals,
    critical_fixed_prod_default: criticalFixedProdDefault,
    critical_fixed_lab_default: criticalFixedLabDefault,
    lab_nullable_now_defaults: labNullableNow,
    prod_nullable_now_defaults: prodNullableNow,
    not_null_mismatches: notNullMismatches,
    default_presence_mismatches: defaultPresenceMismatches,
    now_mismatches: nowMismatches,
    default_text_differs: textDiffers.map((t) => t.column),
    default_text_differs_sample: textDiffers.slice(0, 40),
    tables_only_in_dump: dumpOnly,
    tables_only_in_lab_count: labOnly.length,
    tables_only_in_lab: labOnly,
    fixed_detail: fixedDetail,
  }

  writeFileSync(OUT_FILE, `${JSON.stringify(report, null, 2)}\n`)

  console.log(`production dump tables: ${prodTables.size} · lab tables: ${labTables.size}`)
  console.log(`columns compared on shared tables: ${sharedColumns}`)
  console.log(
    `the 29 fixed columns: prod-default violations ${criticalFixedProdDefault.length}, lab-default violations ${criticalFixedLabDefault.length}`,
  )
  console.log(`nullable now() defaults still in the lab: ${labNullableNow.length} (must be 0)`)
  console.log(
    `nullable now() defaults in production (excluding created_at/updated_at): ${prodNullableNow.length}`,
  )
  console.log(
    `mismatches on shared columns — not-null ${notNullMismatches.length}, default presence ${defaultPresenceMismatches.length}, now-vs-other ${nowMismatches.length}, text-only differs ${textDiffers.length}`,
  )
  console.log(
    `tables only in the production dump: ${dumpOnly.length} · only in the lab: ${labOnly.length}`,
  )
  console.log(`report → performance/raw/M2-prod-vs-lab-defaults.json`)
  if (criticals.length > 0) {
    console.error('\nCRITICAL:')
    for (const entry of criticals) console.error(`  - ${entry}`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
