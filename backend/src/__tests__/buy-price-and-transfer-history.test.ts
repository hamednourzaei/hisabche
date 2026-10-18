// Owner, 18 Oct 2026: a gearbox bought at 20M, then at 25M — the warehouse still
// said 20M; and a transfer halakoi → حاجی read «افزایش +۱», history 12 vs 11 on hand.
import { describe, expect, it, vi } from 'vitest'

import { latestBuyPrices } from '../services/inventory/buy-price.domain'

const rows: Array<Record<string, unknown>> = []

vi.mock('../db', () => {
  const chain = (result: () => unknown) => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'limit']) q[m] = () => q
    q.maybeSingle = async () => ({ data: { id: 'p1', name: 'گیربوکس', quantity: 11 }, error: null })
    q.then = (resolve: (v: unknown) => void) => resolve(result())
    return q
  }
  return {
    supabase: { from: () => chain(() => ({ data: rows, error: null })) },
  }
})

const { StockHistoryService } = await import('../services/inventory/stock-history.service')

describe('stock history — a transfer is not new stock', () => {
  it('reproduces the owner’s history: 8 −4 +6 +1, then a transfer → 11, not 12', async () => {
    rows.push(
      { id: '1', type: 'purchase', quantity: 8, to_warehouse_id: 'halakoi', created_at: '1' },
      { id: '2', type: 'sale', quantity: -4, from_warehouse_id: 'halakoi', created_at: '2' },
      { id: '3', type: 'purchase', quantity: 6, to_warehouse_id: 'halakoi', created_at: '3' },
      { id: '4', type: 'purchase', quantity: 1, to_warehouse_id: 'halakoi', created_at: '4' },
      {
        id: '5',
        type: 'transfer',
        quantity: 1,
        from_warehouse_id: 'halakoi',
        to_warehouse_id: 'haji',
        created_at: '5',
      },
    )
    const history = await new StockHistoryService().get(
      { workspaceId: 'ws', userId: 'u' } as never,
      'p1',
    )
    expect(history.movementTotal).toBe(11)
    expect(history.storedQuantity).toBe(11)
    expect(history.movements.map((m) => m.balance)).toEqual([8, 4, 10, 11, 11])
    expect(history.movements.map((m) => m.isTransfer)).toEqual([false, false, false, false, true])
  })
})

describe('latestBuyPrices — «قیمت خرید» follows the last purchase', () => {
  const product = new Map([['g', { id: 'g', unit: 'custom', currency: 'AFN' }]])
  const purchase = (over: Partial<Parameters<typeof latestBuyPrices>[0]> = {}) => ({
    currency: 'AFN',
    exchangeRate: null,
    booksCurrency: 'AFN',
    lines: [{ productId: 'g', quantity: 1, unitPrice: 25_000_000, unit: 'custom' }],
    ...over,
  })

  it('20M → 25M in the same currency', () => {
    expect(latestBuyPrices(purchase(), product).get('g')).toBe(25_000_000)
  })

  it('a dollar purchase converts at the invoice’s own rate', () => {
    const p = latestBuyPrices(
      purchase({
        currency: 'USD',
        exchangeRate: 75,
        lines: [{ productId: 'g', quantity: 1, unitPrice: 400, unit: 'custom' }],
      }),
      product,
    )
    expect(p.get('g')).toBe(30_000)
  })

  it('leaves the price alone when it cannot be honest', () => {
    // another unit, no rate, zero price, unknown product
    expect(
      latestBuyPrices(
        purchase({ lines: [{ productId: 'g', quantity: 1, unitPrice: 5, unit: 'gram' }] }),
        product,
      ).size,
    ).toBe(0)
    expect(latestBuyPrices(purchase({ currency: 'USD' }), product).size).toBe(0)
    expect(
      latestBuyPrices(
        purchase({ lines: [{ productId: 'g', quantity: 1, unitPrice: 0, unit: 'custom' }] }),
        product,
      ).size,
    ).toBe(0)
    expect(latestBuyPrices(purchase(), new Map()).size).toBe(0)
  })
})
