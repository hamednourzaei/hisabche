// ============================================
// «مشتریان» — the redesigned /customers.
//
// What can go wrong: a third tab; the hub drawing its own bar or switch; a
// second implementation of the follow-up or campaign screen instead of
// mounting the one that exists; both outreach parts on one screen; a part
// offered to someone whose module is locked; «before» changed or lost; the two
// pages staying in the «after» menu beside their own sections; one shell
// showing the hub and the other the old list.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NAV_MODULE } from '@hisabche/ui-contract'

import {
  CUSTOMERS_HUB_TABS,
  OUTREACH_SECTIONS,
  OUTREACH_SOURCE,
} from '../components/ui/customers/containers/customers-hub-container'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')

const hub = code(
  read(
    'packages',
    'ui',
    'src',
    'components',
    'ui',
    'customers',
    'containers',
    'customers-hub-container.tsx',
  ),
)

describe('two tabs, built from shared parts', () => {
  it('customers and outreach — and nothing else', () => {
    expect([...CUSTOMERS_HUB_TABS]).toEqual(['customers', 'outreach'])
    expect([...OUTREACH_SECTIONS]).toEqual(['followUp', 'campaigns', 'stale'])
    expect(OUTREACH_SOURCE).toEqual({
      followUp: '/tasks',
      campaigns: '/campaigns',
      stale: '/customers',
    })
  })

  it('uses the ONE tab bar, the ONE switch and the address hooks', () => {
    expect(hub).toContain('<HubTabs')
    expect(hub).toContain('<SegmentedControl')
    expect(hub).toContain('useHubTab(offered)')
    expect(hub).toContain('useHubSection(sections)')
    expect(hub).not.toContain('role="tablist"')
    expect(hub).not.toContain('<button')
    expect(hub).not.toContain('useSearchParams')
  })

  it('shows ONE outreach part at a time — each container mounted once', () => {
    for (const mount of [
      '<CampaignsContainer />',
      '<CrmContainer />',
      '<OpsSectionContainer section="stale" />',
    ]) {
      expect(hub.split(mount).length - 1, mount).toBe(1)
    }
    expect(hub).toContain("{section === 'stale' ? (")
  })
})

describe('locks, «قبل / بعد», menu and shells', () => {
  it('a section is hidden by the SAME lock the menu applied to its page', () => {
    expect(NAV_MODULE['/campaigns']).toBe('parties')
    expect(hub).toContain('!isNavLocked(OUTREACH_SOURCE[section], blocked)')
    // No section left → no tab.
    expect(hub).toContain("(tab) => tab !== 'outreach' || sections.length > 0")
  })

  it('both shells mount the hub', () => {
    expect(read('apps', 'web', 'app', '[lang]', '(dashboard)', 'customers', 'page.tsx')).toContain(
      '<CustomersHubContainer />',
    )
    expect(read('packages', 'app-shell', 'src', 'features', 'crm', 'customers-page.tsx')).toContain(
      '<CustomersHubContainer />',
    )
  })

  it('every label exists in all three languages', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const words = JSON.parse(
        read('packages', 'i18n', 'messages', lang, 'common.json'),
      ).customersHub
      for (const key of ['label', 'loading', 'sectionsLabel']) {
        expect(words[key], `${lang} ${key}`).toEqual(expect.any(String))
      }
      for (const tab of CUSTOMERS_HUB_TABS) {
        expect(words.tabs[tab], `${lang} ${tab}`).toEqual(expect.any(String))
      }
      for (const section of OUTREACH_SECTIONS) {
        expect(words.sections[section], `${lang} ${section}`).toEqual(expect.any(String))
      }
    }
  })
})
