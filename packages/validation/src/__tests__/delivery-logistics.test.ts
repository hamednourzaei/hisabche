// ============================================
// packages/validation/src/__tests__/delivery-logistics.test.ts
//
// WP-19 — the rules a delivery is closed by, and the rules a vehicle is sent by.
//
// These are the rules the server and the device both import, so the numbers here
// are the numbers a driver sees on the phone and the cashier sees in the drawer.
// Every expected figure is computed by hand.
// ============================================

import { describe, expect, it } from 'vitest'
import {
  decideDeliveryAttempt,
  dispatchIssues,
  vehicleServiceState,
  type CourierDeliverySnapshot,
  type DeliveryPodCapture,
} from '../schemas/universal-core/delivery-logistics.domain'

const AT = '2026-11-18T09:30:00.000Z'

/** A parcel on the road, 250.00 due, cash still with nobody. */
const onTheRoad = (overrides: Partial<CourierDeliverySnapshot> = {}): CourierDeliverySnapshot => ({
  status: 'picked_up',
  codStage: 'with_driver',
  codAmountMinor: 25_000,
  ...overrides,
})

const signature = (overrides: Partial<DeliveryPodCapture> = {}): DeliveryPodCapture => ({
  method: 'signature',
  recipientName: 'احمد',
  ...overrides,
})

describe('decideDeliveryAttempt — delivered', () => {
  it('records 240.00 collected of 250.00 due and leaves 20.00-level shortfall exactly', () => {
    // 25 000 − 24 000 = 1 000 minor still owed by the customer.
    const decision = decideDeliveryAttempt(
      onTheRoad(),
      { outcome: 'delivered', pod: signature(), collectedMinor: 24_000 },
      AT,
    )

    expect(decision.ok).toBe(true)
    if (!decision.ok) return
    expect(decision.close.status).toBe('delivered')
    expect(decision.close.collectedMinor).toBe(24_000)
    expect(decision.close.shortfallMinor).toBe(1_000)
    expect(decision.close.codStage).toBe('with_driver')
    expect(decision.close.deliveredAt).toBe(AT)
    expect(decision.close.failureReason).toBeNull()
  })

  it('collects the full amount when the driver does not name one', () => {
    const decision = decideDeliveryAttempt(
      onTheRoad(),
      { outcome: 'delivered', pod: signature() },
      AT,
    )
    expect(decision.ok).toBe(true)
    if (!decision.ok) return
    expect(decision.close.collectedMinor).toBe(25_000)
    expect(decision.close.shortfallMinor).toBe(0)
  })

  it('keeps a scale-sized figure exact: 1,250,000 due, 250,000 collected, 1,000,000 owed', () => {
    const decision = decideDeliveryAttempt(
      onTheRoad({ codAmountMinor: 1_250_000 }),
      { outcome: 'delivered', pod: signature(), collectedMinor: 250_000 },
      AT,
    )
    expect(decision.ok).toBe(true)
    if (!decision.ok) return
    expect(decision.close.shortfallMinor).toBe(1_000_000)
  })

  it('does not move the COD stage of a delivery that carries no cash', () => {
    const decision = decideDeliveryAttempt(
      onTheRoad({ codAmountMinor: 0, codStage: 'to_collect' }),
      { outcome: 'delivered', pod: signature() },
      AT,
    )
    expect(decision.ok).toBe(true)
    if (!decision.ok) return
    expect(decision.close.collectedMinor).toBe(0)
    expect(decision.close.shortfallMinor).toBe(0)
    expect(decision.close.codStage).toBe('to_collect')
  })

  it('takes the capture time the device recorded, and trims the recipient', () => {
    const decision = decideDeliveryAttempt(
      onTheRoad(),
      {
        outcome: 'delivered',
        pod: signature({ recipientName: '  مریم  ', capturedAt: '2026-11-18T07:05:00.000Z' }),
      },
      AT,
    )
    expect(decision.ok).toBe(true)
    if (!decision.ok) return
    expect(decision.close.deliveredAt).toBe('2026-11-18T07:05:00.000Z')
    expect(decision.close.pod?.recipientName).toBe('مریم')
  })
})

