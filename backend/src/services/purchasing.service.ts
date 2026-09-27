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

import { randomUUID } from 'node:crypto'
import { sourceIdOf } from '../utils/deterministic-id'
import { IdempotencyUnavailableError } from '../utils/client-request'
import { supabase } from '../db'
import { CreatePurchaseOrder, UpdatePurchaseOrder } from '@hisabche/validation'
import type { TenancyContext } from './tenancy.service'
import { costing } from './inventory-costing'
import { ConflictError, DatabaseError, NotFoundError } from '../errors/database.error'
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
  async createPurchaseOrder(
    ctx: TenancyContext,
    data: CreatePurchaseOrder,
    options: { idempotencyKey?: string | null | undefined } = {},
  ) {
    const { workspaceId, userId } = ctx
    const items = data.items || []

    // ⚠️ KEYED (27 Sep 2026). With an Idempotency-Key the order's id is
    // derived from it, so a retried submit names the same order: the first
    // one is returned and nothing — budget reservation included — runs twice.
    const key = options.idempotencyKey ?? null
    const orderId = key ? sourceIdOf(workspaceId, 'purchase_order', key) : randomUUID()
    if (key) {
      const replay = await this.existingOrder(workspaceId, orderId)
      if (replay) return { ...(await this.getPurchaseOrder(orderId, ctx)), idempotentReplay: true }
    }

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

    const header = {
      id: orderId,
      supplier_id: data.supplierId,
      order_date: data.orderDate || new Date().toISOString(),
      expected_delivery_date: data.expectedDeliveryDate || null,
      status: data.status || 'pending',
      notes: data.notes || null,
      workspace_id: workspaceId,
      user_id: userId,
    }
    const orderItems = items.map((item: any) => ({
      purchase_order_id: orderId,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice ?? item.quantity * item.unitPrice,
      workspace_id: workspaceId,
      user_id: userId,
    }))

    // ⚠️ ONE TRANSACTION (docs/purchase-order-write-migration.sql). A lines
    // failure used to DELETE the header afterwards — the compensating write
    // rule 4 forbids.
    const writeError = await this.writeOrder(ctx, orderId, header, orderItems, key !== null)
    if (writeError) {
      if (key && writeError.code === '23505') {
        // A concurrent copy of the same submit won: answer with its order.
        return { ...(await this.getPurchaseOrder(orderId, ctx)), idempotentReplay: true }
      }
      throw new DatabaseError('Failed to create purchase order', writeError)
    }
    const order = { id: orderId }

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

  private async existingOrder(workspaceId: string, id: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to check for an existing purchase order', error)
    return data !== null
  }

  /**
   * Header and lines in one transaction. Before the migration: the two rows
   * one at a time — never a compensating DELETE; a lines failure leaves the
   * header, visible and correctable, and says so. A KEYED create is refused
   * then (503): the key promises one order, and the stepwise path cannot keep
   * that promise across a crash between the two writes.
   */
  private async writeOrder(
    ctx: TenancyContext,
    orderId: string,
    header: Record<string, unknown>,
    lines: Array<Record<string, unknown>>,
    keyed: boolean,
  ): Promise<{ code?: string; message?: string } | null> {
    const { error } = await supabase.rpc('purchase_order_write', {
      p_workspace_id: ctx.workspaceId,
      p_order_id: orderId,
      p_order: header,
      p_items: lines,
    })
    if (!error) return null
    if (error.code !== 'PGRST202' && error.code !== '42883') return error
    if (keyed) throw new IdempotencyUnavailableError('purchase_order')

    const { error: headerError } = await supabase.from('purchase_orders').insert(header)
    if (headerError) return headerError
    if (lines.length > 0) {
      const { error: linesError } = await supabase.from('purchase_order_items').insert(lines)
      if (linesError) {
        throw new DatabaseError(
          `Purchase order ${orderId} was saved but its lines could not be`,
          linesError,
        )
      }
    }
    return null
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

    // ⚠️ A RECEIVED ORDER'S STATUS IS FINAL. Edited back to «pending», it could
    // be received again and its goods would arrive twice. The status is only
    // changed on an order that is not received — in the same statement, so a
    // concurrent receive cannot slip between a check and the write.
    let query = supabase
      .from('purchase_orders')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
    if (data.status !== undefined) query = query.neq('status', 'received')
    const { data: order, error } = await query.select(PO_LIST_COLUMNS).maybeSingle()

    if (error) throw new DatabaseError('Failed to update purchase order', error)
    if (!order) {
      if (data.status !== undefined) throw new ConflictError('PURCHASE_ORDER_ALREADY_RECEIVED')
      throw new NotFoundError('Purchase order')
    }

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

    // ⚠️ CLAIM THE TRANSITION BEFORE MOVING ANY STOCK (#142, 26 Sep 2026).
    //
    // Nothing here checked the status, and the status was written LAST. A
    // second «receive» — a double-click, a retry after a lost response, or two
    // devices — ran the whole method again: cost layers are idempotent
    // (`ON CONFLICT DO NOTHING` on the source line), but the `stock_movements`
    // insert is not, so the goods arrived twice on the shelf. Now the status
    // flips first, conditioned on the status just read: exactly one caller's
    // update matches a row, every other one finds nothing and is refused.
    const priorStatus = String((order as { status?: unknown }).status ?? '')
    if (priorStatus === 'received') throw new ConflictError('PURCHASE_ORDER_ALREADY_RECEIVED')
    if (priorStatus === 'cancelled') throw new ConflictError('PURCHASE_ORDER_CANCELLED')

    const receivedAt = new Date().toISOString()
    const { data: claimed, error: claimError } = await supabase
      .from('purchase_orders')
      .update({ status: 'received', received_at: receivedAt, updated_at: receivedAt })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .eq('status', priorStatus)
      .select(PO_LIST_COLUMNS)
      .maybeSingle()

    if (claimError)
      throw new DatabaseError('Failed to claim purchase order for receiving', claimError)
    if (!claimed) throw new ConflictError('PURCHASE_ORDER_ALREADY_RECEIVED')

    try {
      await this.moveReceivedGoods(ctx, id, order)
    } catch (moveError) {
      // The stock did not (fully) arrive, so the order must not say it did.
      // A status write, not a compensating DELETE: the cost layers already
      // written are keyed by source line, so the retry reuses them.
      await supabase
        .from('purchase_orders')
        .update({ status: priorStatus, received_at: null, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .eq('status', 'received')
      throw moveError
    }

    // The goods arrived; the purchase invoice that pays for them posts the
    // actual. Holding the reservation too would count the same money twice.
    await budgets.release(ctx, 'purchase_order', id)

    await this.invalidate(workspaceId)
    return claimed
  }

  /** Cost layers + stock movements for a claimed receipt. Only `receiveGoods` calls this. */
  private async moveReceivedGoods(ctx: TenancyContext, id: string, order: object) {
    const { workspaceId, userId } = ctx
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
