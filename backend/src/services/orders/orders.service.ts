// ============================================
// backend/src/services/orders/orders.service.ts
//
// Sales orders — from a website (publishable key), an integration (secret
// key) or the dashboard — and the storefront catalogue they are placed from.
//
// ⚠️ An order moves stock and books revenue ONLY when it is invoiced, and it
// is invoiced through InvoiceService.create — the one path that already
// derives totals from lines, moves stock per warehouse, posts the ledger and
// is idempotent. Nothing here writes an invoice, a movement or a journal.
// ============================================

import type { OrderCreateInput, OrderStatus, StorefrontSettings } from '@hisabche/validation'

import { holds } from '../authorization'
import { CustomerService } from '../customer.service'
import { InvoiceService } from '../invoice.service'
import type { TenancyContext } from '../tenancy.service'
import {
  OrderError,
  invoiceFromOrder,
  invoiceRequestIdFor,
  normalizePhone,
  publicProductView,
  type PublicProduct,
} from './orders.domain'
import { ordersRepository, type OrderWithLines, type OrdersRepository } from './orders.repository'

/** What the customer's own status page shows: no phone, no email, no ids of other things. */
export interface PublicOrderView {
  orderNumber: string
  status: OrderStatus
  total: number
  createdAt: string
  items: Array<{
    name: string
    unit: string | null
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
}

export function toPublicOrder(order: OrderWithLines): PublicOrderView {
  return {
    orderNumber: order.order_number,
    status: order.status,
    total: Number(order.total),
    createdAt: order.created_at,
    items: order.items.map((line) => ({
      name: line.product_name,
      unit: line.unit,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unit_price),
      lineTotal: Number(line.line_total),
    })),
  }
}

export interface InvoiceCreator {
  create: InvoiceService['create']
}
export interface CustomerCreator {
  create: CustomerService['create']
}

