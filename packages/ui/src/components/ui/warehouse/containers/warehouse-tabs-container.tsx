'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/containers/warehouse-tabs-container.tsx
//
// G1 — the warehouse screen and the product catalogue, under one destination.
//
// ---------------------------------------------------------------------------
// WHY THEY ARE TWO VIEWS AND NOT ONE LIST
//
// `/product-list` and `/warehouse` were two top-level routes reading the same
// `products` table, which is one destination too many. But they are not the
// same view, and merging them into a single list would lose something real:
//
//   موجودی      what is on hand, per warehouse — quantities, value, reorder
//   کاتالوگ کالا what the business sells — names, SKUs, prices
//
// A shopkeeper checking whether to reorder and a shopkeeper fixing a price are
// doing different jobs. So: two tabs, one route.
//
// ---------------------------------------------------------------------------
// WHY THIS LIVES IN packages/ui AND NOT IN THE WEB APP
//
// The first draft put the tabs in `apps/web/.../warehouse-client.tsx`. That
// gave web a catalogue tab and left desktop without one — the exact divergence
// this package exists to prevent, and the reason desktop shims
// `next/navigation` onto react-router in the first place.
//
// ---------------------------------------------------------------------------
// WHY THE TAB IS IN THE URL
//
// So the choice survives a reload, so it can be linked to, and so the
// deprecated `/product-list` has somewhere exact to redirect:
// `/warehouse?tab=products`.
// ============================================

import { Suspense, lazy, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Hourglass, Warehouse as WarehouseIcon } from 'lucide-react'
import { useMyCapabilities } from '@hisabche/api'
import { isNavLocked } from '@hisabche/ui-contract'

import { ProductListContainer } from '../../products/containers/product-list-container'
import { warehouseContainer } from './Warehouse-container'
import { useLocaleReplace } from '../../../../hooks/use-locale-push'
import { HubTabs, useHubSection, useHubTab } from '../../hub-tabs'
import { usePageLook } from '../../../../lib/page-look'
import { RegisterCustomizer } from '../../register-customizer'
import { hubLookId } from '../../page-hub'
import { SegmentedControl } from '../../segmented-control'

// «پیشنهاد سفارش» and «کالای راکد» (were on /operations): the same products.
const OpsSectionContainer = lazy(() =>
  import('../../inventory-ops/containers/inventory-ops-container').then((m) => ({
    default: m.OpsSectionContainer,
  })),
)

const ExpiryContainer = lazy(() =>
  import('../../expiry/containers/expiry-container').then((m) => ({ default: m.ExpiryContainer })),
)

//
// «انبار» at one address: `/warehouse`. Two tabs, and only two:
//
//   stock    what we have — «انبارها» (each warehouse, opened from its row) or
//            «کالاها» (every product). One switch, one part on screen at a time.
//   expiry   batches and what is about to expire (was /expiry)
//
// ⚠️ A HUB OVER THE SCREENS THAT ALREADY EXIST. Every part mounts the container
// that owns it; the hub fetches nothing. The bar, the switch and the address
// handling are the shared `HubTabs` / `SegmentedControl` / `useHubTab` /
// `useHubSection`.
//
// ⚠️ «شمارش انبار» (/stock-count) IS NOT HERE, ON PURPOSE. Nothing in the
// product can START a count — `useCreateCycleCount` has no caller — so its list
// is a table nobody can add to. It stays at its own address until that is
// decided; see .claude/ux-audit/00-PROPOSAL.md.
//
// ⚠️ /operations is not here either: it is reorder and dead stock mixed with
// till shifts and stale sales opportunities — not one job.

export const WAREHOUSE_HUB_TABS = ['stock', 'expiry'] as const
export type WarehouseHubTab = (typeof WAREHOUSE_HUB_TABS)[number]

/** The address each tab used to live at — the key of its lock in `NAV_MODULE`. */
export const WAREHOUSE_HUB_SOURCE: Record<WarehouseHubTab, string> = {
  stock: '/warehouse',
  expiry: '/expiry',
}

export const STOCK_SECTIONS = ['warehouses', 'products', 'reorder', 'deadStock'] as const
export type StockSection = (typeof STOCK_SECTIONS)[number]

/** `?warehouse=` names an open warehouse; the product list has no use for it. */
const STOCK_SECTION_CLEARS = ['warehouse'] as const

const TAB_ICON = { stock: WarehouseIcon, expiry: Hourglass } as const

export type WarehouseTab = 'stock' | 'products'

