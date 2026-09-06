// ============================================
// H6 — one entity type in, one route out.
//
// Two properties matter, and they pull in opposite directions:
//
//   `routeForEntity`        must NEVER fabricate. An audit row that renders a
//                           link going somewhere unrelated tells the reader
//                           they have seen the record when they have not.
//
//   `routeForEntityOrList`  must ALWAYS answer. The person already tapped the
//                           notification; staying put reads as a broken app.
//
// A single function cannot have both, which is why there are two — and why a
// test is worth having, because "make them consistent" is the obvious wrong
// refactor for someone who does not know that.
// ============================================

import { describe, expect, it } from 'vitest'

import { hasRouteForEntity, routeForEntity, routeForEntityOrList } from '../lib/entity-route'

const ID = '11111111-2222-3333-4444-555555555555'

describe('routeForEntity — exact or nothing', () => {
  it('routes the types that have a detail screen', () => {
    expect(routeForEntity('invoice', ID)).toBe(`/invoices/${ID}`)
    expect(routeForEntity('customer', ID)).toBe(`/customers/${ID}`)
    expect(routeForEntity('product', ID)).toBe(`/warehouse/${ID}`)
    expect(routeForEntity('employee', ID)).toBe(`/team-and-payroll/${ID}`)
  })

  it('returns null for a type with no detail screen', () => {
    // A payment is read on the invoice it settled. Inventing `/payments/:id`
    // would be a link to a 404.
    expect(routeForEntity('payment', ID)).toBeNull()
    expect(routeForEntity('journal_entry', ID)).toBeNull()
  })

  it('returns null for an unknown type', () => {
    expect(routeForEntity('sasquatch', ID)).toBeNull()
  })

  it('returns null without an id', () => {
    expect(routeForEntity('invoice', '')).toBeNull()
  })
})

describe('routeForEntityOrList — always somewhere', () => {
  it('prefers the record when it can', () => {
    expect(routeForEntityOrList('invoice', ID)).toBe(`/invoices/${ID}`)
  })

  it('falls back to the list without an id', () => {
    expect(routeForEntityOrList('invoice', null)).toBe('/invoices')
    expect(routeForEntityOrList('product', undefined)).toBe('/warehouse')
  })

  it('falls back to the list for a type with no detail screen', () => {
    expect(routeForEntityOrList('payment', ID)).toBe('/invoices?filter=pending')
    expect(routeForEntityOrList('purchase_order', ID)).toBe('/purchasing')
  })

  it('falls back to the activity feed for an unknown type', () => {
    expect(routeForEntityOrList('sasquatch', ID)).toBe('/activities')
  })

  it('never returns an empty string', () => {
    for (const type of ['', 'invoice', 'payment', 'nonsense', 'project']) {
      expect(routeForEntityOrList(type, ID).length).toBeGreaterThan(0)
    }
  })
})

describe('the routes are the canonical ones after G1', () => {
  it('sends employees to /team-and-payroll, not /human-resources', () => {
    // The exact staleness this module exists to prevent: notification-bell
    // kept its own copy of this mapping and went on pointing at the
    // deprecated route after G1 moved it.
    expect(routeForEntity('employee', ID)).not.toContain('human-resources')
    expect(routeForEntityOrList('employee', null)).toBe('/team-and-payroll')
  })

  it('sends products to /warehouse, not /product-list', () => {
    expect(routeForEntityOrList('product', null)).not.toContain('product-list')
  })

  it('sends customers to /customers, not /customer-list', () => {
    expect(routeForEntityOrList('customer', null)).not.toContain('customer-list')
  })
})

describe('hasRouteForEntity', () => {
  it('is true only where a detail route exists', () => {
    expect(hasRouteForEntity('invoice')).toBe(true)
    expect(hasRouteForEntity('payment')).toBe(false)
    expect(hasRouteForEntity('sasquatch')).toBe(false)
  })
})
