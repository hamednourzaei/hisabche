import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

describe('customer-payment-gateway-01-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const baseSql = readFileSync(resolve(__dirname, '../../docs/base-schema-migration.sql'), 'utf8')
    const migSql = readFileSync(
      resolve(__dirname, '../../docs/customer-payment-gateway-01-migration.sql'),
      'utf8',
    )
    await pg.sql.unsafe(baseSql)
    await pg.sql.unsafe(migSql)
    await pg.sql.unsafe(migSql)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('enforces replay uniqueness and tenant isolation on payment_gateway_events', async () => {
    const ws1 = '11111111-1111-4111-8111-111111111111'
    const ws2 = '22222222-2222-4222-8222-222222222222'

    await pg.sql`
      INSERT INTO public.payment_gateway_events (workspace_id, provider, external_event_id, amount_minor, currency)
      VALUES (${ws1}, 'generic', 'evt-1', 5000, 'AFN')
    `
    await expect(
      pg.sql`
        INSERT INTO public.payment_gateway_events (workspace_id, provider, external_event_id, amount_minor, currency)
        VALUES (${ws1}, 'generic', 'evt-1', 5000, 'AFN')
      `,
    ).rejects.toThrow()

    const ws2Rows = await pg.sql`
      SELECT count(*)::int AS cnt FROM public.payment_gateway_events WHERE workspace_id = ${ws2}
    `
    expect(ws2Rows[0]?.cnt).toBe(0)
  })
})
