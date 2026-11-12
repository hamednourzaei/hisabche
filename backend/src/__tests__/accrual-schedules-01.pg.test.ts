import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

describe('accrual-schedules-01-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const baseSql = readFileSync(resolve(__dirname, '../../docs/base-schema-migration.sql'), 'utf8')
    const coreSql = readFileSync(
      resolve(__dirname, '../../docs/accounting-core-migration.sql'),
      'utf8',
    )
    const migSql = readFileSync(
      resolve(__dirname, '../../docs/accrual-schedules-01-migration.sql'),
      'utf8',
    )
    await pg.sql.unsafe(baseSql)
    await pg.sql.unsafe(coreSql)
    await pg.sql.unsafe(migSql)
    await pg.sql.unsafe(migSql)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('enforces unique period index per schedule and positive amounts', async () => {
    const ws1 = '11111111-1111-4111-8111-111111111111'
    const docId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const acc1 = '10000000-0000-4000-8000-000000000001'
    const acc2 = '10000000-0000-4000-8000-000000000002'

    const sched = await pg.sql`
      INSERT INTO public.accrual_schedules (
        workspace_id, source_document_type, source_document_id, description,
        total_amount_minor, currency, periods_count, start_date, debit_account_id, credit_account_id
      ) VALUES (
        ${ws1}, 'bill', ${docId}, 'Prepaid rent', 120000, 'AFN', 12, '2026-01-01', ${acc1}, ${acc2}
      ) RETURNING id
    `
    await pg.sql`
      INSERT INTO public.accrual_schedule_periods (workspace_id, schedule_id, period_index, period_date, amount_minor)
      VALUES (${ws1}, ${sched[0]!.id}, 1, '2026-01-01', 10000)
    `
    await expect(
      pg.sql`
        INSERT INTO public.accrual_schedule_periods (workspace_id, schedule_id, period_index, period_date, amount_minor)
        VALUES (${ws1}, ${sched[0]!.id}, 1, '2026-01-01', 10000)
      `,
    ).rejects.toThrow()
  })
})
