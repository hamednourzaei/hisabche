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
import { getActiveWorkspaceId } from '../lib/active-workspace'

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

// ─── My capabilities ────────────────────────────────────────────────────────

/**
 * The capabilities the signed-in member holds in the active workspace, as the
 * SERVER's table answers it. Used only to avoid requesting data that would
 * 403 — never as authorization.
 *
 * `can(x)` is `undefined` while unknown, so a gated query stays disabled until
 * the answer arrives instead of firing and failing.
 */
export function useMyCapabilities() {
  const ready = useAuthReady()
  const workspaceId = getActiveWorkspaceId()

  const query = useQuery({
    queryKey: ['governance', 'my-capabilities', workspaceId ?? ''],
    queryFn: async () => {
      const { data } = await apiClient.get('/governance/my-capabilities')
      const body = data as { role?: string; capabilities?: unknown } | null
      return {
        role: typeof body?.role === 'string' ? body.role : null,
        capabilities: asList<string>(body?.capabilities),
      }
    },
    enabled: ready && !!workspaceId,
    staleTime: 5 * 60_000,
  })

  const set = new Set(query.data?.capabilities ?? [])
  return {
    ...query,
    can: (capability: string): boolean | undefined =>
      query.data ? set.has(capability) : undefined,
  }
}
