'use client'

// ============================================
// packages/api/src/hooks/usePresence.ts
//
// Who is signed in to this workspace right now.
//
// ⚠️ ANNOUNCING AND WATCHING ARE TWO DIFFERENT PERMISSIONS.
//
// Everybody announces themselves — that is what makes a roster possible at
// all. Only somebody the owner has granted `people.presence.read` gets the
// list back. `enabled: false` therefore still joins the channel; it just does
// not expose what it sees.
// ============================================

import { useEffect, useMemo, useState } from 'react'

import { hasToken, isOfflineTokenMode } from '../lib/tokenProvider'
import {
  subscribeToPresence,
  type PresenceIdentity,
  type PresenceMember,
} from '../supabase/presence'
import { useActiveWorkspaceId } from './useRealtime'
import { useAuthReady } from './useAuthReady'

const PRESENCE_SUBSCRIBE_SETTLE_MS = 50

export type { PresenceMember } from '../supabase/presence'

export function usePresence(
  identity: PresenceIdentity | null,
  options?: { canSee?: boolean },
): { members: PresenceMember[]; onlineIds: Set<string> } {
  const authReady = useAuthReady()
  const workspaceId = useActiveWorkspaceId()
  const [members, setMembers] = useState<PresenceMember[]>([])

  const canSee = options?.canSee !== false
  const userId = identity?.userId ?? ''
  const name = identity?.name ?? ''
  const email = identity?.email
  const role = identity?.role

  useEffect(() => {
    // Not subscribed: nothing is shown (derived below), no setState here.
    if (!authReady || !workspaceId || !userId) return
    if (isOfflineTokenMode() || !hasToken()) return

    let cancelled = false
    let handle: { unsubscribe: () => void } | null = null

    const timer = setTimeout(() => {
      if (cancelled || isOfflineTokenMode() || !hasToken()) return
      handle = subscribeToPresence(
        workspaceId,
        { userId, name, ...(email ? { email } : {}), ...(role ? { role } : {}) },
        setMembers,
      )
    }, PRESENCE_SUBSCRIBE_SETTLE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
      handle?.unsubscribe()
      handle = null
      // Leaving the workspace must not leave a stale roster on screen.
      setMembers([])
    }
    // The identity is spread into primitives on purpose: an object literal
    // from the caller would be a new reference every render and would
    // resubscribe on each one.
  }, [authReady, workspaceId, userId, name, email, role])

  const active =
    authReady && Boolean(workspaceId) && Boolean(userId) && !isOfflineTokenMode() && hasToken()
  return useMemo(() => {
    const visible = canSee && active ? members : []
    return { members: visible, onlineIds: new Set(visible.map((m) => m.userId)) }
  }, [canSee, active, members])
}
