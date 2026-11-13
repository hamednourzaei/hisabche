// ============================================
// bundles-consignment-commission-02-migration.sql on a real Postgres, run TWICE.
// A bundle's component list is replaced in one transaction, with every
// component proven to be this business's own, and no nesting.
// ============================================
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

const WS = '11111111-1111-4111-8111-111111111111'
const OTHER_WS = '99999999-9999-4999-8999-999999999999'

describe('bundles-consignment-commission-02-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const read = (name: string) => readFileSync(resolve(__dirname, '../../docs', name), 'utf8')
    await pg.sql.unsafe(read('base-schema-migration.sql'))
    await pg.sql.unsafe(read('bundles-consignment-commission-01-migration.sql'))
    await pg.sql.unsafe(read('bundles-consignment-commission-02-migration.sql'))
    await pg.sql.unsafe(read('bundles-consignment-commission-02-migration.sql'))
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  async function product(workspaceId: string, name: string): Promise<string> {
    const [row] = await pg.sql`
      INSERT INTO public.products (workspace_id, name) VALUES (${workspaceId}, ${name})
      RETURNING id
    `
    return String(row!.id)
  }

  const items = (list: Array<[string, number]>) =>
    JSON.stringify(list.map(([id, quantity]) => ({ component_product_id: id, quantity })))

  it('saves the list and marks the product a bundle, then an empty list undoes it', async () => {
    const kit = await product(WS, 'Gift kit')
    const tea = await product(WS, 'Tea')
    const cup = await product(WS, 'Cup')

    const [saved] = await pg.sql`
      SELECT public.product_bundle_set_items(${WS}, ${kit}, ${items([
        [tea, 2],
        [cup, 1],
      ])}::text::jsonb) AS items
    `
    expect((saved!.items as unknown[]).length).toBe(2)
    const [k1] = await pg.sql`SELECT kind FROM public.products WHERE id = ${kit}`
    expect(k1!.kind).toBe('bundle')

    await pg.sql`SELECT public.product_bundle_set_items(${WS}, ${kit}, '[]'::jsonb)`
    const [k2] = await pg.sql`SELECT kind FROM public.products WHERE id = ${kit}`
    expect(k2!.kind).toBe('standard')
    const [count] =
      await pg.sql`SELECT count(*)::int AS n FROM public.bundle_items WHERE bundle_product_id = ${kit}`
    expect(count!.n).toBe(0)
  })

  it('refuses a component of another business, and keeps the old list', async () => {
    const kit = await product(WS, 'Kit B')
    const tea = await product(WS, 'Tea B')
    const foreign = await product(OTHER_WS, 'Not ours')
    await pg.sql`SELECT public.product_bundle_set_items(${WS}, ${kit}, ${items([[tea, 1]])}::text::jsonb)`

    await expect(
      pg.sql`SELECT public.product_bundle_set_items(${WS}, ${kit}, ${items([[foreign, 1]])}::text::jsonb)`,
    ).rejects.toThrow(/BUNDLE_COMPONENT_NOT_FOUND/)

    const rows =
      await pg.sql`SELECT component_product_id FROM public.bundle_items WHERE bundle_product_id = ${kit}`
    expect(rows.map((r) => String(r.component_product_id))).toEqual([tea])
  })

  it('refuses nesting: a bundle as a component, and a component made a bundle', async () => {
    const inner = await product(WS, 'Inner')
    const outer = await product(WS, 'Outer')
    const leaf = await product(WS, 'Leaf')
    await pg.sql`SELECT public.product_bundle_set_items(${WS}, ${inner}, ${items([[leaf, 1]])}::text::jsonb)`

    await expect(
      pg.sql`SELECT public.product_bundle_set_items(${WS}, ${outer}, ${items([[inner, 1]])}::text::jsonb)`,
    ).rejects.toThrow(/BUNDLE_COMPONENT_IS_BUNDLE/)

    await pg.sql`SELECT public.product_bundle_set_items(${WS}, ${outer}, ${items([[leaf, 1]])}::text::jsonb)`
    await expect(
      pg.sql`SELECT public.product_bundle_set_items(${WS}, ${leaf}, ${items([[inner, 1]])}::text::jsonb)`,
    ).rejects.toThrow(/BUNDLE_PRODUCT_IS_COMPONENT/)
  })

  it('refuses itself, duplicates and a zero quantity', async () => {
    const kit = await product(WS, 'Kit C')
    const tea = await product(WS, 'Tea C')
    await expect(
      pg.sql`SELECT public.product_bundle_set_items(${WS}, ${kit}, ${items([[kit, 1]])}::text::jsonb)`,
    ).rejects.toThrow(/BUNDLE_COMPONENT_IS_SELF/)
    await expect(
      pg.sql`SELECT public.product_bundle_set_items(${WS}, ${kit}, ${items([
        [tea, 1],
        [tea, 2],
      ])}::text::jsonb)`,
    ).rejects.toThrow(/BUNDLE_COMPONENT_DUPLICATE/)
    await expect(
      pg.sql`SELECT public.product_bundle_set_items(${WS}, ${kit}, ${items([[tea, 0]])}::text::jsonb)`,
    ).rejects.toThrow(/BUNDLE_ITEM_INVALID/)
  })
})
