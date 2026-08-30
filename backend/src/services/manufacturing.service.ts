// ============================================
// backend/src/services/manufacturing.service.ts
//
// Bills of materials, work orders, and what a finished good actually cost to
// make.
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

import { supabase } from '../db'
import { costing } from './inventory-costing'
import { ConflictError, DatabaseError, NotFoundError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'
import type { TenancyContext } from './tenancy.service'
import { logBusinessEvent } from './event-log.service'

const BOM_COLUMNS = 'id, product_id, version, notes, is_active, created_at, updated_at'
const BOM_ITEM_COLUMNS = 'id, bom_id, raw_material_id, quantity, unit_cost'
const WORK_ORDER_COLUMNS =
  'id, product_id, quantity, bom_id, status, start_date, end_date, created_at, updated_at'
const WORK_ORDER_MINIMAL = 'id, product_id, quantity, status, start_date'

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
    if (error) throw new DatabaseError('Failed to fetch bills of materials', error)

    const result = data ?? []
    await memoryCache.set(cacheKey, result, 120)
    return result
  }

  async createBom(ctx: TenancyContext, data: any) {
    const { workspaceId, userId } = ctx

    const { data: bom, error } = await supabase
      .from('boms')
      .insert({
        product_id: data.productId,
        version: data.version ?? 1,
        notes: data.notes ?? '',
        is_active: data.isActive !== false,
        workspace_id: workspaceId,
        user_id: userId,
      })
      .select(BOM_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create bill of materials', error)

    const items = (data.items ?? []).map((item: any) => ({
      bom_id: bom.id,
      raw_material_id: item.rawMaterialId,
      quantity: item.quantity,
      unit_cost: item.unitCost ?? 0,
      workspace_id: workspaceId,
      user_id: userId,
    }))

    if (items.length > 0) {
      const { error: itemsError } = await supabase.from('bom_items').insert(items)
      if (itemsError) {
        await supabase.from('boms').delete().eq('id', bom.id).eq('workspace_id', workspaceId)
        throw new DatabaseError('Failed to create BOM items', itemsError)
      }
    }

    await this.invalidate(workspaceId)
    return bom
  }

  async updateBom(ctx: TenancyContext, id: string, data: any) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.version !== undefined) updates.version = data.version
    if (data.notes !== undefined) updates.notes = data.notes
    if (data.isActive !== undefined) updates.is_active = data.isActive

    const { data: bom, error } = await supabase
      .from('boms')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      .select(BOM_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update bill of materials', error)

    if (data.items) {
      await supabase.from('bom_items').delete().eq('bom_id', id).eq('workspace_id', ctx.workspaceId)

      const items = data.items.map((item: any) => ({
        bom_id: id,
        raw_material_id: item.rawMaterialId,
        quantity: item.quantity,
        unit_cost: item.unitCost ?? 0,
        workspace_id: ctx.workspaceId,
        user_id: ctx.userId,
      }))

      if (items.length > 0) {
        const { error: itemsError } = await supabase.from('bom_items').insert(items)
        if (itemsError) throw new DatabaseError('Failed to replace BOM items', itemsError)
      }
    }

    await this.invalidate(ctx.workspaceId)
    return bom
  }

  async getBom(ctx: TenancyContext, id: string) {
    const cacheKey = this.key(ctx.workspaceId, 'bom', id)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('boms')
      .select(
        `
        ${BOM_COLUMNS},
        product:products(id, name, unit),
        items:bom_items(${BOM_ITEM_COLUMNS}, raw_material:products(id, name, unit, buy_price))
      `,
      )
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch bill of materials', error)
    if (!data) throw new NotFoundError('Bill of materials')

    await memoryCache.set(cacheKey, data, 300)
    return data
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
    if (error) throw new DatabaseError('Failed to fetch work orders', error)

    const result = data ?? []
    await memoryCache.set(cacheKey, result, 60)
    return result
  }

  async createWorkOrder(ctx: TenancyContext, data: any) {
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

  async updateWorkOrder(ctx: TenancyContext, id: string, data: any) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.status !== undefined) updates.status = data.status
    if (data.quantity !== undefined) updates.quantity = data.quantity
    if (data.startDate !== undefined) updates.start_date = data.startDate
    if (data.endDate !== undefined) updates.end_date = data.endDate

    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      .select(WORK_ORDER_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update work order', error)

    await this.invalidate(ctx.workspaceId)
    return workOrder
  }

  async getWorkOrder(ctx: TenancyContext, id: string) {
    const cacheKey = this.key(ctx.workspaceId, 'work-order', id)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('work_orders')
      .select(
        `
        ${WORK_ORDER_COLUMNS},
        product:products(id, name, unit),
        bom:boms(id, version, items:bom_items(${BOM_ITEM_COLUMNS}))
      `,
      )
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch work order', error)
    if (!data) throw new NotFoundError('Work order')

    await memoryCache.set(cacheKey, data, 300)
    return data
  }

  /**
   * The work order is finished: consume the components, produce the goods.
   *
   * The order matters and is the whole of manufacturing accounting:
   *
   *   1. ISSUE each component through the costing core, at what the consumed
   *      layers actually cost.
   *   2. RECEIVE the finished goods as a cost layer worth exactly that total,
   *      divided across the units made.
   *
   * Value is conserved. The version this replaces did neither: the finished
   * quantity was added to stock with no cost behind it, and the components
   * were never consumed — so making ten units created inventory value out of
   * nothing and left the raw materials on the shelf.
   *
   * Both halves are idempotent per work order, so a retry after a lost
   * response neither consumes the components twice nor produces the goods
   * twice.
   */
  async completeWorkOrder(ctx: TenancyContext, id: string) {
    const { workspaceId } = ctx

    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .select(
        `
        id, product_id, quantity, status, bom_id,
        bom:boms(id, items:bom_items(id, raw_material_id, quantity))
      `,
      )
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch work order', error)
    if (!workOrder) throw new NotFoundError('Work order')
    if (workOrder.status === 'completed') throw new ConflictError('WORK_ORDER_ALREADY_COMPLETED')

    const produced = Number(workOrder.quantity) || 0
    if (produced <= 0) throw new ConflictError('WORK_ORDER_QUANTITY_INVALID')

    const today = new Date().toISOString().slice(0, 10)
    const components = ((workOrder as any).bom?.items ?? []) as Array<{
      id: string
      raw_material_id: string
      quantity: number
    }>

    // ─── 1. Consume the components ──────────────────────────
    let materialCost = 0

    for (const component of components) {
      const required = (Number(component.quantity) || 0) * produced
      if (!component.raw_material_id || required <= 0) continue

      const result = await costing.recordIssue(ctx, {
        productId: component.raw_material_id,
        quantity: required,
        entryDate: today,
        consumerType: 'adjustment',
        consumerId: id,
        consumerLine: component.id,
      })

      materialCost += result.totalCost
    }

    // ─── 2. Produce the finished goods ──────────────────────
    // Priced at what the components cost, per unit made. A finished good
    // costing zero because its BOM was empty is a real answer — it says the
    // bill of materials has not been filled in — and it is left visible
    // rather than papered over with a guess.
    await costing.recordReceipt(ctx, {
      productId: workOrder.product_id,
      quantity: produced,
      unitCost: materialCost / produced,
      entryDate: today,
      sourceType: 'adjustment',
      sourceId: id,
      sourceLine: 'finished-goods',
    })

    const { error: updateError } = await supabase
      .from('work_orders')
      .update({
        status: 'completed',
        end_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (updateError) throw new DatabaseError('Failed to update work order', updateError)

    // The on-hand figure on the product is a display cache. Refreshed FROM the
    // layers rather than incremented, so a retry cannot double it — and
    // scoped to the workspace, which the version this replaces was not.
    const valuations = await costing.getValuation(ctx)
    const byProduct = new Map(valuations.map((row) => [row.productId, row.onHand]))
    const touched = [
      workOrder.product_id,
      ...components.map((component) => component.raw_material_id),
    ].filter(Boolean)

    await Promise.all(
      [...new Set(touched)].map((productId) =>
        supabase
          .from('products')
          .update({ quantity: byProduct.get(productId) ?? 0 })
          .eq('id', productId)
          .eq('workspace_id', workspaceId),
      ),
    )

    await this.invalidate(workspaceId)

    return {
      success: true,
      workOrderId: id,
      produced,
      materialCost: Math.round(materialCost * 100) / 100,
      unitCost: Math.round((materialCost / produced) * 100) / 100,
    }
  }

  async getWorkOrderStats(ctx: TenancyContext) {
    const cacheKey = this.key(ctx.workspaceId, 'work-order-stats')

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const countFor = (status: string) =>
      supabase
        .from('work_orders')
        .select('id', { count: 'estimated', head: true })
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
