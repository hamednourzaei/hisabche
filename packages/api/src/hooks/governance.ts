// ============================================
// Separation of duties — TanStack Query
//
// ---------------------------------------------------------------------------
// WHY THIS IS OFF BY DEFAULT
//
// Most workspaces are one person. A control that refuses the owner their own
// till, on their own shop, teaches them to share a login — and a shared login
// destroys every other control at once.
//
// So `mode` starts at `off`, and turning it on is a deliberate act by somebody
// who has staff. `warn` records the conflict and lets the work through;
// `strict` refuses it.
//
// Each rule is a real separation a bookkeeper would recognise, named
// individually so a shop can switch off the one that does not fit how it works
// without switching off the rest.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { asList } from '../lib/as-list'

export type SoDMode = 'off' | 'warn' | 'strict'

export interface SoDRule {
  id: string
  capability: string
  conflictsWith: string[]
  /** Why, in one sentence, for the person who is refused. */
  rationale: string
}

export interface SoDSettings {
  mode: SoDMode
  /** Rule ids the workspace has deliberately switched off. */
  disabledRules: string[]
}

export interface SoDOverride {
  id: string
  rule_id: string
  entity_type: string
  entity_id: string
  capability: string
  actor_id: string
  reason: string
  created_at: string
}

export const governanceKeys = {
  all: ['governance'] as const,
  sod: () => [...governanceKeys.all, 'sod'] as const,
  overrides: () => [...governanceKeys.all, 'overrides'] as const,
}

export function useSoD() {
  const ready = useAuthReady()

  return useQuery({
    queryKey: governanceKeys.sod(),
    queryFn: async () => {
      const { data } = await apiClient.get('/governance/sod')
      return data as { settings: SoDSettings; rules: SoDRule[] }
    },
    enabled: ready,
    staleTime: 5 * 60_000,
  })
}

/**
 * Every time the control was overridden, newest first.
 *
 * The list IS the control when the mode is `warn`: nothing was blocked, so the
 * only thing standing between a conflict and nobody noticing is that somebody
 * reads this.
 */
export function useSoDOverrides() {
  const ready = useAuthReady()

  return useQuery({
    queryKey: governanceKeys.overrides(),
    queryFn: async () => {
      const { data } = await apiClient.get('/governance/sod/overrides')
      return asList<SoDOverride>(data)
    },
    enabled: ready,
    staleTime: 60_000,
  })
}

export function useSaveSoD() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { mode?: SoDMode; disabledRules?: string[] }) => {
      // PUT, not POST. The route is `fastify.put('/sod', ...)` — settings are
      // replaced, not appended — and POST matched nothing, so every attempt to
      // change the mode answered 404 and the switch silently did nothing.
      const { data } = await apiClient.put('/governance/sod', input)
      return data as SoDSettings
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: governanceKeys.all })
    },
  })
}
