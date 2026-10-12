// ============================================
// Attendance terminals, through the REAL server (buildServer + app.inject).
//
// What an event DOES to a day is the database functions' — proven on a real
// Postgres in attendance-devices-01.pg.test.ts. Here: everything around them.
// Who may register a device, that the key is given once and stored only as a
// hash, that a bad key is one answer, what the wire format refuses (and that
// it says WHICH event), whose clock a reading is taken in, and that two
// businesses never meet.
// ============================================

import { createHash } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEVICE_METHODS,
  deviceHealth,
  normalizeGenericBatch,
  readEventTime,
} from '../services/attendance-devices/device-event.domain'
import { DEVICE_FORMATS, adapterFor } from '../services/attendance-devices/device-adapters'
import { FakeDatabase, createFakeDb, fakeId, type Row } from './helpers/fake-supabase'

const db = new FakeDatabase()

const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-owner' }
const SELLER = { id: '33333333-3333-4333-8333-333333333333', token: 'token-seller' }
const STRANGER = { id: '22222222-2222-4222-8222-222222222222', token: 'token-stranger' }
const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const AHMAD = 'eeeeeeee-0000-4000-8000-00000000000a'
const THEIRS = 'eeeeeeee-0000-4000-8000-00000000000b'
const BRANCH_TOKYO = 'dddddddd-0000-4000-8000-00000000000d'
const BRANCH_THEIRS = 'dddddddd-0000-4000-8000-00000000000f'

const users = new Map<string, { id: string }>([
  [OWNER.token, { id: OWNER.id }],
  [SELLER.token, { id: SELLER.id }],
  [STRANGER.token, { id: STRANGER.id }],
])

vi.mock('../db', () => createFakeDb(db, users))

let app: FastifyInstance
/** Every call the service made to the ingest function, as it was made. */
let ingested: Row[] = []
let reprocessed: Row[] = []

const member = (workspaceId: string, userId: string, role: string) => ({
  id: fakeId('member'),
  workspace_id: workspaceId,
  user_id: userId,
  role,
  has_access: true,
  suspended_at: null,
  joined_at: '2026-01-01T00:00:00Z',
})

function resetWorld() {
  db.tables.clear()
  db.failures.clear()
  db.rpcs.clear()
  db.queries.length = 0
  ingested = []
  reprocessed = []

  db.seed('workspaces', [
    { id: SHOP, name: 'Kabul Shop', time_zone: 'Asia/Kabul' },
    { id: OTHER, name: 'Other Shop', time_zone: 'Asia/Tehran' },
  ])
  db.seed('workspace_members', [
    member(SHOP, OWNER.id, 'owner'),
    member(SHOP, SELLER.id, 'seller'),
    member(OTHER, STRANGER.id, 'owner'),
  ])
  db.seed('employees', [
    { id: AHMAD, workspace_id: SHOP, first_name: 'Ahmad', last_name: 'Hoi' },
    { id: THEIRS, workspace_id: OTHER, first_name: 'Zed', last_name: 'Elsewhere' },
  ])
  db.seed('branches', [
    {
      id: BRANCH_TOKYO,
      workspace_id: SHOP,
      name: 'Tokyo',
      time_zone: 'Asia/Tokyo',
      deleted_at: null,
    },
    { id: BRANCH_THEIRS, workspace_id: OTHER, name: 'Theirs', time_zone: null, deleted_at: null },
  ])
  db.seed('attendance_terminals', [])
  db.seed('attendance_terminal_identities', [])
  db.seed('attendance_terminal_events', [])
  db.unique('attendance_terminals', ['key_hash'])

  db.rpc('attendance_device_ingest', (args: Row) => {
    const device = db
      .rows('attendance_terminals')
      .find((row) => row.id === args.p_device && (row.revoked_at ?? null) === null)
    if (!device) throw new Error('ATTENDANCE_DEVICE_NOT_FOUND')
    ingested.push(args)
    device.last_seen_at = new Date().toISOString()
    return {
      received: (args.p_events as unknown[]).length,
      redelivered: 0,
      unmatched: 0,
      duplicate: 0,
      applied: (args.p_events as unknown[]).length,
      held: 0,
    }
  })
  db.rpc('attendance_device_reprocess', (args: Row) => {
    reprocessed.push(args)
    return { matched: 2, applied: 2, held: 0, duplicate: 0 }
  })
}

