// Audit L-02 (8 Nov 2026): the trial-expiry worker.
//  · ends a trial only after the grace window /billing promises;
//  · expires ONE subscription by id, never every row of the person;
//  · queues the existing trial-expired mail with the address from Supabase Auth;
//  · puts the in-app notice in the trial's own workspace.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: { table: string; op: string; args: unknown[] }[] = []
let trialRows: Record<string, unknown>[] = []

function chain(table: string, op: string) {
  const q: Record<string, unknown> = {}
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push({ table, op: name, args })
      return q
    }
  for (const m of ['select', 'eq', 'lt', 'in', 'update']) q[m] = record(m)
  q.then = (resolve: (v: unknown) => void) =>
    resolve(op === 'select' ? { data: trialRows, error: null } : { data: null, error: null })
  return q
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => ({
      select: (...args: unknown[]) => {
        calls.push({ table, op: 'select', args })
        return chain(table, 'select')
      },
      update: (...args: unknown[]) => {
        calls.push({ table, op: 'update', args })
        return chain(table, 'update')
      },
      insert: async (...args: unknown[]) => {
        calls.push({ table, op: 'insert', args })
        return { error: null }
      },
    }),
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { email: 'owner@example.test', user_metadata: { full_name: 'Owner' } } },
          error: null,
        }),
      },
    },
  },
}))

const sendTrialExpired = vi.fn(async () => ({ success: true }))
vi.mock('../services/email.service', () => ({ emailService: { sendTrialExpired } }))

const { TrialExpirationWorker, trialCutoff } = await import('../workers/trial-expiration.worker')

const NOW = new Date('2026-11-08T00:00:00.000Z')

describe('trial expiration worker', () => {
  beforeEach(() => {
    calls.length = 0
    sendTrialExpired.mockClear()
    trialRows = [
      {
        id: 'sub-1',
        user_id: 'user-1',
        workspace_id: 'ws-1',
        plan: 'pro',
        trial_ends_at: '2026-10-20T00:00:00.000Z',
      },
    ]
  })

  it('selects only trials whose grace window is over', async () => {
    await new TrialExpirationWorker().run(NOW)
    const lt = calls.find((c) => c.table === 'subscriptions' && c.op === 'lt')
    expect(lt?.args).toEqual(['trial_ends_at', trialCutoff(NOW)])
    expect(trialCutoff(NOW)).toBe('2026-11-01T00:00:00.000Z')
  })

  it('expires the one subscription by id, only while it is a trial', async () => {
    const result = await new TrialExpirationWorker().run(NOW)
    expect(result.expired).toBe(1)
    const eqs = calls.filter((c) => c.table === 'subscriptions' && c.op === 'eq').map((c) => c.args)
    expect(eqs).toContainEqual(['id', 'sub-1'])
    expect(eqs).toContainEqual(['is_trial', true])
    expect(eqs).not.toContainEqual(['user_id', 'user-1'])
  })

  it('queues the trial-expired mail and never reads a users table', async () => {
    await new TrialExpirationWorker().run(NOW)
    expect(sendTrialExpired).toHaveBeenCalledWith('owner@example.test', 'Owner')
    expect(calls.some((c) => c.table === 'users')).toBe(false)
  })

  it('writes the in-app notice into the trial workspace', async () => {
    await new TrialExpirationWorker().run(NOW)
    const notice = calls.find((c) => c.table === 'notifications' && c.op === 'insert')
    expect(notice?.args[0]).toMatchObject({ user_id: 'user-1', workspace_id: 'ws-1' })
  })
})
