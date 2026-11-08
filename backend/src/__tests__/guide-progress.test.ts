// Owner request (8 Nov 2026): a guide read once never comes back — the
// person's progress is stored on the server (user-guide-progress-01).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state: {
  select: { data: unknown; error: { code?: string } | null }
  upsert: { error: { code?: string } | null }
  upserted: unknown[]
  options: unknown
  eqs: [string, unknown][]
} = {
  select: { data: [], error: null },
  upsert: { error: null },
  upserted: [],
  options: null,
  eqs: [],
}

vi.mock('../db', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (column: string, value: unknown) => {
          state.eqs.push([column, value])
          return Promise.resolve(state.select)
        },
      }),
      upsert: (rows: unknown[], options: unknown) => {
        state.upserted = rows
        state.options = options
        return Promise.resolve(state.upsert)
      },
    }),
  },
}))

const service = await import('../services/guide-progress.service')

beforeEach(() => {
  state.select = { data: [], error: null }
  state.upsert = { error: null }
  state.upserted = []
  state.options = null
  state.eqs = []
})

describe('guide progress — the person own rows', () => {
  it('reads only the caller rows and maps them', async () => {
    state.select = {
      data: [{ step_id: 'invoices-list', route_id: 'invoices', seen_at: '2026-11-08T00:00:00Z' }],
      error: null,
    }
    const result = await service.readGuideProgress('user-1')
    expect(state.eqs).toEqual([['user_id', 'user-1']])
    expect(result).toEqual({
      configured: true,
      steps: [{ stepId: 'invoices-list', routeId: 'invoices', seenAt: '2026-11-08T00:00:00Z' }],
    })
  })

  it('before the migration: «not configured», not a 500', async () => {
    state.select = { data: null, error: { code: '42P01' } }
    expect(await service.readGuideProgress('u')).toEqual({ configured: false, steps: [] })
    state.upsert = { error: { code: 'PGRST205' } }
    expect(await service.markGuideStepsSeen('u', [{ stepId: 'a', routeId: 'b' }])).toEqual({
      configured: false,
    })
  })

  it('a real read error is an error, never «nothing seen»', async () => {
    state.select = { data: null, error: { code: '57014' } }
    await expect(service.readGuideProgress('u')).rejects.toThrow('Failed to read guide progress')
  })

  it('marking is append-only and idempotent (ignore duplicates, first time kept)', async () => {
    await service.markGuideStepsSeen('user-1', [{ stepId: 'invoices-list', routeId: 'invoices' }])
    expect(state.upserted).toEqual([
      { user_id: 'user-1', step_id: 'invoices-list', route_id: 'invoices' },
    ])
    expect(state.options).toEqual({ onConflict: 'user_id,step_id', ignoreDuplicates: true })
  })
})

describe('routes', () => {
  const routes = readFileSync(join(__dirname, '..', 'routes', 'guide-progress.routes.ts'), 'utf8')
  const index = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8')
  it('the owner is the session, never the body', () => {
    expect(routes).toContain('request.userId')
    expect(routes).not.toMatch(/body\.userId|request\.params/)
  })
  it('is registered and the write is rate limited', () => {
    expect(index).toContain('await server.register(guideProgressRoutes)')
    expect(routes.match(/rateLimit:/g)?.length).toBe(1)
  })
})
