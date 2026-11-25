/**
 * Static Safety & Invariant Test Suite for docs/_combined-59-migrations.sql
 * Verifies every line and SQL statement in the 59-file bundle against known
 * live-database failure modes (23505 immutable trigger, 23514/23503 check/FK
 * validation on legacy rows, downgraded constraints like accounts_role_check,
 * CONCURRENTLY inside transactions, unbalanced BEGIN/COMMIT, and dependency order).
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const BUNDLE_PATH = 'docs/_combined-59-migrations.sql'
const rawSql = readFileSync(BUNDLE_PATH, 'utf8')

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

const codeOnly = stripSqlComments(rawSql)
const codeLines = codeOnly.split('\n')

test('contains all 59 requested migrations in strict dependency order (no duplicates)', () => {
  const markers = [...rawSql.matchAll(/^-- \[(\d+)\/59\] ([a-z0-9-]+\.sql)$/gm)]
  assert.equal(markers.length, 59, `Expected 59 migration sections, found ${markers.length}`)

  const names = markers.map((m) => m[2])
  assert.equal(new Set(names).size, 59, 'Duplicate migration section found')

  const idx = (name) => names.indexOf(name)
  assert.equal(idx('live-reconciliation-migration.sql'), 0)
  assert.ok(idx('tenancy-workspace-migration.sql') < idx('accounting-core-migration.sql'))
  assert.ok(idx('developer-platform-migration.sql') < idx('developer-platform-02-migration.sql'))
  assert.ok(
    idx('developer-platform-05-oauth-migration.sql') <
      idx('developer-platform-07-marketplace-migration.sql'),
  )
  assert.ok(idx('entitlement-01-migration.sql') < idx('entitlement-02-migration.sql'))
  assert.ok(
    idx('offline-licence-keys-01-migration.sql') < idx('offline-licence-keys-02-migration.sql'),
  )
  assert.ok(
    idx('service-delivery-01-migration.sql') < idx('service-delivery-02-atomic-migration.sql'),
  )
  assert.ok(
    idx('service-delivery-02-atomic-migration.sql') <
      idx('service-delivery-05-session-subject-participants-migration.sql'),
  )
  assert.ok(idx('rls-recursion-fix-migration.sql') < idx('rls-performance-migration.sql'))
  assert.ok(
    idx('phase-a-04-missing-primary-keys-migration.sql') <
      idx('phase-b-01-accounting-source-of-truth-migration.sql'),
  )
})

test('balanced BEGIN/COMMIT blocks and zero CONCURRENTLY statements', () => {
  const begins = (codeOnly.match(/^\s*BEGIN\s*;/gm) || []).length
  const commits = (codeOnly.match(/^\s*COMMIT\s*;/gm) || []).length
  assert.equal(begins, commits, `Unbalanced BEGIN (${begins}) vs COMMIT (${commits})`)
  assert.equal(/\bCONCURRENTLY\b/i.test(codeOnly), false, 'Found CONCURRENTLY inside bundled SQL')
  assert.ok(/NOTIFY pgrst,\s*'reload schema';/i.test(codeOnly), 'Missing schema reload NOTIFY')
})

test('audit_logs backfill skips cleanly when audit_logs_immutable_trigger already exists', () => {
  assert.ok(
    codeOnly.includes("tgname = 'audit_logs_immutable_trigger'"),
    'Missing audit_logs_immutable_trigger guard before UPDATE audit_logs',
  )
})

test('never drops/downgrades existing accounts_role_check or other existing CHECK/FK constraints', () => {
  // Zero top-level unguarded DROP CONSTRAINT statements
  const topLevelDrop = codeOnly.match(
    /^ALTER TABLE\s+(?:public\.)?[a-zA-Z0-9_]+\s+DROP CONSTRAINT IF EXISTS\s+[a-zA-Z0-9_]+\s*;/gm,
  )
  assert.equal(
    topLevelDrop,
    null,
    `Found bare top-level DROP CONSTRAINT that can erase newer widened constraints: ${topLevelDrop?.join(', ')}`,
  )

  // Every indented DROP CONSTRAINT inside a DO $$ block must be guarded by a pg_constraint check
  for (let i = 0; i < codeLines.length; i++) {
    if (/\bDROP CONSTRAINT\b/i.test(codeLines[i])) {
      const prev = codeLines.slice(Math.max(0, i - 10), i).join('\n')
      assert.ok(
        /FROM\s+pg_constraint/i.test(prev),
        `Unguarded DROP CONSTRAINT without pg_constraint check at stripped line ${i + 1}: ${codeLines[i].trim()}`,
      )
    }
  }

  const addStmts = [
    ...codeOnly.matchAll(
      /(?:ALTER TABLE\s+(?:public\.)?[a-zA-Z0-9_]+\s*)?\bADD CONSTRAINT\s+([a-zA-Z0-9_]+)\s+(CHECK|FOREIGN KEY)\b[\s\S]*?;/g,
    ),
  ]
  assert.ok(addStmts.length >= 20, 'Expected at least 20 CHECK/FK ADD CONSTRAINT statements')
  const missingNotValid = addStmts.filter((m) => !/\bNOT\s+VALID\b/i.test(m[0])).map((m) => m[1])
  assert.deepEqual(
    missingNotValid,
    [],
    `CHECK/FK constraints missing NOT VALID: ${missingNotValid.join(', ')}`,
  )
})

test('every VALIDATE CONSTRAINT is guarded by bad_rows check or EXCEPTION handler', () => {
  for (let i = 0; i < codeLines.length; i++) {
    if (/\bVALIDATE CONSTRAINT\b/i.test(codeLines[i])) {
      const ctx = codeLines.slice(Math.max(0, i - 6), Math.min(codeLines.length, i + 6)).join('\n')
      const isGuarded = /EXCEPTION/i.test(ctx) || /IF\s+bad_rows\s*=\s*0/i.test(ctx)
      assert.ok(
        isGuarded,
        `Unguarded VALIDATE CONSTRAINT at stripped line ${i + 1}: ${codeLines[i].trim()}`,
      )
    }
  }
})
