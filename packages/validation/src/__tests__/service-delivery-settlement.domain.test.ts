// ============================================
// M4 audit — settlement is chosen, never inferred; a session moves through ONE transition table.
//
//   · package_credit needs a named package and enough credit — otherwise the delivery is REFUSED. It used to fall back to
//     «invoice» and return a line nobody billed: a service given with no credit consumed, no debt and no invoice.
//   · invoice needs an invoice that already exists (made by the invoice engine) and links it
//   · complementary («free») needs a reason, kept on the session
//   · cancelling a delivered session reverses the credit it consumed (referencing it), refuses an invoiced one (a correction
//     flow, not a status flip) and never cancels a package session whose credit entry is unknown
//   · the idempotency identity of a delivery is the SESSION, not the request
// ============================================

import { describe, expect, it } from 'vitest'
import type { PackageCreditEntry } from '../schemas/universal-core/package-credit-ledger.domain'
import {
  SERVICE_DELIVERY_STATUSES,
  deliveryConsumeKey,
  deliveryReversalKey,
  isValidSessionStatusTransition,
  planServiceDelivery,
  planServiceDeliveryCancellation,
  type ServiceDeliverySession,
  type ServiceDeliveryStatus,
} from '../schemas/universal-core/service-delivery.domain'

const base: ServiceDeliverySession = {
  id: 'ses-1',
  workspaceId: 'ws',
  customerId: 'cust',
  serviceOfferingId: 'srv',
  practitionerId: null,
  sessionDate: '2026-11-01',
  startTime: '10:00',
  endTime: '11:00',
  durationMinutes: 60,
  status: 'scheduled',
  settlementMethod: 'package_credit',
  packageCreditId: null,
  invoiceId: null,
  createdAt: '2026-11-01T08:00:00Z',
  updatedAt: '2026-11-01T08:00:00Z',
}

const grant = (quantity: number): PackageCreditEntry => ({
  id: 'g1',
  workspaceId: 'ws',
  customerId: 'cust',
  packageProductId: 'pkg',
  entryType: 'GRANT',
  quantity,
  effectiveDate: '2026-10-01',
  createdAt: '2026-10-01T00:00:00Z',
})

const consume: PackageCreditEntry = {
  id: 'c1',
  workspaceId: 'ws',
  customerId: 'cust',
  packageProductId: 'pkg',
  entryType: 'CONSUME',
  quantity: 1,
  effectiveDate: '2026-11-01',
  createdAt: '2026-11-01T10:00:00Z',
}

describe('settlement is explicit', () => {
  it('package_credit without a named package is refused — it never becomes an invoice', () => {
    expect(() => planServiceDelivery({ session: base, creditEntries: [grant(5)] })).toThrow(
      'SETTLEMENT_PACKAGE_REQUIRED',
    )
  })

  it('package_credit with too little credit is refused — it never becomes an invoice', () => {
    expect(() =>
      planServiceDelivery({ session: base, creditEntries: [], packageProductId: 'pkg' }),
    ).toThrow('INSUFFICIENT_PACKAGE_CREDIT')
    expect(() =>
      planServiceDelivery({
        session: base,
        creditEntries: [grant(1)],
        packageProductId: 'pkg',
        quantity: 2,
      }),
    ).toThrow('INSUFFICIENT_PACKAGE_CREDIT')
  })

  it('invoice needs an invoice id, and links it', () => {
    expect(() =>
      planServiceDelivery({ session: base, requestedSettlementMethod: 'invoice' }),
    ).toThrow('SETTLEMENT_INVOICE_REQUIRED')
    const done = planServiceDelivery({
      session: base,
      requestedSettlementMethod: 'invoice',
      invoiceId: 'inv-9',
    })
    expect(done.session).toMatchObject({
      status: 'delivered',
      settlementMethod: 'invoice',
      invoiceId: 'inv-9',
    })
    expect(done.consumptionEntry).toBeNull()
  })

  it('complementary needs a reason, and keeps it', () => {
    for (const reason of [undefined, null, '', '   ']) {
      expect(() =>
        planServiceDelivery({ session: base, requestedSettlementMethod: 'complementary', reason }),
      ).toThrow('SETTLEMENT_REASON_REQUIRED')
    }
    const done = planServiceDelivery({
      session: base,
      requestedSettlementMethod: 'complementary',
      reason: ' first visit gift ',
    })
    expect(done.session).toMatchObject({
      status: 'delivered',
      settlementMethod: 'complementary',
      settlementReason: 'first visit gift',
    })
  })

  it('the consumption is keyed by the session, whatever the request says', () => {
    const done = planServiceDelivery({
      session: base,
      creditEntries: [grant(3)],
      packageProductId: 'pkg',
      idempotencyKey: 'some-other-request-id',
    })
    expect(done.consumptionEntry?.idempotencyKey).toBe(deliveryConsumeKey('ses-1'))
    expect(deliveryConsumeKey('ses-1')).toBe('delivery_ses-1')
  })
})

