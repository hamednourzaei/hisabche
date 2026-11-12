import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

describe('cheques-01-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const baseSql = readFileSync(resolve(__dirname, '../../docs/base-schema-migration.sql'), 'utf8')
    const migSql = readFileSync(resolve(__dirname, '../../docs/cheques-01-migration.sql'), 'utf8')
    await pg.sql.unsafe(baseSql)
    await pg.sql.unsafe(migSql)
    await pg.sql.unsafe(migSql)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('enforces unique cheque number per workspace+direction and positive amount', async () => {
    const ws1 = '11111111-1111-4111-8111-111111111111'
    const ws2 = '22222222-2222-4222-8222-222222222222'

    await expect(
      pg.sql`
        INSERT INTO public.cheques (workspace_id, direction, cheque_number, due_date, amount_minor, currency, status)
        VALUES (${ws1}, 'in', 'CHQ-0', '2026-07-01', 0, 'AFN', 'received')
      `,
    ).rejects.toThrow()

    await pg.sql`
      INSERT INTO public.cheques (workspace_id, direction, cheque_number, due_date, amount_minor, currency, status)
      VALUES (${ws1}, 'in', 'CHQ-100', '2026-07-01', 50000, 'AFN', 'received')
    `
    // Same cheque number in ws2 is allowed (tenant isolated)
    await pg.sql`
      INSERT INTO public.cheques (workspace_id, direction, cheque_number, due_date, amount_minor, currency, status)
      VALUES (${ws2}, 'in', 'CHQ-100', '2026-07-01', 50000, 'AFN', 'received')
    `
    // Duplicate in same ws1 is refused
    await expect(
      pg.sql`
        INSERT INTO public.cheques (workspace_id, direction, cheque_number, due_date, amount_minor, currency, status)
        VALUES (${ws1}, 'in', 'CHQ-100', '2026-07-01', 50000, 'AFN', 'received')
      `,
    ).rejects.toThrow()
  })
})
