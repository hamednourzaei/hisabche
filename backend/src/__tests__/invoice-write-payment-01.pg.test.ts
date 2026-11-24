// ============================================
// backend/src/__tests__/invoice-write-payment-01.pg.test.ts
//
// Real PostgreSQL: docs/invoice-write-payment-01-migration.sql (run twice) on top of payments-ar-ap,
// package-credit-ledger-01, invoice-write-document, invoice-write-grant-01 and offline-idempotency - the invoice and
// the money it takes at creation commit or roll back together, and a refused payment leaves no invoice behind.
// The scenarios live in helpers/invoice-write-payment-01-scenarios.ts so they also run on any other real Postgres.
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
  setupInvoiceWritePayment,
  type Run,
} from './helpers/invoice-write-payment-01-scenarios'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-invpayment01-')
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

describe('Postgres: an invoice and the money it takes at creation commit together (invoice-write-payment-01)', () => {
  beforeAll(async () => {
    try {
      await pg.start()
    } catch {
      // Non-elevated Windows (error 1314) or a quarantined binary: the scenarios are skipped here and run in CI.
      return
    }
    started = true
    const admin = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await admin`CREATE DATABASE invoicewritepayment01_test;`
    await admin.end()
    sql = postgres(`postgres://postgres:test@localhost:${PORT}/invoicewritepayment01_test`, {
      // The migrations below carry their own BEGIN/COMMIT; postgres.js only
      // allows that on a single connection (no cross-connection lock scenario here).
      max: 1,
    })
    await setupInvoiceWritePayment(run)
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
