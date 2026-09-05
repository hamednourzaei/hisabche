// packages/ui/src/components/ui/accounting/tabs/TrialBalanceTab.tsx
'use client'

import { memo, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useTrialBalance } from '@hisabche/api'
import { SingleDatePicker } from '../components/DateRangePicker'
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

        <div className="flex items-center gap-3">
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
                  <LedgerTd strong>{row.accountName}</LedgerTd>
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
    </div>
  )
})
