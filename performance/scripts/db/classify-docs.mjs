#!/usr/bin/env node
// ============================================================================
// performance/scripts/db/classify-docs.mjs
//
// One pass over every docs/*.sql file the repository's runner would queue, and
// one question per file: does it carry SCHEMA (DDL), does it carry DATA writes,
// or is it read-only diagnostics?
//
// Why: the runner's queue is every non-underscore .sql in docs/ — migrations,
// VERIFY files, FINDING diagnostics, operator scripts. When one of them cannot
// run on a fresh database (a diagnostic that queries a table created later in
// the queue, an operator guard that RAISEs until a human edits it), the lab
// must classify it BEFORE deciding anything. This produces the audit artifact
// that decision is recorded against: performance/raw/M1-docs-classification.json
//
// Read-only. Never writes to the database.
// ============================================================================

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { LAB_URL, assertLocal, PERF_ROOT, REPO_ROOT } from '../lib/lab-config.mjs'
import pg from 'pg'

const { Client } = pg

const DOCS = join(REPO_ROOT, 'docs')
const DDL = /^\s*(CREATE|ALTER|DROP|GRANT|REVOKE|COMMENT\s+ON|TRUNCATE)\s/im
const DML = /^\s*(INSERT|UPDATE|DELETE|SELECT\s+INTO|COPY)\s/im

const client = new Client({
  connectionString: assertLocal(LAB_URL),
  application_name: 'lab-db:classify',
})
await client.connect()
const { rows } = await client.query('SELECT name, checksum, applied_by FROM schema_migrations')
await client.end()
const applied = new Map(rows.map((row) => [row.name, row]))

const files = readdirSync(DOCS)
  .filter((file) => file.endsWith('.sql') && !file.startsWith('_'))
  .sort()

const classification = files.map((name) => {
  const sql = readFileSync(join(DOCS, name), 'utf8')
  const record = applied.get(name)
  return {
    name,
    ddl: DDL.test(sql),
    dml: DML.test(sql),
    applied: record ? { checksum: record.checksum, by: record.applied_by } : null,
  }
})

const pending = classification.filter((c) => !c.applied)
const summary = {
  measuredAt: new Date().toISOString(),
  total: classification.length,
  applied: classification.length - pending.length,
  pending: pending.length,
  pendingWithDdl: pending.filter((c) => c.ddl).length,
  pendingReadOnly: pending.filter((c) => !c.ddl).length,
  skippedByLab: classification
    .filter((c) => c.applied?.by?.startsWith('capacity-lab:SKIPPED'))
    .map((c) => c.name),
}

const outPath = join(PERF_ROOT, 'raw', 'M1-docs-classification.json')
writeFileSync(outPath, JSON.stringify({ summary, classification }, null, 2))

console.log(`files ${summary.total} · applied ${summary.applied} · pending ${summary.pending}`)
console.log(
  `pending with DDL ${summary.pendingWithDdl} · pending read-only ${summary.pendingReadOnly}`,
)
console.log('\npending, read-only (cannot change the schema by definition):')
for (const c of pending.filter((c) => !c.ddl)) console.log(`  ${c.name}`)
console.log(`\nwritten: ${outPath}`)
