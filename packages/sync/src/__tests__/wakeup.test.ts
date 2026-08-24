// @vitest-environment jsdom
// ============================================
// Realtime is a wake-up, not a transport.
//
// Runs under jsdom (see the pragma above) because the lifecycle wake sources
// listen on `window` and `document`. Everything else in this package is pure
// and stays on the faster node environment.
//
// The property under test is the one that makes the whole architecture
// tolerant of a flaky websocket: correctness must not depend on realtime.
// These tests deliberately break realtime in every way it breaks in the field
// — never connects, misses events, fires twice, dies mid-session — and assert
// the client still converges.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { installWakeSources } from '../wakeup'
import type { WakeTarget } from '../wakeup'

class RecordingEngine implements WakeTarget {
  reasons: string[] = []
  wake(reason: string): void {
    this.reasons.push(reason)
  }
}

/** A realtime service that can be told to misbehave. */
class FlakyRealtime {
  private handlers = new Map<string, Set<() => void>>()
  failToConnect = false
  subscribeCount = 0

  subscribe = async (table: string, onSignal: () => void): Promise<() => void> => {
    this.subscribeCount += 1

    if (this.failToConnect) throw new Error('websocket refused')

    const set = this.handlers.get(table) ?? new Set()
    set.add(onSignal)
    this.handlers.set(table, set)

    return () => set.delete(onSignal)
  }

  /** Deliver a change signal, as the server would. */
  emit(table: string): void {
    for (const handler of [...(this.handlers.get(table) ?? [])]) handler()
  }

  /** Every subscriber goes away, as a dropped connection would do. */
  drop(): void {
    this.handlers.clear()
  }
}

let engine: RecordingEngine
let realtime: FlakyRealtime

beforeEach(() => {
  vi.useFakeTimers()
  engine = new RecordingEngine()
  realtime = new FlakyRealtime()
})

function install(coalesceMs = 250) {
  return installWakeSources({
    engine,
    subscribeRealtime: realtime.subscribe,
    tables: ['invoices', 'customers', 'products'],
    coalesceMs,
  })
}

/* ═══════════════════════════════════════════════════════════════════════════
   Signal, not payload
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a realtime event wakes the engine', () => {
  it('turns a signal into a sync, not into data', async () => {
    install()
    await vi.runOnlyPendingTimersAsync()

    realtime.emit('invoices')
    await vi.advanceTimersByTimeAsync(300)

    // The engine was told to go and pull. Nothing was handed to it — the
    // change itself travels by cursor.
    expect(engine.reasons).toEqual(['realtime:invoices'])
  })

  it('collapses a burst into one sync', async () => {
    install()
    await vi.runOnlyPendingTimersAsync()

    // One invoice write touches several tables; three signals, one meaning.
    realtime.emit('invoices')
    realtime.emit('products')
    realtime.emit('customers')

    await vi.advanceTimersByTimeAsync(300)

    expect(engine.reasons).toHaveLength(1)
  })

  it('a duplicate signal cannot corrupt anything — it is just another wake', async () => {
    install(0)
    await vi.runOnlyPendingTimersAsync()

    realtime.emit('invoices')
    await vi.advanceTimersByTimeAsync(10)
    realtime.emit('invoices')
    await vi.advanceTimersByTimeAsync(10)

    // Both are ordinary wakes. The cursor makes the second pull a no-op.
    expect(engine.reasons).toEqual(['realtime:invoices', 'realtime:invoices'])
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Realtime failure — the important half
   ═══════════════════════════════════════════════════════════════════════════ */

describe('correctness does not depend on realtime', () => {
  it('installs without throwing when realtime never connects', async () => {
    realtime.failToConnect = true

    // The client must come up normally. A failed websocket is a slower path,
    // not a broken app.
    expect(() => install()).not.toThrow()
    await vi.runOnlyPendingTimersAsync()

    expect(engine.reasons).toEqual([])
  })

  it('still syncs on lifecycle events when realtime is dead', async () => {
    realtime.failToConnect = true
    install(0)
    await vi.runOnlyPendingTimersAsync()

    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(10)

    // Reconnect alone is enough to converge, with no realtime involved.
    expect(engine.reasons).toContain('online')
  })

  it('recovers after realtime silently drops mid-session', async () => {
    install(0)
    await vi.runOnlyPendingTimersAsync()

    realtime.emit('invoices')
    await vi.advanceTimersByTimeAsync(10)

    // The connection dies without telling anyone — the failure mode that used
    // to leave the UI quietly stale.
    realtime.drop()
    realtime.emit('invoices')
    await vi.advanceTimersByTimeAsync(10)

    const beforeRecovery = engine.reasons.length

    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(10)

    expect(engine.reasons.length).toBeGreaterThan(beforeRecovery)
    expect(engine.reasons).toContain('focus')
  })

  it('a missed signal costs latency, not data', async () => {
    install(0)
    await vi.runOnlyPendingTimersAsync()

    // The signal never arrives — dropped by a proxy, say.
    realtime.drop()

    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(10)

    // The delta pull that follows is cursor-based, so it returns everything
    // since the last successful pull, including whatever the missed signal
    // would have announced.
    expect(engine.reasons).toContain('online')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Lifecycle wakes
   ═══════════════════════════════════════════════════════════════════════════ */

describe('lifecycle', () => {
  it('syncs when the tab regains focus', async () => {
    install(0)
    await vi.runOnlyPendingTimersAsync()

    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(10)

    expect(engine.reasons).toContain('focus')
  })

  it('flushes as the tab is backgrounded, bypassing the coalesce delay', async () => {
    install(5000)
    await vi.runOnlyPendingTimersAsync()

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    // Not debounced: the tab may not exist in 5 seconds.
    expect(engine.reasons).toContain('backgrounding')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Teardown
   ═══════════════════════════════════════════════════════════════════════════ */

describe('teardown', () => {
  it('stops waking after uninstall', async () => {
    const uninstall = install(0)
    await vi.runOnlyPendingTimersAsync()

    uninstall()

    realtime.emit('invoices')
    window.dispatchEvent(new Event('online'))
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(50)

    expect(engine.reasons).toEqual([])
  })

  it('survives being uninstalled twice', async () => {
    const uninstall = install()
    await vi.runOnlyPendingTimersAsync()

    uninstall()
    expect(() => uninstall()).not.toThrow()
  })

  it('drops a pending coalesced wake on uninstall', async () => {
    const uninstall = install(1000)
    await vi.runOnlyPendingTimersAsync()

    realtime.emit('invoices')
    uninstall()
    await vi.advanceTimersByTimeAsync(2000)

    // Firing into an unmounted engine would be a leak.
    expect(engine.reasons).toEqual([])
  })
})
