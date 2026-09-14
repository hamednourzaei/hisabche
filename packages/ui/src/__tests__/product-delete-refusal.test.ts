import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { productDeleteRefusal } from '../lib/warehouse/delete-refusal'

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
const t = (k: string) => k

describe('BUG-001 — refused product delete (UI)', () => {
  it('names the reason from the server code', () => {
    expect(productDeleteRefusal({ code: 'PRODUCT_HAS_INVOICE_ITEMS' }, t)).toBe(
      'warehouse.deleteHasSales',
    )
    expect(productDeleteRefusal({ code: 'PRODUCT_HAS_STOCK_MOVEMENTS' }, t)).toBe(
      'warehouse.deleteHasStockHistory',
    )
    expect(productDeleteRefusal(new Error('x'), t)).toBe('warehouse.deleteFailed')
  })

  it('the list moves a product to the trash only AFTER the server deleted it', () => {
    const src = strip(readFileSync(join(__dirname, '../hooks/warehouse/use-warehouse.ts'), 'utf8'))
    const del = src.indexOf('await deleteProduct.mutateAsync(product.id)')
    const trash = src.indexOf('moveToTrash({')
    expect(del).toBeGreaterThan(-1)
    expect(trash).toBeGreaterThan(del)
    expect(src).toContain('toast.error(productDeleteRefusal(error, t))')
  })

  it('the detail page catches the refusal instead of an unhandled rejection', () => {
    const src = strip(
      readFileSync(
        join(
          __dirname,
          '../components/ui/warehouse-detail/containers/warehouse-detail-container.tsx',
        ),
        'utf8',
      ),
    )
    expect(src).toMatch(/try \{\s*await deleteProduct\.mutateAsync\(id!\)\s*\} catch/)
  })

  it.each(['fa', 'af', 'en'])('%s has the three messages', (lang) => {
    const m = JSON.parse(
      readFileSync(join(__dirname, `../../../i18n/messages/${lang}/common.json`), 'utf8'),
    )
    for (const k of ['deleteHasSales', 'deleteHasStockHistory', 'deleteFailed'])
      expect(m.warehouse[k]).toBeTruthy()
  })
})
