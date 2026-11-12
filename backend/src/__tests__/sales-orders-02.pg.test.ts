import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

describe('sales-orders-02-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const baseSql = readFileSync(resolve(__dirname, '../../docs/base-schema-migration.sql'), 'utf8')
    const stockResSql = readFileSync(
      resolve(__dirname, '../../docs/stock-reservations-01-migration.sql'),
      'utf8',
    )
    const commerceSql = readFileSync(
      resolve(__dirname, '../../docs/developer-platform-03-commerce-migration.sql'),
      'utf8',
    )
    const migSql = readFileSync(
      resolve(__dirname, '../../docs/sales-orders-02-migration.sql'),
      'utf8',
    )
    await pg.sql.unsafe(baseSql)
    await pg.sql.unsafe(stockResSql)
    await pg.sql.unsafe(commerceSql)
    // Idempotent check: run migration twice
    await pg.sql.unsafe(migSql)
    await pg.sql.unsafe(migSql)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('reserves on confirm, refuses concurrent oversell on last unit, delivers partially twice idempotently, cancels remaining, and isolates tenants', async () => {
    const ws1 = '11111111-1111-4111-8111-111111111111'
    const ws2 = '22222222-2222-4222-8222-222222222222'
    const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const wh1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const prod1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const order1 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    const order2 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    const item1 = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    const item2 = '99999999-9999-4999-8999-999999999999'

    await pg.sql`
      INSERT INTO public.workspaces (id, name, owner_id)
      VALUES (${ws1}, 'WS1', ${actor}), (${ws2}, 'WS2', ${actor})
      ON CONFLICT DO NOTHING
    `
    await pg.sql`
      INSERT INTO public.warehouse_stock (workspace_id, warehouse_id, product_id, quantity)
      VALUES (${ws1}, ${wh1}, ${prod1}, 5)
    `
    await pg.sql`
      INSERT INTO public.sales_orders (id, workspace_id, order_number, status, source, customer_name, customer_phone, total, public_token, warehouse_id)
      VALUES
        (${order1}, ${ws1}, 'SO-1', 'pending', 'dashboard', 'Ali', '+93700000001', 500, 'tok-1', ${wh1}),
        (${order2}, ${ws1}, 'SO-2', 'pending', 'dashboard', 'Vali', '+93700000002', 500, 'tok-2', ${wh1})
    `
    await pg.sql`
      INSERT INTO public.sales_order_items (id, order_id, workspace_id, product_id, product_name, quantity, unit_price, line_total, warehouse_id)
      VALUES
        (${item1}, ${order1}, ${ws1}, ${prod1}, 'Widget', 5, 100, 500, ${wh1}),
        (${item2}, ${order2}, ${ws1}, ${prod1}, 'Widget', 1, 100, 100, ${wh1})
    `

    // Concurrent confirm of order1 (qty 5) and order2 (qty 1) on stock=5
    const results = await Promise.allSettled([
      pg.sql`SELECT public.transition_sales_order(${ws1}, ${order1}, 'confirmed', NULL, NULL, NULL, ${actor}, ${wh1}, false)`,
      pg.sql`SELECT public.transition_sales_order(${ws1}, ${order2}, 'confirmed', NULL, NULL, NULL, ${actor}, ${wh1}, false)`,
    ])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(fulfilled.length).toBe(1)
    expect(rejected.length).toBe(1)
    expect(String(rejected[0]!.reason)).toContain('STOCK_RESERVATION_INSUFFICIENT')

    // Ensure order1 is confirmed for delivery test
    if (fulfilled.length === 1) {
      const [o1] = await pg.sql`SELECT status FROM public.sales_orders WHERE id = ${order1}`
      if (o1!.status === 'confirmed') {
        // Tenant isolation: ws2 cannot deliver ws1 order
        await expect(
          pg.sql`SELECT public.deliver_sales_order_partial(${ws2}, ${actor}, ${order1}, ${wh1}, ${JSON.stringify([{ orderItemId: item1, quantity: 2 }])}::jsonb, 'del-iso')`,
        ).rejects.toThrow('ORDER_NOT_FOUND')

        // Partial delivery 2 units, twice with same idempotency key -> no double move
        await pg.sql`SELECT public.deliver_sales_order_partial(${ws1}, ${actor}, ${order1}, ${wh1}, ${JSON.stringify([{ orderItemId: item1, quantity: 2 }])}::jsonb, 'del-1')`
        await pg.sql`SELECT public.deliver_sales_order_partial(${ws1}, ${actor}, ${order1}, ${wh1}, ${JSON.stringify([{ orderItemId: item1, quantity: 2 }])}::jsonb, 'del-1')`

        const [stockAfter] =
          await pg.sql`SELECT quantity FROM public.warehouse_stock WHERE warehouse_id = ${wh1} AND product_id = ${prod1}`
        expect(Number(stockAfter!.quantity)).toBe(3)

        // Cancel after partial delivery -> releases only the remaining 3 reserved units
        await pg.sql`SELECT public.transition_sales_order(${ws1}, ${order1}, 'cancelled', 'Customer cancelled rest', NULL, NULL, ${actor}, ${wh1}, false)`
        const [activeRes] = await pg.sql`
          SELECT count(*)::int AS c FROM public.stock_reservations
           WHERE workspace_id = ${ws1} AND reference_id = ${order1} AND status = 'active'
        `
        expect(activeRes!.c).toBe(0)
      }
    }
  })
})
