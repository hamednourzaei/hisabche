// ============================================
// docs/leave-policy-01-migration.sql — TWICE on a real Postgres, then the
// rules: monthly accrual per employee, idempotency (a month accrued twice
// writes once), the hire date boundary, the anniversary gate for upfront
// policies, and ONE balance where approved leaves are the only consumption.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeEach, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-leave-policy-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/leave_policy`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const E1 = '55555555-5555-4555-8555-555555555551' // hired 2025-01-10, active
const E2 = '55555555-5555-4555-8555-555555555552' // hired 2026-06-01, active
const E3 = '55555555-5555-4555-8555-555555555553' // terminated
const ACTOR = '66666666-6666-4666-8666-666666666666'

const accrue = (period: string) =>
  sql`SELECT public.leave_accrue_month(${SHOP}, ${ACTOR}, ${period}::date) AS count`

const balance = (employee: string, type: string) =>
  sql`SELECT public.leave_balance(${SHOP}, ${employee}, ${type}) AS b`

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('leave_policy')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

    CREATE TABLE public.employees (
      id uuid PRIMARY KEY,
      workspace_id uuid NOT NULL,
      first_name text NOT NULL,
      last_name text NOT NULL,
      hire_date date NOT NULL,
      termination_date date,
      status text
    );
    CREATE TABLE public.leaves (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      employee_id uuid NOT NULL,
      leave_type text NOT NULL,
      start_date date NOT NULL,
      end_date date NOT NULL,
      total_days integer NOT NULL DEFAULT 0,
      duration_units numeric(6,1),
      status text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO public.employees (id, workspace_id, first_name, last_name, hire_date, termination_date, status) VALUES
      ('${E1}', '${SHOP}', 'کارمند', 'یک', '2025-01-10', null, 'active'),
      ('${E2}', '${SHOP}', 'کارمند', 'دو', '2026-06-01', null, 'active'),
      ('${E3}', '${SHOP}', 'کارمند', 'سه', '2025-01-10', '2026-03-01', 'inactive');
  `)
  // ⚠️ Twice. A migration that is not re-runnable is a migration nobody dares
  // run against a database that already has half of it.
  await setup.unsafe(read('leave-policy-01-migration.sql'))
  await setup.unsafe(read('leave-policy-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 1, onnotice: () => {} })
})

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

beforeEach(async () => {
  await sql`DELETE FROM public.leave_accruals`
  await sql`DELETE FROM public.leaves`
  await sql`DELETE FROM public.leave_policies`
})

const monthlyPolicy = (type: string, days: number) =>
  sql`INSERT INTO public.leave_policies (workspace_id, leave_type, annual_days, accrual_method)
      VALUES (${SHOP}, ${type}, ${days}::numeric, 'monthly')`

const approvedLeave = (employee: string, type: string, days: number) =>
  sql`INSERT INTO public.leaves
        (workspace_id, employee_id, leave_type, start_date, end_date, total_days, duration_units, status)
      VALUES (${SHOP}, ${employee}, ${type}, '2026-05-01'::date, '2026-05-09'::date,
              ${days}::int, ${days}::numeric, 'approved')`

describe('leave-policy-01 — accrual', () => {
  it('accrues a twelfth of the annual entitlement, in half days, per active employee', async () => {
    await monthlyPolicy('annual', 24)
    const result = (await accrue('2026-05-01'))[0]?.count as number
    // E1 is active and hired before month end; E2 is hired 2026-06-01 (not
    // yet) and E3 is terminated — so May accrues for E1 only.
    expect(result).toBe(1)
    const rows =
      await sql`SELECT employee_id, accrued FROM public.leave_accruals ORDER BY employee_id`
    expect(Number(rows[0]?.accrued)).toBe(2) // 24 / 12
    expect(rows.length).toBe(1)
  })

  it('is idempotent — the same month accrued twice writes once', async () => {
    await monthlyPolicy('annual', 24)
    await accrue('2026-05-01')
    const second = (await accrue('2026-05-01'))[0]?.count as number
    // No duplicate rows; the second run inserts nothing new.
    const rows = await sql`SELECT id FROM public.leave_accruals`
    expect(rows.length).toBe(1)
    expect(second).toBe(0)
  })

  it('respects the hire date — an employee hired mid-month of a later month is not accrued retroactively', async () => {
    await monthlyPolicy('annual', 12)
    await accrue('2026-05-01')
    // E2 was hired 2026-06-01, so May accrues only for E1.
    const rows = await sql`SELECT employee_id FROM public.leave_accruals`
    expect(rows.length).toBe(1)
    expect(String(rows[0]?.employee_id)).toBe(E1)
  })

  it('pays an upfront policy only in the hire anniversary month', async () => {
    await sql`INSERT INTO public.leave_policies (workspace_id, leave_type, annual_days, accrual_method)
              VALUES (${SHOP}, 'annual', 20::numeric, 'upfront')`
    await accrue('2026-05-01') // not E1's anniversary month (January)
    let rows = await sql`SELECT id FROM public.leave_accruals`
    expect(rows.length).toBe(0)
    await accrue('2026-01-01') // anniversary month
    rows = await sql`SELECT employee_id, accrued FROM public.leave_accruals`
    expect(rows.length).toBe(1)
    expect(Number(rows[0]?.accrued)).toBe(20)
  })

  it('refuses a period that is not the first of a month', async () => {
    const message =
      await sql`SELECT public.leave_accrue_month(${SHOP}, ${ACTOR}, '2026-05-15'::date)`
        .then(() => 'ALLOWED')
        .catch((e: Error) => String(e.message))
    expect(message).toContain('LEAVE_ACCRUAL_NOT_MONTH_START')
  })
})

describe('leave-policy-01 — the balance', () => {
  it('counts approved leaves as the only consumption and shows pending separately', async () => {
    await monthlyPolicy('annual', 24)
    await accrue('2026-05-01')
    await approvedLeave(E1, 'annual', 5)
    await sql`INSERT INTO public.leaves
        (workspace_id, employee_id, leave_type, start_date, end_date, total_days, duration_units, status)
      VALUES (${SHOP}, ${E1}, 'annual', '2026-06-01', '2026-06-03', 3, 3::numeric, 'pending')`
    const b = (await balance(E1, 'annual'))[0]?.b as Record<string, unknown>
    expect(Number(b.accrued)).toBe(2)
    expect(Number(b.consumed)).toBe(5)
    expect(Number(b.pending)).toBe(3)
    expect(Number(b.remaining)).toBe(-3) // over-drawn is visible, not hidden
    expect(Number(b.available_after_pending)).toBe(-6)
  })

  it('reports zero for an employee with no policy and no leaves', async () => {
    const b = (await balance(E2, 'sick'))[0]?.b as Record<string, unknown>
    expect(Number(b.accrued)).toBe(0)
    expect(Number(b.consumed)).toBe(0)
    expect(Number(b.remaining)).toBe(0)
  })
})