describe('decideDeliveryAttempt — what it refuses', () => {
  const refused = (decision: ReturnType<typeof decideDeliveryAttempt>): readonly string[] =>
    decision.ok ? [] : decision.issues

  it('refuses a parcel that is already delivered', () => {
    const decision = decideDeliveryAttempt(
      onTheRoad({ status: 'delivered' }),
      { outcome: 'delivered', pod: signature() },
      AT,
    )
    expect(refused(decision)).toEqual(['DELIVERY_ALREADY_CLOSED'])
  })

  it('refuses a parcel that came back', () => {
    const decision = decideDeliveryAttempt(
      onTheRoad({ status: 'returned' }),
      { outcome: 'failed', failureReason: 'مشتری نبود' },
      AT,
    )
    expect(refused(decision)).toEqual(['DELIVERY_ALREADY_CLOSED'])
  })

  it('refuses a proof that names nobody', () => {
    const decision = decideDeliveryAttempt(
      onTheRoad(),
      { outcome: 'delivered', pod: signature({ recipientName: '   ' }) },
      AT,
    )
    expect(refused(decision)).toEqual(['POD_RECIPIENT_REQUIRED'])
  })

  it('refuses a photo method with no photo', () => {
    const decision = decideDeliveryAttempt(
      onTheRoad(),
      { outcome: 'delivered', pod: signature({ method: 'photo', photoRef: null }) },
      AT,
    )
    expect(refused(decision)).toEqual(['POD_PHOTO_REF_REQUIRED'])
  })

  it('refuses the code method when no code was ever issued', () => {
    const decision = decideDeliveryAttempt(
      onTheRoad({ podCode: null }),
      { outcome: 'delivered', pod: signature({ method: 'code', code: '1234' }) },
      AT,
    )
    expect(refused(decision)).toEqual(['POD_CODE_REQUIRED'])
  })

  it('refuses a code that does not match the one the customer was given', () => {
    const decision = decideDeliveryAttempt(
      onTheRoad({ podCode: '4821' }),
      { outcome: 'delivered', pod: signature({ method: 'code', code: '4822' }) },
      AT,
    )
    expect(refused(decision)).toEqual(['POD_CODE_MISMATCH'])
  })

  it('accepts the matching code', () => {
    const decision = decideDeliveryAttempt(
      onTheRoad({ podCode: '4821' }),
      { outcome: 'delivered', pod: signature({ method: 'code', code: '4821' }) },
      AT,
    )
    expect(decision.ok).toBe(true)
  })

  it('refuses collecting more than was due', () => {
    const decision = decideDeliveryAttempt(
      onTheRoad(),
      { outcome: 'delivered', pod: signature(), collectedMinor: 25_001 },
      AT,
    )
    expect(refused(decision)).toEqual(['COD_COLLECTED_EXCEEDS_DUE'])
  })

  it('refuses a negative or fractional collection', () => {
    expect(
      refused(
        decideDeliveryAttempt(
          onTheRoad(),
          { outcome: 'delivered', pod: signature(), collectedMinor: -1 },
          AT,
        ),
      ),
    ).toEqual(['COD_AMOUNT_INVALID'])
    expect(
      refused(
        decideDeliveryAttempt(
          onTheRoad(),
          { outcome: 'delivered', pod: signature(), collectedMinor: 100.5 },
          AT,
        ),
      ),
    ).toEqual(['COD_AMOUNT_INVALID'])
  })

  it('refuses cash on a delivery that had none to collect', () => {
    const decision = decideDeliveryAttempt(
      onTheRoad({ codAmountMinor: 0 }),
      { outcome: 'delivered', pod: signature(), collectedMinor: 5_000 },
      AT,
    )
    expect(refused(decision)).toEqual(['COD_COLLECTED_WITHOUT_COD'])
  })

  it('reports every problem at once instead of one per attempt', () => {
    const decision = decideDeliveryAttempt(
      onTheRoad(),
      {
        outcome: 'delivered',
        pod: { method: 'photo', recipientName: '' },
        collectedMinor: 99_999,
      },
      AT,
    )
    expect(refused(decision)).toEqual([
      'POD_RECIPIENT_REQUIRED',
      'POD_PHOTO_REF_REQUIRED',
      'COD_COLLECTED_EXCEEDS_DUE',
    ])
  })
})

