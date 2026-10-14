// packages/ui/src/components/ui/accounting/tabs/TrialBalanceTab.tsx
'use client'

import { memo, useCallback, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { toIsoDay } from '@hisabche/formatting'
import { asList, useTrialBalance } from '@hisabche/api'
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
import { SegmentedControl } from '../../segmented-control'
import { useDateFormat } from '../../../../hooks/use-date-format'
import type { TrialBalance } from '@hisabche/api'
import { useAccountName } from '../../../../hooks/use-account-name'

type Shown = 'withBalance' | 'all'

export const TrialBalanceTab = memo(function TrialBalanceTab() {
  const t = useTranslations()
  const n = useLedgerNumber()
  const shownName = useAccountName()
  const format = useDateFormat()
  const [date, setDate] = useState(() => toIsoDay(new Date()))
  // Empty = from the first entry in the books, which is what the report has
  // always meant. A start date narrows it to that period's movements.
  const [fromDate, setFromDate] = useState('')
  // Accounts that moved and closed at zero are noise on a first read; they are
  // one click away, never dropped from the totals.
  const [shown, setShown] = useState<Shown>('withBalance')
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
  const rows = useMemo(() => asList<TrialBalance>(data?.rows), [data])
  const visible = useMemo(
    () =>
      shown === 'all'
        ? rows
        : rows.filter((row) => row.debitBalance !== 0 || row.creditBalance !== 0),
    [rows, shown],
  )
  const totals = {
    debit: data?.totalDebit ?? 0,
    credit: data?.totalCredit ?? 0,
    difference: data?.difference ?? 0,
    debitBalance: data?.totalDebitBalance ?? 0,
    creditBalance: data?.totalCreditBalance ?? 0,
  }

  const exportColumns = useMemo<ExportColumn<TrialBalance>[]>(
    () => [
      { key: 'accountCode', header: t('accounting.accounts.code'), accessor: (r) => r.accountCode },
      { key: 'accountName', header: t('accounting.accounts.name'), accessor: (r) => r.accountName },
      {
        key: 'group',
        header: t('accounting.trialBalance.group'),
        accessor: (r) => t(`accounting.accountTypes.${r.accountType}`),
      },
      {
        key: 'debit',
        header: t('accounting.trialBalance.turnoverDebit'),
        accessor: (r) => r.debit,
      },
      {
        key: 'credit',
        header: t('accounting.trialBalance.turnoverCredit'),
        accessor: (r) => r.credit,
      },
      {
        key: 'debitBalance',
        header: t('accounting.trialBalance.debitBalance'),
        accessor: (r) => r.debitBalance,
      },
      {
        key: 'creditBalance',
        header: t('accounting.trialBalance.creditBalance'),
        accessor: (r) => r.creditBalance,
      },
    ],
    [t],
  )

  const unposted = data?.books?.unpostedInvoices
  const lastPostedAt = data?.books?.lastPostedAt ?? null

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-[hsl(var(--border-default))] px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
            {t('accounting.trialBalance.title')}{' '}
            <span className="font-normal text-[hsl(var(--fg-secondary))]">
              {t('accounting.trialBalance.asOfDate', { date: format.date(date) })}
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-[hsl(var(--fg-secondary))]">
            {t('accounting.trialBalance.kind')}
          </p>
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
            data={visible}
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
          <>
            {/*
              What the books say, before the table: how many accounts, both
              totals, the difference, and the currency every figure is in.
            */}
            <section
              aria-label={t('accounting.trialBalance.title')}
              className="flex flex-col gap-2 border-b border-[hsl(var(--border-default))] px-5 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <LedgerDifference
                  value={totals.difference}
                  balancedLabel={t('accounting.trialBalance.ledgerBalanced')}
                  outOfBalanceLabel={t('accounting.trialBalance.outOfBalance')}
                />
                <span className="text-[hsl(var(--fg-secondary))]">
                  {t('accounting.trialBalance.accounts', { count: data?.accountsWithBalance ?? 0 })}
                </span>
                <span className="text-[hsl(var(--fg-secondary))]">
                  {t('accounting.trialBalance.totalDebit')}:{' '}
                  <span className="font-medium tabular-nums text-[hsl(var(--fg-primary))]">
                    {n(totals.debit, 'zero')}
                  </span>
                </span>
                <span className="text-[hsl(var(--fg-secondary))]">
                  {t('accounting.trialBalance.totalCredit')}:{' '}
                  <span className="font-medium tabular-nums text-[hsl(var(--fg-primary))]">
                    {n(totals.credit, 'zero')}
                  </span>
                </span>
                <span className="text-[hsl(var(--fg-secondary))]">
                  {t('accounting.trialBalance.difference')}:{' '}
                  <span className="font-medium tabular-nums text-[hsl(var(--fg-primary))]">
                    {n(totals.difference, 'zero')}
                  </span>
                </span>
                {data?.currency ? (
                  <span
                    className="font-medium text-[hsl(var(--fg-primary))]"
                    title={t('accounting.trialBalance.currencyNote')}
                  >
                    {t('accounting.trialBalance.currency', { currency: data.currency })}
                  </span>
                ) : null}
              </div>

              {/* The state of the books this report was built from. */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                {unposted === null || unposted === undefined ? (
                  <span className="text-[hsl(var(--color-warning))]">
                    {t('accounting.trialBalance.unpostedUnknown')}
                  </span>
                ) : unposted > 0 ? (
                  <span role="status" className="font-medium text-[hsl(var(--color-warning))]">
                    {t('accounting.trialBalance.unposted', { count: unposted })}
                  </span>
                ) : (
                  <span className="text-[hsl(var(--color-success))]">
                    {t('accounting.trialBalance.allPosted')}
                  </span>
                )}
                {lastPostedAt ? (
                  <span className="text-[hsl(var(--fg-secondary))]">
                    {t('accounting.trialBalance.lastEntry', {
                      date: format.dateTime(lastPostedAt),
                    })}
                  </span>
                ) : null}
                {(data?.abnormalAccounts ?? 0) > 0 ? (
                  <span className="text-[hsl(var(--color-warning))]">
                    {t('accounting.trialBalance.abnormalCount', {
                      count: data?.abnormalAccounts ?? 0,
                    })}
                  </span>
                ) : null}
              </div>

              <p className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('accounting.trialBalance.proofNote')}
              </p>

              <SegmentedControl<Shown>
                label={t('accounting.trialBalance.show')}
                value={shown}
                onChange={setShown}
                options={[
                  { value: 'withBalance', label: t('accounting.trialBalance.withBalance') },
                  { value: 'all', label: t('accounting.trialBalance.allAccounts') },
                ]}
                className="self-start"
              />
            </section>

            <LedgerTable caption={t('accounting.trialBalance.title')}>
              <LedgerHead>
                <LedgerTh>{t('accounting.accounts.code')}</LedgerTh>
                <LedgerTh>{t('accounting.accounts.name')}</LedgerTh>
                <LedgerTh>{t('accounting.trialBalance.group')}</LedgerTh>
                <LedgerTh numeric>{t('accounting.trialBalance.turnoverDebit')}</LedgerTh>
                <LedgerTh numeric>{t('accounting.trialBalance.turnoverCredit')}</LedgerTh>
                <LedgerTh numeric>{t('accounting.trialBalance.debitBalance')}</LedgerTh>
                <LedgerTh numeric>{t('accounting.trialBalance.creditBalance')}</LedgerTh>
              </LedgerHead>

              <tbody>
                {visible.length === 0 ? (
                  <LedgerRow>
                    <LedgerTd colSpan={7} muted>
                      {t('accounting.trialBalance.noneWithBalance')}
                    </LedgerTd>
                  </LedgerRow>
                ) : null}
                {visible.map((row) => {
                  const openAccount = () =>
                    drilldown.open({
                      id: row.accountId,
                      code: row.accountCode,
                      name: row.accountName,
                    })
                  const link =
                    'rounded text-start text-[hsl(var(--color-primary))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]'
                  return (
                    <LedgerRow key={row.accountId}>
                      {/* H3 — the code and the name both open the lines behind
                          the figures, for the SAME window this report covers. */}
                      <LedgerTd mono muted>
                        <button type="button" onClick={openAccount} className={link}>
                          {row.accountCode}
                        </button>
                      </LedgerTd>
                      <LedgerTd strong>
                        <button type="button" onClick={openAccount} className={link}>
                          {shownName(row.accountName)}
                        </button>
                        {row.abnormal ? (
                          <span
                            title={t('accounting.trialBalance.abnormalHint')}
                            className="ms-2 inline-flex rounded-md bg-[hsl(var(--color-warning)/0.14)] px-1.5 py-0.5 text-xs font-medium text-[hsl(var(--color-warning))]"
                          >
                            {t('accounting.trialBalance.abnormal')}
                          </span>
                        ) : null}
                      </LedgerTd>
                      <LedgerTd muted>{t(`accounting.accountTypes.${row.accountType}`)}</LedgerTd>
                      <LedgerTd numeric>{n(row.debit)}</LedgerTd>
                      <LedgerTd numeric>{n(row.credit)}</LedgerTd>
                      {/* A side, never a sign: the balance sits in exactly one
                          of these two columns. */}
                      <LedgerTd numeric strong>
                        {n(row.debitBalance)}
                      </LedgerTd>
                      <LedgerTd numeric strong>
                        {n(row.creditBalance)}
                      </LedgerTd>
                    </LedgerRow>
                  )
                })}
              </tbody>

              <LedgerFoot>
                <LedgerTd strong colSpan={3}>
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
                  {n(totals.debitBalance, 'zero')}
                </LedgerTd>
                <LedgerTd numeric strong>
                  {n(totals.creditBalance, 'zero')}
                </LedgerTd>
              </LedgerFoot>
            </LedgerTable>
          </>
        )}
      </div>

      {drilldown.drawer}
    </div>
  )
})
