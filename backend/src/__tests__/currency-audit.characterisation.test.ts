// ============================================
// Currency audit (11 Oct 2026).
//
// DEFECT-CUR-01 (a party's balance added amounts of different currencies) is
// FIXED and is specified here: balances are per currency, and no figure is a
// sum across them.
//
// DEFECT-CUR-02 (the ledger books a foreign invoice at an implicit rate of 1)
// is NOT fixed. Its block below is a CHARACTERISATION — it pins what the code
// does today so the finding is a fact that runs. A green run there means
// «still unfixed», not «correct»; it is to be rewritten with the fix.
//
// See .claude/reverse-and-import/01-CURRENCY-AUDIT.md.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  partyBalancesByCurrency,
  runningLedger,
  summarizeParty,
  summarizePartyByCurrency,
  type LedgerMovement,
} from '../services/payments/payments.domain'

const source = (path: string) =>
  readFileSync(join(__dirname, '..', path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')

const move = (
  kind: LedgerMovement['kind'],
  amount: number,
  currency?: string,
  date = '2026-10-01',
): LedgerMovement => ({ date, reference: '', kind, amount, ...(currency ? { currency } : {}) })

describe('a party’s balance is per currency', () => {
  it('⚠️ 100 USD + 10,000 AFN is two balances — never 10,100', () => {
    const balances = partyBalancesByCurrency(
      [move('sale', 100, 'USD'), move('sale', 10_000, 'AFN')],
      'AFN',
    )
    expect(balances).toEqual([
      { currency: 'AFN', balance: 10_000 },
      { currency: 'USD', balance: 100 },
    ])
    // No figure anywhere in the answer is the sum of the two.
    expect(balances.map((entry) => entry.balance)).not.toContain(10_100)
  })

  it('a movement that names no currency, and the opening balance, are in the books currency', () => {
    expect(
      partyBalancesByCurrency([move('sale', 500), move('payment_in', 40, 'USD')], 'IRT', 1_000),
    ).toEqual([
      { currency: 'IRT', balance: 1_500 },
      // A dollar payment against nothing in dollars: they are 40 dollars ahead.
      { currency: 'USD', balance: -40 },
    ])
  })

  it('the books currency is always first and always present, even at zero', () => {
    expect(partyBalancesByCurrency([move('sale', 7, 'EUR')], 'AFN')).toEqual([
      { currency: 'AFN', balance: 0 },
      { currency: 'EUR', balance: 7 },
    ])
  })

  it('a payment in one currency does not move the running balance of another', () => {
    const rows = runningLedger([
      move('sale', 10_000, 'AFN', '2026-10-01'),
      move('sale', 100, 'USD', '2026-10-02'),
      move('payment_in', 40, 'USD', '2026-10-03'),
      move('payment_in', 2_500, 'AFN', '2026-10-04'),
    ])
    expect(rows.map((row) => [row.currency, row.balance])).toEqual([
      ['AFN', 10_000],
      ['USD', 100],
      ['USD', 60],
      ['AFN', 7_500],
    ])
  })

  it('the summary, per currency: each row adds only its own documents', () => {
    const invoices = [
      {
        id: 'a',
        type: 'sale' as const,
        status: 'pending',
        total: 10_000,
        paidAmount: 2_500,
        invoiceDate: '2026-09-01',
        dueDate: '2026-09-15',
        currency: 'AFN',
      },
      {
        id: 'b',
        type: 'sale' as const,
        status: 'pending',
        total: 100,
        paidAmount: 40,
        invoiceDate: '2026-09-01',
        dueDate: '2026-09-15',
        currency: 'USD',
      },
    ]
    const payments = [
      { direction: 'in' as const, amount: 2_500, entryDate: '2026-09-05', currency: 'AFN' },
      { direction: 'in' as const, amount: 40, entryDate: '2026-09-06', currency: 'USD' },
    ]

    const rows = summarizePartyByCurrency(invoices, payments, '2026-10-01', 300, 'AFN')
    expect(
      rows.map((row) => [row.currency, row.totalSales, row.receivable, row.totalReceived]),
    ).toEqual([
      // 7,500 open + the 300 opening balance, which is in the books currency.
      ['AFN', 10_000, 7_800, 2_500],
      ['USD', 100, 60, 40],
    ])

    // The legacy single summary still mixes them — and says so by name.
    const mixed = summarizeParty(invoices, payments, '2026-10-01', 300)
    expect(mixed.currencies).toEqual(['AFN', 'USD'])
    expect(mixed.totalSales).toBe(10_100)
  })

  it('the service reads the currency of every transaction it adds', () => {
    const service = source('services/customer.service.ts')
    const read = service.slice(service.indexOf('async getBalance('))
    expect(read).toContain(".select('type, amount, currency')")
    expect(read).toContain('partyBalancesByCurrency(')
    expect(source('routes/transaction.routes.ts')).toContain('partyBalancesByCurrency(')
  })
})

describe('CHARACTERISATION · DEFECT-CUR-02 — the ledger books a foreign invoice at an implicit rate of 1', () => {
  it('the invoice posting takes the invoice total as it is, with no rate and no currency', () => {
    const service = source('services/invoice.service.ts')
    const at = service.indexOf('const total = Number(data.total) || 0')
    expect(at).toBeGreaterThan(0)
    const posting = service.slice(at, at + 2500)
    expect(posting).toContain('{ accountId: accounts.receivable!, debit: total, credit: 0 }')
    expect(posting).not.toMatch(/rate|currency/i)
  })

  it('revaluation states the booked rate of every foreign invoice as 1', () => {
    expect(source('services/currency/currency.service.ts')).toContain('bookedRate: 1,')
  })
})
