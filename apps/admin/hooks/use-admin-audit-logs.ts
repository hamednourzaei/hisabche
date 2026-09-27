'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

/**
 * The platform audit trail.
 *
 * Endpoint: `GET /admin/audit-logs?limit=&offset=` → `{ logs, total }`.
 * Note the response has NO `limit`/`offset` echo — `getAuditLogs` returns only
 * those two fields — so paging state stays owned by the caller.
 *
 * Columns come from what `AuditService.log()` actually inserts. Every field is
 * nullable except the ones the writer always sets, and `old_data`/`new_data`
 * are free-form JSON snapshots, hence `unknown` rather than a fabricated
 * shape.
 *
 * ⚠️ The route takes ONLY limit/offset. `AuditService.getLogs` supports
 * action / entity / date filters, but `admin.routes.ts:366` parses `listQuery`
 * and passes neither — so this screen offers no server-side filters, and does
 * not pretend to.
 */
export interface AdminAuditLog {
  id: string
  user_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  // The list carries no before/after snapshots (27 Sep 2026): they were never
  // shown here, and each one is a full JSON copy of a record.
  ip_address: string | null
  created_at: string
}

export interface AdminAuditLogList {
  logs: AdminAuditLog[]
  total: number
}

export interface AuditLogParams {
  limit?: number
  offset?: number
}

export const adminAuditLogKeys = {
  all: ['admin', 'audit-logs'] as const,
  list: (params: AuditLogParams) => [...adminAuditLogKeys.all, 'list', params] as const,
}

export function useAdminAuditLogs(params: AuditLogParams) {
  return useQuery<AdminAuditLogList>({
    queryKey: adminAuditLogKeys.list(params),
    queryFn: async () => {
      const response = await apiClient.get('/admin/audit-logs', { params })
      return response.data
    },
    placeholderData: keepPreviousData,
    // Short: the whole value of an audit view is that it is current.
    staleTime: 1000 * 15,
    retry: false,
  })
}
