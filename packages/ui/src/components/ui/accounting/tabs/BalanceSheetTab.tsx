// packages/ui/src/components/ui/accounting/tabs/BalanceSheetTab.tsx
'use client'

import { memo, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '../../../../lib/utils'
import { useBalanceSheet, type TrialBalance } from '@hisabche/api'
import { SingleDatePicker } from '../components/DateRangePicker'
import { ExportButton, type ExportColumn } from '../components/ExportButton'
import { AccountingSkeleton } from '../AccountingSkeleton'
import { AccountingEmptyState } from '../AccountingEmptyState'

interface DetailRow {
  section: string
  label: string
  amount: number
}

const exportColumns: ExportColumn<DetailRow>[] = [
  { key: 'section', header: 'بخش', accessor: (r) => r.section },
  { key: 'label', header: 'شرح', accessor: (r) => r.label },
  { key: 'amount', header: 'مبلغ', accessor: (r) => r.amount },
]

function SectionBlock({
  title,
  total,
  details,
  accentClass,
}: {
  title: string
  total: number
  details: TrialBalance[]
  accentClass: string
}) {
  return (
    <div className="rounded-lg md:rounded-xl border border-[hsl(var(--border-default))] overflow-hidden">
      <div
        className={cn('px-3 md:px-4 py-2 md:py-2.5 flex items-center justify-between', accentClass)}
      >
        <span className="text-xs md:text-sm lg:text-base font-semibold">{title}</span>
        <span className="text-xs md:text-sm lg:text-base font-bold">{total.toLocaleString()}</span>
      </div>
      <div className="divide-y divide-[hsl(var(--border-default)/0.5)]">
        {details.length === 0 ? (
          <p className="px-3 md:px-4 py-2.5 md:py-3 text-[11px] md:text-xs text-[hsl(var(--fg-tertiary))]">
            —
          </p>
        ) : (
          details.map((d) => (
            <div
              key={d.accountId}
              className="flex items-center justify-between px-3 md:px-4 py-2 md:py-2.5"
            >
              <span className="text-[11px] md:text-sm text-[hsl(var(--fg-secondary))]">
                {d.accountName}
              </span>
              <span className="text-[11px] md:text-sm font-medium text-[hsl(var(--fg-primary))]">
                {d.balance.toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export const BalanceSheetTab = memo(function BalanceSheetTab() {
  const t = useTranslations()
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const { data, isLoading } = useBalanceSheet(date)

  const exportData = useMemo<DetailRow[]>(() => {
    if (!data) return []
    const rows: DetailRow[] = []
    for (const d of data.assets)
      rows.push({ section: 'دارایی', label: d.accountName, amount: d.balance })
    for (const d of data.liabilities)
      rows.push({ section: 'بدهی', label: d.accountName, amount: d.balance })
    for (const d of data.equity)
      rows.push({ section: 'حقوق صاحبان سهام', label: d.accountName, amount: d.balance })
    rows.push({
      section: 'حقوق صاحبان سهام',
      label: 'سود (زیان) دوره',
      amount: data.currentYearEarnings,
    })
    return rows
  }, [data])

  // The server reports the gap; the screen does not recompute it. A sheet that
  // adds up its own visible rows always balances, even when rows are missing.
  const isBalanced = data ? data.outOfBalanceBy === 0 : false

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 md:gap-3 px-3 md:px-4 lg:px-5 py-2.5 md:py-3 lg:py-4 border-b border-[hsl(var(--border-default))]">
        <h2 className="text-xs md:text-sm lg:text-base font-semibold text-[hsl(var(--fg-primary))]">
          {t('accounting.balanceSheet.title')}
        </h2>
        <div className="flex items-center gap-2 md:gap-3">
          <SingleDatePicker
            value={date}
            onChange={setDate}
            label={t('accounting.balanceSheet.asOf')}
          />
          <ExportButton
            data={exportData}
            columns={exportColumns}
            filename="balance-sheet"
            className="mb-0"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-5">
        {isLoading ? (
          <AccountingSkeleton />
        ) : !data ? (
          <AccountingEmptyState title={t('accounting.balanceSheet.empty.title')} />
        ) : (
          <div className="space-y-3 md:space-y-4 lg:space-y-5">
            <SectionBlock
              title={t('accounting.balanceSheet.assets')}
              total={data.totalAssets}
              details={data.assets}
              accentClass="bg-blue-500/10 text-blue-500"
            />
            <SectionBlock
              title={t('accounting.balanceSheet.liabilities')}
              total={data.totalLiabilities}
              details={data.liabilities}
              accentClass="bg-rose-500/10 text-rose-500"
            />
            <SectionBlock
              title={t('accounting.balanceSheet.equity')}
              total={data.totalEquity}
              details={data.equity}
              accentClass="bg-purple-500/10 text-purple-500"
            />

            <div
              className={cn(
                'flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-semibold',
                isBalanced
                  ? 'bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]'
                  : 'bg-[hsl(var(--color-warning)/0.1)] text-[hsl(var(--color-warning))]',
              )}
            >
              <span>
                {isBalanced
                  ? t('accounting.balanceSheet.balanced')
                  : t('accounting.balanceSheet.unbalanced')}
              </span>
              <span>
                {data.totalAssets.toLocaleString()} ={' '}
                {(data.totalLiabilities + data.totalEquity).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
