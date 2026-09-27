// ============================================
// packages/api/src/hooks/developer.ts
//
// The developer screen: API keys and outbound webhooks
// (backend/src/routes/developer.routes.ts). Owners and managers only — the
// server enforces `workspace.manage`; these hooks only ask.
//
// ⚠️ Response rows are the database rows the service returns, snake_case,
// typed from backend/src/services/developer/developer.repository.ts — not a
// camelCase guess (راهنمای سشن §۸, «قرارداد داده‌ی بین لایه‌ها»).
//
// ⚠️ A key's plain text and a webhook's secret come back ONCE, in the
// mutation's result. They are never put in the query cache.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ApiKeyCreateInput,
  ApiKeyScope,
  WebhookEndpointCreateInput,
  WebhookEndpointUpdateInput,
  WebhookEventType,
} from '@hisabche/validation'

import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { getActiveWorkspaceId } from '../lib/active-workspace'
import { useAuthReady } from './useAuthReady'

export interface ApiKeyRow {
  id: string
  name: string
  prefix: string
  scopes: ApiKeyScope[]
  expires_at: string | null
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

export interface WebhookEndpointRow {
  id: string
  url: string
  description: string | null
  events: WebhookEventType[]
  is_active: boolean
  disabled_reason: string | null
  consecutive_failures: number
  created_at: string
}

export interface WebhookDeliveryRow {
  id: string
  endpoint_id: string
  event_id: string
  event_type: string
  status: 'pending' | 'delivering' | 'succeeded' | 'failed'
  attempts: number
  max_attempts: number
  next_attempt_at: string
  last_status_code: number | null
  last_error: string | null
  created_at: string
  delivered_at: string | null
}

export interface DeveloperCatalog {
  scopes: ApiKeyScope[]
  events: Array<{ type: WebhookEventType; resource: string; scope: ApiKeyScope }>
}

export const developerKeys = {
  all: ['developer'] as const,
  catalog: (ws: string) => [...developerKeys.all, ws, 'catalog'] as const,
  keys: (ws: string) => [...developerKeys.all, ws, 'keys'] as const,
  webhooks: (ws: string) => [...developerKeys.all, ws, 'webhooks'] as const,
  deliveries: (ws: string, endpointId: string) =>
    [...developerKeys.all, ws, 'deliveries', endpointId] as const,
}

function useWorkspaceKey(): string {
  return getActiveWorkspaceId() ?? ''
}

export function useDeveloperCatalog() {
  const ready = useAuthReady()
  const ws = useWorkspaceKey()
  return useQuery({
    queryKey: developerKeys.catalog(ws),
    queryFn: async () => {
      const { data } = await apiClient.get('/developer/catalog')
      const body = data as Partial<DeveloperCatalog> | null
      return {
        scopes: asList<ApiKeyScope>(body?.scopes),
        events: asList<DeveloperCatalog['events'][number]>(body?.events),
      }
    },
    enabled: ready,
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useApiKeys() {
  const ready = useAuthReady()
  const ws = useWorkspaceKey()
  return useQuery({
    queryKey: developerKeys.keys(ws),
    queryFn: async () =>
      asList<ApiKeyRow>(
        ((await apiClient.get('/developer/keys')).data as { data?: unknown })?.data,
      ),
    enabled: ready,
    retry: false,
  })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  const ws = useWorkspaceKey()
  return useMutation({
    mutationFn: async (input: ApiKeyCreateInput) =>
      (await apiClient.post('/developer/keys', input)).data as {
        key: ApiKeyRow
        secret: string
        refused: Array<{ scope: string; missing: string }>
      },
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.keys(ws) }),
  })
}

export function useRevokeApiKey() {
  const qc = useQueryClient()
  const ws = useWorkspaceKey()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/developer/keys/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.keys(ws) }),
  })
}

export function useWebhookEndpoints() {
  const ready = useAuthReady()
  const ws = useWorkspaceKey()
  return useQuery({
    queryKey: developerKeys.webhooks(ws),
    queryFn: async () =>
      asList<WebhookEndpointRow>(
        ((await apiClient.get('/developer/webhooks')).data as { data?: unknown })?.data,
      ),
    enabled: ready,
    retry: false,
  })
}

