// ============================================
// backend/src/__tests__/service-delivery-06.pg.test.ts
//
// Real PostgreSQL: docs/service-delivery-06-optional-service-offering-migration.sql
// (run twice for idempotency) on top of package-credit-ledger-01 and service-delivery-01..05:
//   • service_offering_id nullable
//   • constraint chk_service_delivery_has_service: service_offering_id OR session_type
//   • free-text session_type without product catalog item
//
// ⚠️ WHEN THE EMBEDDED BINARY CANNOT START the scenarios are SKIPPED honestly:
// context.skip() is called so Vitest reports skipped tests instead of false greens.
// ============================================

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'
import {
  scenarios06,
  setupServiceDelivery06,
  type Run,
} from './helpers/service-delivery-06-scenarios'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-servicedelivery06-')
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

describe('Postgres: optional service catalog offering (service-delivery-06)', () => {
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
    await admin`CREATE DATABASE servicedelivery06_test;`
    await admin.end()
    sql = postgres(`postgres://postgres:test@localhost:${PORT}/servicedelivery06_test`, { max: 4 })
    await setupServiceDelivery06(run)
  }, 120_000)

  afterAll(async () => {
    if (sql) await sql.end()
    try {
      await pg.stop()
    } catch {
      // ignore
    }
  })

  for (const scenario of scenarios06) {
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
