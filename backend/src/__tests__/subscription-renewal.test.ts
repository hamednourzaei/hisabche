// ============================================
// Subscription Renewal Integrity Tests
//
// Target E: Asserts that extendSubscriptionRow:
// 1. Resets start from NOW when expired in the past (does not leave customer expired).
// 2. Extends from current period_end when active (preserves remaining prepaid days).
// 3. Extends by 1 year for yearly subscriptions, 1 month for monthly.
// 4. Activates status and clears cancel_at_period_end.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const tables = new Map<string, Row[]>()

function rowsOf(table: string): Row[] {
  const existing = tables.get(table)
  if (existing) return existing
  const created: Row[] = []
  tables.set(table, created)
  return created
}

interface Filter {
  column: string
  value: unknown
}

function makeQuery(table: string) {
  const eqs: Filter[] = []
  let pendingUpdate: Row | null = null

  const matching = () => rowsOf(table).filter((row) => eqs.every((f) => row[f.column] === f.value))

  const api: Record<string, unknown> = {
    select: () => api,
    eq: (column: string, value: unknown) => {
      eqs.push({ column, value })
      return api
    },
    update: (values: Row) => {
      pendingUpdate = values
      const targets = matching()
      for (const row of targets) {
        Object.assign(row, values)
      }
      return api
    },
    single: async () => {
      const found = matching()[0]
      return found
        ? { data: found, error: null }
        : { data: null, error: { code: 'PGRST116', message: 'no rows' } }
    },
    then: (resolve: (v: { data: unknown; error: unknown }) => unknown) => {
      return Promise.resolve({ data: matching(), error: null }).then(resolve)
    },
  }

  return api
}

vi.mock('../db', () => ({
  supabase: {
    from: (t: string) => makeQuery(t),
  },
}))

vi.mock('../services/cache.service', () => ({
  cacheService: {
    del: vi.fn().mockResolvedValue(undefined),
    delPattern: vi.fn().mockResolvedValue(undefined),
    delByPattern: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('Target E: Subscription Renewal Integrity', () => {
  beforeEach(() => {
    tables.clear()
    vi.clearAllMocks()
  })

  it('renews expired subscription starting from NOW and grants full month', async () => {
    const { BillingService } = await import('../services/billing.service')
    const billing = new BillingService()

    // Expired 60 days ago
    const pastStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const pastEnd = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

    rowsOf('subscriptions').push({
      id: 'sub-expired-1',
      user_id: 'user-1',
      workspace_id: 'ws-1',
      plan: 'pro',
      status: 'canceled',
      cancel_at_period_end: true,
      period_start: pastStart,
      period_end: pastEnd,
    })

    const beforeCall = Date.now()
    await billing.extendSubscriptionRow('sub-expired-1')

    const updated = rowsOf('subscriptions').find((s) => s.id === 'sub-expired-1')!
    expect(updated.status).toBe('active')
    expect(updated.cancel_at_period_end).toBe(false)

    const updatedStart = new Date(updated.period_start as string).getTime()
    const updatedEnd = new Date(updated.period_end as string).getTime()

    // Must start from now (not from 60 days ago in the past)
    expect(updatedStart).toBeGreaterThanOrEqual(beforeCall - 1000)
    // Must end roughly 1 month in the future
    expect(updatedEnd).toBeGreaterThan(Date.now() + 27 * 24 * 60 * 60 * 1000)
  })

  it('renews active subscription by extending from current period_end without losing days', async () => {
    const { BillingService } = await import('../services/billing.service')
    const billing = new BillingService()

    // Active, ends 15 days in the future
    const activeStart = new Date().toISOString()
    const activeEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)

    rowsOf('subscriptions').push({
      id: 'sub-active-1',
      user_id: 'user-2',
      workspace_id: 'ws-2',
      plan: 'pro',
      status: 'active',
      cancel_at_period_end: false,
      period_start: activeStart,
      period_end: activeEnd.toISOString(),
    })

    await billing.extendSubscriptionRow('sub-active-1')

    const updated = rowsOf('subscriptions').find((s) => s.id === 'sub-active-1')!
    expect(updated.status).toBe('active')

    const updatedEnd = new Date(updated.period_end as string).getTime()
    // Should be extended from activeEnd by 1 month (~45 days from now)
    const expectedExtension = new Date(activeEnd)
    expectedExtension.setMonth(expectedExtension.getMonth() + 1)

    expect(Math.abs(updatedEnd - expectedExtension.getTime())).toBeLessThan(5000)
  })

  it('extends annual subscription by 1 full year', async () => {
    const { BillingService } = await import('../services/billing.service')
    const billing = new BillingService()

    // Annual plan expired 5 days ago
    const yearStart = new Date(Date.now() - 370 * 24 * 60 * 60 * 1000).toISOString()
    const yearEnd = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

    rowsOf('subscriptions').push({
      id: 'sub-annual-1',
      user_id: 'user-3',
      workspace_id: 'ws-3',
      plan: 'ONLINE_500',
      status: 'past_due',
      cancel_at_period_end: true,
      period_start: yearStart,
      period_end: yearEnd,
    })

    await billing.extendSubscriptionRow('sub-annual-1')

    const updated = rowsOf('subscriptions').find((s) => s.id === 'sub-annual-1')!
    expect(updated.status).toBe('active')

    const updatedStart = new Date(updated.period_start as string).getTime()
    const updatedEnd = new Date(updated.period_end as string).getTime()

    // Should extend 1 year (~365 days) from NOW
    const durationDays = (updatedEnd - updatedStart) / (24 * 60 * 60 * 1000)
    expect(durationDays).toBeGreaterThanOrEqual(364)
    expect(durationDays).toBeLessThanOrEqual(367)
  })
})
