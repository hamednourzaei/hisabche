#!/usr/bin/env node
// ============================================================================
// scripts/compare-live-schema.mjs
//
// Compare the LIVE database against what the code and the migrations assume.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS AND `check-schema-drift.mjs` IS NOT ENOUGH
//
// That script compares the services against the migration FILES. It answers
// "would this be correct if every migration had run on an empty database".
//
// This one compares them against the database that actually exists. Those are
// different questions whenever a table pre-dates the migrations, because
// `CREATE TABLE IF NOT EXISTS` does not reshape a table that is already there.
// `accounts` is the case in point: the file creates it with `workspace_id` and
// `role`, the live table has neither, and the migration will not add them.
//
// USAGE
//   node scripts/compare-live-schema.mjs "<path to the schema dump csv>"
// ============================================================================

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')
const SERVICES = join(ROOT, 'backend', 'src', 'services')

const dumpPath = process.argv[2]
if (!dumpPath) {
  console.error('Usage: node scripts/compare-live-schema.mjs "<schema dump csv>"')
  process.exit(2)
}

const dump = readFileSync(dumpPath, 'utf8')

// ─── 1. The live schema ─────────────────────────────────────────────────────

/** table -> Set(column) as the database holds it today. */
const live = new Map()
/** table -> { rows, rls } */
const meta = new Map()

let current = null

for (const rawLine of dump.split(/\r?\n/)) {
  const table = /^"?TABLE (\w+) \((\d+) rows, (RLS on|RLS OFF)\)/.exec(rawLine)

  if (table) {
    current = table[1]
    live.set(current, new Set())
    meta.set(current, { rows: Number(table[2]), rls: table[3] === 'RLS on' })
    continue
  }

  // A column line is indented; anything else ends the table block.
  const column = /^\s{2}(\w+) /.exec(rawLine)
  if (column && current) {
    live.get(current).add(column[1])
    continue
  }

  if (/^"?(CONSTRAINT|POLICY|FUNCTION|INDEX) /.test(rawLine)) current = null
}

// ─── 2. What the migrations would add ───────────────────────────────────────
//
// Only ALTER ... ADD COLUMN counts. A CREATE TABLE for a table that already
// exists is a no-op, which is the whole point of this comparison.

const sql = readdirSync(DOCS)
  .filter((file) => file.endsWith('.sql') && !file.startsWith('_'))
  .map((file) => readFileSync(join(DOCS, file), 'utf8'))
  .join('\n')

/** table -> Set(column) the migrations will add to an existing table. */
const willAdd = new Map()

for (const match of sql.matchAll(/ALTER TABLE (\w+)\s+ADD COLUMN (?:IF NOT EXISTS )?(\w+)/gi)) {
  const table = match[1].toLowerCase()
  if (!willAdd.has(table)) willAdd.set(table, new Set())
  willAdd.get(table).add(match[2].toLowerCase())
}

/** Tables the migrations CREATE. If absent live, they will exist afterwards. */
const willCreate = new Set(
  [...sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/gi)].map((m) => m[1].toLowerCase()),
)

/** Columns of a table the migrations create, for tables not yet live. */
const created = new Map()
for (const match of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
  const table = match[1].toLowerCase()
  if (!created.has(table)) created.set(table, new Set())
  for (const line of match[2].split('\n')) {
    const column =
      /^\s*(\w+)\s+(uuid|text|integer|bigint|numeric|boolean|date|timestamptz|timestamp|jsonb|bigserial|serial)/i.exec(
        line,
      )
    if (column) created.get(table).add(column[1].toLowerCase())
  }
}

/** What a table will look like after every migration has run. */
function columnsAfterMigration(table) {
  const columns = new Set(live.get(table) ?? [])

  // A table that does not exist yet gets exactly what its CREATE declares.
  if (!live.has(table) && created.has(table)) {
    for (const column of created.get(table)) columns.add(column)
  }

  for (const column of willAdd.get(table) ?? []) columns.add(column)

  return columns
}

