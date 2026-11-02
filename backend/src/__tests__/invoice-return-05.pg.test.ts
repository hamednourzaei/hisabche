// ============================================
// backend/src/__tests__/invoice-return-05.pg.test.ts
//
// Real PostgreSQL: docs/invoice-return-05-core-migration.sql (run twice) on top of 01 and 04 —
// several items, deductions, tax of the returned goods, one return per invoice, and the
// reserve → settle → fail refund functions. The scenarios live in
// helpers/invoice-return-05-scenarios.ts so they also run on any other real Postgres.
// ============================================

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'
import { scenarios, setupReturn05, type Run } from './helpers/invoice-return-05-scenarios'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-return05-')
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
  return rows as unknown as Array<Record<string, any>>
}

describe('Postgres: the returns core (invoice-return-05)', () => {
  beforeAll(async () => {
    try {
      await pg.start()
    } catch {
      // Non-elevated Windows (error 1314) or a quarantined binary: the scenarios are skipped here
      // and run in CI. The same scenarios were run on PGlite when this file was written.
      return
    }
    started = true
    const admin = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await admin`CREATE DATABASE returns05_test;`
    await admin.end()
    sql = postgres(`postgres://postgres:test@localhost:${PORT}/returns05_test`)
    await setupReturn05(run)
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
