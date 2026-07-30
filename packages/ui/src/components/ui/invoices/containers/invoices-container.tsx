// packages/ui/src/containers/invoices-container.tsx
"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useInvoicesPage } from "../../../../hooks/invoices/use-invoices-page"
import { InvoicesView } from "../invoices-view"

export function InvoicesContainer() {
  const router = useRouter()
  
  const {
    invoices,
    isLoading,
    total,
    filters,
    statusVariant,
    handleSearchChange,
    handleClearFilters,
    handlePageChange,
    handleDeleteInvoice,
    safeT,
  } = useInvoicesPage()

  const handleNavigateInvoice = useCallback(
    (id: string) => router.push(`/invoices/${id}`),
    [router]
  )

  const handleNavigateInvoiceAction = useCallback(
    (id: string, action: "pdf" | "print" | "png") => router.push(`/invoices/${id}?action=${action}`),
    [router]
  )

  const handleNewInvoice = useCallback(
    () => router.push("/quick-invoice"),
    [router]
  )

  return (
    <InvoicesView
      t={safeT}
      invoices={invoices}
      isLoading={isLoading}
      total={total}
      filters={filters}
      onSearchChange={handleSearchChange}
      onClearFilters={handleClearFilters}
      onPageChange={handlePageChange}
      onNavigateInvoice={handleNavigateInvoice}
      onNavigateInvoiceAction={handleNavigateInvoiceAction}
      onNewInvoice={handleNewInvoice}
      onDeleteInvoice={handleDeleteInvoice}
      statusVariant={statusVariant}
    />
  )
}