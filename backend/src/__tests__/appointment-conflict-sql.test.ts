// ============================================
// BUG-NEW-011: the booking overlap is decided by a filtered query, not by a
// read of every appointment (which PostgREST cuts at 1000 rows, oldest first).
//
// The earlier version of this file only asserted that a method exists. These
// tests drive the real service against a scripted table and check the filters
// that reach it and what happens on a clash.
// ============================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { AppointmentService } from '../services/crm/appointment.service'

const WS = '11111111-1111-4111-8111-111111111111'
const STAFF = '22222222-2222-4222-8222-222222222222'

const INPUT = {
  customerId: '33333333-3333-4333-8333-333333333333',
  staffEmployeeId: STAFF,
  serviceProductId: '44444444-4444-4444-8444-444444444444',
  startTime: '2026-11-02T10:00:00.000Z',
  endTime: '2026-11-02T11:00:00.000Z',
}

function fakeDb(conflicts: unknown[], insertError: { code: string } | null = null) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'neq', 'lt', 'gt', 'insert', 'order']) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return chain
    }
  }
  chain.single = () =>
    Promise.resolve(
      insertError
        ? { data: null, error: insertError }
        : { data: { id: 'new-appointment' }, error: null },
    )
  // The conflict query is awaited directly (no .single()).
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: conflicts, error: null }).then(resolve)
  const db = { from: () => chain } as unknown as SupabaseClient
  return { db, calls }
}

describe('BUG-NEW-011: appointment overlap is checked in the query', () => {
  it('asks only for this staff member and the overlapping window', async () => {
    const { db, calls } = fakeDb([])
    await new AppointmentService(db).createAppointment(WS, INPUT)

    const args = (method: string) => calls.filter((c) => c.method === method).map((c) => c.args)
    expect(args('eq')).toContainEqual(['workspace_id', WS])
    expect(args('eq')).toContainEqual(['staff_employee_id', STAFF])
    expect(args('neq')).toContainEqual(['status', 'cancelled'])
    // existing.start < new.end AND existing.end > new.start
    expect(args('lt')).toContainEqual(['start_time', INPUT.endTime])
    expect(args('gt')).toContainEqual(['end_time', INPUT.startTime])
  })

  it('books when nothing overlaps', async () => {
    const { db, calls } = fakeDb([])
    await new AppointmentService(db).createAppointment(WS, INPUT)
    expect(calls.some((c) => c.method === 'insert')).toBe(true)
  })

  it('refuses a clash with a coded error and inserts nothing', async () => {
    const { db, calls } = fakeDb([{ id: 'existing' }])

    const error = await new AppointmentService(db)
      .createAppointment(WS, INPUT)
      .catch((e: unknown) => e as { code?: string; message?: string })

    expect(error).toMatchObject({ code: 'APPOINTMENT_CONFLICT' })
    expect(calls.some((c) => c.method === 'insert')).toBe(false)
  })

  it('a booking that loses the race to the database constraint is the same clash', async () => {
    // The check found nothing, the insert met the exclusion constraint (23P01).
    const { db } = fakeDb([], { code: '23P01' })
    const error = await new AppointmentService(db)
      .createAppointment(WS, INPUT)
      .catch((e: unknown) => e as { code?: string })
    expect(error).toMatchObject({ code: 'APPOINTMENT_CONFLICT' })
  })
})
