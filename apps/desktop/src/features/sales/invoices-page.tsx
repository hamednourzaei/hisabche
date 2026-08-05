// ============================================
// Invoice list — dense virtualized table, search, filters, context menu.
// ============================================

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Printer } from 'lucide-react'
import { useInvoices, type InvoiceWithCustomer } from '@hisabche/api'
import type { InvoiceStatus } from '@hisabche/validation'

import { Badge, Button, Input, type BadgeTone } from '@/components/ui/primitives'
import { ContextMenu, useContextMenu } from '@/components/ui/context-menu'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PageHeader } from '@/components/layout/page-header'
import { formatDate, formatMoney } from '@/shared/lib/currency'
import { useSearchFocus } from '@/shared/hooks/use-search-focus'
import { useCurrency } from '@/shared/stores/ui.store'

const TONE_BY_STATUS: Record<InvoiceStatus, BadgeTone> = {
  paid: 'success',
  completed: 'success',
  pending: 'warning',
  partial: 'info',
  overdue: 'danger',
  cancelled: 'neutral',
}

export default function InvoicesPage() {
  const { t } = useTranslation('desktop')
  const navigate = useNavigate()
  const currency = useCurrency()

  const searchRef = useRef<HTMLInputElement>(null)
  useSearchFocus(searchRef)

  const [search, setSearch] = useState('')
  const menu = useContextMenu<InvoiceWithCustomer>()

  const query = useInvoices(
    useMemo(
      () => ({ page: 1, limit: 200, sortDirection: 'desc' as const, search }),
      [search]
    )
  )

  const statusLabel = useCallback(
    (status: InvoiceStatus) =>
      t(`sales.status.${status}`, { defaultValue: status }),
    [t]
  )

  const columns = useMemo<readonly Column<InvoiceWithCustomer>[]>(
    () => [
      { key: 'number', header: t('sales.invoiceNumber'), width: '140px', render: (row) => row.invoiceNumber },
      {
        key: 'customer',
        header: t('sales.customer'),
        width: '1fr',
        render: (row) => row.customerName ?? row.customer?.full_name ?? '—',
      },
      { key: 'date', header: t('sales.date'), width: '140px', render: (row) => formatDate(row.date) },
      {
        key: 'status',
        header: t('sales.status'),
        width: '130px',
        render: (row) => {
          const status = (row.status ?? 'pending') as InvoiceStatus
          return <Badge tone={TONE_BY_STATUS[status] ?? 'neutral'}>{statusLabel(status)}</Badge>
        },
      },
      {
        key: 'amount',
        header: t('sales.amount'),
        width: '160px',
        align: 'end',
        render: (row) => formatMoney(row.total ?? 0, currency),
      },
    ],
    [currency, statusLabel, t]
  )

  const open = useCallback((row: InvoiceWithCustomer) => navigate(`/sales/${row.id}`), [navigate])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={t('sales.title')}>
        <Input
          ref={searchRef}
          value={search}
          placeholder={t('common.search')}
          onChange={(event) => setSearch(event.target.value)}
          className="w-64"
        />
        <Button variant="primary" size="sm" onClick={() => navigate('/sales/new')}>
          <Plus size={14} />
          {t('sales.newInvoice')}
        </Button>
      </PageHeader>

      <DataTable
        rows={query.data?.invoices ?? []}
        columns={columns}
        rowKey={(row, index) => row.id ?? `invoice-${index}`}
        loading={query.isLoading}
        emptyLabel={t('common.empty')}
        onRowActivate={open}
        onRowContextMenu={menu.open}
      />

      <ContextMenu
        state={menu.state}
        onClose={menu.close}
        items={[
          { key: 'open', label: t('sales.title'), onSelect: open },
          {
            key: 'print',
            label: t('sales.print'),
            icon: <Printer size={14} />,
            onSelect: (row) => navigate(`/sales/${row.id}?print=1`),
          },
        ]}
      />
    </div>
  )
}
