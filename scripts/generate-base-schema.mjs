// ============================================================================
// scripts/generate-base-schema.mjs
//
// Rebuild the DDL for tables that were never captured in a migration.
//
// ---------------------------------------------------------------------------
// WHY THIS HAD TO EXIST
//
// Roughly forty tables — `customers`, `products`, `invoices`,
// `journal_entries`, `accounts`, the lot — were created by hand in the
// Supabase dashboard long before `docs/*.sql` existed. Every migration since
// has ALTERed them. None of them CREATES them.
//
// That was invisible while the database was alive: the migrations ran, the
// alters found their tables, everything worked. It became visible the moment
// the schema was dropped and `_bundle.sql` rebuilt only what the migrations
// knew about — which was eleven tables out of sixty-five.
//
// The dump taken before the drop is the only record of those forty. This turns
// it back into DDL.
//
// ---------------------------------------------------------------------------
// WHAT IT CAN AND CANNOT RECOVER
//
//   RECOVERS   table names, columns, types, NOT NULL
//   DOES NOT   foreign keys, unique constraints, check constraints, indexes,
//              defaults, or RLS policies
//
// The dump does not contain them, and inventing them would be worse than
// omitting them: a guessed foreign key that points the wrong way fails at
// midnight on a real insert.
//
// The later migrations in `_bundle.sql` add the constraints, indexes and
// policies they know about — which is most of what matters, because the
// tenancy work of the last two sessions is all in there. What is genuinely
// lost is whatever was configured only in the dashboard and never written
// down. That is a real gap and it is named in the output rather than hidden.
//
// Usage:
//   node scripts/generate-base-schema.mjs "Supabase Snippet Untitled query (1).csv"
// ============================================================================

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dumpPath = process.argv[2]

if (!dumpPath) {
  console.error('usage: node scripts/generate-base-schema.mjs <dump.csv>')
  process.exit(1)
}

const dump = readFileSync(dumpPath, 'utf8')

/**
 * What the OTHER migrations already create — never emitted twice.
 *
 * ⚠️ Read from `docs/*.sql` directly, and with this file's own output
 * excluded. An earlier version read `_bundle.sql`, which by the second run
 * contained the previous output — so the generator saw every table as already
 * created and produced an empty file. A generator that reads its own output is
 * a generator that works exactly once.
 */
/**
 * Files that are OUTPUT, not migrations.
 *
 * ⚠️ `SETUP-COMPLETE.sql` is the assembled bundle and lives in `docs/` without
 * an underscore, so a filter that only skipped `_`-prefixed files read it —
 * found every table already created — and produced an empty schema. The second
 * time this generator read its own output and produced nothing.
 */
const GENERATED = new Set(['base-schema-migration.sql', 'SETUP-COMPLETE.sql'])

const otherMigrations = readdirSync('docs')
  .filter((file) => file.endsWith('.sql') && !file.startsWith('_') && !GENERATED.has(file))
  .map((file) => readFileSync(join('docs', file), 'utf8'))
  .join(String.fromCharCode(10))

const alreadyCreated = new Set(
  [
    ...otherMigrations.matchAll(
      /CREATE (?:TABLE|VIEW|MATERIALIZED VIEW) (?:IF NOT EXISTS )?([a-z0-9_]+)/gi,
    ),
  ].map((match) => match[1].toLowerCase()),
)

/* ─── Parse the dump ─────────────────────────────────────────────────────── */

const lines = dump.split(/\r?\n/)
const tables = []
let current = null

