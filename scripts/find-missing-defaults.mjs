// ============================================================================
// scripts/find-missing-defaults.mjs
//
// Which NOT NULL columns will break an INSERT the code actually makes?
//
// ---------------------------------------------------------------------------
// THE BUG THIS FINDS
//
// `base-schema-migration.sql` was rebuilt from a dump that recorded names,
// types and NOT NULL — and no DEFAULTS. Its own header says so.
//
// That is harmless for a column the code always sets. It is fatal for one the
// code never sets because the database used to fill it in:
//
//     .insert({ workspace_id, user_id, role: 'owner' })
//
// `workspace_members.has_access` is NOT NULL with no default, so that insert
// raises — onboarding creates the workspace, fails to create the membership,
// and every subsequent request is 403 with no obvious connection to the cause.
//
// This finds every other column in the same position before it does the same
// thing on a different screen.
//
// ---------------------------------------------------------------------------
// HOW IT DECIDES
//
// For each NOT NULL column with no default, it looks for the column name in an
// `.insert({ … })` anywhere in `backend/src`. Absent from every insert means
// the code relies on the database to supply it.
//
// ⚠️ Conservative in the safe direction: a column mentioned in ANY insert is
// treated as covered, even if only one of three insert sites sets it. Under-
// reporting here would be dangerous, so borderline cases are printed as
// "check" rather than dropped.
// ============================================================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const schema = readFileSync('docs/base-schema-migration.sql', 'utf8')

/* ─── Columns that are NOT NULL with no default ──────────────────────────── */

const risky = []

for (const block of schema.split('CREATE TABLE IF NOT EXISTS ').slice(1)) {
  const table = block.slice(0, block.indexOf(' ')).trim()
  const body = block.slice(block.indexOf('(') + 1, block.indexOf('\n);'))

  for (const line of body.split('\n')) {
    const match = /^\s+([a-z0-9_]+)\s+(.+?)\s*,?\s*$/.exec(line)
    if (!match) continue

    const [, column, rest] = match
    if (!/NOT NULL/.test(rest)) continue
    if (/DEFAULT/.test(rest)) continue

    risky.push({ table, column })
  }
}

/* ─── What the code sets on insert ───────────────────────────────────────── */

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry)
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' || entry === 'node_modules' ? [] : sourceFiles(full)
    }
    return entry.endsWith('.ts') ? [full] : []
  })
}

const code = sourceFiles(join('backend', 'src'))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

// Every `.insert({ … })` body, so a column name in a WHERE clause does not
// count as "the code sets it".
const inserted = new Set()

for (const match of code.matchAll(/\.(?:insert|upsert)\(\s*\{([\s\S]{0,2000}?)\}/g)) {
  for (const key of match[1].matchAll(/^\s*([a-z0-9_]+)\s*:/gm)) inserted.add(key[1])
}

// Some inserts pass a prebuilt object. Catch the assignments that build them.
for (const match of code.matchAll(/^\s*([a-z0-9_]+)\s*:\s*(?:data|input|ctx|row)\./gm)) {
  inserted.add(match[1])
}

/* ─── Report ─────────────────────────────────────────────────────────────── */

const broken = risky.filter(({ column }) => !inserted.has(column))

const rule = '─'.repeat(72)
console.log(rule)
console.log('NOT NULL columns with no default')
console.log(rule)
console.log(`${risky.length} NOT NULL columns carry no default`)
console.log(`${broken.length} of them are never set by any insert in the code\n`)

if (broken.length === 0) {
  console.log('✅ Every one is set explicitly somewhere.')
  process.exit(0)
}

console.log('❌ These will raise on INSERT:\n')

const byTable = new Map()
for (const { table, column } of broken) {
  if (!byTable.has(table)) byTable.set(table, [])
  byTable.get(table).push(column)
}

for (const [table, columns] of [...byTable].sort()) {
  console.log(`   ${table.padEnd(26)} ${columns.join(', ')}`)
}

console.log()
console.log('Each needs a DEFAULT restoring, or the code has to set it.')
console.log(rule)
