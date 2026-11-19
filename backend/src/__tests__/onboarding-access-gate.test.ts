// PART 7 hard access gate: a direct call to the dashboard entry must be
// refused for an incomplete account, and must fail closed on unreadable state.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyReply, FastifyRequest } from 'fastify'

type Read = { data: unknown; error: { code?: string; message?: string } | null }

const state: { read: Read } = { read: { data: null, error: null } }

vi.mock('../db', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async (): Promise<Read> => state.read,
        }),
      }),
    }),
  },
}))

const {
  requireOnboardingComplete,
  onboardingIsComplete,
  ONBOARDING_REQUIRED,
  ONBOARDING_STATE_UNAVAILABLE,
} = await import('../middleware/onboarding.middleware')

function fakeRequest(): FastifyRequest {
  return { userId: 'u1', log: { error: vi.fn() } } as unknown as FastifyRequest
}

function fakeReply() {
  const reply = {
    status: vi.fn(() => reply),
    send: vi.fn(() => reply),
  }
  return reply
}

beforeEach(() => {
  state.read = { data: null, error: null }
})

describe('server-side onboarding access gate (PART 7)', () => {
  it('a completed account reaches the dashboard', async () => {
    state.read = { data: { onboarding_completed_at: '2026-11-19T00:00:00Z' }, error: null }
    expect(await onboardingIsComplete('u1')).toBe(true)
    const reply = fakeReply()
    await requireOnboardingComplete(fakeRequest(), reply as unknown as FastifyReply)
    expect(reply.send).not.toHaveBeenCalled()
  })

  it('an incomplete account is refused with 428 ONBOARDING_REQUIRED', async () => {
    state.read = { data: { onboarding_completed_at: null }, error: null }
    const reply = fakeReply()
    await requireOnboardingComplete(fakeRequest(), reply as unknown as FastifyReply)
    expect(reply.status).toHaveBeenCalledWith(428)
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ code: ONBOARDING_REQUIRED }))
  })

  it('a missing migration column is NOT proof of completion', async () => {
    state.read = { data: null, error: { code: '42703', message: 'column does not exist' } }
    expect(await onboardingIsComplete('u1')).toBe(false)
    const reply = fakeReply()
    await requireOnboardingComplete(fakeRequest(), reply as unknown as FastifyReply)
    expect(reply.status).toHaveBeenCalledWith(428)
  })

  it('a database read failure fails closed with 503', async () => {
    state.read = { data: null, error: { message: 'db down' } }
    const reply = fakeReply()
    await requireOnboardingComplete(fakeRequest(), reply as unknown as FastifyReply)
    expect(reply.status).toHaveBeenCalledWith(503)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: ONBOARDING_STATE_UNAVAILABLE }),
    )
  })

  it('a request with no authenticated identity is 401', async () => {
    const reply = fakeReply()
    await requireOnboardingComplete({} as FastifyRequest, reply as unknown as FastifyReply)
    expect(reply.status).toHaveBeenCalledWith(401)
  })
})

describe('dashboard entry guard coverage', () => {
  it('every dashboard server entry carries the gate before the cache', () => {
    const source = readFileSync(path.join(__dirname, '../routes/analytics.routes.ts'), 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n')
    const routes = source
      .split(/(?=fastify\.get\()/)
      .filter((block) => block.includes("'/api/analytics/dashboard"))
    expect(routes.length).toBeGreaterThanOrEqual(5)
    for (const block of routes) {
      const gate = block.indexOf('requireOnboardingComplete')
      const cache = block.indexOf('cacheMiddleware')
      expect(gate, 'dashboard entry must be gated').toBeGreaterThan(-1)
      expect(gate).toBeLessThan(cache)
    }
  })
})
