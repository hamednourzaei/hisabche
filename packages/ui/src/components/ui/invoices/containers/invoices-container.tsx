// packages/ui/src/containers/invoices-container.tsx
'use client'

import { useCallback } from 'react'
import { useInvoicesPage } from '../../../../hooks/invoices/use-invoices-page'
import { InvoicesView } from '../invoices-view'
import { useLocalePush } from '../../../../hooks/use-locale-push'

export function InvoicesContainer() {
  const push = useLocalePush()

  const {
    invoices,
    statsInvoices,
    statsSummary,
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

  const handleNavigateInvoice = useCallback((id: string) => push(`/invoices/${id}`), [push])

  // H2 — the party's name in the table reaches the party's profile.
  const handleNavigateParty = useCallback((id: string) => push(`/customers/${id}`), [push])

  const handleNavigateInvoiceAction = useCallback(
    (id: string, action: 'pdf' | 'print' | 'png') => push(`/invoices/${id}?action=${action}`),
    [push],
  )

  // «فاکتور جدید» opens the two-stage builder. `/quick-invoice` still exists
  // and still works — it is the fast path for a one-line cash sale, reachable
  // from the command palette and the FAB, and every bookmark to it is intact.
  const handleNewInvoice = useCallback(() => push('/invoices/new'), [push])

  return (
    <InvoicesView
      t={safeT}
      invoices={invoices}
      statsInvoices={statsInvoices}
      statsSummary={statsSummary}
      isLoading={isLoading}
      total={total}
      searchValue={searchValue}
      filters={filters}
      onSearchChange={handleSearchChange}
      onPageChange={handlePageChange}
      onNavigateInvoice={handleNavigateInvoice}
      onNavigateParty={handleNavigateParty}
      onNavigateInvoiceAction={handleNavigateInvoiceAction}
      onNewInvoice={handleNewInvoice}
      onDeleteInvoice={handleDeleteInvoice}
      statusVariant={statusVariant}
      typeFilter={typeFilter}
      onTypeFilterChange={handleTypeFilterChange}
    />
  )
}
