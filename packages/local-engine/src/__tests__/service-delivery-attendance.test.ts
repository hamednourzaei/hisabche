// ============================================
// packages/local-engine/src/__tests__/service-delivery-attendance.test.ts
//
// M4 audit - service delivery is NOT a second attendance system.
//
// Six facts stay separate: employee attendance, practitioner assignment, session scheduling, actual delivery, package
// credit consumption, financial settlement. Delivery only READS the attendance table (to refuse a practitioner who was
// absent or on leave that day) and never writes it. No attendance policy is invented: a missing record, or a session with
// no practitioner, does not block.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import type { LocalDb } from '../db'
import { createTestDb, createTestEngine, TEST_USER_ID, TEST_WORKSPACE_ID } from './test-db'

const ws = TEST_WORKSPACE_ID
const CUST = '44444444-4444-4444-8444-444444444444'
const SERVICE = '55555555-5555-4555-8555-555555555555'
const DOCTOR = '77777777-7777-4777-8777-777777777777'
const headers = { 'x-workspace-id': ws, 'x-user-id': TEST_USER_ID, 'x-user-role': 'owner' }

let db: LocalDb
let engine: ReturnType<typeof createTestEngine>

const attendanceRows = () => db.all<{ n: number }>('SELECT COUNT(*) AS n FROM attendance')[0]!.n
const statusOf = (id: string) =>
  db.all<{ status: string }>('SELECT status FROM service_delivery_sessions WHERE id = ?', [id])[0]!
    .status

function markAttendance(status: string) {
  db.run(
    `INSERT INTO attendance (id, workspace_id, employee_id, date, status, created_at, updated_at)
     VALUES (?, ?, ?, '2026-11-02', ?, '2026-11-02', '2026-11-02')`,
    [`att-${status}`, ws, DOCTOR, status],
  )
}

async function schedule(practitionerId: string | null) {
  const res = await engine.request<{ id: string }>({
    method: 'POST',
    path: '/service-delivery/sessions',
    headers,
    body: {
      workspaceId: ws,
      customerId: CUST,
      serviceOfferingId: SERVICE,
      practitionerId,
      sessionDate: '2026-11-02',
      startTime: '10:00',
      endTime: '11:00',
      settlementMethod: 'complementary',
    },
  })
  expect(res.status, JSON.stringify(res.data)).toBe(201)
  return res.data.id
}

const deliver = (id: string) =>
  engine.request<{ message?: string; error?: string }>({
    method: 'POST',
    path: `/service-delivery/sessions/${id}/deliver`,
    headers,
    body: { settlementMethod: 'complementary', reason: 'attendance test' },
  })

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
  db.run(
    `INSERT OR REPLACE INTO customer (id, workspace_id, full_name, created_at, updated_at) VALUES (?, ?, 'x', '2026-11-01', '2026-11-01')`,
    [CUST, ws],
  )
  db.run(
    `INSERT OR REPLACE INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, offering_type, updated_at)
     VALUES (?, ?, 'x', 0, 1000, 0, 1, 'service', '2026-11-01')`,
    [SERVICE, ws],
  )
  db.run(
    `INSERT OR REPLACE INTO employee (id, workspace_id, full_name, role, is_active, created_at, updated_at)
     VALUES (?, ?, 'Dr', 'Physio', 1, '2026-11-01', '2026-11-01')`,
    [DOCTOR, ws],
  )
})

describe('delivery reads attendance and never writes it', () => {
  it('a practitioner on leave that day: refused, the session stays scheduled', async () => {
    const id = await schedule(DOCTOR)
    markAttendance('leave')
    const res = await deliver(id)
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('PRACTITIONER_ON_LEAVE_ON_SESSION_DATE')
    expect(statusOf(id)).toBe('scheduled')
  })

  it('attendance that CHANGES after the session was scheduled is judged at delivery time', async () => {
    const id = await schedule(DOCTOR)
    markAttendance('present')
    expect(attendanceRows()).toBe(1)
    db.run(`UPDATE attendance SET status = 'absent' WHERE employee_id = ?`, [DOCTOR])
    const res = await deliver(id)
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('PRACTITIONER_ABSENT_ON_SESSION_DATE')
  })

  it('present: delivered, and the attendance table is exactly as it was', async () => {
    const id = await schedule(DOCTOR)
    markAttendance('present')
    expect((await deliver(id)).status).toBe(200)
    expect(attendanceRows()).toBe(1)
    expect(
      db.all<{ status: string }>('SELECT status FROM attendance WHERE employee_id = ?', [
        DOCTOR,
      ])[0]!.status,
    ).toBe('present')
  })

  it('no attendance record yet (not finalized): not blocked, and none is invented', async () => {
    const id = await schedule(DOCTOR)
    expect((await deliver(id)).status).toBe(200)
    expect(attendanceRows()).toBe(0)
  })

  it('no practitioner assigned: not blocked', async () => {
    const id = await schedule(null)
    expect((await deliver(id)).status).toBe(200)
    expect(attendanceRows()).toBe(0)
  })

  it('a delivered session is a delivery fact: later attendance edits do not undo it', async () => {
    const id = await schedule(DOCTOR)
    markAttendance('present')
    await deliver(id)
    db.run(`UPDATE attendance SET status = 'absent' WHERE employee_id = ?`, [DOCTOR])
    expect(statusOf(id)).toBe('delivered')
  })
})
