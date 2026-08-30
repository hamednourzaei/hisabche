#!/usr/bin/env node
// ============================================================================
// scripts/check-schema-drift.mjs
//
// Find every query that reads a column no migration creates — before a
// migration is ever run, and without a database.
//
// ---------------------------------------------------------------------------
// THE BUG CLASS THIS EXISTS FOR
//
// A service is written against a table the author remembers, or intends to
// add, or half-added in another file. TypeScript cannot see it: `.eq('foo', x)`
// is a string. Domain tests cannot see it: they never touch a database. The
// route compiles, the suite is green, and the endpoint fails at runtime with
// `42703 column does not exist` — in front of a user.
//
// That is exactly how `currency.service.ts` came to filter `exchange_rates` on
// a `workspace_id` the table does not have, and how `timesheets.service.ts`
// came to read `invoices.project_id`. A thousand passing tests said nothing.
//
// ---------------------------------------------------------------------------
// WHAT IT JUDGES, AND WHAT IT DELIBERATELY DOES NOT
//
// Only tables this repository fully describes: those CREATEd by a migration in
// docs/, and those declared in `drizzle-schema.ts`.
//
// Tables that predate both and are merely ALTERed here are skipped. Their real
// width lives in the database — `workspaces.owner_id` and
// `invoices.public_token` are real columns neither source lists — so flagging
// them would be a guess. A checker that cries wolf is a checker nobody runs.
//
// USAGE
//   node scripts/check-schema-drift.mjs      # exits 1 on any mismatch
// ============================================================================

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')
const SERVICES = join(ROOT, 'backend', 'src', 'services')
const DRIZZLE = join(ROOT, 'backend', 'src', 'drizzle-schema.ts')

const COLUMN_TYPES =
  'uuid|text|integer|bigint|numeric|boolean|date|timestamptz|timestamp|jsonb|bigserial|serial'

// ─── 1. The schema this repository describes ────────────────────────────────

const sql = readdirSync(DOCS)
  .filter((file) => file.endsWith('.sql'))
  .map((file) => readFileSync(join(DOCS, file), 'utf8'))
  .join('\n')
  .replace(/^\s*--.*$/gm, '')

/** table -> the columns we know it has. */
const known = new Map()
/** tables whose FULL width we know, and may therefore judge. */
const judgeable = new Set()

const add = (table, column) => {
  if (!known.has(table)) known.set(table, new Set())
  known.get(table).add(column)
}

for (const match of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
  const table = match[1].toLowerCase()

  for (const line of match[2].split('\n')) {
    const column = line.trim().match(new RegExp(`^(\\w+)\\s+(?:${COLUMN_TYPES})`, 'i'))
    if (column) add(table, column[1].toLowerCase())
  }

  judgeable.add(table)
}

for (const match of sql.matchAll(/CREATE (?:OR REPLACE )?VIEW (\w+) AS([\s\S]*?);/gi)) {
  const view = match[1].toLowerCase()
  for (const alias of match[2].matchAll(/AS\s+(\w+)/gi)) add(view, alias[1].toLowerCase())
  for (const bare of match[2].matchAll(/^\s*(?:\w+\.)?(\w+),\s*$/gm)) {
    add(view, bare[1].toLowerCase())
  }
  judgeable.add(view)
}

// Drizzle describes tables the SQL never creates, and is authoritative there.
const drizzle = readFileSync(DRIZZLE, 'utf8')
const drizzleTypes = /(?:uuid|text|integer|numeric|boolean|timestamp|jsonb|date)\('(\w+)'/g

for (const match of drizzle.matchAll(/pgTable\(\s*'(\w+)',\s*\{([\s\S]*?)\n {2}\}/g)) {
  const table = match[1].toLowerCase()
  for (const column of match[2].matchAll(drizzleTypes)) add(table, column[1].toLowerCase())
  judgeable.add(table)
}

/**
 * Tables that are WIDER than anything in this repository describes.
 *
 * `workspaces.owner_id` is read by `admin.service.ts` and
 * `entitlement.service.ts`, is not in `drizzle-schema.ts`, and is not added by
 * any migration here — it was created outside this repo. Judging `workspaces`
 * would report two false positives forever.
 *
 * Listing a table here is a statement that its real shape lives in the
 * database and must be confirmed there. `scripts/verify-rls.mjs` reaches a
 * live database and is where that confirmation belongs.
 *
 * This list should shrink, never grow: a NEW table appearing here means
 * somebody described a schema in code and then diverged from it.
 */
const PREDATES_THIS_REPO = new Set(['workspaces'])

for (const table of PREDATES_THIS_REPO) judgeable.delete(table)

// An ALTER teaches a column whichever source first described the table.
for (const match of sql.matchAll(/ALTER TABLE (\w+)\s+ADD COLUMN (?:IF NOT EXISTS )?(\w+)/gi)) {
  add(match[1].toLowerCase(), match[2].toLowerCase())
}

// ─── 2. What the services assume ────────────────────────────────────────────

const findings = []

function inspect(file) {
  const source = readFileSync(file, 'utf8')
  const relative = file.slice(ROOT.length + 1).replace(/\\/g, '/')

  const queries = source.matchAll(
    /\.from\('(\w+)'\)([\s\S]{0,900}?)(?=\n\s*(?:const|return|if|await|\}|\/\/)|\.from\(')/g,
  )

  for (const query of queries) {
    const table = query[1].toLowerCase()
    if (!judgeable.has(table)) continue

    const columns = known.get(table) ?? new Set()
    const block = query[2]

    const report = (column, kind) => {
      if (!columns.has(column)) findings.push({ relative, table, column, kind })
    }

    for (const filter of block.matchAll(/\.(?:eq|neq|gt|gte|lt|lte|is|in)\('(\w+)'/g)) {
      report(filter[1].toLowerCase(), 'filter')
    }

    for (const conflict of block.matchAll(/onConflict:\s*'([^']+)'/g)) {
      for (const column of conflict[1].split(',')) {
        report(column.trim().toLowerCase(), 'onConflict')
      }
    }

    for (const select of block.matchAll(/\.select\(\s*[`'"]([^`'"]+)[`'"]/g)) {
      // Embeds read ANOTHER table and say nothing about this one. Three
      // spellings: `alias:other(...)`, `alias:other!fk (...)`, `other(...)`.
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

// ─── 3. Report ──────────────────────────────────────────────────────────────

const unique = [
  ...new Map(findings.map((f) => [`${f.relative}|${f.table}|${f.column}|${f.kind}`, f])).values(),
]

console.log(`${judgeable.size} tables fully described by this repository.`)

if (unique.length === 0) {
  console.log('\nNo schema drift: every query reads a column that exists.')
  process.exit(0)
}

console.log(`\n${unique.length} QUERIES READ A COLUMN THAT DOES NOT EXIST:\n`)

for (const finding of unique) {
  console.log(`  ${finding.kind.padEnd(10)} ${finding.table}.${finding.column}`)
  console.log(`  ${' '.repeat(10)} ${finding.relative}\n`)
}

console.log('Each of these fails at runtime with: 42703 column does not exist.')
process.exit(1)
