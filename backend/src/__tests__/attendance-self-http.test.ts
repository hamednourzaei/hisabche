// ============================================
// An employee's personal attendance link, through the REAL server
// (buildServer + app.inject), so the global auth hook, the public allowlist
// and the rate limiter are all in the path.
//
// The three Postgres functions are modelled below; their own rules are proven
// on a real Postgres in attendance-self-01.pg.test.ts. What is proven HERE is
// everything around them: who may call what, what a link holder can see, what
// the service refuses before the database is asked, and that two workspaces
// never meet.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId, type Row } from './helpers/fake-supabase'

const db = new FakeDatabase()

const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-owner' }
const SELLER = { id: '33333333-3333-4333-8333-333333333333', token: 'token-seller' }
const STRANGER = { id: '22222222-2222-4222-8222-222222222222', token: 'token-stranger' }
const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const AHMAD = 'eeeeeeee-0000-4000-8000-00000000000a'
const TASNIM = 'eeeeeeee-0000-4000-8000-0000000000a2'
const THEIRS = 'eeeeeeee-0000-4000-8000-00000000000b'

const users = new Map<string, { id: string }>([
  [OWNER.token, { id: OWNER.id }],
  [SELLER.token, { id: SELLER.id }],
  [STRANGER.token, { id: STRANGER.id }],
])

vi.mock('../db', () => createFakeDb(db, users))

let app: FastifyInstance

const member = (workspaceId: string, userId: string, role: string) => ({
  id: fakeId('member'),
  workspace_id: workspaceId,
  user_id: userId,
  role,
  has_access: true,
  suspended_at: null,
  joined_at: '2026-01-01T00:00:00Z',
})

function registerFunctions() {
  db.rpc('attendance_link_create', (args: Row) => {
    const employee = db
      .rows('employees')
      .find((row) => row.id === args.p_employee && row.workspace_id === args.p_workspace)
    if (!employee) throw new Error('ATTENDANCE_EMPLOYEE_NOT_FOUND')
    const now = new Date().toISOString()
    for (const row of db.rows('attendance_links')) {
      if (
        row.workspace_id === args.p_workspace &&
        row.employee_id === args.p_employee &&
        row.revoked_at === null
      ) {
        row.revoked_at = now
      }
    }
    const link = {
      id: fakeId('link'),
      workspace_id: args.p_workspace,
      employee_id: args.p_employee,
      token: args.p_token,
      created_by: args.p_user,
      created_at: now,
      expires_at: args.p_expires_at ?? null,
      last_used_at: null,
      revoked_at: null,
      days_back: args.p_days_back,
      auto_apply: args.p_auto_apply,
      time_zone: args.p_time_zone,
    }
    db.seed('attendance_links', [link])
    return [link]
  })

  db.rpc('attendance_submit', (args: Row) => {
    const link = db
      .rows('attendance_links')
      .find((row) => row.id === args.p_link && row.revoked_at === null)
    if (!link) throw new Error('ATTENDANCE_LINK_NOT_FOUND')
    const before = db
      .rows('attendance_submissions')
      .find((row) => row.link_id === link.id && row.client_request_id === args.p_client_request_id)
    if (before) return { id: before.id, state: before.state, replayed: true }

    const present = args.p_status === 'present'
    const taken = db
      .rows('attendance')
      .some(
        (row) =>
          row.workspace_id === link.workspace_id &&
          row.employee_id === link.employee_id &&
          row.date === args.p_date,
      )
    let state = 'pending'
    if (link.auto_apply && !taken) {
      db.seed('attendance', [
        {
          id: fakeId('att'),
          employee_id: link.employee_id,
          date: args.p_date,
          check_in: present ? args.p_check_in : null,
          check_out: present ? args.p_check_out : null,
          status: args.p_status,
          notes: args.p_note,
          user_id: link.created_by,
          workspace_id: link.workspace_id,
          source: 'employee_link',
        },
      ])
      state = 'applied'
    }
    const id = fakeId('sub')
    db.seed('attendance_submissions', [
      {
        id,
        workspace_id: link.workspace_id,
        employee_id: link.employee_id,
        link_id: link.id,
        date: args.p_date,
        status: args.p_status,
        check_in: present ? args.p_check_in : null,
        check_out: present ? args.p_check_out : null,
        note: args.p_note,
        received_at: new Date().toISOString(),
        state,
        decided_by: null,
        decision_note: null,
        client_request_id: args.p_client_request_id,
      },
    ])
    return { id, state, replayed: false }
  })

  db.rpc('attendance_submission_decide', (args: Row) => {
    const row = db
      .rows('attendance_submissions')
      .find(
        (candidate) => candidate.id === args.p_id && candidate.workspace_id === args.p_workspace,
      )
    if (!row) throw new Error('ATTENDANCE_SUBMISSION_NOT_FOUND')
    if (row.state !== 'pending') throw new Error('ATTENDANCE_SUBMISSION_DECIDED')
    if (args.p_decision === 'approve') {
      const existing = db
        .rows('attendance')
        .find(
          (candidate) =>
            candidate.workspace_id === row.workspace_id &&
            candidate.employee_id === row.employee_id &&
            candidate.date === row.date,
        )
      const values = {
        status: row.status,
        check_in: row.check_in,
        check_out: row.check_out,
        source: 'employee_link',
      }
      if (existing) Object.assign(existing, values)
      else {
        db.seed('attendance', [
          {
            id: fakeId('att'),
            employee_id: row.employee_id,
            date: row.date,
            notes: row.note,
            user_id: args.p_user,
            workspace_id: row.workspace_id,
            ...values,
          },
        ])
      }
    }
    row.state = args.p_decision === 'approve' ? 'approved' : 'rejected'
    row.decided_by = args.p_user
    row.decision_note = args.p_note
    return { id: row.id, state: row.state, employeeId: row.employee_id, date: row.date }
  })
}

