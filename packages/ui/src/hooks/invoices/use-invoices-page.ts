// packages/ui/src/hooks/use-invoices-page.ts
"use client"

import { useState, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useInvoices, useDeleteInvoice } from "@hisabche/api"
import { mapInvoices } from "../../lib/invoices/invoices-mappers"
import { STATUS_MAP } from "../../lib/invoices/invoices-format"
import type { InvoicesQueryParams } from "../../lib/invoices/invoices-types"
// packages/ui/src/hooks/use-invoices-page.ts
const DEFAULT_FILTERS: InvoicesQueryParams = {
  page: 1,
  limit: 10,
  sortDirection: "desc",
}

export function useInvoicesPage() {
  const { t } = useTranslation()
  
  const [filters, setFilters] = useState<InvoicesQueryParams>(DEFAULT_FILTERS)

  const { data, isLoading, refetch } = useInvoices(filters)
  const deleteInvoice = useDeleteInvoice()

  const invoices = useMemo(
    () => mapInvoices(data?.invoices as any[] | undefined),
    [data]
  )

  const total = data?.total ?? 0

  const statusVariant = useCallback(
    (status: string) => STATUS_MAP[status] || "secondary",
    []
  )

  const handleSearchChange = useCallback(
    (value: string) => setFilters((prev) => ({ ...prev, search: value, page: 1 })),
    []
  )

  const handleClearFilters = useCallback(
    () => setFilters(DEFAULT_FILTERS),
    []
  )

  const handlePageChange = useCallback(
    (page: number) => setFilters((prev) => ({ ...prev, page })),
    []
  )

  const handleDeleteInvoice = useCallback(
    async (id: string) => {
      if (id) {
        await deleteInvoice.mutateAsync(id)
        refetch()
      }
    },
    [deleteInvoice, refetch]
  )

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key)
      return v !== key ? v : (fallback ?? key)
    },
    [t]
  )

  return {
    invoices,
    isLoading,
    total,
    filters: {
      page: filters.page,
      limit: filters.limit,
    },
    statusVariant,
    handleSearchChange,
    handleClearFilters,
    handlePageChange,
    handleDeleteInvoice,
    safeT,
  }
}