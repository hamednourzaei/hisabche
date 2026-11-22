// ============================================
// backend/src/__tests__/service-delivery-05.pg.test.ts
//
// Real PostgreSQL: docs/service-delivery-05-session-subject-participants-migration.sql
// (run twice for idempotency) on top of package-credit-ledger-01 and service-delivery-01..04:
//   • session subject: customer vs employee
//   • multi-customer participants relation & unique indexes
//   • free-text session_type
//   • participant promotion and integrity triggers
//   • deterministic backfill on historical rows
//
// ⚠️ WHEN THE EMBEDDED BINARY CANNOT START the scenarios are SKIPPED, not passed:
// the status line says so.
// ============================================

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'
import {
  scenarios05,
  setupServiceDelivery05,
  type Run,
} from './helpers/service-delivery-05-scenarios'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-servicedelivery05-')
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

describe('Postgres: session subject, participants & free-text type (service-delivery-05)', () => {
  beforeAll(async () => {
    try {
      await pg.initialise()
      await pg.start()
    } catch {
      // Non-elevated Windows (error 1314) or a quarantined binary: the scenarios are skipped here and run in CI.
      return
    }
    started = true
    const admin = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await admin`CREATE DATABASE servicedelivery05_test;`
    await admin.end()
    sql = postgres(`postgres://postgres:test@localhost:${PORT}/servicedelivery05_test`, { max: 4 })
    await setupServiceDelivery05(run)
  }, 120_000)

  afterAll(async () => {
    if (sql) await sql.end()
    try {
      await pg.stop()
    } catch {
      // ignore
    }
  })

  for (const scenario of scenarios05) {
    it(scenario.name, async (ctx) => {
      if (!started) {
        ctx.skip(
          'PostgreSQL embedded engine unavailable on this host (Win32 shared memory code 1314) - skipped pending live DB or Linux CI',
        )
        return
      }
      await scenario.run(run)
    })
  }
})
