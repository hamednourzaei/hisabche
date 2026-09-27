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
//
// ---------------------------------------------------------------------------
// ⚠️ WORKSPACE ISOLATION
//
// A subscription MUST be scoped to a workspace. Without the filter this file
// subscribed to `{ event: '*', schema: 'public', table }` — every row change on
// that table, for every business on the platform, delivered to every connected
// client.
//
// That the callback discards the payload is not a defence. Three things still
// went wrong:
//
//   1. The row travelled. Supabase sends the changed record over the socket;
//      dropping it client-side happens after the fact, and until RLS is enabled
//      nothing stops it being read in devtools.
//   2. Every write anywhere woke every client everywhere, each of which then
//      refetched. That is a cross-tenant side channel — another shop's activity
//      is inferable from your own refresh timing — and it multiplies the
//      realtime message bill by the number of connected tenants.
//   3. The channel NAME was shared across workspaces, so two tenants' browsers
//      joined the same topic.
//
// All three are fixed below: the topic includes the workspace id, and a
// server-side `filter` means the database never sends foreign rows at all.
//
// The filter is applied server-side, but it is NOT an authorization boundary on
// its own — a client controls its own filter and could ask for another
// workspace. RLS (docs/tenancy-rls.sql) is what makes that ask return nothing,
// because Realtime evaluates row security before delivering. Both are required.
// ============================================

import type { RealtimeChannel } from '@supabase/supabase-js'

import { onSignedOut, supabaseClient } from './client'

type Listener = () => void

interface SharedChannel {
  /** Null while the tab is hidden and the channel is paused (see below). */
  channel: RealtimeChannel | null
  listeners: Set<Listener>
  workspaceId: string
  table: string
}

// ─── Hidden tabs do not hold channels (27 Sep 2026) ─────────────────────────
//
// Every open postgres_changes channel keeps Supabase Realtime polling the
// replication slot — `realtime.list_changes` was the most-called statement in
// pg_stat_statements (~90k calls). A tab left open in the background kept its
// channels for hours, for a screen nobody was looking at.
//
// After HIDDEN_GRACE_MS hidden, the channels close; the listeners stay. When
// the tab is visible again the channels reopen and every listener is told
// «something may have changed» ONCE — it refetches, so nothing missed while
// paused is lost. Realtime is an optimisation, never the source of truth.
export const HIDDEN_GRACE_MS = 60_000
let hiddenTimer: ReturnType<typeof setTimeout> | null = null
let paused = false

