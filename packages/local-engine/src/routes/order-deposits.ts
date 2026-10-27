// ============================================
// packages/local-engine/src/routes/order-deposits.ts
//
// Local Engine handlers for Order Deposits
// ============================================

import { ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface RowRecord {
  [key: string]: any
}

export function registerOrderDepositsRoutes(router: Router) {
  router.get('/orders/:id/deposits', async (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const orderId = params.id
    const rows = db.all<RowRecord>(
      `SELECT * FROM order_deposits
       WHERE workspace_id = ? AND order_id = ? AND deleted_at IS NULL`,
      [ctx.workspaceId, orderId],
    )

    return {
      status: 200,
      data: rows.map((r: RowRecord) => ({
        id: r.id,
        orderId: r.order_id,
        customerId: r.customer_id,
        amountMinor: r.amount_minor,
        paymentMethod: r.payment_method,
        appliedInvoiceId: r.applied_invoice_id,
      })),
    }
  })

  router.post('/orders/:id/deposits', async (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const orderId = params.id
    const payload = body as any
    if (!payload?.customerId || payload?.amountMinor === undefined) {
      throw new ValidationError('customerId and amountMinor are required')
    }

    const id = payload.id || `dep-${Date.now()}`
    const now = new Date().toISOString()

    db.run(
      `INSERT INTO order_deposits
       (id, workspace_id, order_id, customer_id, amount_minor, payment_method, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        ctx.workspaceId,
        orderId,
        payload.customerId,
        payload.amountMinor,
        payload.paymentMethod || 'cash',
        now,
        now,
      ],
    )

    return {
      status: 201,
      data: {
        id,
        orderId,
        customerId: payload.customerId,
        amountMinor: payload.amountMinor,
        paymentMethod: payload.paymentMethod || 'cash',
      },
    }
  })
}
