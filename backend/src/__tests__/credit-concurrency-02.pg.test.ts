// ============================================
// backend/src/__tests__/credit-concurrency-02.pg.test.ts
//
// docs/credit-concurrency-02-migration.sql on a REAL PostgreSQL, run after -01 (as the live
// database has it) and then twice (re-runnable).
//
// What 01 got wrong, each asserted here:
//   1. RETURN QUERY handed integer / untyped NULL to bigint columns — PostgreSQL refused it
//      (42804), so the DEFAULT case (no credit limit) failed every sale;
//   2. no RETURN after RETURN QUERY — «off» and «no limit» fell through and added rows;
//   3. EXECUTE granted back to `authenticated`, so its own VERIFY could never be true.
// And the rule itself is unchanged: off, unlimited, cash-only, over-limit, within limit.
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

async function setLimit(mode: string, limit: number | null, owedMinor = 0): Promise<void> {
  await q('UPDATE public.workspaces SET credit_limit_mode = $1', [mode])
  await q('UPDATE public.customers SET credit_limit = $1', [limit])
  await q('DELETE FROM public.invoices')
  if (owedMinor > 0) {
    await q(
      'INSERT INTO public.invoices (workspace_id, customer_id, total, paid_amount) VALUES ($1, $2, $3, 0)',
      [WS, CUSTOMER, owedMinor],
    )
  }
}

describe.skipIf(engine === null)(
  `credit-concurrency-02 on a real PostgreSQL (${engine ?? SKIP_REASON})`,
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
      const fix = doc('credit-concurrency-02-migration.sql')
      await real.runner.exec(fix)
      await real.runner.exec(fix) // re-runnable
    }, 300_000)

    afterAll(async () => {
      await real?.close()
    })

    it('no credit limit (the default): one row, allowed — the case 01 refused with 42804', async () => {
      await setLimit('warn', null)
      const rows = await check(999_999)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.allowed).toBe(true)
    })

    it('mode off: one row, allowed, nothing appended after it', async () => {
      await setLimit('off', 1000)
      const rows = await check(999_999)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.allowed).toBe(true)
    })

    it('cash-only customer: one row, refused CASH_ONLY_CUSTOMER', async () => {
      await setLimit('block', 0)
      const rows = await check(1)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ allowed: false, code: 'CASH_ONLY_CUSTOMER' })
    })

    it('over the limit: one row, refused, with the overage in minor units', async () => {
      await setLimit('block', 1000, 600)
      const rows = await check(500)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ allowed: false, code: 'CREDIT_LIMIT_EXCEEDED' })
      expect(Number(rows[0]?.over_limit_minor)).toBe(100)
      expect(Number(rows[0]?.credit_limit_minor)).toBe(1000)
    })

    it('within the limit, exactly on the boundary: one row, allowed', async () => {
      await setLimit('block', 1000, 600)
      const rows = await check(400)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.allowed).toBe(true)
      expect(Number(rows[0]?.projected_receivable_minor)).toBe(1000)
    })

    it('VERIFY-credit-concurrency-02.sql: every column true', async () => {
      const [row] = await q(
        doc('VERIFY-credit-concurrency-02.sql').replace(/;\s*(--[^\n]*\s*)*$/, ''),
      )
      expect(row).toBeDefined()
      for (const [column, value] of Object.entries(row ?? {})) expect(value, column).toBe(true)
    })
  },
)
