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
  list: (ws: string, params?: { status?: string; limit?: number; offset?: number }) =>
    [...orderKeys.all, ws, 'list', params] as const,
  detail: (ws: string, id: string) => [...orderKeys.all, ws, 'detail', id] as const,
  settings: (ws: string) => [...orderKeys.all, ws, 'storefront-settings'] as const,
  publishable: (ws: string) => [...orderKeys.all, ws, 'publishable-keys'] as const,
}

export interface SalesOrderItemRow {
  id?: string
  product_id?: string | null
  product_name: string
  quantity: string | number
  delivered_quantity?: string | number
  reserved_quantity?: string | number
  warehouse_id?: string | null
  unit_price: string | number
  line_total: string | number
}

export interface SalesOrderRow {
  id: string
  order_number?: string | null
  status: string
  customer_id?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  warehouse_id?: string | null
  currency?: string | null
  total: string | number
  invoice_id?: string | null
  notes?: string | null
  created_at: string
  items?: SalesOrderItemRow[]
}

const ws = () => getActiveWorkspaceId() ?? ''

export function useSalesOrders(params?: { status?: string; limit?: number; offset?: number }) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: orderKeys.list(ws(), params),
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data?: SalesOrderRow[]
        total?: number
        limit?: number
        offset?: number
      }>('/orders', { params })
      return {
        orders: asList<SalesOrderRow>(data?.data, '/orders'),
        total: Number(data?.total ?? 0),
      }
    },
    enabled: ready,
  })
}

export function useSalesOrder(id: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: orderKeys.detail(ws(), id ?? ''),
    queryFn: async () => (await apiClient.get(`/orders/${id}`)).data as SalesOrderRow,
    enabled: ready && Boolean(id),
  })
}

export function useCreateSalesOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) =>
      (await apiClient.post('/orders', input)).data as SalesOrderRow,
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.all }),
  })
}

export function useConfirmSalesOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      input: string | { id: string; warehouseId?: string; allowBackorder?: boolean },
    ) => {
      const id = typeof input === 'string' ? input : input.id
      const body =
        typeof input === 'string'
          ? {}
          : {
              ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}),
              ...(input.allowBackorder !== undefined
                ? { allowBackorder: input.allowBackorder }
                : {}),
            }
      return (await apiClient.post(`/orders/${id}/confirm`, body)).data as SalesOrderRow
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.all }),
  })
}

export function useAcceptSalesOrderQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; warehouseId?: string; allowBackorder?: boolean }) =>
      (
        await apiClient.post(`/orders/${input.id}/accept-quote`, {
          ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}),
          ...(input.allowBackorder !== undefined ? { allowBackorder: input.allowBackorder } : {}),
        })
      ).data as SalesOrderRow,
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.all }),
  })
}

export function useDeliverSalesOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      warehouseId: string
      idempotencyKey: string
      deliveryNoteId?: string
      notes?: string
      lines: Array<{ orderItemId: string; quantity: number }>
    }) =>
      (
        await apiClient.post(`/orders/${input.id}/deliver`, {
          warehouseId: input.warehouseId,
          idempotencyKey: input.idempotencyKey,
          ...(input.deliveryNoteId ? { deliveryNoteId: input.deliveryNoteId } : {}),
          ...(input.notes ? { notes: input.notes } : {}),
          lines: input.lines,
        })
      ).data as { order: SalesOrderRow; delivery: Record<string, unknown> },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.all })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useCancelSalesOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) =>
      (await apiClient.post(`/orders/${id}/cancel`, reason ? { reason } : {}))
        .data as SalesOrderRow,
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.all }),
  })
}

export function useFulfillSalesOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.post(`/orders/${id}/fulfill`, {})).data as SalesOrderRow,
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.all }),
  })
}

export function useInvoiceSalesOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, customerId }: { id: string; customerId?: string }) =>
      (await apiClient.post(`/orders/${id}/invoice`, customerId ? { customerId } : {})).data as {
        order: SalesOrderRow
        invoiceId?: string
      },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.all })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

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
