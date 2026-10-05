// ============================================
// The shared hub page, and the routes folded into the pages they share data
// with (owner's standing order, 5 Oct 2026: fewer routes).
//
// What can go wrong: a hub re-implementing the bar or the switch instead of
// using `PageHub`; a section offered to someone whose module is locked; a tab
// left on screen with nothing in it; a folded page staying in the «after»
// menu beside its own section; «before» losing the page it had; one shell
// mounting the hub and the other the old page.
// ============================================

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { offeredHubTabs, type PageHubTab } from '../components/ui/page-hub'
import { DATA_HUB_SOURCES } from '../components/ui/data-and-sync/containers/data-hub-container'
import { BILLING_HUB_SOURCES } from '../components/ui/billing/containers/billing-hub-container'
import {
  GOVERNANCE_GROUPS,
  governanceGroupOf,
} from '../components/ui/governance/containers/governance-hub-container'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
const ui = (...parts: string[]) => code(read('packages', 'ui', 'src', 'components', 'ui', ...parts))

describe('PageHub', () => {
  const hub = ui('page-hub.tsx')
  const render = () => null
  const tabs: PageHubTab[] = [
    { id: 'one', label: 'One', sections: [{ id: 'a', label: 'A', render }] },
    {
      id: 'two',
      label: 'Two',
      sections: [
        { id: 'bank', label: 'Bank', source: '/bank', render },
        { id: 'budgets', label: 'Budgets', source: '/budgets', render },
      ],
    },
  ]

  it('is built from the shared bar, switch and address hooks', () => {
    expect(hub).toContain('<HubTabs')
    expect(hub).toContain('<SegmentedControl')
    expect(hub).toContain('useHubTab(')
    expect(hub).toContain('useHubSection(')
    expect(hub).not.toContain('role="tablist"')
    // A tab with one screen draws no switch.
    expect(hub).toContain('{sections.length > 1 && section ? (')
  })

  it('offers everything to someone with nothing locked', () => {
    expect(offeredHubTabs(tabs, []).map((tab) => tab.sections.length)).toEqual([1, 2])
  })

  it('drops a locked section, by the lock of the page it came from', () => {
    const offered = offeredHubTabs(tabs, ['budgets'])
    expect(offered[1]?.sections.map((section) => section.id)).toEqual(['bank'])
  })

  it('a tab with no section left is not a tab', () => {
    expect(offeredHubTabs(tabs, ['accounting', 'budgets']).map((tab) => tab.id)).toEqual(['one'])
  })
})

describe('routes folded into the page they share data with', () => {
  it('both shells mount the hubs', () => {
    const web = (route: string) =>
      read('apps', 'web', 'app', '[lang]', '(dashboard)', route, 'page.tsx')
    expect(web('data-and-sync')).toContain('<DataHubContainer />')
    expect(web('billing')).toContain('<BillingHubContainer />')
    expect(
      read('packages', 'app-shell', 'src', 'features', 'sync', 'data-and-sync-page.tsx'),
    ).toContain('DataHubContainer')
    expect(
      read('packages', 'app-shell', 'src', 'features', 'billing', 'billing-page.tsx'),
    ).toContain('BillingHubContainer')
  })
})

describe('a section is hidden by the lock of the page it came from', () => {
  it('the sources are the addresses those pages had', () => {
    expect(DATA_HUB_SOURCES).toEqual({
      sync: '/sync-center',
      conflicts: '/conflicts',
      migration: '/data-migration',
    })
    expect(BILLING_HUB_SOURCES).toEqual({ wallet: '/wallet', referrals: '/referrals' })
  })
})

describe('/governance', () => {
  it('six parts in two groups — every part reachable', () => {
    expect(GOVERNANCE_GROUPS).toEqual({
      people: ['overview', 'members', 'permissions'],
      control: ['approvals', 'sod', 'audit'],
    })
    expect(governanceGroupOf('audit')).toBe('control')
    expect(governanceGroupOf('overview')).toBe('people')
  })
})

describe('one switch component', () => {
  it('the duplicate «SegmentedFilter» is gone and nothing imports it', () => {
    const dir = join(ROOT, 'packages', 'ui', 'src', 'components', 'ui')
    expect(existsSync(join(dir, 'segmented-filter.tsx'))).toBe(false)
    const files = (folder: string): string[] =>
      readdirSync(folder).flatMap((name) => {
        const path = join(folder, name)
        return statSync(path).isDirectory() ? files(path) : /.tsx?$/.test(name) ? [path] : []
      })
    const users = files(dir).filter((path) =>
      readFileSync(path, 'utf8').includes('segmented-filter'),
    )
    expect(users).toEqual([])
  })
})

