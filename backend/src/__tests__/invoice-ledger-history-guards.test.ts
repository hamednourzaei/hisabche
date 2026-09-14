// ============================================
// backend/src/__tests__/invoice-ledger-history-guards.test.ts
//
// Three production defects on one invoice page, each invisible to the fake
// database (which accepts any column and never refuses a stock issue):
//
//   1. «ثبت در دفتر» → 409 «[object Object]», and the accounting screens
//      stayed empty: a sale of stock with no cost layer threw
//      INVENTORY_INSUFFICIENT_STOCK inside costing, which aborted the whole
//      ledger posting (the creation path only logged it).
//   2. A fully paid cash invoice showed «هنوز پرداختی ثبت نشده»: the payments
//      read selected payment_date/payment_method — columns that do not exist —
//      and a 42703 was excused as «old database» and returned [].
//   3. «تاریخچه‌ی تغییرات» was always empty: no invoice or payment action
//      wrote audit_logs.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (...parts: string[]) =>
  readFileSync(join(__dirname, '..', 'services', ...parts), 'utf8')

describe('a sale without cost layers still reaches the ledger', () => {
  const source = read('invoice.service.ts')

  it('costing skips INVENTORY_INSUFFICIENT_STOCK lines instead of aborting', () => {
    expect(source).toContain("includes('INVENTORY_INSUFFICIENT_STOCK')")
    expect(source).toContain('uncosted.push(')
  })

  it('both the creation path and post-to-ledger collect uncosted lines', () => {
    expect(source.match(/const uncosted: string\[\] = \[\]/g)?.length ?? 0).toBeGreaterThanOrEqual(
      2,
    )
    expect(source).toContain('uncostedProducts')
  })
})

describe('the invoice payments read uses real payments columns', () => {
  const source = read('invoices', 'invoice-related.service.ts')

  it('selects entry_date and method', () => {
    expect(source).toContain(
      'payment:payments(id, payment_number, entry_date, method, reference, status)',
    )
  })

  it('a missing COLUMN is an error, not an empty list', () => {
    const fn = source.slice(source.indexOf('function isMissingRelation'))
    const body = fn.slice(0, fn.indexOf('\n}'))
    expect(body).not.toContain('42703')
    expect(body).not.toContain('PGRST204')
  })
})

describe('business events land in the record history', () => {
  it('logBusinessEvent writes audit_logs', () => {
    expect(read('event-log.service.ts')).toContain('auditService.log(')
  })

  it('invoices and payments emit events', () => {
    const invoice = read('invoice.service.ts')
    const payments = read('payments', 'payments.service.ts')
    expect(invoice).toContain("action: 'created'")
    expect(invoice).toContain("action: 'posted_to_ledger'")
    expect(payments).toContain("action: 'payment_recorded'")
  })
})
