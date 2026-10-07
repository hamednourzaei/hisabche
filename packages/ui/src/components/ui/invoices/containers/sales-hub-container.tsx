'use client'

// ============================================
// «فروش و خرید» — selling and buying at one address: `/invoices`.
//
// Two tabs, and only two:
//
//   invoices   ONE table of every invoice — sale and purchase. «همه / فروش /
//              خرید» and the status filter change what the table holds, never
//              which table it is.
//   pricing    promotions and price lists (was /promotions)
//
// ⚠️ THERE IS NO «PURCHASE ORDERS» TAB, ON PURPOSE. A purchase is a purchase
// invoice, made with «فاکتور جدید» like a sale. The old /purchasing page listed
// a separate table that nothing in the product could add to — two parallel
// lines for one thing. It is gone; its address redirects here with «خرید» on.
//
// ⚠️ A HUB OVER THE SCREENS THAT ALREADY EXIST. Each tab mounts the container
// that owns that screen; the hub fetches nothing itself. The bar and the
// `?tab=` handling are the shared `HubTabs` / `useHubTab` — every hub uses them.
//
// ⚠️ A tab whose module is locked for this person is not offered — the same
// lock the menu applied to the page it came from (`isNavLocked`).
// ============================================

import { Suspense, lazy } from 'react'
import { useTranslations } from 'next-intl'
import { ReceiptText, Tags } from 'lucide-react'
import { useMyCapabilities } from '@hisabche/api'
import { isNavLocked } from '@hisabche/ui-contract'

import { HubTabs, useHubTab } from '../../hub-tabs'
import { usePageLook } from '../../../../lib/page-look'
import { RegisterCustomizer } from '../../register-customizer'
import { hubLookId } from '../../page-hub'
import { InvoicesContainer } from './invoices-container'

const PromotionsContainer = lazy(() =>
  import('../../promotions/promotions-container').then((m) => ({ default: m.PromotionsContainer })),
)

export const SALES_HUB_TABS = ['invoices', 'pricing'] as const
export type SalesHubTab = (typeof SALES_HUB_TABS)[number]

/**
 * The address each tab used to live at — which is also the key of its
 * permission module in `NAV_MODULE`.
 */
export const SALES_HUB_SOURCE: Record<SalesHubTab, string> = {
  invoices: '/invoices',
  pricing: '/promotions',
}

const TAB_ICON = { invoices: ReceiptText, pricing: Tags } as const

export function SalesHubContainer() {
  return <SalesHub />
}

function SalesHub() {
  const t = useTranslations('salesHub')
  const blocked = useMyCapabilities().data?.blockedModules ?? []
  const offered = SALES_HUB_TABS.filter((tab) => !isNavLocked(SALES_HUB_SOURCE[tab], blocked))
  const look = usePageLook('hub:invoices')
  const [active, select] = useHubTab(offered)

  return (
    <div className="relative space-y-4">
      <RegisterCustomizer
        groups={[
          {
            title: t('pageLook.hubSections' as any),
            look,
            keepOne: true,
            items: SALES_HUB_TABS.map((tab) => ({
              id: hubLookId(tab, tab),
              label: t(`salesHub.tabs.${tab}` as any),
            })),
          },
        ]}
      />
      <HubTabs
        label={t('label')}
        items={offered.map((tab) => ({ id: tab, label: t(`tabs.${tab}`), icon: TAB_ICON[tab] }))}
        active={active}
        onSelect={select}
      />

      <div role="tabpanel">
        {active === 'pricing' ? (
          <Suspense
            fallback={
              <p role="status" className="p-4 text-sm text-[hsl(var(--fg-secondary))]">
                {t('loading')}
              </p>
            }
          >
            <PromotionsContainer />
          </Suspense>
        ) : (
          <InvoicesContainer />
        )}
      </div>
    </div>
  )
}
