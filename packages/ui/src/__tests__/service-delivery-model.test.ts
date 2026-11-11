// ============================================
// packages/ui/src/__tests__/service-delivery-model.test.ts
//
// The facts the service-delivery tab derives, and the ones it refuses to derive.
//
// ⚠️ WHAT IS MEASURED HERE. The screen has no arithmetic of its own: it shows
// the settlement the SERVER stored, the balance the SERVER returned, and the
// sync state the DEVICE's outbox reports. These tests pin exactly that — the
// four sync states (including «rejected», which must stay visible), the counts
// that must never present a local queue as server truth, and the cancellation
// consequence that must be stated before anyone confirms.
// ============================================

import { describe, expect, it } from 'vitest'
import type { EntitySyncState } from '@hisabche/api'

import {
  SETTLEMENT_METHODS,
  SERVICE_SESSION_STATUSES,
  cancellable,
  cancellationEffect,
  cancellationReasonMissing,
  deliveryBlocked,
  endTimeFor,
  summarizeSessions,
  syncStateOf,
  type ServiceSessionRow,
} from '../components/ui/service-delivery/service-delivery-model'

type SyncEntry = { entityId: string; state: EntitySyncState; code?: string | null | undefined }

const row = (overrides: Partial<ServiceSessionRow> = {}): ServiceSessionRow => ({
  id: 'session-1',
  workspaceId: 'ws-1',
  customerId: 'customer-1',
  serviceOfferingId: 'service-1',
  sessionDate: '2026-11-01',
  startTime: '09:00',
  endTime: '09:45',
  durationMinutes: 45,
  status: 'scheduled',
  settlementMethod: 'invoice',
  customerName: 'Sara',
  serviceName: 'Haircut',
  practitionerName: null,
  branchName: null,
  sync: 'confirmed',
  syncCode: null,
  ...overrides,
})

describe('the end clock is placed, not invented', () => {
  it('adds the duration to a 24-hour start', () => {
    expect(endTimeFor('09:30', 45)).toBe('10:15')
    expect(endTimeFor('9:30', 5)).toBe('09:35')
    expect(endTimeFor('23:29', 30)).toBe('23:59')
  })

  it('returns null — never NaN — for input it cannot use', () => {
    expect(endTimeFor('9', 45)).toBeNull()
    expect(endTimeFor('09:00', 0)).toBeNull()
    expect(endTimeFor('09:00', -15)).toBeNull()
    // A session that would run past midnight is not a session on this day.
    expect(endTimeFor('23:50', 20)).toBeNull()
    expect(endTimeFor('23:30', 30)).toBeNull()
    expect(endTimeFor('24:00', 30)).toBeNull()
  })
})

describe('the sync column answers only what the host can answer', () => {
  it('a host with no outbox says «unknown», and says nothing about the code', () => {
    expect(syncStateOf([], 'session-1', false)).toEqual({ state: null, code: null })
    // Even with entries, an unavailable host must not claim one of them.
    expect(syncStateOf([{ entityId: 'session-1', state: 'pending' }], 'session-1', false)).toEqual({
      state: null,
      code: null,
    })
  })

  it('on a host that can answer, a row the queue does not name is the server’s', () => {
    expect(syncStateOf([], 'session-1', true)).toEqual({ state: 'confirmed', code: null })
    expect(syncStateOf([{ entityId: 'other', state: 'rejected' }], 'session-1', true)).toEqual({
      state: 'confirmed',
      code: null,
    })
  })

  it('shows all four states', () => {
    const entry = (state: EntitySyncState): SyncEntry[] => [{ entityId: 'session-1', state }]
    expect(syncStateOf(entry('pending'), 'session-1', true).state).toBe('pending')
    expect(syncStateOf(entry('confirmed'), 'session-1', true).state).toBe('confirmed')
    expect(syncStateOf(entry('rejected'), 'session-1', true).state).toBe('rejected')
    expect(syncStateOf(entry('attention'), 'session-1', true).state).toBe('attention')
  })

  it('carries the server’s code with a refusal, so the row can say why', () => {
    const entries: SyncEntry[] = [
      { entityId: 'session-1', state: 'rejected', code: 'INSUFFICIENT_PACKAGE_CREDIT' },
    ]
    expect(syncStateOf(entries, 'session-1', true)).toEqual({
      state: 'rejected',
      code: 'INSUFFICIENT_PACKAGE_CREDIT',
    })
  })

  it('the WORST state wins: a refused delivery is not hidden behind a pending create', () => {
    const entries: SyncEntry[] = [
      { entityId: 'session-1', state: 'pending' },
      { entityId: 'session-1', state: 'rejected', code: 'SESSION_CHANGED' },
    ]
    expect(syncStateOf(entries, 'session-1', true)).toEqual({
      state: 'rejected',
      code: 'SESSION_CHANGED',
    })

    const attention: SyncEntry[] = [
      { entityId: 'session-1', state: 'rejected', code: 'SESSION_CHANGED' },
      { entityId: 'session-1', state: 'attention' },
    ]
    expect(syncStateOf(attention, 'session-1', true).state).toBe('attention')
  })
})

