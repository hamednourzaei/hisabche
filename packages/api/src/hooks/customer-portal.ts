// ============================================
// packages/api/src/hooks/customer-portal.ts
//
// Portal links for one customer (backend/src/routes/customer-portal.routes.ts).
// Rows are the service's snake_case rows.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { getActiveWorkspaceId } from '../lib/active-workspace'
import { useAuthReady } from './useAuthReady'

export interface PortalLinkRow {
  id: string
  customer_id: string
  token: string
  created_at: string
  expires_at: string | null
  last_used_at: string | null
  revoked_at: string | null
}

export const portalKeys = {
  links: (customerId: string) =>
    ['customer-portal-links', getActiveWorkspaceId() ?? '', customerId] as const,
}

export function useCustomerPortalLinks(customerId: string) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: portalKeys.links(customerId),
    queryFn: async () =>
      asList<PortalLinkRow>(
        ((await apiClient.get(`/customers/${customerId}/portal-links`)).data as { data?: unknown })
          ?.data,
      ),
    enabled: ready && !!customerId,
    retry: false,
  })
}

export function useCreatePortalLink(customerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { expiresInDays?: number | undefined }) =>
      (await apiClient.post(`/customers/${customerId}/portal-links`, input)).data as PortalLinkRow,
    onSuccess: () => qc.invalidateQueries({ queryKey: portalKeys.links(customerId) }),
  })
}

export function useRevokePortalLink(customerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (linkId: string) => {
      await apiClient.delete(`/customer-portal-links/${linkId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: portalKeys.links(customerId) }),
  })
}
