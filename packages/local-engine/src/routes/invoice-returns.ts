// ============================================
// packages/local-engine/src/routes/invoice-returns.ts
//
// Local Engine handlers for Invoice Returns (Option 18 / Returns)
// ============================================

import {
  calculateReturnDocument,
  toMinorUnits,
  type OriginalInvoiceLine,
  type ReturnLineRequest,
} from '@hisabche/validation'
import { buildEnqueue } from '@hisabche/app-bridge'
import { ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface RowRecord {
  [key: string]: any
}

export function registerInvoiceReturnsRoutes(router: Router) {
  router.get('/invoices/:id/returns', async (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const originalInvoiceId = params.id
    const returns = db.all<RowRecord>(
      `SELECT * FROM invoice_returns
       WHERE workspace_id = ? AND original_invoice_id = ? AND deleted_at IS NULL`,
      [ctx.workspaceId, originalInvoiceId],
    )

    return {
      status: 200,
      data: returns.map((r: RowRecord) => {
        const lines = db.all<RowRecord>(
          `SELECT * FROM invoice_return_lines
           WHERE workspace_id = ? AND return_id = ? AND deleted_at IS NULL`,
          [ctx.workspaceId, r.id],
        )
        return {
          id: r.id,
          originalInvoiceId: r.original_invoice_id,
          returnType: r.return_type,
          returnNumber: r.return_number,
          returnDate: r.return_date,
          totalSubtotalMinor: r.total_subtotal_minor,
          totalDiscountMinor: r.total_discount_minor,
          totalTaxMinor: r.total_tax_minor,
          grandTotalMinor: r.grand_total_minor,
          lines: lines.map((l: RowRecord) => ({
            id: l.id,
            originalLineId: l.original_line_id,
            productId: l.product_id,
            quantity: l.quantity,
            restockChoice: l.restock_choice,
            reasonCode: l.reason_code,
            subtotalMinor: l.subtotal_minor,
            discountMinor: l.discount_minor,
            taxMinor: l.tax_minor,
            totalMinor: l.total_minor,
            restoredCostMinor: l.restored_cost_minor,
          })),
        }
      }),
    }
  })

  router.post('/invoices/:id/returns', async (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const originalInvoiceId = params.id || ''
    const payload = body as any
    if (!payload?.returnType || !payload?.lines || !Array.isArray(payload.lines)) {
      throw new ValidationError('returnType and lines array are required')
    }

    let originalLines: OriginalInvoiceLine[] = payload.originalLines
    if (!originalLines || originalLines.length === 0) {
      const invLines = db.all<RowRecord>(
        `SELECT * FROM invoice_item WHERE invoice_id = ? AND deleted_at IS NULL`,
        [originalInvoiceId],
      )
      originalLines = invLines.map((l: RowRecord) => ({
        lineId: l.id,
        productId: l.product_id,
        quantity: Number(l.quantity),
        unitPriceMinor: toMinorUnits(Number(l.unit_price || 0)),
        subtotalMinor: toMinorUnits(Number(l.total || 0)),
        discountMinor: toMinorUnits(Number(l.discount || 0)),
        taxMinor: toMinorUnits(Number(l.tax || 0)),
        totalMinor: toMinorUnits(Number(l.total || 0)),
      }))
    }

    const calculated = calculateReturnDocument(
      originalInvoiceId,
      payload.returnType,
      originalLines,
      payload.lines as ReturnLineRequest[],
    )

    const returnId = payload.id || `ret-${Date.now()}`
    const now = new Date().toISOString()
    const returnNumber = payload.returnNumber || `RET-${Date.now().toString().slice(-6)}`
    const returnDate = payload.returnDate || now.slice(0, 10)

    db.run(
      `INSERT INTO invoice_returns
       (id, workspace_id, original_invoice_id, return_type, return_number, return_date, total_subtotal_minor, total_discount_minor, total_tax_minor, grand_total_minor, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        returnId,
        ctx.workspaceId,
        originalInvoiceId,
        payload.returnType,
        returnNumber,
        returnDate,
        calculated.totalSubtotalMinor,
        calculated.totalDiscountMinor,
        calculated.totalTaxMinor,
        calculated.grandTotalMinor,
        now,
        now,
      ],
    )

    for (const line of calculated.lines) {
      const lineId = `retl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      db.run(
        `INSERT INTO invoice_return_lines
         (id, workspace_id, return_id, original_line_id, product_id, quantity, restock_choice, reason_code, subtotal_minor, discount_minor, tax_minor, total_minor, restored_cost_minor, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          lineId,
          ctx.workspaceId,
          returnId,
          line.originalLineId,
          line.productId,
          line.returnQuantity,
          line.restockChoice,
          line.reasonCode,
          line.subtotalMinor,
          line.discountMinor,
          line.taxMinor,
          line.totalMinor,
          line.restoredCostTotalMinor ?? null,
          now,
          now,
        ],
      )
    }

    if (c.headers?.['x-hisabche-queue'] === '1') {
      const enqueue = buildEnqueue({
        entity: 'invoice_returns',
        operation: 'create',
        clientId: `${returnId}-sync-${Date.now()}`,
        payload: {
          id: returnId,
          originalInvoiceId,
          returnType: payload.returnType,
          returnNumber,
          returnDate,
          lines: payload.lines,
        },
        userId: c.headers?.['x-hisabche-user-id'] ?? ctx.userId,
        workspaceId: ctx.workspaceId,
      })
      db.run(enqueue.sql, enqueue.params)
    }

    return {
      __status: 201,
      __data: {
        id: returnId,
        originalInvoiceId,
        returnType: payload.returnType,
        returnNumber,
        returnDate,
        totalSubtotalMinor: calculated.totalSubtotalMinor,
        totalDiscountMinor: calculated.totalDiscountMinor,
        totalTaxMinor: calculated.totalTaxMinor,
        grandTotalMinor: calculated.grandTotalMinor,
        lines: calculated.lines,
      },
    }
  })
}
