// ============================================
// packages/api/src/supabase/realtime.ts
//
// One channel per table, shared by every subscriber.
//
// WHAT THIS REPLACED, AND WHY
//
// This file used to open a NEW channel per call, with a counter in the name:
//
//     .channel(`hisabche-${table}-${channelCounter}`)
//
// That was a fix for a real bug — two hooks on one table used to collide on an
// identical channel name and one of them stopped receiving events. But it
// solved the collision by making every subscriber its own channel, and the
// cost of that compounds:
//
//   useDashboardKPIs   → invoices, customers, products
//   useAIInsights      → invoices, customers, products
//   useDashboardSales  → invoices
//   useInvoices        → invoices
//
// Four independent channels on `invoices` for ONE user on ONE page. Supabase
// bills realtime by message, and a message is sent per channel, so a single
// invoice INSERT cost 4 messages per connected user before anything else on
// the page was counted. Twelve channels per client is also twelve joins on
// every navigation.
//
// The fix keeps the property the counter was protecting — every subscriber
// gets every event — without the multiplication. One channel per table holds a
// SET of callbacks and fans out locally. Subscribers are reference-counted, so
// the channel closes when the last one unmounts.
//
// REALTIME IS AN OPTIMISATION, NOT A TRANSPORT
//
// The callback carries no payload. It means "something on this table changed,
// go and find out" — the same signal the sync engine's cursor pull needs. If
// realtime never connects, correctness is unaffected; data is simply refreshed
// on the next query, navigation or explicit sync instead of immediately.
// ============================================

import type { RealtimeChannel } from '@supabase/supabase-js'

import { supabaseClient } from '../../../auth/src/supabase'

type Listener = () => void

interface SharedChannel {
  channel: RealtimeChannel
  listeners: Set<Listener>
}

/** One entry per table, for the lifetime of the tab. */
const shared = new Map<string, SharedChannel>()

/**
 * Subscribe to change notifications for a table.
 *
 * The returned handle is idempotent: calling `unsubscribe` twice removes one
 * listener, not two, so a double-invoked React cleanup cannot tear down a
 * channel another component is still using.
 */
export async function subscribeToChannel(
  table: string,
  callback: Listener,
): Promise<{ unsubscribe: () => void }> {
  if (typeof window === 'undefined') {
    return { unsubscribe: () => {} }
  }

  let entry = shared.get(table)

  if (!entry) {
    const listeners = new Set<Listener>()

    const channel = supabaseClient
      .channel(`hisabche-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        // A copy, because a listener may unsubscribe from inside its own
        // callback — mutating the live set mid-iteration would skip the next.
        for (const listener of [...listeners]) {
          try {
            listener()
          } catch (err) {
            // One bad listener must not stop the others from being told.
            console.warn(`[realtime] listener for "${table}" threw:`, err)
          }
        }
      })
      .subscribe()

    entry = { channel, listeners }
    shared.set(table, entry)
  }

  entry.listeners.add(callback)

  let released = false

  return {
    unsubscribe: () => {
      if (released) return
      released = true

      const current = shared.get(table)
      if (!current) return

      current.listeners.delete(callback)

      // Last one out closes the channel. Keeping an idle channel open would
      // keep paying for messages nobody is listening to.
      if (current.listeners.size === 0) {
        shared.delete(table)
        void supabaseClient.removeChannel(current.channel)
      }
    },
  }
}

/**
 * How many channels are open, and how many listeners share them.
 *
 * Exported for the test that pins the consolidation: without an assertion on
 * this, a future hook could quietly go back to one channel per subscriber and
 * nothing would fail.
 */
export function realtimeStats(): { channels: number; listeners: number } {
  let listeners = 0
  for (const entry of shared.values()) listeners += entry.listeners.size
  return { channels: shared.size, listeners }
}

/** Test-only reset. */
export function __resetRealtimeForTests(): void {
  for (const entry of shared.values()) {
    void supabaseClient.removeChannel(entry.channel)
  }
  shared.clear()
}
