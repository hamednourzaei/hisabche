// Reported: on /invoices/new a quantity above stock showed no warning. The check
// existed only on the preview step, and read the first 100 products only.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { findOversoldLines } from '../components/ui/invoice-builder/use-oversold-lines'

const dir = join(__dirname, '../components/ui/invoice-builder')
const read = (p: string) => readFileSync(join(dir, p), 'utf8')

describe('findOversoldLines', () => {
  const stock = new Map([
    ['p1', { quantity: 5, unit: 'piece' }],
    ['p2', { quantity: 100, unit: 'kg' }],
  ])

  it('flags a line above stock, with on-hand and after', () => {
    expect(
      findOversoldLines(
        [{ productId: 'p1', productName: 'قند', quantity: 8, unit: 'piece' }],
        stock,
      ),
    ).toEqual([{ productId: 'p1', name: 'قند', onHand: 5, after: -3 }])
  })

  it('sums lines for the same product', () => {
    const lines = [
      { productId: 'p2', productName: 'برنج', quantity: 60, unit: 'kg' },
      { productId: 'p2', productName: 'برنج', quantity: 60, unit: 'kg' },
    ]
    expect(findOversoldLines(lines, stock).map((l) => l.after)).toEqual([-20])
  })

  it('does not flag within stock, unlinked lines, unknown products or other units', () => {
    expect(
      findOversoldLines(
        [
          { productId: 'p1', productName: 'a', quantity: 5, unit: 'piece' },
          { productName: 'free text', quantity: 999 },
          { productId: 'missing', productName: 'b', quantity: 999 },
          { productId: 'p2', productName: 'c', quantity: 500, unit: 'g' },
        ],
        stock,
      ),
    ).toEqual([])
  })
})

describe('the warning is on the form, not only the preview', () => {
  it('the builder container computes and passes it', () => {
    const container = read('containers/invoice-builder-container.tsx')
    expect(container).toContain('useOversoldLines(items, draft.transactionType)')
    expect(container).toContain('stockWarning={<OversoldWarning')
  })

  it('both layouts render it', () => {
    expect(read('invoice-builder-page.tsx')).toContain('{stockWarning}')
    expect(read('mobile/invoice-builder-mobile.tsx')).toContain('{stockWarning}')
  })

  it('stock is not read from a capped product list', () => {
    const hook = read('use-oversold-lines.ts')
    expect(hook).toContain('useProductsByIds')
    expect(read('containers/invoice-preview-container.tsx')).not.toContain('limit: 100')
  })
})
