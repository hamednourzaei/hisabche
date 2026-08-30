// ============================================
// backend/src/services/accounting/accounting.reports.ts
//
// The statements, as pure functions over aggregated ledger rows. Nothing here
// queries; the repository sums in Postgres and hands the totals over. That
// split is what makes it possible to test "does the balance sheet balance"
// without a database.
// ============================================

import type { BalanceSheet, IncomeStatement, TrialBalanceRow } from '@hisabche/validation'

import {
  isBalanceSheetType,
  naturalBalance,
  round2,
  type AccountRootType,
} from './accounting.domain'

/** One account's movement over a window, as the database summed it. */
export interface LedgerTotals {
  accountId: string
  accountCode: string
  accountName: string
  accountType: AccountRootType
  debit: number
  credit: number
}

export function toTrialBalance(rows: LedgerTotals[]): TrialBalanceRow[] {
  return rows
    .map((row) => ({
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      accountType: row.accountType,
      debit: round2(row.debit),
      credit: round2(row.credit),
      balance: naturalBalance(row.accountType, row.debit, row.credit),
    }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
}

/**
 * The one number that says whether the ledger is intact. Every posting writes
 * equal debits and credits, so across all accounts these must be identical;
 * a difference means rows were written or lost outside the posting path.
 */
export function trialBalanceTotals(rows: TrialBalanceRow[]): {
  totalDebit: number
  totalCredit: number
  difference: number
} {
  const totalDebit = round2(rows.reduce((sum, r) => sum + r.debit, 0))
  const totalCredit = round2(rows.reduce((sum, r) => sum + r.credit, 0))
  return { totalDebit, totalCredit, difference: round2(totalDebit - totalCredit) }
}

/**
 * The balance sheet as of a date, from movement since the books opened.
 *
 * Two things the previous implementation got wrong are load-bearing here:
 *
 *   Every account with movement appears, whatever the sign of its balance. The
 *   old version kept only rows whose balance was positive, so an overdrawn
 *   bank account or a customer in credit silently vanished and the two sides
 *   stopped agreeing — with nothing on screen to say so.
 *
 *   Revenue and expense are NOT balance sheet lines. Their net is one equity
 *   figure, the way Odoo carries current year earnings into equity. The old
 *   version listed revenue and expenses as sections of the balance sheet,
 *   which is a profit and loss statement wearing the wrong title.
 *
 * `outOfBalanceBy` is returned rather than hidden. A non-zero value is damage,
 * and a report that quietly rounds it away is worse than one that shows it.
 */
export function toBalanceSheet(rows: LedgerTotals[], asOf: string): BalanceSheet {
  const trial = toTrialBalance(rows)

  const section = (type: AccountRootType) => trial.filter((r) => r.accountType === type)
  const total = (list: TrialBalanceRow[]) => round2(list.reduce((sum, r) => sum + r.balance, 0))

  const assets = section('asset')
  const liabilities = section('liability')
  const equity = section('equity')

  const totalRevenue = total(section('revenue'))
  const totalExpenses = total(section('expense'))

  // Until a fiscal year end is configurable, everything the business has ever
  // earned and not closed out sits in this one figure. That keeps the sheet
  // balanced and keeps the number honest about what it is.
  const currentYearEarnings = round2(totalRevenue - totalExpenses)

  const totalAssets = total(assets)
  const totalLiabilities = total(liabilities)
  const totalEquity = round2(total(equity) + currentYearEarnings)

  return {
    asOf,
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    currentYearEarnings,
    outOfBalanceBy: round2(totalAssets - (totalLiabilities + totalEquity)),
  }
}

/** Performance over a window. Only P&L accounts; the window is by entry date. */
export function toIncomeStatement(
  rows: LedgerTotals[],
  fromDate: string,
  toDate: string,
): IncomeStatement {
  const trial = toTrialBalance(rows).filter((r) => !isBalanceSheetType(r.accountType))

  const revenue = trial.filter((r) => r.accountType === 'revenue')
  const expenses = trial.filter((r) => r.accountType === 'expense')

  const totalRevenue = round2(revenue.reduce((sum, r) => sum + r.balance, 0))
  const totalExpenses = round2(expenses.reduce((sum, r) => sum + r.balance, 0))

  return {
    fromDate,
    toDate,
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    netIncome: round2(totalRevenue - totalExpenses),
  }
}
