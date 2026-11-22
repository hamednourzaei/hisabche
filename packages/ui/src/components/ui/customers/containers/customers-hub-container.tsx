'use client'

// ============================================
// «مشتریان» — everything about the people a business sells to, at one address:
// `/customers`.
//
// Three tabs:
//
//   customers   the list (search, roles, bulk actions) — the page as it was
//   sessions    «جلسات خدمت»: each service session with one of these customers,
//               its settlement and where it stands with the server
//   outreach    what is done WITH customers, one at a time behind a switch:
//               «پیگیری» (was /tasks) or «کمپین‌ها» (was /campaigns)
//
// ⚠️ A HUB OVER THE SCREENS THAT ALREADY EXIST. Each part mounts the container
// that owns it; the hub fetches nothing itself. The bar, the switch and the
// address handling are the shared `HubTabs` / `SegmentedControl` /
// `useHubTab` / `useHubSection`.
//
// ⚠️ A part whose module is locked for this person is not offered — the same
// lock the menu applied to the page it came from (`isNavLocked`). The sessions
// tab follows the capability its endpoints require (`invoice.read`).
//
// ⚠️ THE SESSIONS TAB IS NOT A NEW ROUTE: it is `?tab=sessions` on the page
// that already holds the customers, because a session belongs to a customer.
// ============================================

import { Suspense, lazy } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarClock, Megaphone, Users } from 'lucide-react'
import { useMyCapabilities } from '@hisabche/api'
import type { CapabilityKey } from '@hisabche/validation'
import { isNavLocked } from '@hisabche/ui-contract'
import { useActionAvailability } from '../../../../lib/capability/use-action-availability'
import { useBusinessProfile } from '../../../../hooks/use-business-profile'
import { usePageLook } from '../../../../lib/page-look'
import { RegisterCustomizer } from '../../register-customizer'
import { hubLookId } from '../../page-hub'

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
const RfmSection = lazy(() =>
  import('../../erp-core/rfm-section').then((m) => ({ default: m.RfmSection })),
)
const CampaignsContainer = lazy(() =>
  import('../../campaigns/campaigns-container').then((m) => ({ default: m.CampaignsContainer })),
)
const ServiceDeliveryContainer = lazy(() =>
  import('../../service-delivery/containers/service-delivery-container').then((m) => ({
    default: m.ServiceDeliveryContainer,
  })),
)

// QA document packs (10 Nov 2026) — loaded only when their section opens.
const RepairTicketsSection = lazy(() =>
  import('../../business-packs/repair-tickets-section').then((m) => ({
    default: m.RepairTicketsSection,
  })),
)
const SalonSetupSection = lazy(() =>
  import('../../business-packs/salon-sections').then((m) => ({ default: m.SalonSetupSection })),
)
const CommissionSection = lazy(() =>
  import('../../business-packs/salon-sections').then((m) => ({ default: m.CommissionSection })),
)
const ContractsSection = lazy(() =>
  import('../contracts-section').then((m) => ({ default: m.ContractsSection })),
)

export const CUSTOMERS_HUB_TABS = ['customers', 'sessions', 'outreach'] as const
export type CustomersHubTab = (typeof CUSTOMERS_HUB_TABS)[number]

export const CUSTOMER_ROLES = ['all', 'buyer', 'seller'] as const
export type CustomerRole = (typeof CUSTOMER_ROLES)[number]

// «بخش‌بندی RFM» (V61 B.2.15): who buys recently, often and much — per currency.
export const OUTREACH_SECTIONS = ['followUp', 'campaigns', 'stale', 'rfm'] as const

/**
 * The «جلسه‌ها» tab's parts (10 Nov 2026, QA document §8–§9): the sessions
 * themselves, repair slips (mobile shop), the salon's chairs/rooms and
 * service catalog, and provider commission. One service core — a barber hides
 * what he does not use with the wrench.
 */
export const SESSION_SECTIONS = ['sessions', 'repairs', 'salonSetup', 'commission'] as const
export type SessionSection = (typeof SESSION_SECTIONS)[number]
export type OutreachSection = (typeof OUTREACH_SECTIONS)[number]

/** The address each section used to live at — the key of its lock in `NAV_MODULE`. */
export const OUTREACH_SOURCE: Record<OutreachSection, string> = {
  followUp: '/tasks',
  campaigns: '/campaigns',
  // «فرصت‌های راکد» was a part of /operations; it is locked with the customers.
  stale: '/customers',
  rfm: '/customers',
}

const TAB_ICON = { customers: Users, sessions: CalendarClock, outreach: Megaphone } as const

export function CustomersHubContainer() {
  return <CustomersHub />
}

