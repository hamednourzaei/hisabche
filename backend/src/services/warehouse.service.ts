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

import { sourceIdOf } from '../utils/deterministic-id'
import { IdempotencyUnavailableError, isMissingIdempotencySupport } from '../utils/client-request'
import { supabase } from '../db'
import { ConflictError, DatabaseError, NotFoundError } from '../errors/database.error'
import { ValidationError } from '../errors/validation.error'
import { memoryCache } from '../utils/pagination'
import type { TenancyContext } from './tenancy.service'
import {
  checkAssign,
  productWarehouseBreakdown,
  unassignedQuantities,
  warehouseOverview,
  warehouseProducts,
  type ProductStockRow,
  type WarehouseRow,
  type WarehouseStockRow,
} from './inventory/warehouse-summary.domain'

const PAGE = 1000

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
        // Explicit: the table once defaulted deleted_at to now(), which made
        // every new warehouse invisible (docs/multi-warehouse-migration.sql).
        deleted_at: null,
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
  async transferStock(
    ctx: TenancyContext,
    data: any,
    options: { idempotencyKey?: string | null | undefined } = {},
  ) {
    const quantity = Number(data.quantity) || 0
    if (quantity <= 0) throw new ValidationError('WAREHOUSE_TRANSFER_QUANTITY_INVALID')
    if (data.fromWarehouseId === data.toWarehouseId) {
      throw new ValidationError('WAREHOUSE_TRANSFER_SAME_WAREHOUSE')
    }

    await this.assertWarehousesInWorkspace(ctx, [data.fromWarehouseId, data.toWarehouseId])

    const payload = {
      product_id: data.productId,
      from_warehouse_id: data.fromWarehouseId,
      to_warehouse_id: data.toWarehouseId,
      quantity,
      notes: data.notes || '',
    }

    // ⚠️ KEYED (27 Sep 2026): with an Idempotency-Key the movement's id is
    // derived from it, so a retried request after a lost response names the
    // same movement and the goods move ONCE
    // (docs/stock-transfer-idempotency-migration.sql).
    const key = options.idempotencyKey ?? null
    const { data: result, error } = key
      ? await supabase.rpc('warehouse_transfer_stock_keyed', {
          p_workspace_id: ctx.workspaceId,
          p_user_id: ctx.userId,
          p_payload: payload,
          p_movement_id: sourceIdOf(ctx.workspaceId, 'stock_transfer', key),
        })
      : await supabase.rpc('warehouse_transfer_stock', {
          p_workspace_id: ctx.workspaceId,
          p_user_id: ctx.userId,
          p_payload: payload,
        })

    // A keyed request on a database without the keyed function is refused —
    // never quietly sent unkeyed, which is exactly the double move it asked
    // to be protected from.
    if (key && isMissingIdempotencySupport(error)) {
      throw new IdempotencyUnavailableError('stock_transfer')
    }

    if (error) {
      const code = /\b([A-Z][A-Z_]{6,})\b/.exec(error.message ?? '')?.[1]
      if (code === 'WAREHOUSE_INSUFFICIENT_STOCK') throw new ConflictError(code)
      if (code?.startsWith('WAREHOUSE_')) throw new ValidationError(code)
      throw new DatabaseError('Failed to transfer stock', error)
    }

    await this.invalidate(ctx.workspaceId)

    return { success: true, transferred: quantity, ...(result as object) }
  }

  // ─── Multi-warehouse (request #90) ───────────────────────────
  //
  // Not cached: these figures change with every sale, and the money caches do
  // not know the memory keys of this service.

  /**
   * The products the warehouse screens count: ACTIVE ones only.
   *
   * ⚠️ A product with sales or stock history cannot be deleted (it would
   * orphan that history), so the refusal offers «deactivate instead». Reading
   * inactive products here too meant a deactivated product stayed on every
   * warehouse list and in «بدون انبار» — the advice had no effect and the
   * person could not get rid of it (reported 28 Sep 2026). A deactivated
   * product still has its own page and its history; it is no longer stock the
   * business works with.
   */
  private async readAllProducts(workspaceId: string): Promise<ProductStockRow[]> {
    const rows: ProductStockRow[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, unit, quantity, sell_price, buy_price, min_stock_level')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw new DatabaseError('Failed to read products', error)
      rows.push(...((data ?? []) as ProductStockRow[]))
      if (!data || data.length < PAGE) return rows
    }
  }

  private async readAllStock(workspaceId: string): Promise<WarehouseStockRow[]> {
    const rows: WarehouseStockRow[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('warehouse_stock')
        .select('warehouse_id, product_id, quantity')
        .eq('workspace_id', workspaceId)
        .order('warehouse_id', { ascending: true })
        .order('product_id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw new DatabaseError('Failed to read warehouse stock', error)
      rows.push(...((data ?? []) as WarehouseStockRow[]))
      if (!data || data.length < PAGE) return rows
    }
  }

  private async liveWarehouses(workspaceId: string): Promise<WarehouseRow[]> {
    const { data, error } = await supabase
      .from('warehouses')
      .select('id, name, location, is_active')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    if (error) throw new DatabaseError('Failed to fetch warehouses', error)
    return (data ?? []) as WarehouseRow[]
  }

  /** Every warehouse with its own stat cards, plus stock that is in no warehouse. */
  async overview(ctx: TenancyContext) {
    const [warehouses, products, stock] = await Promise.all([
      this.liveWarehouses(ctx.workspaceId),
      this.readAllProducts(ctx.workspaceId),
      this.readAllStock(ctx.workspaceId),
    ])
    const live = new Set(warehouses.map((warehouse) => warehouse.id))
    // Stock left in a deleted warehouse is still somewhere: it counts as unassigned.
    return warehouseOverview(
      warehouses,
      products,
      stock.filter((row) => live.has(row.warehouse_id)),
    )
  }

  /** One warehouse's products; `warehouseId = 'unassigned'` for stock in no warehouse. */
  async warehouseDetail(ctx: TenancyContext, warehouseId: string) {
    const unassigned = warehouseId === 'unassigned'
    const [warehouses, products, stock] = await Promise.all([
      this.liveWarehouses(ctx.workspaceId),
      this.readAllProducts(ctx.workspaceId),
      this.readAllStock(ctx.workspaceId),
    ])
    const warehouse = unassigned ? null : warehouses.find((row) => row.id === warehouseId)
    if (!unassigned && !warehouse) throw new NotFoundError('Warehouse')
    const live = new Set(warehouses.map((row) => row.id))
    const result = warehouseProducts(
      unassigned ? null : warehouseId,
      products,
      stock.filter((row) => live.has(row.warehouse_id)),
    )
    return {
      warehouse: warehouse
        ? { id: warehouse.id, name: warehouse.name, location: warehouse.location ?? '' }
        : null,
      ...result,
    }
  }

  /**
   * Put stock that is in no warehouse into this one. Two movements in ONE
   * insert statement (atomic in Postgres): +q into the warehouse and −q with no
   * warehouse. The product total is unchanged; only where the stock is changes.
   */
  async assignStock(
    ctx: TenancyContext,
    warehouseId: string,
    input: { productId: string; quantity: number; notes?: string | undefined },
  ) {
    await this.assertWarehousesInWorkspace(ctx, [warehouseId])
    const [warehouses, products, stock] = await Promise.all([
      this.liveWarehouses(ctx.workspaceId),
      this.readAllProducts(ctx.workspaceId),
      this.readAllStock(ctx.workspaceId),
    ])
    if (!warehouses.some((row) => row.id === warehouseId)) throw new NotFoundError('Warehouse')
    const product = products.find((row) => row.id === input.productId)
    if (!product) throw new NotFoundError('Product')

    const live = new Set(warehouses.map((row) => row.id))
    const free =
      unassignedQuantities(
        products,
        stock.filter((row) => live.has(row.warehouse_id)),
      ).get(product.id) ?? 0
    const refusal = checkAssign(input.quantity, free)
    if (refusal) throw new ValidationError(refusal)

    const base = {
      product_id: product.id,
      type: 'adjustment',
      reference_type: 'warehouse_assign',
      reference_id: warehouseId,
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      notes: input.notes || 'assigned to warehouse',
    }
    const { error } = await supabase.from('stock_movements').insert([
      { ...base, quantity: input.quantity, to_warehouse_id: warehouseId },
      { ...base, quantity: -input.quantity },
    ])
    if (error) throw new DatabaseError('Failed to assign stock to the warehouse', error)

    await this.invalidate(ctx.workspaceId)
    return { assigned: input.quantity }
  }

  /**
   * Where one product's stock is: each live warehouse, and what is in none.
   * The product page shows it beside the total so the two figures explain
   * each other (BUG-080).
   */
  async productBreakdown(ctx: TenancyContext, productId: string) {
    const [warehouses, product, stock] = await Promise.all([
      this.liveWarehouses(ctx.workspaceId),
      supabase
        .from('products')
        .select('quantity')
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', productId)
        .maybeSingle(),
      supabase
        .from('warehouse_stock')
        .select('warehouse_id, product_id, quantity')
        .eq('workspace_id', ctx.workspaceId)
        .eq('product_id', productId),
    ])
    if (product.error) throw new DatabaseError('Failed to read the product', product.error)
    if (!product.data) throw new NotFoundError('Product')
    if (stock.error) throw new DatabaseError('Failed to read the product stock', stock.error)
    return productWarehouseBreakdown(
      Number((product.data as { quantity: unknown }).quantity) || 0,
      warehouses,
      (stock.data ?? []) as WarehouseStockRow[],
    )
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
