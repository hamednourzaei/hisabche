// ============================================
// backend/src/services/warehouse.service.ts
//
// Warehouses, per-warehouse stock, and transfers between them.
//
// ---------------------------------------------------------------------------
// WHAT WAS WRONG WITH THE VERSION THIS REPLACES
//
// Every query filtered on `user_id`. A warehouse is shared business data — the
// same shop's manager and seller must see the same warehouses — so a second
// member saw an empty warehouse list and their transfers were invisible to
// everyone else.
//
// Two cache keys carried no tenancy at all: `warehouse:product:<productId>`
// and `warehouse:stock:<warehouseId>`. Whoever asked first filled the cache
// and everybody else was served that answer, across workspaces.
//
// `listWarehouses` filtered `.eq('deleted_at', null)`, which PostgREST sends
// as `deleted_at=eq.null` and which matches NOTHING. The list was empty for
// every user, always. The correct operator is `.is('deleted_at', null)`.
//
// `transferStock` read both sides' quantities, then wrote them back from Node.
// Two transfers of the same stock both read the same starting quantity and the
// second overwrote the first — stock created out of nothing. It also wrote no
// workspace onto the movement row.
// ============================================

import { supabase } from '../db'
import { ConflictError, DatabaseError, NotFoundError } from '../errors/database.error'
import { ValidationError } from '../errors/validation.error'
import { memoryCache } from '../utils/pagination'
import type { TenancyContext } from './tenancy.service'

type CreateWarehouse = any
type UpdateWarehouse = any

const WAREHOUSE_COLUMNS = 'id, name, location, is_active, created_at, updated_at'

export class WarehouseService {
  // ─── Cache ────────────────────────────────────────────────────
  // Every key is prefixed with the workspace, and invalidation drops the whole
  // prefix. A key without the workspace in it is a cross-tenant read waiting
  // for the right pair of requests.

  private key(workspaceId: string, ...parts: (string | number)[]) {
    return `warehouse:${workspaceId}:${parts.join(':')}`
  }

  private async invalidate(workspaceId: string) {
    await memoryCache.invalidate(`warehouse:${workspaceId}`)
  }

  // ─── Warehouses ───────────────────────────────────────────────

  async listWarehouses(ctx: TenancyContext) {
    const cacheKey = this.key(ctx.workspaceId, 'list')

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('warehouses')
      .select(WAREHOUSE_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) throw new DatabaseError('Failed to fetch warehouses', error)

    const result = data ?? []
    await memoryCache.set(cacheKey, result, 120)
    return result
  }

  async createWarehouse(ctx: TenancyContext, data: CreateWarehouse) {
    const { data: warehouse, error } = await supabase
      .from('warehouses')
      .insert({
        name: data.name,
        location: data.location || '',
        is_active: data.isActive !== false,
        workspace_id: ctx.workspaceId,
        user_id: ctx.userId,
      })
      .select(WAREHOUSE_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create warehouse', error)

    await this.invalidate(ctx.workspaceId)
    return warehouse
  }

  async updateWarehouse(ctx: TenancyContext, id: string, data: UpdateWarehouse) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) updates.name = data.name
    if (data.location !== undefined) updates.location = data.location
    if (data.isActive !== undefined) updates.is_active = data.isActive

    const { data: warehouse, error } = await supabase
      .from('warehouses')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      .select(WAREHOUSE_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update warehouse', error)

    await this.invalidate(ctx.workspaceId)
    return warehouse
  }

