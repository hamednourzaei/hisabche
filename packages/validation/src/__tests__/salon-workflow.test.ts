import { describe, expect, it } from 'vitest'
import {
  allocateCommissionShares,
  canonicalSessionStageLabelKey,
  commissionReport,
  sessionsOverlap,
  summarizeSalonOperations,
} from '../index'

describe('8.2 Multi-Staff Salon Workflow (6-7 Staff)', () => {
  it('detects chair/room overlap deterministically and maps canonical stages cleanly', () => {
    expect(
      sessionsOverlap({ start: '10:00', end: '11:00' }, { start: '10:30', end: '11:30' }),
    ).toBe(true)
    expect(
      sessionsOverlap({ start: '10:00', end: '11:00' }, { start: '11:00', end: '12:00' }),
    ).toBe(false)
    expect(canonicalSessionStageLabelKey('in_progress')).toBe(
      'serviceDelivery.status.checkedInOrInProgress',
    )
  })

  it('refuses ambiguous multi-provider commission and splits exact minor units when allocated', () => {
    expect(() =>
      allocateCommissionShares({
        sessionId: 'ses-1',
        chargedMinor: 150_000,
        providerIds: [
          '11111111-1111-4111-8111-111111111111',
          '22222222-2222-4222-8222-222222222222',
        ],
      }),
    ).toThrow('COMMISSION_MULTI_PROVIDER_ALLOCATION_REQUIRED')

    const allocated = allocateCommissionShares({
      sessionId: 'ses-1',
      chargedMinor: 150_001,
      providerIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
      allocations: [
        { employeeId: '11111111-1111-4111-8111-111111111111', shareBp: 6000 },
        { employeeId: '22222222-2222-4222-8222-222222222222', shareBp: 4000 },
      ],
    })
    const totalAttributed = allocated.reduce((sum, a) => sum + a.attributedChargeMinor, 0)
    expect(totalAttributed).toBe(150_001)
  })

  it('computes commission without inventing missing rates or package per-session prices', () => {
    const lines = commissionReport(
      [
        { practitionerId: 'emp-stylist', currency: 'AFN', chargedMinor: 1500 },
        { practitionerId: 'emp-stylist', currency: 'AFN', chargedMinor: null }, // package session
        { practitionerId: 'emp-norate', currency: 'AFN', chargedMinor: 1000 },
      ],
      new Map([['emp-stylist', 3500]]),
    )

    const stylist = lines.find((l) => l.practitionerId === 'emp-stylist')
    expect(stylist).toMatchObject({
      sessions: 2,
      unknownSessions: 1,
      baseMinor: 1500,
      rateBp: 3500,
      commissionMinor: 525,
    })
    expect(lines.find((l) => l.practitionerId === 'emp-norate')?.commissionMinor).toBeNull()
  })

  it('computes salon owner capacity & service profit while keeping unknown costs null', () => {
    const summaryKnown = summarizeSalonOperations({
      sessions: [
        {
          status: 'delivered',
          durationMinutes: 60,
          revenueMinor: 1500,
          materialCostMinor: 250,
          commissionMinor: 525,
        },
        {
          status: 'no_show',
          durationMinutes: 45,
          revenueMinor: null,
          materialCostMinor: null,
          commissionMinor: null,
        },
        {
          status: 'scheduled',
          durationMinutes: 30,
          revenueMinor: null,
          materialCostMinor: null,
          commissionMinor: null,
        },
      ],
      totalAvailableResourceMinutes: 480,
    })
    expect(summaryKnown.deliveredCount).toBe(1)
    expect(summaryKnown.noShowCount).toBe(1)
    expect(summaryKnown.freeCapacityMinutes).toBe(390)
    expect(summaryKnown.serviceProfitMinor).toBe(725)

    const summaryUnknown = summarizeSalonOperations({
      sessions: [
        {
          status: 'delivered',
          durationMinutes: 60,
          revenueMinor: 1500,
          materialCostMinor: null,
          commissionMinor: 525,
        },
      ],
    })
    expect(summaryUnknown.serviceProfitMinor).toBeNull()
  })
})
