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
import {
  buildSupplierScorecard,
  checkVariantBinding,
  CreatePurchaseOrder,
  DRAFT_PURCHASE_LINE_INCOMPLETE,
  evaluateThreeWayMatch,
  planReordersWithPackRounding,
  type CreateDraftFromSuggestionsInput,
  type ReorderDraftPlanResult,
  type SupplierScorecardRow,
  UpdatePurchaseOrder,
  orderLineTotal,
  receiptUnitCost,
  receiveRefusal,
} from '@hisabche/validation'
import { decideApproval, mayPostDocument } from './workflow/approval-gate.domain'
import { selectAllPages } from '../utils/fetch-all-pages'
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

const PO_ITEM_COLUMNS =
  'id, purchase_order_id, product_id, variant_id, quantity, unit_price, total_price'
const PO_ITEM_MINIMAL = 'id, product_id, variant_id, quantity, unit_price, total_price'

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
        items:purchase_order_items(id, product_id, variant_id, quantity, unit_price, total_price)
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

    // V55 P2: a line of an order names its variant when the product has them —
    // the same rule an invoice line keeps (the parent alone is never bought:
    // that is how a parent and its variants end up counted twice). Checked
    // before anything is written.
    await this.assertPurchaseVariantBindings(workspaceId, items)
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
      // Named only when the line carries a variant, so documents without one keep working before the migration.
      ...(item.variantId ? { variant_id: item.variantId } : {}),
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: orderLineTotal(item),
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
  async receiveGoods(
    ctx: TenancyContext,
    id: string,
    input?: { lines?: Array<{ itemId: string; quantity: number }> },
  ) {
    const { workspaceId } = ctx

    const { data: order, error } = await supabase
      .from('purchase_orders')
      .select(
        `
        id, status, order_date,
        items:purchase_order_items(id, product_id, variant_id, quantity, received_quantity, unit_price, total_price)
      `,
      )
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch purchase order', error)
    if (!order) throw new NotFoundError('Purchase order')

    const priorStatus = String((order as { status?: unknown }).status ?? '')
    const refusal = priorStatus === 'partially_received' ? null : receiveRefusal(priorStatus)
    if (refusal) throw new ConflictError(refusal)

    const items =
      (
        order as {
          items?: Array<{
            id: string
            product_id: string
            variant_id?: string | null
            quantity: number
            received_quantity?: number | null
            unit_price: number
            total_price: number | null
          }>
        }
      ).items ?? []

    const requestedMap = new Map<string, number>()
    if (input?.lines && input.lines.length > 0) {
      for (const reqLine of input.lines) {
        const item = items.find((i) => i.id === reqLine.itemId)
        if (!item) throw new NotFoundError('Purchase order item')
        const already = Number(item.received_quantity ?? 0)
        if (reqLine.quantity <= 0 || already + reqLine.quantity > Number(item.quantity)) {
          throw new ConflictError('PURCHASE_OVER_RECEIPT_REFUSED')
        }
        requestedMap.set(item.id, (requestedMap.get(item.id) ?? 0) + reqLine.quantity)
      }
    } else {
      for (const item of items) {
        const remaining = Number(item.quantity) - Number(item.received_quantity ?? 0)
        if (remaining > 0) requestedMap.set(item.id, remaining)
      }
    }

    const allFullyReceived = items.every((item) => {
      const nextReceived = Number(item.received_quantity ?? 0) + (requestedMap.get(item.id) ?? 0)
      return nextReceived >= Number(item.quantity)
    })
    const targetStatus = allFullyReceived ? 'received' : 'partially_received'

    const receivedAt = new Date().toISOString()
    const { data: claimed, error: claimError } = await supabase
      .from('purchase_orders')
      .update({
        status: targetStatus,
        ...(allFullyReceived ? { received_at: receivedAt } : {}),
        updated_at: receivedAt,
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .eq('status', priorStatus)
      .select(PO_LIST_COLUMNS)
      .maybeSingle()

    if (claimError)
      throw new DatabaseError('Failed to claim purchase order for receiving', claimError)
    if (!claimed) throw new ConflictError('PURCHASE_ORDER_ALREADY_RECEIVED')

    try {
      await this.moveReceivedGoods(ctx, id, order, requestedMap)
      for (const item of items) {
        const delta = requestedMap.get(item.id) ?? 0
        if (delta > 0) {
          await supabase
            .from('purchase_order_items')
            .update({ received_quantity: Number(item.received_quantity ?? 0) + delta })
            .eq('id', item.id)
            .eq('workspace_id', workspaceId)
        }
      }
    } catch (moveError) {
      await supabase
        .from('purchase_orders')
        .update({ status: priorStatus, received_at: null, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .eq('status', targetStatus)
      throw moveError
    }

    if (allFullyReceived) {
      await budgets.release(ctx, 'purchase_order', id)
    }

    await this.invalidate(workspaceId)
    return claimed
  }

  /** Cost layers + stock movements for a claimed receipt. Only `receiveGoods` calls this. */
  private async moveReceivedGoods(
    ctx: TenancyContext,
    id: string,
    order: object,
    requestedMap?: Map<string, number>,
  ) {
    const { workspaceId, userId } = ctx
    const items = ((order as any).items ?? []) as Array<{
      id: string
      product_id: string
      /** V55 P2: named when the order line bought a variant; absent before the migration. */
      variant_id?: string | null | undefined
      quantity: number
      unit_price: number
      total_price: number | null
    }>

    const entryDate = String((order as any).order_date ?? new Date().toISOString()).slice(0, 10)

    for (const item of items) {
      const quantity = requestedMap ? (requestedMap.get(item.id) ?? 0) : Number(item.quantity) || 0
      if (!item.product_id || quantity <= 0) continue

      const unitCost = receiptUnitCost(item)
      if (unitCost === null) continue

      await costing.recordReceipt(ctx, {
        productId: item.product_id,
        quantity,
        // What was actually paid per unit. The list price would overstate the
        // layer and every profit later drawn from it.
        unitCost,
        entryDate,
        sourceType: 'purchase_order',
        sourceId: id,
        sourceLine: `${item.id}:${entryDate}`,
      })
    }

    if (items.length > 0) {
      const movements = items
        .filter(
          (item) =>
            item.product_id &&
            (requestedMap ? (requestedMap.get(item.id) ?? 0) > 0 : Number(item.quantity) > 0),
        )
        .map((item) => ({
          product_id: item.product_id,
          ...(item.variant_id ? { variant_id: item.variant_id } : {}),
          type: 'purchase',
          quantity: requestedMap ? (requestedMap.get(item.id) ?? 0) : Number(item.quantity) || 0,
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

  // ─── Variant binding (V55 P2) ────────────────────────────────
  /**
   * Every line that names a product is bound to a valid variant, or to none when the product has none
   * (the SAME rule `InvoiceService.assertVariantBindings` keeps for a sale line). One read for all lines.
   * A database without the variants table has no variants to require.
   */
  private async assertPurchaseVariantBindings(
    workspaceId: string,
    lines: Array<{ productId?: string | null | undefined; variantId?: string | null | undefined }>,
  ): Promise<void> {
    const productIds = [
      ...new Set(lines.map((l) => l.productId).filter((id): id is string => !!id)),
    ]
    if (productIds.length === 0) return

    const { data, error } = await supabase
      .from('product_variants')
      .select('id, workspace_id, template_product_id, is_active')
      .eq('workspace_id', workspaceId)
      .in('template_product_id', productIds)
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        // No variants table: nothing can be required — but a line that names a variant cannot be honoured.
        if (lines.some((l) => l.variantId)) throw new ValidationError('VARIANT_NOT_FOUND')
        return
      }
      throw new DatabaseError('Failed to read product variants', error)
    }
    const rows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      workspaceId: String(r.workspace_id),
      templateProductId: String(r.template_product_id),
      isActive: r.is_active !== false,
    }))
    for (const line of lines) {
      if (!line.productId) {
        if (line.variantId) throw new ValidationError('VARIANT_ON_PRODUCT_WITHOUT_VARIANTS')
        continue
      }
      const verdict = checkVariantBinding({
        workspaceId,
        productId: line.productId,
        variantId: line.variantId,
        variantsOfProduct: rows.filter((r) => r.templateProductId === line.productId),
      })
      if (!verdict.ok) throw new ValidationError(verdict.code)
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

  // ─── Slice 10: Pack-rounded draft PO from suggestions ────────
  async createDraftPurchaseOrdersFromSuggestions(
    ctx: TenancyContext,
    input: CreateDraftFromSuggestionsInput,
    options: { idempotencyKey?: string | null | undefined } = {},
  ): Promise<{
    plan: ReorderDraftPlanResult
    orders: Awaited<ReturnType<PurchasingService['createPurchaseOrder']>>[]
  }> {
    const plan = planReordersWithPackRounding(input.suggestions)
    if (!plan.draftPlan.ok) {
      throw new ValidationError(
        `${DRAFT_PURCHASE_LINE_INCOMPLETE}: complete supplier and positive unit price required before drafting`,
      )
    }

    const orders: Awaited<ReturnType<PurchasingService['createPurchaseOrder']>>[] = []
    for (const group of plan.draftPlan.groups) {
      const orderKey = options.idempotencyKey
        ? `${options.idempotencyKey}:${group.supplierId}`
        : undefined
      const created = await this.createPurchaseOrder(
        ctx,
        {
          supplierId: group.supplierId,
          orderDate: new Date().toISOString().slice(0, 10),
          status: 'pending',
          notes: input.notes,
          expectedDeliveryDate: input.expectedDeliveryDate,
          items: group.lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            totalPrice: orderLineTotal({ quantity: l.quantity, unitPrice: l.unitPrice }),
          })),
        },
        orderKey ? { idempotencyKey: orderKey } : {},
      )
      orders.push(created)
    }
    return { plan, orders }
  }

  // ─── Slice 10: Three-way match (PO vs receipt vs invoice) ────
  async evaluateThreeWayMatchForPo(
    ctx: TenancyContext,
    purchaseOrderId: string,
    supplierInvoiceId?: string,
  ) {
    const { workspaceId } = ctx

    const { data: order, error: orderErr } = await supabase
      .from('purchase_orders')
      .select(
        `
        id, status, invoice_id,
        items:purchase_order_items(product_id, variant_id, quantity, unit_price)
      `,
      )
      .eq('id', purchaseOrderId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (orderErr) throw new DatabaseError('Failed to load purchase order for match', orderErr)
    if (!order) throw new NotFoundError('Purchase order')

    const { data: movements, error: mvErr } = await supabase
      .from('stock_movements')
      .select('product_id, variant_id, quantity')
      .eq('workspace_id', workspaceId)
      .eq('reference_type', 'purchase_order')
      .eq('reference_id', purchaseOrderId)
      .eq('type', 'purchase')
    if (mvErr) throw new DatabaseError('Failed to load receipt movements for match', mvErr)

    const targetInvoiceId =
      supplierInvoiceId ?? (order as { invoice_id?: string | null }).invoice_id ?? null

    let linkedInvoice: { id: string } | null = null
    if (targetInvoiceId) {
      const { data: inv, error: invErr } = await supabase
        .from('invoices')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('id', targetInvoiceId)
        .eq('type', 'purchase')
        .maybeSingle()
      if (invErr) throw new DatabaseError('Failed to load linked purchase invoice', invErr)
      linkedInvoice = inv
    } else {
      const { data: inv, error: invErr } = await supabase
        .from('invoices')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('purchase_order_id', purchaseOrderId)
        .eq('type', 'purchase')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (invErr) throw new DatabaseError('Failed to look up purchase invoice for PO', invErr)
      linkedInvoice = inv
    }

    let invoiceLines: Array<{
      productId: string
      variantId: string | null
      quantity: number
      unitPriceMinor: number
    }> = []
    if (linkedInvoice) {
      const { data: invItems, error: itemErr } = await supabase
        .from('invoice_items')
        .select('product_id, variant_id, quantity, unit_price')
        .eq('invoice_id', linkedInvoice.id)
      if (itemErr) throw new DatabaseError('Failed to load purchase invoice items', itemErr)
      invoiceLines = (invItems ?? [])
        .filter((row: { product_id: string | null }) => Boolean(row.product_id))
        .map(
          (row: {
            product_id: string | null
            variant_id?: string | null
            quantity: number
            unit_price: number
          }) => ({
            productId: row.product_id as string,
            variantId: row.variant_id ?? null,
            quantity: Number(row.quantity) || 0,
            unitPriceMinor: Math.round((Number(row.unit_price) || 0) * 100),
          }),
        )
    }

    const poItemsRaw = ((order as { items?: unknown[] }).items ?? []) as Array<{
      product_id: string
      variant_id?: string | null
      quantity: number
      unit_price: number
    }>

    const result = evaluateThreeWayMatch({
      poLines: poItemsRaw.map((i) => ({
        productId: i.product_id,
        variantId: i.variant_id ?? null,
        quantity: Number(i.quantity) || 0,
        unitPriceMinor: Math.round((Number(i.unit_price) || 0) * 100),
      })),
      receiptLines: (movements ?? [])
        .filter((m: { product_id: string | null }) => Boolean(m.product_id))
        .map((m: { product_id: string | null; variant_id?: string | null; quantity: number }) => ({
          productId: m.product_id as string,
          variantId: m.variant_id ?? null,
          quantity: Number(m.quantity) || 0,
        })),
      invoiceLines,
    })

    const approvalOutcome = decideApproval({
      requiresApproval: !result.matched,
      workflowIds: !result.matched ? ['three_way_match_block'] : [],
    })
    const paymentBlocked = !mayPostDocument(approvalOutcome) || !result.mayApprovePayment

    return {
      ...result,
      purchaseOrderId,
      supplierInvoiceId: linkedInvoice?.id ?? null,
      approvalOutcome,
      paymentBlocked,
    }
  }

  // ─── Slice 10: Supplier scorecard ────────────────────────────
  async getSupplierScorecard(ctx: TenancyContext): Promise<SupplierScorecardRow[]> {
    const { workspaceId } = ctx

    const [supRes, ordRes] = await Promise.all([
      selectAllPages<
        { id: string; name: string; is_active?: boolean | null },
        { message: string; code?: string }
      >((from, to) =>
        supabase
          .from('suppliers')
          .select('id, name, is_active')
          .eq('workspace_id', workspaceId)
          .order('name', { ascending: true })
          .range(from, to),
      ),
      selectAllPages<
        {
          id: string
          supplier_id: string | null
          order_date: string
          received_at: string | null
          status: string
          items: Array<{
            product_id?: string | null
            quantity: number
            unit_price: number
            total_price: number | null
          }> | null
        },
        { message: string; code?: string }
      >((from, to) =>
        supabase
          .from('purchase_orders')
          .select(
            'id, supplier_id, order_date, received_at, status, items:purchase_order_items(product_id, quantity, unit_price, total_price)',
          )
          .eq('workspace_id', workspaceId)
          .neq('status', 'cancelled')
          .order('order_date', { ascending: false })
          .range(from, to),
      ),
    ])

    if (supRes.error)
      throw new DatabaseError('Failed to fetch suppliers for scorecard', supRes.error)
    if (ordRes.error)
      throw new DatabaseError('Failed to fetch purchase orders for scorecard', ordRes.error)

    const suppliers = supRes.data ?? []
    const orders = ordRes.data ?? []

    const purchases = orders
      .filter((o) => Boolean(o.supplier_id))
      .map((o) => {
        const listTotalMinor = (o.items ?? []).reduce(
          (sum, item) =>
            sum + Math.round((Number(item.unit_price) || 0) * (Number(item.quantity) || 0) * 100),
          0,
        )
        const billedTotalMinor = (o.items ?? []).reduce(
          (sum, item) =>
            sum +
            Math.round(
              (item.total_price !== null
                ? Number(item.total_price)
                : (Number(item.unit_price) || 0) * (Number(item.quantity) || 0)) * 100,
            ),
          0,
        )
        const qtyTotal = (o.items ?? []).reduce((q, item) => q + (Number(item.quantity) || 0), 0)
        return {
          supplierId: o.supplier_id as string,
          productId: String(o.items?.[0]?.product_id ?? o.id),
          quantity: qtyTotal > 0 ? qtyTotal : 1,
          orderedDate: String(o.order_date).slice(0, 10),
          receivedDate: o.received_at ? String(o.received_at).slice(0, 10) : null,
          amountMinor: billedTotalMinor,
          listPriceMinor: listTotalMinor,
        }
      })

    return buildSupplierScorecard(
      suppliers.map((s) => ({
        supplierId: s.id,
        name: s.name,
        active: s.is_active !== false,
      })),
      purchases,
      new Date().toISOString().slice(0, 10),
    )
  }
}

export default PurchasingService
