// ============================================
// backend/src/services/inventory/warehouse-map.service.ts
//
// «کالاها کجای انبار من هستند؟» — the reads behind the map of ONE warehouse,
// and the two writes that fill it in.
//
// ---------------------------------------------------------------------------
// WHAT THIS FILE DOES NOT DO
//
// It never writes a stock figure. Placing goods on a shelf does not change
// `products.quantity`, `warehouse_stock`, a cost layer or the ledger — moving
// goods BETWEEN warehouses is `warehouse_transfer_stock` and is untouched.
// The map is a READER of the inventory the rest of the system already keeps.
//
// ---------------------------------------------------------------------------
// EVERY READ IS COMPLETE
//
// Locations, placements, stock and sales go through `selectAllPages`: PostgREST
// caps a response at 1000 rows and says nothing about what it dropped, so a
// map built on `.limit()` would silently colour part of a warehouse.
//
// ---------------------------------------------------------------------------
// ⚠️ THE ONE STATE THAT IS NOT AN ERROR
//
// Before `docs/warehouse-map-01-migration.sql` has run, the two tables are not
// there. That is reported as `migrated: false` — the screen says «the map is
// not switched on yet and names the script». Every OTHER failure throws: a
// read that broke must never come back as an empty warehouse.
// ============================================

import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { PAGE_SIZE, selectAllPages } from '../../utils/fetch-all-pages'
import type {
  CreateStorageLocation,
  PlaceStorageLocation,
  UpdateStorageLocation,
} from '@hisabche/validation'
import { can } from '../authorization/authorization.domain'
import { baseCurrencyOf } from '../base-currency'
import { branches } from '../branch'
import type { TenancyContext } from '../tenancy.service'
import { assertMayUseWarehouse } from './warehouse-access'
import { DEAD_STOCK_DEFAULT_DAYS, DEMAND_WINDOW_DAYS } from './reorder.domain'
import {
  buildWarehouseMap,
  type RawLocation,
  type RawPlacement,
  type RawProduct,
  type RawWarehouseStock,
  type WarehouseMap,
} from './warehouse-map.domain'

/** The two tables this feature owns; absent means «not switched on yet». */
const MISSING_RELATION = new Set(['42P01', 'PGRST205'])
const MISSING_COLUMN = new Set(['42703', 'PGRST204'])

/** How long a window the map may be built over. */
export const MAP_MIN_DAYS = 7
export const MAP_MAX_DAYS = 730

const LOCATION_COLUMNS =
  'id, warehouse_id, parent_id, code, name, kind, position_x, position_y, width, height, capacity, is_active'

type LocationRow = {
  id: string
  warehouse_id: string
  parent_id: string | null
  code: string
  name: string | null
  kind: string
  position_x: number | string | null
  position_y: number | string | null
  width: number | string | null
  height: number | string | null
  capacity: number | string | null
  is_active: boolean | null
}

