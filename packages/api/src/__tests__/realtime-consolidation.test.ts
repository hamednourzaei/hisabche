// ============================================
// Realtime channel consolidation.
//
// The property under test is a cost property, and cost regressions are silent:
// if a future hook goes back to opening its own channel, nothing breaks, the
// bill just grows and the free-tier message budget drains. So the sharing is
// pinned here rather than left to review.
//
// Supabase is faked. The assertions are about how many channels this module
// opens and closes, which is exactly what the real client would be asked to do.
// ============================================

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// `subscribeToChannel` no-ops off the browser, which is correct — there is no
// realtime to hold during SSR. This package has no jsdom, so rather than pull
// one in for a module that touches no DOM, the test simply declares that it is
// running in a browser context.
beforeAll(() => {
  if (typeof globalThis.window === 'undefined') {
    ;(globalThis as { window?: unknown }).window = globalThis
  }
})

interface FakeChannel {
  name: string
  handler: (() => void) | null
  removed: boolean
}

const channels: FakeChannel[] = []

vi.mock('../../../auth/src/supabase', () => ({
  supabaseClient: {
    channel(name: string) {
      const created: FakeChannel = { name, handler: null, removed: false }
      channels.push(created)

      const api = {
        on(_event: string, _filter: unknown, handler: () => void) {
          created.handler = handler
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
}))

const { subscribeToChannel, realtimeStats, __resetRealtimeForTests } =
  await import('../supabase/realtime')

function fire(table: string): void {
  const live = channels.filter((c) => c.name === `hisabche-${table}` && !c.removed)
  for (const channel of live) channel.handler?.()
}

beforeEach(() => {
  __resetRealtimeForTests()
  channels.length = 0
})

describe('one channel per table, however many subscribers', () => {
  it('opens a single channel for four subscribers to the same table', async () => {
    // This is the dashboard's real shape: KPIs, insights, sales and the
    // invoice list all want to know when `invoices` changes.
    await subscribeToChannel('invoices', () => {})
    await subscribeToChannel('invoices', () => {})
    await subscribeToChannel('invoices', () => {})
    await subscribeToChannel('invoices', () => {})

    expect(realtimeStats()).toEqual({ channels: 1, listeners: 4 })
    expect(channels.filter((c) => !c.removed)).toHaveLength(1)
  })

  it('still notifies every subscriber — the bug the old code was avoiding', async () => {
    const calls: string[] = []
    await subscribeToChannel('invoices', () => calls.push('kpis'))
    await subscribeToChannel('invoices', () => calls.push('insights'))
    await subscribeToChannel('invoices', () => calls.push('list'))

    fire('invoices')

    expect(calls.sort()).toEqual(['insights', 'kpis', 'list'])
  })

  it('keeps separate tables on separate channels', async () => {
    await subscribeToChannel('invoices', () => {})
    await subscribeToChannel('customers', () => {})
    await subscribeToChannel('products', () => {})

    expect(realtimeStats().channels).toBe(3)
  })
})

describe('teardown', () => {
  it('keeps the channel open while any subscriber remains', async () => {
    const first = await subscribeToChannel('invoices', () => {})
    await subscribeToChannel('invoices', () => {})

    first.unsubscribe()

    expect(realtimeStats()).toEqual({ channels: 1, listeners: 1 })
    expect(channels.filter((c) => !c.removed)).toHaveLength(1)
  })

  it('closes the channel when the last subscriber leaves', async () => {
    const a = await subscribeToChannel('invoices', () => {})
    const b = await subscribeToChannel('invoices', () => {})

    a.unsubscribe()
    b.unsubscribe()

    expect(realtimeStats()).toEqual({ channels: 0, listeners: 0 })
    expect(channels.every((c) => c.removed)).toBe(true)
  })

  it('tolerates a double unsubscribe without closing someone else out', async () => {
    // React can invoke a cleanup twice; that must not tear down a channel the
    // other subscriber is still using.
    const a = await subscribeToChannel('invoices', () => {})
    await subscribeToChannel('invoices', () => {})

    a.unsubscribe()
    a.unsubscribe()

    expect(realtimeStats()).toEqual({ channels: 1, listeners: 1 })
  })

  it('reopens cleanly after the last subscriber left', async () => {
    const first = await subscribeToChannel('invoices', () => {})
    first.unsubscribe()

    const calls: string[] = []
    await subscribeToChannel('invoices', () => calls.push('again'))
    fire('invoices')

    expect(calls).toEqual(['again'])
    expect(realtimeStats().channels).toBe(1)
  })
})

describe('a failing listener cannot silence the others', () => {
  it('delivers to the remaining listeners when one throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const calls: string[] = []

    await subscribeToChannel('invoices', () => {
      throw new Error('boom')
    })
    await subscribeToChannel('invoices', () => calls.push('survivor'))

    fire('invoices')

    expect(calls).toEqual(['survivor'])
    warn.mockRestore()
  })

  it('lets a listener unsubscribe from inside its own callback', async () => {
    const calls: string[] = []
    let handle: { unsubscribe: () => void } | null = null

    handle = await subscribeToChannel('invoices', () => {
      calls.push('self-removing')
      handle?.unsubscribe()
    })
    await subscribeToChannel('invoices', () => calls.push('other'))

    // Iterating the live set would have skipped 'other' here.
    fire('invoices')

    expect(calls).toEqual(['self-removing', 'other'])
    expect(realtimeStats().listeners).toBe(1)
  })
})

describe('message cost', () => {
  it('a dashboard opens 3 channels where it used to open 12', async () => {
    // Mirrors the real hook graph: KPIs(3) + insights(3) + sales(1) +
    // invoices(1) + products(1) + customers(1) = 10 subscriptions.
    const tables = [
      'invoices',
      'customers',
      'products',
      'invoices',
      'customers',
      'products',
      'invoices',
      'invoices',
      'products',
      'customers',
    ]

    for (const table of tables) await subscribeToChannel(table, () => {})

    expect(realtimeStats().listeners).toBe(10)
    // One per distinct table. A change to `invoices` now costs one message to
    // this client instead of four.
    expect(realtimeStats().channels).toBe(3)
  })
})
