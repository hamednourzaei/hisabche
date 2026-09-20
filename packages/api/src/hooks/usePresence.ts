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

import {
  subscribeToPresence,
  type PresenceIdentity,
  type PresenceMember,
} from '../supabase/presence'
import { useActiveWorkspaceId } from './useRealtime'
import { useAuthReady } from './useAuthReady'

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
    if (!authReady || !workspaceId || !userId) {
      setMembers([])
      return
    }

    const handle = subscribeToPresence(
      workspaceId,
      { userId, name, ...(email ? { email } : {}), ...(role ? { role } : {}) },
      setMembers,
    )

    return () => {
      handle.unsubscribe()
      // Leaving the workspace must not leave a stale roster on screen.
      setMembers([])
    }
    // The identity is spread into primitives on purpose: an object literal
    // from the caller would be a new reference every render and would
    // resubscribe on each one.
  }, [authReady, workspaceId, userId, name, email, role])

  const visible = canSee ? members : []

  return useMemo(
    () => ({ members: visible, onlineIds: new Set(visible.map((m) => m.userId)) }),
    [visible],
  )
}