function resetWorld() {
  db.tables.clear()
  db.failures.clear()
  db.rpcs.clear()
  db.queries.length = 0

  db.seed('workspaces', [
    { id: SHOP, name: 'Kabul Shop', base_currency: 'AFN' },
    { id: OTHER, name: 'Other Shop', base_currency: 'USD' },
  ])
  db.seed('workspace_members', [
    member(SHOP, OWNER.id, 'owner'),
    member(SHOP, SELLER.id, 'employee'),
    member(OTHER, STRANGER.id, 'owner'),
  ])
  db.seed('employees', [
    {
      id: AHMAD,
      workspace_id: SHOP,
      first_name: 'Ahmad',
      last_name: 'Hoi',
      position: 'seller',
      salary: 80_000_000,
      phone: '+93700000001',
      national_id: 'NID-SECRET-1',
      bank_account: 'IBAN-SECRET-1',
    },
    {
      id: TASNIM,
      workspace_id: SHOP,
      first_name: 'Tasnim',
      last_name: 'Hamidi',
      position: 'cashier',
      salary: 70_000_000,
      phone: '+93700000002',
    },
    { id: THEIRS, workspace_id: OTHER, first_name: 'Zed', last_name: 'Elsewhere', position: null },
  ])
  db.seed('attendance', [])
  db.seed('attendance_links', [])
  db.seed('attendance_submissions', [])
  registerFunctions()
}

const as = (user: { token: string }, shop = SHOP) => ({
  authorization: `Bearer ${user.token}`,
  'x-workspace-id': shop,
})

let requestCounter = 0
const requestId = () => `99999999-0000-4000-8000-${String(++requestCounter).padStart(12, '0')}`

async function makeLink(
  body: Record<string, unknown> = {},
  user = OWNER,
  shop = SHOP,
): Promise<{ status: number; body: Row }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/attendance-links',
    headers: as(user, shop),
    payload: { employeeId: AHMAD, timeZone: 'Asia/Kabul', ...body },
  })
  return { status: res.statusCode, body: res.json() }
}

// The public routes are rate-limited per address (30 reads, 10 sends a minute).
// Each call here comes from its own address, so the limiter — proven in its
// own test at the end — never decides the outcome of another test.
let caller = 0
const address = () => `10.${(++caller >> 16) & 255}.${(caller >> 8) & 255}.${caller & 255}`

const publicGet = (token: string) =>
  app.inject({
    method: 'GET',
    url: `/api/public/attendance/${token}`,
    remoteAddress: address(),
  })

