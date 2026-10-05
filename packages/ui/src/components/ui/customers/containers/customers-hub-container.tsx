'use client'

// ============================================
// «مشتریان» — everything about the people a business sells to, at one address:
// `/customers`.
//
// Two tabs, and only two:
//
//   customers   the list (search, roles, bulk actions) — the page as it was
//   outreach    what is done WITH customers, one at a time behind a switch:
//               «پیگیری» (was /tasks) or «کمپین‌ها» (was /campaigns)
//
// ⚠️ A HUB OVER THE SCREENS THAT ALREADY EXIST. Each part mounts the container
// that owns it; the hub fetches nothing itself. The bar, the switch and the
// address handling are the shared `HubTabs` / `SegmentedControl` /
// `useHubTab` / `useHubSection`.
//
// ⚠️ A part whose module is locked for this person is not offered — the same
// lock the menu applied to the page it came from (`isNavLocked`).
// ============================================

import { Suspense, lazy } from 'react'
import { useTranslations } from 'next-intl'
import { Megaphone, Users } from 'lucide-react'
import { useMyCapabilities } from '@hisabche/api'
import { isNavLocked } from '@hisabche/ui-contract'

import { HubTabs, useHubSection, useHubTab } from '../../hub-tabs'
import { SegmentedControl } from '../../segmented-control'
import { CustomersContainer } from './customer-container'

const CrmContainer = lazy(() =>
  import('../../crm/containers/crm-container').then((m) => ({ default: m.CrmContainer })),
)
const OpsSectionContainer = lazy(() =>
  import('../../inventory-ops/containers/inventory-ops-container').then((m) => ({
    default: m.OpsSectionContainer,
  })),
)
const CampaignsContainer = lazy(() =>
  import('../../campaigns/campaigns-container').then((m) => ({ default: m.CampaignsContainer })),
)

export const CUSTOMERS_HUB_TABS = ['customers', 'outreach'] as const
export type CustomersHubTab = (typeof CUSTOMERS_HUB_TABS)[number]

export const OUTREACH_SECTIONS = ['followUp', 'campaigns', 'stale'] as const
export type OutreachSection = (typeof OUTREACH_SECTIONS)[number]

/** The address each section used to live at — the key of its lock in `NAV_MODULE`. */
export const OUTREACH_SOURCE: Record<OutreachSection, string> = {
  followUp: '/tasks',
  campaigns: '/campaigns',
  // «فرصت‌های راکد» was a part of /operations; it is locked with the customers.
  stale: '/customers',
}

const TAB_ICON = { customers: Users, outreach: Megaphone } as const

export function CustomersHubContainer() {
  return <CustomersHub />
}

function CustomersHub() {
  const t = useTranslations()
  const blocked = useMyCapabilities().data?.blockedModules ?? []
  const sections = OUTREACH_SECTIONS.filter(
    (section) => !isNavLocked(OUTREACH_SOURCE[section], blocked),
  )
  // A tab with nothing this person may open is not a tab.
  const offered = CUSTOMERS_HUB_TABS.filter((tab) => tab !== 'outreach' || sections.length > 0)
  const [active, select] = useHubTab(offered)
  const [section, selectSection] = useHubSection(sections)

  return (
    <div className="space-y-4">
      <HubTabs
        label={t('customersHub.label')}
        items={offered.map((tab) => ({
          id: tab,
          label: t(`customersHub.tabs.${tab}`),
          icon: TAB_ICON[tab],
        }))}
        active={active}
        onSelect={select}
      />

      <div role="tabpanel" className="space-y-4">
        {active === 'outreach' ? (
          <>
            <SegmentedControl
              branch
              label={t('customersHub.sectionsLabel')}
              options={sections.map((value) => ({
                value,
                label: t(`customersHub.sections.${value}`),
              }))}
              value={section}
              onChange={selectSection}
            />
            <Suspense
              fallback={
                <p role="status" className="p-4 text-sm text-[hsl(var(--fg-secondary))]">
                  {t('customersHub.loading')}
                </p>
              }
            >
              {section === 'stale' ? (
                <OpsSectionContainer section="stale" />
              ) : section === 'campaigns' ? (
                <CampaignsContainer />
              ) : (
                <CrmContainer />
              )}
            </Suspense>
          </>
        ) : (
          <CustomersContainer />
        )}
      </div>
    </div>
  )
}
