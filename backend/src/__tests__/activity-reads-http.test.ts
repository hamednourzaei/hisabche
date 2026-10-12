// ============================================
// backend/src/__tests__/activity-reads-http.test.ts
//
// HTTP integration tests for activity read tracking and unread counts.
// Exercised end-to-end: real HTTP (buildServer + app.inject) → routes → guards → service → RPCs.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()

const USER_A = { id: '11111111-1111-4111-8111-111111111111', token: 'token-user-a' }
const USER_B = { id: '22222222-2222-4222-8222-222222222222', token: 'token-user-b' }
const SHOP_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SHOP_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const users = new Map<string, { id: string }>([
  [USER_A.token, { id: USER_A.id }],
  [USER_B.token, { id: USER_B.id }],
])

let schemaMissingActive = false
let activityReadsFailure: { code: string; message: string } | null = null

const baseFrom = db.from.bind(db)
const interceptingFrom = (table: string) => {
  const builder = baseFrom(table)
  if (table === 'activity_reads') {
    if (schemaMissingActive) {
      const err = { code: '42P01', message: 'relation "activity_reads" does not exist' }
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        then: (onfulfilled: any, onrejected: any) =>
          Promise.resolve({ data: null, error: err }).then(onfulfilled, onrejected),
      }
      return chain as unknown as ReturnType<typeof baseFrom>
    }
    if (activityReadsFailure) {
      const err = activityReadsFailure
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        then: (onfulfilled: any, onrejected: any) =>
          Promise.resolve({ data: null, error: err }).then(onfulfilled, onrejected),
      }
      return chain as unknown as ReturnType<typeof baseFrom>
    }
  }
  return builder
}

const fakeDbModule = createFakeDb(db, users)
fakeDbModule.supabase.from = interceptingFrom as unknown as typeof fakeDbModule.supabase.from
const originalRpc = fakeDbModule.supabase.rpc.bind(fakeDbModule.supabase)
fakeDbModule.supabase.rpc = (async (name: string, args: any) => {
  if (schemaMissingActive) {
    return { data: null, error: { code: 'PGRST202', message: `function ${name} does not exist` } }
  }
  if (activityReadsFailure) {
    return { data: null, error: activityReadsFailure }
  }
  return originalRpc(name, args)
}) as unknown as typeof fakeDbModule.supabase.rpc

vi.mock('../db', () => fakeDbModule)

let app: FastifyInstance

function member(workspaceId: string, userId: string) {
  return {
    id: fakeId('member'),
    workspace_id: workspaceId,
    user_id: userId,
    role: 'owner',
    has_access: true,
    suspended_at: null,
    joined_at: '2026-01-01T00:00:00Z',
  }
}

