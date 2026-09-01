// ============================================================================
// scripts/verify-bundle-covers-code.mjs
//
// Does `docs/_bundle.sql` create everything the backend actually asks for?
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT `check-schema-drift.mjs`
//
// That one compares the migration files against each other — "if all of these
// ran on an empty database, would they agree?". It cannot tell you that the
// code queries a table nobody creates, because it never reads the code.
//
// This reads BOTH: every `from('x')` and `.rpc('y')` in `backend/src`, and
// every `CREATE TABLE` / `CREATE VIEW` / `CREATE FUNCTION` in the bundle. What
// it finds is the gap that shows up as `42P01 relation does not exist` on the
// first request after a clean rebuild — the exact thing that costs an evening.
//
// ---------------------------------------------------------------------------
// IT REPORTS BOTH DIRECTIONS
//
//   MISSING   the code queries it, the bundle does not create it   → breaks
//   UNUSED    the bundle creates it, no code touches it            → probably fine
//
// The second is not an error. Some tables are written only by triggers or read
// only by SQL views. It is printed because a table nobody uses is sometimes a
// table somebody forgot to finish.
// ============================================================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const BUNDLE = join(ROOT, 'docs', '_bundle.sql')
const BACKEND = join(ROOT, 'backend', 'src')

/* ─── What the code asks for ─────────────────────────────────────────────── */

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry)
    if (statSync(full).isDirectory()) {
      // Tests reference fixture tables that deliberately do not exist.
      return entry === '__tests__' || entry === 'node_modules' ? [] : sourceFiles(full)
    }
    return entry.endsWith('.ts') ? [full] : []
  })
}

const code = sourceFiles(BACKEND)
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')
  // Comments first. A table named in a comment is not a table queried.
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const wanted = {
  tables: new Set([...code.matchAll(/\.from\('([a-z0-9_]+)'\)/g)].map((match) => match[1])),
  functions: new Set([...code.matchAll(/\.rpc\('([a-z0-9_]+)'/g)].map((match) => match[1])),
}

/* ─── What the bundle creates ────────────────────────────────────────────── */

const bundle = readFileSync(BUNDLE, 'utf8')

const created = {
  tables: new Set([
    ...[...bundle.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([a-z0-9_]+)/gi)].map((m) => m[1]),
    // A view answers a `from()` exactly as a table does.
    ...[...bundle.matchAll(/CREATE (?:OR REPLACE )?VIEW ([a-z0-9_]+)/gi)].map((m) => m[1]),
    ...[...bundle.matchAll(/CREATE MATERIALIZED VIEW (?:IF NOT EXISTS )?([a-z0-9_]+)/gi)].map(
      (m) => m[1],
    ),
  ]),
  functions: new Set(
    [...bundle.matchAll(/CREATE (?:OR REPLACE )?FUNCTION ([a-z0-9_]+)/gi)].map((m) => m[1]),
  ),
}

/**
 * Tables Supabase itself provides.
 *
 * `auth.users` is queried through the client's `auth` schema and is never in
 * our migrations. Listing it as missing would be noise that teaches people to
 * ignore this script's output.
 */
const SUPABASE_PROVIDED = new Set(['users'])

/* ─── Compare ────────────────────────────────────────────────────────────── */

const missingTables = [...wanted.tables]
  .filter((name) => !created.tables.has(name) && !SUPABASE_PROVIDED.has(name))
  .sort()

const missingFunctions = [...wanted.functions].filter((name) => !created.functions.has(name)).sort()

const unusedTables = [...created.tables].filter((name) => !wanted.tables.has(name)).sort()

/* ─── Report ─────────────────────────────────────────────────────────────── */

const line = '─'.repeat(72)

console.log(line)
console.log('Bundle coverage')
console.log(line)
console.log(`code queries      ${wanted.tables.size} tables, ${wanted.functions.size} functions`)
console.log(`bundle creates    ${created.tables.size} tables, ${created.functions.size} functions`)
console.log()

if (missingTables.length > 0) {
  console.log(`❌ ${missingTables.length} TABLES THE CODE QUERIES AND THE BUNDLE DOES NOT CREATE`)
  console.log('   Each of these is a 42P01 on the first request that touches it.\n')
  for (const name of missingTables) console.log(`   ${name}`)
  console.log()
}

if (missingFunctions.length > 0) {
  console.log(
    `❌ ${missingFunctions.length} FUNCTIONS THE CODE CALLS AND THE BUNDLE DOES NOT CREATE\n`,
  )
  for (const name of missingFunctions) console.log(`   ${name}`)
  console.log()
}

if (unusedTables.length > 0) {
  console.log(`ℹ️  ${unusedTables.length} tables created but not queried by backend code`)
  console.log('   Not an error — some are written by triggers or read by SQL views.\n')
  console.log(`   ${unusedTables.join(', ')}\n`)
}

const broken = missingTables.length + missingFunctions.length

if (broken === 0) {
  console.log('✅ The bundle creates everything the backend queries.')
  console.log(line)
  process.exit(0)
}

console.log(`${broken} gap(s). Fix these BEFORE running the bundle, not after.`)
console.log(line)
process.exit(1)
