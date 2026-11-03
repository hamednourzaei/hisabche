'use client'

// ============================================
// packages/ui/src/hooks/use-business-profile.ts
//
// ONE reader for the derived industry profile.
//
// No screen parses `businessTypes` itself: this hook canonicalises the stored
// value with the shared resolver and memoises the result. While auth is still
// loading — or when a workspace has no recognised industry — it returns the
// generic profile, never a crash and never a guess.
// ============================================

import { useMemo } from 'react'
import { useAuthStore } from '@hisabche/store'
import { useWorkspaceProfile } from '@hisabche/api'
import { resolveBusinessProfile, type BusinessProfile } from '@hisabche/validation'

export interface BusinessProfileState {
  readonly profile: BusinessProfile
  /** The signed-in user's stored trades are known. */
  readonly ready: boolean
}

export function useBusinessProfile(): BusinessProfileState {
  const userTypes = useAuthStore((state) => state.user?.businessTypes)
  const ready = useAuthStore((state) => state.user !== null)
  const workspace = useWorkspaceProfile().data

  // The WORKSPACE profile is authoritative once the business declared one (V53 D4); until then — and
  // whenever it cannot be read (offline, migration not applied) — the person's own trades are used,
  // exactly as before. The same resolver runs either way.
  const businessTypes = workspace?.declared ? workspace.businessTypes : userTypes

  const profile = useMemo(() => resolveBusinessProfile(businessTypes ?? []), [businessTypes])

  return useMemo(() => ({ profile, ready }), [profile, ready])
}