/**
 * ⚠️ A COMPONENT, not an inline call. This crashed production.
 *
 * `warehouseContainer` is written as a plain function that calls a dozen hooks
 * — useTranslations, useRouter, useQueryClient, useState, useEffect, useMemo.
 * Calling it inline, as `warehouseContainer()`, runs those hooks as part of the
 * CALLER's hook list.
 *
 * The first version of this file did exactly that, conditionally:
 *
 *     active === 'products' ? <ProductListContainer /> : warehouseContainer()
 *
 * On the stock tab the parent rendered ~12 hooks; on the products tab it
 * rendered 3. Switching tabs therefore changed the hook count between renders,
 * which is React error #300 — "rendered fewer hooks than during the previous
 * render" — and it took the whole page down through the error boundary.
 *
 * Wrapping it in a component gives those hooks their own instance, so the
 * parent's hook list is the same on every render no matter which tab is up.
 * Declared at module scope, not inside the parent: a component defined during
 * render is a NEW type each time, which remounts the subtree and loses its
 * state on every keystroke.
 */
function WarehouseStockTab() {
  return warehouseContainer()
}

/** Anything that is not the catalogue is stock — what «انبار» means by default. */
export function warehouseTabFrom(value: string | null | undefined): WarehouseTab {
  return value === 'products' ? 'products' : 'stock'
}

export function WarehouseTabsContainer() {
  return <WarehouseHub />
}

function WarehouseHub() {
  const t = useTranslations()
  const blocked = useMyCapabilities().data?.blockedModules ?? []

  const allowedTabs = WAREHOUSE_HUB_TABS.filter(
    (tab) => !isNavLocked(WAREHOUSE_HUB_SOURCE[tab], blocked),
  )
  const look = usePageLook('hub:warehouse')

  const offeredStockSections = STOCK_SECTIONS.filter((sec) => look.shows(hubLookId('stock', sec)))
  const offered = allowedTabs.filter((tab) => {
    if (tab === 'expiry') return look.shows(hubLookId('expiry', 'expiry'))
    return offeredStockSections.length > 0
  })

  const [active, select] = useHubTab(offered)
  const [section, selectSection] = useHubSection(offeredStockSections, STOCK_SECTION_CLEARS)

  // The catalogue's old address, `?tab=products`, is a section now.
  const params = useSearchParams()
  const localeReplace = useLocaleReplace()
  const oldCatalogueAddress = params.get('tab') === 'products'
  useEffect(() => {
    if (oldCatalogueAddress) localeReplace('/warehouse?view=products')
  }, [oldCatalogueAddress, localeReplace])

  return (
    <div className="relative space-y-4">
      <RegisterCustomizer
        groups={[
          {
            title: t('pageLook.hubSections' as any),
            look,
            keepOne: true,
            items: [
              ...(allowedTabs.includes('expiry')
                ? [{ id: hubLookId('expiry', 'expiry'), label: t('warehouseHub.tabs.expiry') }]
                : []),
              ...(allowedTabs.includes('stock')
                ? STOCK_SECTIONS.map((sec) => ({
                    id: hubLookId('stock', sec),
                    label: t(`warehouseHub.sections.${sec}`),
                  }))
                : []),
            ],
          },
        ]}
      />
      <HubTabs
        label={t('warehouseHub.label')}
        items={offered.map((tab) => ({
          id: tab,
          label: t(`warehouseHub.tabs.${tab}`),
          icon: TAB_ICON[tab],
        }))}
        active={active}
        onSelect={select}
      />

      <div role="tabpanel" className="space-y-4">
        {active === 'expiry' ? (
          <Suspense
            fallback={
              <p role="status" className="p-4 text-sm text-[hsl(var(--fg-secondary))]">
                {t('warehouseHub.loading')}
              </p>
            }
          >
            <ExpiryContainer />
          </Suspense>
        ) : (
          <>
            <SegmentedControl
              branch
              label={t('warehouseHub.sectionsLabel')}
              options={STOCK_SECTIONS.map((value) => ({
                value,
                label: t(`warehouseHub.sections.${value}`),
              }))}
              value={section}
              onChange={selectSection}
            />
            {/* Both branches are ELEMENTS. See WarehouseStockTab above for why. */}
            {section === 'reorder' || section === 'deadStock' ? (
              <Suspense
                fallback={
                  <p role="status" className="p-4 text-sm text-[hsl(var(--fg-secondary))]">
                    {t('warehouseHub.loading')}
                  </p>
                }
              >
                <OpsSectionContainer section={section} />
              </Suspense>
            ) : section === 'products' ? (
              <ProductListContainer />
            ) : (
              <WarehouseStockTab />
            )}
          </>
        )}
      </div>
    </div>
  )
}
