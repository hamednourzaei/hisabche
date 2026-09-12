// ============================================
// packages/api/src/hooks/audit-trail.ts
//
// G4 — the workspace's audit trail, for the «سابقه تغییرات» tab.
//
// ⚠️ NOT the activity feed. `useActivities` reads `activities`, which is the
// interface's feed: things that happened lately, with read/pinned/archived
// state belonging to the person looking at it.
//
// This reads `audit_logs`, which is evidence: append-only, with before/after
// values, for answering "prove what happened to this record". The architecture
// is explicit that the two stay separate datasets — merging them would give the
// compliance record a read flag and the feed a legal weight, and neither is
// what either is for.
// ============================================

import { useQuery } from '@tanstack/react-query'

import { asList } from '../lib/as-list'
import { apiClient } from '../lib/client'
import { useAuthReady } from './useAuthReady'

export interface AuditEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  created_at: string
  /** Present on the detailed read; the list projection omits them for size. */
  user_id?: string | null
  branch_id?: string | null
  old_data?: Record<string, unknown> | null
  new_data?: Record<string, unknown> | null
}

export interface AuditPage {
  data: AuditEntry[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface AuditTrailFilters {
  entityType?: string | undefined
  entityId?: string | undefined
  userId?: string | undefined
  branchId?: string | undefined
  action?: string | undefined
  startDate?: string | undefined
  endDate?: string | undefined
  page?: number | undefined
  limit?: number | undefined
}

export const auditTrailKeys = {
  all: ['audit-trail'] as const,
  list: (filters: AuditTrailFilters) => [...auditTrailKeys.all, 'list', filters] as const,
  entity: (entityType?: string, entityId?: string) =>
    [...auditTrailKeys.all, 'entity', entityType, entityId] as const,
}

const unwrap = <T>(response: unknown): T => {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data: T }).data
  }
  return response as T
}

/**
 * The audit trail for this workspace.
 *
 * The workspace is NOT a parameter — the server takes it from the verified
 * request context. Anything sent here only narrows within it.
 */
export function useAuditTrail(filters: AuditTrailFilters = {}) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: auditTrailKeys.list(filters),
    queryFn: async () =>
      unwrap<AuditPage>(await apiClient.get('/audit/workspace', { params: filters })),
    enabled: authReady,
    // Short: an audit trail people are actively watching should not lag behind
    // what just happened.
    staleTime: 1000 * 15,
  })
}

/** H6 — every recorded change to one record, for its own detail screen. */
export function useRecordHistory(entityType?: string, entityId?: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: auditTrailKeys.entity(entityType, entityId),
    queryFn: async () => {
      const body = unwrap<{ history: AuditEntry[] }>(
        await apiClient.get(`/audit/workspace/${entityType}/${entityId}`),
      )
      return asList<AuditEntry>(body?.history, `/audit/workspace/${entityType}`)
    },
    enabled: authReady && !!entityType && !!entityId,
  })
}
