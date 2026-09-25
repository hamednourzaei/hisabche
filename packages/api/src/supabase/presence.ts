// ============================================
// packages/api/src/supabase/presence.ts
//
// Who is signed in right now, per workspace.
//
// ---------------------------------------------------------------------------
// ⚠️ THIS IS NOT A DATABASE TABLE, AND MUST NOT BECOME ONE.
//
// Presence is Supabase Realtime's own feature: each client announces itself on
// a channel and the server keeps the roster in memory for as long as the
// socket is open. Writing «last seen» rows instead would mean a write per
// heartbeat per user — and a crashed tab would leave someone shown as online
// forever, because nothing would ever write the row that says they left.
//
// A dropped socket removes the entry automatically. That is the whole reason
// to use presence rather than a column.
//
// ---------------------------------------------------------------------------
// ⚠️ ONE CHANNEL PER WORKSPACE, SHARED BY EVERY SUBSCRIBER.
//
// The same reasoning as `realtime.ts`: a channel per hook multiplies the
// realtime message bill by the number of components asking. Subscribers are
// reference-counted and the channel closes when the last one leaves.
//
// ⚠️ THE TOPIC CARRIES THE WORKSPACE ID. Two businesses must never share a
// roster — a shop would see the staff of another shop signing in.
// ============================================

import type { RealtimeChannel } from '@supabase/supabase-js'

import { supabaseClient } from './client'

/** What a client announces about itself. Nothing private. */
export interface PresenceIdentity {
  userId: string
  /** For the list. Empty is allowed — the UI falls back to the email. */
  name: string
  email?: string | undefined
  role?: string | undefined
}

export interface PresenceMember extends PresenceIdentity {
  /** ISO time this client joined; the earliest wins when a user has two tabs. */
  onlineSince: string
}

type Listener = (members: PresenceMember[]) => void

interface SharedPresence {
  channel: RealtimeChannel
  listeners: Set<Listener>
  last: PresenceMember[]
}

const shared = new Map<string, SharedPresence>()

/**
 * Collapse the raw roster into one entry per user.
 *
 * ⚠️ A PERSON IS NOT THEIR TABS. Supabase keys presence by connection, so two
 * tabs are two entries — the list would show the same colleague twice, and a
 * head count would be wrong. The earliest join time is kept, because that is
 * when they actually started, not when they opened the second tab.
 */
function collapse(state: Record<string, unknown[]>): PresenceMember[] {
  const byUser = new Map<string, PresenceMember>()

  for (const entries of Object.values(state)) {
    for (const raw of entries) {
      const entry = raw as Partial<PresenceMember>
      if (!entry?.userId) continue

      const existing = byUser.get(entry.userId)
      const member: PresenceMember = {
        userId: entry.userId,
        name: entry.name ?? '',
        ...(entry.email ? { email: entry.email } : {}),
        ...(entry.role ? { role: entry.role } : {}),
        onlineSince: entry.onlineSince ?? new Date().toISOString(),
      }

      if (!existing || member.onlineSince < existing.onlineSince) {
        byUser.set(entry.userId, member)
      }
    }
  }

  return [...byUser.values()].sort((a, b) => a.onlineSince.localeCompare(b.onlineSince))
}

/**
 * Join the workspace's roster and hear about every change to it.
 *
 * Returns a handle whose `unsubscribe` is idempotent, so a double-invoked
 * React cleanup cannot tear down a channel another component still uses.
 */
export function subscribeToPresence(
  workspaceId: string | null | undefined,
  identity: PresenceIdentity,
  callback: Listener,
): { unsubscribe: () => void } {
  if (typeof window === 'undefined') return { unsubscribe: () => {} }

  // Fail closed, exactly as `realtime.ts` does: no workspace means no
  // subscription, never a subscription to everything.
  if (!workspaceId || !identity.userId) return { unsubscribe: () => {} }

  let entry = shared.get(workspaceId)

  if (!entry) {
    const listeners = new Set<Listener>()
    const holder: SharedPresence = {
      channel: supabaseClient.channel(`presence-${workspaceId}`, {
        config: { presence: { key: identity.userId } },
      }),
      listeners,
      last: [],
    }

    const publish = () => {
      const members = collapse(
        holder.channel.presenceState() as unknown as Record<string, unknown[]>,
      )
      holder.last = members
      for (const listener of [...listeners]) {
        try {
          listener(members)
        } catch (err) {
          // One bad listener must not stop the others from being told.
          console.warn('[presence] listener threw:', err)
        }
      }
    }

    holder.channel
      .on('presence', { event: 'sync' }, publish)
      .on('presence', { event: 'join' }, publish)
      .on('presence', { event: 'leave' }, publish)
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        void holder.channel.track({
          ...identity,
          onlineSince: new Date().toISOString(),
        })
      })

    entry = holder
    shared.set(workspaceId, holder)
  }

  entry.listeners.add(callback)
  // Whoever joins late still gets the roster that is already known, rather
  // than an empty list until the next change.
  if (entry.last.length > 0) callback(entry.last)

  let released = false

  return {
    unsubscribe: () => {
      if (released) return
      released = true

      const current = shared.get(workspaceId)
      if (!current) return

      current.listeners.delete(callback)
      if (current.listeners.size > 0) return

      shared.delete(workspaceId)
      void current.channel.untrack()
      void supabaseClient.removeChannel(current.channel)
    },
  }
}
