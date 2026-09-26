// The live CPU/RAM bar at the top of /docs. Public by the owner's decision —
// percentages, uptime and in-flight requests only.
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => {
  const query: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'limit']) query[m] = () => query
  query.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null })
  const supabase = {
    auth: { getUser: async () => ({ data: { user: null }, error: {} }) },
    from: () => query,
  }
  return {
    supabase,
    default: supabase,
    checkDatabaseConnection: async () => true,
    dbStats: {},
    withConnection: async <T>(fn: () => Promise<T>) => fn(),
  }
})

let app: FastifyInstance
let base = ''

beforeAll(async () => {
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.listen({ port: 0, host: '127.0.0.1' })
  const address = app.server.address()
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
}, 60_000)

afterAll(async () => {
  await app?.close()
})

describe('GET /api/system/metrics', () => {
  it('is public and returns percentages only — no host, version or bytes', async () => {
    const res = await fetch(`${base}/api/system/metrics`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body).sort()).toEqual([
      'at',
      'cpuPercent',
      'inflightRequests',
      'memoryPercent',
      'uptimeSeconds',
    ])
    expect(body.cpuPercent).toBeGreaterThanOrEqual(0)
    expect(body.cpuPercent).toBeLessThanOrEqual(100)
    expect(body.memoryPercent).toBeGreaterThan(0)
    expect(body.memoryPercent).toBeLessThanOrEqual(100)
  })
})

describe('GET /api/system/metrics/stream', () => {
  it('streams samples as Server-Sent Events', async () => {
    const controller = new AbortController()
    const res = await fetch(`${base}/api/system/metrics/stream`, { signal: controller.signal })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const reader = res.body!.getReader()
    const { value } = await reader.read()
    controller.abort()
    expect(new TextDecoder().decode(value)).toMatch(/^data: \{.*"cpuPercent"/)
  }, 15_000)

  it('⚠️ a closed stream does not stay counted as an in-flight request', async () => {
    for (let i = 0; i < 3; i++) {
      const controller = new AbortController()
      const res = await fetch(`${base}/api/system/metrics/stream`, { signal: controller.signal })
      await res.body!.getReader().read()
      controller.abort()
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
    const body = await (await fetch(`${base}/api/system/metrics`)).json()
    // Only this request itself may be in flight.
    expect(body.inflightRequests).toBeLessThanOrEqual(1)
  }, 30_000)
})
