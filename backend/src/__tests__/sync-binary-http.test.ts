// Hisabche Sync Binary over real HTTP (Fastify inject, the real routes, the
// real codec). Proves: JSON stays the default, `Accept` switches a pull to
// binary carrying the SAME page, a binary push reaches the same validation
// and service as JSON, and a malformed frame is a 400 before the handler.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  decodeFrame,
  decodePullPage,
  decodeSnapshotPage,
  encodeFrame,
  HSB_CONTENT_TYPE,
  Op,
  type WireValue,
} from '@hisabche/sync/wire'

const WS = '22222222-2222-4222-8222-222222222222'
const USER = '11111111-1111-4111-8111-111111111111'
const ENTITY = '44444444-4444-4444-8444-000000000001'

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: async () => undefined,
}))
vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (request: { tenancy: unknown }) => {
    request.tenancy = { workspaceId: WS, userId: USER, role: 'owner' }
  },
}))
vi.mock('../db', () => ({ supabase: {} }))

const sync = vi.hoisted(() => ({ pull: vi.fn(), push: vi.fn(), snapshot: vi.fn() }))
vi.mock('../services/sync.service', () => ({
  syncService: {
    pull: sync.pull,
    push: sync.push,
    snapshot: sync.snapshot,
    currentCursor: vi.fn(async () => 0),
  },
  SyncError: class extends Error {},
}))

const { syncRoutes } = await import('../routes/sync.routes')

const app = Fastify()
beforeAll(async () => {
  await app.register(syncRoutes)
  await app.ready()
})
afterAll(() => app.close())

const page = {
  changes: [
    {
      syncVersion: 41,
      entityType: 'product',
      entityId: ENTITY,
      operation: 'update',
      entityVersion: 3,
      data: { id: ENTITY, name: 'چای سبز', barcode: '0626123456789', sell_price: 60_000 },
    },
    {
      syncVersion: 42,
      entityType: 'customer',
      entityId: ENTITY,
      operation: 'delete',
      entityVersion: 2,
      data: null,
    },
  ],
  nextCursor: 42,
  hasMore: false,
  mustRehydrate: false,
}

beforeEach(() => {
  sync.pull.mockReset().mockResolvedValue(page)
  sync.snapshot.mockReset()
  sync.push.mockReset().mockResolvedValue({
    results: [
      {
        mutationId: ENTITY,
        status: 'applied',
        entityVersion: 1,
        duplicate: false,
        retryable: false,
      },
    ],
    currentCursor: 43,
  })
})

const pushBody = {
  deviceId: 'desktop-1',
  batchId: '55555555-5555-4555-8555-555555555555',
  mutations: [
    {
      mutationId: ENTITY,
      entityType: 'customer',
      entityId: ENTITY,
      operation: 'update',
      expectedVersion: 1,
      payload: { phone: '0799000000' },
    },
  ],
}

describe('GET /api/sync/pull', () => {
  it('JSON by default — every client already in the field keeps working', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sync/pull?cursor=40&limit=10' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/json')
    expect(res.json()).toEqual(page)
  })

  it('Accept: HSB → a binary frame carrying exactly the same page', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sync/pull?cursor=40&limit=10',
      headers: { accept: HSB_CONTENT_TYPE },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain(HSB_CONTENT_TYPE)
    expect(res.headers.vary).toContain('Accept')
    const bytes = new Uint8Array(res.rawPayload)
    expect(decodePullPage(bytes)).toEqual(page)
    expect(bytes.length).toBeLessThan(JSON.stringify(page).length)
  })

  it('a failed pull stays a 500 in either format — never an empty page', async () => {
    sync.pull.mockRejectedValueOnce(new Error('sync hydrate product failed: timeout'))
    const res = await app.inject({
      method: 'GET',
      url: '/api/sync/pull?cursor=40&limit=10',
      headers: { accept: HSB_CONTENT_TYPE },
    })
    expect(res.statusCode).toBe(500)
  })
})

