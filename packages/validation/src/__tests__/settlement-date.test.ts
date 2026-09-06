// ============================================
// J3 — when was this invoice settled?
//
// `settlementDate()` read `status === 'completed'`. That worked only by
// accident: `invoice.service.create()` writes `completed` when
// `paidAmount >= total`, so a DOCUMENT word stood in for a settlement fact.
//
// The bug it caused is the one that does not look like a bug: an invoice that
// became fully paid LATER — through a payment allocation rather than at
// creation, which is the normal case — never got `completed`, so this returned
// null. A settled invoice with no settlement date, on every screen and in
// every export.
// ============================================

import { describe, expect, it } from 'vitest'

import { settlementDate } from '../schemas/invoice.schema'

const UPDATED = '2026-03-15T10:00:00.000Z'

describe('with settlement_status (Phase F onward)', () => {
  it('returns the date when fully paid', () => {
    expect(settlementDate({ settlementStatus: 'paid', updatedAt: UPDATED })).toBe(UPDATED)
  })

  it('returns null when partially paid', () => {
    expect(settlementDate({ settlementStatus: 'partially_paid', updatedAt: UPDATED })).toBeNull()
  })

  it('returns null when unpaid', () => {
    expect(settlementDate({ settlementStatus: 'unpaid', updatedAt: UPDATED })).toBeNull()
  })

  it('ignores the legacy word entirely', () => {
    // THE CASE THE OLD CODE GOT WRONG, in both directions.
    //
    // Paid later: status is still `pending` because it was not paid at
    // creation, but the allocations say it is settled.
    expect(
      settlementDate({ status: 'pending', settlementStatus: 'paid', updatedAt: UPDATED }),
    ).toBe(UPDATED)

    // And the reverse: `completed` was written at creation, but a payment was
    // since cancelled and the allocations no longer cover the total.
    expect(
      settlementDate({
        status: 'completed',
        settlementStatus: 'partially_paid',
        updatedAt: UPDATED,
      }),
    ).toBeNull()
  })
})

describe('without settlement_status (rows written before Phase F)', () => {
  it('still falls back to the legacy word', () => {
    // Dropping this branch would lose the settlement date of every historical
    // invoice, which is worse than the imprecision it carries.
    expect(settlementDate({ status: 'completed', updatedAt: UPDATED })).toBe(UPDATED)
  })

  it('returns null for any other legacy value', () => {
    for (const status of ['pending', 'paid', 'partial', 'cancelled', 'overdue']) {
      expect(settlementDate({ status, updatedAt: UPDATED }), status).toBeNull()
    }
  })
})

describe('missing data', () => {
  it('returns null when there is no date to report', () => {
    expect(settlementDate({ settlementStatus: 'paid' })).toBeNull()
    expect(settlementDate({ status: 'completed' })).toBeNull()
  })

  it('returns null for an empty invoice', () => {
    expect(settlementDate({})).toBeNull()
  })
})
