// packages/ui/src/components/ui/accounting/tabs/TrialBalanceTab.tsx
'use client'

import { memo, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useTrialBalance } from '@hisabche/api'
import { SingleDatePicker } from '../components/DateRangePicker'
import { ExportButton, type ExportColumn } from '../components/ExportButton'
import { AccountingSkeleton } from '../AccountingSkeleton'
import { AccountingEmptyState } from '../AccountingEmptyState'
import type { TrialBalance } from '@hisabche/api'

const exportColumns: ExportColumn<TrialBalance>[] = [
  { key: 'accountCode', header: 'کد حساب', accessor: (r) => r.accountCode },
  { key: 'accountName', header: 'نام حساب', accessor: (r) => r.accountName },
  { key: 'debit', header: 'بدهکار', accessor: (r) => r.debit },
  { key: 'credit', header: 'بستانکار', accessor: (r) => r.credit },
  { key: 'balance', header: 'مانده', accessor: (r) => r.balance },
]

export const TrialBalanceTab = memo(function TrialBalanceTab() {
  const t = useTranslations()
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const { data, isLoading } = useTrialBalance(date)

  // The totals come from the server, which summed them in the same query that
  // produced the rows. Re-adding the visible rows here would agree with itself
  // even when rows were missing, which is the failure this report exists to
  // catch.
  const rows = useMemo(() => data?.rows ?? [], [data])
  const totals = {
    debit: data?.totalDebit ?? 0,
    credit: data?.totalCredit ?? 0,
    difference: data?.difference ?? 0,
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 md:gap-3 px-3 md:px-4 lg:px-5 py-2.5 md:py-3 lg:py-4 border-b border-[hsl(var(--border-default))]">
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <h2 className="text-xs md:text-sm lg:text-base font-semibold text-[hsl(var(--fg-primary))]">
            {t('accounting.trialBalance.title')}
          </h2>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <SingleDatePicker
            value={date}
            onChange={setDate}
            label={t('accounting.trialBalance.asOf')}
          />
          <ExportButton
            data={rows}
            columns={exportColumns}
            filename="trial-balance"
            className="mb-0"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <AccountingSkeleton />
        ) : rows.length === 0 ? (
          <AccountingEmptyState title={t('accounting.trialBalance.empty.title')} />
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-[hsl(var(--surface-elevated))] z-10">
              <tr className="border-b border-[hsl(var(--border-default))] text-[9px] md:text-[10px] lg:text-xs text-[hsl(var(--fg-tertiary))]">
                <th className="px-2 md:px-3 lg:px-4 py-2 text-start font-medium">
                  {t('accounting.accounts.code')}
                </th>
                <th className="px-2 md:px-3 lg:px-4 py-2 text-start font-medium">
                  {t('accounting.accounts.name')}
                </th>
                <th className="px-2 md:px-3 lg:px-4 py-2 text-end font-medium">
                  {t('accounting.journal.debit')}
                </th>
                <th className="px-2 md:px-3 lg:px-4 py-2 text-end font-medium">
                  {t('accounting.journal.credit')}
                </th>
                <th className="px-2 md:px-3 lg:px-4 py-2 text-end font-medium">
                  {t('accounting.trialBalance.balance')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.accountId}
                  className="border-b border-[hsl(var(--border-default)/0.5)] last:border-0 hover:bg-[hsl(var(--surface-muted))] transition-colors"
                >
                  <td className="px-2 md:px-3 lg:px-4 py-2 md:py-2.5 text-[11px] md:text-sm text-[hsl(var(--fg-tertiary))] font-mono">
                    {row.accountCode}
                  </td>
                  <td className="px-2 md:px-3 lg:px-4 py-2 md:py-2.5 text-[11px] md:text-sm font-medium text-[hsl(var(--fg-primary))]">
                    {row.accountName}
                  </td>
                  <td className="px-2 md:px-3 lg:px-4 py-2 md:py-2.5 text-[11px] md:text-sm text-end text-[hsl(var(--fg-primary))]">
                    {row.debit > 0 ? row.debit.toLocaleString() : '—'}
                  </td>
                  <td className="px-2 md:px-3 lg:px-4 py-2 md:py-2.5 text-[11px] md:text-sm text-end text-[hsl(var(--fg-primary))]">
                    {row.credit > 0 ? row.credit.toLocaleString() : '—'}
                  </td>
                  <td className="px-2 md:px-3 lg:px-4 py-2 md:py-2.5 text-[11px] md:text-sm text-end font-semibold text-[hsl(var(--fg-primary))]">
                    {row.balance.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[hsl(var(--border-default))] font-semibold text-[11px] md:text-sm">
                <td className="px-2 md:px-3 lg:px-4 py-2 md:py-2.5" colSpan={2}>
                  {t('accounting.trialBalance.total')}
                </td>
                <td className="px-2 md:px-3 lg:px-4 py-2 md:py-2.5 text-end">
                  {totals.debit.toLocaleString()}
                </td>
                <td className="px-2 md:px-3 lg:px-4 py-2 md:py-2.5 text-end">
                  {totals.credit.toLocaleString()}
                </td>
                <td className="px-2 md:px-3 lg:px-4 py-2 md:py-2.5 text-end">
                  {totals.difference !== 0 ? totals.difference.toLocaleString() : ''}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
})