const as = (user: { token: string }, shop = SHOP) => ({
  authorization: `Bearer ${user.token}`,
  'x-workspace-id': shop,
})

let caller = 0
const address = () => `10.9.${(++caller >> 8) & 255}.${caller & 255}`

async function register(body: Record<string, unknown> = {}, user = OWNER, shop = SHOP) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/attendance-devices',
    headers: as(user, shop),
    payload: { name: 'Front door', ...body },
  })
  return { status: res.statusCode, body: res.json() as Row, raw: res.payload }
}

const send = (key: string | undefined, body: unknown) =>
  app.inject({
    method: 'POST',
    url: '/api/public/attendance-devices/events',
    remoteAddress: address(),
    headers: key === undefined ? {} : { 'x-device-key': key },
    payload: body as Record<string, unknown>,
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

describe('the wire format (pure)', () => {
  const at = { timeZone: 'Asia/Kabul', now: new Date('2026-10-12T06:00:00Z') }

  it('a reading with no offset is the wall clock of the device, taken as written', () => {
    expect(readEventTime('2026-10-12T08:03:10', 'Asia/Kabul')).toEqual({
      day: '2026-10-12',
      at: '08:03:10',
    })
    expect(readEventTime('2026-10-12 08:03', 'Asia/Tokyo')).toEqual({
      day: '2026-10-12',
      at: '08:03:00',
    })
  })

  it('a reading with an offset is an instant, read in the zone of the device — never of the server', () => {
    // 21:30 UTC on the 11th is 02:00 on the 12th in Kabul (+4:30)…
    expect(readEventTime('2026-10-11T21:30:00Z', 'Asia/Kabul')).toEqual({
      day: '2026-10-12',
      at: '02:00:00',
    })
    // …and 06:30 on the 12th in Tokyo (+9).
    expect(readEventTime('2026-10-11T21:30:00Z', 'Asia/Tokyo')).toEqual({
      day: '2026-10-12',
      at: '06:30:00',
    })
    expect(readEventTime('2026-10-12T08:00:00+04:30', 'Asia/Kabul')?.at).toBe('08:00:00')
  })

  it('what cannot be read is refused, not rounded', () => {
    for (const bad of [
      '2026-02-31T08:00:00',
      '2026-10-12T25:00:00',
      '2026-10-12T08:61:00',
      '2026-10-12',
      '08:00',
      'yesterday',
      '',
      null,
      1760256000,
    ]) {
      expect(readEventTime(bad, 'Asia/Kabul'), String(bad)).toBeNull()
    }
  })

  it('normalises a batch into the rows the database function reads', () => {
    const rows = normalizeGenericBatch(
      [
        { id: 184467, userId: 182, at: '2026-10-12T08:03:10', direction: 'in', method: 'face' },
        { userId: ' 7 ', at: '2026-10-12T16:00:00' },
      ],
      at,
    )
    expect(rows[0]).toMatchObject({
      raw_id: '184467',
      user_id: '182',
      day: '2026-10-12',
      at: '08:03:10',
      direction: 'in',
      method: 'FACE',
    })
    expect(rows[1]).toMatchObject({ user_id: '7', direction: 'unknown', method: 'UNKNOWN' })
    // No id of its own: the event is its content, so sending it again is the same event.
    const expected = createHash('sha256').update('7|2026-10-12|16:00:00|unknown').digest('hex')
    expect(rows[1]!.raw_id).toBe(`h:${expected}`)
    expect(normalizeGenericBatch([{ userId: '7', at: '2026-10-12T16:00:00' }], at)[0]!.raw_id).toBe(
      rows[1]!.raw_id,
    )
  })

  it('⚠️ refuses anything that looks like biometric data, at any depth', () => {
    for (const event of [
      { userId: '1', at: '2026-10-12T08:00:00', template: 'AAAA' },
      { userId: '1', at: '2026-10-12T08:00:00', extra: { faceData: 'x' } },
      { userId: '1', at: '2026-10-12T08:00:00', raw: [{ fingerprint_data: 'x' }] },
      { userId: '1', at: '2026-10-12T08:00:00', photo: 'base64…' },
    ]) {
      expect(() => normalizeGenericBatch([event], at), JSON.stringify(event)).toThrow(
        'DEVICE_BIOMETRIC_DATA_REFUSED',
      )
    }
  })

  it('a clock set to the future is for the device to fix; one day of slack for zones', () => {
    // «now» is 10:30 on the 12th in Kabul.
    expect(() =>
      normalizeGenericBatch([{ userId: '1', at: '2026-10-13T23:59:00' }], at),
    ).not.toThrow()
    expect(() => normalizeGenericBatch([{ userId: '1', at: '2026-10-14T00:00:00' }], at)).toThrow(
      'DEVICE_EVENT_IN_FUTURE',
    )
    // The past is fine: a terminal that was offline for a month catches up.
    expect(() =>
      normalizeGenericBatch([{ userId: '1', at: '2026-09-01T08:00:00' }], at),
    ).not.toThrow()
  })

  it('health is a statement about the last word heard, on the clock it is given', () => {
    const now = new Date('2026-10-12T10:00:00Z')
    expect(deviceHealth(null, now)).toBe('never')
    expect(deviceHealth('2026-10-12T09:50:00Z', now)).toBe('online')
    expect(deviceHealth('2026-10-12T09:44:59Z', now)).toBe('silent')
  })

  it('⚠️ the registry lists only what has been proven: one format, no brand', () => {
    expect(DEVICE_FORMATS).toEqual(['generic'])
    expect(adapterFor(undefined)?.format).toBe('generic')
    for (const brand of ['zkteco', 'suprema', 'hikvision', 'anviz']) {
      expect(adapterFor(brand), brand).toBeNull()
    }
    expect(DEVICE_METHODS).toContain('FINGERPRINT')
    expect(DEVICE_METHODS).toContain('FACE')
  })
})

describe('registering a device', () => {
  it('⚠️ the key is given once, and only its hash is kept', async () => {
    const { status, body, raw } = await register({
      vendor: 'ZKTeco',
      model: 'K40',
      capabilities: ['fingerprint', 'CARD'],
    })
    expect(status).toBe(201)
    expect(body.key).toMatch(/^hsd_[0-9a-f]{64}$/)
    expect(body.device).toMatchObject({
      name: 'Front door',
      vendor: 'ZKTeco',
      model: 'K40',
      capabilities: ['FINGERPRINT', 'CARD'],
      state: 'active',
      health: 'never',
      effectiveTimeZone: 'Asia/Kabul',
      timeZoneSource: 'workspace',
      unmatched: 0,
      held: 0,
    })
    expect(body.device.keyPrefix).toBe(body.key.slice(0, 12))

    const stored = db.rows('attendance_terminals')[0]!
    expect(stored.key_hash).toBe(createHash('sha256').update(body.key).digest('hex'))
    expect(JSON.stringify(stored)).not.toContain(body.key)
    expect(raw).not.toContain(stored.key_hash)

    // The list never has it again — not the key, not the hash.
    const list = await app.inject({
      method: 'GET',
      url: '/api/attendance-devices',
      headers: as(OWNER),
    })
    expect(list.statusCode).toBe(200)
    expect(list.json().devices.length).toBe(1)
    expect(list.json().formats).toEqual(['generic'])
    expect(list.payload).not.toContain(body.key)
    expect(list.payload).not.toContain(stored.key_hash)
    expect(list.payload).not.toContain('key_hash')
  })

  it('needs a session and a manager; a seller of the same shop is refused', async () => {
    const made = await register()
    for (const [method, url] of [
      ['GET', '/api/attendance-devices'],
      ['POST', '/api/attendance-devices'],
      ['POST', `/api/attendance-devices/${made.body.device.id}/key`],
      ['DELETE', `/api/attendance-devices/${made.body.device.id}`],
      ['GET', `/api/attendance-devices/${made.body.device.id}/unmatched`],
      ['GET', `/api/attendance-devices/${made.body.device.id}/identities`],
      ['PUT', `/api/attendance-devices/${made.body.device.id}/identities`],
    ] as const) {
      const anonymous = await app.inject({
        method,
        url,
        ...(method === 'GET' ? {} : { payload: {} }),
      })
      expect(anonymous.statusCode, `${method} ${url}`).toBe(401)
      const seller = await app.inject({
        method,
        url,
        headers: as(SELLER),
        ...(method === 'GET' ? {} : { payload: { name: 'x' } }),
      })
      expect(seller.statusCode, `seller ${method} ${url}`).toBe(403)
    }
    expect(
      db.rows('attendance_terminals').filter((row) => (row.revoked_at ?? null) === null).length,
    ).toBe(1)
  })

  it('refuses a name that is blank, a zone nobody knows, a capability outside the list, a branch of another business', async () => {
    expect((await register({ name: '   ' })).body.code).toBe('ATTENDANCE_DEVICE_NAME_INVALID')
    expect((await register({ timeZone: 'Mars/Olympus' })).body.code).toBe('TIME_ZONE_INVALID')
    expect((await register({ capabilities: ['RETINA'] })).body.code).toBe(
      'ATTENDANCE_DEVICE_CAPABILITY_INVALID',
    )
    expect((await register({ branchId: BRANCH_THEIRS })).status).toBe(404)
    expect((await register({ surprise: true })).status).toBe(400)
    expect(db.rows('attendance_terminals').length).toBe(0)
  })
})

describe('the key', () => {
  it('unknown, malformed, missing and revoked keys get the SAME 401', async () => {
    const live = await register()
    const gone = await register({ name: 'Old door' })
    await app.inject({
      method: 'DELETE',
      url: `/api/attendance-devices/${gone.body.device.id}`,
      headers: as(OWNER),
    })

    const event = { events: [{ userId: '1', at: '2026-10-12T08:00:00' }] }
    for (const key of [undefined, '', 'hsd_short', `hsd_${'f'.repeat(64)}`, gone.body.key]) {
      const res = await send(key, event)
      expect(res.statusCode, String(key)).toBe(401)
      expect(res.json()).toEqual({ error: 'DEVICE_KEY_INVALID', code: 'DEVICE_KEY_INVALID' })
    }
    expect(ingested.length).toBe(0)

    expect((await send(live.body.key, event)).statusCode).toBe(200)
    expect(ingested.length).toBe(1)
  })

  it('a new key stops the old one with the same write', async () => {
    const made = await register()
    const rotated = await app.inject({
      method: 'POST',
      url: `/api/attendance-devices/${made.body.device.id}/key`,
      headers: as(OWNER),
    })
    expect(rotated.statusCode).toBe(200)
    const next = rotated.json().key as string
    expect(next).toMatch(/^hsd_[0-9a-f]{64}$/)
    expect(next).not.toBe(made.body.key)

    const event = { events: [] }
    expect((await send(made.body.key, event)).statusCode).toBe(401)
    expect((await send(next, event)).statusCode).toBe(200)
    expect(db.rows('attendance_terminals').length).toBe(1)
  })
})

describe('events', () => {
  it('reach the database function as a day and a time in the zone of the workplace', async () => {
    const { body } = await register()
    const res = await send(body.key, {
      cursor: 'page-3',
      events: [
        {
          id: 9001,
          userId: 182,
          at: '2026-10-12T08:03:10',
          direction: 'in',
          method: 'FINGERPRINT',
        },
        // An instant: 12:00 UTC is 16:30 in Kabul.
        { userId: '182', at: '2026-10-12T12:00:00Z', direction: 'out' },
      ],
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ received: 2, applied: 2, timeZone: 'Asia/Kabul' })
    expect(res.json().serverTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)

    expect(ingested.length).toBe(1)
    expect(ingested[0]).toMatchObject({
      p_device: body.device.id,
      p_time_zone: 'Asia/Kabul',
      p_cursor: 'page-3',
    })
    expect(ingested[0]!.p_events).toMatchObject([
      { raw_id: '9001', user_id: '182', day: '2026-10-12', at: '08:03:10', direction: 'in' },
      { user_id: '182', day: '2026-10-12', at: '16:30:00', direction: 'out', method: 'UNKNOWN' },
    ])
  })

  it('an empty batch is a heartbeat: the device is «online» afterwards', async () => {
    const { body } = await register()
    expect((await send(body.key, { events: [] })).json()).toMatchObject({ received: 0 })
    const list = await app.inject({
      method: 'GET',
      url: '/api/attendance-devices',
      headers: as(OWNER),
    })
    expect(list.json().devices[0].health).toBe('online')
  })

  it('⚠️ whose clock: the zone of the device, else of its branch, else of the business', async () => {
    const event = { events: [{ userId: '1', at: '2026-10-12T12:00:00Z' }] }

    const plain = await register({ name: 'Plain' })
    await send(plain.body.key, event)
    const inBranch = await register({ name: 'In Tokyo', branchId: BRANCH_TOKYO })
    expect(inBranch.body.device).toMatchObject({
      effectiveTimeZone: 'Asia/Tokyo',
      timeZoneSource: 'branch',
    })
    await send(inBranch.body.key, event)
    const own = await register({
      name: 'Its own',
      branchId: BRANCH_TOKYO,
      timeZone: 'Europe/Istanbul',
    })
    expect(own.body.device.timeZoneSource).toBe('device')
    await send(own.body.key, event)

    // The same instant, three wall clocks: 16:30, 21:00 and 15:00.
    expect(ingested.map((call) => [call.p_time_zone, (call.p_events as Row[])[0]!.at])).toEqual([
      ['Asia/Kabul', '16:30:00'],
      ['Asia/Tokyo', '21:00:00'],
      ['Europe/Istanbul', '15:00:00'],
    ])
  })

  it('⚠️ no zone anywhere: the events are refused, not dated in a guess', async () => {
    const { body } = await register()
    db.rows('workspaces').find((row) => row.id === SHOP)!.time_zone = null
    const res = await send(body.key, { events: [{ userId: '1', at: '2026-10-12T08:00:00' }] })
    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe('DEVICE_TIME_ZONE_NOT_SET')
    expect(ingested.length).toBe(0)
  })

  it('one bad event refuses the batch — and the answer says which one', async () => {
    const { body } = await register()
    const good = { userId: '1', at: '2026-10-12T08:00:00' }
    const cases: Array<[unknown, string]> = [
      [{ at: '2026-10-12T08:00:00' }, 'DEVICE_EVENT_USER_MISSING'],
      [{ userId: '1', at: '2026-02-31T08:00:00' }, 'DEVICE_EVENT_TIME_INVALID'],
      [
        { userId: '1', at: '2026-10-12T08:00:00', direction: 'sideways' },
        'DEVICE_EVENT_DIRECTION_INVALID',
      ],
      [{ userId: '1', at: '2026-10-12T08:00:00', method: 'RETINA' }, 'DEVICE_EVENT_METHOD_INVALID'],
      [
        { userId: '1', at: '2026-10-12T08:00:00', template: 'AAAA' },
        'DEVICE_BIOMETRIC_DATA_REFUSED',
      ],
      [{ userId: '1', at: '2099-01-01T08:00:00' }, 'DEVICE_EVENT_IN_FUTURE'],
      ['not an object', 'DEVICE_EVENT_NOT_AN_OBJECT'],
      [
        { userId: '1', at: '2026-10-12T08:00:00', note: 'x'.repeat(2100) },
        'DEVICE_EVENT_TOO_LARGE',
      ],
    ]
    for (const [bad, code] of cases) {
      const res = await send(body.key, { events: [good, good, bad] })
      expect(res.statusCode, code).toBe(400)
      expect(res.json()).toMatchObject({ code, eventIndex: 2 })
    }
    const tooMany = await send(body.key, { events: Array.from({ length: 501 }, () => good) })
    expect(tooMany.json().code).toBe('DEVICE_EVENTS_TOO_MANY')
    expect((await send(body.key, { events: 'all of them' })).statusCode).toBe(400)
    expect((await send(body.key, { format: 'zkteco', events: [] })).json().code).toBe(
      'DEVICE_FORMAT_UNSUPPORTED',
    )
    // Not one of them reached the database.
    expect(ingested.length).toBe(0)
  })
})

describe('who is who on a device', () => {
  it('mapping a number settles what it had already sent; unmapping leaves history alone', async () => {
    const { body } = await register()
    db.seed('attendance_terminal_events', [
      ...['2026-10-01', '2026-10-01', '2026-10-03'].map((day) => ({
        id: fakeId('ev'),
        workspace_id: SHOP,
        device_id: body.device.id,
        external_user_id: '777',
        occurred_on: day,
        state: 'unmatched',
      })),
      {
        id: fakeId('ev'),
        workspace_id: SHOP,
        device_id: body.device.id,
        external_user_id: '5',
        occurred_on: '2026-10-02',
        state: 'unmatched',
      },
    ])

    const waiting = await app.inject({
      method: 'GET',
      url: `/api/attendance-devices/${body.device.id}/unmatched`,
      headers: as(OWNER),
    })
    expect(waiting.json().users).toEqual([
      { externalUserId: '777', events: 3, firstDay: '2026-10-01', lastDay: '2026-10-03' },
      { externalUserId: '5', events: 1, firstDay: '2026-10-02', lastDay: '2026-10-02' },
    ])

    const mapped = await app.inject({
      method: 'PUT',
      url: `/api/attendance-devices/${body.device.id}/identities`,
      headers: as(OWNER),
      payload: { externalUserId: ' 777 ', employeeId: AHMAD },
    })
    expect(mapped.statusCode).toBe(200)
    expect(mapped.json()).toEqual({ matched: 2, applied: 2, held: 0, duplicate: 0 })
    expect(reprocessed).toMatchObject([
      { p_workspace: SHOP, p_device: body.device.id, p_user_id: '777', p_actor: OWNER.id },
    ])
    expect(db.rows('attendance_terminal_identities')).toMatchObject([
      {
        workspace_id: SHOP,
        device_id: body.device.id,
        external_user_id: '777',
        employee_id: AHMAD,
      },
    ])

    // Mapping it again replaces — one number is one person.
    await app.inject({
      method: 'PUT',
      url: `/api/attendance-devices/${body.device.id}/identities`,
      headers: as(OWNER),
      payload: { externalUserId: '777', employeeId: AHMAD },
    })
    expect(db.rows('attendance_terminal_identities').length).toBe(1)

    const removed = await app.inject({
      method: 'PUT',
      url: `/api/attendance-devices/${body.device.id}/identities`,
      headers: as(OWNER),
      payload: { externalUserId: '777', employeeId: null },
    })
    expect(removed.json()).toEqual({ matched: 0, applied: 0, held: 0, duplicate: 0 })
    expect(db.rows('attendance_terminal_identities').length).toBe(0)
    // Nothing was «un-settled»: the function was not asked to.
    expect(reprocessed.length).toBe(2)
  })

  it('an employee of another business cannot be mapped', async () => {
    const { body } = await register()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/attendance-devices/${body.device.id}/identities`,
      headers: as(OWNER),
      payload: { externalUserId: '1', employeeId: THEIRS },
    })
    expect(res.statusCode).toBe(404)
    expect(db.rows('attendance_terminal_identities').length).toBe(0)
    expect(reprocessed.length).toBe(0)
  })
})

describe('two businesses', () => {
  it('⚠️ a manager of the other shop sees, rotates, revokes and maps nothing of ours', async () => {
    const mine = await register()
    const id = mine.body.device.id as string

    const list = await app.inject({
      method: 'GET',
      url: '/api/attendance-devices',
      headers: as(STRANGER, OTHER),
    })
    expect(list.json().devices).toEqual([])

    for (const [method, url, payload] of [
      ['POST', `/api/attendance-devices/${id}/key`, undefined],
      ['DELETE', `/api/attendance-devices/${id}`, undefined],
      ['GET', `/api/attendance-devices/${id}/unmatched`, undefined],
      ['GET', `/api/attendance-devices/${id}/identities`, undefined],
      [
        'PUT',
        `/api/attendance-devices/${id}/identities`,
        { externalUserId: '1', employeeId: THEIRS },
      ],
    ] as const) {
      const res = await app.inject({
        method,
        url,
        headers: as(STRANGER, OTHER),
        ...(payload ? { payload } : {}),
      })
      expect(res.statusCode, `${method} ${url}`).toBe(404)
    }
    // Asking for OUR workspace, they are not a member of it.
    expect((await register({}, STRANGER, SHOP)).status).toBe(403)

    // Ours still works, with the key it always had.
    expect((await send(mine.body.key, { events: [] })).statusCode).toBe(200)
    expect(db.rows('attendance_terminals')[0]!.revoked_at ?? null).toBeNull()
  })
})

describe('before attendance-devices-01 is run', () => {
  it('⚠️ the list says «not configured» with 200; writes say so with 503; the sheet is untouched', async () => {
    const missing = { code: '42P01', message: 'relation "attendance_terminals" does not exist' }
    db.fail('attendance_terminals', missing)

    const list = await app.inject({
      method: 'GET',
      url: '/api/attendance-devices',
      headers: as(OWNER),
    })
    expect(list.statusCode).toBe(200)
    expect(list.json()).toEqual({ configured: false, devices: [], formats: ['generic'] })

    const sheet = await app.inject({
      method: 'GET',
      url: '/api/attendance-sheet?date=2026-10-12',
      headers: as(OWNER),
    })
    expect(sheet.statusCode).toBe(200)

    const sent = await send(`hsd_${'a'.repeat(64)}`, { events: [] })
    expect(sent.statusCode).toBe(503)
    expect(sent.json().code).toBe('ATTENDANCE_DEVICES_NOT_CONFIGURED')
  })

  it('a failed read is a failure — not «no devices»', async () => {
    db.fail('attendance_terminals', { code: '57014', message: 'statement timeout' })
    const list = await app.inject({
      method: 'GET',
      url: '/api/attendance-devices',
      headers: as(OWNER),
    })
    expect(list.statusCode).toBe(500)
  })
})

// ─── readings kept back (attendance-02) ─────────────────────────────────────

describe('readings kept back', () => {
  const heldEvent = (over: Row) => ({
    id: fakeId('event'),
    workspace_id: SHOP,
    device_id: 'device-1',
    employee_id: AHMAD,
    work_day: '2026-09-10',
    occurred_on: '2026-09-10',
    occurred_time: '08:02:00',
    direction: 'unknown',
    state: 'held',
    ...over,
  })
  const held = (user = OWNER, shop = SHOP) =>
    app.inject({ method: 'GET', url: '/api/attendance-devices/held', headers: as(user, shop) })
  const accept = (payload: Row, user = OWNER, shop = SHOP) =>
    app.inject({
      method: 'POST',
      url: '/api/attendance-devices/held/accept',
      headers: as(user, shop),
      payload,
    })

  it('⚠️ one entry per person and working day: what the terminal saw beside what the record says', async () => {
    db.seed('attendance_terminal_events', [
      heldEvent({ occurred_time: '21:58:00' }),
      // The end of a night: on the next calendar day, counted toward the 10th.
      heldEvent({ occurred_on: '2026-09-11', occurred_time: '06:03:00', direction: 'out' }),
      // Settled, somebody else's, and not held: none of these is listed.
      heldEvent({ state: 'applied', occurred_time: '12:00:00' }),
      heldEvent({ workspace_id: OTHER, employee_id: THEIRS }),
    ])
    db.seed('attendance', [
      {
        id: fakeId('att'),
        workspace_id: SHOP,
        employee_id: AHMAD,
        date: '2026-09-10',
        status: 'present',
        check_in: '22:00:00',
        check_out: null,
        ends_next_day: false,
        source: null,
      },
    ])
    const res = await held()
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      days: [
        {
          employeeId: AHMAD,
          day: '2026-09-10',
          readings: [
            { at: '21:58', nextDay: false, direction: 'unknown', deviceId: 'device-1' },
            { at: '06:03', nextDay: true, direction: 'out', deviceId: 'device-1' },
          ],
          record: {
            status: 'present',
            checkIn: '22:00',
            checkOut: null,
            endsNextDay: false,
            source: null,
          },
        },
      ],
    })
    // Their manager sees their own — which is nothing of ours.
    expect(JSON.stringify((await held(STRANGER, OTHER)).json())).not.toContain(AHMAD)
  })

  it('nothing held is an empty list, and a seller is refused', async () => {
    expect((await held()).json()).toEqual({ days: [] })
    expect((await held(SELLER)).statusCode).toBe(403)
    expect((await accept({ employeeId: AHMAD, day: '2026-09-10' }, SELLER)).statusCode).toBe(403)
  })

  it('⚠️ accepting is one call to the function, for this workspace, by this person', async () => {
    const calls: Row[] = []
    db.rpc('attendance_device_accept_held', (args: Row) => {
      calls.push(args)
      if (args.p_day === '2026-09-12') throw new Error('ATTENDANCE_DEVICE_NOTHING_HELD')
      return { accepted: 2 }
    })
    const ok = await accept({ employeeId: AHMAD, day: '2026-09-10' })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toEqual({ accepted: 2 })
    expect(calls).toEqual([
      { p_workspace: SHOP, p_employee: AHMAD, p_day: '2026-09-10', p_actor: OWNER.id },
    ])
    // Somebody else got there first: said as such, not as a server error.
    const gone = await accept({ employeeId: AHMAD, day: '2026-09-12' })
    expect(gone.statusCode).toBe(409)
    expect(gone.json().code).toBe('ATTENDANCE_DEVICE_NOTHING_HELD')
    // A workspace cannot be named in the body.
    const forged = await accept({ employeeId: AHMAD, day: '2026-09-10', workspaceId: OTHER })
    expect(forged.statusCode).toBe(400)
    expect((await accept({ employeeId: AHMAD, day: '10 Sept' })).statusCode).toBe(400)
  })
})
