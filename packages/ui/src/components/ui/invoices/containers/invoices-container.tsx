// packages/ui/src/components/ui/invoices/containers/invoices-container.tsx
'use client'

import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  asList,
  useAdvances,
  useBranches,
  useCustomers,
  useWarehouseOverview,
  type Branch,
  type CustomerDepositRecord,
} from '@hisabche/api'
import { useInvoicesPage } from '../../../../hooks/invoices/use-invoices-page'
import { InvoicesView } from '../invoices-view'
import type { NewDocumentKind } from '../new-invoice-chooser'
import {
  advanceMatchesSearch,
  advanceRows as buildAdvanceRows,
  filterFromLegacyType,
  type AdvanceKind,
  type AdvanceListRow,
  type AdvanceStatusFilter,
  type InvoicePageFilter,
} from '../../../../lib/invoices/invoice-list-row'
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
  // Every document starts at the same address; only `?type=` differs.
  const handleNewDocument = useCallback(
    (kind: NewDocumentKind) => push(`/invoices/new?type=${kind}`),
    [push],
  )

  // The three page groups. An old `?type=pre_sale` link opens the advances
  // group narrowed to that one kind; its «show all» clears the narrowing.
  const params = useSearchParams()
  const initial = useMemo(() => filterFromLegacyType(params?.get('type')), [params])
  const [pageFilter, setPageFilter] = useState<InvoicePageFilter>(initial.filter)
  const [advanceKinds, setAdvanceKinds] = useState<readonly AdvanceKind[]>(initial.advanceKinds)
  const [advanceStatus, setAdvanceStatus] = useState<AdvanceStatusFilter>('all')
  const [focusAdvance, setFocusAdvance] = useState<string | null>(params?.get('advance') ?? null)

  const handleTypeChange = useCallback(
    (value: InvoicePageFilter) => {
      setPageFilter(value)
      setAdvanceKinds([])
      setAdvanceStatus('all')
      setFocusAdvance(null)
      // The group is the UI contract; the server still reads one canonical
      // `type`. «خرید و فروش» is both invoice kinds, so the query is unfiltered.
      // A dashboard link that arrived with `?type=sale` keeps its narrowing
      // until the user chooses a group here.
      handleTypeFilterChange('all')
    },
    [handleTypeFilterChange],
  )

  // ─── Advance documents (pre-sale / pre-purchase) ───────────────────────
  const preSales = useAdvances('pre_sale')
  const prePurchases = useAdvances('pre_purchase')
  const parties = useCustomers({ page: 1, limit: 100, sortDirection: 'desc' })

  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const party of parties.data?.customers ?? [])
      if (party.id) map.set(party.id, party.fullName)
    return map
  }, [parties.data])

  const advanceList = useMemo<AdvanceListRow[]>(() => {
    const wanted = (kind: AdvanceKind) => advanceKinds.length === 0 || advanceKinds.includes(kind)
    const records: CustomerDepositRecord[] = []
    if (wanted('pre_sale')) records.push(...(preSales.data ?? []))
    if (wanted('pre_purchase')) records.push(...(prePurchases.data ?? []))
    return buildAdvanceRows(records, nameById).filter(
      (row): row is AdvanceListRow => row.rowType === 'advance',
    )
  }, [advanceKinds, nameById, prePurchases.data, preSales.data])

  const visibleAdvanceRows = useMemo(() => {
    let rows = advanceList
    if (focusAdvance) rows = rows.filter((row) => row.id === focusAdvance)
    if (searchValue.trim()) rows = rows.filter((row) => advanceMatchesSearch(row, searchValue))
    return rows
  }, [advanceList, focusAdvance, searchValue])

  const advancesLoading = preSales.isPending || prePurchases.isPending
  const advancesError = preSales.isError || prePurchases.isError

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
      onNewDocument={handleNewDocument}
      advanceRows={visibleAdvanceRows}
      advancesLoading={advancesLoading}
      advancesError={advancesError}
      toolbarExtra={
        <div className="flex items-center gap-2">
          {focusAdvance ? (
            <button
              type="button"
              onClick={() => setFocusAdvance(null)}
              className="text-xs font-medium text-[hsl(var(--color-primary))] underline underline-offset-2"
            >
              {safeT('advances.showAll', 'نمایش همه')}
            </button>
          ) : null}
          <RecurringInvoicesButton t={safeT} />
        </div>
      }
      onDeleteInvoice={handleDeleteInvoice}
      statusVariant={statusVariant}
      typeFilter={pageFilter}
      onTypeFilterChange={handleTypeChange}
      statusFilter={statusFilter}
      onStatusFilterChange={handleStatusFilterChange}
      advanceStatusFilter={advanceStatus}
      onAdvanceStatusFilterChange={setAdvanceStatus}
      branches={branchOptions}
      branchFilter={branchFilter}
      onBranchFilterChange={handleBranchFilterChange}
      warehouses={warehouseOptions}
      warehouseFilter={warehouseFilter}
      onWarehouseFilterChange={handleWarehouseFilterChange}
    />
  )
}
