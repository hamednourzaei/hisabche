// ============================================
// A TRIAL BALANCE STATES A SIDE, NOT A SIGN.
//
// The report used to print one «balance» column, signed on the account's
// natural side: a till that had paid out more than it took showed
// «−10,220,000». A bookkeeper cannot read that — is it a credit balance, or a
// negative debit? — and the column could not be totalled to prove anything.
//
// Now every account closes in exactly one of two columns, the two columns
// agree with each other the way the movement columns do, and a balance on the
// side opposite the account's nature is flagged for a person to look at.
//
// The figures are the ones on the owner's own screen (19 Mehr 1405).
// ============================================

import { describe, expect, it } from 'vitest'

import {
  toTrialBalance,
  trialBalanceTotals,
  type LedgerTotals,
} from '../services/accounting/accounting.reports'

const row = (
  code: string,
  name: string,
  type: LedgerTotals['accountType'],
  debit: number,
  credit: number,
): LedgerTotals => ({
  accountId: code,
  accountCode: code,
  accountName: name,
  accountType: type,
  debit,
  credit,
})

const LEDGER: LedgerTotals[] = [
  row('1000', 'موجودی کالا', 'asset', 1_902_000_000, 209_000_000),
  row('1010', 'صندوق', 'asset', 3_269_280_000, 3_279_500_000),
  row('1200', 'حساب‌های دریافتنی', 'asset', 3_566_280_000, 3_269_280_000),
  row('2000', 'حساب‌های پرداختنی', 'liability', 1_902_000_000, 1_902_000_000),
  row('4000', 'فروش', 'revenue', 1_337_490_000, 3_566_280_000),
  row('5000', 'بهای تمام‌شده', 'expense', 209_000_000, 0),
  row('5100', 'خرید', 'expense', 10_000, 0),
  row('6000', 'هزینه حقوق', 'expense', 40_000_000, 0),
]

describe('trial balance: each account closes on one side', () => {
  const rows = toTrialBalance(LEDGER)
  const by = (code: string) => rows.find((r) => r.accountCode === code)!

  it('⚠️ the till in credit is «10,220,000 credit», not «−10,220,000»', () => {
    expect(by('1010')).toMatchObject({
      debitBalance: 0,
      creditBalance: 10_220_000,
      abnormal: true,
    })
  })

  it('a normal asset closes in debit, a normal revenue in credit; neither is flagged', () => {
    expect(by('1000')).toMatchObject({
      debitBalance: 1_693_000_000,
      creditBalance: 0,
      abnormal: false,
    })
    expect(by('4000')).toMatchObject({
      debitBalance: 0,
      creditBalance: 2_228_790_000,
      abnormal: false,
    })
  })

  it('an account that moved and closed at zero sits in neither column', () => {
    expect(by('2000')).toMatchObject({ debitBalance: 0, creditBalance: 0, abnormal: false })
  })

  it('no account is ever on both sides, and no side is negative', () => {
    for (const r of rows) {
      expect(r.debitBalance === 0 || r.creditBalance === 0).toBe(true)
      expect(r.debitBalance).toBeGreaterThanOrEqual(0)
      expect(r.creditBalance).toBeGreaterThanOrEqual(0)
    }
  })

  it('movements agree, and so do the closing balances', () => {
    const totals = trialBalanceTotals(rows)
    expect(totals).toMatchObject({
      totalDebit: 12_226_060_000,
      totalCredit: 12_226_060_000,
      difference: 0,
      totalDebitBalance: 2_239_010_000,
      totalCreditBalance: 2_239_010_000,
      accountsWithBalance: 7,
      abnormalAccounts: 1,
    })
    // Scale, beside the exact figure: the balances are a fraction of the
    // movements, never more than them.
    expect(totals.totalDebitBalance).toBeLessThan(totals.totalDebit)
  })

  it('a ledger that does not balance shows it in both pairs of columns', () => {
    const broken = toTrialBalance([...LEDGER, row('9999', 'گم‌شده', 'asset', 500, 0)])
    const totals = trialBalanceTotals(broken)
    expect(totals.difference).toBe(500)
    expect(totals.totalDebitBalance - totals.totalCreditBalance).toBe(500)
  })
})
