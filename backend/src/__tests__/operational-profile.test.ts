// ============================================
// V54 5.2 / 5.3 — the workspace's Operational DNA and onboarding progress.
//
// The database is replaced; the rules proved here are the service's own:
//   · before the migration: reads answer `configurable: false`, writes say
//     OPERATIONAL_PROFILE_NOT_CONFIGURED (never a fake success);
//   · a DNA that does not parse never reaches the database;
//   · the DNA is written ONLY through the versioned RPC, with the version read;
//   · a stale version is refused by name (409), not overwritten;
//   · onboarding progress is a closed shape — no free JSON reaches the column.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type DbError = { code?: string; message?: string } | null
const state: {
  row: Record<string, unknown> | null
  /** Per-table overrides (profiles activation read, workspaces recency read). */
  rows: Record<string, Record<string, unknown> | null>
  readError: DbError
  rpcError: DbError
  rpcData: unknown
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>
  updates: Array<Record<string, unknown>>
  updateError: DbError
} = {
  row: null,
  rows: {},
  readError: null,
  rpcError: null,
  rpcData: null,
  rpcCalls: [],
  updates: [],
  updateError: null,
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table in state.rows ? state.rows[table] : state.row,
            error: state.readError,
          }),
        }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: () => ({
          select: async () => {
            if (!state.updateError) state.updates.push(values)
            return { data: state.updateError ? null : [{ id: 'ws' }], error: state.updateError }
          },
        }),
      }),
    }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args })
      return { data: state.rpcError ? null : state.rpcData, error: state.rpcError }
    },
  },
}))

const { operationalProfileOf, setOperationalDna, setOnboardingProgress } =
  await import('../services/workspace-profile')
const { ARCHETYPE_PRESETS } = await import('@hisabche/validation')

const DNA = ARCHETYPE_PRESETS.NAIL_TECH_BEAUTY ?? Object.values(ARCHETYPE_PRESETS)[0]

beforeEach(() => {
  state.row = null
  state.rows = {}
  state.readError = null
  state.rpcError = null
  state.rpcData = { version: 1, replayed: false }
  state.rpcCalls = []
  state.updates = []
  state.updateError = null
})

describe('operationalProfileOf', () => {
  it('before the migration: not configurable, nothing invented', async () => {
    state.readError = { code: '42703', message: 'column does not exist' }
    expect(await operationalProfileOf('ws')).toEqual({
      configurable: false,
      dna: null,
      composition: null,
      version: 0,
      onboarding: null,
      dnaInvalid: false,
      onboardingInvalid: false,
    })
  })

  it('a failed read for any other reason is an error, not «empty»', async () => {
    state.readError = { code: '57014', message: 'timeout' }
    await expect(operationalProfileOf('ws')).rejects.toThrow()
  })

  it('a stored value that no longer parses is reported as invalid, not silently absent', async () => {
    state.row = {
      operational_dna: { offering: 'x' },
      operational_dna_version: 3,
      onboarding_progress: null,
    }
    const view = await operationalProfileOf('ws')
    expect(view.dna).toBeNull()
    expect(view.dnaInvalid).toBe(true)
    expect(view.version).toBe(3)
  })
})

describe('setOperationalDna', () => {
  it('writes through the versioned RPC with the version the caller read', async () => {
    const saved = await setOperationalDna('ws', 'u1', DNA, 4)
    expect(saved).toEqual({ version: 1, replayed: false })
    expect(state.rpcCalls).toHaveLength(1)
    expect(state.rpcCalls[0]?.fn).toBe('workspace_set_operational_dna')
    expect(state.rpcCalls[0]?.args).toMatchObject({
      p_workspace_id: 'ws',
      p_actor: 'u1',
      p_expected_version: 4,
    })
    expect(state.updates).toHaveLength(0)
  })

  it('an invalid DNA never reaches the database', async () => {
    await expect(setOperationalDna('ws', 'u1', { offering: [] }, 0)).rejects.toThrow(
      'OPERATIONAL_DNA_INVALID',
    )
    expect(state.rpcCalls).toHaveLength(0)
  })

  it('a stale version is refused by name', async () => {
    state.rpcError = { code: 'P0001', message: 'OPERATIONAL_PROFILE_CHANGED' }
    await expect(setOperationalDna('ws', 'u1', DNA, 0)).rejects.toMatchObject({
      message: 'OPERATIONAL_PROFILE_CHANGED',
    })
  })

  it('without the function: NOT_CONFIGURED, not success', async () => {
    state.rpcError = {
      code: 'PGRST202',
      message: 'Could not find the function public.workspace_set_operational_dna',
    }
    await expect(setOperationalDna('ws', 'u1', DNA, 0)).rejects.toThrow(
      'OPERATIONAL_PROFILE_NOT_CONFIGURED',
    )
  })
})

