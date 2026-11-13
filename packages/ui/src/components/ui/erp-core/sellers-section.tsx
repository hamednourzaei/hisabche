'use client'
// ============================================
// «فروش هر نفر» — how much each member sold (owner decision, 12 Nov 2026,
// V61 open decision 1). Team hub › team › `?view=sellers`.
//
// ⚠️ The seller is a MEMBER (owner, manager, employee), and the issuer of an
// invoice is its seller unless the invoice named another member. ONE ROW PER
// SELLER AND CURRENCY — amounts are never added across currencies.
// ⚠️ No commission column: nobody has set a commission rate, and a percentage
// the product invented would be a number nobody decided.
// ============================================
import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { asList, useSalesBySeller, useWorkspaceMembers, type SellerTotalRow } from '@hisabche/api'
import { useWorkspaceStore } from '@hisabche/store'

import { DataTable, type TableColumn } from '../data-table'
import { EmptyState } from '../empty-state'
import { SelectField } from '../select-field'
import { useMoneyText } from '../business-packs/pack-shared'
import { QueryState, useTableLabel } from './erp-shared'

export const SELLER_PERIODS = ['thisMonth', 'lastMonth', 'all'] as const
type SellerPeriod = (typeof SELLER_PERIODS)[number]

const pad = (n: number) => String(n).padStart(2, '0')
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** The days of a period, on this device's calendar (the business's day). */
export function sellerPeriodRange(period: SellerPeriod, now: Date): { from?: string; to?: string } {
  if (period === 'all') return {}
  const offset = period === 'lastMonth' ? -1 : 0
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return { from: dayOf(first), to: dayOf(last) }
}

interface MemberRow {
  user_id: string
  full_name: string | null
  email?: string | null
}

export function SellersSection() {
  const t = useTranslations('erpCore.sellers')
  const tr = (key: string): string => t(key as Parameters<typeof t>[0])
  const label = useTableLabel()
  const money = useMoneyText()
  const [period, setPeriod] = useState<SellerPeriod>('thisMonth')
  const range = useMemo(() => sellerPeriodRange(period, new Date()), [period])
  const sales = useSalesBySeller(range)

  const workspaceId = useWorkspaceStore((state) => state.workspaceId)
  const members = useWorkspaceMembers(workspaceId ?? '')
  const names = useMemo(
    () =>
      new Map(
        asList<MemberRow>(members.data, 'workspace-members').map((m) => [
          m.user_id,
          m.full_name || m.email || '',
        ]),
      ),
    [members.data],
  )
  // Someone who left keeps their sales; they read as «former member», not a guess.
  const nameOf = (id: string) => names.get(id) || tr('formerMember')

  const columns: TableColumn<SellerTotalRow>[] = [
    {
      id: 'seller',
      labelKey: 'erpCore.sellers.columns.seller',
      labelFallback: 'فروشنده',
      locked: true,
      render: (row) => nameOf(row.sellerUserId),
    },
    {
      id: 'invoices',
      labelKey: 'erpCore.sellers.columns.invoices',
      labelFallback: 'تعداد فاکتور',
      render: (row) => row.invoiceCount,
      sortValue: (row) => row.invoiceCount,
    },
    {
      id: 'total',
      labelKey: 'erpCore.sellers.columns.total',
      labelFallback: 'جمع فروش',
      render: (row) => money(row.totalMinor, row.currency),
      sortValue: (row) => row.totalMinor,
    },
  ]

  const view = sales.data
  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-[hsl(var(--fg-secondary))]">
        {tr(view && !view.seesAll ? 'introOwn' : 'intro')}
      </p>
      {view && !view.sellerColumn ? (
        <p role="note" className="text-sm text-[hsl(var(--fg-secondary))]">
          {tr('notInstalled')}
        </p>
      ) : null}
      <QueryState
        isLoading={sales.isLoading}
        isError={sales.isError}
        onRetry={() => void sales.refetch()}
        loadingText={tr('loading')}
        errorText={tr('loadFailed')}
        retryText={tr('retry')}
      >
        <DataTable
          tableId="team-sellers"
          t={label}
          rows={view?.totals ?? []}
          columns={columns}
          rowKey={(row) => `${row.sellerUserId}:${row.currency}`}
          actions={
            <SelectField
              name="period"
              aria-label={tr('period')}
              value={period}
              onChange={(value) => setPeriod(value as SellerPeriod)}
              options={SELLER_PERIODS.map((p) => ({ value: p, label: tr(`periods.${p}`) }))}
            />
          }
          emptyState={<EmptyState title={tr('emptyTitle')} description={tr('emptyDescription')} />}
        />
      </QueryState>
      {view && view.unattributed > 0 ? (
        <p className="text-xs text-[hsl(var(--fg-secondary))]">
          {t('unattributed', { count: view.unattributed })}
        </p>
      ) : null}
    </div>
  )
}
