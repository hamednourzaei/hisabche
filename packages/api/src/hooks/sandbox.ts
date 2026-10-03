// ============================================
// packages/api/src/hooks/sandbox.ts
//
// Sandbox workspaces (backend/src/routes/sandbox.routes.ts,
// docs/developer-platform-06-sandbox-migration.sql).
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '../lib/client'
import { getActiveWorkspaceId } from '../lib/active-workspace'
import { useAuthReady } from './useAuthReady'

export interface SandboxStatus {
  /** The active workspace is a sandbox. */
  isSandbox: boolean
  /** When it is: the real business, if this person is still a member of it. */
  parent: { id: string; name: string } | null
  /** When it is not: this person's sandbox of it, if they made one. */
  sandbox: { id: string; name: string } | null
}

export const sandboxKeys = {
  status: (ws: string) => ['sandbox', ws] as const,
}

export function useSandboxStatus() {
  const ready = useAuthReady()
  const ws = getActiveWorkspaceId() ?? ''
  return useQuery({
    queryKey: sandboxKeys.status(ws),
    queryFn: async () => (await apiClient.get('/developer/sandbox')).data as SandboxStatus,
    enabled: ready && !!ws,
    // Which side of the line a workspace is on never changes (the flag is
    // permanent in the database); only «do I have one yet» does, and that is
    // invalidated by the create below.
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useCreateSandbox() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      (await apiClient.post('/developer/sandbox')).data as {
        id: string
        name: string
        created: boolean
      },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: sandboxKeys.status(getActiveWorkspaceId() ?? '') }),
  })
}

/**
 * Start the ACTIVE sandbox again, empty. The server retires it and answers
 * with a new one (nothing is deleted); the caller switches to the new id.
 * Refused for anything that is not a sandbox.
 */
export function useResetSandbox() {
  return useMutation({
    mutationFn: async () =>
      (await apiClient.post('/developer/sandbox/reset')).data as { id: string; name: string },
  })
}
