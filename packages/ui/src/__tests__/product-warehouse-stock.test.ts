// ============================================
// BUG-080 on screen: the product page shows its total WITH the parts, so
// «۲۰» and a warehouse's «−۱۰» are visibly the same stock; a quantity edit
// says which warehouse it lands in; and every sentence exists in fa/af/en.
//
// ⚠️ RE-WRITTEN 17 October 2026 (owner): the section «موجودی در هر انبار» was
// DELETED — its list, its total line and its negative-warehouse explainer.
// The parts are now one line under the cards («موقعیت در انبار» — the stock
// position node), and what remains of the panel is the ACTION: moving stock
// that sits in no warehouse into one. The guards moved with the answer.
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
const POSITION = `${DIR}/product-stock-position.tsx`
const PAGE = `${DIR}/warehouse-detail-page.tsx`
const CONTAINER = `${DIR}/containers/warehouse-detail-container.tsx`

describe('the product page explains its total', () => {
  it('the parts sit in the strip under the cards, and the page mounts the node there', () => {
    const page = read(PAGE)
    expect(page).toContain("t('warehouse.stockPosition'")
    expect(page).toContain('{stockPosition')
    // Under «موجودی فعلی» and above the history — where the deleted section was.
    const at = page.indexOf('data-field="stock-position"')
    expect(at).toBeGreaterThan(page.indexOf("t('warehouse.currentStock'"))
    expect(at).toBeLessThan(page.indexOf('{stockPanel}'))
    const container = read(CONTAINER)
    expect(container).toContain('<ProductStockPosition t={safeT} productId={id} fmt={fmt} />')
    expect(container).toContain('<ProductWarehouseStockPanel t={safeT} productId={id} />')
  })

  it('the position line lists every warehouse with its figure, negatives included', () => {
    const position = read(POSITION)
    expect(position).toContain('data?.warehouses ?? []')
    expect(position).toContain("t('warehouse.byWarehouse.unassigned')")
    // A negative warehouse is shown as one, in the destructive colour.
    expect(position).toContain('w.quantity < 0')
    // A failed read is a sentence, not «no warehouses».
    expect(position).toContain('apiErrorMessage(breakdown.error')
  })

  it('the deleted list does not come back: no total, no explainer, no rows in the panel', () => {
    const panel = read(PANEL)
    expect(panel).not.toContain("t('warehouse.byWarehouse.total')")
    expect(panel).not.toContain("t('warehouse.byWarehouse.negativeHelp')")
    expect(panel).not.toContain("t('warehouse.byWarehouse.title')")
    expect(panel).not.toContain("t('warehouse.byWarehouse.help')")
    // The total is not repeated in the position line either — the cards own it.
    expect(read(POSITION)).not.toContain("t('warehouse.byWarehouse.total')")
  })

  it('stock in no warehouse is moved through the existing assign path, never guessed', () => {
    const panel = read(PANEL)
    expect(panel).toContain('useAssignWarehouseStock(target)')
    expect(panel).toContain('amount <= free')
    // The form shows only when there is something to move, and somewhere to put it.
    expect(panel).toContain('free <= 0')
    expect(panel).toContain('data.warehouses.length === 0')
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
    for (const file of [PANEL, POSITION, PAGE, CONTAINER]) {
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
    // The scan must really have found keys, and each one must exist.
    expect(used.size).toBeGreaterThan(10)
    expect([...used].filter((key) => typeof lookup(messages, key) !== 'string')).toEqual([])
  })
})

describe('a negative warehouse says why (§7.5)', () => {
  it('the position line carries the negative-stock sentence, not a red number alone', () => {
    const src = readFileSync(
      join(__dirname, '../components/ui/warehouse-detail/product-stock-position.tsx'),
      'utf8',
    )
    expect(src).toContain("t('warehouse.byWarehouse.negativeHelp')")
    expect(src).toContain('.some((w) => w.quantity < 0)')
  })
})

describe('changing a product’s shelf from the product page', () => {
  const shelves = readFileSync(
    join(__dirname, '../components/ui/warehouse-detail/product-shelf-locations.tsx'),
    'utf8',
  )
  const hook = readFileSync(join(__dirname, '../../../api/src/hooks/warehouse-map.ts'), 'utf8')

  it('is mounted under the position line', () => {
    const position = readFileSync(
      join(__dirname, '../components/ui/warehouse-detail/product-stock-position.tsx'),
      'utf8',
    )
    expect(position).toContain('<ProductShelfLocations t={t} productId={productId} fmt={fmt} />')
  })

  it('moves through the map’s ONE placing path — no second stock engine', () => {
    expect(shelves).toContain('useMoveProductPlacement()')
    const move = hook.slice(hook.indexOf('export function useMoveProductPlacement'))
    expect(move).toContain('/storage-locations/${input.fromLocationId}/place')
    // ⚠️ The old shelf goes down BEFORE the new one goes up, so the warehouse
    // cap is never exceeded midway.
    expect(move.indexOf('input.fromLocationId}/place')).toBeLessThan(
      move.indexOf('input.toLocationId}/place'),
    )
  })

  it('never offers more than the source holds', () => {
    expect(shelves).toContain('amount <= source.quantity')
  })
})
