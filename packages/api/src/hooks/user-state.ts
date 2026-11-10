// ============================================
// packages/api/src/hooks/user-state.ts
//
// What the signed-in person keeps on the server (user-state-01): invoice
// drafts in this workspace, and their theme. The backend is only a step —
// the database holds both, so they follow the person to every device.
// `configured: false` until the migration runs; callers then say so.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InvoiceDraftKind, InvoiceDraftSaveInput, ThemePreference } from '@hisabche/validation'

import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export interface InvoiceDraftRecord {
  id: string
  kind: InvoiceDraftKind
  title: string
  payload: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface InvoiceDraftList {
  configured: boolean
  drafts: InvoiceDraftRecord[]
}

export interface UserPreferences {
  configured: boolean
  theme: ThemePreference | null
}

export const userStateKeys = {
  drafts: ['me', 'invoice-drafts'] as const,
  preferences: ['me', 'preferences'] as const,
}

export function useInvoiceDrafts(options: { enabled?: boolean } = {}) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: userStateKeys.drafts,
    queryFn: async (): Promise<InvoiceDraftList> => {
      const { data } = await apiClient.get<Partial<InvoiceDraftList>>('/me/invoice-drafts')
      return {
        configured: data?.configured === true,
        drafts: asList<InvoiceDraftRecord>(data?.drafts),
      }
    },
    enabled: authReady && options.enabled !== false,
    // A draft saved on another device should show the next time the list opens.
    staleTime: 0,
  })
}

export function useSaveInvoiceDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: InvoiceDraftSaveInput) => {
      const { data } = await apiClient.put<InvoiceDraftRecord>('/me/invoice-drafts', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userStateKeys.drafts }),
  })
}

export function useDeleteInvoiceDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/me/invoice-drafts/${encodeURIComponent(id)}`)
      return id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userStateKeys.drafts }),
  })
}

export function useUserPreferences(options: { enabled?: boolean } = {}) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: userStateKeys.preferences,
    queryFn: async (): Promise<UserPreferences> => {
      const { data } = await apiClient.get<Partial<UserPreferences>>('/me/preferences')
      return { configured: data?.configured === true, theme: data?.theme ?? null }
    },
    enabled: authReady && options.enabled !== false,
  })
}

export function useSaveUserPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (theme: ThemePreference) => {
      const { data } = await apiClient.put<UserPreferences>('/me/preferences', { theme })
      return data
    },
    onSuccess: (data) =>
      queryClient.setQueryData<UserPreferences>(userStateKeys.preferences, {
        configured: true,
        theme: data?.theme ?? null,
      }),
  })
}
