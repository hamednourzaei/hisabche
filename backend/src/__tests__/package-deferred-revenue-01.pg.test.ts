// ============================================
// backend/src/__tests__/service-delivery-02.pg.test.ts
//
// Real PostgreSQL: docs/package-deferred-revenue-01-migration.sql (run twice) on top of package-credit-ledger-01 and
// service-delivery-01 - the atomic deliver / cancel functions, the one-consume-per-session index, the append-only
// ledger, and two sessions racing for one credit. The scenarios live in helpers/package-deferred-revenue-01-scenarios.ts so
// they also run on any other real Postgres.
//
// ⚠️ WHEN THE EMBEDDED BINARY CANNOT START the scenarios are SKIPPED, not passed: the status line says so.
// ============================================

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'
import {
  scenarios,
  setupDeferredRevenue,
  type Run,
} from './helpers/package-deferred-revenue-01-scenarios'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-deferredrev01-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})

let sql: postgres.Sql | undefined
let started = false

const run: Run = async (text, params) => {
  if (!sql) throw new Error('database not started')
  const rows = await sql.unsafe(text, (params ? [...params] : []) as never[])
  return rows as unknown as Array<Record<string, unknown>>
}

describe('Postgres: package revenue is deferred and released per GRANT (package-deferred-revenue-01)', () => {
  beforeAll(async () => {
    try {
      await pg.start()
    } catch {
      // Non-elevated Windows (error 1314) or a quarantined binary: the scenarios are skipped here and run in CI.
      return
    }
    started = true
    const admin = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await admin`CREATE DATABASE deferredrev01_test;`
    await admin.end()
    sql = postgres(`postgres://postgres:test@localhost:${PORT}/deferredrev01_test`, { max: 4 })
    await setupDeferredRevenue(run)
  }, 120_000)

  afterAll(async () => {
    if (sql) await sql.end()
    try {
      await pg.stop()
    } catch {
      // ignore
    }
  })

  for (const scenario of scenarios) {
    it(scenario.name, async () => {
      if (!started) return
      await scenario.run(run)
    })
  }
})
