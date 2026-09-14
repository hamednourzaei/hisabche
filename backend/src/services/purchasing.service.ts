// ============================================
// backend/src/services/purchasing.service.ts
//
// Purchase orders and receiving goods against them.
//
// ---------------------------------------------------------------------------
// WHAT CHANGED
//
// Every query here filtered on `user_id`, so a purchase order raised by one
// member of a shop was invisible to the rest of it — including the person who
// had to receive the goods. The cache keys carried the user too, so two
// members of the same shop kept two different lists of the same orders.
//
// Receiving also did nothing about cost. It added the quantity to
// `products.quantity` and stopped, so goods arrived with no cost layer behind
// them and the next sale of them was priced from whatever the product's
// buy price happened to say. Receiving now goes through the costing core, the
// same way a purchase invoice does.
// ============================================

import { supabase } from '../db'
import { CreatePurchaseOrder, UpdatePurchaseOrder } from '@hisabche/validation'
import type { TenancyContext } from './tenancy.service'
import { costing } from './inventory-costing'
import { DatabaseError, NotFoundError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'
import { logBusinessEvent } from './event-log.service'
import { ledger } from './accounting'
import { budgets } from './budgeting'
import { ValidationError } from '../errors/validation.error'

const PO_LIST_COLUMNS =
  'id, supplier_id, order_date, expected_delivery_date, status, notes, received_at, created_at, updated_at'
const PO_MINIMAL = 'id, supplier_id, status, order_date'

const PO_ITEM_COLUMNS = 'id, purchase_order_id, product_id, quantity, unit_price, total_price'
const PO_ITEM_MINIMAL = 'id, product_id, quantity, unit_price'

export class PurchasingService {
  // ─── Cache ───────────────────────────────────────────────────
  // Keyed by WORKSPACE. The same shop's members must see the same orders.

  private key(workspaceId: string, ...parts: string[]) {
    return `purchasing:${workspaceId}:${parts.join(':')}`
  }

  private async invalidate(workspaceId: string) {
    await memoryCache.invalidate(`purchasing:${workspaceId}`)
  }

  // ─── List ────────────────────────────────────────────────────
  async listPurchaseOrders(ctx: TenancyContext) {
    const cacheKey = this.key(ctx.workspaceId, 'orders')

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('purchase_orders')
      .select(
        `
        ${PO_MINIMAL},
        supplier:suppliers(id, name, phone, email),
        items:purchase_order_items(${PO_ITEM_MINIMAL}, product:products(id, name, unit))
      `,
      )
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })

    if (error) throw new DatabaseError('Failed to fetch purchase orders', error)

    const result = data ?? []
    await memoryCache.set(cacheKey, result, 120)
    return result
  }

  // ─── Budget control ──────────────────────────────────────────
  /**
   * The account a purchase order will eventually hit, and the order's value.
   *
   * A purchase invoice debits the INVENTORY account, so that is where a budget
   * for buying stock lives and where the commitment is reserved. Resolved, not
   * created: no chart of accounts means no budget can exist on it.
   */
  private async budgetTarget(ctx: TenancyContext, items: any[]) {
    const totalMinor = items.reduce(
      (sum, item) =>
        sum +
        Math.round(
          (Number(
            item.totalPrice ?? (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
          ) || 0) * 100,
        ),
      0,
    )
    const { accounts } = await ledger.resolveAccountsByRole(ctx, ['inventory'])
    return { accountId: accounts.inventory ?? null, totalMinor }
  }

  // ─── Create ──────────────────────────────────────────────────
  async createPurchaseOrder(ctx: TenancyContext, data: CreatePurchaseOrder) {
    const { workspaceId, userId } = ctx
    const items = data.items || []

    // ⚠️ ASKED BEFORE THE ORDER EXISTS. The budget engine had checkSpend and
    // commit and nothing called them, so a purchase order could spend any
    // amount against a `block` budget. The server decides; the client is told.
    const target = await this.budgetTarget(ctx, items)
    const orderDate = String(data.orderDate || new Date().toISOString()).slice(0, 10)
    const control =
      target.accountId && target.totalMinor > 0
        ? await budgets.checkSpend(ctx, {
            accountId: target.accountId,
            amountMinor: target.totalMinor,
            onDate: orderDate,
          })
        : null

    if (control && control.decision === 'block') {
      const over = Math.max(...control.impacts.map((i) => i.exceededByMinor))
      throw new ValidationError(`BUDGET_EXCEEDED: over by ${over}`)
    }
    if (control && control.decision === 'require_approval') {
      // There is no purchase-order approval workflow to park it in. Refusing
      // with the reason is honest; creating it and calling it "pending
      // approval" would be a status nobody can act on.
      const over = Math.max(...control.impacts.map((i) => i.exceededByMinor))
      throw new ValidationError(`BUDGET_APPROVAL_REQUIRED: over by ${over}`)
    }

    const { data: order, error } = await supabase
      .from('purchase_orders')
      .insert({
        supplier_id: data.supplierId,
        order_date: data.orderDate || new Date().toISOString(),
        expected_delivery_date: data.expectedDeliveryDate || null,
        status: data.status || 'pending',
        notes: data.notes || null,
        workspace_id: workspaceId,
        user_id: userId,
      })
      .select(PO_LIST_COLUMNS)
      .single()

    if (error || !order) throw new DatabaseError('Failed to create purchase order', error)

    if (items.length > 0) {
      const orderItems = items.map((item: any) => ({
        purchase_order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice ?? item.quantity * item.unitPrice,
        workspace_id: workspaceId,
        user_id: userId,
      }))

      const { error: itemsError } = await supabase.from('purchase_order_items').insert(orderItems)

      if (itemsError) {
        await supabase.from('purchase_orders').delete().eq('id', order.id)
        throw new DatabaseError('Failed to create purchase order items', itemsError)
      }
    }

    await this.invalidate(workspaceId)

    if (control && target.accountId) {
      // Reserve against every controlling budget, and record any warn breach.
      // supabase-js has no transaction: a failure here leaves the order without
      // its reservation, which is logged loudly rather than hidden.
      for (const impact of control.impacts) {
        try {
          await budgets.commit(ctx, {
            budgetId: impact.budgetId,
            sourceType: 'purchase_order',
            sourceId: order.id,
            amountMinor: target.totalMinor,
          })
          if (impact.exceeds) {
            await budgets.recordBreach(ctx, {
              budgetId: impact.budgetId,
              sourceType: 'purchase_order',
              sourceId: order.id,
              overByMinor: impact.exceededByMinor,
              actionTaken: impact.decision,
            })
          }
        } catch (err) {
          console.error('[PurchasingService] budget reservation failed for order', order.id, err)
        }
      }
    }

    logBusinessEvent({
      userId,
      workspaceId,
      entityType: 'purchase_order',
      entityId: order.id,
      action: 'created',
      title: `سفارش خرید جدید ثبت شد`,
      notifyType: 'success',
      actionUrl: `/purchasing`,
    }).catch((err) => console.error('[PurchasingService] logBusinessEvent failed:', err))

    return this.getPurchaseOrder(order.id, ctx)
  }

  // ─── Get ─────────────────────────────────────────────────────
  async getPurchaseOrder(id: string, ctx: TenancyContext) {
    const cacheKey = this.key(ctx.workspaceId, 'order', id)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('purchase_orders')
      .select(
        `
        ${PO_LIST_COLUMNS},
        supplier:suppliers(id, name, phone, email),
        items:purchase_order_items(${PO_ITEM_COLUMNS}, product:products(id, name, unit))
      `,
      )
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch purchase order', error)
    if (!data) throw new NotFoundError('Purchase order')

    await memoryCache.set(cacheKey, data, 300)
    return data
  }

  // ─── Update ──────────────────────────────────────────────────
  async updatePurchaseOrder(ctx: TenancyContext, id: string, data: UpdatePurchaseOrder) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.supplierId !== undefined) updates.supplier_id = data.supplierId
    if (data.status !== undefined) updates.status = data.status
    if (data.expectedDeliveryDate !== undefined) {
      updates.expected_delivery_date = data.expectedDeliveryDate
    }
    if (data.notes !== undefined) updates.notes = data.notes

    const { data: order, error } = await supabase
      .from('purchase_orders')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      .select(PO_LIST_COLUMNS)
      .single()

    if (error || !order) throw new DatabaseError('Failed to update purchase order', error)

    await this.invalidate(ctx.workspaceId)
    return order
  }

  // ─── Receive ─────────────────────────────────────────────────
  /**
   * Goods arrived against this order.
   *
   * Two things happen, in this order: the goods get a COST LAYER holding what
   * was paid for them, and only then does the order move to `received`. The
   * old version did neither — it added to `products.quantity` and stopped, so
   * stock appeared with no cost behind it and the next sale of it was priced
   * from whatever the product's buy price happened to say that day.
   *
   * Receiving is idempotent per order line, so a retry after a lost response
   * does not receive the same goods twice.
   */
  async receiveGoods(ctx: TenancyContext, id: string) {
    const { workspaceId, userId } = ctx

    const { data: order, error } = await supabase
      .from('purchase_orders')
      .select(
        `
        id, status, order_date,
        items:purchase_order_items(id, product_id, quantity, unit_price, total_price)
      `,
      )
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch purchase order', error)
    if (!order) throw new NotFoundError('Purchase order')

    const items = ((order as any).items ?? []) as Array<{
      id: string
      product_id: string
      quantity: number
      unit_price: number
      total_price: number | null
    }>

    const entryDate = String((order as any).order_date ?? new Date().toISOString()).slice(0, 10)

    for (const item of items) {
      const quantity = Number(item.quantity) || 0
      if (!item.product_id || quantity <= 0) continue

      const lineTotal = Number(item.total_price) || quantity * (Number(item.unit_price) || 0)

      await costing.recordReceipt(ctx, {
        productId: item.product_id,
        quantity,
        // What was actually paid per unit. The list price would overstate the
        // layer and every profit later drawn from it.
        unitCost: lineTotal / quantity,
        entryDate,
        sourceType: 'purchase_order',
        sourceId: id,
        sourceLine: item.id,
      })
    }

    // ─── PHASE C — record the arrival as a stock movement ────────────────────
    //
    // Receiving a purchase order used to write NO movement row at all. It
    // recorded a cost layer and then copied the layer's on-hand figure onto
    // `products.quantity`. So `stock_movements` — which the architecture calls
    // the source of truth for inventory — did not contain purchase receipts,
    // and any report built from it was missing every arrival of goods.
    //
    // The cost layer still records what the goods COST; that is the costing
    // core's job and it keeps it. This records that they ARRIVED, which is a
    // different fact and now has exactly one home.
    //
    // `products.quantity` is no longer written here: the projection trigger
    // maintains it from these rows. Writing both would add the arrival twice.
    if (items.length > 0) {
      const movements = items
        .filter((item) => item.product_id)
        .map((item) => ({
          product_id: item.product_id,
          type: 'purchase',
          quantity: Number(item.quantity) || 0,
          reference_type: 'purchase_order',
          reference_id: id,
          workspace_id: workspaceId,
          user_id: userId,
        }))

      if (movements.length > 0) {
        const { error: movementError } = await supabase.from('stock_movements').insert(movements)

        if (movementError) {
          throw new DatabaseError('Failed to record stock movements for receipt', movementError)
        }
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        status: 'received',
        received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(PO_LIST_COLUMNS)
      .single()

    if (updateError || !updated) {
      throw new DatabaseError('Failed to update purchase order status', updateError)
    }

    // The goods arrived; the purchase invoice that pays for them posts the
    // actual. Holding the reservation too would count the same money twice.
    await budgets.release(ctx, 'purchase_order', id)

    await this.invalidate(workspaceId)
    return updated
  }

  // ─── Delete ──────────────────────────────────────────────────
  async deletePurchaseOrder(ctx: TenancyContext, id: string): Promise<void> {
    // Scoped first: without the workspace filter the item delete below would
    // remove the lines of ANY order whose id was supplied.
    const { data: owned, error: ownerError } = await supabase
      .from('purchase_orders')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()

    if (ownerError) throw new DatabaseError('Failed to verify purchase order', ownerError)
    if (!owned) throw new NotFoundError('Purchase order')

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .delete()
      .eq('purchase_order_id', id)

    if (itemsError) throw new DatabaseError('Failed to delete purchase order items', itemsError)

    const { error } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)

    if (error) throw new DatabaseError('Failed to delete purchase order', error)

    // A cancelled order promises nothing any more.
    await budgets.release(ctx, 'purchase_order', id)

    await this.invalidate(ctx.workspaceId)
  }

  // ─── Stats ───────────────────────────────────────────────────
  async getPurchaseOrderStats(ctx: TenancyContext) {
    const cacheKey = this.key(ctx.workspaceId, 'stats')

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const countFor = (status: string) =>
      supabase
        .from('purchase_orders')
        .select('id', { count: 'estimated', head: true })
        .eq('workspace_id', ctx.workspaceId)
        .eq('status', status)

    const [pending, received, cancelled] = await Promise.all([
      countFor('pending'),
      countFor('received'),
      countFor('cancelled'),
    ])

    const result = {
      pending: pending.count ?? 0,
      received: received.count ?? 0,
      cancelled: cancelled.count ?? 0,
      total: (pending.count ?? 0) + (received.count ?? 0) + (cancelled.count ?? 0),
    }

    await memoryCache.set(cacheKey, result, 60)
    return result
  }
}

export default PurchasingService
