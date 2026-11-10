// packages/ui/src/hooks/use-operational-dna.ts
'use client'

import { useMemo } from 'react'
import { useOnboardingStore, useAuthStore } from '@hisabche/store'
import { useOperationalProfile, useWorkspaceProfile } from '@hisabche/api'
import {
  type OperationalDna,
  type ResolvedBusinessConfiguration,
  resolveDnaCapabilities,
  inferOperationalDna,
  primaryIndustryKeyOf,
} from '@hisabche/validation'

export interface OperationalDnaState {
  readonly dna: OperationalDna | null
  readonly resolution: ResolvedBusinessConfiguration
  readonly isResolved: boolean
}

export function useOperationalDna(): OperationalDnaState {
  // V54 5.2: the WORKSPACE's copy wins — it is the same on every device and
  // for every member. The device copy is the fallback before the migration
  // runs, offline, or while the read is on its way.
  const serverDna = useOperationalProfile().data?.dna ?? null
  const deviceDna = useOnboardingStore((state) => state.operationalDna)
  const localDna = serverDna ?? deviceDna
  const user = useAuthStore((state) => state.user)
  const workspace = useWorkspaceProfile().data

  const resolution = useMemo(() => {
    // 1. Explicit Operational DNA if stored
    if (localDna) {
      return resolveDnaCapabilities(localDna)
    }

    // 2. Derive DNA safely from workspace or user declared business profile.
    // V55: the primary trade comes from the ONE canonical decision, never
    // `types[0]` — the user-level copy is stored in selection order.
    const types = workspace?.declared ? workspace.businessTypes : (user?.businessTypes ?? [])
    const primaryTrade = primaryIndustryKeyOf(types) ?? undefined

    const inferred = inferOperationalDna({
      tradeKey: primaryTrade,
    })

    return resolveDnaCapabilities(inferred)
  }, [localDna, workspace, user])

  return useMemo(
    () => ({
      dna: localDna ?? resolution.dna,
      resolution,
      isResolved: Boolean(localDna || workspace?.declared || user?.businessTypes?.length),
    }),
    [localDna, resolution, workspace, user],
  )
}
