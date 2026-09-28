// ============================================
// BUG-080 on screen: the product page shows its total WITH the parts, so
// «۲۰» and a warehouse's «−۱۰» are visibly the same stock; a quantity edit
// says which warehouse it lands in; and every sentence exists in fa/af/en.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../../../..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (p: string) => strip(readFileSync(join(ROOT, p), 'utf8'))
const lookup = (tree: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], tree)

const DIR = 'packages/ui/src/components/ui/warehouse-detail'
const PANEL = `${DIR}/product-warehouse-stock-panel.tsx`
const PAGE = `${DIR}/warehouse-detail-page.tsx`
const CONTAINER = `${DIR}/containers/warehouse-detail-container.tsx`

describe('the product page explains its total', () => {
  it('the per-warehouse panel is rendered on the product page, right after the stock figures', () => {
    const page = read(PAGE)
    expect(page.indexOf('{stockPlaces}')).toBeGreaterThan(
      page.indexOf("t('warehouse.currentStock'"),
    )
    expect(page.indexOf('{stockPlaces}')).toBeLessThan(page.indexOf('{barcodes}'))
    expect(read(CONTAINER)).toContain(
      '<ProductWarehouseStockPanel t={safeT} productId={id} fmt={fmt} />',
    )
  })

  it('it lists every warehouse, the stock in none, and the total they add up to', () => {
    const panel = read(PANEL)
    expect(panel).toContain('data.warehouses.map(')
    expect(panel).toContain("t('warehouse.byWarehouse.unassigned')")
    expect(panel).toContain("t('warehouse.byWarehouse.total')")
    // A negative warehouse is explained where it is seen.
    expect(panel).toContain("t('warehouse.byWarehouse.negativeHelp')")
  })

  it('stock in no warehouse is moved through the existing assign path, never guessed', () => {
    const panel = read(PANEL)
    expect(panel).toContain('useAssignWarehouseStock(target)')
    expect(panel).toContain('amount <= free')
  })
})

describe('a quantity edit says where it lands', () => {
  it('with several warehouses the person picks one; the save sends it', () => {
    const page = read(PAGE)
    expect(page).toContain(
      'quantityChanged && stockWarehouses.length > 1 && !editValues.warehouseId',
    )
    expect(page).toContain('name="warehouseId"')
    expect(read(CONTAINER)).toContain(
      '...(values.warehouseId ? { warehouseId: values.warehouseId } : {})',
    )
  })

  it('after a save the per-warehouse figures are refetched', () => {
    expect(read(CONTAINER)).toContain(
      'queryClient.invalidateQueries({ queryKey: warehouseKeys.all })',
    )
  })
})

describe('words', () => {
  it.each(['fa', 'af', 'en'])('%s has every key the panel, page and container use', (lang) => {
    const messages = JSON.parse(
      readFileSync(join(ROOT, 'packages/i18n/messages', lang, 'common.json'), 'utf8'),
    ) as Record<string, unknown>
    const used = new Set<string>()
    for (const file of [PANEL, PAGE, CONTAINER]) {
      for (const m of read(file).matchAll(/t\('(warehouse\.byWarehouse\.[a-zA-Z_.]+)'/g))
        used.add(m[1] as string)
    }
    for (const code of [
      'PRODUCT_WAREHOUSE_REQUIRED',
      'PRODUCT_WAREHOUSE_NOT_FOUND',
      'PRODUCT_QUANTITY_INVALID',
    ]) {
      used.add(`warehouse.byWarehouse.error.${code}`)
    }
    expect(used.size).toBeGreaterThan(15)
    expect([...used].filter((key) => typeof lookup(messages, key) !== 'string')).toEqual([])
  })
})