const send = (token: string, body: Record<string, unknown>) =>
  app.inject({
    method: 'POST',
    url: `/api/public/attendance/${token}`,
    remoteAddress: address(),
    payload: { clientRequestId: requestId(), ...body },
  })

beforeAll(async () => {
  resetWorld()
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
}, 60_000)

afterAll(async () => {
  await app?.close()
})

beforeEach(() => {
  resetWorld()
})

describe('who may do what', () => {
  it('the link opens with NO Authorization header; every manager route answers 401 without one', async () => {
    const { status, body } = await makeLink()
    expect(status).toBe(201)
    expect(body.token).toMatch(/^[0-9a-f]{64}$/)
    expect(body.state).toBe('active')

    const view = await publicGet(body.token)
    expect(view.statusCode).toBe(200)
    expect(view.headers['cache-control']).toBe('no-store')

    for (const [method, url] of [
      ['GET', `/api/attendance-links?employeeId=${AHMAD}`],
      ['POST', '/api/attendance-links'],
      ['DELETE', `/api/attendance-links/${body.id}`],
      ['GET', '/api/attendance-submissions?date=2026-10-12'],
      ['POST', `/api/attendance-submissions/${body.id}/decision`],
    ] as const) {
      const res = await app.inject({ method, url, ...(method === 'GET' ? {} : { payload: {} }) })
      expect(res.statusCode, `${method} ${url}`).toBe(401)
    }
  })

  it('an ordinary member of the same shop is refused — the sheet belongs to managers', async () => {
    const made = await makeLink()
    for (const [method, url, payload] of [
      ['GET', `/api/attendance-links?employeeId=${AHMAD}`, undefined],
      ['POST', '/api/attendance-links', { employeeId: AHMAD, timeZone: 'Asia/Kabul' }],
      ['DELETE', `/api/attendance-links/${made.body.id}`, undefined],
      ['GET', '/api/attendance-submissions?date=2026-10-12', undefined],
    ] as const) {
      const res = await app.inject({
        method,
        url,
        headers: as(SELLER),
        ...(payload ? { payload } : {}),
      })
      expect(res.statusCode, `${method} ${url}`).toBe(403)
    }
    // …and nothing changed.
    expect(db.rows('attendance_links').filter((row) => row.revoked_at === null).length).toBe(1)
  })

  it('⚠️ two workspaces: a manager of the other shop cannot make, read, revoke or decide', async () => {
    const mine = await makeLink()
    const sent = await send(mine.body.token, {
      date: (await publicGet(mine.body.token)).json().today,
      status: 'absent',
    })
    const submissionId = sent.json().id as string

    // Their manager, in their own workspace, naming our employee and our ids.
    expect((await makeLink({ employeeId: AHMAD }, STRANGER, OTHER)).status).toBe(404)
    const read = await app.inject({
      method: 'GET',
      url: `/api/attendance-links?employeeId=${AHMAD}`,
      headers: as(STRANGER, OTHER),
    })
    expect(read.json()).toEqual({ link: null })
    const revoke = await app.inject({
      method: 'DELETE',
      url: `/api/attendance-links/${mine.body.id}`,
      headers: as(STRANGER, OTHER),
    })
    expect(revoke.statusCode).toBe(404)
    const decide = await app.inject({
      method: 'POST',
      url: `/api/attendance-submissions/${submissionId}/decision`,
      headers: as(STRANGER, OTHER),
      payload: { decision: 'approve' },
    })
    expect(decide.statusCode).toBe(404)

    // Their manager asking for OUR workspace is not a member of it.
    expect((await makeLink({}, STRANGER, SHOP)).status).toBe(403)

    // Ours is exactly as it was.
    expect(
      db.rows('attendance_links').find((row) => row.id === mine.body.id)?.revoked_at,
    ).toBeNull()
    expect(db.rows('attendance_submissions')[0]?.state).toBe('pending')
    expect((await publicGet(mine.body.token)).statusCode).toBe(200)
  })
})

