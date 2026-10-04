// ============================================
// Notes on a customer, supplier, product or employee (#103).
//
//   GET  /notes?entityType=&entityId=
//   POST /notes   { entityType, entityId, body }
//
// A log: a note is added and stays as written. There is no edit and no delete.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export type NoteEntityType = 'customer' | 'supplier' | 'product' | 'employee'

export interface EntityNote {
  id: string
  body: string
  createdAt: string
  /** Written by the person reading. */
  mine: boolean
}

export const noteKeys = {
  all: ['entity-notes'] as const,
  entity: (entityType: NoteEntityType, entityId: string) =>
    [...noteKeys.all, entityType, entityId] as const,
}

export function useEntityNotes(entityType: NoteEntityType, entityId: string, requested = true) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: noteKeys.entity(entityType, entityId),
    queryFn: async (): Promise<EntityNote[]> => {
      const { data } = await apiClient.get<{ notes: EntityNote[] }>('/notes', {
        params: { entityType, entityId },
      })
      return asList<EntityNote>(data?.notes)
    },
    enabled: ready && requested && !!entityId,
    staleTime: 30_000,
  })
}

export function useAddEntityNote(entityType: NoteEntityType, entityId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: string) =>
      (await apiClient.post<EntityNote>('/notes', { entityType, entityId, body })).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: noteKeys.entity(entityType, entityId) }),
  })
}
