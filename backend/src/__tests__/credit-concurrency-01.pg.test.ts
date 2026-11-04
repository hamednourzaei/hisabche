// ============================================
// backend/src/__tests__/credit-concurrency-01.pg.test.ts
//
// Real PostgreSQL: docs/credit-concurrency-01-migration.sql (run twice) — the atomic credit check behind
// `pg_advisory_xact_lock` that makes InvoiceService.create safe across backend instances (supabase-js has
// no transactions, so the check + write must be serialised by the database, not by one process).
//
// What the PGlite/unit paths cannot prove: two INDEPENDENT connections racing for one customer's remaining
// credit — with the invoice row inserted between the check and the commit, exactly one sale passes.
//
// ⚠️ WHEN THE EMBEDDED BINARY CANNOT START the scenarios are reported SKIPPED, never passed
//    (BLOCKED_EXTERNAL on this machine: embedded-postgres windows-x64 ships 0 .exe).
// ============================================

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DOCS = process.env.CREDIT_DOCS ?? join(process.cwd(), 'docs')
const migration = () => readFileSync(join(DOCS, 'credit-concurrency-01-migration.sql'), 'utf8')

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-creditconc01-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CUSTOMER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

let sql: postgres.Sql | undefined
let started = false

/** A SECOND, fully independent connection — the race must not be ordered by a shared pool. */
let other: postgres.Sql | undefined

const run = async (text: string, params?: readonly unknown[]) => {
  if (!sql) throw new Error('database not started')
  return (await sql.unsafe(text, (params ? [...params] : []) as never[])) as Array<
    Record<string, unknown>
  >
}

/** One sale attempt on its own connection: the check and the INSERT share one transaction (the lock's scope). */
async function attemptSale(
  client: postgres.Sql,
  amountMinor: number,
): Promise<{ allowed: boolean; code: string | null }> {
  return await client.begin(async (tx) => {
    const rows = (await tx`
      SELECT * FROM public.assert_customer_credit(${WS}, ${CUSTOMER}, ${amountMinor})
    `) as Array<Record<string, unknown>>
    const verdict = rows[0] ?? {}
    if (verdict.allowed === true) {
      await tx`
        INSERT INTO public.invoices (id, workspace_id, customer_id, total, paid_amount, status)
        VALUES (gen_random_uuid(), ${WS}, ${CUSTOMER}, ${amountMinor}, 0, 'issued')
      `
    }
    return { allowed: verdict.allowed === true, code: (verdict.code as string) ?? null }
  })
}

beforeAll(async () => {
  try {
    await pg.start()
  } catch {
    return // non-elevated Windows (error 1314) or a quarantined binary: skipped below, run in CI
  }
  started = true
  const admin = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
  await admin`CREATE DATABASE creditconc01_test;`
  await admin.end()
  sql = postgres(`postgres://postgres:test@localhost:${PORT}/creditconc01_test`, { max: 4 })
  other = postgres(`postgres://postgres:test@localhost:${PORT}/creditconc01_test`, { max: 1 })

  for (const role of ['anon', 'authenticated', 'service_role']) {
    await run(
      `DO $r$ BEGIN CREATE ROLE ${role} NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$`,
    )
  }
  // The tables the function reads; the migration itself only creates the function.
  await run(`CREATE TABLE public.workspaces (
    id uuid PRIMARY KEY,
    credit_limit_mode text DEFAULT 'warn'
  )`)
  await run(`CREATE TABLE public.customers (
    id uuid PRIMARY KEY,
    workspace_id uuid NOT NULL,
    credit_limit numeric
  )`)
  await run(`CREATE TABLE public.invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    total numeric NOT NULL DEFAULT 0,
    paid_amount numeric NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'issued',
    deleted_at timestamptz
  )`)
  await run(`INSERT INTO public.workspaces (id) VALUES ('${WS}')`)
  await run(`INSERT INTO public.customers (id, workspace_id) VALUES ('${CUSTOMER}', '${WS}')`)

  await run(migration())
  await run(migration()) // re-runnable
}, 120_000)

afterAll(async () => {
  if (sql) await sql.end()
  if (other) await other.end()
  try {
    await pg.stop()
  } catch {
    // ignore
  }
})