describe('what the link holder sees', () => {
  it('⚠️ a closed list: this person, their days — no pay, phone, id number, or anybody else', async () => {
    const { body } = await makeLink({ daysBack: 2 })
    const res = await publicGet(body.token)
    const view = res.json()

    expect(Object.keys(view).sort()).toEqual(
      [
        'allowedFrom',
        'allowedTo',
        'autoApply',
        'businessName',
        'days',
        'employeeName',
        'now',
        'position',
        'timeZone',
        'today',
      ].sort(),
    )
    expect(view).toMatchObject({
      businessName: 'Kabul Shop',
      employeeName: 'Ahmad Hoi',
      position: 'seller',
      timeZone: 'Asia/Kabul',
      autoApply: false,
    })
    expect(view.allowedTo).toBe(view.today)
    expect(view.days.map((day: Row) => day.date).length).toBe(3)
    expect(view.now).toMatch(/^[0-2][0-9]:[0-5][0-9]$/)

    const raw = res.payload
    for (const secret of [
      '80000000',
      '70000000',
      '+93700000001',
      'NID-SECRET-1',
      'IBAN-SECRET-1',
      'Tasnim',
      'Hamidi',
      TASNIM,
      AHMAD,
      OWNER.id,
      SHOP,
      body.id,
      'salary',
      'phone',
      'workspace',
    ]) {
      expect(raw, secret).not.toContain(secret)
    }
  })

  it('unknown, malformed, revoked and expired links answer the SAME 404', async () => {
    const live = await makeLink()
    await app.inject({
      method: 'DELETE',
      url: `/api/attendance-links/${live.body.id}`,
      headers: as(OWNER),
    })
    const expired = await makeLink()
    db.rows('attendance_links').find((row) => row.id === expired.body.id)!.expires_at =
      '2020-01-01T00:00:00.000Z'

    const answers = await Promise.all([
      publicGet('f'.repeat(64)),
      publicGet('not-a-token'),
      publicGet(live.body.token),
      publicGet(expired.body.token),
    ])
    for (const res of answers) {
      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({
        error: 'ATTENDANCE_LINK_NOT_FOUND',
        code: 'ATTENDANCE_LINK_NOT_FOUND',
      })
    }
    // …and nothing can be sent through them either.
    for (const token of [live.body.token, expired.body.token, 'f'.repeat(64)]) {
      const res = await send(token, { date: '2026-10-12', status: 'absent' })
      expect(res.statusCode).toBe(404)
    }
    expect(db.rows('attendance_submissions').length).toBe(0)
  })

  it('the manager who made the link leaves the shop — the link stops working', async () => {
    const { body } = await makeLink()
    expect((await publicGet(body.token)).statusCode).toBe(200)

    const membership = db
      .rows('workspace_members')
      .find((row) => row.user_id === OWNER.id && row.workspace_id === SHOP)!
    membership.has_access = false
    expect((await publicGet(body.token)).statusCode).toBe(404)

    // Demoted below what making a link needs: the same.
    membership.has_access = true
    membership.role = 'employee'
    expect((await publicGet(body.token)).statusCode).toBe(404)
  })
})

