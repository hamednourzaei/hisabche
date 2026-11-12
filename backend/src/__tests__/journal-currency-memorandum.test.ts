import { describe, expect, it } from 'vitest'
import {
  toTrialBalance,
  toIncomeStatement,
  toBalanceSheet,
  validateJournalCurrencyAndMemorandum,
} from '@hisabche/validation'

describe('B.2.1 & B.2.2 Multi-currency journal lines + Memorandum accounts', () => {
  it('accepts consistent FX line and rejects inconsistent exchange rate', () => {
    const ok = validateJournalCurrencyAndMemorandum(
      [
        {
          accountId: 'a1',
          debit: 7000,
          credit: 0,
          currency: 'USD',
          amountCurrencyMinor: 10000,
          exchangeRate: 70,
        },
        {
          accountId: 'a2',
          debit: 0,
          credit: 7000,
          currency: 'USD',
          amountCurrencyMinor: 10000,
          exchangeRate: 70,
        },
      ],
      new Map([
        ['a1', { id: 'a1', type: 'asset', isGroup: false, isActive: true, kind: 'standard' }],
        ['a2', { id: 'a2', type: 'revenue', isGroup: false, isActive: true, kind: 'standard' }],
      ]),
    )
    expect(ok.ok).toBe(true)

    const bad = validateJournalCurrencyAndMemorandum(
      [
        {
          accountId: 'a1',
          debit: 7000,
          credit: 0,
          currency: 'USD',
          amountCurrencyMinor: 10000,
          exchangeRate: 50,
        },
        { accountId: 'a2', debit: 0, credit: 7000 },
      ],
      new Map([
        ['a1', { id: 'a1', type: 'asset', isGroup: false, isActive: true, kind: 'standard' }],
        ['a2', { id: 'a2', type: 'revenue', isGroup: false, isActive: true, kind: 'standard' }],
      ]),
    )
    expect(bad).toEqual({ ok: false, code: 'JOURNAL_LINE_FX_MISMATCH' })
  })

  it('refuses mixing memorandum and standard accounts', () => {
    const res = validateJournalCurrencyAndMemorandum(
      [
        { accountId: 'm1', debit: 500, credit: 0 },
        { accountId: 'a1', debit: 0, credit: 500 },
      ],
      new Map([
        ['m1', { id: 'm1', type: 'asset', isGroup: false, isActive: true, kind: 'memorandum' }],
        ['a1', { id: 'a1', type: 'asset', isGroup: false, isActive: true, kind: 'standard' }],
      ]),
    )
    expect(res).toEqual({ ok: false, code: 'JOURNAL_MEMORANDUM_MIXED_FORBIDDEN' })
  })

  it('excludes memorandum accounts from trial balance, income statement, and balance sheet', () => {
    const totals = [
      {
        accountId: 'a1',
        accountCode: '1010',
        accountName: 'Cash',
        accountType: 'asset' as const,
        kind: 'standard' as const,
        debit: 1000,
        credit: 0,
      },
      {
        accountId: 'a2',
        accountCode: '4010',
        accountName: 'Sales',
        accountType: 'revenue' as const,
        kind: 'standard' as const,
        debit: 0,
        credit: 1000,
      },
      {
        accountId: 'm1',
        accountCode: '9010',
        accountName: 'Guarantee',
        accountType: 'asset' as const,
        kind: 'memorandum' as const,
        debit: 50000,
        credit: 0,
      },
      {
        accountId: 'm2',
        accountCode: '9020',
        accountName: 'Guarantee Offset',
        accountType: 'liability' as const,
        kind: 'memorandum' as const,
        debit: 0,
        credit: 50000,
      },
    ]
    const tb = toTrialBalance(totals)
    expect(tb.map((r) => r.accountId)).toEqual(['a1', 'a2'])

    const pnl = toIncomeStatement(totals, '2026-01-01', '2026-12-31')
    expect(pnl.totalRevenue).toBe(1000)

    const bs = toBalanceSheet(totals, '2026-12-31')
    expect(bs.totalAssets).toBe(1000)
    expect(bs.totalLiabilities).toBe(0)
  })
})
