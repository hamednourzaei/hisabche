// ============================================
// backend/src/services/supplier/supplier.service.ts
//
// Suppliers, and the 360 view of one.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
//
// `suppliers` was a table nothing owned. Purchase orders joined it for a name
// and a phone number, invoices carried a `supplier_id`, and there was no
// service, no tenancy scoping, and no way to answer the question a shopkeeper
// actually asks: what have I bought from this person, what do I still owe
// them, and how late am I.
//
// The answer is assembled from cores that already know their own half of it —
// purchases from invoices, what is owed from the payments core, what the goods
// cost from the costing core. Nothing here recomputes any of that.
// ============================================

import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'
import { PaymentsService } from '../payments'
import { round2 } from '../payments'

const COLUMNS = 'id, name, phone, email, address, notes, is_active, created_at, updated_at'

export interface Supplier {
  id: string
  name: string
  phone: string
  email: string
  address: string | null
  notes: string
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
}

function mapSupplier(raw: Record<string, any>): Supplier {
  return {
    id: raw.id,
    name: raw.name ?? '',
    phone: raw.phone ?? '',
    email: raw.email ?? '',
    address: raw.address ?? null,
    notes: raw.notes ?? '',
    isActive: raw.is_active !== false,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
  }
}

export class SupplierService {
  private readonly payments: PaymentsService

  constructor(payments: PaymentsService = new PaymentsService()) {
    this.payments = payments
  }

  private key(workspaceId: string, ...parts: string[]) {
    return `supplier:${workspaceId}:${parts.join(':')}`
  }

  private async invalidate(workspaceId: string) {
    await memoryCache.invalidate(`supplier:${workspaceId}`)
  }

  async list(
    ctx: TenancyContext,
    filters: { search?: string | undefined; isActive?: boolean | undefined } = {},
  ) {
    let query = supabase
      .from('suppliers')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .order('name')
      .limit(500)

    if (filters.isActive !== undefined) query = query.eq('is_active', filters.isActive)
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`)
    }

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to fetch suppliers', error)
    return (data ?? []).map(mapSupplier)
  }

  async get(ctx: TenancyContext, id: string): Promise<Supplier> {
    const { data, error } = await supabase
      .from('suppliers')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch supplier', error)
    if (!data) throw new NotFoundError('Supplier')
    return mapSupplier(data)
  }

  async create(
    ctx: TenancyContext,
    input: {
      name: string
      phone?: string | undefined
      email?: string | undefined
      address?: string | undefined
      notes?: string | undefined
    },
  ) {
    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        name: input.name,
        phone: input.phone ?? '',
        email: input.email ?? '',
        address: input.address ?? null,
        notes: input.notes ?? '',
        is_active: true,
        workspace_id: ctx.workspaceId,
        user_id: ctx.userId,
      })
      .select(COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create supplier', error)

    await this.invalidate(ctx.workspaceId)
    return mapSupplier(data)
  }

  async update(
    ctx: TenancyContext,
    id: string,
    input: {
      name?: string | undefined
      phone?: string | undefined
      email?: string | undefined
      address?: string | null | undefined
      notes?: string | undefined
      isActive?: boolean | undefined
    },
  ) {
    const values: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.name !== undefined) values.name = input.name
    if (input.phone !== undefined) values.phone = input.phone
    if (input.email !== undefined) values.email = input.email
    if (input.address !== undefined) values.address = input.address
    if (input.notes !== undefined) values.notes = input.notes
    if (input.isActive !== undefined) values.is_active = input.isActive

    const { data, error } = await supabase
      .from('suppliers')
      .update(values)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .select(COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update supplier', error)

    await this.invalidate(ctx.workspaceId)
    return mapSupplier(data)
  }

  /**
   * A supplier is deactivated, never deleted, once anything has been bought
   * from them: the purchase history references them, and a dangling supplier
   * id on a purchase invoice is a hole in the audit trail.
   */
  async deactivate(ctx: TenancyContext, id: string) {
    return this.update(ctx, id, { isActive: false })
  }

  /**
   * Everything about one supplier, in one call.
   *
   * Each piece comes from the core that owns it. This method is an assembler,
   * not a second implementation: recomputing "what do I owe them" here would
   * give a figure that disagrees with the payments core the first time either
   * one changed.
   */
  async get360(ctx: TenancyContext, id: string) {
    const supplier = await this.get(ctx, id)

    const cacheKey = this.key(ctx.workspaceId, '360', id)
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const [purchases, openInvoices, ledger, orders] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, invoice_number, date, total, paid_amount, status, currency')
        .eq('workspace_id', ctx.workspaceId)
        .eq('supplier_id', id)
        .eq('type', 'purchase')
        .order('date', { ascending: false })
        .limit(100),
      this.payments.getOpenInvoices(ctx, 'supplier', id),
      this.payments.getPartyLedger(ctx, 'supplier', id),
      supabase
        .from('purchase_orders')
        .select('id, order_date, status, expected_delivery_date')
        .eq('workspace_id', ctx.workspaceId)
        .eq('supplier_id', id)
        .order('order_date', { ascending: false })
        .limit(50),
    ])

    if (purchases.error) throw new DatabaseError('Failed to fetch purchases', purchases.error)
    if (orders.error) throw new DatabaseError('Failed to fetch purchase orders', orders.error)

    const rows = purchases.data ?? []

    const result = {
      supplier,
      purchases: rows,
      purchaseOrders: orders.data ?? [],
      totals: {
        purchaseCount: rows.length,
        purchasedValue: round2(rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0)),
        // What is STILL owed, from the allocations — not from `paid_amount`,
        // which any invoice PATCH can overwrite.
        outstanding: round2(openInvoices.reduce((sum, invoice) => sum + invoice.outstanding, 0)),
        openInvoiceCount: openInvoices.length,
      },
      openInvoices,
      /** Positive means WE owe them. */
      balance: -ledger.balance,
      movements: ledger.movements,
    }

    await memoryCache.set(cacheKey, result, 60)
    return result
  }
}
