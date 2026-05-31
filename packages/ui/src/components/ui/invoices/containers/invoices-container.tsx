"use client"

import { useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useInvoices, useDeleteInvoice } from "@hisabche/api"
import { InvoicesPage } from "../invoices-page"
import type { InvoiceFilters } from "@hisabche/validation"

const STATUS_MAP: Record<
  string,
  "success" | "warning" | "destructive" | "secondary"
> = {
  completed: "success",
  pending: "warning",
  partial: "secondary",
  cancelled: "destructive",
}

const fmtDate = (d: string): string => {
  try {
    return new Date(d).toLocaleDateString("fa-AF")
  } catch {
    return ""
  }
}

interface RawInvoice {
  id?: string
  _id?: string
  invoiceId?: string
  invoice_id?: string
  invoiceNumber?: string
  invoice_number?: string
  date?: string
  status?: string
  total?: number
  currency?: string
}

export function InvoicesContainer() {
  const { t } = useTranslation()
  const router = useRouter()

  const [filters, setFilters] = useState<InvoiceFilters>({
    page: 1,
    limit: 10,
    sortDirection: "desc",
  })

  const { data, isLoading } = useInvoices(filters)
  const deleteInvoice = useDeleteInvoice()

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key)
      return v && v !== key ? v : (fallback ?? key)
    },
    [t]
  )

  const statusVariant = useCallback(
    (status: string) => STATUS_MAP[status] || "secondary",
    []
  )

  const invoices = useMemo(() => {
    const rawInvoices: RawInvoice[] = (data?.invoices as RawInvoice[]) || []
    return rawInvoices.map((inv) => ({
      id: inv.id ?? inv._id ?? inv.invoiceId ?? inv.invoice_id ?? "",
      invoiceNumber:
        inv.invoiceNumber ?? inv.invoice_number ?? "???",
      date: inv.date ? fmtDate(inv.date) : "",
      status: inv.status ?? "",
      total: inv.total ?? 0,
      currency: inv.currency ?? "AFN",
    }))
  }, [data])

  const handleSearchChange = useCallback(
    (value: string) =>
      setFilters((prev) => ({ ...prev, search: value, page: 1 })),
    []
  )

  const handleClearFilters = useCallback(
    () =>
      setFilters({ page: 1, limit: 10, sortDirection: "desc" }),
    []
  )

  const handlePageChange = useCallback(
    (page: number) => setFilters((prev) => ({ ...prev, page })),
    []
  )

  const handleNavigateInvoice = useCallback(
    (id: string) => router.push(`/invoices/${id}`),
    [router]
  )

  const handleNewInvoice = useCallback(
    () => router.push("/quick-invoice"),
    [router]
  )

  const handleDeleteInvoice = useCallback(
    (id: string) => {
      if (id) deleteInvoice.mutate(id)
    },
    [deleteInvoice]
  )

  return (
    <InvoicesPage
      t={safeT}
      invoices={invoices}
      isLoading={isLoading}
      total={data?.total ?? 0}
      filters={{
        page: filters.page ?? 1,
        limit: filters.limit ?? 10,
      }}
      onSearchChange={handleSearchChange}
      onClearFilters={handleClearFilters}
      onPageChange={handlePageChange}
      onNavigateInvoice={handleNavigateInvoice}
      onNewInvoice={handleNewInvoice}
      onDeleteInvoice={handleDeleteInvoice}
      statusVariant={statusVariant}
    />
  )
}