describe('the transition table', () => {
  const ALLOWED: Array<[ServiceDeliveryStatus, ServiceDeliveryStatus]> = [
    // V59.1: reception check-in. A checked-in customer arrived, so never no-show.
    ['scheduled', 'checked_in'],
    ['checked_in', 'in_progress'],
    ['checked_in', 'delivered'],
    ['checked_in', 'cancelled'],
    ['scheduled', 'in_progress'],
    ['scheduled', 'delivered'],
    ['scheduled', 'cancelled'],
    // V54 5.5 (7 Nov 2026): a booked customer who never came is a no-show, not
    // a cancellation — the person did not arrive, nobody called it off.
    ['scheduled', 'no_show'],
    ['in_progress', 'delivered'],
    ['in_progress', 'no_show'],
    ['in_progress', 'cancelled'],
    ['delivered', 'cancelled'],
  ]

  it('allows exactly these moves between different states (the same state again is a replay)', () => {
    const found: Array<[string, string]> = []
    for (const from of SERVICE_DELIVERY_STATUSES) {
      for (const to of SERVICE_DELIVERY_STATUSES) {
        if (from !== to && isValidSessionStatusTransition(from, to)) found.push([from, to])
      }
    }
    expect(found.sort()).toEqual([...ALLOWED].sort())
  })

  it('cancelled → delivered and no_show → cancelled are refused', () => {
    expect(() =>
      planServiceDelivery({
        session: { ...base, status: 'cancelled' },
        requestedSettlementMethod: 'complementary',
        reason: 'x',
      }),
    ).toThrow('INVALID_STATUS_TRANSITION:cancelled->delivered')
    expect(() =>
      planServiceDeliveryCancellation({ session: { ...base, status: 'no_show' } }),
    ).toThrow('INVALID_STATUS_TRANSITION:no_show->cancelled')
  })

  it('delivering twice, or cancelling twice, is a replay: no second entry', () => {
    const delivered = {
      ...base,
      status: 'delivered' as const,
      settlementMethod: 'package_credit' as const,
      packageCreditId: 'c1',
    }
    expect(
      planServiceDelivery({ session: delivered, packageProductId: 'pkg' }).consumptionEntry,
    ).toBeNull()
    const cancelled = { ...base, status: 'cancelled' as const }
    expect(planServiceDeliveryCancellation({ session: cancelled }).reversalEntry).toBeNull()
  })
})

describe('a cancellation says why', () => {
  it('needs a reason for a scheduled session, and keeps it trimmed', () => {
    for (const reason of [undefined, null, '', '   ']) {
      expect(() => planServiceDeliveryCancellation({ session: base, reason })).toThrow(
        'CANCELLATION_REASON_REQUIRED',
      )
    }
    const res = planServiceDeliveryCancellation({ session: base, reason: '  customer called  ' })
    expect(res.session).toMatchObject({
      status: 'cancelled',
      cancellationReason: 'customer called',
    })
  })

  it('needs one for a delivered package session too - and still reverses the credit', () => {
    const delivered: ServiceDeliverySession = {
      ...base,
      status: 'delivered',
      settlementMethod: 'package_credit',
      packageCreditId: 'c1',
    }
    expect(() =>
      planServiceDeliveryCancellation({ session: delivered, creditEntries: [grant(5), consume] }),
    ).toThrow('CANCELLATION_REASON_REQUIRED')
    const res = planServiceDeliveryCancellation({
      session: delivered,
      creditEntries: [grant(5), consume],
      reason: 'wrong customer',
    })
    expect(res.reversalEntry?.entryType).toBe('REVERSAL')
    expect(res.session.cancellationReason).toBe('wrong customer')
  })

  it('a replay of an already-cancelled session asks for nothing and writes nothing', () => {
    const cancelled = { ...base, status: 'cancelled' as const, cancellationReason: 'first reason' }
    const res = planServiceDeliveryCancellation({ session: cancelled })
    expect(res.session).toBe(cancelled)
    expect(res.reversalEntry).toBeNull()
  })

  it('the reason is asked for AFTER the state check: a forbidden move reports the move, not the reason', () => {
    expect(() =>
      planServiceDeliveryCancellation({ session: { ...base, status: 'no_show' } }),
    ).toThrow('INVALID_STATUS_TRANSITION:no_show->cancelled')
  })
})

describe('cancelling a delivered session', () => {
  const delivered: ServiceDeliverySession = {
    ...base,
    status: 'delivered',
    settlementMethod: 'package_credit',
    packageCreditId: 'c1',
  }

  it('reverses the credit it consumed, referencing that entry, keyed by the session', () => {
    const res = planServiceDeliveryCancellation({
      session: delivered,
      creditEntries: [grant(5), consume],
      reason: 'x',
    })
    expect(res.session.status).toBe('cancelled')
    expect(res.reversalEntry).toMatchObject({
      entryType: 'REVERSAL',
      referenceEntryId: 'c1',
      quantity: 1,
    })
    expect(res.reversalEntry?.idempotencyKey).toBe(deliveryReversalKey('ses-1'))
  })

  it('refuses a package session whose credit entry is unknown — it must not cancel without giving the credit back', () => {
    expect(() =>
      planServiceDeliveryCancellation({
        session: { ...delivered, packageCreditId: null },
        creditEntries: [grant(5), consume],
        reason: 'x',
      }),
    ).toThrow('CREDIT_REFERENCE_MISSING')
  })

  it('refuses an invoiced session: undoing it is a correction flow, not a status flip', () => {
    expect(() =>
      planServiceDeliveryCancellation({
        session: {
          ...delivered,
          settlementMethod: 'invoice',
          packageCreditId: null,
          invoiceId: 'inv-9',
        },
        reason: 'x',
      }),
    ).toThrow('DELIVERED_INVOICE_CORRECTION_REQUIRED')
  })

  it('a free session has no financial fact to undo: it cancels with no entry', () => {
    const res = planServiceDeliveryCancellation({
      session: {
        ...delivered,
        settlementMethod: 'complementary',
        packageCreditId: null,
        settlementReason: 'gift',
      },
      reason: 'x',
    })
    expect(res.session.status).toBe('cancelled')
    expect(res.reversalEntry).toBeNull()
  })
})
