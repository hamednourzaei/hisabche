import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import {
  emptyPaymentValue,
  paidAmountOf,
  paymentEntriesOf,
  type InvoicePaymentValue,
} from '@hisabche/validation'

const v = (patch: Partial<InvoicePaymentValue>): InvoicePaymentValue => ({
  ...emptyPaymentValue(),
  ...patch,
})
const row = (id: string, method: any, amount: string, note?: string) => ({
  id,
  method,
  amount,
  ...(note ? { note } : {}),
})

describe('payment rows → payments sent', () => {
  it('full through ONE method is the whole total, with its description', () => {
    const value = v({ mode: 'full', tranches: [row('a', 'bank', '', 'حواله ۱۲۳')] })
    expect(paidAmountOf(value, 190_000_000)).toBe(190_000_000)
    expect(paymentEntriesOf(value, 190_000_000)).toEqual([
      { method: 'bank', amount: 190_000_000, note: 'حواله ۱۲۳' },
    ])
  })

  it('full through SEVERAL methods sends one payment per method', () => {
    const value = v({
      mode: 'full',
      tranches: [row('a', 'cash', '100000000'), row('b', 'bank', '90000000', 'ملی')],
    })
    expect(paymentEntriesOf(value, 190_000_000)).toEqual([
      { method: 'cash', amount: 100_000_000, note: '' },
      { method: 'bank', amount: 90_000_000, note: 'ملی' },
    ])
  })

  it('partial with several methods leaves the rest owing', () => {
    const value = v({
      mode: 'partial',
      tranches: [row('a', 'cash', '50000000'), row('b', 'mobile_money', '10000000')],
    })
    expect(paidAmountOf(value, 190_000_000)).toBe(60_000_000)
    expect(paymentEntriesOf(value, 190_000_000)).toHaveLength(2)
  })

  it('an "other" method names itself in the note', () => {
    const value = v({
      mode: 'split',
      tranches: [{ ...row('a', 'other', '5', 'سررسید ۱۵ مهر'), methodLabel: 'چک' }],
    })
    expect(paymentEntriesOf(value, 10)[0]!.note).toBe('چک — سررسید ۱۵ مهر')
  })

  it('unpaid sends nothing; a draft saved before rows still works', () => {
    expect(paymentEntriesOf(v({ mode: 'unpaid', note: 'تا آخر ماه' }), 100)).toEqual([])
    expect(paymentEntriesOf(v({ mode: 'partial', paidNow: '40', tranches: [] }), 100)).toEqual([
      { method: 'cash', amount: 40, note: '' },
    ])
  })
})

describe('the section itself', () => {
  const src = readFileSync(
    join(__dirname, '../components/ui/invoice-builder/invoice-payment-section.tsx'),
    'utf8',
  ).replace(/\/\/.*$/gm, '')
  it('every amount input groups by thousands (MoneyInput, never type=number)', () => {
    expect(src).toContain('<MoneyInput')
    expect(src).not.toContain('type="number"')
  })
  it('every paying mode can add a method, and each row has a description', () => {
    expect(src).toContain("value.mode !== 'unpaid' ?")
    expect(src).toContain('onClick={addRow}')
    expect(src).toContain('invoiceBuilder.paymentNote')
    expect(src).toContain('unpaid-note')
  })
})
