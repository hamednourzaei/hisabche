// ============================================
// «انبار» — the redesigned /warehouse.
//
// What can go wrong: the hub drawing its own tab bar or switch; a third tab
// creeping in; both stock parts on screen at once; the product list keeping a
// hand-made table; the list's search filtering one page in the browser; the old
// catalogue address landing on the wrong part; «before» being changed or lost;
// the expiry page staying in the «after» menu beside its own tab; a list nobody
// can add to (stock count) being pulled into the hub.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NAV_MODULE } from '@hisabche/ui-contract'

import {
  STOCK_SECTIONS,
  WAREHOUSE_HUB_SOURCE,
  WAREHOUSE_HUB_TABS,
} from '../components/ui/warehouse/containers/warehouse-tabs-container'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
const ui = (...parts: string[]) => code(read('packages', 'ui', 'src', 'components', 'ui', ...parts))

const hub = ui('warehouse', 'containers', 'warehouse-tabs-container.tsx')
const tabs = ui('hub-tabs.tsx')
const list = ui('products', 'product-list-view.tsx')
const after = hub.slice(
  hub.indexOf('function WarehouseHub()'),
  hub.indexOf('function WarehouseTabsBefore()'),
)

describe('two tabs, built from shared parts', () => {
  it('stock and expiry — and nothing else', () => {
    expect([...WAREHOUSE_HUB_TABS]).toEqual(['stock', 'expiry'])
    expect(WAREHOUSE_HUB_SOURCE).toEqual({ stock: '/warehouse', expiry: '/expiry' })
    expect([...STOCK_SECTIONS]).toEqual(['warehouses', 'products', 'reorder', 'deadStock'])
  })

  it('uses the ONE tab bar and the ONE switch — it draws neither', () => {
    expect(after).toContain('<HubTabs')
    expect(after).toContain('<SegmentedControl')
    expect(after).toContain('useHubTab(offered)')
    expect(after).toContain('useHubSection(STOCK_SECTIONS, STOCK_SECTION_CLEARS)')
    expect(after).not.toContain('role="tablist"')
    expect(after).not.toContain('<button')
  })

  it('mounts the containers that own those screens and fetches nothing itself', () => {
    expect(after).toContain('<ExpiryContainer />')
    expect(after).toContain('<ProductListContainer />')
    expect(after).toContain('<WarehouseStockTab />')
    expect(hub).toContain('const ExpiryContainer = lazy(')
    const allowed = [
      'useTranslations',
      'useMyCapabilities',
      'useHubTab',
      'useHubSection',
      'useSearchParams',
      'useLocaleReplace',
      'useEffect',
    ]
    const dataHooks = [...after.matchAll(/\buse[A-Z]\w+(?=\()/g)]
      .map((match) => match[0])
      .filter((name) => !allowed.includes(name))
    expect(dataHooks).toEqual([])
  })

  it('shows ONE stock part at a time — each mounted exactly once', () => {
    for (const mount of [
      '<ProductListContainer />',
      '<WarehouseStockTab />',
      '<OpsSectionContainer section={section} />',
    ]) {
      expect(after.split(mount).length - 1, mount).toBe(1)
    }
    // Reorder and dead stock came from /operations: the same products.
    expect(after).toContain("{section === 'reorder' || section === 'deadStock' ? (")
    expect(hub).toContain('const OpsSectionContainer = lazy(')
  })

  it('a tab is hidden by the SAME lock the menu applied to its page', () => {
    expect(NAV_MODULE['/expiry']).toBe('inventory')
    expect(after).toContain('!isNavLocked(WAREHOUSE_HUB_SOURCE[tab], blocked)')
  })
})

describe('the section lives in the address', () => {
  it('in ?view=, and leaving a tab leaves its section', () => {
    expect(tabs).toContain("return useAddressChoice('view', offered, clears)")
    expect(tabs).toContain("const TAB_CLEARS = ['view'] as const")
    expect(tabs).toContain('for (const stale of clears) params.delete(stale)')
  })

  it('an open warehouse does not follow you to the product list', () => {
    expect(hub).toContain("const STOCK_SECTION_CLEARS = ['warehouse'] as const")
  })

  it('the old catalogue address opens the products section', () => {
    expect(after).toContain("params.get('tab') === 'products'")
    expect(after).toContain("localeReplace('/warehouse?view=products')")
  })
})

describe('the product list is the shared table', () => {
  it('a DataTable — not a hand-made one', () => {
    expect(list).toContain('tableId="products"')
    expect(list).not.toContain('<TableHeader>')
    expect(list).not.toContain('aria-sort')
  })

  it('search goes to the server: the table holds one page', () => {
    expect(list).toContain('onSearchChange={engine.setSearch}')
    expect(list).not.toContain('matchesSearch(')
  })

  it('stays mounted while a page loads, so typing keeps its focus', () => {
    expect(list).not.toContain('{isLoading ? <Loading')
    expect(list).toContain('isLoading ? (')
  })

  it('a row opens the product — the same page the warehouse table opens', () => {
    expect(list).toContain('onRowClick={onOpen ? (product) => onOpen(product.id) : undefined}')
    expect(ui('products', 'containers', 'product-list-container.tsx')).toContain(
      'push(`/warehouse/${id}`)',
    )
  })
})

describe('«قبل / بعد» and the menu', () => {
  it('stock count is NOT pulled in while nothing can start a count', () => {
    expect(hub).not.toContain('CycleCountContainer')
    const screen =
      ui('cycle-count', 'containers', 'cycle-count-container.tsx') +
      ui('cycle-count', 'cycle-count-view.tsx')
    // The day this turns red, a count can be started: fold the screen in.
    expect(screen).not.toContain('useCreateCycleCount')
  })

  it('every label exists in all three languages', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const words = JSON.parse(
        read('packages', 'i18n', 'messages', lang, 'common.json'),
      ).warehouseHub
      for (const key of ['label', 'loading', 'sectionsLabel']) {
        expect(words[key], `${lang} ${key}`).toEqual(expect.any(String))
      }
      for (const tab of WAREHOUSE_HUB_TABS) {
        expect(words.tabs[tab], `${lang} ${tab}`).toEqual(expect.any(String))
      }
      for (const section of STOCK_SECTIONS) {
        expect(words.sections[section], `${lang} ${section}`).toEqual(expect.any(String))
      }
    }
  })
})