describe('the summary never turns a local queue into server truth', () => {
  it('counts the whole list it was given, by status', () => {
    const summary = summarizeSessions([
      row({ id: 'a', status: 'scheduled' }),
      row({ id: 'b', status: 'in_progress' }),
      row({ id: 'c', status: 'delivered', sync: 'confirmed' }),
      row({ id: 'd', status: 'cancelled' }),
      row({ id: 'e', status: 'no_show' }),
    ])
    // «scheduled» is the work still ahead: a session in progress has not been
    // delivered either, so it belongs on the same side.
    expect(summary).toEqual({
      scheduled: 2,
      delivered: 1,
      cancelled: 1,
      awaitingSync: 0,
      rejected: 0,
    })
  })

  it('«awaiting sync» counts the device queue; «rejected» counts refusals', () => {
    const summary = summarizeSessions([
      row({ id: 'a', sync: 'pending' }),
      row({ id: 'b', sync: 'pending' }),
      row({ id: 'c', sync: 'rejected' }),
      row({ id: 'd', sync: 'attention' }),
      row({ id: 'e', sync: 'confirmed' }),
      // A browser row (no outbox) is neither queued nor refused.
      row({ id: 'f', sync: null }),
    ])
    expect(summary.awaitingSync).toBe(2)
    expect(summary.rejected).toBe(2)
  })

  it('counts nothing for an empty list, and does not need a page size', () => {
    expect(summarizeSessions([])).toEqual({
      scheduled: 0,
      delivered: 0,
      cancelled: 0,
      awaitingSync: 0,
      rejected: 0,
    })
  })
})

describe('the cancellation reason', () => {
  it('is missing when empty or only spaces, present otherwise', () => {
    for (const reason of ['', '   ', '\n\t ']) expect(cancellationReasonMissing(reason)).toBe(true)
    expect(cancellationReasonMissing('double booked')).toBe(false)
    expect(cancellationReasonMissing('  x ')).toBe(false)
  })
})

describe('which statuses may be delivered and cancelled', () => {
  it('only scheduled / checked_in / in_progress can be delivered', () => {
    const deliverable = SERVICE_SESSION_STATUSES.filter((status) => !deliveryBlocked(status))
    expect(deliverable).toEqual(['scheduled', 'checked_in', 'in_progress'])
    expect(deliveryBlocked('delivered')).toBe(true)
    expect(deliveryBlocked('cancelled')).toBe(true)
    expect(deliveryBlocked('no_show')).toBe(true)
  })

  it('cancel is offered only where the domain allows the transition', () => {
    expect(cancellable('scheduled')).toBe(true)
    expect(cancellable('in_progress')).toBe(true)
    expect(cancellable('delivered')).toBe(true)
    // The domain refuses `no_show -> cancelled`: a button there is a broken promise.
    expect(cancellable('no_show')).toBe(false)
    expect(cancellable('cancelled')).toBe(false)
  })
})

describe('what cancelling does to the money', () => {
  it('a package settlement gets its credit back by a REVERSAL, never a deletion', () => {
    expect(
      cancellationEffect({
        status: 'delivered',
        settlementMethod: 'package_credit',
        packageCreditId: 'credit-1',
      }),
    ).toBe('package_reversal')
  })

  it('a package settlement with no readable consumption entry is refused', () => {
    expect(
      cancellationEffect({
        status: 'delivered',
        settlementMethod: 'package_credit',
        packageCreditId: null,
      }),
    ).toBe('credit_missing')
  })

  it('a billed service is corrected, not cancelled', () => {
    expect(
      cancellationEffect({
        status: 'delivered',
        settlementMethod: 'invoice',
        packageCreditId: null,
      }),
    ).toBe('invoice_blocked')
  })

  it('a free delivery has no financial effect', () => {
    expect(cancellationEffect({ status: 'delivered', settlementMethod: 'complementary' })).toBe(
      'free',
    )
  })

  it('anything not delivered has settled nothing', () => {
    for (const status of ['scheduled', 'in_progress', 'no_show', 'cancelled']) {
      expect(
        cancellationEffect({ status, settlementMethod: 'package_credit', packageCreditId: 'x' }),
      ).toBe('nothing')
    }
  })

  it('a settlement this build does not know claims nothing about the money', () => {
    expect(cancellationEffect({ status: 'delivered', settlementMethod: 'barter' })).toBe('nothing')
  })
})

describe('the settlements the dialog may offer are the domain’s', () => {
  it('package credit, invoice, free — and «free» is `complementary`', () => {
    expect([...SETTLEMENT_METHODS]).toEqual(['package_credit', 'invoice', 'complementary'])
  })
})
