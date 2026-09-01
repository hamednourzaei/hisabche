// ============================================
// backend/src/services/accounting/year-end.domain.ts
//
// A2 · Closing a financial year.
//
// ---------------------------------------------------------------------------
// WHAT CLOSING ACTUALLY IS
//
// Profit and loss accounts describe ONE period. On the first day of the next
// year they must read zero, and the profit they described has to land
// somewhere permanent — retained earnings. Balance sheet accounts do the
// opposite: they carry forward untouched, because a bank account does not
// forget its money on the 1st of Hamal.
//
// So closing is one journal entry that:
//   · debits every revenue account by its balance   (revenue is a credit type)
//   · credits every expense account by its balance  (expense is a debit type)
//   · puts the difference into retained earnings
//
// After it posts, every P&L account nets to zero and the balance sheet still
// balances. That second property is the one worth testing, because an entry
// that zeroes the P&L and quietly unbalances the books looks like success.
//
// ---------------------------------------------------------------------------
// IT IS A NORMAL ENTRY, NOT A SPECIAL MODE
//
// The closing entry goes through `accounting_post_journal_entry` like any
// other. It can be inspected, reversed, and audited by the same tools. A
// "close" that mutated balances directly would be a second way for money to
// move — the exact thing §79 forbids.
// ============================================

import { naturalBalance, type AccountRootType } from './accounting.domain'

export interface AccountBalance {
  accountId: string
  code: string
  type: AccountRootType
  debit: number
  credit: number
}

export interface ClosingLine {
  accountId: string
  debit: number
  credit: number
}

export type ClosingRefusal =
  'NOTHING_TO_CLOSE' | 'NO_RETAINED_EARNINGS_ACCOUNT' | 'ALREADY_UNBALANCED'

export interface ClosingPlan {
  lines: ClosingLine[]
  /** Positive is a profit for the year; negative is a loss. */
  netProfit: number
  /** Rounded to two places, as every other figure in the ledger is. */
  totalDebit: number
  totalCredit: number
}

/**
 * The entry that closes the year.
 *
 * `balances` must already be filtered to the year being closed. This function
 * cannot check that — it sees only numbers — which is why the service reads
 * them through the same date-bounded query the income statement uses, rather
 * than a second one that could drift.
 *
 * ⚠️ Accounts whose balance is exactly zero are SKIPPED. Including them would
 * produce a hundred-line entry that says nothing, and a reader scanning it for
 * the real movements would have to find them.
 */
export function planClosing(
  balances: readonly AccountBalance[],
  retainedEarningsAccountId: string | null,
): { ok: true; plan: ClosingPlan } | { ok: false; reason: ClosingRefusal } {
  if (!retainedEarningsAccountId) return { ok: false, reason: 'NO_RETAINED_EARNINGS_ACCOUNT' }

  const lines: ClosingLine[] = []
  let netProfitMinor = 0

  for (const account of balances) {
    if (account.type !== 'revenue' && account.type !== 'expense') continue

    // Signed so a normal balance is positive: revenue with income in it reads
    // positive, and so does an expense that was spent.
    const balance = naturalBalance(account.type, account.debit, account.credit)
    if (balance === 0) continue

    const minor = Math.round(balance * 100)

    if (account.type === 'revenue') {
      // Revenue is a credit-natured account, so closing it DEBITS it.
      lines.push({ accountId: account.accountId, debit: balance, credit: 0 })
      netProfitMinor += minor
    } else {
      lines.push({ accountId: account.accountId, debit: 0, credit: balance })
      netProfitMinor -= minor
    }
  }

  if (lines.length === 0) return { ok: false, reason: 'NOTHING_TO_CLOSE' }

  const netProfit = netProfitMinor / 100

  // The balancing line. A profit CREDITS retained earnings (equity grows); a
  // loss debits it.
  lines.push(
    netProfit >= 0
      ? { accountId: retainedEarningsAccountId, debit: 0, credit: netProfit }
      : { accountId: retainedEarningsAccountId, debit: Math.abs(netProfit), credit: 0 },
  )

  const totalDebitMinor = lines.reduce((sum, line) => sum + Math.round(line.debit * 100), 0)
  const totalCreditMinor = lines.reduce((sum, line) => sum + Math.round(line.credit * 100), 0)

  // Compared in minor units. Two floats that "look equal" are how an entry
  // one cent out gets posted and the year's books stop balancing.
  if (totalDebitMinor !== totalCreditMinor) return { ok: false, reason: 'ALREADY_UNBALANCED' }

  return {
    ok: true,
    plan: {
      lines,
      netProfit,
      totalDebit: totalDebitMinor / 100,
      totalCredit: totalCreditMinor / 100,
    },
  }
}

/**
 * What each balance sheet account carries into the new year.
 *
 * ⚠️ NOT an entry. Carry-forward is not something you post — the balance is
 * already there, on an account that was never zeroed. Posting an opening entry
 * as well would double every asset in the business.
 *
 * This exists so the new year's opening figures can be SHOWN and reconciled
 * against the closing ones, which is what an accountant actually asks for.
 */
export function carryForward(
  balances: readonly AccountBalance[],
): Array<{ accountId: string; code: string; openingBalance: number }> {
  return balances
    .filter((account) => account.type !== 'revenue' && account.type !== 'expense')
    .map((account) => ({
      accountId: account.accountId,
      code: account.code,
      openingBalance: naturalBalance(account.type, account.debit, account.credit),
    }))
    .filter((row) => row.openingBalance !== 0)
}
