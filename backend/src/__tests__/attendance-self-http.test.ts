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
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import {
  unlockEnrollmentMessage,
  unlockSubmissionMessage,
  type UnlockSubmissionFields,
} from '@hisabche/validation'
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
      require_unlock: args.p_require_unlock === true,
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

    if (link.require_unlock && args.p_proof !== 'device_unlock') {
      throw new Error('ATTENDANCE_UNLOCK_REQUIRED')
    }
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
          ends_next_day: args.p_ends_next_day === true,
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
        ends_next_day: args.p_ends_next_day === true,
        proof: args.p_proof ?? null,
        note: args.p_note,
        received_at: new Date().toISOString(),
        time_zone: args.p_time_zone,
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
    { id: SHOP, name: 'Kabul Shop', base_currency: 'AFN', time_zone: 'Asia/Kabul' },
    { id: OTHER, name: 'Other Shop', base_currency: 'USD', time_zone: 'Asia/Tehran' },
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
    payload: { employeeId: AHMAD, ...body },
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
      ['POST', '/api/attendance-links', { employeeId: AHMAD }],
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
    // Nothing of ours: no link, and their own business's zone — not ours.
    expect(read.json()).toEqual({
      link: null,
      phone: null,
      workplace: { timeZone: 'Asia/Tehran', source: 'workspace' },
    })
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
        'unlock',
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
      endsNextDay: false,
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
    expect(day.fromDevice).toEqual([])

    // A record a terminal wrote is named as such — and not as the employee's own.
    db.rows('attendance').push({
      id: fakeId('att'),
      employee_id: TASNIM,
      workspace_id: SHOP,
      date: today,
      status: 'present',
      check_in: '08:00',
      check_out: null,
      source: 'device',
    })
    const withDevice = await forDay(today)
    expect(withDevice.fromDevice).toEqual([TASNIM])
    expect(withDevice.fromLink).toEqual([AHMAD])

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
    expect(other.json()).toEqual({
      link: null,
      phone: null,
      workplace: { timeZone: 'Asia/Kabul', source: 'workspace' },
    })
  })

  it('a link is refused for an expiry in the past, more than a week back, or a zone sent from the device', async () => {
    // The zone is the workplace's. A client that sends one is sending
    // something this route no longer takes.
    expect((await makeLink({ timeZone: 'Asia/Tokyo' })).status).toBe(400)
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
    expect(day.json()).toEqual({
      configured: false,
      pending: [],
      fromLink: [],
      fromDevice: [],
    })

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

describe('whose clock: the workplace, never a device', () => {
  const BRANCH_TOKYO = 'dddddddd-0000-4000-8000-00000000000d'
  const BRANCH_PLAIN = 'dddddddd-0000-4000-8000-00000000000e'
  const BRANCH_THEIRS = 'dddddddd-0000-4000-8000-00000000000f'

  const post = (employee: string, branch: string) => ({
    id: fakeId('post'),
    workspace_id: SHOP,
    employee_id: employee,
    branch_id: branch,
    is_primary: true,
    starts_at: '2026-01-01',
    ends_at: null,
  })
  const branchRow = (id: string, workspace: string, name: string, zone: string | null) => ({
    id,
    workspace_id: workspace,
    code: name,
    name,
    time_zone: zone,
    deleted_at: null,
  })
  const zones = (user = OWNER, shop = SHOP) =>
    app.inject({ method: 'GET', url: '/api/workplace/time-zone', headers: as(user, shop) })
  const setZone = (payload: unknown, user = OWNER, shop = SHOP) =>
    app.inject({
      method: 'PUT',
      url: '/api/workplace/time-zone',
      headers: as(user, shop),
      payload: payload as Record<string, unknown>,
    })
  const setBranch = (id: string, payload: unknown, user = OWNER, shop = SHOP) =>
    app.inject({
      method: 'PUT',
      url: `/api/workplace/branches/${id}/time-zone`,
      headers: as(user, shop),
      payload: payload as Record<string, unknown>,
    })

  beforeEach(() => {
    db.seed('branches', [
      branchRow(BRANCH_TOKYO, SHOP, 'Tokyo office', 'Asia/Tokyo'),
      branchRow(BRANCH_PLAIN, SHOP, 'Herat', null),
      branchRow(BRANCH_THEIRS, OTHER, 'Elsewhere', null),
    ])
    db.seed('employee_branch_assignments', [])
  })

  it('⚠️ a business with no zone has no links — nothing is assumed, and the screen is told why', async () => {
    db.rows('workspaces').find((row) => row.id === SHOP)!.time_zone = null

    const made = await makeLink()
    expect(made.status).toBe(409)
    expect(made.body.code).toBe('ATTENDANCE_TIME_ZONE_NOT_SET')
    expect(db.rows('attendance_links').length).toBe(0)

    const read = await app.inject({
      method: 'GET',
      url: `/api/attendance-links?employeeId=${AHMAD}`,
      headers: as(OWNER),
    })
    expect(read.json()).toEqual({
      link: null,
      phone: null,
      workplace: { timeZone: null, source: null },
    })
    expect((await zones()).json()).toMatchObject({ timeZone: null, configurable: true })
  })

  it('the zone of the business is the zone of the employee, until their branch has its own', async () => {
    const first = await makeLink()
    expect((await publicGet(first.body.token)).json().timeZone).toBe('Asia/Kabul')

    // Posted to a branch with no zone of its own: still the business's.
    db.seed('employee_branch_assignments', [post(AHMAD, BRANCH_PLAIN)])
    expect((await publicGet(first.body.token)).json().timeZone).toBe('Asia/Kabul')

    // Posted to the Tokyo office: Tokyo's — on the SAME link, at the next visit.
    db.rows('employee_branch_assignments')[0]!.branch_id = BRANCH_TOKYO
    const view = (await publicGet(first.body.token)).json()
    expect(view.timeZone).toBe('Asia/Tokyo')
    const status = await app.inject({
      method: 'GET',
      url: `/api/attendance-links?employeeId=${AHMAD}`,
      headers: as(OWNER),
    })
    expect(status.json().workplace).toEqual({ timeZone: 'Asia/Tokyo', source: 'branch' })

    // A posting that has ended is history, not where they work.
    db.rows('employee_branch_assignments')[0]!.ends_at = '2026-06-01'
    expect((await publicGet(first.body.token)).json().timeZone).toBe('Asia/Kabul')
  })

  it('«today» follows the zone: at 20:00 UTC it is already tomorrow in Tokyo and still today in Kabul... by the server clock', async () => {
    const link = (await makeLink()).body
    const kabul = (await publicGet(link.token)).json()
    db.seed('employee_branch_assignments', [post(AHMAD, BRANCH_TOKYO)])
    const tokyo = (await publicGet(link.token)).json()

    // Kabul is UTC+4:30 and Tokyo UTC+9: Tokyo's clock is 4 h 30 min ahead,
    // whatever the moment this test runs.
    const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3))
    const ahead = (minutes(tokyo.now) - minutes(kabul.now) + 1440) % 1440
    expect([269, 270, 271]).toContain(ahead)
    // The day is the same or Tokyo's is one later — never earlier.
    const dayGap = (Date.parse(tokyo.today) - Date.parse(kabul.today)) / 86_400_000
    expect([0, 1]).toContain(dayGap)
    expect(dayGap).toBe(minutes(tokyo.now) < minutes(kabul.now) ? 1 : 0)
  })

  it('each submission keeps the zone its day was judged in', async () => {
    const link = (await makeLink()).body
    const kabulDay = (await publicGet(link.token)).json().today as string
    await send(link.token, { date: kabulDay, status: 'absent' })

    db.seed('employee_branch_assignments', [post(AHMAD, BRANCH_TOKYO)])
    const tokyoDay = (await publicGet(link.token)).json().today as string
    await send(link.token, { date: tokyoDay, status: 'leave' })

    expect(db.rows('attendance_submissions').map((row) => row.time_zone)).toEqual([
      'Asia/Kabul',
      'Asia/Tokyo',
    ])
  })

  it('only the owner moves the clock; a manager may read it; a zone nobody knows is refused', async () => {
    db.rows('workspace_members').find((row) => row.user_id === SELLER.id)!.role = 'manager'

    const read = await zones(SELLER)
    expect(read.statusCode).toBe(200)
    expect(read.json()).toEqual({
      timeZone: 'Asia/Kabul',
      configurable: true,
      branches: [
        { id: BRANCH_PLAIN, name: 'Herat', timeZone: null },
        { id: BRANCH_TOKYO, name: 'Tokyo office', timeZone: 'Asia/Tokyo' },
      ],
    })
    expect((await setZone({ timeZone: 'Asia/Tehran' }, SELLER)).statusCode).toBe(403)
    expect((await setBranch(BRANCH_PLAIN, { timeZone: 'Asia/Tehran' }, SELLER)).statusCode).toBe(
      403,
    )

    for (const bad of ['Mars/Olympus', '', 'x'.repeat(65)]) {
      expect((await setZone({ timeZone: bad })).statusCode, bad).toBe(400)
    }
    expect((await setZone({ timeZone: 'Mars/Olympus' })).json().code).toBe('TIME_ZONE_INVALID')
    expect((await setZone({})).statusCode).toBe(400)
    expect(db.rows('workspaces').find((row) => row.id === SHOP)!.time_zone).toBe('Asia/Kabul')

    const saved = await setZone({ timeZone: 'Asia/Tehran' })
    expect(saved.statusCode).toBe(200)
    expect(saved.json()).toEqual({ timeZone: 'Asia/Tehran' })
    expect(db.rows('workspaces').find((row) => row.id === SHOP)!.time_zone).toBe('Asia/Tehran')
    // The other business is untouched.
    expect(db.rows('workspaces').find((row) => row.id === OTHER)!.time_zone).toBe('Asia/Tehran')
  })

  it('a branch takes a zone of its own, gives it back with null, and never one of another business', async () => {
    expect((await setBranch(BRANCH_PLAIN, { timeZone: 'Europe/Istanbul' })).json()).toEqual({
      id: BRANCH_PLAIN,
      timeZone: 'Europe/Istanbul',
    })
    expect((await setBranch(BRANCH_PLAIN, { timeZone: null })).json()).toEqual({
      id: BRANCH_PLAIN,
      timeZone: null,
    })
    expect((await setBranch(BRANCH_PLAIN, { timeZone: 'Nowhere/Land' })).statusCode).toBe(400)

    const theirs = await setBranch(BRANCH_THEIRS, { timeZone: 'Asia/Kabul' })
    expect(theirs.statusCode).toBe(404)
    expect(db.rows('branches').find((row) => row.id === BRANCH_THEIRS)!.time_zone).toBeNull()

    // …and the list a member of the other business reads has only its own branch.
    const list = (await zones(STRANGER, OTHER)).json()
    expect(list.branches.map((row: Row) => row.id)).toEqual([BRANCH_THEIRS])
  })

  it('before the migration: the zone screen says «not configurable», the sheet still works', async () => {
    db.fail('workspaces', { code: '42703', message: 'column workspaces.time_zone does not exist' })
    const read = await zones()
    expect(read.statusCode).toBe(200)
    expect(read.json()).toEqual({ timeZone: null, configurable: false, branches: [] })

    // No zone can be read, so no link can be made — said, not guessed.
    const made = await makeLink()
    expect(made.status).toBe(409)
    expect(made.body.code).toBe('ATTENDANCE_TIME_ZONE_NOT_SET')

    const sheet = await app.inject({
      method: 'GET',
      url: '/api/attendance-sheet?date=2026-10-12',
      headers: as(OWNER),
    })
    expect(sheet.statusCode).toBe(200)
  })
})

