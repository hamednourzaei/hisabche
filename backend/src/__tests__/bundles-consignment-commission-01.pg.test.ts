import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

describe('bundles-consignment-commission-01-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const baseSql = readFileSync(resolve(__dirname, '../../docs/base-schema-migration.sql'), 'utf8')
    const migSql = readFileSync(
      resolve(__dirname, '../../docs/bundles-consignment-commission-01-migration.sql'),
      'utf8',
    )
    await pg.sql.unsafe(baseSql)
    await pg.sql.unsafe(migSql)
    await pg.sql.unsafe(migSql)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('refuses self-referencing bundle item and allows valid bundle + consignment lot', async () => {
    const ws1 = '11111111-1111-4111-8111-111111111111'
    const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const pBundle = '10000000-0000-4000-8000-000000000001'
    const pComp = '10000000-0000-4000-8000-000000000002'
    const wh = '20000000-0000-4000-8000-000000000001'
    const party = '30000000-0000-4000-8000-000000000001'

    await pg.sql`
      INSERT INTO public.products (id, workspace_id, user_id, name, kind)
      VALUES
        (${pBundle}, ${ws1}, ${actor}, 'Starter Kit', 'bundle'),
        (${pComp}, ${ws1}, ${actor}, 'Cable', 'standard')
    `
    await expect(
      pg.sql`
        INSERT INTO public.bundle_items (workspace_id, bundle_product_id, component_product_id, quantity)
        VALUES (${ws1}, ${pBundle}, ${pBundle}, 1)
      `,
    ).rejects.toThrow()

    await pg.sql`
      INSERT INTO public.bundle_items (workspace_id, bundle_product_id, component_product_id, quantity)
      VALUES (${ws1}, ${pBundle}, ${pComp}, 2)
    `
    await pg.sql`
      INSERT INTO public.consignment_lots (workspace_id, direction, party_id, warehouse_id, product_id, quantity, unit_agreed_price_minor, currency)
      VALUES (${ws1}, 'in', ${party}, ${wh}, ${pComp}, 10, 5000, 'AFN')
    `
  })
})