  async deleteWarehouse(ctx: TenancyContext, id: string): Promise<void> {
    const { error } = await supabase
      .from('warehouses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)

    if (error) throw new DatabaseError('Failed to delete warehouse', error)

    await this.invalidate(ctx.workspaceId)
  }

  async getWarehouse(ctx: TenancyContext, id: string) {
    const cacheKey = this.key(ctx.workspaceId, 'one', id)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('warehouses')
      .select(WAREHOUSE_COLUMNS)
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch warehouse', error)
    if (!data) throw new NotFoundError('Warehouse')

    await memoryCache.set(cacheKey, data, 300)
    return data
  }

  /**
   * Both warehouses must be in THIS workspace before anything moves.
   *
   * Without it, a transfer naming another shop's warehouse id would read and
   * write that shop's stock: the update below is keyed by warehouse and
   * product, and neither of those ids is proof of anything on its own.
   */
  private async assertWarehousesInWorkspace(ctx: TenancyContext, ids: string[]): Promise<void> {
    const unique = [...new Set(ids.filter(Boolean))]
    if (unique.length === 0) return

    const { data, error } = await supabase
      .from('warehouses')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .in('id', unique)

    if (error) throw new DatabaseError('Failed to verify warehouses', error)
    if ((data ?? []).length !== unique.length) throw new NotFoundError('Warehouse')
  }

  // ─── Transfers ────────────────────────────────────────────────

  /**
   * Move stock between two warehouses of the same business.
   *
   * The arithmetic happens inside `warehouse_transfer_stock`, in one
   * transaction, with the source row locked. Doing it here — read both sides,
   * subtract, write back — lets two transfers of the last unit both read it as
   * available, and the second write silently recreates stock the first spent.
   *
   * A transfer does NOT touch cost layers: the goods have not been consumed,
   * they have only changed shelf. Their cost travels with them.
   */
  async transferStock(ctx: TenancyContext, data: any) {
    const quantity = Number(data.quantity) || 0
    if (quantity <= 0) throw new ValidationError('WAREHOUSE_TRANSFER_QUANTITY_INVALID')
    if (data.fromWarehouseId === data.toWarehouseId) {
      throw new ValidationError('WAREHOUSE_TRANSFER_SAME_WAREHOUSE')
    }

    await this.assertWarehousesInWorkspace(ctx, [data.fromWarehouseId, data.toWarehouseId])

    const { data: result, error } = await supabase.rpc('warehouse_transfer_stock', {
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_payload: {
        product_id: data.productId,
        from_warehouse_id: data.fromWarehouseId,
        to_warehouse_id: data.toWarehouseId,
        quantity,
        notes: data.notes || '',
      },
    })

    if (error) {
      const code = /\b([A-Z][A-Z_]{6,})\b/.exec(error.message ?? '')?.[1]
      if (code === 'WAREHOUSE_INSUFFICIENT_STOCK') throw new ConflictError(code)
      if (code?.startsWith('WAREHOUSE_')) throw new ValidationError(code)
      throw new DatabaseError('Failed to transfer stock', error)
    }

    await this.invalidate(ctx.workspaceId)

    return { success: true, transferred: quantity, ...(result as object) }
  }

  // ─── Stock reads ──────────────────────────────────────────────

  async getStockByWarehouse(ctx: TenancyContext, warehouseId: string) {
    await this.assertWarehousesInWorkspace(ctx, [warehouseId])

    const cacheKey = this.key(ctx.workspaceId, 'stock', warehouseId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('warehouse_stock')
      .select(
        `
        quantity,
        product:products(id, name, sku, sell_price, quantity, unit)
      `,
      )
      .eq('warehouse_id', warehouseId)
      .eq('workspace_id', ctx.workspaceId)

    if (error) throw new DatabaseError('Failed to fetch stock', error)

    const result = data ?? []
    await memoryCache.set(cacheKey, result, 60)
    return result
  }

  async getProductStock(ctx: TenancyContext, productId: string) {
    const cacheKey = this.key(ctx.workspaceId, 'product', productId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('warehouse_stock')
      .select(
        `
        quantity,
        warehouse:warehouses(id, name, location)
      `,
      )
      .eq('product_id', productId)
      .eq('workspace_id', ctx.workspaceId)

    if (error) throw new DatabaseError('Failed to fetch product stock', error)

    const result = data ?? []
    await memoryCache.set(cacheKey, result, 120)
    return result
  }

  async getLowStockItems(ctx: TenancyContext, threshold: number = 10) {
    const cacheKey = this.key(ctx.workspaceId, 'low-stock', threshold)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('warehouse_stock')
      .select(
        `
        quantity,
        product:products(id, name, sku, min_stock_level),
        warehouse:warehouses(id, name)
      `,
      )
      .eq('workspace_id', ctx.workspaceId)
      .lt('quantity', threshold)
      .order('quantity', { ascending: true })

    if (error) throw new DatabaseError('Failed to fetch low stock items', error)

    const result = data ?? []
    await memoryCache.set(cacheKey, result, 300)
    return result
  }

  /**
   * The movement history for the workspace.
   *
   * Read by `user_id` before, so a shopkeeper could not see the movements
   * their own staff had made — in a warehouse both of them share.
   */
  async getStockMovements(ctx: TenancyContext, productId?: string, limit: number = 50) {
    const cacheKey = this.key(ctx.workspaceId, 'movements', productId ?? 'all', limit)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    let query = supabase
      .from('stock_movements')
      .select(
        `
        id, type, quantity, notes, unit_cost, total_cost, created_at,
        from_warehouse:warehouses!from_warehouse_id(id, name),
        to_warehouse:warehouses!to_warehouse_id(id, name),
        product:products(id, name, sku)
      `,
      )
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100))

    if (productId) query = query.eq('product_id', productId)

    const { data, error } = await query

    if (error) throw new DatabaseError('Failed to fetch stock movements', error)

    const result = data ?? []
    await memoryCache.set(cacheKey, result, 60)
    return result
  }
}