describe('what the employee may send', () => {
  async function linkWith(body: Record<string, unknown> = {}) {
    const made = await makeLink(body)
    const view = (await publicGet(made.body.token)).json()
    return { token: made.body.token as string, today: view.today as string, id: made.body.id }
  }
  const dayBefore = (iso: string, days: number) =>
    new Date(Date.parse(`${iso}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10)

  it('each broken rule is refused with its own code, and nothing is written', async () => {
    const { token, today } = await linkWith({ daysBack: 1 })
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ date: dayBefore(today, -1), status: 'absent' }, 'ATTENDANCE_DATE_IN_FUTURE'],
      [{ date: dayBefore(today, 2), status: 'absent' }, 'ATTENDANCE_DATE_NOT_ALLOWED'],
      [{ date: '2026-02-31', status: 'absent' }, 'ATTENDANCE_DATE_INVALID'],
      [{ date: 'yesterday', status: 'absent' }, 'ATTENDANCE_DATE_INVALID'],
      [{ date: today, status: 'holiday' }, 'ATTENDANCE_STATUS_NOT_ALLOWED'],
      [{ date: today, status: 'open' }, 'ATTENDANCE_STATUS_NOT_ALLOWED'],
      [{ date: today, status: 'present' }, 'ATTENDANCE_CHECK_IN_REQUIRED'],
      [{ date: today, status: 'present', checkIn: '25:00' }, 'ATTENDANCE_TIME_INVALID'],
      [{ date: today, status: 'present', checkIn: '8 am' }, 'ATTENDANCE_TIME_INVALID'],
      [
        { date: today, status: 'present', checkIn: '16:00', checkOut: '08:00' },
        'ATTENDANCE_CHECK_OUT_BEFORE_CHECK_IN',
      ],
      [
        { date: today, status: 'present', checkIn: '08:00', checkOut: '08:00' },
        'ATTENDANCE_CHECK_OUT_BEFORE_CHECK_IN',
      ],
      [{ date: today, status: 'absent', note: 'x'.repeat(501) }, 'ATTENDANCE_NOTE_TOO_LONG'],
    ]
    for (const [body, code] of cases) {
      const res = await send(token, body)
      expect(res.statusCode, code).toBe(400)
      expect(res.json().code, JSON.stringify(body)).toBe(code)
    }
    // A missing request id is a malformed request, not a rule.
    const bare = await app.inject({
      method: 'POST',
      url: `/api/public/attendance/${token}`,
      remoteAddress: address(),
      payload: { date: today, status: 'absent' },
    })
    expect(bare.statusCode).toBe(400)

    expect(db.rows('attendance_submissions').length).toBe(0)
    expect(db.rows('attendance').length).toBe(0)
  })

  it('auto-apply OFF: it waits for a manager, and the sheet has no record', async () => {
    const { token, today } = await linkWith()
    const res = await send(token, {
      date: today,
      status: 'present',
      checkIn: '08:00',
      checkOut: '16:30',
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ state: 'pending', replayed: false })
    expect(db.rows('attendance').length).toBe(0)

    const view = (await publicGet(token)).json()
    expect(view.days[0]).toMatchObject({
      date: today,
      record: null,
      submissions: [{ status: 'present', checkIn: '08:00', checkOut: '16:30', state: 'pending' }],
    })
  })

  it('auto-apply ON and an empty day: the record equals what was sent', async () => {
    const { token, today } = await linkWith({ autoApply: true })
    const res = await send(token, { date: today, status: 'present', checkIn: '08:05' })
    expect(res.json().state).toBe('applied')
    expect(db.rows('attendance')).toMatchObject([
      {
        employee_id: AHMAD,
        workspace_id: SHOP,
        date: today,
        status: 'present',
        check_in: '08:05',
        check_out: null,
        source: 'employee_link',
      },
    ])
    expect((await publicGet(token)).json().days[0].record).toEqual({
      status: 'present',
      checkIn: '08:05',
      checkOut: null,
    })
  })

  it('⚠️ auto-apply ON and a day the manager already recorded: the record does not change', async () => {
    const { token, today } = await linkWith({ autoApply: true })
    const marked = await app.inject({
      method: 'PUT',
      url: '/api/attendance-sheet',
      headers: as(OWNER),
      payload: { employeeId: AHMAD, date: today, status: 'absent' },
    })
    expect(marked.statusCode).toBe(200)

    const res = await send(token, { date: today, status: 'present', checkIn: '08:00' })
    expect(res.json().state).toBe('pending')
    const records = db.rows('attendance')
    expect(records.length).toBe(1)
    expect(records[0]).toMatchObject({ status: 'absent', check_in: null })
    expect(records[0]!.source ?? null).toBeNull()
  })

  it('the same form twice is one submission and one record', async () => {
    const { token, today } = await linkWith({ autoApply: true })
    const clientRequestId = requestId()
    const body = { date: today, status: 'present', checkIn: '09:00', clientRequestId }
    const first = await send(token, body)
    const again = await send(token, body)
    expect(first.statusCode).toBe(201)
    expect(again.statusCode).toBe(200)
    expect(again.json()).toMatchObject({ id: first.json().id, state: 'applied', replayed: true })
    expect(db.rows('attendance_submissions').length).toBe(1)
    expect(db.rows('attendance').length).toBe(1)
  })

  it('Persian and Arabic digits are digits; they are stored ASCII', async () => {
    const { token, today } = await linkWith({ autoApply: true })
    const res = await send(token, {
      date: today,
      status: 'present',
      checkIn: '۰۸:۳۰',
      checkOut: '١٦:٤٥',
    })
    expect(res.statusCode).toBe(201)
    expect(db.rows('attendance')[0]).toMatchObject({ check_in: '08:30', check_out: '16:45' })
  })

  it('on leave there are no times, whatever was typed', async () => {
    const { token, today } = await linkWith({ autoApply: true })
    await send(token, { date: today, status: 'leave', checkIn: '08:00', checkOut: '16:00' })
    expect(db.rows('attendance')[0]).toMatchObject({
      status: 'leave',
      check_in: null,
      check_out: null,
    })
  })
})

describe('the manager and what was sent', () => {
  async function pendingOne(body: Record<string, unknown> = {}) {
    const made = await makeLink()
    const today = (await publicGet(made.body.token)).json().today as string
    const sent = await send(made.body.token, {
      date: today,
      status: 'present',
      checkIn: '07:45',
      checkOut: '15:30',
      ...body,
    })
    return { today, id: sent.json().id as string, token: made.body.token as string }
  }
  const forDay = async (date: string) =>
    (
      await app.inject({
        method: 'GET',
        url: `/api/attendance-submissions?date=${date}`,
        headers: as(OWNER),
      })
    ).json()
  const decide = (id: string, payload: Record<string, unknown>, user = OWNER) =>
    app.inject({
      method: 'POST',
      url: `/api/attendance-submissions/${id}/decision`,
      headers: as(user),
      payload,
    })
  const sheet = async (date: string) =>
    (
      await app.inject({
        method: 'GET',
        url: `/api/attendance-sheet?date=${date}`,
        headers: as(OWNER),
      })
    ).json()

  it('pending is its own number: the counters of the sheet count records only', async () => {
    const { today, id } = await pendingOne()
    const day = await forDay(today)
    expect(day.configured).toBe(true)
    expect(day.pending).toMatchObject([
      { id, employeeId: AHMAD, status: 'present', checkIn: '07:45', checkOut: '15:30' },
    ])
    expect(day.fromLink).toEqual([])
    expect((await sheet(today)).summary).toMatchObject({ employees: 2, recorded: 0, present: 0 })
  })

  it('approve writes the record; the counters move; a second decision is 409 with its code', async () => {
    const { today, id } = await pendingOne()
    const res = await decide(id, { decision: 'approve' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ id, state: 'approved', employeeId: AHMAD, date: today })

    const after = await sheet(today)
    expect(after.summary).toMatchObject({ recorded: 1, present: 1 })
    const row = after.rows.find((candidate: Row) => candidate.employeeId === AHMAD)
    expect(row.record).toMatchObject({ status: 'present', checkIn: '07:45', checkOut: '15:30' })
    // 07:45 → 15:30 is 7 h 45 min.
    expect(row.record.result.workedHours).toBeCloseTo(7.75, 5)

    const day = await forDay(today)
    expect(day.pending).toEqual([])
    expect(day.fromLink).toEqual([AHMAD])

    const again = await decide(id, { decision: 'reject', note: 'changed my mind' })
    expect(again.statusCode).toBe(409)
    expect(again.json().code).toBe('ATTENDANCE_SUBMISSION_DECIDED')
    expect(db.rows('attendance_submissions')[0]?.state).toBe('approved')
  })

  it('reject needs a reason; with one, the sheet stays empty and the employee is told why', async () => {
    const { today, id, token } = await pendingOne()
    for (const payload of [{ decision: 'reject' }, { decision: 'reject', note: '   ' }]) {
      const res = await decide(id, payload)
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe('ATTENDANCE_REJECTION_REASON_REQUIRED')
    }
    expect((await decide(id, { decision: 'maybe' })).statusCode).toBe(400)

    const res = await decide(id, { decision: 'reject', note: 'you were on leave' })
    expect(res.statusCode).toBe(200)
    expect(db.rows('attendance').length).toBe(0)
    expect((await publicGet(token)).json().days[0].submissions[0]).toMatchObject({
      state: 'rejected',
      decisionNote: 'you were on leave',
    })
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('a new link revokes the old one: the old token is dead, the new one works', async () => {
    const first = await makeLink()
    const second = await makeLink({ daysBack: 3, autoApply: true })
    expect((await publicGet(first.body.token)).statusCode).toBe(404)
    expect((await publicGet(second.body.token)).json()).toMatchObject({ autoApply: true })

    const current = await app.inject({
      method: 'GET',
      url: `/api/attendance-links?employeeId=${AHMAD}`,
      headers: as(OWNER),
    })
    expect(current.json().link).toMatchObject({
      id: second.body.id,
      state: 'active',
      daysBack: 3,
      autoApply: true,
    })
    // Another employee has none.
    const other = await app.inject({
      method: 'GET',
      url: `/api/attendance-links?employeeId=${TASNIM}`,
      headers: as(OWNER),
    })
    expect(other.json()).toEqual({ link: null })
  })

  it('a link is refused for a zone nobody knows, an expiry in the past, or more than a week back', async () => {
    expect((await makeLink({ timeZone: 'Mars/Olympus' })).body.code).toBe(
      'ATTENDANCE_TIME_ZONE_INVALID',
    )
    expect((await makeLink({ expiresOn: '2020-01-01' })).body.code).toBe(
      'ATTENDANCE_LINK_EXPIRY_IN_PAST',
    )
    expect((await makeLink({ daysBack: 8 })).status).toBe(400)
    expect((await makeLink({ employeeId: THEIRS })).status).toBe(404)
    expect(db.rows('attendance_links').length).toBe(0)
  })
})

describe('before attendance-self-01 is run', () => {
  const missing = { code: '42P01', message: 'relation "attendance_links" does not exist' }

  it('⚠️ the sheet still answers 200; the link routes say «not configured», never 500', async () => {
    db.fail('attendance_links', missing)
    db.fail('attendance_submissions', {
      code: '42P01',
      message: 'relation "attendance_submissions" does not exist',
    })
    db.rpcs.clear()

    const sheet = await app.inject({
      method: 'GET',
      url: '/api/attendance-sheet?date=2026-10-12',
      headers: as(OWNER),
    })
    expect(sheet.statusCode).toBe(200)
    expect(sheet.json().rows.length).toBe(2)

    const day = await app.inject({
      method: 'GET',
      url: '/api/attendance-submissions?date=2026-10-12',
      headers: as(OWNER),
    })
    expect(day.statusCode).toBe(200)
    expect(day.json()).toEqual({ configured: false, pending: [], fromLink: [] })

    const read = await app.inject({
      method: 'GET',
      url: `/api/attendance-links?employeeId=${AHMAD}`,
      headers: as(OWNER),
    })
    expect(read.statusCode).toBe(503)
    expect(read.json().code).toBe('ATTENDANCE_SELF_NOT_CONFIGURED')

    const made = await makeLink()
    expect(made.status).toBe(503)
    expect(made.body.code).toBe('ATTENDANCE_SELF_NOT_CONFIGURED')
  })

  it('a failed read is a failure — not «nothing pending»', async () => {
    db.fail('attendance_submissions', {
      code: '57014',
      message: 'canceling statement due to timeout',
    })
    const day = await app.inject({
      method: 'GET',
      url: '/api/attendance-submissions?date=2026-10-12',
      headers: as(OWNER),
    })
    expect(day.statusCode).toBe(500)
  })
})

describe('the public routes are rate-limited per address', () => {
  it('the eleventh send in a minute from one address is refused with 429, and writes nothing', async () => {
    const made = await makeLink()
    const today = (await publicGet(made.body.token)).json().today as string
    const from = '203.0.113.7'
    const codes: number[] = []
    for (let i = 0; i < 12; i++) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/public/attendance/${made.body.token}`,
        remoteAddress: from,
        // Refused by a rule every time, so only the limiter can change the answer.
        payload: { date: today, status: 'holiday', clientRequestId: requestId() },
      })
      codes.push(res.statusCode)
    }
    expect(codes.slice(0, 10)).toEqual(Array(10).fill(400))
    expect(codes.slice(10)).toEqual([429, 429])
    expect(db.rows('attendance_submissions').length).toBe(0)
  })
})
