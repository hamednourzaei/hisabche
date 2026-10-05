// packages/ui/src/components/ui/accounting/tabs/TrialBalanceTab.tsx
'use client'

import { memo, useCallback, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { toIsoDay } from '@hisabche/formatting'
import { useTrialBalance } from '@hisabche/api'
import { DateRangePicker } from '../components/DateRangePicker'
import { ExportButton, type ExportColumn } from '../components/ExportButton'
import { AccountingSkeleton } from '../AccountingSkeleton'
import { AccountingEmptyState } from '../AccountingEmptyState'
import {
  LedgerDifference,
  LedgerFoot,
  LedgerHead,
  LedgerRow,
  LedgerTable,
  LedgerTd,
  LedgerTh,
  useLedgerNumber,
} from '../components/ledger-table'
import { useAccountDrilldown } from '../components/use-account-drilldown'
import { BranchSwitcher, useBranchScope } from '../../branch/branch-scope'
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
  const n = useLedgerNumber()
  const [date, setDate] = useState(() => toIsoDay(new Date()))
  // Empty = from the first entry in the books, which is what the report has
  // always meant. A start date narrows it to that period's movements.
  const [fromDate, setFromDate] = useState('')
  const { branchId } = useBranchScope()
  const { data, isLoading } = useTrialBalance(date, branchId, fromDate)

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key as never)
      return v && v !== key ? v : (fallback ?? key)
    },
    [t],
  )

  // H3 — the drill-down opens the SAME window the figures were built from:
  // the chosen start (or none), up to the chosen end. A different window here
  // would show lines that do not add up to the row that was pressed.
  const drilldown = useAccountDrilldown(fromDate, date, safeT)

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
    <div className="flex h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-[hsl(var(--border-default))] px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
            {t('accounting.trialBalance.title')}
          </h2>
          {/*
            The difference, in the header rather than only in the last row of a
            table someone has to scroll to. It is the answer to the question the
            report is opened to ask.
          */}
          {!isLoading && rows.length > 0 && (
            <div className="mt-1.5">
              <LedgerDifference
                value={totals.difference}
                balancedLabel={t('accounting.trialBalance.balanced')}
                outOfBalanceLabel={t('accounting.trialBalance.outOfBalance')}
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <BranchSwitcher t={safeT} />
          <DateRangePicker
            from={fromDate}
            to={date}
            onFromChange={setFromDate}
            onToChange={setDate}
          />
          <ExportButton
            data={rows}
            columns={exportColumns}
            filename="trial-balance"
            className="mb-0"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <AccountingSkeleton />
        ) : rows.length === 0 ? (
          <AccountingEmptyState title={t('accounting.trialBalance.empty.title')} />
        ) : (
          <LedgerTable caption={t('accounting.trialBalance.title')}>
            <LedgerHead>
              <LedgerTh>{t('accounting.accounts.code')}</LedgerTh>
              <LedgerTh>{t('accounting.accounts.name')}</LedgerTh>
              <LedgerTh numeric>{t('accounting.journal.debit')}</LedgerTh>
              <LedgerTh numeric>{t('accounting.journal.credit')}</LedgerTh>
              <LedgerTh numeric>{t('accounting.trialBalance.balance')}</LedgerTh>
            </LedgerHead>

            <tbody>
              {rows.map((row) => (
                <LedgerRow key={row.accountId}>
                  <LedgerTd mono muted>
                    {row.accountCode}
                  </LedgerTd>
                  {/* H3 — the account name opens the lines behind it, for the
                      SAME date this report is stated as at. Every figure here
                      used to be a dead end. */}
                  <LedgerTd strong>
                    <button
                      type="button"
                      onClick={() =>
                        drilldown.open({
                          id: row.accountId,
                          code: row.accountCode,
                          name: row.accountName,
                        })
                      }
                      className="rounded text-start text-[hsl(var(--color-primary))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
                    >
                      {row.accountName}
                    </button>
                  </LedgerTd>
                  <LedgerTd numeric>{n(row.debit)}</LedgerTd>
                  <LedgerTd numeric>{n(row.credit)}</LedgerTd>
                  <LedgerTd numeric strong>
                    {n(row.balance)}
                  </LedgerTd>
                </LedgerRow>
              ))}
            </tbody>

            <LedgerFoot>
              <LedgerTd strong colSpan={2}>
                {t('accounting.trialBalance.total')}
              </LedgerTd>
              {/*
                `'zero'`, not the default dash: in a TOTAL row a zero is a real
                figure and an em dash would read as "not computed".
              */}
              <LedgerTd numeric strong>
                {n(totals.debit, 'zero')}
              </LedgerTd>
              <LedgerTd numeric strong>
                {n(totals.credit, 'zero')}
              </LedgerTd>
              <LedgerTd numeric strong>
                {n(totals.difference, 'zero')}
              </LedgerTd>
            </LedgerFoot>
          </LedgerTable>
        )}
      </div>

      {drilldown.drawer}
    </div>
  )
})
