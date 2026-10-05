// packages/ui/src/containers/invoices-container.tsx
'use client'

import { useCallback, useMemo } from 'react'
import { asList, useBranches, useWarehouseOverview, type Branch } from '@hisabche/api'
import { useInvoicesPage } from '../../../../hooks/invoices/use-invoices-page'
import { InvoicesView } from '../invoices-view'
import { useLocalePush } from '../../../../hooks/use-locale-push'
import { RecurringInvoicesButton } from '../recurring-invoices'

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
    statusFilter,
    branchFilter,
    handleBranchFilterChange,
    warehouseFilter,
    handleWarehouseFilterChange,
    handleStatusFilterChange,
    handleSearchChange,
    handlePageChange,
    handleDeleteInvoice,
    safeT,
  } = useInvoicesPage()

  // The places an invoice can belong to — what the table's two filters offer.
  const branchList = useBranches().data
  const warehouseList = useWarehouseOverview().data?.warehouses
  const branchOptions = useMemo(
    () => asList<Branch>(branchList).map((branch) => ({ id: branch.id, name: branch.name })),
    [branchList],
  )
  const warehouseOptions = useMemo(
    () =>
      asList<{ id: string; name: string }>(warehouseList).map((warehouse) => ({
        id: warehouse.id,
        name: warehouse.name,
      })),
    [warehouseList],
  )

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
      toolbarExtra={<RecurringInvoicesButton t={safeT} />}
      onDeleteInvoice={handleDeleteInvoice}
      statusVariant={statusVariant}
      typeFilter={typeFilter}
      onTypeFilterChange={handleTypeFilterChange}
      statusFilter={statusFilter}
      onStatusFilterChange={handleStatusFilterChange}
      branches={branchOptions}
      branchFilter={branchFilter}
      onBranchFilterChange={handleBranchFilterChange}
      warehouses={warehouseOptions}
      warehouseFilter={warehouseFilter}
      onWarehouseFilterChange={handleWarehouseFilterChange}
    />
  )
}