// ─── nights, and the phone's own lock (attendance-02) ───────────────────────

describe('a night is said, never inferred', () => {
  async function fresh(body: Record<string, unknown> = {}) {
    const made = await makeLink({ autoApply: true, ...body })
    const view = (await publicGet(made.body.token)).json()
    return { token: made.body.token as string, today: view.today as string }
  }

  it('⚠️ 22:00 → 06:00 is refused as a typing error until the employee says it ends the next day', async () => {
    const { token, today } = await fresh()
    const plain = await send(token, {
      date: today,
      status: 'present',
      checkIn: '22:00',
      checkOut: '06:00',
    })
    expect(plain.statusCode).toBe(400)
    expect(plain.json().code).toBe('ATTENDANCE_CHECK_OUT_BEFORE_CHECK_IN')
    expect(db.rows('attendance')).toHaveLength(0)

    const night = await send(token, {
      date: today,
      status: 'present',
      checkIn: '22:00',
      checkOut: '06:00',
      endsNextDay: true,
    })
    expect(night.statusCode).toBe(201)
    expect(db.rows('attendance')).toMatchObject([
      { check_in: '22:00', check_out: '06:00', ends_next_day: true },
    ])
    expect((await publicGet(token)).json().days[0].record).toMatchObject({ endsNextDay: true })
  })

  it('said about a day that ends the same day, it is refused too', async () => {
    const { token, today } = await fresh()
    const res = await send(token, {
      date: today,
      status: 'present',
      checkIn: '08:00',
      checkOut: '16:00',
      endsNextDay: true,
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('ATTENDANCE_CHECK_OUT_BEFORE_CHECK_IN')
  })

  it('the sheet: a manager records a night, and its hours run through midnight', async () => {
    const mark = (body: Record<string, unknown>) =>
      app.inject({
        method: 'PUT',
        url: '/api/attendance-sheet',
        headers: as(OWNER),
        payload: { employeeId: AHMAD, date: '2026-09-01', status: 'present', ...body },
      })
    const refused = await mark({ checkIn: '22:00', checkOut: '06:00' })
    expect(refused.statusCode).toBe(400)
    const night = await mark({ checkIn: '22:00', checkOut: '06:00', endsNextDay: true })
    expect(night.statusCode).toBe(200)
    expect(night.json()).toMatchObject({
      endsNextDay: true,
      result: { workedHours: 8, issue: null, isOpen: false },
    })
    // Corrected back to a day shift: the mark goes with it.
    const day = await mark({ checkIn: '08:00', checkOut: '16:00' })
    expect(day.json()).toMatchObject({ endsNextDay: false, result: { workedHours: 8 } })
    expect(db.rows('attendance')[0]).toMatchObject({ ends_next_day: false })
  })
})

describe('the phone in the hand', () => {
  const ORIGIN = 'http://localhost:3039'
  const sha = (value: Buffer | string) => createHash('sha256').update(value).digest()

  /** A stand-in for a phone: a real P-256 key, and real signatures. */
  function phone(origin = ORIGIN) {
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const credentialId = randomBytes(24).toString('base64url')
    const authData = (flags: number) =>
      Buffer.concat([sha(new URL(origin).hostname), Buffer.from([flags]), Buffer.alloc(4)])
    const clientData = (type: string, message: string) =>
      Buffer.from(
        JSON.stringify({ type, challenge: sha(message).toString('base64url'), origin }),
        'utf8',
      )
    return {
      credentialId,
      enroll(token: string, clientRequestId: string, flags = 0x05) {
        return {
          credentialId,
          publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64url'),
          algorithm: -7,
          clientDataJSON: clientData(
            'webauthn.create',
            unlockEnrollmentMessage(token, clientRequestId),
          ).toString('base64url'),
          authenticatorData: authData(flags).toString('base64url'),
          clientRequestId,
        }
      },
      sign(token: string, fields: UnlockSubmissionFields, flags = 0x05) {
        const client = clientData('webauthn.get', unlockSubmissionMessage(token, fields))
        const data = authData(flags)
        return {
          credentialId,
          clientDataJSON: client.toString('base64url'),
          authenticatorData: data.toString('base64url'),
          signature: sign('sha256', Buffer.concat([data, sha(client)]), privateKey).toString(
            'base64url',
          ),
        }
      },
    }
  }

  const register = (token: string, payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: `/api/public/attendance/${token}/phone`,
      remoteAddress: address(),
      payload,
    })

  async function locked() {
    const made = await makeLink({ autoApply: true, requireUnlock: true })
    const view = (await publicGet(made.body.token)).json()
    return { token: made.body.token as string, today: view.today as string, view }
  }
  const form = (today: string, clientRequestId: string): UnlockSubmissionFields => ({
    date: today,
    status: 'present',
    checkIn: '08:00',
    checkOut: null,
    endsNextDay: false,
    clientRequestId,
  })

  it('a link says whether it asks for the lock, and whether a phone is registered', async () => {
    const plain = await makeLink()
    expect(plain.body.requireUnlock).toBe(false)
    expect((await publicGet(plain.body.token)).json().unlock).toEqual({
      required: false,
      credentialId: null,
    })
    const { view } = await locked()
    expect(view.unlock).toEqual({ required: true, credentialId: null })
  })

  it('⚠️ required and no phone registered: nothing is accepted, and the reason is said', async () => {
    const { token, today } = await locked()
    const res = await send(token, { date: today, status: 'present', checkIn: '08:00' })
    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe('ATTENDANCE_PHONE_NOT_REGISTERED')
    expect(db.rows('attendance_submissions')).toHaveLength(0)
  })

  it('⚠️ registered, then a signed submission is written with its proof — unsigned is refused', async () => {
    const { token, today } = await locked()
    const mine = phone()
    const enrolled = await register(token, mine.enroll(token, requestId()))
    expect(enrolled.statusCode).toBe(201)
    expect(Object.keys(enrolled.json()).sort()).toEqual(['lastUsedAt', 'registeredAt'])
    expect((await publicGet(token)).json().unlock).toEqual({
      required: true,
      credentialId: mine.credentialId,
    })
    // What is stored is the public key and its id. Nothing else was sent.
    expect(Object.keys(db.rows('attendance_phone_keys')[0]!).sort()).toEqual(
      [
        'algorithm',
        'created_at',
        'credential_id',
        'employee_id',
        'id',
        'public_key',
        'workspace_id',
      ].sort(),
    )

    const unsigned = await send(token, { date: today, status: 'present', checkIn: '08:00' })
    expect(unsigned.statusCode).toBe(400)
    expect(unsigned.json().code).toBe('ATTENDANCE_UNLOCK_REQUIRED')

    const id = requestId()
    const signed = await send(token, {
      ...form(today, id),
      unlock: mine.sign(token, form(today, id)),
    })
    expect(signed.statusCode).toBe(201)
    expect(db.rows('attendance_submissions')).toMatchObject([{ proof: 'device_unlock' }])
    expect(db.rows('attendance')).toMatchObject([{ check_in: '08:00', source: 'employee_link' }])
    expect(db.rows('attendance_phone_keys')[0]!.last_used_at).toBeTruthy()

    // The manager sees that a phone is registered — never its key.
    const status = await app.inject({
      method: 'GET',
      url: `/api/attendance-links?employeeId=${AHMAD}`,
      headers: as(OWNER),
    })
    expect(Object.keys(status.json().phone).sort()).toEqual(['lastUsedAt', 'registeredAt'])
    expect(JSON.stringify(status.json())).not.toContain(mine.credentialId)
  })

  it('⚠️ a signature is good for the form it was made for, and no other', async () => {
    const { token, today } = await locked()
    const mine = phone()
    await register(token, mine.enroll(token, requestId()))
    const id = requestId()
    const signature = mine.sign(token, form(today, id))

    const attempts: Array<[Record<string, unknown>, string]> = [
      // Another time on the same signature.
      [{ ...form(today, id), checkIn: '07:00', unlock: signature }, 'CHALLENGE_MISMATCH'],
      // The same form under another request id.
      [
        { ...form(today, id), clientRequestId: requestId(), unlock: signature },
        'CHALLENGE_MISMATCH',
      ],
      // A tap without the fingerprint, face or PIN (user present, not verified).
      [{ ...form(today, id), unlock: mine.sign(token, form(today, id), 0x01) }, 'NOT_VERIFIED'],
      // Another phone's key signing the right form.
      [
        {
          ...form(today, id),
          unlock: { ...phone().sign(token, form(today, id)), credentialId: mine.credentialId },
        },
        'SIGNATURE_INVALID',
      ],
      // Made on somebody else's page.
      [
        {
          ...form(today, id),
          unlock: {
            ...phone('https://evil.example').sign(token, form(today, id)),
            credentialId: mine.credentialId,
          },
        },
        'ORIGIN_NOT_ALLOWED',
      ],
      [{ ...form(today, id), unlock: { ...signature, signature: '!!!' } }, 'MALFORMED'],
    ]
    for (const [payload, code] of attempts) {
      const res = await send(token, payload)
      expect(res.statusCode, code).toBe(400)
      expect(res.json().code, code).toBe(`ATTENDANCE_UNLOCK_${code}`)
    }
    expect(db.rows('attendance_submissions')).toHaveLength(0)
    expect(db.rows('attendance')).toHaveLength(0)

    // The untouched form with its own signature still goes through.
    const good = await send(token, { ...form(today, id), unlock: signature })
    expect(good.statusCode).toBe(201)
  })

  it('⚠️ first come: a second phone is refused until a manager forgets the first', async () => {
    const { token, today } = await locked()
    const first = phone()
    const second = phone()
    expect((await register(token, first.enroll(token, requestId()))).statusCode).toBe(201)
    const again = await register(token, second.enroll(token, requestId()))
    expect(again.statusCode).toBe(409)
    expect(again.json().code).toBe('ATTENDANCE_PHONE_ALREADY_REGISTERED')

    // Only a manager of THIS shop may forget it.
    const stranger = await app.inject({
      method: 'DELETE',
      url: `/api/attendance-links/phone/${AHMAD}`,
      headers: as(STRANGER, OTHER),
    })
    expect(stranger.statusCode).toBe(404)
    const forgotten = await app.inject({
      method: 'DELETE',
      url: `/api/attendance-links/phone/${AHMAD}`,
      headers: as(OWNER),
    })
    expect(forgotten.statusCode).toBe(204)
    // Kept, marked — not deleted.
    expect(db.rows('attendance_phone_keys')).toHaveLength(1)
    expect(db.rows('attendance_phone_keys')[0]!.revoked_at).toBeTruthy()

    // The forgotten phone no longer vouches for anything…
    const id = requestId()
    const stale = await send(token, {
      ...form(today, id),
      unlock: first.sign(token, form(today, id)),
    })
    expect(stale.statusCode).toBe(409)
    // …and the second can now be registered and used.
    expect((await register(token, second.enroll(token, requestId()))).statusCode).toBe(201)
    const fresh = await send(token, {
      ...form(today, id),
      unlock: second.sign(token, form(today, id)),
    })
    expect(fresh.statusCode).toBe(201)
  })

  it('registration: a key that is not what it claims, or made elsewhere, is not stored', async () => {
    const { token } = await locked()
    const mine = phone()
    const id = requestId()
    const good = mine.enroll(token, id)
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ ...good, algorithm: -8 }, 'ATTENDANCE_UNLOCK_KEY_UNSUPPORTED'],
      [{ ...good, algorithm: -257 }, 'ATTENDANCE_UNLOCK_KEY_UNSUPPORTED'],
      [
        { ...good, publicKey: randomBytes(64).toString('base64url') },
        'ATTENDANCE_UNLOCK_KEY_UNSUPPORTED',
      ],
      [{ ...mine.enroll(token, id, 0x01) }, 'ATTENDANCE_UNLOCK_NOT_VERIFIED'],
      [{ ...good, clientRequestId: requestId() }, 'ATTENDANCE_UNLOCK_CHALLENGE_MISMATCH'],
      [
        { ...phone('https://evil.example').enroll(token, id) },
        'ATTENDANCE_UNLOCK_ORIGIN_NOT_ALLOWED',
      ],
      // A signature's client data is not a registration's.
      [
        { ...good, clientDataJSON: mine.sign(token, form('2026-01-01', id)).clientDataJSON },
        'ATTENDANCE_UNLOCK_WRONG_CEREMONY',
      ],
    ]
    for (const [payload, code] of cases) {
      const res = await register(token, payload)
      expect(res.statusCode, code).toBe(400)
      expect(res.json().code, code).toBe(code)
    }
    expect(db.rows('attendance_phone_keys')).toHaveLength(0)
    // A body that tries to carry anything of a face or a finger is refused whole.
    const extra = await register(token, { ...good, faceImage: 'AAAA' })
    expect(extra.statusCode).toBe(400)
    expect(db.rows('attendance_phone_keys')).toHaveLength(0)
    // An unknown token is «not found», like every other public call.
    expect((await register('0'.repeat(64), good)).statusCode).toBe(404)
  })
})
