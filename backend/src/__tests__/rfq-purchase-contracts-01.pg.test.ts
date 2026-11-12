import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

describe('rfq-purchase-contracts-01-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const baseSql = readFileSync(resolve(__dirname, '../../docs/base-schema-migration.sql'), 'utf8')
    const migSql = readFileSync(
      resolve(__dirname, '../../docs/rfq-purchase-contracts-01-migration.sql'),
      'utf8',
    )
    await pg.sql.unsafe(baseSql)
    await pg.sql.unsafe(migSql)
    await pg.sql.unsafe(migSql)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('creates RFQ, quotation, and unique contract price per product', async () => {
    const ws1 = '11111111-1111-4111-8111-111111111111'
    const sup1 = '22222222-2222-4222-8222-222222222222'
    const prod1 = '33333333-3333-4333-8333-333333333333'
    const contract1 = '44444444-4444-4444-8444-444444444444'

    const rfq = await pg.sql`
      INSERT INTO public.rfqs (workspace_id, title) VALUES (${ws1}, 'Q3 Flour RFQ') RETURNING id
    `
    await pg.sql`
      INSERT INTO public.supplier_quotations (workspace_id, rfq_id, supplier_id, currency, valid_until, total_minor)
      VALUES (${ws1}, ${rfq[0]!.id}, ${sup1}, 'AFN', '2026-12-31', 150000)
    `
    await pg.sql`
      INSERT INTO public.purchase_contract_prices (workspace_id, contract_id, supplier_id, product_id, agreed_unit_price_minor, currency, valid_from, valid_to)
      VALUES (${ws1}, ${contract1}, ${sup1}, ${prod1}, 1200, 'AFN', '2026-01-01', '2026-12-31')
    `
    await expect(
      pg.sql`
        INSERT INTO public.purchase_contract_prices (workspace_id, contract_id, supplier_id, product_id, agreed_unit_price_minor, currency, valid_from, valid_to)
        VALUES (${ws1}, ${contract1}, ${sup1}, ${prod1}, 1300, 'AFN', '2026-01-01', '2026-12-31')
      `,
    ).rejects.toThrow()
  })
})
