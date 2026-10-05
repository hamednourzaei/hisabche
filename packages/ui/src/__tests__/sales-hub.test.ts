// ============================================
// «فروش و خرید» — the redesigned /invoices, and the shared pieces it is made of.
//
// What can go wrong: a second implementation of a screen instead of mounting
// the one that exists; a hub drawing its own tab bar; a purchase kept in a
// parallel table beside the invoice table; a status filter offering a status
// invoices do not have; the filter applied to one page of rows in the browser
// instead of on the server; a list on this page not using the shared table; a
// tab offered to someone whose module is locked; one shell showing the hub and
// the other the old list.
// ============================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NAV_CONTRACT, NAV_MODULE } from '@hisabche/ui-contract'

import {
  SALES_HUB_SOURCE,
  SALES_HUB_TABS,
} from '../components/ui/invoices/containers/sales-hub-container'
import { INVOICE_STATUS_FILTERS } from '../lib/invoices/invoices-format'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')
const ui = (...parts: string[]) => code(read('packages', 'ui', 'src', 'components', 'ui', ...parts))

const hub = ui('invoices', 'containers', 'sales-hub-container.tsx')
const tabs = ui('hub-tabs.tsx')
const view = ui('invoices', 'invoices-view.tsx')
const pageHook = code(read('packages', 'ui', 'src', 'hooks', 'invoices', 'use-invoices-page.ts'))

