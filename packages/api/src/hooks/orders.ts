// ============================================
// packages/api/src/hooks/orders.ts
//
// The storefront settings and its publishable keys
// (backend/src/routes/orders.routes.ts, docs/developer-platform-03-commerce-migration.sql).
// The orders LIST screen was removed (owner, 18 Oct 2026: «پیاده سازی نشده»);
// orders still flow through the API and the storefront.
//
// ⚠️ Rows are the database rows the service returns — snake_case, typed from
// backend/src/services/orders/orders.repository.ts. `total`, `quantity`,
// `unit_price` and `line_total` arrive as DECIMAL STRINGS (Postgres numeric);
// they are shown, never added up here — the database computed them.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PublishableKeyCreateInput, StorefrontSettings } from '@hisabche/validation'

import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { getActiveWorkspaceId } from '../lib/active-workspace'
import { useAuthReady } from './useAuthReady'

export interface PublishableKeyRow {
  id: string
  name: string
  prefix: string
  public_token: string
  allowed_origins: string[]
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

export const orderKeys = {
  all: ['orders'] as const,
  settings: (ws: string) => [...orderKeys.all, ws, 'storefront-settings'] as const,
  publishable: (ws: string) => [...orderKeys.all, ws, 'publishable-keys'] as const,
}

const ws = () => getActiveWorkspaceId() ?? ''

export function useStorefrontSettings() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: orderKeys.settings(ws()),
    queryFn: async () => (await apiClient.get('/storefront/settings')).data as StorefrontSettings,
    enabled: ready,
    retry: false,
  })
}

export function useSaveStorefrontSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (settings: StorefrontSettings) =>
      (await apiClient.put('/storefront/settings', settings)).data as StorefrontSettings,
    onSuccess: (saved) => qc.setQueryData(orderKeys.settings(ws()), saved),
  })
}

export function usePublishableKeys() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: orderKeys.publishable(ws()),
    queryFn: async () =>
      asList<PublishableKeyRow>(
        ((await apiClient.get('/developer/storefront-keys')).data as { data?: unknown })?.data,
      ),
    enabled: ready,
    retry: false,
  })
}

export function useCreatePublishableKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: PublishableKeyCreateInput) =>
      (await apiClient.post('/developer/storefront-keys', input)).data as PublishableKeyRow,
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.publishable(ws()) }),
  })
}

export function useRevokePublishableKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/developer/keys/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.publishable(ws()) }),
  })
}
