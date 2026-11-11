// ============================================
// V54 5.5 (7 Nov 2026) — «حاضر شد» / «نیامد» on a booked session, on the device.
//
// Real SQLite (the engine's own test db). Proves: the move is written once, a
// repeat is a replay that queues nothing new, a move the table forbids is
// refused with the server's code, and delivery/cancellation cannot be reached
// through this door.
// ============================================

import { describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, TEST_WORKSPACE_ID, TEST_USER_ID } from './test-db'
import type { ServiceDeliverySession } from '@hisabche/validation'

const ws = TEST_WORKSPACE_ID
const custId = '44444444-4444-4444-8444-444444444444'
const serviceOfferingId = '55555555-5555-4555-8555-555555555555'
const headers = {
  'x-workspace-id': ws,
  'x-user-id': TEST_USER_ID,
  'x-user-role': 'owner',
  'x-hisabche-queue': '1',
}

async function booked() {
  const db = createTestDb()
  const engine = createTestEngine(db)
  db.run(
    `INSERT OR REPLACE INTO customer (id, workspace_id, full_name, phone, created_at, updated_at)
     VALUES (?, ?, 'Zahra', '0799887766', '2026-11-01', '2026-11-01')`,
    [custId, ws],
  )
  db.run(
    `INSERT OR REPLACE INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, offering_type, updated_at)
     VALUES (?, ?, 'Gel polish', 0, 1500, 0, 1, 'service', '2026-11-01')`,
    [serviceOfferingId, ws],
  )
  const created = await engine.request<ServiceDeliverySession>({
    method: 'POST',
    path: '/service-delivery/sessions',
    body: {
      workspaceId: ws,
      customerId: custId,
      serviceOfferingId,
      sessionDate: '2026-11-08',
      startTime: '10:00',
      endTime: '11:00',
      settlementMethod: 'complementary',
    },
    headers,
  })
  expect(created.status).toBe(201)
  const queued = () => db.get<{ n: number }>(`SELECT count(*) AS n FROM sync_queue`)?.n ?? 0
  const status = () =>
    db.get<{ status: string }>(`SELECT status FROM service_delivery_sessions WHERE id = ?`, [
      created.data.id,
    ])?.status
  return { engine, id: created.data.id, queued, status }
}

describe('session status move on the device', () => {
  it('check-in moves scheduled → in_progress once; a repeat queues nothing new', async () => {
    const { engine, id, queued, status } = await booked()
    const before = queued()

    const first = await engine.request<{ replayed: boolean; session: ServiceDeliverySession }>({
      method: 'POST',
      path: `/service-delivery/sessions/${id}/status`,
      body: { to: 'in_progress' },
      headers,
    })
    expect(first.status).toBe(200)
    expect(first.data.replayed).toBe(false)
    expect(status()).toBe('in_progress')
    expect(queued()).toBe(before + 1)

    const again = await engine.request<{ replayed: boolean }>({
      method: 'POST',
      path: `/service-delivery/sessions/${id}/status`,
      body: { to: 'in_progress' },
      headers,
    })
    expect(again.status).toBe(200)
    expect(again.data.replayed).toBe(true)
    expect(queued()).toBe(before + 1)
  })

  it('checked_in then in_progress writes status audit entries once and replays cleanly', async () => {
    const { engine, id, queued, status } = await booked()
    const before = queued()

    const checkedIn = await engine.request<{ replayed: boolean; session: ServiceDeliverySession }>({
      method: 'POST',
      path: `/service-delivery/sessions/${id}/status`,
      body: { to: 'checked_in' },
      headers,
    })
    expect(checkedIn.status).toBe(200)
    expect(checkedIn.data.replayed).toBe(false)
    expect(checkedIn.data.session.status).toBe('checked_in')
    expect(status()).toBe('checked_in')
    expect(queued()).toBe(before + 1)

    const inProgress = await engine.request<{ replayed: boolean; session: ServiceDeliverySession }>(
      {
        method: 'POST',
        path: `/service-delivery/sessions/${id}/status`,
        body: { to: 'in_progress' },
        headers,
      },
    )
    expect(inProgress.status).toBe(200)
    expect(inProgress.data.replayed).toBe(false)
    expect(inProgress.data.session.status).toBe('in_progress')
    expect(status()).toBe('in_progress')
    expect(queued()).toBe(before + 2)

    const replay = await engine.request<{ replayed: boolean }>({
      method: 'POST',
      path: `/service-delivery/sessions/${id}/status`,
      body: { to: 'in_progress' },
      headers,
    })
    expect(replay.status).toBe(200)
    expect(replay.data.replayed).toBe(true)
    expect(queued()).toBe(before + 2)
  })

  it('no-show from a booked session; then check-in is refused with the server code', async () => {
    const { engine, id, status } = await booked()
    const noShow = await engine.request({
      method: 'POST',
      path: `/service-delivery/sessions/${id}/status`,
      body: { to: 'no_show' },
      headers,
    })
    expect(noShow.status).toBe(200)
    expect(status()).toBe('no_show')

    const late = await engine.request<{ error?: string; code?: string; message?: string }>({
      method: 'POST',
      path: `/service-delivery/sessions/${id}/status`,
      body: { to: 'in_progress' },
      headers,
    })
    expect(late.status).toBe(409)
    expect(JSON.stringify(late.data)).toContain('INVALID_STATUS_TRANSITION:no_show->in_progress')
    expect(status()).toBe('no_show')
  })

  it.each(['delivered', 'cancelled', 'scheduled', ''])(
    '«%s» cannot be reached through the status door',
    async (to) => {
      const { engine, id, status } = await booked()
      const res = await engine.request({
        method: 'POST',
        path: `/service-delivery/sessions/${id}/status`,
        body: { to },
        headers,
      })
      expect(res.status).toBe(400)
      expect(JSON.stringify(res.data)).toContain('SESSION_STATUS_MOVE_NOT_ALLOWED')
      expect(status()).toBe('scheduled')
    },
  )
})
