// ============================================
// packages/local-engine/src/routes/warranties.ts
//
// Local Engine handlers for Warranties (Option 18 / Warranty)
// ============================================

import { calculateWarrantyEndDate } from '@hisabche/validation'
import { ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface RowRecord {
  [key: string]: any
}

export function registerWarrantiesRoutes(router: Router) {
  router.get('/warranties', async (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const rows = db.all<RowRecord>(
      `SELECT * FROM warranties
       WHERE workspace_id = ? AND deleted_at IS NULL`,
      [ctx.workspaceId],
    )

    return {
      status: 200,
      data: rows.map((r: RowRecord) => ({
        id: r.id,
        invoiceId: r.invoice_id,
        productId: r.product_id,
        serialNumber: r.serial_number,
        startDate: r.start_date,
        endDate: r.end_date,
        warrantyMonths: r.warranty_months,
        customerId: r.customer_id,
      })),
    }
  })

  router.post('/warranties', async (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const payload = body as any
    if (
      !payload?.invoiceId ||
      !payload?.productId ||
      !payload?.startDate ||
      !payload?.warrantyMonths
    ) {
      throw new ValidationError('invoiceId, productId, startDate, and warrantyMonths are required')
    }

    const id = payload.id || `war-${Date.now()}`
    const now = new Date().toISOString()
    const endDate = calculateWarrantyEndDate(payload.startDate, payload.warrantyMonths)

    db.run(
      `INSERT INTO warranties
       (id, workspace_id, invoice_id, product_id, serial_number, start_date, end_date, warranty_months, customer_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        ctx.workspaceId,
        payload.invoiceId,
        payload.productId,
        payload.serialNumber || null,
        payload.startDate,
        endDate,
        payload.warrantyMonths,
        payload.customerId || null,
        now,
        now,
      ],
    )

    return {
      status: 201,
      data: {
        id,
        invoiceId: payload.invoiceId,
        productId: payload.productId,
        serialNumber: payload.serialNumber || null,
        startDate: payload.startDate,
        endDate,
        warrantyMonths: payload.warrantyMonths,
        customerId: payload.customerId || null,
      },
    }
  })
}
