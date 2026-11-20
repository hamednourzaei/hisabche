// PART 7 hard access gate: the completion timestamp is written only after the
// SERVER gathers its own facts and the shared predicate allows activation.
// A read failure fails closed — it is never treated as «onboarding done».

import { beforeEach, describe, expect, it, vi } from 'vitest'

type DbErr = { code?: string; message?: string } | null
type Read = { data: unknown; error: DbErr }

const state: {
  profile: Read
  members: Read
  workspace: Read
  fallback: Read
  workspaceCalls: number
} = {
  profile: { data: null, error: null },
  members: { data: null, error: null },
  workspace: { data: null, error: null },
  fallback: { data: null, error: null },
  workspaceCalls: 0,
}

interface Query {
  eq: (...args: unknown[]) => Query
  is: (...args: unknown[]) => Query
  order: (...args: unknown[]) => Query
  maybeSingle: () => Promise<Read>
  then: <T>(onfulfilled: (value: Read) => T) => Promise<T>
}

const readFor = (table: string): Read => {
  if (table === 'profiles') return state.profile
  if (table === 'workspace_members') return state.members
  if (table === 'workspaces') {
    state.workspaceCalls++
    const code = state.workspace.error?.code
    // First call sees the missing-column error; the service's retry gets the
    // reduced select, which succeeds on a database without base_currency.
    if (state.workspaceCalls > 1 && (code === '42703' || code === 'PGRST204')) {
      return state.fallback
    }
    return state.workspace
  }
  return { data: null, error: null }
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => ({
      select: (_columns: string): Query => {
        const q: Query = {
          eq: () => q,
          is: () => q,
          order: () => q,
          maybeSingle: async (): Promise<Read> => readFor(table),
          // supabase-js builders are thenable; the service awaits the builder
          // directly for the membership list, so the mock must be too.
          then: (onfulfilled) => Promise.resolve(readFor(table)).then(onfulfilled),
        }
        return q
      },
    }),
  },
}))

const { evaluateOnboardingGateForUser, gateAllowsActivation } =
  await import('../services/onboarding/activation-gate.service')

const okProfile = { data: { full_name: 'Ahmad', business_name: 'Shop' }, error: null }
const okMembers = {
  data: [{ workspace_id: 'ws-1', role: 'owner' }],
  error: null,
}
const okWorkspace = {
  data: {
    name: 'Shop',
    base_currency: 'AFN',
    onboarding_progress: {
      state: 'READY_TO_ACTIVATE',
      step: 8,
      answers: { defaultCurrency: 'AFN' },
    },
  },
  error: null,
}

beforeEach(() => {
  state.profile = { ...okProfile }
  state.members = { ...okMembers }
  state.workspace = { ...okWorkspace }
  state.fallback = { data: null, error: null }
  state.workspaceCalls = 0
})

describe('server-authoritative onboarding activation (PART 7)', () => {
  it('allows activation only when every server-owned prerequisite is present', async () => {
    const gate = await evaluateOnboardingGateForUser('u1')
    expect(gate.canActivate).toBe(true)
    expect(gate.missing).toEqual([])
    expect(gateAllowsActivation(gate)).toBe(true)
  })

  it('an account with no workspace cannot complete onboarding', async () => {
    state.members = { data: [], error: null }
    const gate = await evaluateOnboardingGateForUser('u1')
    expect(gate.missing).toContain('WORKSPACE')
    expect(gateAllowsActivation(gate)).toBe(false)
  })

  it('a workspace with no business name or books currency is not ready', async () => {
    state.workspace = {
      data: { name: null, base_currency: null, onboarding_progress: null },
      error: null,
    }
    const gate = await evaluateOnboardingGateForUser('u1')
    expect(gate.missing).toContain('WORKSPACE_PROFILE')
    expect(gate.missing).toContain('DEFAULT_CURRENCY')
  })

  it('a same-request full name satisfies IDENTITY via the override', async () => {
    state.profile = { data: { full_name: null, business_name: null }, error: null }
    const gate = await evaluateOnboardingGateForUser('u1', { fullName: 'Ahmad' })
    expect(gate.missing).not.toContain('IDENTITY')
    expect(gateAllowsActivation(gate)).toBe(true)
  })

  it('falls back to the progress currency when the base_currency column is not migrated', async () => {
    state.workspace = { data: null, error: { code: '42703', message: 'column does not exist' } }
    state.fallback = {
      data: {
        name: 'Shop',
        onboarding_progress: {
          state: 'READY_TO_ACTIVATE',
          step: 8,
          answers: { defaultCurrency: 'AFN' },
        },
      },
      error: null,
    }
    const gate = await evaluateOnboardingGateForUser('u1')
    expect(gate.canActivate).toBe(true)
    expect(gate.unreadable).toEqual([])
    expect(gateAllowsActivation(gate)).toBe(true)
  })

  it('a missing currency column with no fallback answer fails closed', async () => {
    state.workspace = { data: null, error: { code: '42703', message: 'column does not exist' } }
    state.fallback = { data: { name: 'Shop', onboarding_progress: null }, error: null }
    const gate = await evaluateOnboardingGateForUser('u1')
    expect(gate.missing).toContain('DEFAULT_CURRENCY')
    expect(gate.unreadable).toContain('WORKSPACE_CURRENCY_UNKNOWN')
    expect(gateAllowsActivation(gate)).toBe(false)
  })

  it('a failed profile read throws — unknown is never onboarding complete', async () => {
    state.profile = { data: null, error: { message: 'db down' } }
    await expect(evaluateOnboardingGateForUser('u1')).rejects.toThrow(
      'ONBOARDING_GATE_PROFILE_READ_FAILED',
    )
  })
})
