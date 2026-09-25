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
  /** The postgres_changes options, so the workspace filter is assertable. */
  options: Record<string, unknown> | null
}

const channels: FakeChannel[] = []

/**
 * The token source the client registered — what supabase-js asks on every
 * realtime heartbeat. Calling it is how a heartbeat is simulated.
 */
let tokenSource: (() => string | null) | null = null

vi.mock('../../../auth/src/supabase', () => ({
  supabaseClient: {
    channel(name: string) {
      const created: FakeChannel = { name, handler: null, removed: false, options: null }
      channels.push(created)

      const api = {
        on(_event: string, options: Record<string, unknown>, handler: () => void) {
          created.options = options
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
  setSupabaseTokenSource(source: () => string | null) {
    tokenSource = source
  },
}))

const { registerTokenGetter } = await import('../lib/tokenProvider')

const { subscribeToChannel, realtimeStats, closeWorkspaceChannels, __resetRealtimeForTests } =
  await import('../supabase/realtime')

const WS_A = 'workspace-a'
const WS_B = 'workspace-b'

/**
 * Fire the change handler for ONE workspace's channel.
 *
 * The workspace is part of the topic name, which is the point of the isolation
 * tests below: a change in workspace B reaches only B's channel.
 */
function fire(table: string, workspaceId: string = WS_A): void {
  const live = channels.filter((c) => c.name === `hisabche-${workspaceId}-${table}` && !c.removed)
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
    await subscribeToChannel('invoices', WS_A, () => {})
    await subscribeToChannel('invoices', WS_A, () => {})
    await subscribeToChannel('invoices', WS_A, () => {})
    await subscribeToChannel('invoices', WS_A, () => {})

    expect(realtimeStats()).toEqual({ channels: 1, listeners: 4 })
    expect(channels.filter((c) => !c.removed)).toHaveLength(1)
  })

  it('still notifies every subscriber — the bug the old code was avoiding', async () => {
    const calls: string[] = []
    await subscribeToChannel('invoices', WS_A, () => calls.push('kpis'))
    await subscribeToChannel('invoices', WS_A, () => calls.push('insights'))
    await subscribeToChannel('invoices', WS_A, () => calls.push('list'))

    fire('invoices')

    expect(calls.sort()).toEqual(['insights', 'kpis', 'list'])
  })

  it('keeps separate tables on separate channels', async () => {
    await subscribeToChannel('invoices', WS_A, () => {})
    await subscribeToChannel('customers', WS_A, () => {})
    await subscribeToChannel('products', WS_A, () => {})

    expect(realtimeStats().channels).toBe(3)
  })
})

describe('teardown', () => {
  it('keeps the channel open while any subscriber remains', async () => {
    const first = await subscribeToChannel('invoices', WS_A, () => {})
    await subscribeToChannel('invoices', WS_A, () => {})

    first.unsubscribe()

    expect(realtimeStats()).toEqual({ channels: 1, listeners: 1 })
    expect(channels.filter((c) => !c.removed)).toHaveLength(1)
  })

  it('closes the channel when the last subscriber leaves', async () => {
    const a = await subscribeToChannel('invoices', WS_A, () => {})
    const b = await subscribeToChannel('invoices', WS_A, () => {})

    a.unsubscribe()
    b.unsubscribe()

    expect(realtimeStats()).toEqual({ channels: 0, listeners: 0 })
    expect(channels.every((c) => c.removed)).toBe(true)
  })

  it('tolerates a double unsubscribe without closing someone else out', async () => {
    // React can invoke a cleanup twice; that must not tear down a channel the
    // other subscriber is still using.
    const a = await subscribeToChannel('invoices', WS_A, () => {})
    await subscribeToChannel('invoices', WS_A, () => {})

    a.unsubscribe()
    a.unsubscribe()

    expect(realtimeStats()).toEqual({ channels: 1, listeners: 1 })
  })

  it('reopens cleanly after the last subscriber left', async () => {
    const first = await subscribeToChannel('invoices', WS_A, () => {})
    first.unsubscribe()

    const calls: string[] = []
    await subscribeToChannel('invoices', WS_A, () => calls.push('again'))
    fire('invoices')

    expect(calls).toEqual(['again'])
    expect(realtimeStats().channels).toBe(1)
  })
})

describe('a failing listener cannot silence the others', () => {
  it('delivers to the remaining listeners when one throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const calls: string[] = []

    await subscribeToChannel('invoices', WS_A, () => {
      throw new Error('boom')
    })
    await subscribeToChannel('invoices', WS_A, () => calls.push('survivor'))

    fire('invoices')

    expect(calls).toEqual(['survivor'])
    warn.mockRestore()
  })

  it('lets a listener unsubscribe from inside its own callback', async () => {
    const calls: string[] = []
    let handle: { unsubscribe: () => void } | null = null

    handle = await subscribeToChannel('invoices', WS_A, () => {
      calls.push('self-removing')
      handle?.unsubscribe()
    })
    await subscribeToChannel('invoices', WS_A, () => calls.push('other'))

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

    for (const table of tables) await subscribeToChannel(table, WS_A, () => {})

    expect(realtimeStats().listeners).toBe(10)
    // One per distinct table. A change to `invoices` now costs one message to
    // this client instead of four.
    expect(realtimeStats().channels).toBe(3)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Workspace isolation
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a workspace never hears another workspace', () => {
  it('asks the server to filter by workspace', async () => {
    await subscribeToChannel('invoices', WS_A, () => {})

    // Server-side. Without this the database sends every row change on the
    // table to every connected client, and discarding the payload afterwards
    // does not un-send it.
    expect(channels[0]?.options).toMatchObject({
      event: '*',
      schema: 'public',
      table: 'invoices',
      filter: `workspace_id=eq.${WS_A}`,
    })
  })

  it('puts the workspace in the topic name', async () => {
    await subscribeToChannel('invoices', WS_A, () => {})
    await subscribeToChannel('invoices', WS_B, () => {})

    expect(channels.map((c) => c.name).sort()).toEqual([
      `hisabche-${WS_A}-invoices`,
      `hisabche-${WS_B}-invoices`,
    ])
  })

  it('does not share one channel between two workspaces', async () => {
    // Two tabs, two businesses, same table. Keying only by table would have
    // handed the second one a channel already filtered for the first.
    await subscribeToChannel('invoices', WS_A, () => {})
    await subscribeToChannel('invoices', WS_B, () => {})

    expect(realtimeStats()).toEqual({ channels: 2, listeners: 2 })
  })

  it('delivers a workspace B change to B only', async () => {
    const calls: string[] = []
    await subscribeToChannel('invoices', WS_A, () => calls.push('a'))
    await subscribeToChannel('invoices', WS_B, () => calls.push('b'))

    fire('invoices', WS_B)

    expect(calls).toEqual(['b'])
  })

  it('closing one workspace leaves the other subscribed', async () => {
    await subscribeToChannel('invoices', WS_A, () => {})
    await subscribeToChannel('invoices', WS_B, () => {})

    closeWorkspaceChannels(WS_A)

    expect(realtimeStats()).toEqual({ channels: 1, listeners: 1 })
    expect(channels.find((c) => c.name.includes(WS_A))?.removed).toBe(true)
    expect(channels.find((c) => c.name.includes(WS_B))?.removed).toBe(false)
  })

  it('drops every channel on sign-out', async () => {
    await subscribeToChannel('invoices', WS_A, () => {})
    await subscribeToChannel('customers', WS_B, () => {})

    expect(realtimeStats().channels).toBe(2)

    // A sign-out that leaves components mounted would otherwise keep a socket
    // joined to a workspace the user is no longer a member of.
    // The heartbeat asks for a token and there is none.
    registerTokenGetter(() => null)
    expect(tokenSource?.()).toBeNull()

    expect(realtimeStats()).toEqual({ channels: 0, listeners: 0 })
    expect(channels.every((c) => c.removed)).toBe(true)
  })

  it('leaves channels alone on a token refresh', async () => {
    await subscribeToChannel('invoices', WS_A, () => {})

    registerTokenGetter(() => 'refreshed-jwt')
    // ⚠️ And realtime is handed THE USER'S token, not nothing: without it the
    // channel joined as anon and RLS delivered no rows to anyone.
    expect(tokenSource?.()).toBe('refreshed-jwt')

    // Tearing down on every refresh would drop realtime roughly hourly and
    // silently degrade the app to poll-on-navigation.
    expect(realtimeStats().channels).toBe(1)
  })

  it('subscribes to nothing when there is no workspace', async () => {
    // Reached while signing in and while the active workspace loads. The old
    // code would have opened an unfiltered channel here.
    const handle = await subscribeToChannel('invoices', null, () => {})

    expect(realtimeStats()).toEqual({ channels: 0, listeners: 0 })
    expect(channels).toHaveLength(0)

    // and the returned handle must still be safe to tear down
    expect(() => handle.unsubscribe()).not.toThrow()
  })
})
