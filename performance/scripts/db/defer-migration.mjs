#!/usr/bin/env node
// ============================================================================
// performance/scripts/db/defer-migration.mjs
//
// DEFER one docs/*.sql file past its alphabetical queue position, and record
// why. Used for the maintenance class of file: it ALTERs / REVOKEs objects
// that are created by a file sorting LATER in the runner's extras order, so at
// its canonical position it cannot run — but once the queue is complete, every
// prerequisite exists and the file applies cleanly, last, which is exactly
// what its content describes itself as (e.g. linter-2026-09-14 pins search_path
// on functions a phase file creates).
//
// The record carries the runner's exact checksum, so the queue treats the file
// as applied and continues. `undefer` removes the record — run it before the
// `--only` application so the runner actually executes the file.
//
// USAGE
//   node performance/scripts/db/defer-migration.mjs defer   <file.sql> "<reason>"
//   node performance/scripts/db/defer-migration.mjs undefer <file.sql>
// ============================================================================

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

import { LAB_URL, assertLocal, REPO_ROOT } from '../lib/lab-config.mjs'
import pg from 'pg'

const { Client } = pg

const [command, fileName, reason] = process.argv.slice(2)
if (!command || !fileName || (command === 'defer' && !reason)) {
  console.error('usage: defer-migration.mjs <defer <file.sql> "<reason>" | undefer <file.sql>>')
  process.exit(2)
}

const client = new Client({
  connectionString: assertLocal(LAB_URL),
  application_name: 'lab-db:defer',
})
await client.connect()

if (command === 'defer') {
  const sql = readFileSync(join(REPO_ROOT, 'docs', fileName), 'utf8')
  const checksum = createHash('sha256').update(sql).digest('hex').slice(0, 16)
  await client.query(
    `INSERT INTO schema_migrations (name, checksum, applied_by) VALUES ($1, $2, $3)
     ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum, applied_by = EXCLUDED.applied_by`,
    [fileName, checksum, `capacity-lab:DEFERRED (${reason})`],
  )
  console.log(`deferred: ${fileName}  ${checksum}`)
  console.log(`run later:  node performance/scripts/db/defer-migration.mjs undefer ${fileName}`)
  console.log(
    `then:       node performance/scripts/db/apply-migrations.mjs --apply --only ${fileName}`,
  )
} else if (command === 'undefer') {
  const result = await client.query('DELETE FROM schema_migrations WHERE name = $1', [fileName])
  console.log(`undeferred: ${fileName} (${result.rowCount} record removed)`)
} else {
  console.error(`unknown command "${command}"`)
  process.exit(2)
}

await client.end()
