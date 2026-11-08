// ============================================
// packages/api/src/hooks/guide-progress.ts
//
// The in-app guide steps the signed-in PERSON has seen, kept on the server
// (user-guide-progress-01) so a guide read once never comes back — not after a
// hard refresh, not on another browser or device.
//
// `GET` answers `configured: false` until the migration runs; the guide then
// falls back to the device copy instead of showing nothing or everything.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/client'
import { useAuthReady } from './useAuthReady'

export interface GuideStepSeen {
  stepId: string
  routeId: string
  seenAt: string
}

export interface GuideProgress {
  configured: boolean
  steps: GuideStepSeen[]
}

export const guideProgressKeys = {
  all: ['guide-progress'] as const,
}

export function useGuideProgress(options?: { enabled?: boolean | undefined }) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: guideProgressKeys.all,
    queryFn: async (): Promise<GuideProgress> => {
      const { data } = await apiClient.get<Partial<GuideProgress>>('/me/guide-progress')
      return {
        configured: data?.configured === true,
        steps: Array.isArray(data?.steps) ? data.steps : [],
      }
    },
    enabled: authReady && options?.enabled !== false,
    // The person's own record: read once per visit, it only ever grows here.
    staleTime: Infinity,
    // Never written to the device cache: the device copy is the guide store's.
    meta: { persist: false },
  })
}

export function useMarkGuideStepsSeen() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (steps: { stepId: string; routeId: string }[]) => {
      const { data } = await apiClient.post<{ configured: boolean }>('/me/guide-progress', {
        steps,
      })
      return data
    },
    onSuccess: (_data, steps) => {
      const now = new Date().toISOString()
      queryClient.setQueryData<GuideProgress>(guideProgressKeys.all, (previous) => {
        const known = new Set((previous?.steps ?? []).map((step) => step.stepId))
        return {
          configured: previous?.configured ?? true,
          steps: [
            ...(previous?.steps ?? []),
            ...steps
              .filter((step) => !known.has(step.stepId))
              .map((step) => ({ ...step, seenAt: now })),
          ],
        }
      })
    },
  })
}
