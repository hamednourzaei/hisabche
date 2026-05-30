"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useInvoices, useDeleteInvoice } from "@hisabche/api"
import { InvoicesPage } from "../invoices-page"
import type { InvoiceFilters } from "@hisabche/validation"

export function InvoicesContainer() {
  const { t } = useTranslation()
  const router = useRouter()
  const [filters, setFilters] = useState<InvoiceFilters>({ page: 1, limit: 10, sortDirection: "desc" })
  const { data, isLoading } = useInvoices(filters)
  const deleteInvoice = useDeleteInvoice()

  const safeT = (key: string, fallback?: string) => { const v = t(key); return v && v !== key ? v : (fallback ?? key) }

  const statusVariant = (status: string): "success" | "warning" | "destructive" | "secondary" => {
    const map: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
      completed: "success", pending: "warning", partial: "secondary", cancelled: "destructive",
    }
    return map[status] || "secondary"
  }

  const rawInvoices: any[] = (data?.invoices as any[]) || []
  const invoices = rawInvoices.map((inv) => ({
    id: inv.id ?? inv._id ?? inv.invoiceId ?? inv.invoice_id ?? "",
    invoiceNumber: inv.invoiceNumber ?? inv.invoice_number ?? "???",
    date: inv.date ? new Date(inv.date).toLocaleDateString("fa-AF") : "",
    status: inv.status ?? "",
    total: inv.total ?? 0,
    currency: inv.currency ?? "AFN",
  }))

  return (
    <InvoicesPage
      t={safeT}
      invoices={invoices}
      isLoading={isLoading}
      total={data?.total ?? 0}
      filters={{ page: filters.page ?? 1, limit: filters.limit ?? 10 }}
      onSearchChange={(value) => setFilters({ ...filters, search: value, page: 1 })}
      onClearFilters={() => setFilters({ page: 1, limit: 10, sortDirection: "desc" })}
      onPageChange={(page) => setFilters({ ...filters, page })}
      onNavigateInvoice={(id) => router.push(`/invoices/${id}`)}
      onNewInvoice={() => router.push("/quick-invoice")}
      onDeleteInvoice={(id) => { if (id) deleteInvoice.mutate(id) }}
      statusVariant={statusVariant}
    />
  )
}