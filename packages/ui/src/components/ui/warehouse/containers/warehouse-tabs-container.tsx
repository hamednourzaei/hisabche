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

import { useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { ProductListContainer } from '../../products/containers/product-list-container'
import { warehouseContainer } from './Warehouse-container'
import { useLocaleReplace } from '../../../../hooks/use-locale-push'

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
  const localeReplace = useLocaleReplace()
  const params = useSearchParams()
  const translate = useTranslations()

  // Same fallback shape the other containers use: a missing key renders the
  // Persian label rather than the key itself.
  const t = useCallback(
    (key: string, fallback: string): string => {
      const value = translate(key as Parameters<typeof translate>[0])
      return value && value !== key ? value : fallback
    },
    [translate],
  )

  const active = warehouseTabFrom(params.get('tab'))

  const select = useCallback(
    (tab: WarehouseTab) => {
      // replace, not push: switching tabs is not something the back button
      // should have to walk through one step at a time.
      localeReplace(tab === 'stock' ? '/warehouse' : `/warehouse?tab=${tab}`)
    },
    [localeReplace],
  )

  const tabs: { id: WarehouseTab; label: string }[] = [
    { id: 'stock', label: t('nav.stock', 'موجودی') },
    { id: 'products', label: t('nav.product_list', 'کاتالوگ کالا') },
  ]

  return (
    <div>
      <div
        role="tablist"
        aria-label={t('nav.stock', 'انبار')}
        className="mb-4 flex gap-1 border-b border-border"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => select(tab.id)}
            className={
              active === tab.id
                ? '-mb-px border-b-2 border-primary px-4 py-2 text-sm font-semibold text-foreground'
                : '-mb-px border-b-2 border-transparent px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground'
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Both branches are ELEMENTS. See WarehouseStockTab above for why. */}
      {active === 'products' ? <ProductListContainer /> : <WarehouseStockTab />}
    </div>
  )
}
