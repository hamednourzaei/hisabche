// ============================================
// packages/ui/src/__tests__/invoice-filter-link.test.ts
//
// H1 — a dashboard card that links to a filter nothing applies.
//
// The defect this guards is not a wrong destination; it is a destination that
// looks right and does nothing. The invoice list read NO query parameters, so
// every card would have opened the same unfiltered table, and the only symptom
// would have been a number that does not match the rows beneath it.
//
// So the test that matters is the ROUND TRIP: build the href a card uses, then
// read it back with the parser the list uses, and require that the filter
// survives. A preset whose parameters the list drops fails here.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  INVOICE_FILTER_PARAMS,
  INVOICE_LINK_PRESETS,
  invoiceListHref,
  parseInvoiceFilters,
  type InvoiceLinkPreset,
} from '../lib/invoices/invoice-filter-link'

const presets = Object.keys(INVOICE_LINK_PRESETS) as InvoiceLinkPreset[]

/** The parser takes anything with `.get`, which is what Next hands a client. */
const paramsOf = (href: string) => new URLSearchParams(href.split('?')[1] ?? '')

describe('every card links to a filter the list actually applies', () => {
  it.each(presets)('%s survives the round trip', (preset) => {
    const intended = INVOICE_LINK_PRESETS[preset]()
    const parsed = parseInvoiceFilters(paramsOf(invoiceListHref(preset)))

    // Not «the parsed result is non-empty» — that would pass if only one of
    // three parameters made it through, which is how a date filter silently
    // disappears while the type filter still works.
    expect(parsed).toEqual(intended)
  })

  it.each(presets)('%s actually narrows something', (preset) => {
    // A preset that parses to nothing is a card linking to the plain list. If
    // that is ever intended, it should be a plain '/invoices' link, not a
    // preset that pretends to filter.
    expect(Object.keys(INVOICE_LINK_PRESETS[preset]()).length).toBeGreaterThan(0)
  })
})

describe('the parser refuses what it cannot honour', () => {
  it('drops a status the list does not have', () => {
    // `?status=open` was in the original spec. There is no `open` status; a
    // pass-through would have queried for it and returned an empty table.
    expect(parseInvoiceFilters(paramsOf('/invoices?status=open'))).toEqual({})
  })

  it('drops a malformed date instead of sending it to the API', () => {
    // The URL is user-editable, and a bad value reaching `.gte('date', …)` is
    // a 500 rather than an empty list.
    expect(parseInvoiceFilters(paramsOf('/invoices?dateFrom=yesterday'))).toEqual({})
  })

  it('ignores a parameter nobody reads', () => {
    expect(parseInvoiceFilters(paramsOf('/invoices?sortByOutstanding=1'))).toEqual({})
  })

  it('does not turn the filter ON for outstanding=false', () => {
    // `Boolean('false')` is `true`. This is the whole reason the reader takes
    // a string rather than being coerced.
    expect(parseInvoiceFilters(paramsOf('/invoices?outstanding=false'))).toEqual({})
    expect(parseInvoiceFilters(paramsOf('/invoices?outstanding=true'))).toEqual({
      outstanding: true,
    })
  })

  it('survives no params at all', () => {
    expect(parseInvoiceFilters(null)).toEqual({})
    expect(parseInvoiceFilters(paramsOf('/invoices'))).toEqual({})
  })
})

describe('the presets say what their cards compute', () => {
  it('«بدهی مشتریان» filters by outstanding, not by a status', () => {
    // The card's rule is a negation — «anything but fully paid» — and no
    // single status expresses it. A `status=pending` link would omit
    // partially-paid invoices the card had counted.
    const debt = INVOICE_LINK_PRESETS.customerDebt()
    expect(debt.outstanding).toBe(true)
    expect(debt.status).toBeUndefined()
  })

  it('«فروش امروز» bounds both ends of the day', () => {
    // `dateFrom` alone returns everything from today onward, which on a
    // back-dated invoice is not «today».
    const todays = INVOICE_LINK_PRESETS.todaySales()
    expect(todays.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(todays.dateTo).toBe(todays.dateFrom)
  })

  it('uses the backend parameter names', () => {
    // `fromDate`/`toDate` were in the client type and read by nothing —
    // the backend reads `dateFrom`/`dateTo`. A link built from the old names
    // returned the entire table.
    expect(INVOICE_FILTER_PARAMS).toContain('dateFrom')
    expect(INVOICE_FILTER_PARAMS).toContain('dateTo')
    expect(INVOICE_FILTER_PARAMS).not.toContain('fromDate')
  })
})