function registerRpcs() {
  db.rpc('activity_mark_read', (args: any) => {
    const { p_workspace, p_user, p_ids } = args
    const acts = db
      .rows('activities')
      .filter(
        (a) => a.workspace_id === p_workspace && a.actor_id === p_user && p_ids.includes(a.id),
      )
    const reads = db.rows('activity_reads')
    let inserted = 0
    for (const a of acts) {
      const exists = reads.some((r) => r.activity_id === a.id && r.user_id === p_user)
      if (!exists) {
        reads.push({
          id: fakeId('act_read'),
          activity_id: a.id,
          user_id: p_user,
          workspace_id: p_workspace,
          read_at: new Date().toISOString(),
        })
        inserted++
      }
    }
    return inserted
  })

  db.rpc('activity_mark_all_read', (args: any) => {
    const { p_workspace, p_user, p_filter } = args
    let acts = db
      .rows('activities')
      .filter((a) => a.workspace_id === p_workspace && a.actor_id === p_user)
    if (p_filter && p_filter !== 'all' && p_filter !== 'unread') {
      const map: Record<string, string> = {
        invoices: 'invoice',
        payments: 'payment',
        customers: 'customer',
      }
      const entity = map[p_filter] || p_filter
      acts = acts.filter((a) => a.entity_type === entity)
    }
    const reads = db.rows('activity_reads')
    let inserted = 0
    for (const a of acts) {
      const exists = reads.some((r) => r.activity_id === a.id && r.user_id === p_user)
      if (!exists) {
        reads.push({
          id: fakeId('act_read'),
          activity_id: a.id,
          user_id: p_user,
          workspace_id: p_workspace,
          read_at: new Date().toISOString(),
        })
        inserted++
      }
    }
    return inserted
  })

  db.rpc('activity_get_unread_count', (args: any) => {
    const { p_workspace, p_user } = args
    const acts = db
      .rows('activities')
      .filter((a) => a.workspace_id === p_workspace && a.actor_id === p_user)
    const reads = db.rows('activity_reads').filter((r) => r.user_id === p_user)
    const readIds = new Set(reads.map((r) => r.activity_id))
    return acts.filter((a) => !readIds.has(a.id)).length
  })

  db.rpc('activity_get_filter_counts', (args: any) => {
    const { p_workspace, p_user } = args
    const acts = db
      .rows('activities')
      .filter((a) => a.workspace_id === p_workspace && a.actor_id === p_user)
    const reads = db.rows('activity_reads').filter((r) => r.user_id === p_user)
    const readIds = new Set(reads.map((r) => r.activity_id))
    return {
      all: acts.length,
      unread: acts.filter((a) => !readIds.has(a.id)).length,
      invoices: acts.filter((a) => a.entity_type === 'invoice').length,
      payments: acts.filter((a) => a.entity_type === 'payment').length,
      customers: acts.filter((a) => a.entity_type === 'customer').length,
      unreadBy: {
        invoices: acts.filter((a) => a.entity_type === 'invoice' && !readIds.has(a.id)).length,
        payments: acts.filter((a) => a.entity_type === 'payment' && !readIds.has(a.id)).length,
        customers: acts.filter((a) => a.entity_type === 'customer' && !readIds.has(a.id)).length,
      },
    }
  })

  db.rpc('activity_get_unread_ids', (args: any) => {
    const { p_workspace, p_user, p_filter } = args
    let acts = db
      .rows('activities')
      .filter((a) => a.workspace_id === p_workspace && a.actor_id === p_user)
    if (p_filter && p_filter !== 'all' && p_filter !== 'unread') {
      const map: Record<string, string> = {
        invoices: 'invoice',
        payments: 'payment',
        customers: 'customer',
      }
      const entity = map[p_filter] || p_filter
      acts = acts.filter((a) => a.entity_type === entity)
    }
    const reads = db.rows('activity_reads').filter((r) => r.user_id === p_user)
    const readIds = new Set(reads.map((r) => r.activity_id))
    return acts.filter((a) => !readIds.has(a.id)).map((a) => a.id)
  })
}

function resetWorld() {
  db.tables.clear()
  db.failures.clear()
  db.queries.length = 0
  schemaMissingActive = false
  activityReadsFailure = null

  db.seed('workspaces', [
    { id: SHOP_1, name: 'Shop One', base_currency: 'AFN' },
    { id: SHOP_2, name: 'Shop Two', base_currency: 'USD' },
  ])

  db.seed('workspace_members', [
    member(SHOP_1, USER_A.id),
    member(SHOP_1, USER_B.id),
    member(SHOP_2, USER_A.id),
  ])

  db.seed('activities', [])
  db.seed('activity_reads', [])

  registerRpcs()
}

