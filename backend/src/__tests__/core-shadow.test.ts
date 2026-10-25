// ============================================
// backend/src/__tests__/core-shadow.test.ts
//
// The shadow check that now runs on POST /api/payments: does it catch a
// divergence, stay quiet when the core agrees, and obey the kill switch?
//
// ⚠️ WHY THIS FILE EXISTS AT ALL.
//
// `core-divergence.service.ts` had a suite that only ever called the service
// directly. Nothing proved that a REAL route could produce a divergence row, so
// «the kill switch works» was a claim about an unreachable class. These tests
// are against `verifyPaymentPosting`, the function the payments route calls.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const recorded: unknown[] = []

// ⚠️ DO NOT SPREAD THE CLASS. `{ ...CoreDivergenceService }` copies only own
// ENUMERABLE properties, and a class's static METHODS live on the constructor's
// prototype chain as non-enumerable — so the spread silently produced an object
// with no `setShadowMode`, no `getAuthority`, and every test in this file died
// with «CoreDivergenceService.setShadowMode is not a function».
//
// A subclass keeps EVERY real static method (they are inherited) and overrides
// only the one that talks to Supabase, so the state machine under test is the
// production one.
vi.mock('../services/core-divergence.service', async () => {
  const actual = await vi.importActual<typeof import('../services/core-divergence.service')>(
    '../services/core-divergence.service',
  )
  class TestCoreDivergenceService extends actual.CoreDivergenceService {
    static override async recordDivergence(record: unknown): Promise<void> {
      recorded.push(record)
    }
  }
  return { ...actual, CoreDivergenceService: TestCoreDivergenceService }
})

const { verifyPaymentPosting, comparePaymentPosting } = await import('../services/core-shadow')
const { CoreDivergenceService } = await import('../services/core-divergence.service')

const WORKSPACE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CONTEXT = {
  workspaceId: WORKSPACE_ID,
  userId: '11111111-1111-4111-8111-111111111111',
} as unknown as Parameters<typeof verifyPaymentPosting>[0]

/** A payment whose posting the core and the database agree on. */
const FACTS = {
  direction: 'in' as const,
  amount: 500,
  paymentRate: 1,
  allocations: [{ amount: 500, rate: null }],
  fee: 0,
}

const AGREEING = { cash: 500, party: 500, difference: 0, fee: 0 }

beforeEach(() => {
  recorded.length = 0
  CoreDivergenceService.setShadowMode(true)
  CoreDivergenceService.setKillSwitch('payment.record', false)
})

describe('shadow verification on the payment path', () => {
  it('records nothing when the stored posting matches the core', async () => {
    const outcome = await verifyPaymentPosting(CONTEXT, FACTS, AGREEING)
    expect(outcome.checked).toBe(true)
    expect(outcome.diverged).toBe(false)
    expect(recorded).toHaveLength(0)
  })

  it('⚠️ records exactly one divergence when the stored posting is wrong', async () => {
    const outcome = await verifyPaymentPosting(CONTEXT, FACTS, { ...AGREEING, cash: 501 })

    expect(outcome.diverged).toBe(true)
    expect(recorded).toHaveLength(1)

    const record = recorded[0] as {
      workspaceId: string
      capability: string
      command: string
      expectedOutput: { cash: number }
      actualOutput: { cash: number }
      diffSummary: string
      commandPayload: unknown
    }
    // It is tenant-scoped, and it names the capability and the real command.
    expect(record.workspaceId).toBe(WORKSPACE_ID)
    expect(record.capability).toBe('payment.record')
    expect(record.command).toBe('POST /api/payments')
    // Both answers are kept, so the row can be diagnosed without a rerun.
    expect(record.expectedOutput.cash).toBe(500)
    expect(record.actualOutput.cash).toBe(501)
    expect(record.diffSummary).toContain('cash')
    // The inputs are kept too — the row must be reproducible.
    expect(record.commandPayload).toMatchObject({ amount: 500 })
  })

  it('a fee the core books and the database does not is a divergence', async () => {
    const facts = { ...FACTS, fee: 10 }
    // `paymentPosting` nets the fee out of cash for an incoming payment.
    const outcome = await verifyPaymentPosting(CONTEXT, facts, {
      cash: 500,
      party: 500,
      difference: 0,
      fee: 0,
    })
    expect(outcome.diverged).toBe(true)
    expect(recorded).toHaveLength(1)
  })

  it('shadow off records nothing, even for a wrong posting', async () => {
    CoreDivergenceService.setShadowMode(false)
    const outcome = await verifyPaymentPosting(CONTEXT, FACTS, { ...AGREEING, cash: 999 })
    expect(outcome.checked).toBe(false)
    expect(outcome.reason).toBe('shadow_off')
    expect(recorded).toHaveLength(0)
  })

  it('⚠️ the kill switch stops verification and puts the capability back on the server path', async () => {
    CoreDivergenceService.setKillSwitch('payment.record', true)
    const outcome = await verifyPaymentPosting(CONTEXT, FACTS, { ...AGREEING, cash: 999 })
    expect(outcome.checked).toBe(false)
    expect(outcome.reason).toBe('kill_switch')
    expect(recorded).toHaveLength(0)
    // and the authority really moved
    expect(CoreDivergenceService.getAuthority('payment.record')).toBe('SERVER_LEGACY')
  })

  it('a core that cannot express the payment is not reported as a money divergence', async () => {
    const outcome = await verifyPaymentPosting(CONTEXT, { ...FACTS, amount: Number.NaN }, AGREEING)
    expect(outcome.checked).toBe(false)
    expect(outcome.reason).toBe('core_threw')
    expect(recorded).toHaveLength(0)
  })
})

describe('the comparison itself (pure, no database)', () => {
  it('an agreeing posting has no differences', () => {
    const result = comparePaymentPosting(FACTS, { cash: 500, party: 500, difference: 0, fee: 0 })
    expect('coreThrew' in result).toBe(false)
    if (!('coreThrew' in result)) expect(result.differences).toEqual([])
  })

  it('one minor unit of difference IS caught', () => {
    const result = comparePaymentPosting(FACTS, { cash: 500.01, party: 500, difference: 0, fee: 0 })
    if ('coreThrew' in result) throw new Error('threw')
    expect(result.differences).toHaveLength(1)
    expect(result.differences[0]).toContain('cash')
  })

  it('a float artefact below one minor unit is NOT a difference', () => {
    const result = comparePaymentPosting(FACTS, {
      cash: 500 + 1e-9,
      party: 500,
      difference: 0,
      fee: 0,
    })
    if ('coreThrew' in result) throw new Error('threw')
    expect(result.differences).toEqual([])
  })

  it('⚠️ a NaN amount is coreThrew, NOT a zero posting compared against reality', () => {
    // `round2` returns 0 for any non-finite input, so without the guard this
    // payment would derive a spotless zero posting and be reported as a
    // divergence the check itself invented.
    expect('coreThrew' in comparePaymentPosting({ ...FACTS, amount: Number.NaN }, AGREEING)).toBe(
      true,
    )
  })
})