const setLimit = async (mode: string, limit: number | null) => {
  await run(
    `UPDATE public.workspaces SET credit_limit_mode = ${mode === null ? 'NULL' : `'${mode}'`}`,
  )
  await run(`UPDATE public.customers SET credit_limit = ${limit === null ? 'NULL' : String(limit)}`)
  await run(`DELETE FROM public.invoices`)
}

describe('Postgres: atomic customer credit check (credit-concurrency-01)', () => {
  it('behaves exactly like the service rule: off, unlimited, warn/block refusal, cash-only, boundary', async (context) => {
    if (!started) context.skip()

    await setLimit('off', 1000)
    expect(
      (await run(`SELECT * FROM public.assert_customer_credit('${WS}', '${CUSTOMER}', 999999)`))[0]
        ?.allowed,
    ).toBe(true)

    await setLimit('warn', null)
    expect(
      (await run(`SELECT * FROM public.assert_customer_credit('${WS}', '${CUSTOMER}', 999999)`))[0]
        ?.allowed,
    ).toBe(true)

    // limit 1000, already owed 600, sale adds 500 → refused, over by 100
    await setLimit('block', 1000)
    await run(`INSERT INTO public.invoices (workspace_id, customer_id, total, paid_amount)
               VALUES ('${WS}', '${CUSTOMER}', 600, 0)`)
    const refused = (
      await run(`SELECT * FROM public.assert_customer_credit('${WS}', '${CUSTOMER}', 500)`)
    )[0]
    expect(refused?.allowed).toBe(false)
    expect(refused?.code).toBe('CREDIT_LIMIT_EXCEEDED')
    expect(Number(refused?.over_limit_minor)).toBe(100)
    expect(Number(refused?.projected_receivable_minor)).toBe(1100)
    expect(Number(refused?.credit_limit_minor)).toBe(1000)

    // boundary: 400 more lands exactly on the limit → allowed
    expect(
      (await run(`SELECT * FROM public.assert_customer_credit('${WS}', '${CUSTOMER}', 400)`))[0]
        ?.allowed,
    ).toBe(true)

    // cash-only customer (limit 0) owes nothing
    await setLimit('block', 0)
    const cashOnly = (
      await run(`SELECT * FROM public.assert_customer_credit('${WS}', '${CUSTOMER}', 1)`)
    )[0]
    expect(cashOnly?.allowed).toBe(false)
    expect(cashOnly?.code).toBe('CASH_ONLY_CUSTOMER')

    // the writes the rules refuse must also be refused through the override path — the FUNCTION only answers;
    // the permission decision lives in the service, so here a refusal is simply a refusal.
    expect(cashOnly?.allowed).toBe(false)
  })

  it('the lock is released when the transaction fails — a crashed sale never wedges the customer', async (context) => {
    if (!started) context.skip()
    await setLimit('block', 1000)
    await expect(
      sql!.begin(async (tx) => {
        await tx`SELECT * FROM public.assert_customer_credit(${WS}, ${CUSTOMER}, 100)`
        throw new Error('posting failed after the check')
      }),
    ).rejects.toThrow('posting failed after the check')
    // The advisory lock died with that transaction: this must answer, not time out.
    const after = (
      await run(`SELECT * FROM public.assert_customer_credit('${WS}', '${CUSTOMER}', 100)`)
    )[0]
    expect(after?.allowed).toBe(true)
  })

  it('two independent connections race for the last credit: exactly one sale is made', async (context) => {
    if (!started) context.skip()
    if (!other) throw new Error('second connection missing')
    await setLimit('block', 1000)
    // 500 already owed, limit 1000 → only ONE of the two 400-minor sales fits.
    await run(`INSERT INTO public.invoices (workspace_id, customer_id, total, paid_amount)
               VALUES ('${WS}', '${CUSTOMER}', 500, 0)`)

    const both = [attemptSale(sql!, 400), attemptSale(other, 400)]
    const results = await Promise.all(both)
    expect(results.filter((r) => r.allowed)).toHaveLength(1)
    const refusedCode = results.find((r) => !r.allowed)?.code
    expect(refusedCode).toBe('CREDIT_LIMIT_EXCEEDED')

    // And the balances, not the row counts: the receivable is exactly the limit, not over it.
    const receivable = (
      await run(`SELECT COALESCE(SUM(total - paid_amount), 0) AS owed FROM public.invoices`)
    )[0]
    expect(Number(receivable?.owed)).toBe(900)
  })
})
