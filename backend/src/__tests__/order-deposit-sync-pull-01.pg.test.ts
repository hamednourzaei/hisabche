// ============================================
// backend/src/__tests__/order-deposit-sync-pull-01.pg.test.ts
//
// Real PostgreSQL: docs/order-deposit-sync-pull-01-migration.sql, applied TWICE.
//
// The scenarios live in helpers/order-deposit-sync-pull-01-scenarios.ts so the
// same statements run on PGlite (logic only) on a machine where the embedded
// Postgres binary cannot start. What this file adds is the real engine: real
// trigger firing, real transaction rollback, real VERIFY queries.
//
// ⚠️ WHEN THE EMBEDDED BINARY CANNOT START the scenarios are reported SKIPPED,
// never passed. A skipped Postgres test is not a green test.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'
import {
  scenarios,
  setupOrderDepositSyncPull,
  type Run,
} from './helpers/order-deposit-sync-pull-01-scenarios'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-deposit-sync-pull-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})

const DOCS = join(__dirname, '..', '..', '..', 'docs')

let sql: postgres.Sql | undefined
let started = false

const run: Run = async (text, params) => {
  if (!sql) throw new Error('database not started')
  const rows = await sql.unsafe(text, (params ? [...params] : []) as never[])
  return rows as unknown as Array<Record<string, unknown>>
}

describe('Postgres: the deposit tables are on the canonical delta pull (order-deposit-sync-pull-01)', () => {
  beforeAll(async () => {
    try {
      await pg.start()
    } catch {
      return // non-elevated Windows (error 1314) or a quarantined binary: skipped below, run in CI
    }
    started = true
    const admin = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await admin`CREATE DATABASE deposit_sync_pull_test;`
    await admin.end()
    sql = postgres(`postgres://postgres:test@localhost:${PORT}/deposit_sync_pull_test`)
    await setupOrderDepositSyncPull(run)
  }, 120_000)

  afterAll(async () => {
    if (sql) await sql.end()
    try {
      await pg.stop()
    } catch {
      // ignore teardown error on non-elevated platform
    }
  })

  for (const scenario of scenarios) {
    it(scenario.name, async (context) => {
      if (!started) context.skip()
      await scenario.run(run)
    })
  }

  it('the VERIFY file reports every table on the log with no missing rows', async (context) => {
    if (!started) context.skip()
    const verify = readFileSync(join(DOCS, 'VERIFY-order-deposit-sync-pull-01.sql'), 'utf8')
    // `unsafe` with a multi-statement file returns one array per statement.
    const results = (await sql!.unsafe(verify)) as unknown as Array<Array<Record<string, unknown>>>

    // 1. the version column: three rows, bigint, NOT NULL.
    const versions = results[0] ?? []
    expect(versions).toHaveLength(3)
    for (const row of versions) {
      expect(row.data_type).toBe('bigint')
      expect(row.is_nullable).toBe('NO')
    }

    // 2. both triggers per table, enabled.
    const triggers = results[1] ?? []
    expect(triggers).toHaveLength(6)
    expect(triggers.every((row) => row.enabled === 'O')).toBe(true)

    // 3. nothing existing is missing from the change log.
    const [missing] = results[2] ?? []
    expect(Number(missing?.missing_log_rows)).toBe(0)
    expect(Number(missing?.total_deposit_rows)).toBeGreaterThan(0)

    // 4. exactly the three entity names the client knows.
    const names = (results[3] ?? []).map((row) => row.entity_type)
    expect(names).toEqual(['order_deposit_applications', 'order_deposit_refunds', 'order_deposits'])
  })
})
