// The admin «servers» page: live instances from heartbeats, and Render scaling.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, unknown>()
let shared = true
vi.mock('../services/cache.service', () => ({
  cacheService: {
    get isShared() {
      return shared
    },
    async set(key: string, value: unknown) {
      store.set(key, value)
      return true
    },
    async get(key: string) {
      return store.get(key) ?? null
    },
    async keys(pattern: string) {
      const prefix = pattern.replace(/\*$/, '')
      return [...store.keys()].filter((k) => k.startsWith(prefix))
    },
  },
}))

const registry = await import('../services/instance-registry')
const scaling = await import('../services/render-scaling')

beforeEach(() => {
  store.clear()
  shared = true
})
afterEach(() => {
  registry.stopInstanceHeartbeat()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('heartbeats', () => {
  it('this instance reports itself — CPU/RAM percentages, no GPU invented, no hostname', async () => {
    registry.startInstanceHeartbeat(() => 3)
    await new Promise((resolve) => setTimeout(resolve, 20))
    const { shared: isShared, instances } = await registry.listInstances()
    expect(isShared).toBe(true)
    expect(instances).toHaveLength(1)
    const [me] = instances
    expect(me).toMatchObject({
      id: registry.INSTANCE_LABEL,
      gpuPercent: null,
      inflightRequests: 3,
      isSelf: true,
    })
    expect(me!.id).toMatch(/^[0-9a-f]{8}$/)
    expect(JSON.stringify(me)).not.toContain(require('node:os').hostname())
  })

  it('other instances are listed from their own heartbeats', async () => {
    store.set('instance:heartbeat:aaaaaaaa', {
      id: 'aaaaaaaa',
      cpuPercent: 40,
      memoryPercent: 50,
      gpuPercent: null,
    })
    store.set('instance:heartbeat:bbbbbbbb', {
      id: 'bbbbbbbb',
      cpuPercent: 10,
      memoryPercent: 20,
      gpuPercent: null,
    })
    const { instances } = await registry.listInstances()
    expect(instances.map((i) => i.id)).toEqual(['aaaaaaaa', 'bbbbbbbb'])
  })
})

describe('Render scaling', () => {
  it('without RENDER_API_KEY / RENDER_SERVICE_ID: not configured — never a fake answer', async () => {
    vi.stubEnv('RENDER_API_KEY', '')
    vi.stubEnv('RENDER_SERVICE_ID', '')
    expect(scaling.isScalingConfigured()).toBe(false)
    await expect(scaling.getInstanceCount()).rejects.toMatchObject({
      code: 'SCALING_NOT_CONFIGURED',
      status: 503,
    })
  })

  it("reads the count and scales through Render's API, as that service", async () => {
    vi.stubEnv('RENDER_API_KEY', 'rnd_test')
    vi.stubEnv('RENDER_SERVICE_ID', 'srv-abc')
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/scale')
        ? new Response(null, { status: 202 })
        : new Response(JSON.stringify({ serviceDetails: { numInstances: 1 } }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    expect(await scaling.getInstanceCount()).toBe(1)
    await scaling.setInstanceCount(2)
    const [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.render.com/v1/services/srv-abc/scale')
    expect(JSON.parse(init.body as string)).toEqual({ numInstances: 2 })
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer rnd_test')
  })

  it.each([0, 6, 1.5, Number.NaN])('refuses %s instances', async (count) => {
    vi.stubEnv('RENDER_API_KEY', 'rnd_test')
    vi.stubEnv('RENDER_SERVICE_ID', 'srv-abc')
    await expect(scaling.setInstanceCount(count)).rejects.toMatchObject({
      code: 'SCALING_OUT_OF_RANGE',
    })
  })

  it("a Render refusal comes back with Render's reason", async () => {
    vi.stubEnv('RENDER_API_KEY', 'rnd_test')
    vi.stubEnv('RENDER_SERVICE_ID', 'srv-abc')
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response('{"message":"plan does not support scaling"}', { status: 400 }),
      ),
    )
    await expect(scaling.setInstanceCount(2)).rejects.toMatchObject({
      code: 'SCALING_PROVIDER_ERROR',
      detail: expect.stringContaining('plan does not support scaling'),
    })
  })
})
