// ============================================
// Party role — derived, never stored.
//
// `customers.type` is cash|credit (payment terms) and must NOT be repurposed
// to mean buyer/seller. The role comes from the party's invoices, so one
// person is never duplicated into two records just to carry a label.
// ============================================

import { describe, expect, it } from 'vitest'

import { customerFiltersSchema, derivePartyRole } from '../index'

describe('the role filter is a real, bounded contract', () => {
  it.each(['buyer', 'seller'])('accepts %s', (role) => {
    expect(customerFiltersSchema.safeParse({ role }).success).toBe(true)
  })

  it('is optional — omitting it means "همه"', () => {
    expect(customerFiltersSchema.safeParse({}).success).toBe(true)
    expect(customerFiltersSchema.parse({}).role).toBeUndefined()
  })

  it('rejects anything else, including the payment-terms values', () => {
    for (const rogue of ['both', 'none', 'cash', 'credit', 'customer']) {
      expect(customerFiltersSchema.safeParse({ role: rogue }).success).toBe(false)
    }
  })

  it('CRITICAL: role and type are independent fields with different meanings', () => {
    // A cash-terms party can be a seller; a credit-terms party can be a buyer.
    const parsed = customerFiltersSchema.parse({ role: 'seller', type: 'cash' })
    expect(parsed.role).toBe('seller')
    expect(parsed.type).toBe('cash')
  })
})

// The merge/match rules mirror backend/src/services/customer.service.ts.
// Kept here so the semantics are pinned even though the implementation is
// server-side: these are product rules, not an implementation detail.
type PartyRole = 'none' | 'buyer' | 'seller' | 'both'

const mergeRole = (current: PartyRole, incoming: 'buyer' | 'seller'): PartyRole => {
  if (current === 'none') return incoming
  if (current === incoming) return current
  return 'both'
}

const matchesRole = (role: PartyRole, filter: 'buyer' | 'seller'): boolean =>
  role === filter || role === 'both'

describe('role derivation from invoice history', () => {
  it('sale invoices make a party a buyer', () => {
    expect(mergeRole('none', 'buyer')).toBe('buyer')
  })

  it('purchase invoices make a party a seller', () => {
    expect(mergeRole('none', 'seller')).toBe('seller')
  })

  it('a party on both sides is BOTH — never duplicated into two records', () => {
    expect(mergeRole('buyer', 'seller')).toBe('both')
    expect(mergeRole('seller', 'buyer')).toBe('both')
  })

  it('is idempotent — more invoices of the same kind change nothing', () => {
    expect(mergeRole('buyer', 'buyer')).toBe('buyer')
    expect(mergeRole('both', 'buyer')).toBe('both')
    expect(mergeRole('both', 'seller')).toBe('both')
  })

  it('a party with no invoices has no role', () => {
    const roles = new Map<string, PartyRole>()
    expect(roles.get('nobody') ?? 'none').toBe('none')
  })
})

describe('filtering', () => {
  it('a "both" party appears under BOTH filters', () => {
    expect(matchesRole('both', 'buyer')).toBe(true)
    expect(matchesRole('both', 'seller')).toBe(true)
  })

  it('a buyer never appears under the seller filter', () => {
    expect(matchesRole('buyer', 'seller')).toBe(false)
    expect(matchesRole('seller', 'buyer')).toBe(false)
  })

  it('a party with no invoices matches neither filter', () => {
    expect(matchesRole('none', 'buyer')).toBe(false)
    expect(matchesRole('none', 'seller')).toBe(false)
  })
})

// ============================================
// Role derivation.
//
// A sale means the party bought from us; a purchase means they sold to us.
// Doing both is ordinary — a shop that buys gold from a jeweller and later
// sells them a display case — and must read as `both` rather than as whichever
// invoice happened to be recorded first.
// ============================================

describe('derivePartyRole', () => {
  it('reads a sale as the party having bought from us', () => {
    expect(derivePartyRole([{ type: 'sale' }])).toBe('buyer')
  })

  it('reads a purchase as the party having sold to us', () => {
    expect(derivePartyRole([{ type: 'purchase' }])).toBe('seller')
  })

  it('returns both when the party has been on each side', () => {
    expect(derivePartyRole([{ type: 'sale' }, { type: 'purchase' }])).toBe('both')
    // Order must not decide the answer.
    expect(derivePartyRole([{ type: 'purchase' }, { type: 'sale' }])).toBe('both')
  })

  it('treats an unset type as a sale, matching the invoice list', () => {
    expect(derivePartyRole([{}])).toBe('buyer')
    expect(derivePartyRole([{ type: null }])).toBe('buyer')
  })

  it('returns none for a party with no invoices rather than guessing buyer', () => {
    expect(derivePartyRole([])).toBe('none')
  })

  it('never returns a payment-terms value', () => {
    // customers.type is cash|credit and must not leak into the role.
    for (const invoices of [[], [{ type: 'sale' }], [{ type: 'purchase' }]]) {
      expect(['buyer', 'seller', 'both', 'none']).toContain(derivePartyRole(invoices))
    }
  })
})
