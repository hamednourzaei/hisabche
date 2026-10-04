// ============================================
// The person's side of the MCP gateway: actions an AI assistant asked for that
// need approval.
//
//   GET  /ai-requests[?pending=1]
//   POST /ai-requests/:id/approve
//   POST /ai-requests/:id/reject
//
// Approving runs the action as the person approving, once. An assistant cannot
// call these routes: they need a session.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export type AiRequestStatus =
  'pending' | 'approved' | 'executed' | 'failed' | 'rejected' | 'expired'

export interface AiActionRequest {
  id: string
  keyId: string
  tool: string
  risk: 'financial' | 'destructive'
  arguments: Record<string, unknown>
  status: AiRequestStatus
  resultStatus: number | null
  decidedAt: string | null
  createdAt: string
}

export const aiRequestKeys = {
  all: ['ai-requests'] as const,
  list: () => [...aiRequestKeys.all, 'list'] as const,
}

/**
 * Where an AI client connects: the server's own origin + `/mcp`. Derived from
 * the address this app already talks to, so a self-hosted or staging server
 * shows its own endpoint, not production's.
 */
export function mcpEndpointUrl(): string {
  const base = String(apiClient.defaults.baseURL ?? '')
  return `${base.replace(/\/api\/?$/, '')}/mcp`
}

export function useAiActionRequests(requested = true) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: aiRequestKeys.list(),
    queryFn: async (): Promise<AiActionRequest[]> => {
      const { data } = await apiClient.get<{ requests: AiActionRequest[] }>('/ai-requests')
      return asList<AiActionRequest>(data?.requests)
    },
    enabled: ready && requested,
    // A request can arrive at any moment; never served from long ago.
    staleTime: 10_000,
  })
}

export function useDecideAiActionRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; decision: 'approve' | 'reject' }) =>
      // Two addresses spelled out, not one built from a variable: the
      // client-route contract test reads these to check a server route exists.
      input.decision === 'approve'
        ? (await apiClient.post<AiActionRequest>(`/ai-requests/${input.id}/approve`, {})).data
        : (await apiClient.post<AiActionRequest>(`/ai-requests/${input.id}/reject`, {})).data,
    // Settled, not only succeeded: a refused approval («already decided») also
    // means the list on screen is out of date.
    onSettled: () => queryClient.invalidateQueries({ queryKey: aiRequestKeys.list() }),
  })
}
