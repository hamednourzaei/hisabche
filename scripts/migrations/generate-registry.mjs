#!/usr/bin/env node
// ============================================
// scripts/migrations/generate-registry.mjs
//
// Machine-readable Migration Registry: `docs/MIGRATIONS-REGISTRY.json`
// Parses every `docs/*-migration.sql` file, extracts schema metadata,
// links VERIFY-* and *.pg.test.ts coverage, and supports `--check`.
// ============================================

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CHECK_ONLY = process.argv.includes('--check')
const OUT = 'docs/MIGRATIONS-REGISTRY.json'

const docs = readdirSync(path.join(ROOT, 'docs'))
const testsDir = path.join(ROOT, 'backend', 'src', '__tests__')
const testFiles = readdirSync(testsDir).filter((name) => name.endsWith('.pg.test.ts'))
const testBodies = new Map(
  testFiles.map((name) => [name, readFileSync(path.join(testsDir, name), 'utf8')]),
)

const migrations = docs.filter((name) => name.endsWith('-migration.sql')).sort()

function uniqueMatches(text, regex) {
  const set = new Set()
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) set.add(match[1].replace(/"/g, ''))
  }
  return [...set].sort()
}

function classifyDestructive(sql) {
  const upper = sql.toUpperCase()
  if (/\bDROP\s+TABLE\b/.test(upper)) return 'DESTRUCTIVE_DROP_TABLE'
  if (/\bDROP\s+COLUMN\b/.test(upper)) return 'DESTRUCTIVE_DROP_COLUMN'
  if (/\bTRUNCATE\b/.test(upper)) return 'DESTRUCTIVE_TRUNCATE'
  if (/\bDELETE\s+FROM\b/.test(upper)) return 'DATA_MUTATION_DELETE'
  return 'ADDITIVE_OR_IDEMPOTENT'
}

const familyGroups = new Map()
for (const file of migrations) {
  const base = file.slice(0, -'-migration.sql'.length)
  const seqMatch = /^(.*)-(\d{2}[a-z]?)$/.exec(base)
  if (seqMatch) {
    const family = seqMatch[1]
    const list = familyGroups.get(family) ?? []
    list.push({ file, seq: seqMatch[2] })
    familyGroups.set(family, list)
  }
}

const entries = migrations.map((file) => {
  const base = file.slice(0, -'-migration.sql'.length)
  const sql = readFileSync(path.join(ROOT, 'docs', file), 'utf8')
  const verify = docs.includes(`VERIFY-${base}.sql`) ? `docs/VERIFY-${base}.sql` : null
  const byName = testFiles.includes(`${base}.pg.test.ts`) ? `${base}.pg.test.ts` : null
  const pgTestFile =
    byName ?? testFiles.find((name) => testBodies.get(name)?.includes(file)) ?? null

  const dependencies = []
  if (file !== 'base-schema-migration.sql') {
    dependencies.push('base-schema-migration.sql')
  }
  const seqMatch = /^(.*)-(\d{2}[a-z]?)$/.exec(base)
  if (seqMatch) {
    const family = seqMatch[1]
    const list = (familyGroups.get(family) ?? []).sort((a, b) => a.seq.localeCompare(b.seq))
    const idx = list.findIndex((item) => item.file === file)
    if (idx > 0) {
      dependencies.push(list[idx - 1].file)
    }
  }

  const tablesChanged = uniqueMatches(
    sql,
    /(?:CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?|ALTER\s+TABLE(?:\s+IF\s+EXISTS)?)\s+(?:public\.)?([a-zA-Z0-9_"]+)/gi,
  )
  const columnsAdded = uniqueMatches(
    sql,
    /ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z0-9_"]+)/gi,
  )
  const functionsChanged = uniqueMatches(
    sql,
    /CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+(?:public\.)?([a-zA-Z0-9_"]+)/gi,
  )
  const triggersChanged = uniqueMatches(sql, /CREATE\s+TRIGGER\s+([a-zA-Z0-9_"]+)/gi)
  const rlsChanges = uniqueMatches(sql, /CREATE\s+POLICY\s+"?([a-zA-Z0-9_ -]+)"?/gi)
  const constraintsAndIndexes = uniqueMatches(
    sql,
    /(?:ADD\s+CONSTRAINT|CREATE(?:\s+UNIQUE)?\s+INDEX(?:\s+CONCURRENTLY)?(?:\s+IF\s+NOT\s+EXISTS)?)\s+([a-zA-Z0-9_"]+)/gi,
  )

  const hasBackfill =
    /\bUPDATE\s+(?:public\.)?[a-zA-Z0-9_]+\s+SET\b/i.test(sql) || /\bINSERT\s+INTO\b/i.test(sql)
  const hasRollbackBlock = /rollback/i.test(sql)

  return {
    id: base,
    filename: `docs/${file}`,
    dependencies: [...new Set(dependencies)],
    tablesChanged,
    columnsAdded,
    functionsChanged,
    triggersChanged,
    rlsChanges,
    constraintsAndIndexes,
    backfillBehavior: hasBackfill ? 'CONTAINS_DML_BACKFILL' : 'DDL_ONLY',
    verificationScript: verify,
    pgTest: pgTestFile ? `backend/src/__tests__/${pgTestFile}` : null,
    rollbackPolicy: hasRollbackBlock ? 'EXPLICIT_ROLLBACK_BLOCK' : 'FORWARD_RECOVERY_ONLY',
    minBackendVersion: '0.0.1',
    minClientVersion: '0.0.1',
    destructiveClassification: classifyDestructive(sql),
  }
})

const registry = {
  schemaVersion: 1,
  totalMigrations: entries.length,
  withVerifyScript: entries.filter((e) => e.verificationScript !== null).length,
  withoutVerifyScript: entries.filter((e) => e.verificationScript === null).length,
  withPgTest: entries.filter((e) => e.pgTest !== null).length,
  withoutPgTest: entries.filter((e) => e.pgTest === null).length,
  migrations: entries,
}

const serialized = JSON.stringify(registry, null, 2) + '\n'
const outPath = path.join(ROOT, OUT)

if (CHECK_ONLY) {
  if (!existsSync(outPath) || readFileSync(outPath, 'utf8') !== serialized) {
    console.error(`STALE: run node scripts/migrations/generate-registry.mjs`)
    process.exit(1)
  }
  console.log(
    `OK: ${registry.totalMigrations} migrations registered (${registry.withVerifyScript} with VERIFY, ${registry.withPgTest} with PG test)`,
  )
} else {
  writeFileSync(outPath, serialized)
  console.log(
    `Wrote ${OUT}: ${registry.totalMigrations} migrations registered (${registry.withVerifyScript} with VERIFY, ${registry.withPgTest} with PG test)`,
  )
}