for (const raw of lines) {
  const header = /^"?TABLE ([a-z0-9_]+) \((\d+) rows(?:, RLS (on|off))?\)/.exec(raw)

  if (header) {
    current = { name: header[1], rows: Number(header[2]), rls: header[3] === 'on', columns: [] }
    tables.push(current)
    continue
  }

  if (!current) continue

  // `  column_name type possibly with spaces NOT NULL`
  const column = /^\s{2}([a-z0-9_]+)\s+(.+?)(\s+NOT NULL)?\s*$/.exec(raw)
  if (column) {
    current.columns.push({
      name: column[1],
      type: column[2].trim().replace(/"$/, ''),
      notNull: Boolean(column[3]),
    })
  }
}

/* ─── Emit ───────────────────────────────────────────────────────────────── */

const needed = tables.filter((table) => !alreadyCreated.has(table.name) && table.columns.length > 0)

/**
 * Defaults the dump did not record, restored by inference.
 *
 * ⚠️ THIS IS THE FIX FOR A FULL-DAY OUTAGE, AND IT IS WORTH THE LENGTH.
 *
 * The dump recorded names, types and NOT NULL — no defaults. The first version
 * of this generator left it that way, reasoning that inventing a default is
 * worse than omitting one. That is true for SOME columns and catastrophic for
 * others, and the difference is whether the value can be INFERRED.
 *
 * What omitting them actually cost:
 *
 *     workspace.service.ts   .insert({ workspace_id, user_id, role: 'owner' })
 *     schema                 has_access boolean NOT NULL     ← no DEFAULT
 *                            → 23502 not-null violation
 *                            → no membership row
 *                            → every later request 403, with `userId` set and
 *                              `workspaceId` null in the logs
 *
 * Which reads like a broken authorization system, not a missing default. It
 * took a day and three wrong hypotheses to find.
 *
 * The rule:
 *
 *   INFERABLE     boolean, timestamp, counter, jsonb. The default follows from
 *                 the type and the name, and the application already behaves
 *                 as though it is there.            → emit a default
 *
 *   NOT INFERABLE `slug`, `public_token`, `key`. These are IDENTITY. A default
 *                 of `''` lets two workspaces share an empty slug, and the
 *                 unique index meant to prevent that then rejects the second
 *                 workspace anybody creates.        → emit nothing
 *
 * ⚠️ `is_active` defaults TRUE and the read flags FALSE. The asymmetry is
 * deliberate: a newly created customer is active, a newly created notification
 * has not been read. A single blanket boolean rule gets one of the two
 * backwards on every table in the schema.
 */
const UNREAD_FLAGS =
  /^(is_read|is_archived|is_pinned|is_deleted|is_locked|is_final|is_group|is_system)$/
const LIST_SHAPED = /(history|snapshot|outcomes|features|items|list)$/

function inferredDefault(column) {
  const { name, type } = column

  // Every table here uses `uuid PRIMARY KEY DEFAULT gen_random_uuid()`. Without
  // it every INSERT fails on a null primary key.
  if (name === 'id' && type === 'uuid') return 'gen_random_uuid()'

  if (type.startsWith('boolean')) return UNREAD_FLAGS.test(name) ? 'false' : 'true'
  if (type.startsWith('timestamp') && name.endsWith('_at')) return 'now()'
  if (/^(integer|bigint|smallint|numeric|real|double precision)/.test(type)) return '0'
  if (type.startsWith('jsonb')) return LIST_SHAPED.test(name) ? "'[]'::jsonb" : "'{}'::jsonb"

  // text, uuid, varchar — identity. Left alone on purpose.
  return null
}

function columnDdl(column) {
  const parts = [`  ${column.name.padEnd(28)} ${column.type}`]
  const fallback = inferredDefault(column)

  if (fallback) parts.push(`DEFAULT ${fallback}`)

  if (column.name === 'id' && column.type === 'uuid') {
    parts.push('PRIMARY KEY')
  } else if (column.notNull) {
    parts.push('NOT NULL')
  }

  return parts.join(' ')
}

/**
 * Enum types the dump referenced but never defined.
 *
 * ⚠️ The dump lists a column's TYPE NAME. For a built-in that is enough to
 * recreate it; for a custom enum it is a name pointing at nothing, and the
 * rebuild fails with `42704: type "workflow_action" does not exist` — on line
 * 883 of a 360KB file, which is a bad place to learn this.
 *
 * The values come from `packages/validation/src/schemas/workflow.schema.ts`,
 * which is where the application defines them. Reading them from the code
 * rather than guessing is the difference between an enum that matches what the
 * backend inserts and one that rejects it at runtime.
 */
const ENUM_TYPES = [
  {
    name: 'workflow_status',
    values: ['pending', 'in_progress', 'approved', 'rejected', 'cancelled'],
    source: 'workflowStatusEnum',
  },
  {
    name: 'workflow_action',
    values: ['approved', 'rejected', 'forwarded', 'cancelled'],
    source: 'workflowActionEnum',
  },
]

const chunks = [
  `-- ============================================================================
-- docs/base-schema-migration.sql
--
-- GENERATED by scripts/generate-base-schema.mjs from a dump of the live
-- database. Do not hand-edit; regenerate.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS IS
--
-- The ${needed.length} tables that were created by hand in the Supabase dashboard, before
-- \`docs/*.sql\` existed. Every migration since ALTERs them and none of them
-- CREATES them — which was invisible until the schema was dropped and the
-- rebuild produced eleven tables out of sixty-five.
--
-- ---------------------------------------------------------------------------
-- ⚠️ WHAT IT DOES NOT CARRY
--
-- The dump recorded names, types and NOT NULL. It did not record foreign keys,
-- unique constraints, check constraints, indexes or defaults, and this file
-- invents none of them — a guessed foreign key pointing the wrong way fails at
-- midnight on a real insert.
--
-- The migrations that run AFTER this one add the constraints, indexes and RLS
-- policies they know about, which is all of the tenancy work. What is lost is
-- whatever was only ever configured in the dashboard.
--
-- ---------------------------------------------------------------------------
-- IT MUST RUN FIRST
--
-- Everything else in the bundle ALTERs these tables.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── Enum types ─────────────────────────────────────────────────────────────
--
-- Referenced by columns below. The dump recorded the type NAMES but not their
-- definitions, so without these the rebuild fails at the first column that
-- uses one.
--
-- Values taken from packages/validation/src/schemas/workflow.schema.ts — the
-- place the application defines them.

${ENUM_TYPES.map(
  (type) => `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${type.name}') THEN
    CREATE TYPE ${type.name} AS ENUM (${type.values.map((v) => `'${v}'`).join(', ')});
  END IF;
END $$;   -- ${type.source}`,
).join('\n\n')}
`,
]

for (const table of needed) {
  chunks.push(`
-- ${table.name}${table.rows > 0 ? ` — held ${table.rows} rows before the reset` : ''}
CREATE TABLE IF NOT EXISTS ${table.name} (
${table.columns.map(columnDdl).join(',\n')}
);`)
}

// RLS is enabled here so no table sits open between this file and the policy
// migrations. Enabled with no policy means nothing is readable — the strict
// direction, and the right one to fail toward.
const rlsTables = needed.filter((table) => table.rls).map((table) => table.name)

if (rlsTables.length > 0) {
  chunks.push(`

-- ─── Row level security ─────────────────────────────────────────────────────
--
-- Turned on here, with NO policy yet. Between this file and the policy
-- migrations these tables are readable by nobody, which is the safe direction
-- to be wrong in. \`tenancy-rls.sql\` and the files after it add the policies.

${rlsTables.map((name) => `ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY;`).join('\n')}`)
}

chunks.push('\n\nCOMMIT;\n')

writeFileSync('docs/base-schema-migration.sql', chunks.join('\n'))

console.log(`Wrote docs/base-schema-migration.sql`)
console.log(
  `  ${needed.length} tables, ${needed.reduce((sum, t) => sum + t.columns.length, 0)} columns`,
)
console.log(`  ${rlsTables.length} with RLS enabled`)
console.log()
console.log('⚠️  No foreign keys, unique constraints or indexes — the dump did not record them.')
console.log('   Add it to the TOP of the ORDER array in scripts/run-migrations.mjs,')
console.log('   then re-run scripts/bundle-migrations.mjs.')
