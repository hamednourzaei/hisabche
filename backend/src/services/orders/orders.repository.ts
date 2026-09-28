// ============================================
// backend/src/services/orders/orders.repository.ts
//
// Every database call of sales orders and the storefront. Writes go through
// the lifecycle functions only (docs/developer-platform-03-commerce-migration.sql);
// this file never updates an order row itself.
// ============================================

import {
  STOREFRONT_DEFAULTS,
  type OrderStatus,
  type StorefrontSettings,
} from '@hisabche/validation'

import { supabase } from '../../db'
import { isMissingSchema } from '../blog/blog.domain'
import { NotConfiguredError } from '../developer/developer.repository'
import { orderErrorFrom, type CatalogRow, type OrderLine } from './orders.domain'

function check(error: { code?: string; message?: string } | null): void {
  if (!error) return
  if (isMissingSchema(error)) throw new NotConfiguredError()
  const refusal = orderErrorFrom(error.message)
  if (refusal) throw refusal
  throw Object.assign(new Error(error.message ?? 'database error'), { code: error.code })
}

export interface OrderRow {
  id: string
  workspace_id: string
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
  confirmed_at: string | null
  invoiced_at: string | null
  paid_at: string | null
  fulfilled_at: string | null
  cancelled_at: string | null
}

const ORDER_COLUMNS =
  'id, workspace_id, order_number, status, source, customer_name, customer_phone, customer_email, customer_note, customer_id, total, invoice_id, public_token, cancel_reason, created_at, expires_at, confirmed_at, invoiced_at, paid_at, fulfilled_at, cancelled_at'
const LINE_COLUMNS = 'product_id, product_name, unit, quantity, unit_price, line_total'

export type OrderWithLines = OrderRow & { items: OrderLine[] }

const CATALOG_COLUMNS = 'id, name, unit, sell_price, quantity, image_url'