const as = (user: { token: string }, shop = SHOP_1) => ({
  authorization: `Bearer ${user.token}`,
  'x-workspace-id': shop,
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

beforeEach(async () => {
  resetWorld()
  const { memoryCache } = await import('../utils/pagination')
  await memoryCache.clear()
  const { clearCache } = await import('../middleware/cache.middleware')
  await clearCache('*')
})

describe('activity reads over HTTP', () => {
  // Test 1: Owner's bug: User B performs 3 events; User A lists (unread 3), marks 1, GETs immediately (unread 2, isRead true), marks all -> 0.
  it("resolves owner's bug: unread goes down when opened and mark-all clears remaining", async () => {
    const act1 = 'aaaaaaaa-1111-4000-8000-000000000001'
    const act2 = 'aaaaaaaa-1111-4000-8000-000000000002'
    const act3 = 'aaaaaaaa-1111-4000-8000-000000000003'

    db.seed('activities', [
      {
        id: act1,
        workspace_id: SHOP_1,
        actor_id: USER_A.id,
        actor_name: 'User A',
        entity_type: 'invoice',
        entity_id: 'inv-1',
        action: 'created',
        title: 'Invoice 1',
        created_at: '2026-03-01T10:00:00Z',
      },
      {
        id: act2,
        workspace_id: SHOP_1,
        actor_id: USER_A.id,
        actor_name: 'User A',
        entity_type: 'invoice',
        entity_id: 'inv-2',
        action: 'created',
        title: 'Invoice 2',
        created_at: '2026-03-01T11:00:00Z',
      },
      {
        id: act3,
        workspace_id: SHOP_1,
        actor_id: USER_A.id,
        actor_name: 'User A',
        entity_type: 'payment',
        entity_id: 'pay-1',
        action: 'received',
        title: 'Payment 1',
        created_at: '2026-03-01T12:00:00Z',
      },
    ])

    // User A reads unread count -> 3
    const countRes1 = await app.inject({
      method: 'GET',
      url: '/api/v1/activities/unread-count',
      headers: as(USER_A),
    })
    expect(countRes1.statusCode).toBe(200)
    expect(countRes1.json().count).toBe(3)

    // User A marks act1 as read
    const markRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/activities/mark-read',
      headers: as(USER_A),
      payload: { ids: [act1] },
    })
    expect(markRes.statusCode).toBe(200)
    expect(markRes.json()).toEqual({ success: true, marked: 1 })

    // User A immediately fetches unread count -> 2
    const countRes2 = await app.inject({
      method: 'GET',
      url: '/api/v1/activities/unread-count',
      headers: as(USER_A),
    })
    expect(countRes2.statusCode).toBe(200)
    expect(countRes2.json().count).toBe(2)

    // …and the list, read again at once, shows that event as read.
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/activities',
      headers: as(USER_A),
    })
    expect(listRes.statusCode).toBe(200)
    const listed = (
      listRes.json().data as Array<{
        activities: Array<{ id: string; isRead: boolean }>
      }>
    ).flatMap((group) => group.activities)
    expect(listed.length).toBe(3)
    expect(listed.filter((item) => item.isRead).map((item) => item.id)).toEqual([act1])

    const countsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/activities/counts',
      headers: as(USER_A),
    })
    expect(countsRes.json()).toMatchObject({ all: 3, unread: 2, invoices: 2, payments: 1 })

    // User A marks all as read
    const markAllRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/activities/mark-all-read',
      headers: as(USER_A),
    })
    expect(markAllRes.statusCode).toBe(200)
    expect(markAllRes.json().marked).toBe(2)

    // Unread count is now 0
    const countRes3 = await app.inject({
      method: 'GET',
      url: '/api/v1/activities/unread-count',
      headers: as(USER_A),
    })
    expect(countRes3.statusCode).toBe(200)
    expect(countRes3.json().count).toBe(0)
  })

  // Test 2: Per person: User B still sees 3 unread after User A marked all.
  it('keeps unread status isolated per user', async () => {
    const act1 = 'aaaaaaaa-1111-4000-8000-000000000001'
    const act2 = 'aaaaaaaa-1111-4000-8000-000000000002'
    const act3 = 'aaaaaaaa-1111-4000-8000-000000000003'

    db.seed('activities', [
      {
        id: act1,
        workspace_id: SHOP_1,
        actor_id: USER_A.id,
        actor_name: 'User A',
        entity_type: 'invoice',
        entity_id: 'inv-1',
        action: 'created',
        title: 'Invoice 1',
        created_at: '2026-03-01T10:00:00Z',
      },
      {
        id: act2,
        workspace_id: SHOP_1,
        actor_id: USER_A.id,
        actor_name: 'User A',
        entity_type: 'invoice',
        entity_id: 'inv-2',
        action: 'created',
        title: 'Invoice 2',
        created_at: '2026-03-01T11:00:00Z',
      },
      {
        id: act3,
        workspace_id: SHOP_1,
        actor_id: USER_B.id,
        actor_name: 'User B',
        entity_type: 'payment',
        entity_id: 'pay-1',
        action: 'received',
        title: 'Payment 1',
        created_at: '2026-03-01T12:00:00Z',
      },
    ])

    // User A marks all as read
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/activities/mark-all-read',
      headers: as(USER_A),
    })

    // The feed is personal: B's own event is untouched by A's «mark all»,
    // and A's two events never count for B.
    const countRes = await app.inject({
      method: 'GET',
      url: '/api/v1/activities/unread-count',
      headers: as(USER_B),
    })
    expect(countRes.statusCode).toBe(200)
    expect(countRes.json().count).toBe(1)

    const mine = await app.inject({
      method: 'GET',
      url: '/api/v1/activities/unread-count',
      headers: as(USER_A),
    })
    expect(mine.json().count).toBe(0)
  })

  // Test 3: Two workspaces: User in X sending IDs from Y marks 0, counts unaffected.
  it('enforces workspace boundary on mark-read', async () => {
    const actShop2 = 'bbbbbbbb-1111-4000-8000-000000000001'
    db.seed('activities', [
      {
        id: actShop2,
        workspace_id: SHOP_2,
        actor_id: USER_A.id,
        actor_name: 'User A',
        entity_type: 'invoice',
        entity_id: 'inv-shop2',
        action: 'created',
        title: 'Shop 2 Invoice',
        created_at: '2026-03-01T10:00:00Z',
      },
    ])

    // User A in SHOP_1 tries to mark actShop2
    const markRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/activities/mark-read',
      headers: as(USER_A, SHOP_1),
      payload: { ids: [actShop2] },
    })
    expect(markRes.statusCode).toBe(200)
    expect(markRes.json().marked).toBe(0)

    // In SHOP_2, unread count is still 1
    const countRes = await app.inject({
      method: 'GET',
      url: '/api/v1/activities/unread-count',
      headers: as(USER_A, SHOP_2),
    })
    expect(countRes.statusCode).toBe(200)
    expect(countRes.json().count).toBe(1)
  })

  // Test 4: Duplicate marking: second call marks 0, count unchanged.
  it('deduplicates marking and does not recount duplicate reads', async () => {
    const act = 'aaaaaaaa-1111-4000-8000-000000000001'
    db.seed('activities', [
      {
        id: act,
        workspace_id: SHOP_1,
        actor_id: USER_A.id,
        actor_name: 'User A',
        entity_type: 'invoice',
        entity_id: 'inv-1',
        action: 'created',
        title: 'Invoice 1',
        created_at: '2026-03-01T10:00:00Z',
      },
    ])

    const mark1 = await app.inject({
      method: 'PATCH',
      url: '/api/v1/activities/mark-read',
      headers: as(USER_A),
      payload: { ids: [act] },
    })
    expect(mark1.json().marked).toBe(1)

    const mark2 = await app.inject({
      method: 'PATCH',
      url: '/api/v1/activities/mark-read',
      headers: as(USER_A),
      payload: { ids: [act] },
    })
    expect(mark2.json().marked).toBe(0)

    const countRes = await app.inject({
      method: 'GET',
      url: '/api/v1/activities/unread-count',
      headers: as(USER_A),
    })
    expect(countRes.json().count).toBe(0)
  })

  // Test 5: mark-all-read with invoice filter leaves payments unread.
  it('supports filter in mark-all-read', async () => {
    const actInv = 'aaaaaaaa-1111-4000-8000-000000000001'
    const actPay = 'aaaaaaaa-1111-4000-8000-000000000002'

    db.seed('activities', [
      {
        id: actInv,
        workspace_id: SHOP_1,
        actor_id: USER_A.id,
        actor_name: 'User A',
        entity_type: 'invoice',
        entity_id: 'inv-1',
        action: 'created',
        title: 'Invoice 1',
        created_at: '2026-03-01T10:00:00Z',
      },
      {
        id: actPay,
        workspace_id: SHOP_1,
        actor_id: USER_A.id,
        actor_name: 'User A',
        entity_type: 'payment',
        entity_id: 'pay-1',
        action: 'received',
        title: 'Payment 1',
        created_at: '2026-03-01T11:00:00Z',
      },
    ])

    const markAllRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/activities/mark-all-read',
      headers: as(USER_A),
      payload: { filter: 'invoices' },
    })
    expect(markAllRes.statusCode).toBe(200)
    expect(markAllRes.json().marked).toBe(1)

    // Per tab: nothing left to mark on invoices, one on payments. This is the
    // number «mark all as read» is offered by — the tab's total (1 invoice
    // event) would have kept the button lit with nothing to do.
    const counts = await app.inject({
      method: 'GET',
      url: '/api/v1/activities/counts',
      headers: as(USER_A),
    })
    expect(counts.json()).toMatchObject({
      all: 2,
      unread: 1,
      invoices: 1,
      payments: 1,
      unreadBy: { invoices: 0, payments: 1, customers: 0 },
    })

    // Unread count is now 1 (the payment is still unread)
    const countRes = await app.inject({
      method: 'GET',
      url: '/api/v1/activities/unread-count',
      headers: as(USER_A),
    })
    expect(countRes.json().count).toBe(1)
  })

  // Test 6: Body validation: empty, 201 ids, non-uuid -> 400.
  it('rejects invalid payload on mark-read with 400 VALIDATION_ERROR', async () => {
    // Empty array
    const emptyRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/activities/mark-read',
      headers: as(USER_A),
      payload: { ids: [] },
    })
    expect(emptyRes.statusCode).toBe(400)
    expect(emptyRes.json().code).toBe('VALIDATION_ERROR')

    // Non-uuid
    const invalidIdRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/activities/mark-read',
      headers: as(USER_A),
      payload: { ids: ['not-a-uuid'] },
    })
    expect(invalidIdRes.statusCode).toBe(400)
    expect(invalidIdRes.json().code).toBe('VALIDATION_ERROR')

    // 201 ids
    const tooMany = Array.from(
      { length: 201 },
      (_, i) => `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`,
    )
    const tooManyRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/activities/mark-read',
      headers: as(USER_A),
      payload: { ids: tooMany },
    })
    expect(tooManyRes.statusCode).toBe(400)
    expect(tooManyRes.json().code).toBe('VALIDATION_ERROR')
  })

  // Test 7: Schema missing: lists/counts return 200 (all unread), mark routes return 503.
  it('handles unmigrated database: reads return 200 with unread=all, mark returns 503', async () => {
    schemaMissingActive = true
    const act = 'aaaaaaaa-1111-4000-8000-000000000001'

    db.seed('activities', [
      {
        id: act,
        workspace_id: SHOP_1,
        actor_id: USER_A.id,
        actor_name: 'User A',
        entity_type: 'invoice',
        entity_id: 'inv-1',
        action: 'created',
        title: 'Invoice 1',
        created_at: '2026-03-01T10:00:00Z',
      },
    ])

    // List returns 200, items are marked unread (isRead: false)
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/activities',
      headers: as(USER_A),
    })
    expect(listRes.statusCode).toBe(200)

    // Unread count returns 200 with all items counted as unread
    const countRes = await app.inject({
      method: 'GET',
      url: '/api/v1/activities/unread-count',
      headers: as(USER_A),
    })
    expect(countRes.statusCode).toBe(200)
    expect(countRes.json().count).toBe(1)

    // Mark route returns 503 ACTIVITY_READS_NOT_CONFIGURED
    const markRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/activities/mark-read',
      headers: as(USER_A),
      payload: { ids: [act] },
    })
    expect(markRes.statusCode).toBe(503)
    expect(markRes.json().code).toBe('ACTIVITY_READS_NOT_CONFIGURED')

    // Mark-all route returns 503 ACTIVITY_READS_NOT_CONFIGURED
    const markAllRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/activities/mark-all-read',
      headers: as(USER_A),
    })
    expect(markAllRes.statusCode).toBe(503)
    expect(markAllRes.json().code).toBe('ACTIVITY_READS_NOT_CONFIGURED')
  })

  // Test 8: Failed read of activity_reads throws error, never silent 0 unread.
  it('throws and returns 500 when database read fails, never claiming 0 unread', async () => {
    activityReadsFailure = { code: '50000', message: 'connection timeout' }

    const countRes = await app.inject({
      method: 'GET',
      url: '/api/v1/activities/unread-count',
      headers: as(USER_A),
    })
    expect(countRes.statusCode).toBe(500)
    expect(countRes.json().code).toBe('ACTIVITIES_UNREAD_COUNT_FAILED')
  })
})
