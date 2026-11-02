// The two payment rules the server and the device used to hold separately: which invoices a payment may be
// named against (the party must own them) and at what rate a foreign payment is booked.

import { describe, expect, it } from 'vitest'
import { invoicesOfAnotherParty, resolveBookingRate } from '../schemas/payments.domain'

describe('invoicesOfAnotherParty', () => {
  const inv = (customerId: string | null, supplierId: string | null = null) => ({
    invoiceId: 'i',
    customerId,
    supplierId,
  })

  it("a customer payment may name that customer's invoices", () => {
    expect(invoicesOfAnotherParty('customer', 'c1', [inv('c1')])).toEqual([])
  })

  it('a different customer, or a walk-in sale for a named customer, is refused', () => {
    expect(invoicesOfAnotherParty('customer', 'c1', [inv('c2')])).toEqual(['i'])
    expect(invoicesOfAnotherParty('customer', 'c1', [inv(null)])).toEqual(['i'])
  })

  it('both unnamed is the walk-in cash sale: allowed', () => {
    expect(invoicesOfAnotherParty('customer', null, [inv(null)])).toEqual([])
  })

  it('a supplier payment looks at the supplier side', () => {
    expect(invoicesOfAnotherParty('supplier', 's1', [inv(null, 's1')])).toEqual([])
    expect(invoicesOfAnotherParty('supplier', 's1', [inv('s1', null)])).toEqual(['i'])
  })
})

describe('resolveBookingRate', () => {
  it('books-currency payments need no rate', () => {
    expect(
      resolveBookingRate({
        currency: 'AFN',
        bookCurrency: 'AFN',
        given: undefined,
        invoiceRates: [],
      }),
    ).toBe(1)
  })

  it('a given rate wins', () => {
    expect(
      resolveBookingRate({ currency: 'USD', bookCurrency: 'AFN', given: 70, invoiceRates: [72] }),
    ).toBe(70)
  })

  it('without one, the rate the named invoices were frozen at — if they agree', () => {
    expect(
      resolveBookingRate({
        currency: 'USD',
        bookCurrency: 'AFN',
        given: undefined,
        invoiceRates: [72, 72],
      }),
    ).toBe(72)
    expect(
      resolveBookingRate({
        currency: 'USD',
        bookCurrency: 'AFN',
        given: undefined,
        invoiceRates: [72, 73],
      }),
    ).toBeNull()
  })

  it('never a silent 1: no rate, no invoices, or an invoice without a rate → null', () => {
    expect(
      resolveBookingRate({
        currency: 'USD',
        bookCurrency: 'AFN',
        given: undefined,
        invoiceRates: [],
      }),
    ).toBeNull()
    expect(
      resolveBookingRate({
        currency: 'USD',
        bookCurrency: 'AFN',
        given: undefined,
        invoiceRates: [null],
      }),
    ).toBeNull()
    expect(
      resolveBookingRate({
        currency: 'USD',
        bookCurrency: 'AFN',
        given: undefined,
        invoiceRates: null,
      }),
    ).toBeNull()
    expect(
      resolveBookingRate({ currency: 'USD', bookCurrency: 'AFN', given: 0, invoiceRates: [] }),
    ).toBeNull()
  })
})
