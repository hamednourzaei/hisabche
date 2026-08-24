// ============================================
// packages/sync/src/wakeup.ts
//
// Every reason the engine should sync, in one place.
//
// WHAT CHANGED, AND WHY IT MATTERS
//
// Realtime used to BE the data path: an event arrived and invalidated a query,
// which refetched over HTTP. That made correctness depend on a websocket —
// miss an event and the screen was quietly wrong until something else happened
// to refetch.
//
// Here realtime carries no data and makes no promises. It says "something in
// this workspace moved" and the engine pulls the delta by cursor. The cursor
// is what makes that safe: it is monotonic, so a pull after a MISSED signal
// still returns everything since the last one. Realtime only ever changes WHEN
// you find out, never WHETHER.
//
// The practical test: unplug realtime for an hour and the client still
// converges, on the interval, on reconnect, or on the next foreground.
// ============================================

export interface WakeTarget {
  /** Sync now. Extra calls coalesce, so a burst of signals is one cycle. */
  wake(reason: string): void
}

export interface WakeupOptions {
  engine: WakeTarget
  /**
   * Subscribe to "something changed" for a table. Returns an unsubscribe.
   * Injected so this file depends on no particular realtime client.
   */
  subscribeRealtime?: (table: string, onSignal: () => void) => Promise<() => void>
  /** Tables to listen on. */
  tables?: readonly string[]
  /**
   * Collapse a burst into one wake. A single invoice write touches invoices,
   * products and notifications, so three signals arrive within milliseconds
   * and mean exactly one thing.
   */
  coalesceMs?: number
  log?: (event: string, data: Record<string, unknown>) => void
}

const DEFAULT_TABLES = ['invoices', 'customers', 'products', 'transactions'] as const

/**
 * Wire every wake source to the engine.
 *
 * Returns a teardown that removes all of them. Safe to call twice.
 */
export function installWakeSources(options: WakeupOptions): () => void {
  const { engine, subscribeRealtime, tables = DEFAULT_TABLES, coalesceMs = 250, log } = options

  const teardowns: Array<() => void> = []
  let coalesceTimer: ReturnType<typeof setTimeout> | null = null
  let torndown = false

  const wake = (reason: string): void => {
    if (torndown) return

    if (coalesceTimer) clearTimeout(coalesceTimer)
    coalesceTimer = setTimeout(() => {
      coalesceTimer = null
      log?.('sync.wake', { reason })
      engine.wake(reason)
    }, coalesceMs)
  }

  /* ── realtime: a hint, never a transport ──────────────────────────────── */

  if (subscribeRealtime) {
    for (const table of tables) {
      void subscribeRealtime(table, () => wake(`realtime:${table}`))
        .then((off) => {
          if (torndown) off()
          else teardowns.push(off)
        })
        .catch((err: Error) => {
          // Realtime failing to connect is not an error condition for the
          // system — it is a slower path. Logged, never thrown.
          log?.('sync.realtime_unavailable', { table, error: err.message })
        })
    }
  }

  /* ── browser lifecycle ────────────────────────────────────────────────── */

  if (typeof window !== 'undefined') {
    // Coming back online is the highest-value wake there is: it is exactly
    // when a queued outbox can finally drain.
    const onOnline = () => wake('online')
    window.addEventListener('online', onOnline)
    teardowns.push(() => window.removeEventListener('online', onOnline))

    // Returning to the tab. Realtime often died silently while it was hidden,
    // so this is the recovery path that does not depend on noticing.
    const onVisible = () => {
      if (document.visibilityState === 'visible') wake('foreground')
    }
    document.addEventListener('visibilitychange', onVisible)
    teardowns.push(() => document.removeEventListener('visibilitychange', onVisible))

    const onFocus = () => wake('focus')
    window.addEventListener('focus', onFocus)
    teardowns.push(() => window.removeEventListener('focus', onFocus))

    // A last flush as the tab goes away. Best-effort — the outbox is durable,
    // so anything missed here is sent on the next start.
    const onHide = () => {
      if (document.visibilityState === 'hidden') engine.wake('backgrounding')
    }
    document.addEventListener('visibilitychange', onHide)
    teardowns.push(() => document.removeEventListener('visibilitychange', onHide))
  }

  return () => {
    torndown = true
    if (coalesceTimer) clearTimeout(coalesceTimer)
    for (const off of teardowns.splice(0)) {
      try {
        off()
      } catch {
        // Teardown must not throw during unmount.
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Cross-tab coordination
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Tell the other tabs that something happened.
 *
 * Two tabs on one device share an IndexedDB but not memory, so a mutation in
 * one leaves the other showing stale rows until it happens to sync. A
 * BroadcastChannel ping is far cheaper than each tab holding its own websocket
 * and polling interval.
 *
 * Purely an optimisation, like realtime: a browser without BroadcastChannel
 * simply converges on the normal schedule.
 */
export function installCrossTabWake(engine: WakeTarget, channelName = 'hisabche-sync'): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}

  const channel = new BroadcastChannel(channelName)

  channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
    if (event.data?.type === 'mutated') engine.wake('cross-tab')
  }

  return () => channel.close()
}

/** Announce a local mutation to sibling tabs. */
export function announceMutation(channelName = 'hisabche-sync'): void {
  if (typeof BroadcastChannel === 'undefined') return

  const channel = new BroadcastChannel(channelName)
  channel.postMessage({ type: 'mutated' })
  channel.close()
}
