// ============================================
// invoices-seller-01-migration.sql on a real Postgres, run TWICE, then VERIFY.
// ============================================
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

const WS = '11111111-1111-4111-8111-111111111111'
const ISSUER = '22222222-2222-4222-8222-222222222222'
const SELLER = '33333333-3333-4333-8333-333333333333'

describe('invoices-seller-01-migration.sql (PG)', () => {
  let pg: PgTestHandle
  const read = (name: string) => readFileSync(resolve(__dirname, '../../docs', name), 'utf8')

  beforeAll(async () => {
    pg = await startPg()
    await pg.sql.unsafe(read('base-schema-migration.sql'))
    await pg.sql.unsafe(read('invoices-seller-01-migration.sql'))
    await pg.sql.unsafe(read('invoices-seller-01-migration.sql'))
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('stores an override and leaves an issuer sale empty', async () => {
    await pg.sql`
      INSERT INTO public.invoices (invoice_number, type, date, total, workspace_id, user_id, seller_user_id)
      VALUES ('INV-1', 'sale', now(), 100, ${WS}, ${ISSUER}, ${SELLER}),
             ('INV-2', 'sale', now(), 50, ${WS}, ${ISSUER}, NULL)
    `
    const rows = await pg.sql`
      SELECT invoice_number, coalesce(seller_user_id, user_id) AS seller
      FROM public.invoices WHERE workspace_id = ${WS} ORDER BY invoice_number
    `
    expect(rows.map((r) => r.seller)).toEqual([SELLER, ISSUER])
  })

  it('VERIFY is all ok', async () => {
    const checks = await pg.sql.unsafe(read('VERIFY-invoices-seller-01.sql'))
    expect(checks.length).toBe(3)
    for (const row of checks)
      expect({ name: row.check_name, ok: row.ok }).toEqual({ name: row.check_name, ok: true })
  })
})
