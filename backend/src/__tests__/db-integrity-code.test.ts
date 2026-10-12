// ============================================
// What docs/FINDING-db-integrity.sql found on the live database, traced back
// to the code that wrote it.
//
//   A1  15 invoice lines with no workspace  → `buildItemRows` never set it
//   B2  15 allocations to invoices that are gone, and no rule in the code that
//       a payment settles invoices of its own currency (DEFECT-CUR-03)
//
// The database now refuses both (db-integrity-01). These keep the code from
// sending them in the first place — a refusal at the database is a 500 to the
// person at the till.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { autoAllocate, settlesInCurrency } from '../services/payments/payments.domain'

const src = (rel: string) =>
  readFileSync(join(__dirname, '..', rel), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

describe('a payment settles invoices of its own currency', () => {
  it('same currency settles; another does not', () => {
    expect(settlesInCurrency({ currency: 'AFN' }, 'AFN', 'AFN')).toBe(true)
    expect(settlesInCurrency({ currency: 'USD' }, 'AFN', 'AFN')).toBe(false)
  })

  it('an invoice with no currency of its own is in the books currency', () => {
    expect(settlesInCurrency({ currency: null }, 'AFN', 'AFN')).toBe(true)
    expect(settlesInCurrency({}, 'IRR', 'IRR')).toBe(true)
    expect(settlesInCurrency({ currency: null }, 'USD', 'AFN')).toBe(false)
  })

  it('⚠️ «he paid me 500 afghani» never eats the older dollar debt', () => {
    const open = [
      {
        invoiceId: 'usd',
        invoiceNumber: 'A',
        total: 100,
        allocated: 0,
        dueDate: '2026-01-01',
        invoiceDate: '2026-01-01',
        currency: 'USD',
      },
      {
        invoiceId: 'afn',
        invoiceNumber: 'B',
        total: 800,
        allocated: 0,
        dueDate: '2026-02-01',
        invoiceDate: '2026-02-01',
        currency: 'AFN',
      },
    ]
    const mine = open.filter((invoice) => settlesInCurrency(invoice, 'AFN', 'AFN'))
    expect(autoAllocate(500, mine).allocations).toEqual([{ invoiceId: 'afn', amount: 500 }])
    // Without the filter the oldest invoice — the dollar one — would be paid.
    expect(autoAllocate(500, open).allocations[0]?.invoiceId).toBe('usd')
  })

  it('the service refuses a named invoice of another currency, and filters the rest', () => {
    const service = src('services/payments/payments.service.ts')
    expect(service).toContain("throw new ValidationError('PAYMENT_ALLOCATION_CURRENCY_MISMATCH')")
    expect(service).toContain(
      'candidates.filter((invoice) => settlesInCurrency(invoice, currency, bookCurrency)',
    )
    // Both readers bring the invoice's currency back.
    const repo = src('services/payments/payments.repository.ts')
    expect(repo.split('currency: row.currency ? String(row.currency) : null').length).toBe(3)
  })
})

describe('an invoice line says which business it belongs to', () => {
  it('⚠️ every line the service builds carries workspace_id', () => {
    const service = src('services/invoice.service.ts')
    expect(service).toContain('workspace_id: workspaceId,')
    // Both callers hand the workspace in; neither can forget it (it is a
    // required parameter, so tsc refuses a call without it).
    expect(service.split('this.buildItemRows(').length).toBe(3)
    expect(service).toContain('this.buildItemRows(lines, invoiceId, userId, ctx.workspaceId)')
    expect(service).toContain('this.buildItemRows(items, invoiceId, ctx.userId, ctx.workspaceId)')
  })
})

describe('a product with a cost layer has a history', () => {
  it('delete checks cost_layers beside sales and movements', () => {
    const service = src('services/product.service.ts')
    expect(service).toContain(".from('cost_layers')")
    expect(service).toContain(
      "if (costed.data) throw new ConflictError('PRODUCT_HAS_STOCK_MOVEMENTS')",
    )
    // A failed read is not «no history».
    expect(service).toContain('if (costed.error && !isMissingTable(costed.error))')
  })
})
