// ============================================
// «مشتریان» — the redesigned /customers, now with the service sessions.
//
// What can go wrong: a fourth tab; a FOURTH route instead of a tab; the hub
// drawing its own bar or switch; a second implementation of the follow-up,
// campaign or session screen instead of mounting the one that exists; both
// outreach parts on one screen; a part offered to someone whose module is
// locked, or sessions offered to a role the endpoints would refuse; «before»
// changed or lost; the pages staying in the «after» menu beside their own
// sections; one shell showing the hub and the other the old list; a tab with
// no help article.
// ============================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NAV_MODULE } from '@hisabche/ui-contract'

import {
  CUSTOMERS_HUB_TABS,
  OUTREACH_SECTIONS,
  OUTREACH_SOURCE,
} from '../components/ui/customers/containers/customers-hub-container'
import { ROUTE_DOCS_MAP } from '../components/ui/docs/docs-help-link'
import { findArticle } from '../lib/docs/docs-content'

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

describe('three tabs, built from shared parts', () => {
  it('customers, sessions and outreach — and nothing else', () => {
    expect([...CUSTOMERS_HUB_TABS]).toEqual(['customers', 'sessions', 'outreach'])
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

describe('the sessions tab is a tab, not a route', () => {
  it('mounts the ONE service-delivery container, lazily', () => {
    expect(hub.split('<ServiceDeliveryContainer />').length - 1).toBe(1)
    expect(hub).toContain("import('../../service-delivery/containers/service-delivery-container')")
    // Mounted inside a Suspense boundary — the hub paints while it loads.
    expect(hub).toContain('<Suspense')
  })

  it('sessions live at `?tab=sessions`, with no page of their own', () => {
    expect(hub).toContain('useHubTab(offered)')
    expect(hub).toContain('hubLookId(tab, tab)')
    for (const route of [
      join('apps', 'web', 'app', '[lang]', '(dashboard)', 'customers', 'sessions'),
      join('packages', 'app-shell', 'src', 'features', 'crm', 'customers-sessions-page.tsx'),
    ]) {
      expect(existsSync(join(ROOT, route)), route).toBe(false)
    }
    // The sessions tab is not the FIRST one, so the hub never hides it behind
    // an address parameter the shared bar cannot express.
    expect([...CUSTOMERS_HUB_TABS][0]).toBe('customers')
  })

  it('is offered only to someone the endpoints would not refuse', () => {
    // GET /service-delivery/sessions requires `invoice.read` (backend route).
    expect(hub).toContain("capabilities.can('invoice.read') !== false")
    expect(hub).toContain("if (tab === 'sessions') return mayReadSessions")
    // Undefined (still loading) is not «no access»: the tab stays while the
    // capability read is in flight, and the container decides with its own
    // loading state.
    expect(hub).not.toContain("capabilities.can('invoice.read') === true")
  })
})

describe('locks, «قبل / بعد», menu and shells', () => {
  it('a section is hidden by the SAME lock the menu applied to its page', () => {
    expect(NAV_MODULE['/campaigns']).toBe('parties')
    expect(hub).toContain('!isNavLocked(OUTREACH_SOURCE[section], blocked)')
    // No section left → no tab.
    expect(hub).toContain("if (tab === 'outreach') return allowedSections.length > 0")
  })

  it('both shells mount the hub', () => {
    expect(read('apps', 'web', 'app', '[lang]', '(dashboard)', 'customers', 'page.tsx')).toContain(
      '<CustomersHubContainer />',
    )
    expect(read('packages', 'app-shell', 'src', 'features', 'crm', 'customers-page.tsx')).toContain(
      '<CustomersHubContainer />',
    )
  })

  it('the tab has a public help article', () => {
    expect(ROUTE_DOCS_MAP['customers?tab=sessions']).toBe('service-delivery')
    expect(findArticle('service-delivery')).toBeTruthy()
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
