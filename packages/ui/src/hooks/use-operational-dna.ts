// packages/ui/src/hooks/use-operational-dna.ts
'use client'

import { useMemo } from 'react'
import { useOnboardingStore, useAuthStore } from '@hisabche/store'
import { useWorkspaceProfile } from '@hisabche/api'
import {
  type OperationalDna,
  type ResolvedBusinessConfiguration,
  resolveDnaCapabilities,
  inferOperationalDna,
} from '@hisabche/validation'

export interface OperationalDnaState {
  readonly dna: OperationalDna | null
  readonly resolution: ResolvedBusinessConfiguration
  readonly isResolved: boolean
}

export function useOperationalDna(): OperationalDnaState {
  const localDna = useOnboardingStore((state) => state.operationalDna)
  const user = useAuthStore((state) => state.user)
  const workspace = useWorkspaceProfile().data

  const resolution = useMemo(() => {
    // 1. Explicit Operational DNA if stored
    if (localDna) {
      return resolveDnaCapabilities(localDna)
    }

    // 2. Derive DNA safely from workspace or user declared business profile
    const types = workspace?.declared ? workspace.businessTypes : (user?.businessTypes ?? [])
    const primaryTrade = Array.isArray(types)
      ? types[0]
      : typeof types === 'string'
        ? types
        : undefined

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
