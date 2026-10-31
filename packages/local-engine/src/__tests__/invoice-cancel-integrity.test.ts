// ============================================
// BUG-NEW-003 / BUG-NEW-004: cancelling an invoice offline.
//
//  - A purchase whose goods were already sold must NOT be cancelled: the cost
//    layers it created are what the sale's cost was taken from, and zeroing
//    them leaves the sale costed from nothing and the stock negative.
//  - Cancelling an invoice cancels the payments that settled it AND reverses
//    their ledger entries; the allocation rows stay (soft-deleted) so the
//    history of who paid what is not erased.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, TEST_WAREHOUSE_ID, createTestEngine } from './test-db'

describe('offline invoice cancel keeps cost and ledger intact', () => {
  let db: ReturnType<typeof createTestDb>
  let engine: ReturnType<typeof createTestEngine>

  beforeEach(() => {
    db = createTestDb()
    engine = createTestEngine(db)
  })

  async function productWith(stockPurchase: number) {
    const product = (
      await engine.request({
        method: 'POST',
        path: '/products',
        body: { name: 'کالای آزمایشی', sellPrice: 9, buyPrice: 5 },
      })
    ).data as { id: string }
    const purchase = (
      await engine.request({
        method: 'POST',
        path: '/invoices',
        body: {
          type: 'purchase',
          currency: 'AFN',
          warehouseId: TEST_WAREHOUSE_ID,
          items: [
            {
              productId: product.id,
              productName: 'کالای آزمایشی',
              quantity: stockPurchase,
              unitPrice: 5,
            },
          ],
        },
      })
    ).data as { id: string }
    return { product, purchase }
  }

  it('refuses to cancel a purchase whose layers a sale already consumed', async () => {
    const { product, purchase } = await productWith(10)
    const sale = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [{ productId: product.id, productName: 'کالای آزمایشی', quantity: 4, unitPrice: 9 }],
      },
    })
    expect(sale.status).toBe(201)

    const cancel = await engine.request({ method: 'POST', path: `/invoices/${purchase.id}/cancel` })

    expect(cancel.status).toBe(409)
    expect((cancel.data as { code: string }).code).toBe('PURCHASE_CANCEL_LAYERS_CONSUMED')
    // Nothing moved: the layer is whole, the stock is what the sale left.
    const layer = db.get<{ remaining_qty: number; deleted_at: string | null }>(
      "SELECT remaining_qty, deleted_at FROM cost_layer WHERE source_type = 'invoice' AND source_id = ?",
      [purchase.id],
    )
    expect(layer?.remaining_qty).toBe(6)
    expect(layer?.deleted_at).toBeNull()
    expect(
      db.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [product.id])
        ?.quantity,
    ).toBe(6)
  })

  it('still cancels a purchase nobody has sold from', async () => {
    const { product, purchase } = await productWith(10)

    const cancel = await engine.request({ method: 'POST', path: `/invoices/${purchase.id}/cancel` })

    expect(cancel.status).toBeLessThan(300)
    expect(
      db.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [product.id])
        ?.quantity,
    ).toBe(0)
  })

  it('cancelling a paid sale reverses the payment ledger entry and keeps the allocation row', async () => {
    const { product } = await productWith(10)
    const sale = (
      await engine.request({
        method: 'POST',
        path: '/invoices',
        body: {
          type: 'sale',
          currency: 'AFN',
          warehouseId: TEST_WAREHOUSE_ID,
          items: [
            { productId: product.id, productName: 'کالای آزمایشی', quantity: 2, unitPrice: 100 },
          ],
        },
      })
    ).data as { id: string }
    const pay = await engine.request({
      method: 'POST',
      path: '/payments',
      body: {
        direction: 'in',
        partyType: 'customer',
        partyId: null,
        amount: 200,
        currency: 'AFN',
        allocations: [{ invoiceId: sale.id, amount: 200 }],
      },
    })
    expect(pay.status).toBe(201)
    const paymentId = (pay.data as { id: string }).id
    const journalId = db.get<{ journal_entry_id: string | null }>(
      'SELECT journal_entry_id FROM payment WHERE id = ?',
      [paymentId],
    )?.journal_entry_id
    expect(journalId).toBeTruthy()

    const cancel = await engine.request({ method: 'POST', path: `/invoices/${sale.id}/cancel` })
    expect(cancel.status).toBeLessThan(300)

    expect(
      db.get<{ status: string }>('SELECT status FROM journal_entry WHERE id = ?', [journalId])
        ?.status,
    ).toBe('reversed')
    expect(
      db.get<{ status: string }>('SELECT status FROM payment WHERE id = ?', [paymentId])?.status,
    ).toBe('cancelled')
    // The row is still there, marked deleted: history is not erased.
    const allocation = db.get<{ deleted_at: string | null }>(
      'SELECT deleted_at FROM payment_allocation WHERE payment_id = ?',
      [paymentId],
    )
    expect(allocation).toBeDefined()
    expect(allocation?.deleted_at).not.toBeNull()
  })
})
