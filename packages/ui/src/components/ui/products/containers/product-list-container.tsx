'use client'

// ============================================
// packages/ui/src/components/ui/products/containers/product-list-container.tsx
//
// The SECOND consumer of `useListEngine` — the one that proves it is general.
//
// ---------------------------------------------------------------------------
// WHAT THE SECOND CONSUMER FOUND
//
// The customer list and this one disagree about how the endpoint spells its
// parameters, which is exactly the seam the engine exists to absorb: the
// engine emits one `ListQuery` and each container translates it. If a second
// list had needed the engine CHANGED rather than translated, the engine would
// have been shaped around its first caller and not actually shared.
//
// It also uses a different sort field set and a different empty state, so the
// view is not a copy of the customer one — it is the same behaviour with
// different columns, which is the whole point.
// ============================================

import { memo, useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useProducts } from '@hisabche/api'
import { useSyncStore } from '@hisabche/store'

import { useListEngine } from '../../../../hooks/use-list-engine'
import { useLocalePush } from '../../../../hooks/use-locale-push'
import { ProductListView } from '../product-list-view'

export const ProductListContainer = memo(function ProductListContainer() {
  const translate = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const value = translate(key as Parameters<typeof translate>[0])
      return value && value !== key ? value : (fallback ?? key)
    },
    [translate],
  )

  const { isOnline, pendingCount } = useSyncStore()
  const push = useLocalePush()
  // The same product page a row of the warehouse table opens.
  const openProduct = useCallback((id: string) => push(`/warehouse/${id}`), [push])

  const [total, setTotal] = useState<number | undefined>(undefined)

  const engine = useListEngine({
    initial: { sortBy: 'name', pageSize: 25 },
    total,
  })

  const { query } = engine

  const products = useProducts({
    page: Math.floor(query.offset / query.limit) + 1,
    limit: query.limit,
    ...(query.search ? { search: query.search } : {}),
    ...(query.sortBy ? { sortBy: query.sortBy } : {}),
    sortDirection: query.sortDirection ?? 'asc',
  })

  const reported = (products.data as { total?: number } | undefined)?.total

  useEffect(() => {
    if (reported !== undefined) setTotal(reported)
  }, [reported])

  const rows = (products.data as { products?: unknown[] } | undefined)?.products ?? []

  return (
    <ProductListView
      t={t}
      engine={engine}
      isOnline={isOnline}
      pendingCount={pendingCount}
      rows={rows as ProductRow[]}
      total={total ?? 0}
      isLoading={products.isLoading}
      error={products.error ? (products.error as Error).message : null}
      onRefresh={() => products.refetch()}
      onOpen={openProduct}
    />
  )
})

ProductListContainer.displayName = 'ProductListContainer'

export interface ProductRow {
  id: string
  name: string
  sku?: string | null
  quantity?: number | null
  minStockLevel?: number | null
}
