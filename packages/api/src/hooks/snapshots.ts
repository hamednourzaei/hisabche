// ============================================
// Data snapshots (#42–#46) — markers of how many records the business held at
// a moment, and what has been added since.
//
//   GET  /snapshots
//   POST /snapshots               { label }
//   GET  /snapshots/:id/compare
//
// ⚠️ Not a backup: nothing can be restored from a marker (`restorable: false`).
// `count: null` and `added: null` mean «not known», never zero.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export interface DataSnapshot {
  id: string
  label: string
  takenAt: string
  restorable: false
  limitations: string[]
  tables: Array<{ table: string; count: number | null }>
}

export interface DataSnapshotComparison extends DataSnapshot {
  readable: boolean
  asOf: string
  changes: Array<{ table: string; then: number | null; now: number | null; added: number | null }>
}

export const snapshotKeys = {
  all: ['data-snapshots'] as const,
  list: () => [...snapshotKeys.all, 'list'] as const,
  compare: (id: string) => [...snapshotKeys.all, 'compare', id] as const,
}

export function useDataSnapshots(requested = true) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: snapshotKeys.list(),
    queryFn: async (): Promise<DataSnapshot[]> => {
      const { data } = await apiClient.get<{ snapshots: DataSnapshot[] }>('/snapshots')
      return asList<DataSnapshot>(data?.snapshots).map((snapshot) => ({
        ...snapshot,
        tables: asList<DataSnapshot['tables'][number]>(snapshot.tables),
        limitations: asList<string>(snapshot.limitations),
      }))
    },
    enabled: ready && requested,
    staleTime: 60_000,
  })
}

export function useTakeDataSnapshot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (label: string) =>
      (await apiClient.post<DataSnapshot>('/snapshots', { label })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: snapshotKeys.list() }),
  })
}

/** Compared with NOW each time it is opened — never an old comparison. */
export function useDataSnapshotComparison(id: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: snapshotKeys.compare(id ?? ''),
    queryFn: async (): Promise<DataSnapshotComparison> => {
      const { data } = await apiClient.get<DataSnapshotComparison>(`/snapshots/${id}/compare`)
      return { ...data, changes: asList<DataSnapshotComparison['changes'][number]>(data?.changes) }
    },
    enabled: ready && !!id,
    staleTime: 0,
  })
}
