// ============================================
// CRM — customer table with debt tracking.
// ============================================

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { useCustomers } from '@hisabche/api'
import type { Customer } from '@hisabche/validation'

import { Badge, Button, Input, type BadgeTone } from '@/components/ui/primitives'
import { DataTable, type Column } from '@/components/ui/data-table'
import { FilterTabs, type FilterOption } from '@/components/ui/filter-tabs'
import { PageHeader } from '@/components/layout/page-header'
import { exportRows } from '@/shared/lib/spreadsheet'
import { formatMoney } from '@/shared/lib/currency'
import { useSearchFocus } from '@/shared/hooks/use-search-focus'
import { useCurrency } from '@/shared/stores/ui.store'

type BalanceFilter = 'all' | 'debt' | 'credit' | 'settled'

function balanceState(balance: number): { key: BalanceFilter; tone: BadgeTone } {
  if (balance > 0) return { key: 'debt', tone: 'warning' }
  if (balance < 0) return { key: 'credit', tone: 'info' }
  return { key: 'settled', tone: 'success' }
}

export default function CustomersPage() {
  const { t } = useTranslation('desktop')
  const navigate = useNavigate()
  const currency = useCurrency()

  const searchRef = useRef<HTMLInputElement>(null)
  useSearchFocus(searchRef)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<BalanceFilter>('all')

  const query = useCustomers(
    useMemo(() => ({ page: 1, limit: 300, sortDirection: 'desc' as const, search }), [search])
  )

  const rows = useMemo(() => {
    const list: Customer[] = query.data?.customers ?? []
    if (filter === 'all') return list
    return list.filter((customer) => balanceState(customer.openingBalance ?? 0).key === filter)
  }, [filter, query.data])

  const columns = useMemo<readonly Column<Customer>[]>(
    () => [
      { key: 'name', header: t('customers.name'), width: '1fr', render: (row) => row.fullName },
      { key: 'phone', header: t('customers.phone'), width: '160px', render: (row) => row.phone ?? '—' },
      {
        key: 'balance',
        header: t('customers.balance'),
        width: '170px',
        align: 'end',
        render: (row) => formatMoney(Math.abs(row.openingBalance ?? 0), currency),
      },
      {
        key: 'state',
        header: t('sales.status'),
        width: '130px',
        render: (row) => {
          const state = balanceState(row.openingBalance ?? 0)
          return <Badge tone={state.tone}>{t(`customers.${state.key}`)}</Badge>
        },
      },
    ],
    [currency, t]
  )

  const options: readonly FilterOption<BalanceFilter>[] = [
    { value: 'all', label: t('common.total') },
    { value: 'debt', label: t('customers.debt') },
    { value: 'credit', label: t('customers.credit') },
    { value: 'settled', label: t('customers.settled') },
  ]

  const onExport = useCallback(async () => {
    await exportRows(
      'customers.xlsx',
      rows.map((row) => ({
        fullName: row.fullName,
        phone: row.phone ?? '',
        balance: row.openingBalance ?? 0,
      }))
    )
  }, [rows])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={t('customers.title')}>
        <Input
          ref={searchRef}
          value={search}
          placeholder={t('common.search')}
          onChange={(event) => setSearch(event.target.value)}
          className="w-64"
        />
        <Button size="sm" variant="secondary" onClick={() => void onExport()}>
          <Download size={14} />
          {t('common.export')}
        </Button>
      </PageHeader>

      <FilterTabs options={options} value={filter} onChange={setFilter} />

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row, index) => row.id ?? `customer-${index}`}
        loading={query.isLoading}
        emptyLabel={t('common.empty')}
        onRowActivate={(row) => navigate(`/customers/${row.id}`)}
      />
    </div>
  )
}
