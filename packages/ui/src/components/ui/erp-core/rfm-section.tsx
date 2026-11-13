'use client'
// ============================================
// «بخش‌بندی مشتریان (RFM)» — how recently, how often and how much each
// customer buys (V61 B.2.15). Customers hub › `?view=rfm`.
//
// ⚠️ ONE ROW PER CUSTOMER AND CURRENCY. A customer who buys in AFN and USD has
// two rows; amounts are never added across currencies.
// ⚠️ «No purchases yet» is its own segment, not «dormant»: a customer we have
// never sold to is not one who stopped buying.
// ============================================
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useCustomerRfm, type CustomerRfmRow, type RfmSegment } from '@hisabche/api'

import { DataTable, type TableColumn } from '../data-table'
import { EmptyState } from '../empty-state'
import { SelectField } from '../select-field'
import { useCustomerOptions, useMoneyText } from '../business-packs/pack-shared'
import { QueryState, optionText, useTableLabel } from './erp-shared'

export const RFM_SEGMENTS: readonly RfmSegment[] = [
  'champions',
  'loyal',
  'at_risk',
  'dormant',
  'no_data',
]

export function RfmSection() {
  const t = useTranslations('erpCore.rfm')
  const tr = (key: string): string => t(key as Parameters<typeof t>[0])
  const label = useTableLabel()
  const money = useMoneyText()
  const customers = useCustomerOptions()
  const rfm = useCustomerRfm()
  const [segment, setSegment] = useState('')
  const [search, setSearch] = useState('')

  const nameOf = (id: string) => optionText(customers, id)
  const needle = search.trim().toLowerCase()
  const rows = (rfm.data ?? [])
    .filter((row) => (segment ? row.segment === segment : true))
    .filter((row) => (needle ? nameOf(row.customerId).toLowerCase().includes(needle) : true))

  const columns: TableColumn<CustomerRfmRow>[] = [
    {
      id: 'customer',
      labelKey: 'erpCore.rfm.columns.customer',
      labelFallback: 'مشتری',
      locked: true,
      render: (row) => nameOf(row.customerId),
    },
    {
      id: 'segment',
      labelKey: 'erpCore.rfm.columns.segment',
      labelFallback: 'بخش',
      render: (row) => tr(`segments.${row.segment}`),
    },
    {
      id: 'recency',
      labelKey: 'erpCore.rfm.columns.recency',
      labelFallback: 'آخرین خرید (روز پیش)',
      render: (row) => (row.recencyDays === null ? '—' : row.recencyDays),
      sortValue: (row) => row.recencyDays,
    },
    {
      id: 'frequency',
      labelKey: 'erpCore.rfm.columns.frequency',
      labelFallback: 'تعداد خرید',
      render: (row) => row.frequency,
      sortValue: (row) => row.frequency,
    },
    {
      id: 'monetary',
      labelKey: 'erpCore.rfm.columns.monetary',
      labelFallback: 'جمع خرید',
      render: (row) => (row.frequency === 0 ? '—' : money(row.monetaryMinor, row.currency)),
      sortValue: (row) => row.monetaryMinor,
    },
  ]

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-[hsl(var(--fg-secondary))]">{tr('intro')}</p>
      <QueryState
        isLoading={rfm.isLoading}
        isError={rfm.isError}
        onRetry={() => void rfm.refetch()}
        loadingText={tr('loading')}
        errorText={tr('loadFailed')}
        retryText={tr('retry')}
      >
        <DataTable
          tableId="customers-rfm"
          t={label}
          rows={rows}
          columns={columns}
          rowKey={(row) => `${row.customerId}:${row.currency}`}
          searchValue={search}
          onSearchChange={setSearch}
          actions={
            <SelectField
              name="segment"
              aria-label={tr('columns.segment')}
              value={segment}
              onChange={setSegment}
              options={[
                { value: '', label: tr('allSegments') },
                ...RFM_SEGMENTS.map((s) => ({ value: s, label: tr(`segments.${s}`) })),
              ]}
            />
          }
          emptyState={<EmptyState title={tr('emptyTitle')} description={tr('emptyDescription')} />}
        />
      </QueryState>
    </div>
  )
}
