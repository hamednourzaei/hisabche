// cacheMiddleware scope 'member' (27 Sep 2026): private to one person inside
// one workspace. Two workspaces of the same user must be two keys, and the key
// must start with the user so `<prefix>:<user>:*` invalidation still clears it.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, unknown>()
vi.mock('../services/cache.service', () => ({
  cacheService: {
    get: async (k: string) => (store.has(k) ? store.get(k) : null),
    set: async (k: string, v: unknown) => {
      store.set(k, v)
    },
  },
}))

const { cacheMiddleware } = await import('../middleware/cache.middleware')

function fakeReply() {
  const headers: Record<string, string> = {}
  const reply = {
    statusCode: 200,
    sent: undefined as unknown,
    header(k: string, v: string) {
      headers[k] = v
      return reply
    },
    status(code: number) {
      reply.statusCode = code
      return reply
    },
    send(payload: unknown) {
      reply.sent = payload
      return reply
    },
    headers,
  }
  return reply
}

async function run(workspaceId: string | undefined, payload: unknown) {
  const request = {
    method: 'GET',
    url: '/api/v1/activities?limit=20',
    userId: 'u1',
    tenancy: workspaceId ? { workspaceId, userId: 'u1', role: 'owner' } : undefined,
    log: { error: vi.fn() },
  }
  const reply = fakeReply()
  const mw = cacheMiddleware({ scope: 'member', keyPrefix: 'activities', ttl: 30 })
  await mw(request as never, reply as never)
  if (reply.headers['X-Cache'] === 'MISS') reply.send(payload)
  return reply
}

beforeEach(() => store.clear())

describe("cacheMiddleware scope 'member'", () => {
  it('keys by user first, then workspace', async () => {
    await run('ws-a', { feed: 'A' })
    expect([...store.keys()]).toEqual(['activities:u1:ws-a:/api/v1/activities?limit=20'])
  })

  it('the same user in another workspace gets a MISS, never the first book', async () => {
    await run('ws-a', { feed: 'A' })
    const b = await run('ws-b', { feed: 'B' })
    expect(b.headers['X-Cache']).toBe('MISS')
    expect(b.sent).toEqual({ feed: 'B' })
    const again = await run('ws-a', { feed: 'ignored' })
    expect(again.sent).toEqual({ feed: 'A' })
  })

  it('without a resolved workspace it refuses (fails closed)', async () => {
    const r = await run(undefined, {})
    expect(r.statusCode).toBe(500)
    expect(store.size).toBe(0)
  })
})
