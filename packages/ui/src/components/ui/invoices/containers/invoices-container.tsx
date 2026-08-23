// packages/ui/src/containers/invoices-container.tsx
'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useInvoicesPage } from '../../../../hooks/invoices/use-invoices-page'
import { InvoicesView } from '../invoices-view'

export function InvoicesContainer() {
  const router = useRouter()

  const {
    invoices,
    statsInvoices,
    isLoading,
    total,
    searchValue,
    filters,
    statusVariant,
    typeFilter,
    handleTypeFilterChange,
    handleSearchChange,
    handlePageChange,
    handleDeleteInvoice,
    safeT,
  } = useInvoicesPage()

  const handleNavigateInvoice = useCallback(
    (id: string) => router.push(`/invoices/${id}`),
    [router],
  )

  const handleNavigateInvoiceAction = useCallback(
    (id: string, action: 'pdf' | 'print' | 'png') =>
      router.push(`/invoices/${id}?action=${action}`),
    [router],
  )

  // «فاکتور جدید» opens the two-stage builder. `/quick-invoice` still exists
  // and still works — it is the fast path for a one-line cash sale, reachable
  // from the command palette and the FAB, and every bookmark to it is intact.
  const handleNewInvoice = useCallback(() => router.push('/invoices/new'), [router])

  return (
    <InvoicesView
      t={safeT}
      invoices={invoices}
      statsInvoices={statsInvoices}
      isLoading={isLoading}
      total={total}
      searchValue={searchValue}
      filters={filters}
      onSearchChange={handleSearchChange}
      onPageChange={handlePageChange}
      onNavigateInvoice={handleNavigateInvoice}
      onNavigateInvoiceAction={handleNavigateInvoiceAction}
      onNewInvoice={handleNewInvoice}
      onDeleteInvoice={handleDeleteInvoice}
      statusVariant={statusVariant}
      typeFilter={typeFilter}
      onTypeFilterChange={handleTypeFilterChange}
    />
  )
}
