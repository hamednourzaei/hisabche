// ============================================
// backend/src/__tests__/inventory-void-receipt-01.pg.test.ts
//
// Real PostgreSQL: docs/inventory-void-receipt-01-migration.sql (run twice) - a cancelled purchase's cost layers are voided only
// while none of them was drawn from. The scenarios live in helpers/inventory-void-receipt-01-scenarios.ts so they also run on
// PGlite (scripts/pg/run-scenarios.mjs) and on any other real Postgres.
//
// ⚠️ WHEN THE EMBEDDED BINARY CANNOT START the scenarios are reported SKIPPED, never passed.
// ============================================

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'
import {
  scenarios,
  setupVoidReceipt,
  type Run,
} from './helpers/inventory-void-receipt-01-scenarios'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-voidreceipt01-')
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

describe('Postgres: a cancelled purchase voids its cost layers (inventory-void-receipt-01)', () => {
  beforeAll(async () => {
    try {
      await pg.start()
    } catch {
      return // non-elevated Windows (error 1314) or a quarantined binary: skipped below, run in CI
    }
    started = true
    const admin = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await admin`CREATE DATABASE voidreceipt01_test;`
    await admin.end()
    sql = postgres(`postgres://postgres:test@localhost:${PORT}/voidreceipt01_test`, { max: 4 })
    await setupVoidReceipt(run)
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
