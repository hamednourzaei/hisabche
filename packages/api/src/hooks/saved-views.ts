// ============================================
// Capabilities #87 / #89 — saved views of the application's tables.
//
//   GET    /saved-views?tableId=   the reader's own, then the shared ones
//   POST   /saved-views            save the current look under a name
//   PATCH  /saved-views/:id        rename / share / replace (owner only)
//   DELETE /saved-views/:id        remove (owner only)
//
// A view is a LOOK — hidden columns, sort, search. It carries no rows and no
// selection, and applying a shared one never shows data the reader's role does
// not already allow.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export interface SavedViewLook {
  hiddenIds: string[]
  sortId: string | null
  sortDirection: 'asc' | 'desc'
  search: string
}

export interface SavedView {
  id: string
  tableId: string
  name: string
  state: SavedViewLook
  shared: boolean
  /** Whether the reader saved it — only then may they change or remove it. */
  mine: boolean
  createdAt: string
}

export const savedViewKeys = {
  all: ['saved-views'] as const,
  table: (tableId: string) => [...savedViewKeys.all, tableId] as const,
}

export function useSavedViews(tableId: string, options: { enabled?: boolean } = {}) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: savedViewKeys.table(tableId),
    queryFn: async (): Promise<SavedView[]> => {
      const { data } = await apiClient.get<{ views?: unknown }>('/saved-views', {
        params: { tableId },
      })
      return asList<SavedView>(data?.views)
    },
    enabled: authReady && options.enabled !== false,
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useCreateSavedView() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      tableId: string
      name: string
      state: SavedViewLook
      shared: boolean
    }): Promise<SavedView> => {
      const { data } = await apiClient.post<SavedView>('/saved-views', input)
      return data
    },
    onSuccess: (_view, input) =>
      void queryClient.invalidateQueries({ queryKey: savedViewKeys.table(input.tableId) }),
  })
}

export function useUpdateSavedView() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      name?: string
      shared?: boolean
    }): Promise<SavedView> => {
      const { id, ...patch } = input
      const { data } = await apiClient.patch<SavedView>(`/saved-views/${id}`, patch)
      return data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: savedViewKeys.all }),
  })
}

export function useRemoveSavedView() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await apiClient.delete(`/saved-views/${id}`)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: savedViewKeys.all }),
  })
}
