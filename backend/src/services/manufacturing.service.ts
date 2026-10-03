// ============================================
// backend/src/services/manufacturing.service.ts
//
// The manufacturing domain: a product's definition (BOM / recipe), a production
// run, its history and its report — for any product of any trade.
//
// ONE CORE. The manufacturing page, a product's own page, the report and the
// dashboard card all read and write through this file; the cost is computed by
// `computeProductionCost` (@hisabche/validation) and nowhere else, and the two
// multi-table writes are database functions (docs/manufacturing-01-migration.sql)
// because supabase-js has no transaction.
//
// It owns no inventory and no ledger: stock moves through the costing core's
// own functions, called from inside `manufacturing_complete`.
//
// ---------------------------------------------------------------------------
// HISTORY (why the older comments below talk about `completeWorkOrder`)
//
// Completion used to be several separate calls from here — issue, receive,
// update, insert movements — so a failure half way left components consumed
// and nothing produced, and the movements named no warehouse. That method is
// gone; `produce` replaces it.
//
// ---------------------------------------------------------------------------
// WHAT CHANGED
//
// Every query keyed on `user_id`, so a bill of materials one member wrote was
// invisible to the person running the work order against it.
//
// `completeWorkOrder` had a cross-tenant write: it read and updated
// `products` filtered by `id` ALONE, with no workspace. A work order naming
// another shop's product id increased THEIR stock.
//
// And it produced goods out of nothing. The finished quantity was added to
// stock with no cost behind it and the raw materials were never consumed, so
// making ten units created ten units of inventory value from thin air while
// leaving the components sitting in stock as though nothing had been used.
//
// Completion now goes through the costing core: the components are ISSUED at
// what they actually cost, and the finished goods are RECEIVED at that cost
// divided across them. Inventory value is conserved, which is the whole point
// of manufacturing accounting.
// ============================================

import {
  asProductionColumns,
  computeProductionCost,
  type InvoiceGridRow,
  type ProduceInput,
  type ProductionCostLine,
  type ProductionLabor,
  type SaveProductionDefinition,
} from '@hisabche/validation'
import { supabase } from '../db'
import { domainErrorCode } from './inventory-costing/costing.repository'
import { stockEditWarehouse, type WarehouseRow } from './inventory/warehouse-summary.domain'
import { BaseError } from '../errors/base.error'
import { ConflictError, DatabaseError, NotFoundError } from '../errors/database.error'
import { ValidationError } from '../errors/validation.error'
import { invalidateMoneyCaches } from '../utils/money-cache'
import { memoryCache } from '../utils/pagination'
import type { TenancyContext } from './tenancy.service'
import { logBusinessEvent } from './event-log.service'

// ⚠️ NO `notes`. `boms.notes` is in the validation contract but no migration in
// docs/ ever created the column (base schema: id, product_id, version,
// is_active, user_id, created_at, updated_at; later: workspace_id). Selecting
// it answered 42703 — not a PGRST200, so the embed fallback did not catch it —
// and GET /api/boms returned 500 for every workspace. The column is added by
// docs/phase-t4b-bom-notes-migration.sql (PENDING HUMAN CONFIRMATION).
const BOM_COLUMNS =
  'id, product_id, version, is_active, created_at, updated_at, currency, unit_cost, components_cost, labor_cost, other_cost'
const BOM_ITEM_COLUMNS =
  'id, bom_id, raw_material_id, quantity, unit_cost, kind, label, unit, line_total, position, cells'
const WORK_ORDER_COLUMNS =
  'id, product_id, quantity, bom_id, status, start_date, end_date, created_at, updated_at'
const WORK_ORDER_MINIMAL =
  'id, product_id, quantity, status, start_date, bom_id, bom_version, currency, unit_cost, total_cost, calculated_total, override_total, add_to_inventory, warehouse_id, produced_on, completed_at'

// ---------------------------------------------------------------------------
// T4 — WHY /manufacturing RETURNED 500
//
// `GET /api/boms` and `GET /api/work-orders` both failed in production with a
// 500. The cause is in the schema, not in these queries:
//
//     CREATE TABLE work_orders ( ... product_id uuid, ... )   -- no REFERENCES
//     CREATE TABLE boms        ( ... product_id uuid, ... )   -- no REFERENCES
//
// The column holds a product id but carries no FOREIGN KEY. PostgREST builds
// its embeds (`product:products(...)`) from the FK graph, so with no
// constraint it cannot resolve the relationship and answers PGRST200. The
// service wrapped that in DatabaseError and Fastify returned 500 — so the
// whole page died on a missing constraint.
//
// TWO THINGS FIX IT, AND BOTH ARE HERE:
//
//   1. `docs/phase-t4-manufacturing-fk-migration.sql` adds the real FKs. That
//      is the actual repair and it needs a human to run it — and it reports
//      orphan rows rather than silently deleting them (guardrail 13).
//
//   2. This fallback, so the page works on databases where the migration has
//      not been applied. It re-queries flat and joins in memory.
//
// THE FALLBACK MUST FILTER `products` BY WORKSPACE ITSELF.
//
// The embed inherited the parent's workspace filter. A hand-written join does
// not: fetching products by `id IN (...)` alone would happily return another
// tenant's product name for an id that leaked into a row. `workspace_id` is
// the only security boundary and it is re-applied explicitly below.
// ---------------------------------------------------------------------------