describe('two tabs, built from shared parts', () => {
  it('invoices and pricing — and nothing else', () => {
    expect([...SALES_HUB_TABS]).toEqual(['invoices', 'pricing'])
    expect(SALES_HUB_SOURCE).toEqual({ invoices: '/invoices', pricing: '/promotions' })
  })

  it('mounts the containers that own those screens and fetches nothing itself', () => {
    expect(hub).toContain('<InvoicesContainer />')
    expect(hub).toContain('<PromotionsContainer />')
    expect(hub).toMatch(/const PromotionsContainer = lazy\(/)
    const dataHooks = [...hub.matchAll(/\buse[A-Z]\w+(?=\()/g)]
      .map((match) => match[0])
      .filter((name) => !/^use(Translations|UxVersion|MyCapabilities|HubTab)$/.test(name))
    expect(dataHooks).toEqual([])
  })

  it('uses the ONE tab bar and the ONE `?tab=` hook — it draws neither', () => {
    expect(hub).toContain('<HubTabs')
    expect(hub).toContain('useHubTab(offered)')
    expect(hub).not.toContain('role="tablist"')
    expect(hub).not.toContain('useSearchParams')
  })

  it('the shared bar is centred, as wide as its items, with soft-square corners', () => {
    expect(tabs).toContain('flex justify-center')
    expect(tabs).toContain('w-fit')
    expect(tabs).toContain('rounded-[var(--radius-md)]')
    expect(tabs).not.toMatch(/rounded-(full|xl|2xl)/)
    // One tab is not a choice: no bar is drawn.
    expect(tabs).toContain('if (items.length < 2) return null')
  })

  it('the tab lives in the address; the first tab is the page itself', () => {
    expect(tabs).toContain('const asked = searchParams.get(param)')
    expect(tabs).toContain('if (value === first) params.delete(param)')
    expect(tabs).toContain("return useAddressChoice('tab', offered, TAB_CLEARS)")
    expect(tabs).not.toMatch(/useState/)
  })
})

describe('one table for every invoice', () => {
  it('«همه / فروش / خرید» and the status filter change the query, not the table', () => {
    // One DataTable in the view, whatever is selected.
    expect(view.split('<DataTable').length - 1).toBe(1)
    expect(view).toContain('tableId="invoices"')
    // Both are sent to the server: the table holds one page.
    expect(pageHook).toContain('return { ...next, type: value }')
    expect(pageHook).toContain('return { ...next, status }')
  })

  it('the status filter is the shared control, in the table’s own toolbar', () => {
    expect(view).toContain('<TableFilterSelect')
    expect(view).toMatch(/actions=\{\s*onStatusFilterChange \?/)
  })

  it('offers only statuses an invoice can have', () => {
    expect([...INVOICE_STATUS_FILTERS]).toEqual(['pending', 'partial', 'completed', 'cancelled'])
    // An unknown value clears the filter instead of being sent.
    expect(pageHook).toContain('INVOICE_STATUS_FILTERS.find((known) => known === value)')
    expect(pageHook).toContain('delete next.status')
  })

  it('every status has a label in all three languages', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const messages = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json'))
      for (const status of INVOICE_STATUS_FILTERS) {
        expect(messages.invoices[status], `${lang} invoices.${status}`).toEqual(expect.any(String))
      }
      expect(messages.invoices.filterAll, lang).toEqual(expect.any(String))
    }
  })
})

describe('a purchase is a purchase invoice — there is no parallel page', () => {
  it('the purchasing page, its screen and its menu entry are gone', () => {
    expect(
      existsSync(join(ROOT, 'apps', 'web', 'app', '[lang]', '(dashboard)', 'purchasing')),
    ).toBe(false)
    expect(existsSync(join(ROOT, 'packages', 'ui', 'src', 'components', 'ui', 'purchasing'))).toBe(
      false,
    )
    expect(NAV_CONTRACT.some((item) => item.path === '/purchasing')).toBe(false)
  })

  it('its old address opens the invoice table on «خرید», on the web and in the shell', () => {
    expect(read('apps', 'web', 'next.config.js')).toContain(
      "['purchasing', 'invoices?type=purchase'],",
    )
    expect(read('packages', 'app-shell', 'src', 'app', 'app.tsx')).toContain(
      `{ path: 'purchasing', element: <Navigate to="/invoices?type=purchase" replace /> }`,
    )
  })
})

describe('the pricing tab lists with the same table', () => {
  it.each([
    ['promotions', 'promotions-container.tsx'],
    ['price-lists', 'price-lists-panel.tsx'],
  ])('%s is a DataTable with search — not a hand-made list', (tableId, file) => {
    const source = ui('promotions', file)
    expect(source).toContain(`tableId="${tableId}"`)
    expect(source).toContain('onSearchChange={setSearch}')
    expect(source).toContain('matchesSearch(search,')
    expect(source).not.toContain('<ul className="space-y-2">')
  })
})

describe('one segmented control, used wherever a page shows one part at a time', () => {
  const promotions = ui('promotions', 'promotions-container.tsx')

  it('the invoice type switch is the shared control — it draws no buttons of its own', () => {
    expect(view).toContain('<SegmentedControl')
    expect(view).not.toContain('role="radiogroup"')
  })

  it('the pricing tab shows discounts OR price lists — never both on one screen', () => {
    expect(promotions).toContain('<SegmentedControl')
    expect(promotions).toContain("{section === 'lists' ? <PriceListsPanel /> : null}")
    expect(promotions).toContain("{section !== 'promotions' ? null : promotions.isLoading ? (")
    // The panel is mounted in exactly one place.
    expect(promotions.split('<PriceListsPanel />').length - 1).toBe(1)
  })

  it('«تخفیف تازه» belongs to the discounts section only', () => {
    expect(promotions).toContain("{section === 'promotions' && !adding ? (")
  })
})

describe('«قبل / بعد», locks and shells', () => {
  it('a tab is hidden by the SAME lock the menu applied to its page', () => {
    expect(NAV_MODULE['/promotions']).toBe('invoices')
    expect(hub).toContain('!isNavLocked(SALES_HUB_SOURCE[tab], blocked)')
  })

  it('both shells mount the hub', () => {
    expect(read('apps', 'web', 'app', '[lang]', '(dashboard)', 'invoices', 'page.tsx')).toContain(
      '<SalesHubContainer />',
    )
    expect(
      read('packages', 'app-shell', 'src', 'features', 'sales', 'invoices-page.tsx'),
    ).toContain('<SalesHubContainer />')
  })
})