export const ordersRepository = {
  async create(input: {
    workspaceId: string
    source: 'website' | 'api' | 'dashboard'
    apiKeyId: string | null
    idempotencyKey: string | null
    customer: { name: string; phone: string; email?: string | undefined; note?: string | undefined }
    items: Array<{ productId: string; quantity: number }>
    createdBy: string | null
  }): Promise<{ orderId: string; replay: boolean }> {
    const { data, error } = await supabase.rpc('create_sales_order', {
      p_workspace_id: input.workspaceId,
      p_source: input.source,
      p_api_key_id: input.apiKeyId,
      p_idempotency: input.idempotencyKey,
      p_customer: input.customer,
      p_items: input.items,
      p_created_by: input.createdBy,
    })
    check(error)
    const result = data as { order_id: string; replay: boolean }
    return { orderId: result.order_id, replay: result.replay }
  },

  async transition(
    workspaceId: string,
    orderId: string,
    to: OrderStatus,
    extra: { reason?: string | null; invoiceId?: string | null; customerId?: string | null } = {},
  ): Promise<void> {
    const { error } = await supabase.rpc('transition_sales_order', {
      p_workspace_id: workspaceId,
      p_order_id: orderId,
      p_to: to,
      p_reason: extra.reason ?? null,
      p_invoice_id: extra.invoiceId ?? null,
      p_customer_id: extra.customerId ?? null,
    })
    check(error)
  },

  async get(workspaceId: string, id: string): Promise<OrderWithLines | null> {
    const { data, error } = await supabase
      .from('sales_orders')
      .select(ORDER_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .maybeSingle()
    check(error)
    if (!data) return null
    return { ...(data as OrderRow), items: await this.lines(id) }
  },

  async getByToken(token: string): Promise<OrderWithLines | null> {
    const { data, error } = await supabase
      .from('sales_orders')
      .select(ORDER_COLUMNS)
      .eq('public_token', token)
      .maybeSingle()
    check(error)
    if (!data) return null
    const order = data as OrderRow
    return { ...order, items: await this.lines(order.id) }
  },

  async lines(orderId: string): Promise<OrderLine[]> {
    const { data, error } = await supabase
      .from('sales_order_items')
      .select(LINE_COLUMNS)
      .eq('order_id', orderId)
      .order('product_name', { ascending: true })
    check(error)
    return (data ?? []) as OrderLine[]
  },

  /** A page, and the EXACT count of the filter — the badge on «pending» is a decision. */
  async list(
    workspaceId: string,
    filter: { status?: OrderStatus | undefined; limit: number; offset: number },
  ): Promise<{ rows: OrderRow[]; total: number }> {
    let query = supabase
      .from('sales_orders')
      .select(ORDER_COLUMNS, { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(filter.offset, filter.offset + filter.limit - 1)
    if (filter.status) query = query.eq('status', filter.status)
    const { data, error, count } = await query
    check(error)
    return { rows: (data ?? []) as OrderRow[], total: count ?? 0 }
  },

  async expirePending(): Promise<number> {
    const { data, error } = await supabase.rpc('expire_pending_sales_orders')
    check(error)
    return Number(data ?? 0)
  },

  // ─── settings ──────────────────────────────────────────────────────────────

  async settings(workspaceId: string): Promise<StorefrontSettings> {
    const { data, error } = await supabase
      .from('storefront_settings')
      .select(
        'order_confirmation, stock_display, pending_expiry_hours, max_items_per_order, max_pending_per_contact',
      )
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    check(error)
    if (!data) return { ...STOREFRONT_DEFAULTS }
    const row = data as Record<string, unknown>
    return {
      orderConfirmation: row.order_confirmation as StorefrontSettings['orderConfirmation'],
      stockDisplay: row.stock_display as StorefrontSettings['stockDisplay'],
      pendingExpiryHours: Number(row.pending_expiry_hours),
      maxItemsPerOrder: Number(row.max_items_per_order),
      maxPendingPerContact: Number(row.max_pending_per_contact),
    }
  },

  async saveSettings(workspaceId: string, s: StorefrontSettings): Promise<void> {
    const { error } = await supabase.from('storefront_settings').upsert({
      workspace_id: workspaceId,
      order_confirmation: s.orderConfirmation,
      stock_display: s.stockDisplay,
      pending_expiry_hours: s.pendingExpiryHours,
      max_items_per_order: s.maxItemsPerOrder,
      max_pending_per_contact: s.maxPendingPerContact,
      updated_at: new Date().toISOString(),
    })
    check(error)
  },

  // ─── catalogue (public projection) ─────────────────────────────────────────

  async catalog(
    workspaceId: string,
    filter: { search?: string | undefined; limit: number; offset: number },
  ): Promise<{ rows: CatalogRow[]; hasMore: boolean }> {
    let query = supabase
      .from('products')
      .select(CATALOG_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .gt('sell_price', 0)
      .order('name', { ascending: true })
      .range(filter.offset, filter.offset + filter.limit)
    if (filter.search) query = query.ilike('name', `%${filter.search.replace(/[%_]/g, '')}%`)
    const { data, error } = await query
    check(error)
    const rows = (data ?? []) as CatalogRow[]
    return { rows: rows.slice(0, filter.limit), hasMore: rows.length > filter.limit }
  },

  async catalogProduct(workspaceId: string, id: string): Promise<CatalogRow | null> {
    const { data, error } = await supabase
      .from('products')
      .select(CATALOG_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .eq('is_active', true)
      .gt('sell_price', 0)
      .maybeSingle()
    check(error)
    return (data as CatalogRow | null) ?? null
  },

  /** Customers of this workspace whose phone is exactly this one. */
  async customersByPhone(workspaceId: string, phone: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('customers')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('phone', phone)
      .eq('is_active', true)
      .limit(2)
    check(error)
    return ((data ?? []) as Array<{ id: string }>).map((r) => r.id)
  },
}

export type OrdersRepository = typeof ordersRepository
