// ============================================
// backend/src/__tests__/order-deposit-apply-refund-01.pg.test.ts
//
// Real PostgreSQL: docs/order-deposit-apply-refund-01-migration.sql (run twice)
// + the REAL bodies of accounting_post_journal_entry, payments_record and
// invoices_project_settlement extracted from docs/ at run time.
//
// The scenarios live in helpers/order-deposit-apply-refund-01-scenarios.ts so
// they also run on PGlite (scripts/pg/run-scenarios.mjs). What only this file
// can prove is the thing PGlite's single connection cannot: TWO transactions
// contending for the same deposit row. That race is where an over-spend would
// happen if the row were not locked.
//
// ⚠️ WHEN THE EMBEDDED BINARY CANNOT START the scenarios are reported SKIPPED,
// never passed. A skipped Postgres test is not a green test.
// ============================================

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'
import {
  applyDeposit,
  createDeposit,
  createInvoice,
  depositBalance,
  refundDeposit,
  scenarios,
  setupOrderDepositApplyRefund,
  type Run,
} from './helpers/order-deposit-apply-refund-01-scenarios'

function assertInvariant(condition: boolean, message: string): void {
  if (!condition) throw new Error(`invariant broken: ${message}`)
}

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-orderdeposit-')
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

describe('Postgres: order deposit apply and refund are one transaction (order-deposit-apply-refund-01)', () => {
  beforeAll(async () => {
    try {
      await pg.start()
    } catch {
      return // non-elevated Windows (error 1314) or a quarantined binary: skipped below, run in CI
    }
    started = true
    const admin = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await admin`CREATE DATABASE orderdeposit_test;`
    await admin.end()
    // max: 4 — the pool is what lets two calls really run on two connections.
    sql = postgres(`postgres://postgres:test@localhost:${PORT}/orderdeposit_test`, { max: 4 })
    await setupOrderDepositApplyRefund(run)
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

  describe('two connections, one deposit row', () => {
    /**
     * Two independent calls are started together. The deposit row lock
     * serialises them; the loser must observe the winner's effect. Without the
     * lock both would read the same available balance and both would succeed —
     * doubling the money out of one deposit.
     */
    async function race<T>(a: () => Promise<T>, b: () => Promise<T>) {
      return Promise.allSettled([a(), b()])
    }

    it('concurrent apply + apply: one wins, the other is refused, the total never exceeds the deposit', async (context) => {
      if (!started) context.skip()
      const invoiceA = await createInvoice(run, { total: 100_000, currency: 'AFN' })
      const invoiceB = await createInvoice(run, { total: 100_000, currency: 'AFN' })
      const depositId = await createDeposit(run, { amountMinor: 100_000, currency: 'AFN' })

      const call = (invoiceId: string, key: string) =>
        applyDeposit(run, {
          depositId,
          invoiceId,
          amountMinor: 60_000,
          fractionDigits: 0,
          key,
        })

      const results = await race(
        () => call(invoiceA, 'race-apply-a-0001'),
        () => call(invoiceB, 'race-apply-b-0001'),
      )

      const ok = results.filter((r) => r.status === 'fulfilled')
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')

      const b = await depositBalance(run, depositId)
      assertInvariant(Number(b.applied_minor) <= 100_000, 'applied never exceeds the receipt')
      assertInvariant(Number(b.remaining_minor) >= 0, 'remaining is never negative')
      assertInvariant(
        ok.length === 1 && failed.length === 1,
        `expected exactly one success, got ${ok.length}: ${failed
          .map((f) => String(f.reason?.message))
          .join(' | ')}`,
      )
      assertInvariant(
        String(failed[0]!.reason?.message).includes('DEPOSIT_INSUFFICIENT_BALANCE'),
        'the loser is refused for insufficient balance, not for a random reason',
      )
    })

    it('concurrent apply + refund: the two together never exceed what was received', async (context) => {
      if (!started) context.skip()
      const invoiceId = await createInvoice(run, { total: 100_000, currency: 'AFN' })
      const depositId = await createDeposit(run, { amountMinor: 100_000, currency: 'AFN' })

      const results = await race(
        () =>
          applyDeposit(run, {
            depositId,
            invoiceId,
            amountMinor: 60_000,
            fractionDigits: 0,
            key: 'race-mixed-apply-01',
          }),
        () =>
          refundDeposit(run, {
            depositId,
            amountMinor: 60_000,
            fractionDigits: 0,
            key: 'race-mixed-refund-1',
          }),
      )

      const b = await depositBalance(run, depositId)
      assertInvariant(
        Number(b.applied_minor) + Number(b.refunded_minor) <= 100_000,
        'apply + refund never exceeds the receipt',
      )
      assertInvariant(Number(b.remaining_minor) >= 0, 'remaining is never negative')
      assertInvariant(
        results.filter((r) => r.status === 'fulfilled').length === 1,
        'exactly one of the two 60000 moves may succeed',
      )
    })

    it('two deposits racing for the same invoice: the invoice is settled once', async (context) => {
      if (!started) context.skip()
      const invoiceId = await createInvoice(run, { total: 30_000, currency: 'AFN' })
      const depositA = await createDeposit(run, { amountMinor: 30_000, currency: 'AFN' })
      const depositB = await createDeposit(run, { amountMinor: 30_000, currency: 'AFN' })

      const results = await race(
        () =>
          applyDeposit(run, {
            depositId: depositA,
            invoiceId,
            amountMinor: 30_000,
            fractionDigits: 0,
            key: 'race-invoice-a-0001',
          }),
        () =>
          applyDeposit(run, {
            depositId: depositB,
            invoiceId,
            amountMinor: 30_000,
            fractionDigits: 0,
            key: 'race-invoice-b-0001',
          }),
      )

      const invoice = await run(
        `SELECT paid_amount::text AS paid FROM public.invoices WHERE id = $1`,
        [invoiceId],
      )
      assertInvariant(
        Number(invoice[0]!.paid) <= 30_000,
        'the invoice is never settled for more than it owes',
      )
      assertInvariant(
        results.filter((r) => r.status === 'fulfilled').length === 1,
        'exactly one apply settles the invoice',
      )
    })
  })
})