const num = (value: number | string | null | undefined): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** `null` stays `null`: a price nobody recorded is not a price of zero. */
const optionalNum = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export class WarehouseMapService {
  /**
   * The whole map of one warehouse in one payload.
   *
   * `days` is the staleness threshold — a QUERY PARAMETER, like the dead-stock
   * list, because a greengrocer and a machine-parts dealer do not mean the same
   * thing by «راکد».
   */
  async map(
    ctx: TenancyContext,
    warehouseId: string,
    days: number = DEAD_STOCK_DEFAULT_DAYS,
  ): Promise<WarehouseMap> {
    const window = Math.min(Math.max(Math.floor(days), MAP_MIN_DAYS), MAP_MAX_DAYS)
    const asOf = new Date()

    // ⚠️ The value of stock is what it COST, and that is the shop's margin:
    // `inventory.cost.read` is the capability that already exists for it (the
    // dashboard's own «ارزش موجودی» card hides behind the same one). Reading
    // the price and then deciding here keeps the rule in ONE place, and the
    // payload carries `null` — never 0 — for a reader who may not see it.
    const costVisible = can(ctx.role, 'inventory.cost.read')

    const [warehouse, currency, knownBranches] = await Promise.all([
      this.warehouseRow(ctx, warehouseId),
      baseCurrencyOf(ctx.workspaceId),
      branches.list(ctx),
    ])
    await assertMayUseWarehouse(ctx, warehouseId, 'WAREHOUSE_NOT_PERMITTED')

    const locations = await this.locations(ctx, warehouseId)
    if (locations === null) return this.notMigrated(warehouse, currency, costVisible, window, asOf)

    const [placements, stock, products] = await Promise.all([
      this.placements(
        ctx,
        locations.map((row) => row.id),
      ),
      this.stock(ctx, warehouseId),
      this.products(ctx),
    ])
    if (placements === null) return this.notMigrated(warehouse, currency, costVisible, window, asOf)

    const wanted = new Set<string>(stock.map((row) => row.productId))
    for (const row of placements) wanted.add(row.productId)
    const sales = await this.sales(ctx, warehouseId, wanted, window, asOf)

    return {
      ...buildWarehouseMap({
        warehouse: {
          id: warehouse.id,
          name: warehouse.name,
          branchId: warehouse.branchId,
          branchName: warehouse.branchId
            ? (knownBranches.find((branch) => branch.id === warehouse.branchId)?.name ?? null)
            : null,
        },
        currency,
        asOf,
        costVisible,
        days: window,
        locations,
        placements,
        products,
        warehouseStock: stock,
        sales,
      }),
      migrated: true,
    }
  }

  /**
   * A location on the plan of a warehouse.
   *
   * ⚠️ Configuration, not a stock movement: the route asks for
   * `inventory.configure` (the capability that already guards «what a product's
   * units mean») and NOT `product.write`.
   */
  async addLocation(
    ctx: TenancyContext,
    warehouseId: string,
    input: CreateStorageLocation,
  ): Promise<{ id: string; code: string }> {
    await this.warehouseRow(ctx, warehouseId)
    await assertMayUseWarehouse(ctx, warehouseId, 'WAREHOUSE_NOT_PERMITTED')

    const { data, error } = await supabase
      .from('storage_locations')
      .insert({
        workspace_id: ctx.workspaceId,
        warehouse_id: warehouseId,
        parent_id: input.parentId ?? null,
        code: input.code,
        name: input.name ?? null,
        kind: input.kind,
        position_x: input.x,
        position_y: input.y,
        width: input.width,
        height: input.height,
        capacity: input.capacity ?? null,
        // A new shelf is usable until somebody retires it. The column has this
        // default too; writing it makes the insert complete on its own — the
        // in-memory database the tests use has no defaults.
        is_active: true,
        created_by: ctx.userId,
      })
      .select('id, code')
      .maybeSingle()

    this.refuseLocationWrite(error)
    if (!data) throw new DatabaseError('The location was not written')
    return { id: String(data.id), code: String(data.code) }
  }

  /**
   * Renaming, moving or retiring a location — and NEVER deleting one: a
   * retired location keeps whatever history names it.
   */
  async updateLocation(
    ctx: TenancyContext,
    locationId: string,
    input: UpdateStorageLocation,
  ): Promise<{ id: string }> {
    const location = await this.locationRow(ctx, locationId)
    await assertMayUseWarehouse(ctx, location.warehouse_id, 'WAREHOUSE_NOT_PERMITTED')

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.code !== undefined) patch.code = input.code
    if (input.name !== undefined) patch.name = input.name
    if (input.kind !== undefined) patch.kind = input.kind
    if (input.x !== undefined) patch.position_x = input.x
    if (input.y !== undefined) patch.position_y = input.y
    if (input.width !== undefined) patch.width = input.width
    if (input.height !== undefined) patch.height = input.height
    if (input.capacity !== undefined) patch.capacity = input.capacity
    if (input.isActive !== undefined) patch.is_active = input.isActive

    const { data, error } = await supabase
      .from('storage_locations')
      .update(patch)
      .eq('id', locationId)
      .eq('workspace_id', ctx.workspaceId)
      .select('id')
      .maybeSingle()

    this.refuseLocationWrite(error)
    if (!data) throw new NotFoundError('Storage location')
    return { id: locationId }
  }

  /**
   * What a person recorded as sitting in a location.
   *
   * The cap — never more units than the WAREHOUSE holds, counted over all of
   * its locations — is applied inside `storage_place_stock`, under row locks,
   * because supabase-js has no transaction and two devices may save at once.
   */
  async placeStock(
    ctx: TenancyContext,
    locationId: string,
    input: PlaceStorageLocation,
  ): Promise<{ locationId: string; productId: string; quantity: number; available: number }> {
    const location = await this.locationRow(ctx, locationId)
    await assertMayUseWarehouse(ctx, location.warehouse_id, 'WAREHOUSE_NOT_PERMITTED')

    const { data, error } = await supabase.rpc('storage_place_stock', {
      p_workspace: ctx.workspaceId,
      p_actor: ctx.userId,
      p_location: locationId,
      p_product: input.productId,
      p_quantity: input.quantity,
    })

    if (error) {
      const code = /\b([A-Z][A-Z_]{6,})\b/.exec(error.message ?? '')?.[1]
      // «That shelf cannot hold more than the warehouse has» is an answer the
      // screen must read, not a server fault (the same shape as
      // WAREHOUSE_INSUFFICIENT_STOCK).
      if (code === 'STORAGE_PLACEMENT_EXCEEDS_STOCK') throw new ConflictError(code)
      if (code?.startsWith('STORAGE_')) throw new ValidationError(code)
      throw new DatabaseError('Failed to record what is in the location', error)
    }

    const result = (data ?? {}) as {
      quantity?: number | string
      available?: number | string
    }
    return {
      locationId,
      productId: input.productId,
      quantity: num(result.quantity ?? input.quantity),
      available: num(result.available),
    }
  }

  // ─── Reads ────────────────────────────────────────────────────────────────

  private notMigrated(
    warehouse: { id: string; name: string; branchId: string | null },
    currency: string,
    costVisible: boolean,
    days: number,
    asOf: Date,
  ): WarehouseMap {
    return {
      warehouse: { ...warehouse, branchName: null },
      currency,
      costVisible,
      days,
      demandWindowDays: DEMAND_WINDOW_DAYS,
      asOf: asOf.toISOString(),
      migrated: false,
      locations: [],
      totals: {
        locationCount: 0,
        activeLocationCount: 0,
        retiredLocationCount: 0,
        emptyLocationCount: 0,
        locationProductCount: 0,
        placedQuantity: 0,
        placedValue: null,
        stagnantLocationCount: 0,
        stagnantValue: null,
        stagnantQuantity: 0,
        productsWithoutCost: 0,
        capacityTotal: null,
        capacityRecordedCount: 0,
      },
      unplaced: { productCount: 0, quantity: 0, value: null },
      drift: { productCount: 0, quantity: 0, value: null },
    }
  }

  private async warehouseRow(
    ctx: TenancyContext,
    warehouseId: string,
  ): Promise<{ id: string; name: string; branchId: string | null }> {
    const withBranch = await supabase
      .from('warehouses')
      .select('id, name, branch_id')
      .eq('id', warehouseId)
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .maybeSingle()

    // A database that has not run `branch-migration.sql` has no `branch_id`
    // (the same tolerance `warehouse-access.ts` gives it).
    const { data, error } = MISSING_COLUMN.has(withBranch.error?.code ?? '')
      ? await supabase
          .from('warehouses')
          .select('id, name')
          .eq('id', warehouseId)
          .eq('workspace_id', ctx.workspaceId)
          .is('deleted_at', null)
          .maybeSingle()
      : withBranch

    if (error) throw new DatabaseError('Failed to read the warehouse', error)
    if (!data) throw new NotFoundError('Warehouse')

    const row = data as { id: string; name: string; branch_id?: string | null }
    return { id: String(row.id), name: String(row.name ?? ''), branchId: row.branch_id ?? null }
  }

  private async locationRow(ctx: TenancyContext, locationId: string): Promise<LocationRow> {
    const { data, error } = await supabase
      .from('storage_locations')
      .select(LOCATION_COLUMNS)
      .eq('id', locationId)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()

    if (error) {
      if (MISSING_RELATION.has(error.code ?? '')) {
        throw new ConflictError('WAREHOUSE_MAP_SCHEMA_REQUIRED')
      }
      throw new DatabaseError('Failed to read the storage location', error)
    }
    if (!data) throw new ValidationError('STORAGE_LOCATION_NOT_FOUND')
    return data as LocationRow
  }

  /** `null` = the table is not there yet, which is a named state and not empty. */
  private async locations(ctx: TenancyContext, warehouseId: string): Promise<RawLocation[] | null> {
    const { data, error } = await selectAllPages<LocationRow, { message: string; code?: string }>(
      (from, to) =>
        supabase
          .from('storage_locations')
          .select(LOCATION_COLUMNS)
          .eq('workspace_id', ctx.workspaceId)
          .eq('warehouse_id', warehouseId)
          .order('code', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
    )

    if (error) {
      if (MISSING_RELATION.has(error.code ?? '')) return null
      throw new DatabaseError('Failed to read the storage locations', error)
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      warehouseId: row.warehouse_id,
      parentId: row.parent_id,
      code: row.code,
      name: row.name,
      kind: row.kind,
      x: num(row.position_x),
      y: num(row.position_y),
      width: Math.max(num(row.width), 1),
      height: Math.max(num(row.height), 1),
      capacity: optionalNum(row.capacity),
      isActive: row.is_active !== false,
    }))
  }

  /**
   * What is recorded in the locations of THIS warehouse.
   *
   * ⚠️ Read per CHUNK of location ids, not with a PostgREST `!inner` embed and
   * not as «everything in the workspace, filtered afterwards». The embed makes
   * the result depend on how PostgREST inferred the relationship (an object or
   * an array), and filtering afterwards would read — and could silently keep —
   * another warehouse's shelf. 150 ids is about 5 KB of URL, well inside the
   * limit, and the unique index `(location_id, product_id)` answers it.
   */
  private async placements(
    ctx: TenancyContext,
    locationIds: readonly string[],
  ): Promise<RawPlacement[] | null> {
    const rows: RawPlacement[] = []

    for (let start = 0; start < locationIds.length; start += 150) {
      const chunk = locationIds.slice(start, start + 150)
      const { data, error } = await selectAllPages<
        { location_id: string; product_id: string; quantity: number | string | null },
        { message: string; code?: string }
      >((from, to) =>
        supabase
          .from('storage_location_placements')
          .select('location_id, product_id, quantity')
          .eq('workspace_id', ctx.workspaceId)
          .in('location_id', chunk)
          .order('location_id', { ascending: true })
          .order('product_id', { ascending: true })
          .range(from, to),
      )

      if (error) {
        if (MISSING_RELATION.has(error.code ?? '')) return null
        throw new DatabaseError('Failed to read what is recorded in the locations', error)
      }

      for (const row of data ?? []) {
        rows.push({
          locationId: row.location_id,
          productId: row.product_id,
          quantity: num(row.quantity),
        })
      }
    }

    return rows
  }

  private async stock(ctx: TenancyContext, warehouseId: string): Promise<RawWarehouseStock[]> {
    const { data, error } = await selectAllPages<
      { product_id: string; quantity: number | string | null },
      { message: string; code?: string }
    >((from, to) =>
      supabase
        .from('warehouse_stock')
        .select('product_id, quantity')
        .eq('workspace_id', ctx.workspaceId)
        .eq('warehouse_id', warehouseId)
        .order('product_id', { ascending: true })
        .range(from, to),
    )

    if (error) throw new DatabaseError('Failed to read the warehouse stock', error)

    return (data ?? []).map((row) => ({
      productId: row.product_id,
      quantity: num(row.quantity),
    }))
  }

  /**
   * The ACTIVE products of the workspace, with the purchase price the value
   * rule needs. The same set the warehouse screens count.
   */
  private async products(ctx: TenancyContext): Promise<RawProduct[]> {
    const { data, error } = await selectAllPages<
      {
        id: string
        name: string
        sku: string | null
        unit: string | null
        buy_price: number | string | null
      },
      { message: string; code?: string }
    >((from, to) =>
      supabase
        .from('products')
        .select('id, name, sku, unit, buy_price')
        .eq('workspace_id', ctx.workspaceId)
        .eq('is_active', true)
        .order('id', { ascending: true })
        .range(from, to),
    )

    if (error) throw new DatabaseError('Failed to read products', error)

    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      unit: row.unit,
      buyPrice: optionalNum(row.buy_price),
    }))
  }

  /**
   * Sales made FROM this warehouse: the units in the window, and the most
   * recent sale per product however long ago it was.
   *
   * ⚠️ `type = 'sale'` only, and `from_warehouse_id = this warehouse`. Adding
   * every movement would count a restock as demand; counting another
   * warehouse's sale would colour this floor by the other one's business.
   *
   * ⚠️ NEVER-SOLD MUST STAY DISTINGUISHABLE from «sold long ago», so the last
   * sale is read WITHOUT a date filter. The read is ordered newest-first and
   * stops as soon as every product wanted has been seen — the answer is then
   * complete, not truncated.
   */
  private async sales(
    ctx: TenancyContext,
    warehouseId: string,
    productIds: ReadonlySet<string>,
    days: number,
    asOf: Date,
  ): Promise<{ lastSoldAt: Map<string, string>; unitsInWindow: Map<string, number> }> {
    const lastSoldAt = new Map<string, string>()
    const unitsInWindow = new Map<string, number>()
    if (productIds.size === 0) return { lastSoldAt, unitsInWindow }

    const since = new Date(asOf.getTime() - days * 86_400_000).toISOString()

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('product_id, quantity, created_at')
        .eq('workspace_id', ctx.workspaceId)
        .eq('type', 'sale')
        .eq('from_warehouse_id', warehouseId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw new DatabaseError('Failed to read sales history', error)

      const batch = data ?? []
      for (const row of batch) {
        const id = String(row.product_id)
        if (!lastSoldAt.has(id)) lastSoldAt.set(id, String(row.created_at))
        if (String(row.created_at) >= since) {
          unitsInWindow.set(id, (unitsInWindow.get(id) ?? 0) + Math.abs(num(row.quantity)))
        }
      }

      if (batch.length < PAGE_SIZE) break
      // Every product that has stock here has been seen: nothing left to find.
      if (lastSoldAt.size >= productIds.size) break
    }

    return { lastSoldAt, unitsInWindow }
  }

  // ─── The one refusal both location writes share ────────────────────────────

  private refuseLocationWrite(error: { code?: string; message: string } | null): void {
    if (!error) return
    if (MISSING_RELATION.has(error.code ?? '')) {
      throw new ConflictError('WAREHOUSE_MAP_SCHEMA_REQUIRED')
    }
    // Two people label a shelf `A-01` at the same moment: the unique index
    // refuses the second, which is the caller's to read.
    if (error.code === '23505') throw new ConflictError('STORAGE_LOCATION_CODE_TAKEN')
    if (typeof error.code === 'string' && error.code.startsWith('23')) {
      throw new ValidationError('STORAGE_LOCATION_INVALID')
    }
    const code = /\b([A-Z][A-Z_]{6,})\b/.exec(error.message ?? '')?.[1]
    if (code?.startsWith('STORAGE_LOCATION_')) throw new ValidationError(code)
    throw new DatabaseError('Failed to write the storage location', error)
  }
}
