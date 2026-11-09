// Audit L-03 (8 Nov 2026): /billing and the write lock must judge the SAME row.
// A workspace with no row of its own used to show the ACTING user's plan on
// /billing, while the 402 lock judged the OWNER's.
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const subscriptions: Row[] = []
const workspaces: Row[] = []

function builder(rows: Row[]) {
  const filters: Array<(r: Row) => boolean> = []
  const q = {
    select: () => q,
    eq: (col: string, val: unknown) => {
      filters.push((r) => r[col] === val)
      return q
    },
    order: () => q,
    limit: () => q,
    maybeSingle: async () => ({
      data: rows.filter((r) => filters.every((f) => f(r)))[0] ?? null,
      error: null,
    }),
    insert: () => q,
    single: async () => ({ data: null, error: { message: 'insert not expected' } }),
  }
  return q
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => builder(table === 'workspaces' ? workspaces : subscriptions),
  },
}))

const { BillingService } = await import('../services/billing.service')

const OWNER = '11111111-1111-4111-8111-111111111111'
const MEMBER = '22222222-2222-4222-8222-222222222222'
const WS = '33333333-3333-4333-8333-333333333333'
const future = new Date(Date.now() + 30 * 86_400_000).toISOString()
const past = new Date(Date.now() - 30 * 86_400_000).toISOString()

describe('one rule for a workspace subscription', () => {
  beforeEach(() => {
    subscriptions.length = 0
    workspaces.length = 0
    workspaces.push({ id: WS, owner_id: OWNER })
    // The owner's legacy row (no workspace) has EXPIRED; the member's own row is active.
    subscriptions.push(
      {
        id: 'sub-owner',
        user_id: OWNER,
        workspace_id: null,
        plan: 'basic',
        status: 'active',
        period_end: past,
        is_trial: false,
        created_at: '2026-01-01',
      },
      {
        id: 'sub-member',
        user_id: MEMBER,
        workspace_id: null,
        plan: 'enterprise',
        status: 'active',
        period_end: future,
        is_trial: false,
        created_at: '2026-01-01',
      },
    )
  })

  it('a member sees the owner subscription, the same row the lock judges', async () => {
    const service = new BillingService()
    const shown = await service.getCurrentSubscription(MEMBER, WS)
    const access = await service.getWorkspaceAccess(WS)

    expect(shown.id).toBe('sub-owner')
    expect(access.expired).toBe(true)
  })
})