describe('decideDeliveryAttempt — failed', () => {
  it('is not a delivery: no recipient, no proof, no timestamp, no money', () => {
    const decision = decideDeliveryAttempt(
      onTheRoad(),
      { outcome: 'failed', failureReason: '  مشتری در خانه نبود ' },
      AT,
    )

    expect(decision.ok).toBe(true)
    if (!decision.ok) return
    expect(decision.close.status).toBe('failed')
    expect(decision.close.pod).toBeNull()
    expect(decision.close.deliveredAt).toBeNull()
    expect(decision.close.collectedMinor).toBe(0)
    expect(decision.close.shortfallMinor).toBe(0)
    // The money is still where it was: collected by nobody.
    expect(decision.close.codStage).toBe('with_driver')
    expect(decision.close.failureReason).toBe('مشتری در خانه نبود')
  })

  it('refuses a failure with no reason', () => {
    const decision = decideDeliveryAttempt(
      onTheRoad(),
      { outcome: 'failed', failureReason: ' ' },
      AT,
    )
    expect(decision.ok).toBe(false)
    if (decision.ok) return
    expect(decision.issues).toEqual(['FAILURE_REASON_REQUIRED'])
  })
})

describe('vehicleServiceState — service is a fact, not a default', () => {
  it('says unknown when no service was ever recorded', () => {
    expect(vehicleServiceState(null, '2026-11-18')).toBe('unknown')
    expect(vehicleServiceState('', '2026-11-18')).toBe('unknown')
  })

  it('is overdue the day after the due date', () => {
    expect(vehicleServiceState('2026-11-17', '2026-11-18')).toBe('overdue')
  })

  it('is due soon inside the window, including its last day', () => {
    expect(vehicleServiceState('2026-11-18', '2026-11-18')).toBe('due_soon')
    expect(vehicleServiceState('2026-11-22', '2026-11-18')).toBe('due_soon')
    // Exactly 7 days out is still «due soon».
    expect(vehicleServiceState('2026-11-25', '2026-11-18')).toBe('due_soon')
  })

  it('is ok one day past the window', () => {
    expect(vehicleServiceState('2026-11-26', '2026-11-18')).toBe('ok')
  })
})

describe('dispatchIssues — who may take the parcel', () => {
  const vehicle = {
    active: true,
    capacityParcels: 6 as number | null,
    nextServiceDueOn: '2027-03-01' as string | null,
  }

  it('allows a healthy vehicle with room left', () => {
    expect(dispatchIssues({ vehicle, assignedOnDate: 5, asOf: '2026-11-18' })).toEqual([])
  })

  it('refuses a vehicle whose service is overdue', () => {
    expect(
      dispatchIssues({
        vehicle: { ...vehicle, nextServiceDueOn: '2026-11-01' },
        assignedOnDate: 0,
        asOf: '2026-11-18',
      }),
    ).toEqual(['VEHICLE_SERVICE_OVERDUE'])
  })

  it('allows a vehicle nobody has serviced, because unknown is not overdue', () => {
    expect(
      dispatchIssues({
        vehicle: { ...vehicle, nextServiceDueOn: null },
        assignedOnDate: 0,
        asOf: '2026-11-18',
      }),
    ).toEqual([])
  })

  it('refuses an inactive vehicle', () => {
    expect(
      dispatchIssues({
        vehicle: { ...vehicle, active: false },
        assignedOnDate: 0,
        asOf: '2026-11-18',
      }),
    ).toEqual(['VEHICLE_INACTIVE'])
  })

  it('refuses the seventh parcel of a six-parcel van', () => {
    expect(dispatchIssues({ vehicle, assignedOnDate: 6, asOf: '2026-11-18' })).toEqual([
      'VEHICLE_AT_CAPACITY',
    ])
  })

  it('never invents a capacity that was not declared', () => {
    expect(
      dispatchIssues({
        vehicle: { ...vehicle, capacityParcels: null },
        assignedOnDate: 40,
        asOf: '2026-11-18',
      }),
    ).toEqual([])
  })

  it('reports both reasons when both hold', () => {
    expect(
      dispatchIssues({
        vehicle: { active: false, capacityParcels: 1, nextServiceDueOn: '2026-01-01' },
        assignedOnDate: 1,
        asOf: '2026-11-18',
      }),
    ).toEqual(['VEHICLE_INACTIVE', 'VEHICLE_SERVICE_OVERDUE', 'VEHICLE_AT_CAPACITY'])
  })
})
