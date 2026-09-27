// ============================================
// Where a scanned product goes on the invoice grid.
//
// Scanning the same product again adds one to its line instead of opening a
// second line — matched by PRODUCT and UNIT, never by barcode text: the same
// product sold by the piece and by the carton is two lines.
//
// The scan is an INPUT, not a posting. It fills a draft line; stock, ledger
// and the receivable move only when the invoice is issued through the normal
// route. The price is seeded from the product and stays editable — and
// `setRowProduct` never overwrites a price the user already typed.
// ============================================

import { COLUMN, type InvoiceGridRow } from '@hisabche/validation'

export interface ScannedProduct {
  id: string
  name: string
  /** Sell (or buy, on a purchase) price as the grid's text. */
  price: string
  unit: string
}

export type ScanPlan =
  | { kind: 'increment'; rowId: string; quantity: string }
  | { kind: 'fill'; rowId: string }
  | { kind: 'append' }

const unitOf = (value: string | undefined) => (value?.trim() ? value.trim() : 'piece')

/** Parse a quantity cell (Persian/Arabic digits allowed) — NaN when not a number. */
function quantityOf(value: string | undefined): number {
  const ascii = (value ?? '')
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٫,]/g, '.')
    .trim()
  return ascii === '' ? NaN : Number(ascii)
}

const isBlank = (row: InvoiceGridRow) =>
  !row.productId && Object.values(row.values).every((v) => !String(v ?? '').trim())

export function planScan(rows: readonly InvoiceGridRow[], product: ScannedProduct): ScanPlan {
  const unit = unitOf(product.unit)
  const same = rows.find(
    (row) => row.productId === product.id && unitOf(row.values[COLUMN.unit]) === unit,
  )
  if (same) {
    const current = quantityOf(same.values[COLUMN.quantity])
    // An unreadable quantity is not silently reset to 1: the line is left for
    // the cashier and the scan opens its own line instead.
    if (Number.isFinite(current)) {
      // Round away float noise (0.1 + 1 = 1.1, not 1.1000000000000001).
      return {
        kind: 'increment',
        rowId: same.id,
        quantity: String(Math.round((current + 1) * 1000) / 1000),
      }
    }
  }
  const blank = rows.find(isBlank)
  return blank ? { kind: 'fill', rowId: blank.id } : { kind: 'append' }
}