/** PostgREST cannot resolve an embed — almost always a missing FK. */
const EMBED_UNRESOLVED = new Set(['PGRST200', 'PGRST201'])

interface NamedProduct {
  id: string
  name: string
  unit?: string | null
}

/**
 * Products by id, WITHIN one workspace. Ids from another tenant simply do not
 * come back, so an unresolvable id renders as null rather than as a name that
 * belongs to somebody else.
 */
async function productsByIdInWorkspace(
  workspaceId: string,
  ids: readonly string[],
): Promise<Map<string, NamedProduct>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return new Map()

  const { data, error } = await supabase
    .from('products')
    .select('id, name, unit')
    .eq('workspace_id', workspaceId)
    .in('id', unique)

  if (error) throw new DatabaseError('Failed to fetch products for manufacturing', error)
  return new Map((data ?? []).map((prod: NamedProduct) => [prod.id, prod]))
}

/** PostgREST/Postgres codes for «docs/manufacturing-01-migration.sql has not been run». */
const MISSING_SCHEMA = new Set(['42703', '42P01', '42883', 'PGRST202', 'PGRST204', 'PGRST205'])

/** Refusals that are about the state of a record, not the shape of the request. */
const CONFLICT_CODES = new Set([
  'WORK_ORDER_ALREADY_COMPLETED',
  'WORK_ORDER_CANCELLED',
  'INVENTORY_INSUFFICIENT_STOCK',
])

/**
 * The manufacturing schema is not in this database yet. Said as itself — 503
 * with a code the screen can explain — rather than as a 500 or, worse, as an
 * empty list that reads «you have made nothing».
 */
export class ManufacturingNotConfiguredError extends BaseError {
  constructor() {
    super('MANUFACTURING_MIGRATION_PENDING', 503)
    this.name = 'ManufacturingNotConfiguredError'
  }
}

const RUN_COLUMNS =
  'id, product_id, quantity, status, bom_id, bom_version, currency, components_cost, labor_cost, other_cost, unit_cost, calculated_total, override_total, override_reason, total_cost, actual_material_cost, labor_workers, labor_minutes, add_to_inventory, consume_components, warehouse_id, notes, produced_on, completed_at, completed_by'

interface BomItemRow {
  id: string
  raw_material_id: string | null
  quantity: number | string
  unit_cost: number | string | null
  kind: string | null
  label: string | null
  unit: string | null
  line_total: number | string | null
  cells: Record<string, string> | null
}

interface RunRow {
  id: string
  product_id: string
  quantity: number | string
  status: string
  bom_id: string | null
  bom_version: number | null
  currency: string | null
  components_cost: number | string | null
  labor_cost: number | string | null
  other_cost: number | string | null
  unit_cost: number | string | null
  calculated_total: number | string | null
  override_total: number | string | null
  override_reason: string | null
  total_cost: number | string | null
  actual_material_cost: number | string | null
  labor_workers: number | string | null
  labor_minutes: number | string | null
  add_to_inventory: boolean | null
  consume_components: boolean | null
  warehouse_id: string | null
  notes: string | null
  produced_on: string | null
  completed_at: string | null
  completed_by: string | null
}

interface RunLineRow {
  id: string
  kind: 'component' | 'labor' | 'cost'
  product_id: string | null
  label: string | null
  unit: string | null
  quantity_per_unit: number | string
  quantity: number | string
  unit_cost: number | string
  total: number | string
  actual_cost: number | string | null
  is_estimated: boolean | null
  cells: Record<string, string> | null
}

export interface ProductionDefinition {
  bomId: string
  productId: string
  version: number
  currency: string | null
  columns: unknown[]
  rows: Array<{ id: string; productId?: string; values: Record<string, string> }>
  otherCosts: Array<{ label: string; amount: number }>
  labor: {
    workers: number | null
    minutes: number | null
    hourlyRate: number | null
    cost: number | null
  }
  notes: string
  /** Per ONE unit, as the server derived it when the definition was saved. */
  cost: { componentsCost: number; laborCost: number; otherCost: number; unitCost: number }
  /** productId → today's buy price, for the stocked components. */
  currentCosts: Record<string, number>
  updatedAt: string | null
}

export interface ProductionRun {
  id: string
  productId: string
  productName: string | null
  quantity: number
  currency: string | null
  bomId: string | null
  bomVersion: number | null
  /** Per ONE unit. */
  componentsCost: number
  laborCost: number
  otherCost: number
  unitCost: number
  /** The run. */
  calculatedTotal: number
  overrideTotal: number | null
  overrideReason: string | null
  totalCost: number
  actualMaterialCost: number | null
  laborWorkers: number | null
  laborMinutes: number | null
  addToInventory: boolean
  consumeComponents: boolean
  warehouseId: string | null
  warehouseName: string | null
  notes: string | null
  producedOn: string | null
  completedAt: string | null
  completedBy: string | null
}

