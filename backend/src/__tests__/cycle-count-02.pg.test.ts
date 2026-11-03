// ============================================
// backend/src/__tests__/cycle-count-02.pg.test.ts
//
// Real PostgreSQL: docs/cycle-count-02-migration.sql (run twice) - a cycle count may adjust a product once (partial unique index
// on stock_movements). The scenarios live in helpers/cycle-count-02-scenarios.ts so they also run on
// PGlite (scripts/pg/run-scenarios.mjs) and on any other real Postgres.
//
// ⚠️ WHEN THE EMBEDDED BINARY CANNOT START the scenarios are reported SKIPPED, never passed.
// ============================================

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'
import { scenarios, setupCycleCount02, type Run } from './helpers/cycle-count-02-scenarios'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-cyclecount02-')
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

describe('Postgres: a cycle count adjusts a product once (cycle-count-02)', () => {
  beforeAll(async () => {
    try {
      await pg.start()
    } catch {
      return // non-elevated Windows (error 1314) or a quarantined binary: skipped below, run in CI
    }
    started = true
    const admin = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await admin`CREATE DATABASE cyclecount02_test;`
    await admin.end()
    sql = postgres(`postgres://postgres:test@localhost:${PORT}/cyclecount02_test`, { max: 4 })
    await setupCycleCount02(run)
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
    it(scenario.name, async (context) => {
      if (!started) context.skip()
      await scenario.run(run)
    })
  }
})
