import { describe, expect, it } from 'vitest'
import {
  COLUMN,
  applyPrice,
  defaultColumns,
  quoteGoldItemPrice,
  rowToInvoiceItem,
  type InvoiceGridRow,
} from '../index'

describe('gold invoice-line snapshot through quoteGoldItemPrice + applyPrice + grid mapping', () => {
  it('quotes 21K gold line with making charge and preserves locked snapshot into invoice items', () => {
    const columns = defaultColumns('AFN')
    const quote = quoteGoldItemPrice(
      { productId: 'gold-ring-1', kind: 'sale', quantity: 1 },
      {
        karat: 21,
        netWeightMg: 5_000,
        rateSnapshot: {
          rate24kMinorPerGram: 8_000,
          capturedAt: '2026-11-11T10:00:00Z',
          capturedBy: 'user-1',
        },
        makingChargeType: 'fixed',
        makingChargeValue: 2_500,
      },
      undefined,
      [],
      '2026-11-11',
    )

    // 5g × (8000 × 21 / 24 = 7000) + 2500 making = 37500
    expect(quote.unitPriceMinor).toBe(37_500)
    expect(quote.goldSnapshot).toEqual({
      karat: 21,
      netWeightMg: 5_000,
      rate24kMinorPerGram: 8_000,
      makingChargeMinor: 2_500,
      capturedAt: '2026-11-11T10:00:00Z',
      capturedBy: 'user-1',
    })

    const [applied] = applyPrice([{ productId: 'gold-ring-1', quantity: 1 }], [quote])
    expect(applied?.goldSnapshot).toEqual(quote.goldSnapshot)

    const row: InvoiceGridRow = {
      id: 'row-gold',
      productId: 'gold-ring-1',
      productUnit: 'gram',
      ...(applied?.goldSnapshot ? { goldSnapshot: applied.goldSnapshot } : {}),
      values: {
        [COLUMN.description]: '21K Ring',
        [COLUMN.quantity]: '1',
        [COLUMN.unit]: 'gram',
        [COLUMN.unitPrice]: '37500',
      },
    }

    const mapped = rowToInvoiceItem(row, columns, { currency: 'AFN', precision: 0, rates: {} })
    expect(mapped?.goldSnapshot).toEqual(quote.goldSnapshot)
  })
})