export interface ProductionRunLine {
  id: string
  kind: 'component' | 'labor' | 'cost'
  productId: string | null
  label: string
  unit: string | null
  quantityPerUnit: number
  quantity: number
  unitCost: number
  total: number
  actualCost: number | null
  isEstimated: boolean
  cells: Record<string, string>
}

export interface ProductionReport {
  from: string
  to: string
  totals: {
    runs: number
    quantity: number
    totalCost: number
    componentsCost: number
    laborCost: number
    otherCost: number
    laborMinutes: number
  }
  products: Array<{
    productId: string
    name: string
    runs: number
    quantity: number
    totalCost: number
    firstUnitCost: number
    lastUnitCost: number
  }>
  materials: Array<{
    key: string
    productId: string | null
    name: string
    unit: string | null
    quantity: number
    value: number
    runs: number
    products: number
    previousCost: number
    currentCost: number
    change: number
    changePercent: number | null
  }>
}

/** null stays null: «not recorded» is not zero. */
function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function laborPayload(labor: ProductionLabor | undefined) {
  return {
    workers: labor?.workers ?? null,
    minutes: labor?.minutes ?? null,
    hourly_rate: labor?.hourlyRate ?? null,
    cost_input: labor?.cost ?? null,
  }
}

function linePayload(line: ProductionCostLine) {
  return {
    kind: line.kind,
    product_id: line.productId,
    label: line.label,
    quantity: line.quantity,
    unit: line.unit,
    unit_cost: line.unitCost,
    line_total: line.lineTotal,
    position: line.position,
    cells: line.cells,
  }
}

function mapRun(
  row: RunRow,
  products: Map<string, NamedProduct>,
  warehouses: Map<string, string>,
): ProductionRun {
  return {
    id: row.id,
    productId: row.product_id,
    // null, not a placeholder: a product that is gone reads as absent.
    productName: products.get(row.product_id)?.name ?? null,
    quantity: Number(row.quantity) || 0,
    currency: row.currency,
    bomId: row.bom_id,
    bomVersion: row.bom_version,
    componentsCost: Number(row.components_cost) || 0,
    laborCost: Number(row.labor_cost) || 0,
    otherCost: Number(row.other_cost) || 0,
    unitCost: Number(row.unit_cost) || 0,
    calculatedTotal: Number(row.calculated_total) || 0,
    overrideTotal: numberOrNull(row.override_total),
    overrideReason: row.override_reason,
    totalCost: Number(row.total_cost) || 0,
    actualMaterialCost: numberOrNull(row.actual_material_cost),
    laborWorkers: numberOrNull(row.labor_workers),
    laborMinutes: numberOrNull(row.labor_minutes),
    addToInventory: row.add_to_inventory === true,
    consumeComponents: row.consume_components === true,
    warehouseId: row.warehouse_id,
    warehouseName: row.warehouse_id ? (warehouses.get(row.warehouse_id) ?? null) : null,
    notes: row.notes,
    producedOn: row.produced_on,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
  }
}

export class ManufacturingService {
  private key(workspaceId: string, ...parts: string[]) {
    return `manufacturing:${workspaceId}:${parts.join(':')}`
  }

  private async invalidate(workspaceId: string) {
    await memoryCache.invalidate(`manufacturing:${workspaceId}`)
  }

  // ─── Bills of materials ──────────────────────────────────────

