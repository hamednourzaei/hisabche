'use client'

// ============================================
// packages/ui/src/components/ui/customers/containers/customer-list-container.tsx
//
// PHASE 5, actually consumed — the first list driven by the shared engine.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS RATHER THAN A REWRITE OF THE CUSTOMER SCREEN
//
// The customer screen works and people use it every day. §71.4 and §80 both
// say to protect that. Rewriting it to prove a hook works would risk a
// production screen to make a point.
//
// So this is the engine's first real consumer, standing beside the existing
// screen rather than replacing it: same endpoint, same hook, same data,
// driven entirely by `useListEngine`. It is what makes the phase real instead
// of a contract nothing calls, and it is where the next list gets copied from.
//
// ---------------------------------------------------------------------------
// THE ENGINE OWNS THE BEHAVIOUR; THIS FILE OWNS THE TRANSLATION
//
// Search, sort, paging and their edge cases all come from the contract. The
// only thing that happens here is the one thing the contract cannot know: how
// this particular endpoint spells its parameters.
// ============================================

import { memo, useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useCustomers } from '@hisabche/api'
import { useSyncStore } from '@hisabche/store'

import { useListEngine } from '../../../../hooks/use-list-engine'
import { CustomerListView } from '../customer-list-view'

export const CustomerListContainer = memo(function CustomerListContainer() {
  const translate = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const value = translate(key as Parameters<typeof translate>[0])
      return value && value !== key ? value : (fallback ?? key)
    },
    [translate],
  )

  const { isOnline, pendingCount } = useSyncStore()

  // ⚠️ ONE engine instance. An earlier draft called `useListEngine` twice —
  // once to build the query and once to receive the total — which produced two
  // independent states: sorting moved one and the pager read the other.
  //
  // The total therefore arrives through state rather than as a second call,
  // because it is genuinely not known until the server answers.
  const [total, setTotal] = useState<number | undefined>(undefined)

  const engine = useListEngine({
    initial: { sortBy: 'fullName', pageSize: 25 },
    total,
  })

  const { query } = engine

  const customers = useCustomers({
    page: Math.floor(query.offset / query.limit) + 1,
    limit: query.limit,
    ...(query.search ? { search: query.search } : {}),
    ...(query.sortBy ? { sortBy: query.sortBy } : {}),
    sortDirection: query.sortDirection ?? 'asc',
  })

  const reported = customers.data?.total

  useEffect(() => {
    // Only once the request has actually answered. Writing `undefined` back on
    // every refetch would make the engine forget the count and briefly render
    // a single page.
    if (reported !== undefined) setTotal(reported)
  }, [reported])

  return (
    <CustomerListView
      t={t}
      engine={engine}
      isOnline={isOnline}
      pendingCount={pendingCount}
      rows={customers.data?.customers ?? []}
      total={total ?? 0}
      isLoading={customers.isLoading}
      error={customers.error ? (customers.error as Error).message : null}
      onRefresh={() => customers.refetch()}
    />
  )
})

CustomerListContainer.displayName = 'CustomerListContainer'
