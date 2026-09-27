// ============================================
// A hidden tab does not hold realtime channels (27 Sep 2026).
//
// Each open postgres_changes channel keeps Supabase polling the replication
// slot (`realtime.list_changes`, ~90k calls in pg_stat_statements). After a
// grace period hidden, channels close; listeners stay; on return every
// channel reopens and every listener is told once, so nothing is missed.
// ============================================

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let visibility: 'visible' | 'hidden' = 'visible'
const visibilityListeners: Array<() => void> = []

beforeAll(() => {
  const g = globalThis as { window?: unknown; document?: unknown }
  if (typeof g.window === 'undefined') g.window = globalThis
  g.document = {
    get visibilityState() {
      return visibility
    },
    addEventListener(type: string, fn: () => void) {
      if (type === 'visibilitychange') visibilityListeners.push(fn)
    },
  }
})

function setVisibility(next: 'visible' | 'hidden') {
  visibility = next
  for (const fn of visibilityListeners) fn()
}

interface FakeChannel {
  name: string
  removed: boolean
}
const channels: FakeChannel[] = []

vi.mock('../../../auth/src/supabase', () => ({
  supabaseClient: {
    channel(name: string) {
      const created: FakeChannel = { name, removed: false }
      channels.push(created)
      const api = {
        on() {
          return api
        },
        subscribe() {
          return created
        },
      }
      return api
    },
    removeChannel(channel: FakeChannel) {
      channel.removed = true
      return Promise.resolve('ok')
    },
  },
  setSupabaseTokenSource() {},
}))

const { subscribeToChannel, realtimeStats, HIDDEN_GRACE_MS, __resetRealtimeForTests } =
  await import('../supabase/realtime')

const open = () => channels.filter((c) => !c.removed).length

beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  channels.length = 0
  __resetRealtimeForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('realtime in a hidden tab', () => {
  it('a short switch away keeps the channels (no churn)', async () => {
    await subscribeToChannel('invoices', 'ws', () => {})
    setVisibility('hidden')
    vi.advanceTimersByTime(HIDDEN_GRACE_MS - 1)
    setVisibility('visible')
    vi.advanceTimersByTime(HIDDEN_GRACE_MS * 2)
    expect(open()).toBe(1)
    expect(channels).toHaveLength(1)
  })

  it('hidden past the grace period: channels close, listeners stay', async () => {
    await subscribeToChannel('invoices', 'ws', () => {})
    await subscribeToChannel('products', 'ws', () => {})
    setVisibility('hidden')
    vi.advanceTimersByTime(HIDDEN_GRACE_MS)
    expect(open()).toBe(0)
    expect(realtimeStats()).toEqual({ channels: 0, listeners: 2 })
  })

  it('visible again: channels reopen and every listener refetches once', async () => {
    const onInvoices = vi.fn()
    const onProducts = vi.fn()
    await subscribeToChannel('invoices', 'ws', onInvoices)
    await subscribeToChannel('products', 'ws', onProducts)
    setVisibility('hidden')
    vi.advanceTimersByTime(HIDDEN_GRACE_MS)
    setVisibility('visible')

    expect(open()).toBe(2)
    expect(onInvoices).toHaveBeenCalledTimes(1)
    expect(onProducts).toHaveBeenCalledTimes(1)
  })

  it('a subscriber that arrives while paused opens nothing until the tab is back', async () => {
    await subscribeToChannel('invoices', 'ws', () => {})
    setVisibility('hidden')
    vi.advanceTimersByTime(HIDDEN_GRACE_MS)
    await subscribeToChannel('customers', 'ws', () => {})
    expect(open()).toBe(0)
    setVisibility('visible')
    expect(open()).toBe(2)
  })

  it('unsubscribing while paused closes nothing twice and leaves nothing behind', async () => {
    const sub = await subscribeToChannel('invoices', 'ws', () => {})
    setVisibility('hidden')
    vi.advanceTimersByTime(HIDDEN_GRACE_MS)
    sub.unsubscribe()
    setVisibility('visible')
    expect(realtimeStats()).toEqual({ channels: 0, listeners: 0 })
    expect(open()).toBe(0)
  })
})
