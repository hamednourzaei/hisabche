// ============================================
// A party's role is derived from the direction of its invoices, never stored.
// `customers.type` already means payment terms (cash|credit), so reusing it
// would have silently changed what existing rows mean — and splitting a party
// into two records would double-count anyone who both buys and sells.
// ============================================

import { describe, expect, it } from 'vitest'

import { derivePartyRole } from '../schemas/customer.schema'

describe('derivePartyRole', () => {
  it('calls a party with only sales a buyer', () => {
    // A sale means they bought from us.
    expect(derivePartyRole([{ type: 'sale' }, { type: 'sale' }])).toBe('buyer')
  })

  it('calls a party with only purchases a seller', () => {
    expect(derivePartyRole([{ type: 'purchase' }])).toBe('seller')
  })

  it('calls a party with both a both', () => {
    // The case the whole design exists for: a shop that buys gold from a
    // jeweller and also sells to them.
    expect(derivePartyRole([{ type: 'sale' }, { type: 'purchase' }])).toBe('both')
  })

  it('does not depend on invoice order', () => {
    expect(derivePartyRole([{ type: 'purchase' }, { type: 'sale' }])).toBe('both')
  })

  it('treats an invoice with no type as a sale', () => {
    // Pre-migration rows carry a null type and were always sales — the same
    // convention the backend queries and the export use.
    expect(derivePartyRole([{}])).toBe('buyer')
    expect(derivePartyRole([{ type: null }])).toBe('buyer')
  })

  it('mixes a legacy untyped invoice with a purchase into both', () => {
    expect(derivePartyRole([{}, { type: 'purchase' }])).toBe('both')
  })

  it('returns none for a party with no invoices', () => {
    // Distinct from 'buyer': a newly added contact has not traded yet, and
    // showing them as a customer would be a claim the data does not support.
    expect(derivePartyRole([])).toBe('none')
  })
})
