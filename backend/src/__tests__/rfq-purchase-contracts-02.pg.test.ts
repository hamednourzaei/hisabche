// ============================================
// rfq-purchase-contracts-02-migration.sql on a real Postgres, run TWICE.
// Choosing a quotation is one transaction: chosen + others rejected + RFQ
// awarded, or nothing at all.
// ============================================
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

const WS = '11111111-1111-4111-8111-111111111111'
const OTHER_WS = '99999999-9999-4999-8999-999999999999'
const SUPPLIER_A = '22222222-2222-4222-8222-222222222222'
const SUPPLIER_B = '33333333-3333-4333-8333-333333333333'

describe('rfq-purchase-contracts-02-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const read = (name: string) => readFileSync(resolve(__dirname, '../../docs', name), 'utf8')
    await pg.sql.unsafe(read('base-schema-migration.sql'))
    await pg.sql.unsafe(read('rfq-purchase-contracts-01-migration.sql'))
    await pg.sql.unsafe(read('rfq-purchase-contracts-02-migration.sql'))
    await pg.sql.unsafe(read('rfq-purchase-contracts-02-migration.sql'))
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  async function rfqWithTwoQuotations(validUntil = '2026-12-31') {
    const [rfq] = await pg.sql`
      INSERT INTO public.rfqs (workspace_id, title) VALUES (${WS}, 'Flour') RETURNING id
    `
    const [a] = await pg.sql`
      INSERT INTO public.supplier_quotations (workspace_id, rfq_id, supplier_id, currency, valid_until, total_minor)
      VALUES (${WS}, ${rfq!.id}, ${SUPPLIER_A}, 'AFN', ${validUntil}, 150000) RETURNING id
    `
    const [b] = await pg.sql`
      INSERT INTO public.supplier_quotations (workspace_id, rfq_id, supplier_id, currency, valid_until, total_minor)
      VALUES (${WS}, ${rfq!.id}, ${SUPPLIER_B}, 'AFN', ${validUntil}, 160000) RETURNING id
    `
    return { rfq: String(rfq!.id), a: String(a!.id), b: String(b!.id) }
  }

  it('chooses one, rejects the rest and awards the RFQ — in one call', async () => {
    const { rfq, a, b } = await rfqWithTwoQuotations()
    const [row] = await pg.sql`SELECT public.rfq_choose_quotation(${WS}, ${a}, '2026-11-12') AS q`
    expect((row!.q as { status: string }).status).toBe('chosen')

    const states =
      await pg.sql`SELECT id, status FROM public.supplier_quotations WHERE rfq_id = ${rfq}`
    const byId = new Map(states.map((s) => [String(s.id), String(s.status)]))
    expect(byId.get(a)).toBe('chosen')
    expect(byId.get(b)).toBe('rejected')
    const [r] = await pg.sql`SELECT status FROM public.rfqs WHERE id = ${rfq}`
    expect(r!.status).toBe('awarded')
  })

  it('a second choice on the same RFQ is refused and changes nothing', async () => {
    const { a, b } = await rfqWithTwoQuotations()
    await pg.sql`SELECT public.rfq_choose_quotation(${WS}, ${a}, '2026-11-12')`
    await expect(
      pg.sql`SELECT public.rfq_choose_quotation(${WS}, ${b}, '2026-11-12')`,
    ).rejects.toThrow(/RFQ_NOT_OPEN/)
    const [q] = await pg.sql`SELECT status FROM public.supplier_quotations WHERE id = ${b}`
    expect(q!.status).toBe('rejected')
  })

  it('an expired quotation is refused on the business day given', async () => {
    const { a } = await rfqWithTwoQuotations('2026-11-11')
    await expect(
      pg.sql`SELECT public.rfq_choose_quotation(${WS}, ${a}, '2026-11-12')`,
    ).rejects.toThrow(/QUOTATION_EXPIRED/)
  })

  it('another workspace cannot choose this quotation', async () => {
    const { a } = await rfqWithTwoQuotations()
    await expect(
      pg.sql`SELECT public.rfq_choose_quotation(${OTHER_WS}, ${a}, '2026-11-12')`,
    ).rejects.toThrow(/RFQ_QUOTATION_NOT_FOUND/)
  })
})
