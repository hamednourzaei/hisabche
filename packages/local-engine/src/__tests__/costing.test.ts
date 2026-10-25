// ============================================
// Inventory costing on the device: settings, unvalued stock, late cost.
//
// The device answers with the functions the server calls. These tests drive the
// engine the way the screen does and read the books back — profit, ledger and
// layers — rather than the helpers.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import { createTestDb, TEST_WAREHOUSE_ID, TEST_WORKSPACE_ID } from './test-db'

describe('costing on the device', () => {
  let db: ReturnType<typeof createTestDb>
  let engine: ReturnType<typeof createLocalEngine>
  let productId: string
  const today = new Date().toISOString().slice(0, 10)

  beforeEach(async () => {
    db = createTestDb()
    engine = createLocalEngine(db)
    // Stock with no purchase price: no layer behind it, cost UNKNOWN.
    const res = await engine.request({
      method: 'POST',
      path: '/products',
      body: {
        name: 'چای',
        buyPrice: 0,
        sellPrice: 200,
        quantity: 10,
        warehouseId: TEST_WAREHOUSE_ID,
      },
    })
    productId = (res.data as { id: string }).id
  })

  const unvalued = async () =>
    (
      await engine.request<{
        rows: Array<{
          productId: string
          status: string
          quantity: number
          unitCost: number | null
        }>
        ready: { products: number; quantity: number; value: number }
        blocked: { products: number; quantity: number }
      }>({ method: 'GET', path: '/inventory/unvalued' })
    ).data

  it('settings default to FIFO / block and change only what is sent', async () => {
    const first = await engine.request({ method: 'GET', path: '/inventory/settings' })
    expect(first.data).toEqual({ costingMethod: 'fifo', negativeStock: 'block' })

    const put = await engine.request({
      method: 'PUT',
      path: '/inventory/settings',
      body: { costingMethod: 'avco' },
    })
    expect(put.data).toEqual({ costingMethod: 'avco', negativeStock: 'block' })
    expect((await engine.request({ method: 'GET', path: '/inventory/settings' })).data).toEqual({
      costingMethod: 'avco',
      negativeStock: 'block',
    })

    const bad = await engine.request({
      method: 'PUT',
      path: '/inventory/settings',
      body: { costingMethod: 'lifo' },
    })
    expect(bad.status).toBe(400)
  })

  it('a product with no purchase price is blocked — never valued at zero', async () => {
    const found = await unvalued()
    expect(found.rows).toHaveLength(1)
    expect(found.rows[0]).toMatchObject({ status: 'no_buy_price', unitCost: null, quantity: 10 })
    expect(found.blocked.products).toBe(1)

    const valued = (
      await engine.request<{ valued: number; blocked: { products: number } }>({
        method: 'POST',
        path: '/inventory/unvalued/value',
      })
    ).data
    expect(valued.valued).toBe(0)
    expect(valued.blocked.products).toBe(1)
    expect(db.all('SELECT id FROM cost_layer WHERE product_id = ?', [productId])).toHaveLength(0)
  })

  it('values stock at the purchase price once, however many times it is asked', async () => {
    db.run('UPDATE product SET buy_price = 40 WHERE id = ?', [productId])
    expect((await unvalued()).ready).toMatchObject({ products: 1, quantity: 10, value: 400 })

    const first = (
      await engine.request<{ valued: number; quantity: number; value: number }>({
        method: 'POST',
        path: '/inventory/unvalued/value',
      })
    ).data
    expect(first).toMatchObject({ valued: 1, quantity: 10, value: 400 })

    const again = (
      await engine.request<{ valued: number }>({
        method: 'POST',
        path: '/inventory/unvalued/value',
      })
    ).data
    expect(again.valued).toBe(0)
    expect(
      db.all<{ remaining_qty: number }>(
        'SELECT remaining_qty FROM cost_layer WHERE product_id = ?',
        [productId],
      ),
    ).toHaveLength(1)
    expect((await unvalued()).rows).toHaveLength(0)
  })

  async function sellTwo() {
    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [{ productId, productName: 'چای', quantity: 2, unitPrice: 200, discount: 0 }],
      },
    })
    expect(res.status).toBe(201)
    return (res.data as { id: string }).id
  }

  const cogsNet = () =>
    db.get<{ net: number | null }>(
      `SELECT sum(jl.debit - jl.credit) AS net
         FROM journal_line jl JOIN account a ON a.id = jl.account_id
        WHERE a.workspace_id = ? AND a.role = 'cogs'`,
      [TEST_WORKSPACE_ID],
    )?.net ?? 0

  it('a sale with unknown cost has no profit; giving it a cost makes the profit known and posts it once', async () => {
    const invoiceId = await sellTwo()
    const profit = async () =>
      (
        await engine.request<{ grossProfit: number | null }>({
          method: 'GET',
          path: `/accounting/evidence/invoices/${invoiceId}`,
        })
      ).data.grossProfit
    expect(await profit()).toBeNull()
    expect(cogsNet()).toBe(0)

    // Still no purchase price: nothing is invented, the sale stays uncosted.
    const blocked = (
      await engine.request<{ status: string; uncostedProducts: string[] }>({
        method: 'POST',
        path: `/invoices/${invoiceId}/cost`,
      })
    ).data
    expect(blocked.status).toBe('still_uncosted')
    expect(blocked.uncostedProducts).toEqual([productId])
    expect(await profit()).toBeNull()

    db.run('UPDATE product SET buy_price = 40 WHERE id = ?', [productId])
    const costed = (
      await engine.request<{ status: string; cost: number; posted: number }>({
        method: 'POST',
        path: `/invoices/${invoiceId}/cost`,
      })
    ).data
    expect(costed).toMatchObject({ status: 'costed', cost: 80, posted: 80 })
    expect(cogsNet()).toBe(80)
    expect(await profit()).toBe(320)

    const again = (
      await engine.request<{ status: string; posted: number }>({
        method: 'POST',
        path: `/invoices/${invoiceId}/cost`,
      })
    ).data
    expect(again).toMatchObject({ status: 'nothing_to_cost', posted: 0 })
    expect(cogsNet()).toBe(80)
    expect(today).toBeTruthy()
  })

  it('refuses to cost an invoice that is not there', async () => {
    const res = await engine.request({
      method: 'POST',
      path: '/invoices/9b2f4c1e-0000-4000-8000-000000000009/cost',
    })
    expect(res.status).toBe(404)
  })
})