// ─── 3. What the services actually query ────────────────────────────────────

const findings = []

function inspect(file) {
  const source = readFileSync(file, 'utf8')
  const relative = file.slice(ROOT.length + 1).replace(/\\/g, '/')

  for (const query of source.matchAll(
    /\.from\('(\w+)'\)([\s\S]{0,900}?)(?=\n\s*(?:const|return|if|await|\}|\/\/)|\.from\(')/g,
  )) {
    const table = query[1].toLowerCase()
    const block = query[2]

    const exists = live.has(table) || willCreate.has(table)
    if (!exists) {
      // The dump listed `relkind = 'r'` only, so VIEWS are invisible to it.
      // Reporting one as a missing table would be wrong, so it is reported as
      // unknown — a question for the next dump, not a defect.
      findings.push({ relative, table, column: '(table)', kind: 'not in dump' })
      continue
    }

    const after = columnsAfterMigration(table)

    const report = (column, kind) => {
      if (!column || after.has(column)) return
      findings.push({ relative, table, column, kind })
    }

    for (const filter of block.matchAll(/\.(?:eq|neq|gt|gte|lt|lte|is|in)\('(\w+)'/g)) {
      report(filter[1].toLowerCase(), 'filter')
    }

    for (const select of block.matchAll(/\.select\(\s*[`'"]([^`'"]+)[`'"]/g)) {
      // A `${...}` interpolation is a column list held in a constant. This
      // script cannot resolve it, and reporting the literal text `${x}` as a
      // missing column is noise that buries the real findings.
      if (select[1].includes('${')) continue

      const flat = select[1]
        .replace(/\w+\s*:\s*\w+\s*(?:!\w+)?\s*\([^)]*\)/g, '')
        .replace(/\w+\s*(?:!\w+)?\s*\([^)]*\)/g, '')

      for (const raw of flat.split(',')) {
        const column = raw.trim().split(':')[0].trim().toLowerCase()
        if (!column || /[()*!]/.test(column)) continue
        report(column, 'select')
      }
    }
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (/\.(service|repository)\.ts$/.test(entry.name)) inspect(path)
  }
}

walk(SERVICES)

// ─── 4. Report ──────────────────────────────────────────────────────────────

console.log(`Live database: ${live.size} tables.`)
console.log(`Migrations create ${willCreate.size} tables and add columns to ${willAdd.size}.`)

const unique = [...new Map(findings.map((f) => [`${f.table}|${f.column}|${f.kind}`, f])).values()]

const withoutRls = [...meta.entries()].filter(([, m]) => !m.rls).map(([name]) => name)

if (withoutRls.length > 0) {
  console.log(`\nTABLES WITHOUT RLS: ${withoutRls.join(', ')}`)
}

if (unique.length === 0) {
  console.log('\nNo drift: after the migrations run, every query reads a column that exists.')
  process.exit(0)
}

console.log(`\n${unique.length} COLUMN(S) THE CODE NEEDS AND NOTHING CREATES:\n`)

const byTable = new Map()
for (const finding of unique) {
  if (!byTable.has(finding.table)) byTable.set(finding.table, [])
  byTable.get(finding.table).push(finding)
}

for (const [table, items] of [...byTable.entries()].sort()) {
  const rows = meta.get(table)
  const state = live.has(table)
    ? `exists, ${rows?.rows ?? 0} rows`
    : willCreate.has(table)
      ? 'created by a migration'
      : 'DOES NOT EXIST'

  console.log(`  ${table}  (${state})`)
  for (const item of items) {
    console.log(`    ${item.kind.padEnd(14)} ${item.column}`)
    console.log(`    ${' '.repeat(14)} ${item.relative}`)
  }
  console.log('')
}

console.log('Each of these fails at runtime with: 42703 column does not exist.')
process.exit(1)
