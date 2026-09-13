// packages/ui/src/hooks/use-invoices-page.ts
'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useInvoices, useDeleteInvoice } from '@hisabche/api'
import { mapInvoices } from '../../lib/invoices/invoices-mappers'
import { STATUS_MAP } from '../../lib/invoices/invoices-format'
import type { InvoicesQueryParams } from '../../lib/invoices/invoices-types'
import { parseInvoiceFilters } from '../../lib/invoices/invoice-filter-link'

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: InvoicesQueryParams = {
  page: 1,
  limit: 10,
  sortDirection: 'desc',
}

/**
 * The stat cards read `summary`, which the server computes over EVERY invoice
 * matching the search. The rows of this query feed only the CSV export.
 *
 * ⚠️ This was `500` and the cards summed the rows. The route caps a page at
 * 100 whatever is asked, so «۵۰۰» never happened: a business with more than
 * 100 invoices read its latest hundred as its totals. 100 is what it gets.
 */
const STATS_LIMIT = 100

// ─── Main Hook ─────────────────────────────────────────────────────────────

export function useInvoicesPage() {
  const t = useTranslations()

  // ─── H1 — the URL is where a dashboard card puts its filter ───────────────
  //
  // Before this, the list read no query parameters, so every card that linked
  // here would have landed on the same unfiltered table — a number you can
  // click that shows you something else.
  //
  // Seeded as the INITIAL state rather than kept in sync with the URL: once
  // the page is open the filter controls own the state, and re-reading the URL
  // on every render would fight the user's own selection. Arriving at
  // `?type=sale&outstanding=true` and then pressing «همه» must show everything.
  const searchParams = useSearchParams()
  const initialFilters = useMemo(
    () => ({ ...DEFAULT_FILTERS, ...parseInvoiceFilters(searchParams) }),
    // Deliberately once. See above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const [filters, setFilters] = useState<InvoicesQueryParams>(initialFilters)

  // ─── Data Fetching ──────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useInvoices(filters)
  const { data: statsData } = useInvoices({
    page: 1,
    limit: STATS_LIMIT,
    sortDirection: 'desc',
    includeSummary: true,
    ...(filters.search ? { search: filters.search } : {}),
  })
  const deleteInvoice = useDeleteInvoice()

  // ─── Transformations ────────────────────────────────────────────────────
  // The reader's calendar. `mapInvoices` formats dates, so it needs it.
  const lang = useLocale()

  const invoices = useMemo(
    () => mapInvoices(data?.invoices as any[] | undefined, lang),
    [data, lang],
  )

  /** One page of matching invoices — for the CSV export only, never for a figure. */
  const statsInvoices = useMemo(
    () => mapInvoices(statsData?.invoices as any[] | undefined, lang),
    [statsData, lang],
  )

  /** `null` when the server sent no summary — the cards are then not shown. */
  const statsSummary = statsData?.summary ?? null

  const total = data?.total ?? 0

  // ─── Handlers ───────────────────────────────────────────────────────────
  const statusVariant = useCallback((status: string) => STATUS_MAP[status] || 'secondary', [])

  const handleSearchChange = useCallback(
    (value: string) => setFilters((prev) => ({ ...prev, search: value, page: 1 })),
    [],
  )

  /**
   * همه / فروش / خرید. "all" removes the key entirely rather than sending an
   * empty string, so the backend's `if (type)` guard behaves as intended.
   * Always resets to page 1 — staying on page 3 of a narrower result set
   * would show an empty table.
   */
  const handleTypeFilterChange = useCallback(
    (value: 'all' | 'sale' | 'purchase') =>
      setFilters((prev) => {
        const next = { ...prev, page: 1 }
        if (value === 'all') {
          delete next.type
          return next
        }
        return { ...next, type: value }
      }),
    [],
  )

  const handleClearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), [])

  const handlePageChange = useCallback(
    (page: number) => setFilters((prev) => ({ ...prev, page })),
    [],
  )

  const handleDeleteInvoice = useCallback(
    async (id: string) => {
      if (id) {
        await deleteInvoice.mutateAsync(id)
        refetch()
      }
    },
    [deleteInvoice, refetch],
  )

  // ─── Safe Translation ──────────────────────────────────────────────────
  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key)
      return v !== key ? v : (fallback ?? key)
    },
    [t],
  )

  // ─── Return ────────────────────────────────────────────────────────────
  return {
    invoices,
    statsInvoices,
    statsSummary,
    isLoading,
    total,
    searchValue: filters.search ?? '',
    filters: {
      page: filters.page,
      limit: filters.limit,
    },
    statusVariant,
    typeFilter: (filters.type ?? 'all') as 'all' | 'sale' | 'purchase',
    handleTypeFilterChange,
    handleSearchChange,
    handleClearFilters,
    handlePageChange,
    handleDeleteInvoice,
    safeT,
  }
}