describe('one searchable table', () => {
  const shared = ui('data-table', 'searchable-table.tsx')

  it('is the shared DataTable with its own search — a sentence becomes an empty state', () => {
    expect(shared).toContain('<DataTable')
    expect(shared).toContain('rows={rows.filter((row) => matchesSearch(search, words(row)))}')
    expect(shared).toContain("typeof empty === 'string' ? (")
  })

  it('the plan history on /billing uses it — no hand-made table', () => {
    const billing = ui('billing', 'containers', 'BillingContainer.tsx')
    expect(billing).toContain('tableId="billing-history"')
    expect(billing).not.toContain('<table')
  })
})

describe('lists that are the shared table now', () => {
  it.each([
    ['bank', 'bank-category-suggestions.tsx', 'bank-category-suggestions'],
    ['developers', 'key-usage-panel.tsx', 'developer-key-usage'],
    ['manufacturing', 'production-history.tsx', 'manufacturing-history'],
    ['manufacturing', 'manufacturing-report.tsx', 'manufacturing-report-materials'],
    ['manufacturing', 'manufacturing-report.tsx', 'manufacturing-report-products'],
    ['developers', 'developers-view.tsx', 'developer-keys'],
    ['market', 'market-seller-container.tsx', 'market-listings'],
    ['cycle-count', 'cycle-count-view.tsx', 'cycle-counts'],
    ['inventory-ops', 'inventory-ops-view.tsx', 'ops-reorder'],
    ['inventory-ops', 'inventory-ops-view.tsx', 'ops-dead-stock'],
    ['inventory-ops', 'inventory-ops-view.tsx', 'ops-shifts'],
    ['inventory-ops', 'inventory-ops-view.tsx', 'ops-stale-opportunities'],
  ])('%s/%s — %s', (dir, file, tableId) => {
    const source = ui(dir, file)
    expect(source).toContain(`tableId="${tableId}"`)
    expect(source).not.toContain('<table')
    expect(source).not.toContain('<TableBody>')
  })

  it('the operations page shows one part at a time, and each part reads for itself', () => {
    const ops = ui('inventory-ops', 'inventory-ops-view.tsx')
    expect(ops).toContain('<SegmentedControl')
    for (const part of ['OpsReorderSection', 'OpsDeadStockSection', 'OpsShiftHistorySection']) {
      expect(ops, part).toContain(`export function ${part}(`)
    }
    // A read that failed is said to have failed — it is not «nothing to show».
    expect(ops.split('isError) return <Failed').length - 1).toBe(4)
  })

  it('a production run still opens its snapshot — under the table', () => {
    const history = ui('manufacturing', 'production-history.tsx')
    expect(history).toContain('<RunDetail t={t} locale={locale} id={open.id} />')
  })
})

describe('words', () => {
  it('every new label exists in all three languages', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const all = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json'))
      for (const hub of ['dataHub', 'billingHub']) {
        expect(all[hub].sectionsLabel, `${lang} ${hub}`).toEqual(expect.any(String))
        expect(all[hub].loading, `${lang} ${hub}`).toEqual(expect.any(String))
        for (const label of Object.values(all[hub].tabs)) expect(label).toEqual(expect.any(String))
      }
      expect(Object.keys(all.dataHub.tabs)).toEqual(['overview', 'details'])
      expect(Object.keys(all.billingHub.tabs)).toEqual(['plan', 'money'])
      expect(all.accountingHub.tabs.treasury, lang).toEqual(expect.any(String))
      expect(all.governance.group_people, lang).toEqual(expect.any(String))
      expect(all.governance.group_control, lang).toEqual(expect.any(String))
      expect(all.ops.sectionsLabel, lang).toEqual(expect.any(String))
      expect(all.developer.scopes, lang).toEqual(expect.any(String))
      expect(all.settingsHub.tabs.general, lang).toEqual(expect.any(String))
      expect(all.settingsHub.tabs.integrations, lang).toEqual(expect.any(String))
      expect(all.settingsHub.sections.developers, lang).toEqual(expect.any(String))
      expect(all.settingsHub.sections.marketplace, lang).toEqual(expect.any(String))
      expect(all.ops.loadFailed, lang).toEqual(expect.any(String))
      expect(all.warehouseHub.sections.reorder, lang).toEqual(expect.any(String))
      expect(all.warehouseHub.sections.deadStock, lang).toEqual(expect.any(String))
      expect(all.customersHub.sections.stale, lang).toEqual(expect.any(String))
      for (const key of [
        'nav.sync',
        'nav.conflicts',
        'nav.data_migration',
        'nav.wallet',
        'nav.referrals',
        'nav.billing',
        'nav.data_and_sync',
      ]) {
        const [group, name] = key.split('.') as [string, string]
        expect(all[group][name], `${lang} ${key}`).toEqual(expect.any(String))
      }
    }
  })
})
