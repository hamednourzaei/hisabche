'use client'

// ============================================
// URL state for an admin list.
//
// Search, page, sort and filters lived in `useState`, so a refresh, the back
// button and a shared link all lost the view — and the workspace filter ran
// after pagination, which made both the rows and their counts wrong.
//
// One hook owns those keys. `tab` is left untouched, and navigation goes
// through `useLocaleReplace`, so an English console stays English.
// ============================================

import { useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useLocaleReplace } from '@/components/ui'
import { routeOf } from '@/components/admin-shell/admin-nav'

const QUERY_KEY = 'q'
const PAGE_KEY = 'page'
const SORT_KEY = 'sort'

export interface AdminListState {
  query: string
  page: number
  sort: string | null
  filter: (key: string) => string | null
  setQuery: (value: string) => void
  setPage: (value: number) => void
  setSort: (value: string | null) => void
  setFilter: (key: string, value: string | null) => void
  reset: () => void
}

export interface AdminListStateOptions {
  /** The filter keys this list owns; `reset()` removes them. */
  filterKeys?: readonly string[]
}

export function useAdminListState({ filterKeys = [] }: AdminListStateOptions = {}): AdminListState {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const replace = useLocaleReplace()

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString())
      let changedView = false
      for (const [key, value] of Object.entries(patch)) {
        if (key !== PAGE_KEY) changedView = true
        if (value === null || value === '') next.delete(key)
        else next.set(key, value)
      }
      // A new query, sort or filter starts at the first page. Without this,
      // narrowing a list on page 4 showed an empty table.
      if (changedView && !(PAGE_KEY in patch)) next.delete(PAGE_KEY)
      const queryString = next.toString()
      replace(`${routeOf(pathname)}${queryString ? `?${queryString}` : ''}`)
    },
    [pathname, replace, searchParams],
  )

  const rawPage = Number(searchParams.get(PAGE_KEY) ?? '1')
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1

  return {
    query: searchParams.get(QUERY_KEY) ?? '',
    page,
    sort: searchParams.get(SORT_KEY),
    filter: (key) => searchParams.get(key),
    setQuery: (value) => update({ [QUERY_KEY]: value }),
    setPage: (value) => update({ [PAGE_KEY]: value <= 1 ? null : String(value) }),
    setSort: (value) => update({ [SORT_KEY]: value }),
    setFilter: (key, value) => update({ [key]: value }),
    reset: () => {
      const patch: Record<string, string | null> = {
        [QUERY_KEY]: null,
        [PAGE_KEY]: null,
        [SORT_KEY]: null,
      }
      for (const key of filterKeys) patch[key] = null
      update(patch)
    },
  }
}