  async listBoms(ctx: TenancyContext, productId?: string) {
    const cacheKey = this.key(ctx.workspaceId, 'boms', productId ?? 'all')

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    let query = supabase
      .from('boms')
      .select(
        `
        ${BOM_COLUMNS},
        product:products(id, name, unit),
        items:bom_items(${BOM_ITEM_COLUMNS}, raw_material:products(id, name, unit))
      `,
      )
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })

    if (productId) query = query.eq('product_id', productId)

    const { data, error } = await query
    if (error) {
      if (!EMBED_UNRESOLVED.has(error.code)) {
        throw new DatabaseError('Failed to fetch bills of materials', error)
      }
      const result = await this.listBomsWithoutEmbeds(ctx, productId)
      await memoryCache.set(cacheKey, result, 120)
      return result
    }

    const result = data ?? []
    await memoryCache.set(cacheKey, result, 120)
    return result
  }

  /**
   * The same shape as the embedded query, assembled by hand.
   *
   * The RESPONSE SHAPE IS IDENTICAL on purpose — `product` and
   * `items[].raw_material` are present either way, so no client can tell which
   * path served it and nothing downstream needs a branch.
   */
  private async listBomsWithoutEmbeds(ctx: TenancyContext, productId?: string) {
    let bomQuery = supabase
      .from('boms')
      .select(BOM_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })

    if (productId) bomQuery = bomQuery.eq('product_id', productId)

    const { data: boms, error: bomError } = await bomQuery
    if (bomError) throw new DatabaseError('Failed to fetch bills of materials', bomError)
    if (!boms || boms.length === 0) return []

    const { data: items, error: itemError } = await supabase
      .from('bom_items')
      .select(BOM_ITEM_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .in(
        'bom_id',
        boms.map((bom: { id: string }) => bom.id),
      )
    if (itemError) throw new DatabaseError('Failed to fetch BOM items', itemError)

    const rows = items ?? []
    const products = await productsByIdInWorkspace(ctx.workspaceId, [
      ...boms.map((bom: { product_id: string }) => bom.product_id),
      ...rows.map((item: { raw_material_id: string }) => item.raw_material_id),
    ])

    return boms.map((bom: { id: string; product_id: string }) => ({
      ...bom,
      // null, not a placeholder name: a component whose product is missing or
      // belongs to another workspace must read as absent.
      product: products.get(bom.product_id) ?? null,
      items: rows
        .filter((item: { bom_id: string }) => item.bom_id === bom.id)
        .map((item: { raw_material_id: string }) => ({
          ...item,
          raw_material: products.get(item.raw_material_id) ?? null,
        })),
    }))
  }

  // ─── Work orders ─────────────────────────────────────────────

  async listWorkOrders(ctx: TenancyContext, status?: string) {
    const cacheKey = this.key(ctx.workspaceId, 'work-orders', status ?? 'all')

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    let query = supabase
      .from('work_orders')
      .select(
        `
        ${WORK_ORDER_MINIMAL},
        product:products(id, name),
        bom:boms(id, version)
      `,
      )
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) {
      if (!EMBED_UNRESOLVED.has(error.code)) {
        throw new DatabaseError('Failed to fetch work orders', error)
      }
      const result = await this.listWorkOrdersWithoutEmbeds(ctx, status)
      await memoryCache.set(cacheKey, result, 60)
      return result
    }

    const result = data ?? []
    await memoryCache.set(cacheKey, result, 60)
    return result
  }

  /** Same shape as the embedded query. See listBomsWithoutEmbeds. */
  private async listWorkOrdersWithoutEmbeds(ctx: TenancyContext, status?: string) {
    let orderQuery = supabase
      .from('work_orders')
      .select(WORK_ORDER_MINIMAL)
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })

    if (status) orderQuery = orderQuery.eq('status', status)

    const { data: orders, error } = await orderQuery
    if (error) throw new DatabaseError('Failed to fetch work orders', error)
    if (!orders || orders.length === 0) return []

    const products = await productsByIdInWorkspace(
      ctx.workspaceId,
      orders.map((order: { product_id: string }) => order.product_id),
    )

    const bomIds = [
      ...new Set(orders.map((order: { bom_id: string | null }) => order.bom_id).filter(Boolean)),
    ] as string[]

    const bomVersions = new Map<string, { id: string; version: number }>()
    if (bomIds.length > 0) {
      const { data: boms, error: bomError } = await supabase
        .from('boms')
        .select('id, version')
        .eq('workspace_id', ctx.workspaceId)
        .in('id', bomIds)
      if (bomError) throw new DatabaseError('Failed to fetch BOM versions', bomError)
      for (const bom of boms ?? []) bomVersions.set(bom.id, bom)
    }

    return orders.map((order: { product_id: string; bom_id: string | null }) => ({
      ...order,
      product: products.get(order.product_id) ?? null,
      bom: order.bom_id ? (bomVersions.get(order.bom_id) ?? null) : null,
    }))
  }

  async createWorkOrder(
    ctx: TenancyContext,
    data: {
      productId: string
      quantity: number
      bomId?: string | undefined
      startDate?: string | undefined
      endDate?: string | undefined
    },
  ) {
    const { workspaceId, userId } = ctx

    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .insert({
        product_id: data.productId,
        quantity: data.quantity,
        bom_id: data.bomId || null,
        status: 'planned',
        start_date: data.startDate || null,
        end_date: data.endDate || null,
        workspace_id: workspaceId,
        user_id: userId,
      })
      .select(WORK_ORDER_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create work order', error)

    await this.invalidate(workspaceId)

    logBusinessEvent({
      userId,
      workspaceId,
      entityType: 'work_order',
      entityId: workOrder.id,
      action: 'created',
      title: `دستور تولید جدید ثبت شد`,
      notify: false,
    }).catch((err) => console.error('[ManufacturingService] logBusinessEvent failed:', err))

    return workOrder
  }

  async updateWorkOrder(
    ctx: TenancyContext,
    id: string,
    data: {
      status?: string | undefined
      quantity?: number | undefined
      startDate?: string | undefined
      endDate?: string | undefined
    },
  ) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.status !== undefined) {
      // ⚠️ «completed» is not a status a PATCH may set: it used to be, and it
      // marked an order done with nothing consumed and nothing produced.
      // Completion is `produce`, which does the work the word claims.
      if (data.status === 'completed') throw new ValidationError('WORK_ORDER_COMPLETE_VIA_PRODUCE')
      updates.status = data.status
    }
    if (data.quantity !== undefined) updates.quantity = data.quantity
    if (data.startDate !== undefined) updates.start_date = data.startDate
    if (data.endDate !== undefined) updates.end_date = data.endDate

    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      // A finished run is history; it is not edited.
      .neq('status', 'completed')
      .select(WORK_ORDER_COLUMNS)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to update work order', error)
    if (!workOrder) throw new ConflictError('WORK_ORDER_NOT_EDITABLE')

    await this.invalidate(ctx.workspaceId)
    return workOrder
  }

  // ─── The definition (BOM / recipe) ───────────────────────────

  /**
   * A product's active definition, shaped for the editor: the grid's columns
   * and rows exactly as they were saved, the other costs, the labour, and the
   * cost the SERVER derived from them.
   *
   * `currentCosts` is each stocked component's buy price TODAY, beside the cost
   * the definition was saved with — so «this material got dearer» is visible
   * where the definition is edited, and the person decides whether to take it.
   */
  async getDefinition(
    ctx: TenancyContext,
    productId: string,
  ): Promise<ProductionDefinition | null> {
    const { data: bom, error } = await supabase
      .from('boms')
      .select(
        'id, product_id, version, currency, columns, notes, labor_workers, labor_minutes, labor_hourly_rate, labor_cost_input, components_cost, labor_cost, other_cost, unit_cost, updated_at',
      )
      .eq('workspace_id', ctx.workspaceId)
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw this.readFailure('Failed to fetch the production definition', error)
    if (!bom) return null

    const { data: items, error: itemError } = await supabase
      .from('bom_items')
      .select(BOM_ITEM_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('bom_id', bom.id)
      .order('position', { ascending: true })
    if (itemError) throw this.readFailure('Failed to fetch the definition lines', itemError)

    const lines = (items ?? []) as BomItemRow[]
    const componentIds = lines.map((line) => line.raw_material_id).filter(Boolean) as string[]
    const currentCosts: Record<string, number> = {}
    const names = new Map<string, string>()
    if (componentIds.length > 0) {
      const { data: products, error: productError } = await supabase
        .from('products')
        .select('id, name, buy_price')
        .eq('workspace_id', ctx.workspaceId)
        .in('id', [...new Set(componentIds)])
      if (productError) throw new DatabaseError('Failed to fetch component prices', productError)
      for (const product of products ?? []) {
        currentCosts[product.id] = Number(product.buy_price) || 0
        names.set(product.id, product.name)
      }
    }

    return {
      bomId: bom.id,
      productId: bom.product_id,
      version: Number(bom.version) || 1,
      currency: bom.currency ?? null,
      columns: Array.isArray(bom.columns) ? bom.columns : [],
      rows: lines
        .filter((line) => line.kind !== 'cost')
        .map((line) => ({
          id: line.id,
          ...(line.raw_material_id ? { productId: line.raw_material_id } : {}),
          // A definition written before the grid existed has no cells; its
          // three numbers are the row.
          values:
            line.cells && Object.keys(line.cells).length > 0
              ? line.cells
              : {
                  description: line.label || names.get(line.raw_material_id ?? '') || '',
                  quantity: String(Number(line.quantity) || 0),
                  unitPrice: String(Number(line.unit_cost) || 0),
                  ...(line.unit ? { unit: line.unit } : {}),
                },
        })),
      otherCosts: lines
        .filter((line) => line.kind === 'cost')
        .map((line) => ({ label: line.label ?? '', amount: Number(line.line_total) || 0 })),
      labor: {
        workers: numberOrNull(bom.labor_workers),
        minutes: numberOrNull(bom.labor_minutes),
        hourlyRate: numberOrNull(bom.labor_hourly_rate),
        cost: numberOrNull(bom.labor_cost_input),
      },
      notes: bom.notes ?? '',
      cost: {
        componentsCost: Number(bom.components_cost) || 0,
        laborCost: Number(bom.labor_cost) || 0,
        otherCost: Number(bom.other_cost) || 0,
        unitCost: Number(bom.unit_cost) || 0,
      },
      currentCosts,
      updatedAt: bom.updated_at ?? null,
    }
  }

  /**
   * Save a product's definition. The cost is derived HERE from the rows — a
   * total in the request is not read — and written by one database function,
   * which revises instead of editing when a run already used the definition.
   */
  async saveDefinition(ctx: TenancyContext, input: SaveProductionDefinition) {
    const cost = computeProductionCost({
      currency: input.currency,
      columns: asProductionColumns(input.columns),
      rows: input.rows as InvoiceGridRow[],
      rates: input.rates,
      otherCosts: input.otherCosts,
      labor: input.labor,
      quantity: 1,
    })

    const { data, error } = await supabase.rpc('manufacturing_save_bom', {
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_payload: {
        product_id: input.productId,
        bom_id: input.bomId ?? null,
        currency: input.currency,
        columns: input.columns,
        notes: input.notes ?? null,
        labor: laborPayload(input.labor),
        components_cost: cost.componentsCost,
        labor_cost: cost.laborCost,
        other_cost: cost.otherCost,
        unit_cost: cost.unitCost,
        lines: cost.lines.map(linePayload),
      },
    })
    if (error) throw this.writeFailure('Failed to save the production definition', error)

    const result = (data ?? {}) as { bom_id: string; version: number; revised: boolean }
    await this.invalidate(ctx.workspaceId)

    logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: 'bom',
      entityId: result.bom_id,
      action: result.revised ? 'revised' : 'saved',
      title: result.revised ? 'فرمول ساخت بازنگری شد' : 'فرمول ساخت ذخیره شد',
      metadata: { productId: input.productId, version: result.version, unitCost: cost.unitCost },
      notify: false,
    }).catch((err) => console.error('[ManufacturingService] logBusinessEvent failed:', err))

    return { bomId: result.bom_id, version: result.version, revised: result.revised, cost }
  }

  // ─── Production ──────────────────────────────────────────────

  /**
   * Record one production run.
   *
   *   authorise (route) → validate → cost (server) → definition (optional)
   *   → manufacturing_complete: record + snapshot + components out + goods in,
   *     one transaction, through the costing core.
   *
   * ⚠️ IDEMPOTENT. A retry with the same key returns the run it already made;
   * the key is checked BEFORE the definition is touched, so a retry cannot
   * write a second revision either.
   */
  async produce(ctx: TenancyContext, input: ProduceInput) {
    const { workspaceId, userId } = ctx

    const { data: existing, error: existingError } = await supabase
      .from('work_orders')
      .select('id, quantity, total_cost')
      .eq('workspace_id', workspaceId)
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle()
    if (existingError) throw this.readFailure('Failed to check the production run', existingError)
    if (existing) {
      return {
        status: 'already_completed' as const,
        workOrderId: existing.id as string,
        quantity: Number(existing.quantity) || 0,
        totalCost: Number(existing.total_cost) || 0,
      }
    }

    const cost = computeProductionCost({
      currency: input.currency,
      columns: asProductionColumns(input.columns),
      rows: input.rows as InvoiceGridRow[],
      rates: input.rates,
      otherCosts: input.otherCosts,
      labor: input.labor,
      quantity: input.quantity,
      overrideTotal: input.overrideTotal,
    })

    // Where the goods land. The rule is the product page's own
    // (stockEditWarehouse): the named warehouse, the only one, or — with
    // several and none named — a refusal. Never a guess, and never «no
    // warehouse» for a business that has them.
    const warehouseId = input.addToInventory
      ? await this.inventoryWarehouse(workspaceId, input.warehouseId)
      : null

    let bomId = input.bomId ?? null
    let bomVersion: number | null = null
    if (input.saveDefinition) {
      const saved = await this.saveDefinition(ctx, {
        productId: input.productId,
        currency: input.currency,
        columns: input.columns,
        rows: input.rows,
        rates: input.rates,
        otherCosts: input.otherCosts,
        labor: input.labor,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.bomId ? { bomId: input.bomId } : {}),
      })
      bomId = saved.bomId
      bomVersion = saved.version
    } else if (bomId) {
      const { data: bom, error: bomError } = await supabase
        .from('boms')
        .select('version')
        .eq('workspace_id', workspaceId)
        .eq('id', bomId)
        .maybeSingle()
      if (bomError) throw this.readFailure('Failed to read the definition', bomError)
      if (!bom) throw new NotFoundError('Bill of materials')
      bomVersion = Number(bom.version) || null
    }

    const { data, error } = await supabase.rpc('manufacturing_complete', {
      p_workspace_id: workspaceId,
      p_user_id: userId,
      p_payload: {
        idempotency_key: input.idempotencyKey,
        work_order_id: input.workOrderId ?? null,
        product_id: input.productId,
        bom_id: bomId,
        bom_version: bomVersion,
        quantity: cost.quantity,
        currency: input.currency,
        columns: input.columns,
        notes: input.notes ?? null,
        produced_on: input.producedOn ?? new Date().toISOString().slice(0, 10),
        labor: laborPayload(input.labor),
        components_cost: cost.componentsCost,
        labor_cost: cost.laborCost,
        other_cost: cost.otherCost,
        unit_cost: cost.unitCost,
        calculated_total: cost.calculatedTotal,
        override_total: cost.overrideTotal,
        override_reason: cost.overrideTotal !== null ? (input.overrideReason ?? null) : null,
        total_cost: cost.total,
        add_to_inventory: input.addToInventory,
        consume_components: input.addToInventory && input.consumeComponents,
        warehouse_id: warehouseId,
        lines: cost.lines.map(linePayload),
      },
    })
    if (error) throw this.writeFailure('Failed to record the production run', error)

    const result = (data ?? {}) as Record<string, unknown>
    const workOrderId = String(result.work_order_id)

    await this.invalidate(workspaceId)
    // Stock and stock value changed: the same caches a sale or a purchase clears.
    if (input.addToInventory) await invalidateMoneyCaches(workspaceId)

    logBusinessEvent({
      userId,
      workspaceId,
      entityType: 'work_order',
      entityId: workOrderId,
      action: 'completed',
      title: 'تولید ثبت شد',
      metadata: {
        productId: input.productId,
        quantity: cost.quantity,
        totalCost: cost.total,
        addToInventory: input.addToInventory,
        warehouseId,
      },
      notify: false,
    }).catch((err) => console.error('[ManufacturingService] logBusinessEvent failed:', err))

    if (cost.overrideTotal !== null) {
      // Its own audit row: «who changed the figure, from what, to what, why»
      // must be findable without reading every production event.
      logBusinessEvent({
        userId,
        workspaceId,
        entityType: 'work_order',
        entityId: workOrderId,
        action: 'cost_overridden',
        title: 'جمع بهای تولید دستی تغییر کرد',
        metadata: {
          calculatedTotal: cost.calculatedTotal,
          overrideTotal: cost.overrideTotal,
          reason: input.overrideReason ?? null,
        },
        notify: false,
      }).catch((err) => console.error('[ManufacturingService] logBusinessEvent failed:', err))
    }

    return {
      status: (result.status as 'completed' | 'already_completed') ?? 'completed',
      workOrderId,
      quantity: cost.quantity,
      totalCost: cost.total,
      unitCost: cost.effectiveUnitCost,
      actualMaterialCost: numberOrNull(result.actual_material_cost),
      bomId,
      bomVersion,
    }
  }

  private async inventoryWarehouse(
    workspaceId: string,
    requested: string | null | undefined,
  ): Promise<string | null> {
    const { data, error } = await supabase
      .from('warehouses')
      .select('id, name, location, is_active')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
    if (error) throw new DatabaseError('Failed to read the warehouses', error)
    const choice = stockEditWarehouse((data ?? []) as WarehouseRow[], requested, 'edit')
    if ('refusal' in choice) throw new ValidationError(choice.refusal)
    return choice.warehouseId
  }

  // ─── History ─────────────────────────────────────────────────

  /** Completed runs, newest first, a page at a time. */
  async listRuns(
    ctx: TenancyContext,
    options: { productId?: string | undefined; limit: number; offset: number },
  ): Promise<{ runs: ProductionRun[]; total: number }> {
    let query = supabase
      .from('work_orders')
      .select(RUN_COLUMNS, { count: 'exact' })
      .eq('workspace_id', ctx.workspaceId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .range(options.offset, options.offset + options.limit - 1)
    if (options.productId) query = query.eq('product_id', options.productId)

    const { data, error, count } = await query
    if (error) throw this.readFailure('Failed to fetch production history', error)

    const rows = (data ?? []) as unknown as RunRow[]
    const [products, warehouses] = await Promise.all([
      productsByIdInWorkspace(
        ctx.workspaceId,
        rows.map((row) => row.product_id),
      ),
      this.warehouseNames(
        ctx.workspaceId,
        rows.map((row) => row.warehouse_id).filter(Boolean) as string[],
      ),
    ])

    return {
      runs: rows.map((row) => mapRun(row, products, warehouses)),
      total: count ?? rows.length,
    }
  }

  /** One run with its snapshot lines — what it was made of, on that day. */
  async getRun(
    ctx: TenancyContext,
    id: string,
  ): Promise<ProductionRun & { lines: ProductionRunLine[] }> {
    const { data, error } = await supabase
      .from('work_orders')
      .select(RUN_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .maybeSingle()
    if (error) throw this.readFailure('Failed to fetch the production run', error)
    if (!data) throw new NotFoundError('Work order')

    const row = data as unknown as RunRow
    const { data: lines, error: lineError } = await supabase
      .from('work_order_lines')
      .select(
        'id, kind, position, product_id, label, unit, quantity_per_unit, quantity, unit_cost, total, actual_cost, is_estimated, cells',
      )
      .eq('workspace_id', ctx.workspaceId)
      .eq('work_order_id', id)
      .order('position', { ascending: true })
    if (lineError) throw this.readFailure('Failed to fetch the production lines', lineError)

    const lineRows = (lines ?? []) as RunLineRow[]
    const [products, warehouses] = await Promise.all([
      productsByIdInWorkspace(ctx.workspaceId, [
        row.product_id,
        ...(lineRows.map((line) => line.product_id).filter(Boolean) as string[]),
      ]),
      this.warehouseNames(ctx.workspaceId, row.warehouse_id ? [row.warehouse_id] : []),
    ])

    return {
      ...mapRun(row, products, warehouses),
      lines: lineRows.map((line) => ({
        id: line.id,
        kind: line.kind,
        productId: line.product_id,
        label: line.label || products.get(line.product_id ?? '')?.name || '',
        unit: line.unit,
        quantityPerUnit: Number(line.quantity_per_unit) || 0,
        quantity: Number(line.quantity) || 0,
        unitCost: Number(line.unit_cost) || 0,
        total: Number(line.total) || 0,
        actualCost: numberOrNull(line.actual_cost),
        isEstimated: line.is_estimated === true,
        cells: line.cells ?? {},
      })),
    }
  }

  private async warehouseNames(workspaceId: string, ids: readonly string[]) {
    const unique = [...new Set(ids)]
    if (unique.length === 0) return new Map<string, string>()
    const { data, error } = await supabase
      .from('warehouses')
      .select('id, name')
      .eq('workspace_id', workspaceId)
      .in('id', unique)
    if (error) throw new DatabaseError('Failed to fetch warehouses for manufacturing', error)
    return new Map((data ?? []).map((row: { id: string; name: string }) => [row.id, row.name]))
  }

  // ─── Reporting ───────────────────────────────────────────────

  /**
   * What was made in a period and what it cost, aggregated in the database
   * from the snapshot lines. Not cached on failure, and a failure is not an
   * empty report.
   */
  async report(
    ctx: TenancyContext,
    range: { from: string; to: string; productId?: string | undefined },
  ): Promise<ProductionReport> {
    const cacheKey = this.key(
      ctx.workspaceId,
      'report',
      range.from,
      range.to,
      range.productId ?? 'all',
    )
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as ProductionReport

    const { data, error } = await supabase.rpc('manufacturing_report', {
      p_workspace_id: ctx.workspaceId,
      p_from: range.from,
      p_to: range.to,
      p_product_id: range.productId ?? null,
    })
    if (error) throw this.readFailure('Failed to build the manufacturing report', error)

    const raw = (data ?? {}) as Record<string, any>
    const totals = (raw.totals ?? {}) as Record<string, unknown>
    const report: ProductionReport = {
      from: range.from,
      to: range.to,
      totals: {
        runs: Number(totals.runs) || 0,
        quantity: Number(totals.quantity) || 0,
        totalCost: Number(totals.total_cost) || 0,
        componentsCost: Number(totals.components_cost) || 0,
        laborCost: Number(totals.labor_cost) || 0,
        otherCost: Number(totals.other_cost) || 0,
        laborMinutes: Number(totals.labor_minutes) || 0,
      },
      products: (Array.isArray(raw.products) ? raw.products : []).map(
        (row: Record<string, unknown>) => ({
          productId: String(row.product_id),
          name: (row.name as string | null) ?? '',
          runs: Number(row.runs) || 0,
          quantity: Number(row.quantity) || 0,
          totalCost: Number(row.total_cost) || 0,
          firstUnitCost: Number(row.first_unit_cost) || 0,
          lastUnitCost: Number(row.last_unit_cost) || 0,
        }),
      ),
      materials: (Array.isArray(raw.materials) ? raw.materials : []).map(
        (row: Record<string, unknown>) => ({
          key: String(row.key),
          productId: (row.product_id as string | null) ?? null,
          name: (row.name as string | null) ?? '',
          unit: (row.unit as string | null) ?? null,
          quantity: Number(row.quantity) || 0,
          value: Number(row.value) || 0,
          runs: Number(row.runs) || 0,
          products: Number(row.products) || 0,
          previousCost: Number(row.previous_cost) || 0,
          currentCost: Number(row.current_cost) || 0,
          change: Number(row.change) || 0,
          // null = there was no previous cost to compare with — not «0% change».
          changePercent: numberOrNull(row.change_percent),
        }),
      ),
    }

    await memoryCache.set(cacheKey, report, 60)
    return report
  }

  // ─── Errors ──────────────────────────────────────────────────

  /** The schema of docs/manufacturing-01-migration.sql is not there yet. */
  private readFailure(message: string, error: { code?: string; message?: string }) {
    if (MISSING_SCHEMA.has(error.code ?? '')) return new ManufacturingNotConfiguredError()
    return new DatabaseError(message, error)
  }

  /** A refusal raised by the database function is the caller's to read. */
  private writeFailure(message: string, error: { code?: string; message?: string }) {
    if (MISSING_SCHEMA.has(error.code ?? '')) return new ManufacturingNotConfiguredError()
    const code = domainErrorCode(error)
    if (!code) return new DatabaseError(message, error)
    if (CONFLICT_CODES.has(code)) return new ConflictError(code)
    return new ValidationError(code)
  }

  async getWorkOrderStats(ctx: TenancyContext) {
    const cacheKey = this.key(ctx.workspaceId, 'work-order-stats')

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const countFor = (status: string) =>
      supabase
        .from('work_orders')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', ctx.workspaceId)
        .eq('status', status)

    const [planned, inProgress, completed, cancelled] = await Promise.all([
      countFor('planned'),
      countFor('in_progress'),
      countFor('completed'),
      countFor('cancelled'),
    ])

    const result = {
      planned: planned.count ?? 0,
      inProgress: inProgress.count ?? 0,
      completed: completed.count ?? 0,
      cancelled: cancelled.count ?? 0,
      total:
        (planned.count ?? 0) +
        (inProgress.count ?? 0) +
        (completed.count ?? 0) +
        (cancelled.count ?? 0),
    }

    await memoryCache.set(cacheKey, result, 60)
    return result
  }
}

export default ManufacturingService
