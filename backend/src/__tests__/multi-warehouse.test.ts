// Request #90 — multi-warehouse: per-warehouse stat cards, stock that is in no
// warehouse, assigning it, and invoices that name their warehouse.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  checkAssign,
  unassignedQuantities,
  warehouseOverview,
  warehouseProducts,
} from '../services/inventory/warehouse-summary.domain'

const product = (id: string, quantity: number, sell = 10, min: number | null = 5) => ({
  id,
  name: id.toUpperCase(),
  sku: null,
  unit: 'piece',
  quantity,
  sell_price: sell,
  buy_price: 6,
  min_stock_level: min,
})
const warehouses = [
  { id: 'w1', name: 'اصلی', location: 'کابل', is_active: true },
  { id: 'w2', name: 'دوم', location: null, is_active: true },
]

describe('warehouse overview', () => {
  const products = [product('a', 100), product('b', 3), product('c', 0)]
  const stock = [
    { warehouse_id: 'w1', product_id: 'a', quantity: 60 },
    { warehouse_id: 'w2', product_id: 'a', quantity: 30 },
    { warehouse_id: 'w2', product_id: 'b', quantity: 3 },
  ]

  it('each warehouse gets its own value and counts from ITS quantities', () => {
    const view = warehouseOverview(warehouses, products, stock)
    expect(view.warehouses[0]).toMatchObject({
      id: 'w1',
      location: 'کابل',
      summary: { productCount: 1, totalValue: 600, lowStockCount: 0, outOfStockCount: 0 },
    })
    expect(view.warehouses[1]).toMatchObject({
      id: 'w2',
      location: '',
      summary: { productCount: 2, totalValue: 330, lowStockCount: 1 },
    })
  })

  it('stock in no warehouse is reported, not dropped', () => {
    expect([...unassignedQuantities(products, stock)]).toEqual([['a', 10]])
    expect(warehouseOverview(warehouses, products, stock).unassigned).toMatchObject({
      productCount: 1,
      totalValue: 100,
    })
  })

  it('no unassigned stock → null', () => {
    const all = [{ warehouse_id: 'w1', product_id: 'a', quantity: 100 }]
    expect(warehouseOverview(warehouses, [product('a', 100)], all).unassigned).toBeNull()
  })

  it('an empty warehouse still appears, with zeros', () => {
    expect(
      warehouseOverview(warehouses, [], []).warehouses.map((w) => w.summary.productCount),
    ).toEqual([0, 0])
  })
})

describe('warehouse detail', () => {
  const products = [product('a', 100), product('b', 3)]
  const stock = [{ warehouse_id: 'w1', product_id: 'a', quantity: 60 }]

  it('lists the warehouse quantity beside the business total', () => {
    const detail = warehouseProducts('w1', products, stock)
    expect(detail.products).toEqual([
      expect.objectContaining({
        id: 'a',
        quantity: 60,
        totalQuantity: 100,
        sellPrice: 10,
        buyPrice: 6,
        minStockLevel: 5,
      }),
    ])
    expect(detail.summary.totalValue).toBe(600)
  })

  it('null warehouse = the unassigned stock', () => {
    expect(
      warehouseProducts(null, products, stock).products.map((p) => [p.id, p.quantity]),
    ).toEqual([
      ['a', 40],
      ['b', 3],
    ])
  })
})

describe('assigning stock', () => {
  it('only positive quantities, never more than is unassigned', () => {
    expect(checkAssign(5, 10)).toBeNull()
    expect(checkAssign(10, 10)).toBeNull()
    expect(checkAssign(11, 10)).toBe('WAREHOUSE_ASSIGN_EXCEEDS_UNASSIGNED')
    expect(checkAssign(0, 10)).toBe('WAREHOUSE_ASSIGN_QUANTITY_INVALID')
    expect(checkAssign(Number.NaN, 10)).toBe('WAREHOUSE_ASSIGN_QUANTITY_INVALID')
  })

  const service = readFileSync(join(__dirname, '../services/warehouse.service.ts'), 'utf8')
  it('writes both legs in ONE insert (atomic), leaving the product total unchanged', () => {
    const body = service.slice(service.indexOf('async assignStock'))
    expect(body).toContain(".from('stock_movements').insert([")
    expect(body).toContain('{ ...base, quantity: input.quantity, to_warehouse_id: warehouseId }')
    expect(body).toContain('{ ...base, quantity: -input.quantity }')
  })
  it('new warehouses are written with deleted_at null', () => {
    expect(service).toContain('deleted_at: null,')
  })
})

describe('invoices name their warehouse', () => {
  const invoice = readFileSync(join(__dirname, '../services/invoice.service.ts'), 'utf8')
  it('the movement uses the invoice warehouse before the sole-warehouse fallback', () => {
    expect(invoice.replace(/\s+/g, ' ')).toContain(
      '(await this.invoiceWarehouseId(workspaceId, invoiceId)) ?? (await this.soleWarehouseId(workspaceId))',
    )
  })
  it('a requested warehouse must be in this workspace', () => {
    expect(invoice).toContain(
      'if (invoiceWarehouseId) await this.assertInvoiceWarehouse(workspaceId, invoiceWarehouseId)',
    )
    const assert = invoice.slice(invoice.indexOf('private async assertInvoiceWarehouse'))
    expect(assert.slice(0, 600)).toContain(".eq('workspace_id', workspaceId)")
  })
  it('the sole-warehouse fallback ignores deleted warehouses', () => {
    const sole = invoice.slice(invoice.indexOf('private async soleWarehouseId'))
    expect(sole.slice(0, 400)).toContain(".is('deleted_at', null)")
  })
})
