// ============================================
// backend/src/__tests__/credit-concurrency-03.pg.test.ts
//
// docs/credit-concurrency-03-credit-units-migration.sql on a REAL PostgreSQL,
// run after -01 and -02 (as the live database has them) and then twice
// (re-runnable).
//
// The defect this proves gone: the backend sends the new invoice in the shared
// 1/100 unit (`minor()`), while `invoices.total - paid_amount` and
// `customers.credit_limit` are major units. The old body added 30 000 to 600
// and compared it with 1 000 — every financed sale over a limit was refused.
//
// The fixture therefore uses the SAME figures the application stores: 600 owed
// and a 1 000 limit (major), a 300 sale (30 000 in the shared unit).
//
// Runs on embedded-postgres (CI) or PGlite (PGLITE_DIR); neither → SKIPPED, never passed.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { engine, openRealDatabase, SKIP_REASON, type RealDatabase } from './helpers/real-postgres'
import type { Row } from './helpers/fake-supabase'

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const doc = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CUSTOMER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

let real: RealDatabase | undefined
const q = (text: string, params?: readonly unknown[]): Promise<Row[]> => {
  if (!real) throw new Error('no database')
  return real.runner.query(text, params)
}

async function check(amountMinor: number): Promise<Row[]> {
  return q('SELECT * FROM public.assert_customer_credit($1::uuid, $2::uuid, $3::bigint)', [
    WS,
    CUSTOMER,
    amountMinor,
  ])
}

/** Totals in MAJOR units, exactly as the tables store them. */
async function setLimit(mode: string, limit: number | null, owed = 0): Promise<void> {
  await q('UPDATE public.workspaces SET credit_limit_mode = $1', [mode])
  await q('UPDATE public.customers SET credit_limit = $1', [limit])
  await q('DELETE FROM public.invoices')
  if (owed > 0) {
    await q(
      'INSERT INTO public.invoices (workspace_id, customer_id, total, paid_amount) VALUES ($1, $2, $3, 0)',
      [WS, CUSTOMER, owed],
    )
  }
}

describe.skipIf(engine === null)(
  `credit-concurrency-03 on a real PostgreSQL (${engine ?? SKIP_REASON})`,
  () => {
    beforeAll(async () => {
      real = await openRealDatabase()
      await real.runner.exec(`
        DO $r$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
        DO $r$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
        DO $r$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
        CREATE TABLE public.workspaces (id uuid PRIMARY KEY, credit_limit_mode text DEFAULT 'warn');
        CREATE TABLE public.customers (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, credit_limit numeric);
        CREATE TABLE public.invoices (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL,
          customer_id uuid NOT NULL, total numeric NOT NULL DEFAULT 0,
          paid_amount numeric NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'issued',
          deleted_at timestamptz
        );
      `)
      await q('INSERT INTO public.workspaces (id) VALUES ($1)', [WS])
      await q('INSERT INTO public.customers (id, workspace_id) VALUES ($1, $2)', [CUSTOMER, WS])
      await real.runner.exec(doc('credit-concurrency-01-migration.sql'))
      await real.runner.exec(doc('credit-concurrency-02-migration.sql'))
      const fix = doc('credit-concurrency-03-credit-units-migration.sql')
      await real.runner.exec(fix)
      await real.runner.exec(fix) // re-runnable
    }, 300_000)

    afterAll(async () => {
      await real?.close()
    })

    it('600 owed + a 300 sale against a 1000 limit is ALLOWED (the case the mixed units refused)', async () => {
      await setLimit('block', 1000, 600)
      const rows = await check(30_000)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.allowed).toBe(true)
      expect(Number(rows[0]?.projected_receivable_minor)).toBe(90_000)
      expect(Number(rows[0]?.credit_limit_minor)).toBe(100_000)
    })

    it('exactly on the boundary: 600 + 400 = 1000 is allowed, projected in the shared unit', async () => {
      await setLimit('block', 1000, 600)
      const rows = await check(40_000)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.allowed).toBe(true)
      expect(Number(rows[0]?.projected_receivable_minor)).toBe(100_000)
    })

    it('600 + 500 = 1100 is refused, with the 100 excess in the shared unit', async () => {
      await setLimit('block', 1000, 600)
      const rows = await check(50_000)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ allowed: false, code: 'CREDIT_LIMIT_EXCEEDED' })
      expect(Number(rows[0]?.over_limit_minor)).toBe(10_000)
      expect(Number(rows[0]?.projected_receivable_minor)).toBe(110_000)
      expect(Number(rows[0]?.credit_limit_minor)).toBe(100_000)
    })

    it('no credit limit: one row, allowed', async () => {
      await setLimit('warn', null)
      const rows = await check(999_999)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.allowed).toBe(true)
    })

    it('mode off: one row, allowed', async () => {
      await setLimit('off', 1000)
      const rows = await check(999_999)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.allowed).toBe(true)
    })

    it('cash-only customer: refused CASH_ONLY_CUSTOMER', async () => {
      await setLimit('block', 0)
      const rows = await check(1)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ allowed: false, code: 'CASH_ONLY_CUSTOMER' })
    })

    it('VERIFY-credit-concurrency-03.sql: every column true', async () => {
      const [row] = await q(
        doc('VERIFY-credit-concurrency-03.sql').replace(/;\s*(--[^\n]*\s*)*$/, ''),
      )
      expect(row).toBeDefined()
      for (const [column, value] of Object.entries(row ?? {})) expect(value, column).toBe(true)
    })
  },
)