function CustomersHub() {
  const t = useTranslations()
  const capabilities = useMyCapabilities()
  const { profile } = useBusinessProfile()
  // A part belongs to a trade, not to a permission. The canonical profile is
  // the only authority: a business that never declared one (generic) keeps
  // every part, exactly as before this gate existed.
  const profileAllows = (capability: CapabilityKey): boolean =>
    profile.isGeneric || profile.primaryDefinition.requestedCapabilities.includes(capability)
  const blocked = capabilities.data?.blockedModules ?? []
  // The offline edition (Windows, mobile) has no follow-up, campaign or stale-sale
  // engine, so the whole tab is not offered there — same rule as a locked module.
  const outreachOffline = useActionAvailability('customer.outreach').requiresOnline
  // The service-delivery endpoints require `invoice.read`; a role without it
  // gets no tab rather than a screen of 403s. Undefined (still loading) is not
  // «no access».
  const mayReadSessions = capabilities.can('invoice.read') !== false
  const allowedSections = OUTREACH_SECTIONS.filter(
    (section) => !outreachOffline && !isNavLocked(OUTREACH_SOURCE[section], blocked),
  )
  const allowedTabs = CUSTOMERS_HUB_TABS.filter((tab) => {
    if (tab === 'outreach') return allowedSections.length > 0
    if (tab === 'sessions') return mayReadSessions
    return true
  })

  const look = usePageLook('hub:customers')

  const sections = allowedSections.filter((sec) => look.shows(hubLookId('outreach', sec)))
  // Each extra part follows the capability its module serves — repairs the
  // work queue, chairs/rooms and provider commission the booking model. A part
  // whose trade does not use it is not offered; no module is deleted.
  const profileSessionSections = SESSION_SECTIONS.filter((sec) => {
    if (sec === 'repairs') return profileAllows('work_queue_sla')
    if (sec === 'salonSetup') return profileAllows('resource_capacity')
    if (sec === 'commission') return profileAllows('resource_capacity')
    return true
  })
  const offered = allowedTabs.filter((tab) => {
    if (tab === 'outreach') return sections.length > 0
    if (tab === 'sessions')
      return profileSessionSections.some((sec) => look.shows(hubLookId('sessions', sec)))
    return look.shows(hubLookId(tab, tab))
  })

  const [active, select] = useHubTab(offered)
  const [role, selectRole] = useHubSection(CUSTOMER_ROLES)
  // «قراردادها و اجاره» is a trade capability (`contracts_recurring`), not an
  // invoice permission: a clothing shop has `invoice.read` and no contracts.
  // The address `?view=contracts` is read, then ignored when the profile does
  // not offer it, so a bookmarked link lands on the list instead of a section
  // this business does not have.
  const [contractsView, selectContractsView] = useHubSection(['all', 'contracts'] as const)
  const [section, selectSection] = useHubSection(sections)
  const mayReadContracts =
    capabilities.can('invoice.read') !== false && profileAllows('contracts_recurring')
  const isContractsView = mayReadContracts && contractsView === 'contracts'
  const mayReadPay = capabilities.can('payroll.read') !== false
  const sessionSections = profileSessionSections.filter(
    (sec) => look.shows(hubLookId('sessions', sec)) && (sec !== 'commission' || mayReadPay),
  )
  const [sessionSection, selectSessionSection] = useHubSection(sessionSections)

  return (
    <div className="relative space-y-4" data-guide="customers-page">
      <RegisterCustomizer
        groups={[
          {
            title: t('pageLook.hubSections' as never),
            look,
            keepOne: true,
            items: [
              ...allowedTabs
                .filter((tab) => tab !== 'outreach' && tab !== 'sessions')
                .map((tab) => ({
                  id: hubLookId(tab, tab),
                  label: t(`customersHub.tabs.${tab}`),
                })),
              ...(allowedTabs.includes('sessions')
                ? sessionSections.map((sec) => ({
                    id: hubLookId('sessions', sec),
                    label: t(`customersHub.sessionSections.${sec}`),
                  }))
                : []),
              ...allowedSections.map((sec) => ({
                id: hubLookId('outreach', sec),
                label: t(`customersHub.sections.${sec}`),
              })),
            ],
          },
        ]}
      />
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
              ) : section === 'rfm' ? (
                <RfmSection />
              ) : section === 'campaigns' ? (
                <CampaignsContainer />
              ) : (
                <CrmContainer />
              )}
            </Suspense>
          </>
        ) : active === 'sessions' ? (
          <>
            <SegmentedControl
              branch
              label={t('customersHub.sessionSectionsLabel')}
              options={sessionSections.map((value) => ({
                value,
                label: t(`customersHub.sessionSections.${value}`),
              }))}
              value={sessionSection}
              onChange={selectSessionSection}
            />
            <Suspense
              fallback={
                <p role="status" className="p-4 text-sm text-[hsl(var(--fg-secondary))]">
                  {t('customersHub.loading')}
                </p>
              }
            >
              {sessionSection === 'repairs' ? (
                <RepairTicketsSection />
              ) : sessionSection === 'salonSetup' ? (
                <SalonSetupSection />
              ) : sessionSection === 'commission' ? (
                <CommissionSection />
              ) : (
                <ServiceDeliveryContainer />
              )}
            </Suspense>
          </>
        ) : (
          <>
            <SegmentedControl
              branch
              label={t('customers.role.label')}
              options={[
                ...CUSTOMER_ROLES.map((value) => ({
                  value,
                  label: t(`customers.role.${value}`),
                })),
                ...(mayReadContracts
                  ? [{ value: 'contracts', label: t('customersHub.sections.contracts') }]
                  : []),
              ]}
              value={isContractsView ? 'contracts' : role}
              onChange={(next) => {
                if (next === 'contracts') {
                  selectContractsView('contracts')
                } else {
                  selectRole(next as CustomerRole)
                }
              }}
            />
            {isContractsView ? (
              <Suspense
                fallback={
                  <p role="status" className="p-4 text-sm text-[hsl(var(--fg-secondary))]">
                    {t('customersHub.loading')}
                  </p>
                }
              >
                <ContractsSection />
              </Suspense>
            ) : (
              <CustomersContainer role={role} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
