// ============================================
// packages/local-engine/src/__tests__/offline-courier-delivery.test.ts
//
// WP-19, OFFLINE: a driver with no signal closes a parcel on the phone. The
// proof (or the failure reason) and the COD figures must be the SAME as the
// server would write, because both sides run `decideDeliveryAttempt` from
// @hisabche/validation. A shortfall is a receivable; a failed attempt is not a
// delivery and carries no proof and no money.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, type ClosableLocalDb } from './test-db'

let db: ClosableLocalDb
let engine: ReturnType<typeof createTestEngine>

const VEHICLE_ID = 'e0000000-0000-4000-8000-000000000001'

async function dispatch(input: Record<string, unknown> = {}) {
  const res = await engine.request<{ id: string }>({
    method: 'POST',
    path: '/deliveries/courier',
    body: {
      trackingNumber: 'TRK-OFFLINE-1',
      customerName: 'مشتری آفلاین',
      destinationAddress: 'کابل، سرک ۴',
      codAmountMinor: 25_000,
      ...input,
    },
  })
  expect(res.status, JSON.stringify(res.data)).toBe(201)
  return res.data
}

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('offline courier delivery', () => {
  it('creates a parcel locally as unassigned with COD to collect', async () => {
    const parcel = await dispatch()
    const row = db.get<{ status: string; cod_stage: string; cod_amount_minor: number }>(
      'SELECT status, cod_stage, cod_amount_minor FROM courier_deliveries WHERE id = ?',
      [parcel.id],
    )
    expect(row?.status).toBe('unassigned')
    expect(row?.cod_stage).toBe('to_collect')
    expect(Number(row?.cod_amount_minor)).toBe(25_000)
  })

  it('a repeat of the same create returns the first row (idempotency)', async () => {
    const res = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/deliveries/courier',
      headers: { 'idempotency-key': 'new-parcel-1' },
      body: {
        trackingNumber: 'TRK-OFFLINE-2',
        customerName: 'مشتری',
        destinationAddress: 'کابل',
      },
    })
    expect(res.status).toBe(201)
    const again = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/deliveries/courier',
      headers: { 'idempotency-key': 'new-parcel-1' },
      body: {
        trackingNumber: 'TRK-OFFLINE-2',
        customerName: 'مشتری',
        destinationAddress: 'کابل',
      },
    })
    expect(again.status).toBe(200)
    expect(again.data.id).toBe(res.data.id)
    const count = db.get<{ n: number }>('SELECT COUNT(*) as n FROM courier_deliveries')?.n
    expect(count).toBe(1)
  })

  it('records a partial COD collection as a shortfall, not a forgiven amount', async () => {
    const parcel = await dispatch()
    const res = await engine.request<{
      status: string
      cod_stage: string
      cod_collected_minor: number
      cod_shortfall_minor: number
      pod_method: string
      pod_recipient_name: string
    }>({
      method: 'POST',
      path: `/deliveries/courier/${parcel.id}/close`,
      body: {
        outcome: 'delivered',
        collectedMinor: 24_000,
        pod: { method: 'signature', recipientName: 'احمد' },
      },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(200)
    // 25 000 due, 24 000 collected → 1 000 still owed by the customer.
    expect(Number(res.data.cod_collected_minor)).toBe(24_000)
    expect(Number(res.data.cod_shortfall_minor)).toBe(1_000)
    expect(res.data.status).toBe('delivered')
    expect(res.data.cod_stage).toBe('with_driver')
    expect(res.data.pod_method).toBe('signature')
    expect(res.data.pod_recipient_name).toBe('احمد')
  })

  it('a failed attempt carries no proof, no timestamp and no money', async () => {
    const parcel = await dispatch()
    const res = await engine.request<{
      status: string
      pod_method: string | null
      pod_recipient_name: string | null
      pod_recorded_at: string | null
      cod_collected_minor: number | null
      cod_shortfall_minor: number
      failure_reason: string
    }>({
      method: 'POST',
      path: `/deliveries/courier/${parcel.id}/close`,
      body: { outcome: 'failed', failureReason: 'مشتری در خانه نبود' },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(200)
    expect(res.data.status).toBe('failed')
    expect(res.data.pod_method).toBeNull()
    expect(res.data.pod_recipient_name).toBeNull()
    expect(res.data.pod_recorded_at).toBeNull()
    expect(res.data.cod_collected_minor).toBeNull()
    expect(Number(res.data.cod_shortfall_minor)).toBe(0)
    expect(res.data.failure_reason).toBe('مشتری در خانه نبود')
  })

  it('a failed attempt with no reason is refused, and the row stays open', async () => {
    const parcel = await dispatch()
    const res = await engine.request({
      method: 'POST',
      path: `/deliveries/courier/${parcel.id}/close`,
      body: { outcome: 'failed', failureReason: '   ' },
    })
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('FAILURE_REASON_REQUIRED')
    const row = db.get<{ status: string }>('SELECT status FROM courier_deliveries WHERE id = ?', [
      parcel.id,
    ])
    expect(row?.status).toBe('unassigned')
  })

  it('collecting more than the amount due is refused', async () => {
    const parcel = await dispatch()
    const res = await engine.request({
      method: 'POST',
      path: `/deliveries/courier/${parcel.id}/close`,
      body: {
        outcome: 'delivered',
        collectedMinor: 25_001,
        pod: { method: 'signature', recipientName: 'احمد' },
      },
    })
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('COD_COLLECTED_EXCEEDS_DUE')
  })

  it('a second close with the same key returns the first result', async () => {
    const parcel = await dispatch()
    const first = await engine.request<{ cod_collected_minor: number }>({
      method: 'POST',
      path: `/deliveries/courier/${parcel.id}/close`,
      headers: { 'idempotency-key': 'close-once' },
      body: {
        outcome: 'delivered',
        pod: { method: 'signature', recipientName: 'احمد' },
      },
    })
    expect(first.status).toBe(200)
    const again = await engine.request<{ cod_collected_minor: number }>({
      method: 'POST',
      path: `/deliveries/courier/${parcel.id}/close`,
      headers: { 'idempotency-key': 'close-once' },
      body: { outcome: 'failed', failureReason: 'another attempt' },
    })
    expect(again.status).toBe(200)
    expect(Number(again.data.cod_collected_minor)).toBe(25_000)
    const count = db.get<{ n: number }>('SELECT COUNT(*) as n FROM courier_deliveries')?.n
    expect(count).toBe(1)
  })

  it('the fleet reports service as unknown for a vehicle nobody has serviced', async () => {
    db.run(
      `INSERT INTO delivery_vehicles (id, workspace_id, name, plate_number, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [VEHICLE_ID, '11111111-1111-4111-8111-111111111111', 'کرolla', 'KBL-1', '', ''],
    )
    const res = await engine.request<{
      data: Array<{ service_state: string; assigned_on_date: number }>
    }>({
      method: 'GET',
      path: '/deliveries/fleet',
      params: { onDate: '2026-11-18' },
    })
    expect(res.status).toBe(200)
    const v = res.data.data.find((x) => x.service_state)
    expect(v?.service_state).toBe('unknown')
    expect(v?.assigned_on_date).toBe(0)
  })

  it('refuses to assign a parcel to a vehicle whose service is overdue', async () => {
    db.run(
      `INSERT INTO delivery_vehicles
         (id, workspace_id, name, next_service_due_on, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [VEHICLE_ID, '11111111-1111-4111-8111-111111111111', 'کرolla', '2026-11-01', '', ''],
    )
    const parcel = await dispatch()
    const res = await engine.request({
      method: 'POST',
      path: `/deliveries/courier/${parcel.id}/assign`,
      body: { vehicleId: VEHICLE_ID, plannedOn: '2026-11-18' },
    })
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('VEHICLE_SERVICE_OVERDUE')
  })
})