describe('POST /api/sync/push', () => {
  it('a binary PUSH_BATCH reaches the same validation and service as JSON', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: { 'content-type': HSB_CONTENT_TYPE, accept: HSB_CONTENT_TYPE },
      payload: Buffer.from(encodeFrame(Op.PUSH_BATCH, pushBody as unknown as WireValue)),
    })
    expect(res.statusCode).toBe(200)
    expect(sync.push).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: WS, userId: USER, deviceId: 'desktop-1' }),
      pushBody.mutations,
    )
    const frame = decodeFrame(new Uint8Array(res.rawPayload))
    expect(frame.op).toBe(Op.PUSH_RESULT)
    expect(frame.body).toMatchObject({ currentCursor: 43, batchId: pushBody.batchId })
  })

  it('a binary body still goes through the zod schema (a bad batch is a 400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: { 'content-type': HSB_CONTENT_TYPE },
      payload: Buffer.from(encodeFrame(Op.PUSH_BATCH, { deviceId: 'x', mutations: [] })),
    })
    expect(res.statusCode).toBe(400)
    expect(sync.push).not.toHaveBeenCalled()
  })

  it('a malformed frame is a 400 before the handler runs', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: { 'content-type': HSB_CONTENT_TYPE },
      payload: Buffer.from([0x48, 0x53, 0x01, 0x02, 0xff, 0xff, 0xff, 0x7f, 0x09]),
    })
    expect(res.statusCode).toBe(400)
    expect(sync.push).not.toHaveBeenCalled()
  })

  it('a frame of the wrong kind (a PING as a push) is refused', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: { 'content-type': HSB_CONTENT_TYPE },
      payload: Buffer.from(encodeFrame(Op.PING, null)),
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/sync/snapshot', () => {
  const snap = {
    rows: [{ id: ENTITY, workspace_id: WS, version: 7, full_name: 'احمد', phone: null }],
    nextAfter: null,
    hasMore: false,
  }

  it('binary page carries the rows with their versions', async () => {
    sync.snapshot.mockResolvedValueOnce(snap)
    const res = await app.inject({
      method: 'GET',
      url: `/api/sync/snapshot?entity=customer&limit=100`,
      headers: { accept: HSB_CONTENT_TYPE },
    })
    expect(res.statusCode).toBe(200)
    expect(sync.snapshot).toHaveBeenCalledWith(WS, 'customer', null, 100)
    expect(decodeSnapshotPage(new Uint8Array(res.rawPayload))).toEqual(snap)
  })

  it('refuses an entity outside the list and a non-uuid cursor', async () => {
    expect(
      (await app.inject({ method: 'GET', url: '/api/sync/snapshot?entity=workspaces' })).statusCode,
    ).toBe(400)
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/sync/snapshot?entity=product&after=1%20OR%201=1',
        })
      ).statusCode,
    ).toBe(400)
    expect(sync.snapshot).not.toHaveBeenCalled()
  })

  it('a failed page is a 500, never an empty table', async () => {
    sync.snapshot.mockRejectedValueOnce(new Error('sync snapshot product failed'))
    expect(
      (await app.inject({ method: 'GET', url: '/api/sync/snapshot?entity=product' })).statusCode,
    ).toBe(500)
  })
})

describe('compression covers the binary type', () => {
  // The real value, not the source text (a formatter reflow broke a text read).
  it('compresses application/x-hisabche-sync and still skips event-stream', async () => {
    const { COMPRESSIBLE_TYPES } = await import('../utils/compress-types')
    expect(COMPRESSIBLE_TYPES.test(HSB_CONTENT_TYPE)).toBe(true)
    expect(COMPRESSIBLE_TYPES.test('application/json; charset=utf-8')).toBe(true)
    expect(COMPRESSIBLE_TYPES.test('text/event-stream')).toBe(false)
  })

  it('index.ts compresses with it', () => {
    const src = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8')
    expect(src).toContain('customTypes: COMPRESSIBLE_TYPES')
  })
})