export function useCreateWebhookEndpoint() {
  const qc = useQueryClient()
  const ws = useWorkspaceKey()
  return useMutation({
    mutationFn: async (input: WebhookEndpointCreateInput) =>
      (await apiClient.post('/developer/webhooks', input)).data as {
        endpoint: WebhookEndpointRow
        secret: string
      },
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.webhooks(ws) }),
  })
}

export function useUpdateWebhookEndpoint() {
  const qc = useQueryClient()
  const ws = useWorkspaceKey()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: WebhookEndpointUpdateInput }) =>
      (await apiClient.patch(`/developer/webhooks/${id}`, input)).data as WebhookEndpointRow,
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.webhooks(ws) }),
  })
}

export function useDeleteWebhookEndpoint() {
  const qc = useQueryClient()
  const ws = useWorkspaceKey()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/developer/webhooks/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.webhooks(ws) }),
  })
}

export function useRotateWebhookSecret() {
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.post(`/developer/webhooks/${id}/rotate-secret`)).data as { secret: string },
  })
}

export function useSendWebhookTest() {
  const qc = useQueryClient()
  const ws = useWorkspaceKey()
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.post(`/developer/webhooks/${id}/test`)).data as WebhookDeliveryRow,
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: developerKeys.deliveries(ws, row.endpoint_id) })
      void qc.invalidateQueries({ queryKey: developerKeys.webhooks(ws) })
    },
  })
}

export function useWebhookDeliveries(endpointId: string | null) {
  const ready = useAuthReady()
  const ws = useWorkspaceKey()
  return useQuery({
    queryKey: developerKeys.deliveries(ws, endpointId ?? ''),
    queryFn: async () =>
      asList<WebhookDeliveryRow>(
        (
          (await apiClient.get(`/developer/webhooks/${endpointId}/deliveries`)).data as {
            data?: unknown
          }
        )?.data,
      ),
    enabled: ready && !!endpointId,
    retry: false,
  })
}

export function useRetryWebhookDelivery() {
  const qc = useQueryClient()
  const ws = useWorkspaceKey()
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.post(`/developer/deliveries/${id}/retry`)).data as WebhookDeliveryRow,
    onSuccess: (row) =>
      qc.invalidateQueries({ queryKey: developerKeys.deliveries(ws, row.endpoint_id) }),
  })
}

export interface ApiKeyUsage {
  days: number
  /** Exact counts per day (count(*) on the server). */
  daily: Array<{
    day: string
    requests: number
    client_errors: number
    server_errors: number
    avg_ms: number | null
  }>
  /** The latest requests — a sample to read, not a figure. */
  recent: Array<{
    method: string
    route: string
    status: number
    duration_ms: number
    created_at: string
  }>
}

export function useApiKeyUsage(keyId: string | null) {
  const ready = useAuthReady()
  const ws = useWorkspaceKey()
  return useQuery({
    queryKey: [...developerKeys.keys(ws), 'usage', keyId ?? ''] as const,
    queryFn: async () => {
      const body = (await apiClient.get(`/developer/keys/${keyId}/usage`))
        .data as Partial<ApiKeyUsage> | null
      return {
        days: Number(body?.days ?? 7),
        daily: asList<ApiKeyUsage['daily'][number]>(body?.daily),
        recent: asList<ApiKeyUsage['recent'][number]>(body?.recent),
      }
    },
    enabled: ready && !!keyId,
    retry: false,
  })
}

export function useReplayWebhook() {
  const qc = useQueryClient()
  const ws = useWorkspaceKey()
  return useMutation({
    mutationFn: async ({ id, since }: { id: string; since: string }) =>
      (await apiClient.post(`/developer/webhooks/${id}/replay`, { since })).data as {
        requeued: number
      },
    onSuccess: (_out, { id }) =>
      qc.invalidateQueries({ queryKey: developerKeys.deliveries(ws, id) }),
  })
}
