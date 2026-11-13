// ============================================
// accrual-schedules-02-migration.sql on a real Postgres, run TWICE.
// A schedule and its periods are written together, or not at all.
// ============================================
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

const WS = '11111111-1111-4111-8111-111111111111'
const OTHER = '99999999-9999-4999-8999-999999999999'
const USER = '22222222-2222-4222-8222-222222222222'
const DOC = '33333333-3333-4333-8333-333333333333'

describe('accrual-schedules-02-migration.sql (PG)', () => {
  let pg: PgTestHandle
  let expense = ''
  let prepaid = ''
  let foreign = ''

  beforeAll(async () => {
    pg = await startPg()
    const read = (name: string) => readFileSync(resolve(__dirname, '../../docs', name), 'utf8')
    await pg.sql.unsafe(read('base-schema-migration.sql'))
    await pg.sql.unsafe(read('accrual-schedules-01-migration.sql'))
    await pg.sql.unsafe(read('accrual-schedules-02-migration.sql'))
    await pg.sql.unsafe(read('accrual-schedules-02-migration.sql'))
    const account = async (workspaceId: string, code: string) => {
      const [row] = await pg.sql`
        INSERT INTO public.accounts (workspace_id, code, name, type)
        VALUES (${workspaceId}, ${code}, ${code}, 'expense') RETURNING id
      `
      return String(row!.id)
    }
    expense = await account(WS, '6100')
    prepaid = await account(WS, '1400')
    foreign = await account(OTHER, '1400')
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  const schedule = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({
      source_document_type: 'invoice',
      source_document_id: DOC,
      description: 'Prepaid rent',
      total_amount_minor: 1_200,
      currency: 'AFN',
      periods_count: 3,
      start_date: '2026-01-31',
      debit_account_id: expense,
      credit_account_id: prepaid,
      ...overrides,
    })
  const periods = (amounts: number[]) =>
    JSON.stringify(
      amounts.map((amount, i) => ({
        period_index: i + 1,
        period_date: `2026-0${i + 1}-28`,
        amount_minor: amount,
      })),
    )

  it('writes the schedule and every period together', async () => {
    const [row] = await pg.sql`
      SELECT public.accrual_schedule_create(${WS}, ${USER}, ${schedule()}::text::jsonb, ${periods([400, 400, 400])}::text::jsonb) AS s
    `
    const created = row!.s as { id: string; periods: unknown[] }
    expect(created.periods).toHaveLength(3)
  })

  it('periods that do not add up write NOTHING', async () => {
    const before = await pg.sql`SELECT count(*)::int AS n FROM public.accrual_schedules`
    await expect(
      pg.sql`SELECT public.accrual_schedule_create(${WS}, ${USER}, ${schedule()}::text::jsonb, ${periods([400, 400, 399])}::text::jsonb)`,
    ).rejects.toThrow(/ACCRUAL_PERIODS_DO_NOT_ADD_UP/)
    const after = await pg.sql`SELECT count(*)::int AS n FROM public.accrual_schedules`
    expect(after[0]!.n).toBe(before[0]!.n)
  })

  it('a zero period is refused before anything is written', async () => {
    await expect(
      pg.sql`SELECT public.accrual_schedule_create(${WS}, ${USER}, ${schedule({ total_amount_minor: 2, periods_count: 3 })}::text::jsonb, ${periods([0, 0, 2])}::text::jsonb)`,
    ).rejects.toThrow(/ACCRUAL_AMOUNT_TOO_SMALL_FOR_PERIODS/)
  })

  it('refuses another business’s account and the same account twice', async () => {
    await expect(
      pg.sql`SELECT public.accrual_schedule_create(${WS}, ${USER}, ${schedule({ credit_account_id: foreign })}::text::jsonb, ${periods([400, 400, 400])}::text::jsonb)`,
    ).rejects.toThrow(/ACCRUAL_ACCOUNT_NOT_FOUND/)
    await expect(
      pg.sql`SELECT public.accrual_schedule_create(${WS}, ${USER}, ${schedule({ credit_account_id: expense })}::text::jsonb, ${periods([400, 400, 400])}::text::jsonb)`,
    ).rejects.toThrow(/ACCRUAL_ACCOUNTS_MUST_DIFFER/)
  })
})