describe('setOnboardingProgress', () => {
  it('stores the closed shape', async () => {
    const progress = {
      state: 'IN_PROGRESS' as const,
      step: 2,
      answers: { businessType: 'barber', storeSize: null, defaultCurrency: 'AFN' },
    }
    expect(await setOnboardingProgress('ws', progress, 'u1')).toEqual(progress)
    expect(state.updates).toEqual([{ onboarding_progress: progress }])
  })

  it.each([
    { state: 'DONE', step: 1, answers: {} },
    { state: 'IN_PROGRESS', step: 99, answers: {} },
    { state: 'IN_PROGRESS', step: 1, answers: { secret: 'x' } },
    { state: 'IN_PROGRESS', step: 1, answers: {}, extra: true },
  ])('refuses %j without writing', async (bad) => {
    await expect(setOnboardingProgress('ws', bad, 'u1')).rejects.toThrow(
      'ONBOARDING_PROGRESS_INVALID',
    )
    expect(state.updates).toHaveLength(0)
  })

  // ─── Forensic remediation R1 (F-101/F-039) ───────────────────────────────

  it('⚠️ a client cannot claim ACTIVE for an account the gate never completed', async () => {
    state.rows['profiles'] = { onboarding_completed_at: null }
    const progress = { state: 'ACTIVE' as const, step: 0, answers: {} }
    await expect(setOnboardingProgress('ws', progress, 'u1')).rejects.toThrow(
      'ONBOARDING_STATE_SERVER_ONLY',
    )
    expect(state.updates).toHaveLength(0)
  })

  it('⚠️ READY_TO_ACTIVATE is server-derived too', async () => {
    state.rows['profiles'] = { onboarding_completed_at: null }
    const progress = { state: 'READY_TO_ACTIVATE' as const, step: 5, answers: {} }
    await expect(setOnboardingProgress('ws', progress, 'u1')).rejects.toThrow(
      'ONBOARDING_STATE_SERVER_ONLY',
    )
    expect(state.updates).toHaveLength(0)
  })

  it('ACTIVE is recorded once the account IS activated', async () => {
    state.rows['profiles'] = { onboarding_completed_at: '2026-11-22T00:00:00.000Z' }
    const progress = { state: 'ACTIVE' as const, step: 0, answers: {} }
    expect(await setOnboardingProgress('ws', progress, 'u1')).toEqual(progress)
    expect(state.updates).toEqual([{ onboarding_progress: progress }])
  })

  it('⚠️ a strictly older draft never overwrites a newer one', async () => {
    state.row = {
      onboarding_progress: {
        state: 'IN_PROGRESS',
        step: 4,
        answers: { savedAt: 2000 },
      },
    }
    const older = {
      state: 'IN_PROGRESS' as const,
      step: 2,
      answers: { savedAt: 1000 },
    }
    await expect(setOnboardingProgress('ws', older, 'u1')).rejects.toThrow(
      'ONBOARDING_PROGRESS_STALE',
    )
    expect(state.updates).toHaveLength(0)
  })

  it('an equal-timestamp replay is idempotent, a newer draft wins', async () => {
    state.row = {
      onboarding_progress: {
        state: 'IN_PROGRESS',
        step: 4,
        answers: { savedAt: 2000 },
      },
    }
    const replay = { state: 'IN_PROGRESS' as const, step: 4, answers: { savedAt: 2000 } }
    expect(await setOnboardingProgress('ws', replay, 'u1')).toEqual(replay)
    const newer = { state: 'IN_PROGRESS' as const, step: 5, answers: { savedAt: 3000 } }
    expect(await setOnboardingProgress('ws', newer, 'u1')).toEqual(newer)
    expect(state.updates).toHaveLength(2)
  })

  it('the draft carries the note, the explicit primary and the save time', async () => {
    const progress = {
      state: 'IN_PROGRESS' as const,
      step: 2,
      answers: {
        businessType: 'barber,grocery',
        primaryTradeKey: 'barber',
        businessNote: 'یک کسب‌وکار دو فعالیتی',
        savedAt: 1234,
      },
    }
    expect(await setOnboardingProgress('ws', progress, 'u1')).toEqual(progress)
  })

  it('operationalProfileOf returns the computed composition plan alongside stored DNA', async () => {
    state.row = {
      operational_dna: DNA,
      operational_dna_version: 2,
      onboarding_progress: null,
    }
    const view = await operationalProfileOf('ws')
    expect(view.dna).toEqual(DNA)
    expect(view.composition).not.toBeNull()
    expect(view.composition?.problems.length).toBeGreaterThan(0)
    expect(view.composition?.plan.capabilities.capabilities.length).toBeGreaterThan(0)
  })
})
