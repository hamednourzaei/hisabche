// packages/api/src/hooks/useMarkAllActivitiesAsRead.ts
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { activityKeys } from './useActivities'

export function useMarkAllActivitiesAsRead() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string | undefined | void>({
    mutationFn: async (filter?: string | undefined | void) => {
      await apiClient.patch(
        '/v1/activities/mark-all-read',
        {},
        {
          params: filter && filter !== 'all' ? { filter } : undefined,
        },
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.all })
      queryClient.invalidateQueries({ queryKey: activityKeys.unread() })
    },
    onError: (error) => {
      console.error('Failed to mark all activities as read:', error)
    },
  })
}
