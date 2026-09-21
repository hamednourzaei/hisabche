// ============================================
// ⚠️ THE LINE BETWEEN A TEXT EDIT AND SOMEBODY'S MONEY.
//
// `POST /api/sync/push` writes the row it is given, with optimistic
// concurrency and no domain logic. Send an invoice down it and you get an
// invoice that moved no stock, booked no revenue and took no number — a
// document and a ledger that disagree, permanently, with nothing in either
// app noticing.
//
// The audit that produced this file found the server's own allow-list letting
// `total`, `paid_amount`, `status` and `amount` through that road. No client
// called it yet. These tests are what keeps the next one from doing so.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  FINANCIAL_ENTITIES,
  FINANCIAL_FIELDS,
  routeFor,
  stripFinancialFields,
} from '../push-routing'

const update = (entity: string, payload: Record<string, unknown>) =>
  routeFor({ entity: entity as never, operation: 'update', payload })

describe('a queued write takes the right road', () => {
  it('⚠️ every financial entity goes through the domain, whatever the operation', () => {
    for (const entity of FINANCIAL_ENTITIES) {
      for (const operation of ['create', 'update', 'delete'] as const) {
        expect(routeFor({ entity, operation, payload: { id: 'x', notes: 'سلام' } })).toBe('domain')
      }
    }
  })

  it('⚠️ names the entities that carry money, so a rename cannot drop one', () => {
    // A list that silently became empty would route everything to the fast
    // road and this whole file would pass while checking nothing.
    expect(FINANCIAL_ENTITIES).toContain('invoice')
    expect(FINANCIAL_ENTITIES).toContain('transaction')
    expect(FINANCIAL_ENTITIES).toContain('inventory_movement')
  })

  it('⚠️ a descriptive edit takes the versioned road — that is the point', () => {
    // These are the edits two devices genuinely make at once, and the ones
    // that were losing data to last-write-wins.
    expect(update('customer', { id: 'c1', phone: '0912', version: 4 })).toBe('versioned')
    expect(update('product', { id: 'p1', barcode: '629', category: 'طلا' })).toBe('versioned')
  })

  it('⚠️ a money field drags an otherwise safe entity back to the domain', () => {
    // `product` is descriptive; `product.quantity` is stock.
    expect(update('product', { id: 'p1', quantity: 5 })).toBe('domain')
    expect(update('product', { id: 'p1', sell_price: 100 })).toBe('domain')
    expect(update('customer', { id: 'c1', credit_limit: 5_000_000 })).toBe('domain')
    expect(update('customer', { id: 'c1', opening_balance: 10 })).toBe('domain')
  })

  it('⚠️ a create or a delete is never the fast road', () => {
    // A create implies defaults and opening balances; deleting a customer who
    // owes money is not a text edit.
    expect(routeFor({ entity: 'customer' as never, operation: 'create', payload: {} })).toBe(
      'domain',
    )
    expect(
      routeFor({ entity: 'customer' as never, operation: 'delete', payload: { id: 'c1' } }),
    ).toBe('domain')
  })

  it('⚠️ an entity nobody classified defaults to the domain', () => {
    // Guessing wrong this way is a slower save. Guessing wrong the other way
    // is a wrong number in somebody's books.
    expect(update('something_new_nobody_listed', { id: 'x', label: 'hi' })).toBe('domain')
  })

  it('⚠️ the versioned payload cannot carry a financial field even by mistake', () => {
    const stripped = stripFinancialFields({
      id: 'c1',
      phone: '0912',
      total: 999,
      paid_amount: 999,
      status: 'paid',
      version: 3,
    })

    expect(stripped).toEqual({ id: 'c1', phone: '0912', version: 3 })
    for (const field of FINANCIAL_FIELDS) {
      expect(field in stripped).toBe(false)
    }
  })
})