export function createOrdersService(
  repo: OrdersRepository = ordersRepository,
  invoices: InvoiceCreator = new InvoiceService(),
  customers: CustomerCreator = new CustomerService(),
) {
  async function mustGet(ctx: TenancyContext, id: string): Promise<OrderWithLines> {
    const order = await repo.get(ctx.workspaceId, id)
    if (!order) throw new OrderError('ORDER_NOT_FOUND')
    return order
  }

  async function place(input: {
    workspaceId: string
    source: 'website' | 'api' | 'dashboard'
    apiKeyId: string | null
    idempotencyKey: string | null
    order: OrderCreateInput
    createdBy: string | null
  }) {
    const created = await repo.create({
      workspaceId: input.workspaceId,
      source: input.source,
      apiKeyId: input.apiKeyId,
      idempotencyKey: input.idempotencyKey,
      customer: {
        name: input.order.customer.name,
        phone: normalizePhone(input.order.customer.phone),
        ...(input.order.customer.email ? { email: input.order.customer.email } : {}),
        ...(input.order.customer.note ? { note: input.order.customer.note } : {}),
      },
      items: input.order.items,
      createdBy: input.createdBy,
    })
    const order = await repo.get(input.workspaceId, created.orderId)
    if (!order) throw new OrderError('ORDER_NOT_FOUND')
    return { order, replay: created.replay }
  }

  return {
    // ─── placing ─────────────────────────────────────────────────────────────

    /** From a website. The workspace and key come from the publishable key, never the body. */
    placeFromWebsite(
      key: { id: string; workspaceId: string },
      idempotencyKey: string,
      order: OrderCreateInput,
    ) {
      return place({
        workspaceId: key.workspaceId,
        source: 'website',
        apiKeyId: key.id,
        idempotencyKey,
        order,
        createdBy: null,
      })
    },

    /** From an integration (secret key) or the dashboard. */
    placeFromMember(
      ctx: TenancyContext,
      via: { apiKeyId: string | null },
      idempotencyKey: string | null,
      order: OrderCreateInput,
    ) {
      return place({
        workspaceId: ctx.workspaceId,
        source: via.apiKeyId ? 'api' : 'dashboard',
        apiKeyId: via.apiKeyId,
        idempotencyKey,
        order,
        createdBy: ctx.userId,
      })
    },

    // ─── reading ─────────────────────────────────────────────────────────────

    async list(
      ctx: TenancyContext,
      filter: { status?: OrderStatus | undefined; limit: number; offset: number },
    ) {
      return repo.list(ctx.workspaceId, filter)
    },

    get: mustGet,

    /** The customer's view of an order — only within the workspace that asks. */
    async publicStatus(token: string, workspaceId: string): Promise<PublicOrderView | null> {
      const order = await repo.getByToken(token)
      return order && order.workspace_id === workspaceId ? toPublicOrder(order) : null
    },

    // ─── the lifecycle ───────────────────────────────────────────────────────

    async confirm(ctx: TenancyContext, id: string) {
      await repo.transition(ctx.workspaceId, id, 'confirmed')
      return mustGet(ctx, id)
    },

    async cancel(ctx: TenancyContext, id: string, reason: string | null) {
      await repo.transition(ctx.workspaceId, id, 'cancelled', { reason })
      return mustGet(ctx, id)
    },

    async fulfill(ctx: TenancyContext, id: string) {
      await repo.transition(ctx.workspaceId, id, 'fulfilled')
      return mustGet(ctx, id)
    },

    /**
     * Confirmed → invoiced, through the invoice path. Idempotent end to end:
     * the invoice carries the order's request id, so a retry after a failure
     * between the two steps finds the invoice it already made.
     */
    async invoice(
      ctx: TenancyContext,
      id: string,
      options: { customerId?: string | undefined } = {},
    ) {
      const order = await mustGet(ctx, id)
      if (order.status !== 'confirmed') throw new OrderError('ORDER_TRANSITION_INVALID')

      let customerId = options.customerId ?? order.customer_id
      if (!customerId) {
        const matches = await repo.customersByPhone(ctx.workspaceId, order.customer_phone)
        // Two customers with this phone: a person chooses. Guessing would
        // put a debt on the wrong person's account.
        if (matches.length > 1) throw new OrderError('ORDER_CUSTOMER_AMBIGUOUS')
        if (matches.length === 1) customerId = matches[0]!
        else {
          if (!holds(ctx, 'customer.write')) throw new OrderError('ORDER_CUSTOMER_REQUIRED')
          const created = await customers.create(
            ctx,
            {
              fullName: order.customer_name,
              phone: order.customer_phone,
              email: order.customer_email ?? '',
              notes: order.order_number,
              openingBalance: 0,
              isActive: true,
              type: 'credit',
            },
            { clientRequestId: `order-customer-${order.id}` },
          )
          customerId = created.id
        }
      }

      const invoice = await invoices.create(
        ctx,
        invoiceFromOrder({
          lines: order.items,
          customerId,
          date: new Date().toISOString().slice(0, 10),
          orderNumber: order.order_number,
        }),
        null,
        { clientRequestId: invoiceRequestIdFor(order.id) },
      )
      const invoiceId = (invoice as { id?: string }).id
      if (!invoiceId) throw new Error('invoice created without an id')

      await repo.transition(ctx.workspaceId, id, 'invoiced', { invoiceId, customerId })
      return mustGet(ctx, id)
    },

    // ─── storefront ──────────────────────────────────────────────────────────

    settings(workspaceId: string): Promise<StorefrontSettings> {
      return repo.settings(workspaceId)
    },

    async saveSettings(ctx: TenancyContext, settings: StorefrontSettings) {
      await repo.saveSettings(ctx.workspaceId, settings)
      return repo.settings(ctx.workspaceId)
    },

    async catalog(
      workspaceId: string,
      filter: { search?: string | undefined; limit: number; offset: number },
    ): Promise<{ products: PublicProduct[]; hasMore: boolean }> {
      const [settings, page] = await Promise.all([
        repo.settings(workspaceId),
        repo.catalog(workspaceId, filter),
      ])
      return {
        products: page.rows.map((row) => publicProductView(row, settings.stockDisplay)),
        hasMore: page.hasMore,
      }
    },

    async catalogProduct(workspaceId: string, id: string): Promise<PublicProduct | null> {
      const [settings, row] = await Promise.all([
        repo.settings(workspaceId),
        repo.catalogProduct(workspaceId, id),
      ])
      return row ? publicProductView(row, settings.stockDisplay) : null
    },

    expirePending(): Promise<number> {
      return repo.expirePending()
    },
  }
}

export const ordersService = createOrdersService()
export type OrdersService = ReturnType<typeof createOrdersService>
