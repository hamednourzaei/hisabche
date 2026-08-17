'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

export interface AdminStatus {
  status: string
  timestamp: string
  version: string
}

export function useAdminStatus() {
  return useQuery<AdminStatus>({
    queryKey: ['admin', 'status'],
    queryFn: async () => {
      // `apiClient` already carries the `/api` prefix in its baseURL, so the
      // path here must NOT repeat it — '/api/admin/...' produced
      // '.../api/api/admin/...'. The endpoint is `metrics`; `status` never
      // existed on the backend (see backend/src/routes/admin.routes.ts).
      const response = await apiClient.get('/admin/metrics')
      return response.data
    },
    retry: false,
    staleTime: 1000 * 60,
  })
}
