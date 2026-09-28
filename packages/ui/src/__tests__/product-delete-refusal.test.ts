import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { isProductInUse, productDeleteRefusal } from '../lib/warehouse/delete-refusal'

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

  // 28 Sep 2026: the refusal said «deactivate instead» and nothing on the page
  // could, and a deactivated product stayed on every warehouse list anyway.
  describe('a product with history can still be removed — by deactivating it', () => {
    const read = (rel: string) => strip(readFileSync(join(__dirname, rel), 'utf8'))

    it('only a history refusal counts as «in use»', () => {
      expect(isProductInUse({ code: 'PRODUCT_HAS_INVOICE_ITEMS' })).toBe(true)
      expect(isProductInUse({ code: 'PRODUCT_HAS_STOCK_MOVEMENTS' })).toBe(true)
      expect(isProductInUse(new Error('x'))).toBe(false)
    })

    it.each([
      [
        'detail page',
        '../components/ui/warehouse-detail/containers/warehouse-detail-container.tsx',
        'id!',
      ],
      ['warehouse list', '../hooks/warehouse/use-warehouse.ts', 'product.id'],
    ])('%s offers deactivation on the refusal', (_name, rel, idExpr) => {
      const src = read(rel)
      expect(src).toContain("t('warehouse.deactivateInstead')")
      expect(src).toContain(`updateProduct.mutateAsync({ id: ${idExpr}, isActive: false })`)
    })

    it('the product list shows active products only', () => {
      const src = read('../hooks/warehouse/use-warehouse.ts')
      const call = src.slice(src.indexOf('useProducts({'), src.indexOf('includeSummary: true'))
      expect(call).toContain('isActive: true,')
    })

    it('the warehouse screens (overview, detail, «بدون انبار») read active products only', () => {
      const src = read('../../../../backend/src/services/warehouse.service.ts')
      const fn = src.slice(
        src.indexOf('private async readAllProducts'),
        src.indexOf('private async readAllStock'),
      )
      expect(fn).toContain(".eq('is_active', true)")
    })
  })

  it.each(['fa', 'af', 'en'])('%s has the deactivation messages', (lang) => {
    const m = JSON.parse(
      readFileSync(join(__dirname, `../../../i18n/messages/${lang}/common.json`), 'utf8'),
    )
    for (const k of ['deactivateInstead', 'deactivated', 'deactivateFailed'])
      expect(m.warehouse[k]).toBeTruthy()
  })

  it.each(['fa', 'af', 'en'])('%s has the three messages', (lang) => {
    const m = JSON.parse(
      readFileSync(join(__dirname, `../../../i18n/messages/${lang}/common.json`), 'utf8'),
    )
    for (const k of ['deleteHasSales', 'deleteHasStockHistory', 'deleteFailed'])
      expect(m.warehouse[k]).toBeTruthy()
  })
})
