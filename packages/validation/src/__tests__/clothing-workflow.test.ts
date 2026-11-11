import { describe, expect, it } from 'vitest'
import {
  buildReturnDocument,
  checkVariantAtpAvailability,
  checkVariantBinding,
  planReturnDisposition,
  resolveVariantPrice,
  routeReturnConditionDisposition,
  summarizeVariantStockReport,
} from '../index'

describe('8.1 Clothing Trade: Variants, ATP Reservation Check, Return Routing & Size/Color Report', () => {
  it('binds exact garment size/colour, resolves price override, and enforces ATP reservations', () => {
    const binding = checkVariantBinding({
      workspaceId: 'w1',
      productId: 'p1',
      variantId: 'v-m-black',
      variantsOfProduct: [
        { id: 'v-m-black', workspaceId: 'w1', templateProductId: 'p1', isActive: true },
        { id: 'v-l-white', workspaceId: 'w1', templateProductId: 'p1', isActive: true },
      ],
    })
    expect(binding).toEqual({ ok: true, variantId: 'v-m-black' })

    // Selling parent template without variant is refused when active variants exist
    expect(
      checkVariantBinding({
        workspaceId: 'w1',
        productId: 'p1',
        variantId: null,
        variantsOfProduct: [
          { id: 'v-m-black', workspaceId: 'w1', templateProductId: 'p1', isActive: true },
        ],
      }),
    ).toEqual({ ok: false, code: 'VARIANT_REQUIRED' })

    expect(resolveVariantPrice(1200_00, 1350_00)).toBe(1350_00)
    expect(resolveVariantPrice(1200_00, null)).toBe(1200_00)

    // 5 on hand, 3 actively reserved -> selling 2 passes, selling 3 refused
    const stock = [{ variantId: 'v-m-black', warehouseId: 'wh1', quantity: 5 }]
    const holds = [
      { variantId: 'v-m-black', warehouseId: 'wh1', quantity: 3, status: 'active' as const },
      { variantId: 'v-m-black', warehouseId: 'wh1', quantity: 2, status: 'released' as const },
    ]
    expect(
      checkVariantAtpAvailability({
        demands: [{ variantId: 'v-m-black', warehouseId: 'wh1', quantity: 2 }],
        stock,
        activeReservations: holds,
      }),
    ).toBeNull()
    expect(
      checkVariantAtpAvailability({
        demands: [{ variantId: 'v-m-black', warehouseId: 'wh1', quantity: 3 }],
        stock,
        activeReservations: holds,
      }),
    ).toBe('VARIANT_STOCK_NOT_ENOUGH')
  })

  it('routes clothing returns by physical condition and preserves stock_adjust permission gates', () => {
    // Sealed return -> sellable_stock, seller allowed (needsStockAdjust: false)
    const soundPlan = planReturnDisposition({
      returnType: 'sale_return',
      lines: [{ restockChoice: 'restock' }],
    })
    expect(soundPlan.needsStockAdjust).toBe(false)
    expect(
      routeReturnConditionDisposition({ conditionCode: 'sealed', restockChoice: 'restock' }),
    ).toEqual({ restockChoice: 'restock', bucket: 'sellable_stock', requiresStockAdjust: false })

    // Defective return -> quarantine / scrap -> requires stock.adjust
    expect(
      routeReturnConditionDisposition({ conditionCode: 'defective', restockChoice: 'restock' }),
    ).toEqual({ restockChoice: 'restock', bucket: 'quarantine', requiresStockAdjust: true })

    const scrapPlan = planReturnDisposition({
      returnType: 'sale_return',
      lines: [{ restockChoice: 'scrap' }],
    })
    expect(scrapPlan.needsStockAdjust).toBe(true)

    const doc = buildReturnDocument({
      returnType: 'sale_return',
      sourceLines: [
        { id: 'l1', productId: 'p1', quantity: 2, unitPriceMinor: 1500, discountMinor: 0 },
      ],
      invoiceTaxMinor: 0,
      priorReturnedByLine: {},
      existingReturnCount: 0,
      lines: [
        {
          originalLineId: 'l1',
          quantity: 1,
          restockChoice: 'restock',
          reasonCode: 'customer_change_of_mind',
          conditionCode: 'opened',
        },
      ],
      deductions: [],
      fractionDigits: 2,
    })
    expect(doc.netCreditMinor).toBe(1500)
  })

  it('summarizes clothing stock and margins by size while keeping unknown costs null', () => {
    const report = summarizeVariantStockReport(
      [
        {
          variantId: 'v1',
          sku: 'SHIRT-M-BLK',
          attributes: [
            { name: 'Size', value: 'M' },
            { name: 'Color', value: 'Black' },
          ],
          onHand: 10,
          sold: 4,
          revenueMinor: 4000,
          costMinor: 2400,
        },
        {
          variantId: 'v2',
          sku: 'SHIRT-M-WHT',
          attributes: [
            { name: 'Size', value: 'M' },
            { name: 'Color', value: 'White' },
          ],
          onHand: 5,
          sold: 2,
          revenueMinor: 2000,
          costMinor: 1200,
        },
        {
          variantId: 'v3',
          sku: 'SHIRT-L-BLK',
          attributes: [{ name: 'Size', value: 'L' }],
          onHand: 3,
          sold: 1,
          revenueMinor: 1000,
          costMinor: null, // unknown cost -> never 0
        },
      ],
      'Size',
    )

    expect(report.find((r) => r.attributeValue === 'M')).toEqual({
      attributeName: 'Size',
      attributeValue: 'M',
      onHand: 15,
      sold: 6,
      marginMinor: 2400,
    })
    expect(report.find((r) => r.attributeValue === 'L')?.marginMinor).toBeNull()
  })
})