function openChannel(key: string, entry: SharedChannel): RealtimeChannel {
  const { workspaceId, table, listeners } = entry
  return supabaseClient
    .channel(`hisabche-${workspaceId}-${table}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        // Server-side. Foreign rows are never sent, so they cannot be read
        // off the socket and cannot trigger a spurious refetch.
        filter: `workspace_id=eq.${workspaceId}`,
      },
      () => notify(key, listeners),
    )
    .subscribe()
}

function notify(key: string, listeners: Set<Listener>): void {
  // A copy, because a listener may unsubscribe from inside its own
  // callback — mutating the live set mid-iteration would skip the next.
  for (const listener of [...listeners]) {
    try {
      listener()
    } catch (err) {
      // One bad listener must not stop the others from being told.
      console.warn(`[realtime] listener for "${key}" threw:`, err)
    }
  }
}

function pauseAll(): void {
  paused = true
  for (const entry of shared.values()) {
    if (!entry.channel) continue
    void supabaseClient.removeChannel(entry.channel)
    entry.channel = null
  }
}

function resumeAll(): void {
  if (!paused) return
  paused = false
  for (const [key, entry] of shared.entries()) {
    if (entry.channel) continue
    entry.channel = openChannel(key, entry)
    // Catch up on whatever changed while nobody was listening.
    notify(key, entry.listeners)
  }
}

let visibilityHookInstalled = false

function installVisibilityHook(): void {
  if (visibilityHookInstalled || typeof document === 'undefined') return
  visibilityHookInstalled = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (hiddenTimer === null) {
        hiddenTimer = setTimeout(() => {
          hiddenTimer = null
          pauseAll()
        }, HIDDEN_GRACE_MS)
      }
      return
    }
    if (hiddenTimer !== null) {
      clearTimeout(hiddenTimer)
      hiddenTimer = null
    }
    resumeAll()
  })
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
  workspaceId: string | null | undefined,
  callback: Listener,
): Promise<{ unsubscribe: () => void }> {
  if (typeof window === 'undefined') {
    return { unsubscribe: () => {} }
  }

  // Fail closed. No workspace means no subscription — never a subscription to
  // everything. This is reached during sign-in and while the active workspace
  // is still loading, and realtime is only an optimisation, so declining is
  // free: the next query refreshes the data anyway.
  if (!workspaceId) {
    return { unsubscribe: () => {} }
  }

  installSignOutHook()
  installVisibilityHook()

  // Keyed by BOTH, so two workspaces open in two tabs get two channels rather
  // than silently sharing one filtered for whichever subscribed first.
  const key = `${workspaceId}:${table}`

  let entry = shared.get(key)

  if (!entry) {
    entry = { channel: null, listeners: new Set<Listener>(), workspaceId, table }
    // A subscriber that arrives while the tab is paused opens nothing until
    // the tab is visible again; resumeAll() opens it then.
    if (!paused) entry.channel = openChannel(key, entry)
    shared.set(key, entry)
  }

  entry.listeners.add(callback)

  let released = false

  return {
    unsubscribe: () => {
      if (released) return
      released = true

      const current = shared.get(key)
      if (!current) return

      current.listeners.delete(callback)

      // Last one out closes the channel. Keeping an idle channel open would
      // keep paying for messages nobody is listening to.
      if (current.listeners.size === 0) {
        shared.delete(key)
        if (current.channel) void supabaseClient.removeChannel(current.channel)
      }
    },
  }
}

/**
 * Close every channel belonging to a workspace.
 *
 * Called when the active workspace changes or on sign-out. Without this, a
 * user who switches workspace keeps the old workspace's channel open for as
 * long as the tab lives — still receiving its wake-ups, and still billed for
 * them, after they have stopped being a member.
 */
export function closeWorkspaceChannels(workspaceId: string): void {
  for (const [key, entry] of [...shared.entries()]) {
    if (!key.startsWith(`${workspaceId}:`)) continue
    shared.delete(key)
    if (entry.channel) void supabaseClient.removeChannel(entry.channel)
  }
}

/** Close every channel, whatever workspace it belongs to. */
function closeAllChannels(): void {
  for (const [key, entry] of [...shared.entries()]) {
    shared.delete(key)
    if (entry.channel) void supabaseClient.removeChannel(entry.channel)
  }
}

let signOutHookInstalled = false

/**
 * Drop every subscription when the session ends.
 *
 * The hooks unsubscribe on unmount, and on a workspace switch their effects
 * re-run and release the old channel — so in the normal case this changes
 * nothing. It covers the case those do not: a sign-out that leaves components
 * mounted, where a socket opened under the old identity would stay joined to a
 * workspace the user has just stopped being a member of.
 *
 * Installed lazily on the first subscription rather than at module scope. At
 * import time there may be no `window` and no auth client yet — an import-time
 * side effect would either be skipped permanently or throw, depending on
 * order. The first subscribe is the moment both are certainly present.
 */
//
// ⚠️ It listened for supabase-auth's SIGNED_OUT, which never fired: sign-in
// goes through the backend, so this client never held a session to sign out
// of. And once the client got `accessToken`, merely reading `.auth` throws.
// The signal now comes from the token itself (see ./client).
function installSignOutHook(): void {
  if (signOutHookInstalled) return
  signOutHookInstalled = true
  onSignedOut(closeAllChannels)
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
  let channels = 0
  for (const entry of shared.values()) {
    listeners += entry.listeners.size
    if (entry.channel) channels++
  }
  return { channels, listeners }
}

/** Test-only reset. */
export function __resetRealtimeForTests(): void {
  for (const entry of shared.values()) {
    if (entry.channel) void supabaseClient.removeChannel(entry.channel)
  }
  shared.clear()
  signOutHookInstalled = false
  if (hiddenTimer !== null) clearTimeout(hiddenTimer)
  hiddenTimer = null
  paused = false
}
