#!/usr/bin/env node
// ============================================================================
// performance/scripts/db/mark-skipped.mjs
//
// Record ONE docs/*.sql file in `schema_migrations` as applied-with-skip, using
// the EXACT checksum scripts/run-migrations.mjs computes (sha256 of the utf8
// text, first 16 hex chars) — so the repo's runner reports `skip (already
// applied)` and never REFUSES the file as "changed after being applied".
//
// WHY THIS EXISTS: the runner's queue is every non-underscore .sql in docs/,
// not only migrations. A handful of those files are OPERATOR SCRIPTS that
// cannot succeed in an automated run — e.g. WIPE-ALL-BUSINESS-DATA.sql RAISEs
// on purpose until a human edits its confirm flag. The lab needs the schema
// those files do NOT carry, so they are marked and reported — never silently
// dropped, and never "fixed" (they belong to the owner, and editing an applied
// file would change its checksum for every database that ran it).
//
// GUARD: refuses any file that contains DDL. Marking a file that creates or
// alters schema would let the lab's database diverge from the canonical
// rebuild without anyone noticing.
//
// USAGE
//   node performance/scripts/db/mark-skipped.mjs <file.sql> "<reason>"
// ============================================================================

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

import { LAB_URL, assertLocal, REPO_ROOT } from '../lib/lab-config.mjs'
import pg from 'pg'

const { Client } = pg

const fileName = process.argv[2]
const reason = process.argv[3]

if (!fileName || !reason) {
  console.error('usage: node performance/scripts/db/mark-skipped.mjs <file.sql> "<reason>"')
  process.exit(2)
}

const path = join(REPO_ROOT, 'docs', fileName)
const sql = readFileSync(path, 'utf8')

const ddl = /^\s*(CREATE|ALTER|DROP|GRANT|REVOKE|COMMENT\s+ON|TRUNCATE)\s/im.exec(sql)
if (ddl) {
  console.error(
    `REFUSED: ${fileName} contains DDL ("${ddl[0].trim()}"). Skipping a schema-bearing file ` +
      'would silently change what the canonical rebuild produces. Handle it properly instead.',
  )
  process.exit(1)
}

const checksum = createHash('sha256').update(sql).digest('hex').slice(0, 16)

const client = new Client({
  connectionString: assertLocal(LAB_URL),
  application_name: 'lab-db:mark-skipped',
})
await client.connect()
await client.query(
  `INSERT INTO schema_migrations (name, checksum, applied_by)
   VALUES ($1, $2, $3)
   ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum, applied_by = EXCLUDED.applied_by`,
  [fileName, checksum, `capacity-lab:SKIPPED (${reason})`],
)
const row = await client.query(
  'SELECT name, checksum, applied_by FROM schema_migrations WHERE name = $1',
  [fileName],
)
await client.end()

console.log(`marked skipped: ${row.rows[0].name}  ${row.rows[0].checksum}`)
console.log(`reason: ${reason}`)
