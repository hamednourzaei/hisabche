// ============================================
// packages/api/src/hooks/sync-overview.ts
//
// Devices and failed changes (GET /api/sync/overview, from sync_mutations) and
// duplicate candidates (GET /api/intelligence/duplicates/:entity, the existing
// MDM detector that had no caller). Real server data only.
// ============================================

import { useQuery } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'
import { useMyCapabilities } from './governance'

export interface SyncDeviceSummary {
  deviceId: string
  lastSeenAt: string
  applied: number
  rejected: number
}

export interface SyncFailedChange {
  mutationId: string
  entityType: string
  entityId: string | null
  operation: string
  errorCode: string | null
  deviceId: string | null
  at: string
}

export interface SyncOverview {
  windowDays: number
  truncated: boolean
  devices: SyncDeviceSummary[]
  failed: { count: number; recent: SyncFailedChange[] }
}

export function useSyncOverview() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: ['sync', 'overview'],
    queryFn: async (): Promise<SyncOverview> => {
      const { data } = await apiClient.get('/sync/overview')
      const body = (data ?? {}) as Partial<SyncOverview>
      return {
        windowDays: Number(body.windowDays) || 30,
        truncated: body.truncated === true,
        devices: asList<SyncDeviceSummary>(body.devices),
        failed: {
          count: Number(body.failed?.count) || 0,
          recent: asList<SyncFailedChange>(body.failed?.recent),
        },
      }
    },
    enabled: ready,
    staleTime: 60_000,
  })
}

export interface DuplicateSummary {
  entity: 'customer' | 'product'
  scanned: number
  candidates: number
}

/** Candidate duplicates for customers and products (counts only on this page). */
export function useDuplicateCounts() {
  const ready = useAuthReady()
  const allowed = useMyCapabilities().can('customer.read') === true
  return useQuery({
    queryKey: ['mdm', 'duplicate-counts'],
    queryFn: async (): Promise<DuplicateSummary[]> => {
      const read = async (entity: 'customer' | 'product') => {
        const { data } = await apiClient.get(`/intelligence/duplicates/${entity}`)
        const body = (data ?? {}) as { scanned?: number; candidates?: unknown }
        return {
          entity,
          scanned: Number(body.scanned) || 0,
          candidates: asList(body.candidates).length,
        }
      }
      return Promise.all([read('customer'), read('product')])
    },
    enabled: ready && allowed,
    staleTime: 5 * 60_000,
  })
}
