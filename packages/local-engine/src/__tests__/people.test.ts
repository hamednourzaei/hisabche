// The people side on the device: employees, leaves, payroll, shifts, the shift
// plan and the attendance sheet. Every assertion is on the SERVER's shape and
// rule — the engine calls the same functions (@hisabche/validation) the backend
// does, so these tests fail if the device ever answers differently.
import { describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import { createTestDb, TEST_WORKSPACE_ID } from './test-db'

type Json = Record<string, any>

function setup() {
  const db = createTestDb()
  const engine = createLocalEngine(db)
  const call = async (method: any, path: string, body?: unknown) => {
    const res = await engine.request<Json>({
      method,
      path,
      ...(body === undefined ? {} : { body }),
    })
    return res
  }
  return { db, engine, call }
}

async function seedEmployee(call: ReturnType<typeof setup>['call'], over: Json = {}) {
  const branch = await call('POST', '/branches', { code: 'B1', name: 'مرکز' })
  expect(branch.status).toBe(201)
  const res = await call('POST', '/employees', {
    employeeCode: 'E-1',
    firstName: 'احمد',
    lastName: 'کریمی',
    hireDate: '2026-01-01',
    salary: 1500,
    branchId: branch.data.id,
    ...over,
  })
  expect(res.status).toBe(201)
  return { employee: res.data, branchId: branch.data.id as string }
}

describe('employees (offline)', () => {
  it('creates, lists, reads, edits and deactivates in the server shape', async () => {
    const { call } = setup()
    const { employee, branchId } = await seedEmployee(call)

    expect(employee).toMatchObject({
      employee_code: 'E-1',
      first_name: 'احمد',
      last_name: 'کریمی',
      hire_date: '2026-01-01',
      salary: 1500,
      salary_currency: 'AFN',
      status: 'active',
      department: null,
    })

    const list = await call('GET', '/employees')
    expect(list.data.total).toBe(1)
    expect(list.data.employees[0].first_name).toBe('احمد')

    const detail = await call('GET', `/employees/${employee.id}`)
    expect(detail.data.branches).toEqual([
      expect.objectContaining({ branchId, branchName: 'مرکز', isPrimary: true }),
    ])

    const patched = await call('PATCH', `/employees/${employee.id}`, {
      position: 'حسابدار',
      salary: 1800,
    })
    expect(patched.status).toBe(200)
    expect(patched.data).toMatchObject({ position: 'حسابدار', salary: 1800 })

    const gone = await call('DELETE', `/employees/${employee.id}`)
    expect(gone.data).toEqual({ id: employee.id })
    expect(
      (await call('DELETE', `/employees/${'9b2f4c1e-0000-4000-8000-000000000001'}`)).status,
    ).toBe(404)
  })

  it('refuses a branch that is not there, and a terminal credential out loud', async () => {
    const { call } = setup()
    const base = {
      employeeCode: 'E-2',
      firstName: 'ع',
      lastName: 'ب',
      hireDate: '2026-01-01',
    }
    const noBranch = await call('POST', '/employees', {
      ...base,
      branchId: '9b2f4c1e-0000-4000-8000-000000000001',
    })
    expect(noBranch.status).toBe(404)

    const branch = await call('POST', '/branches', { code: 'B1', name: 'م' })
    const credential = await call('POST', '/employees', {
      ...base,
      branchId: branch.data.id,
      attendanceMethod: 'fingerprint',
    })
    expect(credential.status).toBe(400)
    expect(credential.data.message).toContain('EMPLOYEE_ATTENDANCE_CREDENTIAL_OFFLINE')
    expect((await call('GET', '/employees')).data.total).toBe(0)
  })

  it('shows a row cached before v5 by its full name instead of inventing a split', async () => {
    const { db, call } = setup()
    db.run(
      `INSERT INTO employee (id, workspace_id, full_name, salary, is_active, created_at, updated_at)
       VALUES ('9b2f4c1e-0000-4000-8000-0000000000aa', ?, 'نام قدیمی', 0, 1, 'x', 'x')`,
      [TEST_WORKSPACE_ID],
    )
    const list = await call('GET', '/employees')
    expect(list.data.employees[0]).toMatchObject({ first_name: 'نام قدیمی', last_name: '' })
  })
})

describe('leaves (offline)', () => {
  it('computes the days, takes the branch from the posting on the day, and is decided once', async () => {
    const { call } = setup()
    const { employee, branchId } = await seedEmployee(call)

    const created = await call('POST', '/leaves', {
      employeeId: employee.id,
      leaveType: 'annual',
      startDate: '2026-03-01T00:00:00.000Z',
      endDate: '2026-03-03T00:00:00.000Z',
    })
    expect(created.status).toBe(201)
    expect(created.data).toMatchObject({ total_days: 3, status: 'pending' })

    // Before the assignment started there is no branch to claim: unknown stays unknown.
    const list = await call('GET', `/leaves?employeeId=${employee.id}`)
    expect(list.data).toHaveLength(1)
    expect(list.data[0].employee).toEqual({ first_name: 'احمد', last_name: 'کریمی' })
    expect(branchId).toBeTruthy()

    const approved = await call('PATCH', `/leaves/${created.data.id}`, { status: 'approved' })
    expect(approved.data).toMatchObject({ status: 'approved' })
    expect(approved.data.approved_by).toBeTruthy()

    const again = await call('PATCH', `/leaves/${created.data.id}`, { status: 'rejected' })
    expect(again.status).toBe(409)
    expect(again.data.code).toBe('LEAVE_ALREADY_DECIDED')
  })
})

describe('payroll (offline)', () => {
  const salary = {
    periodStart: '2026-03-01T00:00:00.000Z',
    periodEnd: '2026-03-31T00:00:00.000Z',
    baseSalary: 1000,
    bonuses: 100,
    deductions: 50,
    overtimeHours: 10,
    overtimeRate: 5,
    taxAmount: 40,
  }

  it('computes the same figures as the server and books a paid salary in balance', async () => {
    const { db, call } = setup()
    const { employee } = await seedEmployee(call)

    const draft = await call('POST', '/payrolls', { ...salary, employeeId: employee.id })
    expect(draft.status).toBe(201)
    // overtime 10 × 5 = 50; net = 1000 + 100 + 50 − 50 − 40
    expect(draft.data).toMatchObject({ overtime_amount: 50, net_salary: 1060, status: 'draft' })
    expect(db.all("SELECT id FROM journal_entry WHERE source_type = 'payroll'")).toHaveLength(0)

    const paid = await call('PATCH', `/payrolls/${draft.data.id}`, { status: 'paid' })
    expect(paid.data.status).toBe('paid')
    expect(paid.data.payment_date).toBeTruthy()

    const lines = db.all<{ debit: number; credit: number; role: string }>(
      `SELECT l.debit, l.credit, a.role FROM journal_line l
         JOIN journal_entry e ON e.id = l.journal_id
         JOIN account a ON a.id = l.account_id
        WHERE e.source_type = 'payroll'`,
    )
    const debit = lines.reduce((sum, line) => sum + line.debit, 0)
    const credit = lines.reduce((sum, line) => sum + line.credit, 0)
    expect(debit).toBe(1150) // gross: base + bonuses + overtime
    expect(credit).toBe(1150)
    expect(lines.find((line) => line.role === 'salary_expense')?.debit).toBe(1150)
    expect(lines.find((line) => line.role === 'tax')?.credit).toBe(40)
    expect(lines.find((line) => line.role === 'payable')?.credit).toBe(50)
    expect(lines.find((line) => line.role === 'cash')?.credit).toBe(1060)
  })

  it('books a salary recorded as paid from the start, once', async () => {
    const { db, call } = setup()
    const { employee } = await seedEmployee(call)
    const paid = await call('POST', '/payrolls', {
      ...salary,
      employeeId: employee.id,
      status: 'paid',
      paymentDate: '2026-04-01T00:00:00.000Z',
    })
    expect(paid.status).toBe(201)
    expect(db.all("SELECT id FROM journal_entry WHERE source_type = 'payroll'")).toHaveLength(1)
  })

  it('asks why a salary was not paid, and never moves a paid one back', async () => {
    const { call } = setup()
    const { employee } = await seedEmployee(call)
    const draft = await call('POST', '/payrolls', { ...salary, employeeId: employee.id })

    const noReason = await call('PATCH', `/payrolls/${draft.data.id}`, { status: 'cancelled' })
    expect(noReason.status).toBe(400)
    expect(noReason.data.message).toContain('PAYROLL_REASON_REQUIRED')

    await call('PATCH', `/payrolls/${draft.data.id}`, { status: 'paid' })
    const back = await call('PATCH', `/payrolls/${draft.data.id}`, {
      status: 'cancelled',
      notes: 'why',
    })
    expect(back.status).toBe(409)
    expect(back.data.code).toBe('PAYROLL_ALREADY_PAID')
  })

  it('sums the net of what was not cancelled, per employee', async () => {
    const { call } = setup()
    const { employee } = await seedEmployee(call)
    const a = await call('POST', '/payrolls', { ...salary, employeeId: employee.id })
    const b = await call('POST', '/payrolls', { ...salary, employeeId: employee.id })
    await call('PATCH', `/payrolls/${b.data.id}`, { status: 'cancelled', notes: 'duplicate' })

    const summary = await call('GET', '/payrolls/summary')
    expect(summary.data.total).toBe(1060)
    expect(summary.data.byEmployee[employee.id]).toBe(1060)
    const list = await call('GET', '/payrolls')
    expect(list.data.map((row: Json) => row.id).sort()).toEqual([a.data.id, b.data.id].sort())
    expect(list.data[0].employee).toEqual({ first_name: 'احمد', last_name: 'کریمی' })
  })
})

describe('shifts and the shift plan (offline)', () => {
  it('validates a shift, refuses a taken name, retires instead of deleting', async () => {
    const { call } = setup()
    const bad = await call('POST', '/shifts', { name: 'x', startsAt: '08:00', endsAt: '08:00' })
    expect(bad.status).toBe(400)
    expect(bad.data.message).toBe('SHIFT_INVALID_TIMES')

    const made = await call('POST', '/shifts', {
      name: 'صبح',
      startsAt: '08:00',
      endsAt: '16:00',
      breakMinutes: 60,
    })
    expect(made.status).toBe(201)
    expect(made.data).toMatchObject({ payableHours: 7, isActive: true })

    const dup = await call('POST', '/shifts', { name: 'صبح', startsAt: '09:00', endsAt: '10:00' })
    expect(dup.status).toBe(409)
    expect(dup.data.code).toBe('SHIFT_NAME_TAKEN')

    const retired = await call('PATCH', `/shifts/${made.data.id}/active`, { isActive: false })
    expect(retired.data.isActive).toBe(false)
    expect((await call('GET', '/shifts')).data.shifts).toHaveLength(1)
  })

  it('plans all days or none, refuses overlap and a retired shift, and cancels', async () => {
    const { call } = setup()
    const { employee } = await seedEmployee(call)
    const morning = (
      await call('POST', '/shifts', { name: 'صبح', startsAt: '08:00', endsAt: '16:00' })
    ).data
    const overlap = (
      await call('POST', '/shifts', { name: 'ظهر', startsAt: '12:00', endsAt: '20:00' })
    ).data

    const planned = await call('POST', '/shift-assignments', {
      employeeId: employee.id,
      shiftId: morning.id,
      fromDate: '2026-03-01',
      days: 3,
    })
    expect(planned.data.planned).toEqual(['2026-03-01', '2026-03-02', '2026-03-03'])

    // A range that hits an overlap on its second day plans nothing.
    const clash = await call('POST', '/shift-assignments', {
      employeeId: employee.id,
      shiftId: overlap.id,
      fromDate: '2026-02-28',
      days: 3,
    })
    expect(clash.status).toBe(409)
    expect(clash.data.code).toBe('SHIFT_ASSIGNMENT_OVERLAP')
    expect((await call('GET', '/shift-assignments?date=2026-02-28')).data.assignments).toHaveLength(
      0,
    )

    await call('PATCH', `/shifts/${overlap.id}/active`, { isActive: false })
    const retired = await call('POST', '/shift-assignments', {
      employeeId: employee.id,
      shiftId: overlap.id,
      fromDate: '2026-04-01',
      days: 1,
    })
    expect(retired.data.message).toBe('SHIFT_ASSIGNMENT_SHIFT_RETIRED')

    const day = await call('GET', '/shift-assignments?date=2026-03-01')
    // Planned, nothing recorded: not «absent».
    expect(day.data.assignments[0]).toMatchObject({ actual: 'unrecorded', shiftName: 'صبح' })
    expect(day.data.summary).toEqual({ planned: 1, worked: 0, absent: 0, unrecorded: 1 })

    const cancelled = await call('POST', `/shift-assignments/${day.data.assignments[0].id}/cancel`)
    expect(cancelled.status).toBe(200)
    expect((await call('GET', '/shift-assignments?date=2026-03-01')).data.assignments).toHaveLength(
      0,
    )
  })
})

describe('the attendance sheet (offline)', () => {
  it('keeps «not recorded» apart from «absent» and gives an open day no hours', async () => {
    const { call } = setup()
    const { employee } = await seedEmployee(call)
    await call('POST', '/branches', { code: 'B2', name: 'دوم' })

    const empty = await call('GET', '/attendance-sheet?date=2026-03-01')
    expect(empty.data.rows[0]).toMatchObject({
      employeeId: employee.id,
      name: 'احمد کریمی',
      record: null,
    })
    expect(empty.data.summary).toMatchObject({ employees: 1, recorded: 0, absent: 0 })

    const open = await call('PUT', '/attendance-sheet', {
      employeeId: employee.id,
      date: '2026-03-01',
      status: 'present',
      checkIn: '08:00',
    })
    expect(open.data.result).toMatchObject({ workedHours: null, isOpen: true })

    // The same day is corrected, not duplicated.
    const closed = await call('PUT', '/attendance-sheet', {
      employeeId: employee.id,
      date: '2026-03-01',
      status: 'present',
      checkIn: '08:00',
      checkOut: '16:30',
    })
    expect(closed.data.result.workedHours).toBe(8.5)
    const sheet = await call('GET', '/attendance-sheet?date=2026-03-01')
    expect(sheet.data.summary).toMatchObject({ recorded: 1, present: 1, open: 0 })
  })

  it('refuses an exit before the entry unless the night is said out loud', async () => {
    const { call } = setup()
    const { employee } = await seedEmployee(call)
    const body = {
      employeeId: employee.id,
      date: '2026-03-01',
      status: 'present',
      checkIn: '22:00',
      checkOut: '06:00',
    }
    const typo = await call('PUT', '/attendance-sheet', body)
    expect(typo.status).toBe(400)
    expect(typo.data.message).toBe('ATTENDANCE_CHECK_OUT_BEFORE_CHECK_IN')

    const night = await call('PUT', '/attendance-sheet', { ...body, endsNextDay: true })
    expect(night.data.result.workedHours).toBe(8)

    const absent = await call('PUT', '/attendance-sheet', {
      employeeId: employee.id,
      date: '2026-03-02',
      status: 'absent',
      checkIn: '08:00',
    })
    // Times belong to a day at work: dropped by rule on an absent day.
    expect(absent.data).toMatchObject({ checkIn: null, status: 'absent' })

    const unknown = await call('PUT', '/attendance-sheet', {
      ...body,
      employeeId: '9b2f4c1e-0000-4000-8000-000000000001',
      endsNextDay: true,
    })
    expect(unknown.status).toBe(404)
  })

  it('shows what the plan said beside what was recorded', async () => {
    const { call } = setup()
    const { employee } = await seedEmployee(call)
    const shift = (
      await call('POST', '/shifts', { name: 'صبح', startsAt: '08:00', endsAt: '16:00' })
    ).data
    await call('POST', '/shift-assignments', {
      employeeId: employee.id,
      shiftId: shift.id,
      fromDate: '2026-03-01',
      days: 1,
    })
    await call('PUT', '/attendance-sheet', {
      employeeId: employee.id,
      date: '2026-03-01',
      status: 'absent',
    })
    const day = await call('GET', '/shift-assignments?date=2026-03-01')
    expect(day.data.assignments[0].actual).toBe('absent')
    expect(day.data.summary.absent).toBe(1)
  })
})

describe('what undoing this does (offline)', () => {
  it('answers from the same table, and an unknown route is a warning, not a default', async () => {
    const { call } = setup()
    const known = await call('GET', '/compensation?route=POST%20/payments/:id/cancel')
    expect(known.data).toMatchObject({ plan: { strategy: 'none', needsHuman: true }, warn: true })
    const unknown = await call('GET', '/compensation?route=GET%20/nothing')
    expect(unknown.data).toEqual({ route: 'GET /nothing', plan: null, warn: true })
    expect((await call('GET', '/compensation')).status).toBe(400)
  })
})
