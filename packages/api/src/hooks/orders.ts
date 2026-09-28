// ============================================
// packages/api/src/hooks/orders.ts
//
// Sales orders and the storefront (backend/src/routes/orders.routes.ts,
// docs/developer-platform-03-commerce-migration.sql).
//
// ⚠️ Rows are the database rows the service returns — snake_case, typed from
// backend/src/services/orders/orders.repository.ts. `total`, `quantity`,
// `unit_price` and `line_total` arrive as DECIMAL STRINGS (Postgres numeric);
// they are shown, never added up here — the database computed them.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  OrderStatus,
  PublishableKeyCreateInput,
  StorefrontSettings,
} from '@hisabche/validation'

import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { getActiveWorkspaceId } from '../lib/active-workspace'
import { useAuthReady } from './useAuthReady'
import { invoiceKeys } from './invoices'
import { paymentKeys } from './payments'
import { productKeys } from './products'

export interface SalesOrderLine {
  product_id: string
  product_name: string
  unit: string | null
  quantity: string
  unit_price: string
  line_total: string
}

export interface SalesOrderRow {
  id: string
  order_number: string
  status: OrderStatus
  source: 'website' | 'api' | 'dashboard'
  customer_name: string
  customer_phone: string
  customer_email: string | null
  customer_note: string | null
  customer_id: string | null
  total: string
  invoice_id: string | null
  public_token: string
  cancel_reason: string | null
  created_at: string
  expires_at: string | null
  items?: SalesOrderLine[]
}

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
  list: (ws: string, status: OrderStatus | 'all', page: number) =>
    [...orderKeys.all, ws, 'list', status, page] as const,
  one: (ws: string, id: string) => [...orderKeys.all, ws, 'one', id] as const,
  settings: (ws: string) => [...orderKeys.all, ws, 'storefront-settings'] as const,
  publishable: (ws: string) => [...orderKeys.all, ws, 'publishable-keys'] as const,
}

const ws = () => getActiveWorkspaceId() ?? ''
export const ORDERS_PAGE_SIZE = 50

export function useOrders(status: OrderStatus | 'all', page = 0) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: orderKeys.list(ws(), status, page),
    queryFn: async () => {
      const params: Record<string, string | number> = {
        limit: ORDERS_PAGE_SIZE,
        offset: page * ORDERS_PAGE_SIZE,
      }
      if (status !== 'all') params.status = status
      const body = (await apiClient.get('/orders', { params })).data as {
        data?: unknown
        total?: unknown
      } | null
      return { rows: asList<SalesOrderRow>(body?.data), total: Number(body?.total ?? 0) }
    },
    enabled: ready,
    retry: false,
  })
}

export function useOrder(id: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: orderKeys.one(ws(), id ?? ''),
    queryFn: async () => {
      const row = (await apiClient.get(`/orders/${id}`)).data as SalesOrderRow
      return { ...row, items: asList<SalesOrderLine>(row?.items) }
    },
    enabled: ready && !!id,
    retry: false,
  })
}

export type OrderAction = 'confirm' | 'cancel' | 'fulfill' | 'invoice'

/** One mutation for the lifecycle; the server decides whether the move is allowed. */
export function useOrderAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      action: OrderAction
      reason?: string | undefined
      customerId?: string | undefined
    }) => {
      const body =
        input.action === 'cancel'
          ? input.reason
            ? { reason: input.reason }
            : {}
          : input.action === 'invoice' && input.customerId
            ? { customerId: input.customerId }
            : {}
      // One literal path per action, so the client/server route contract
      // (backend client-route-contract.test.ts) can see every address.
      const paths: Record<OrderAction, string> = {
        confirm: `/orders/${input.id}/confirm`,
        cancel: `/orders/${input.id}/cancel`,
        fulfill: `/orders/${input.id}/fulfill`,
        invoice: `/orders/${input.id}/invoice`,
      }
      return (await apiClient.post(paths[input.action], body)).data as SalesOrderRow
    },
    onSuccess: (_row, input) => {
      void qc.invalidateQueries({ queryKey: orderKeys.all })
      // Invoicing creates an invoice, moves stock and books the ledger.
      if (input.action === 'invoice') {
        void qc.invalidateQueries({ queryKey: invoiceKeys.all })
        void qc.invalidateQueries({ queryKey: productKeys.all })
        void qc.invalidateQueries({ queryKey: paymentKeys.all })
      }
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
