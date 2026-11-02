// ============================================
// packages/local-engine/src/routes/invoice-returns.ts
//
// A return made on the device — the SAME document the server makes, recorded and queued.
//
//   · the document is computed by `buildReturnDocument` (@hisabche/validation), the reference the
//     server's SQL is measured against by the golden vectors; this file holds no copy of those rules
//   · header, lines, deductions and the outbox row are written in ONE transaction
//   · NOTHING ELSE MOVES: no stock, no cost layer, no journal entry, no money. The server applies the
//     return when it syncs (stock, cost, ledger — one transaction there too). Until then the return is
//     «pending sync»; a second engine of those rules on the device would be a second source of truth.
//   · `grand_total_minor` is the NET credit (goods − discount + tax − what the shop keeps), as on the server
//   · cash refunds are not here: they stay online (the cap is read under a lock the device cannot hold)
// ============================================

import {
  buildReturnDocument,
  type ReturnCondition,
  type ReturnDeductionRequest,
  type RestockChoice,
  type ReturnReason,
  type ReturnType,
} from '@hisabche/validation'
import { fractionDigits, type KnownCurrency } from '@hisabche/formatting'
import { buildEnqueue } from '@hisabche/app-bridge'
import { requireRole } from '../auth'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { LocalDb } from '../db'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface ReturnRow {
  id: string
  original_invoice_id: string
  return_type: ReturnType
  return_number: string
  return_date: string
  total_subtotal_minor: number
  total_discount_minor: number
  total_tax_minor: number
  grand_total_minor: number
  deduction_minor: number
  reason_code: string | null
  notes: string | null
  sync_state: string
}

interface LineRow {
  id: string
  original_line_id: string
  product_id: string
  quantity: number
  restock_choice: RestockChoice
  reason_code: ReturnReason
  condition_code: ReturnCondition | null
  subtotal_minor: number
  discount_minor: number
  tax_minor: number
  total_minor: number
}

interface DeductionRow {
  reason_code: string
  mode: 'percent' | 'fixed'
  percent: number | null
  amount_minor: number
  note: string | null
}

interface RequestBody {
  id?: string
  clientRequestId?: string
  returnType?: ReturnType
  returnNumber?: string
  returnDate?: string
  reasonCode?: string
  notes?: string
  createdAt?: string
  deductions?: ReturnDeductionRequest[]
  lines?: Array<{
    originalLineId: string
    quantity?: number
    returnQuantity?: number
    restockChoice?: RestockChoice
    reasonCode?: ReturnReason
    conditionCode?: ReturnCondition
  }>
}

/** The codes the reference function throws, and the kind of refusal each one is. */
const CONFLICTS = new Set(['INVOICE_ALREADY_RETURNED', 'RETURN_QUANTITY_EXCEEDS_ORIGINAL'])

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** What the server's list answers for one return, from the rows the device holds. */
function present(db: LocalDb, workspaceId: string, row: ReturnRow) {
  const lines = db.all<LineRow>(
    `SELECT * FROM invoice_return_lines WHERE workspace_id = ? AND return_id = ? AND deleted_at IS NULL`,
    [workspaceId, row.id],
  )
  const deductions = db.all<DeductionRow>(
    `SELECT reason_code, mode, percent, amount_minor, note FROM invoice_return_deductions
      WHERE workspace_id = ? AND return_id = ? AND deleted_at IS NULL`,
    [workspaceId, row.id],
  )
  return {
    id: row.id,
    originalInvoiceId: row.original_invoice_id,
    returnType: row.return_type,
    returnNumber: row.return_number,
    returnDate: row.return_date,
    reasonCode: row.reason_code,
    notes: row.notes,
    totalSubtotalMinor: row.total_subtotal_minor,
    totalDiscountMinor: row.total_discount_minor,
    totalTaxMinor: row.total_tax_minor,
    deductionMinor: row.deduction_minor,
    // what the return CREDITS the customer — the same meaning as on the server
    grandTotalMinor: row.grand_total_minor,
    deductions: deductions.map((entry) => ({
      reason: entry.reason_code,
      mode: entry.mode,
      percent: entry.percent,
      amountMinor: entry.amount_minor,
      note: entry.note ?? '',
    })),
    lines: lines.map((line) => ({
      id: line.id,
      originalLineId: line.original_line_id,
      productId: line.product_id,
      quantity: line.quantity,
      restockChoice: line.restock_choice,
      reasonCode: line.reason_code,
      conditionCode: line.condition_code,
      subtotalMinor: line.subtotal_minor,
      discountMinor: line.discount_minor,
      taxMinor: line.tax_minor,
      totalMinor: line.total_minor,
    })),
    // The server has not applied it yet: stock, cost and the books move when it syncs.
    pendingSync: row.sync_state !== 'synced',
  }
}

export function registerInvoiceReturnsRoutes(router: Router) {
  router.get('/invoices/:id/returns', async (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    requireRole(ctx, 'seller', 'cashier', 'manager', 'owner')
    const rows = db.all<ReturnRow>(
      `SELECT * FROM invoice_returns
        WHERE workspace_id = ? AND original_invoice_id = ? AND deleted_at IS NULL
        ORDER BY return_date DESC, created_at DESC`,
      [ctx.workspaceId, params.id],
    )
    return { __status: 200, __data: rows.map((row) => present(db, ctx.workspaceId, row)) }
  })

  router.post('/invoices/:id/returns', async (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    requireRole(ctx, 'seller', 'cashier', 'manager', 'owner')

    const payload = (body ?? {}) as RequestBody
    const invoiceId = params.id || ''
    if (payload.returnType !== 'sale_return' && payload.returnType !== 'purchase_return') {
      throw new ValidationError('returnType must be sale_return or purchase_return')
    }
    if (!Array.isArray(payload.lines)) throw new ValidationError('RETURN_LINES_REQUIRED')
    const returnNumber = (payload.returnNumber ?? '').trim()
    if (!returnNumber)
      throw new ValidationError('INVALID_RETURN_PARAMETERS: returnNumber is required')

    const invoice = db.all<{ id: string; currency: string | null; tax_total: number }>(
      `SELECT id, currency, tax_total FROM invoice
        WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
      [invoiceId, ctx.workspaceId],
    )[0]
    if (!invoice) throw new NotFoundError('Invoice')

    // The id is the idempotency key: the same request sent twice is the same return.
    const returnId = payload.id || payload.clientRequestId || generateId()
    const already = db.all<ReturnRow>(
      `SELECT * FROM invoice_returns WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
      [returnId, ctx.workspaceId],
    )[0]
    if (already) return { __status: 200, __data: present(db, ctx.workspaceId, already) }

    const items = db.all<{
      id: string
      product_id: string | null
      quantity: number
      unit_price: number
      discount: number
      offering_type?: string | null
    }>(
      `SELECT ii.id, ii.product_id, ii.quantity, ii.unit_price, ii.discount, p.offering_type
         FROM invoice_item ii
         LEFT JOIN product p ON p.id = ii.product_id
        WHERE ii.invoice_id = ? AND ii.workspace_id = ? AND ii.deleted_at IS NULL`,
      [invoiceId, ctx.workspaceId],
    )
    const existing = db.all<{ n: number }>(
      `SELECT COUNT(*) AS n FROM invoice_returns
        WHERE original_invoice_id = ? AND workspace_id = ? AND deleted_at IS NULL`,
      [invoiceId, ctx.workspaceId],
    )[0]!.n

    let document
    try {
      document = buildReturnDocument({
        returnType: payload.returnType,
        sourceLines: items.map((item) => ({
          id: item.id,
          productId: item.product_id,
          offeringType: item.offering_type,
          quantity: Number(item.quantity),
          unitPriceMinor: Number(item.unit_price),
          discountMinor: Number(item.discount),
        })),
        invoiceTaxMinor: Number(invoice.tax_total) || 0,
        priorReturnedByLine: {},
        existingReturnCount: existing,
        lines: payload.lines.map((line) => ({
          originalLineId: line.originalLineId,
          quantity: Number(line.returnQuantity ?? line.quantity ?? 0),
          restockChoice: line.restockChoice ?? 'restock',
          reasonCode: line.reasonCode ?? 'other',
          conditionCode: line.conditionCode,
        })),
        deductions: payload.deductions,
        fractionDigits: invoice.currency
          ? (fractionDigits(invoice.currency as KnownCurrency) ?? 2)
          : 2,
      })
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'INVALID_RETURN_PARAMETERS'
      if (code === 'INVOICE_LINE_NOT_FOUND') throw new NotFoundError('Invoice line')
      if (CONFLICTS.has(code)) throw new ConflictError(code)
      throw new ValidationError(code)
    }

    const now = payload.createdAt || new Date().toISOString()
    const returnDate = payload.returnDate || now.slice(0, 10)
    const reasonCode = payload.reasonCode?.trim() || null
    const notes = payload.notes?.trim() || null
    const queueForServer = c.headers?.['x-hisabche-queue'] === '1'

    // ⚠️ ONE TRANSACTION. A return with no lines, or lines with no header, or a document the server never
    // hears of, is worse than no return.
    db.transaction(() => {
      db.run(
        `INSERT INTO invoice_returns
           (id, workspace_id, original_invoice_id, return_type, return_number, return_date,
            total_subtotal_minor, total_discount_minor, total_tax_minor, grand_total_minor,
            deduction_minor, reason_code, notes, client_request_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          returnId,
          ctx.workspaceId,
          invoiceId,
          payload.returnType,
          returnNumber,
          returnDate,
          document.subtotalMinor,
          document.discountMinor,
          document.taxMinor,
          document.netCreditMinor,
          document.deductionMinor,
          reasonCode,
          notes,
          payload.clientRequestId ?? returnId,
          now,
          now,
        ],
      )

      for (const line of document.lines) {
        db.run(
          `INSERT INTO invoice_return_lines
             (id, workspace_id, return_id, original_line_id, product_id, quantity, restock_choice,
              reason_code, condition_code, subtotal_minor, discount_minor, tax_minor, total_minor,
              created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `${returnId}-line-${line.originalLineId}`,
            ctx.workspaceId,
            returnId,
            line.originalLineId,
            line.productId ?? '',
            line.quantity,
            line.restockChoice,
            line.reasonCode,
            line.conditionCode,
            line.subtotalMinor,
            line.discountMinor,
            line.taxMinor,
            line.totalMinor,
            now,
            now,
          ],
        )
      }

      document.deductions.forEach((deduction, index) => {
        db.run(
          `INSERT INTO invoice_return_deductions
             (id, workspace_id, return_id, reason_code, mode, percent, amount_minor, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `${returnId}-deduction-${index}`,
            ctx.workspaceId,
            returnId,
            deduction.reason,
            deduction.mode,
            deduction.percent,
            deduction.amountMinor,
            deduction.note || null,
            now,
            now,
          ],
        )
      })

      if (queueForServer) {
        const enqueue = buildEnqueue({
          entity: 'invoice_returns',
          operation: 'create',
          clientId: returnId,
          payload: {
            id: returnId,
            originalInvoiceId: invoiceId,
            returnType: payload.returnType,
            returnNumber,
            returnDate,
            reasonCode,
            notes,
            deductions: payload.deductions ?? [],
            lines: payload.lines,
          },
          userId: c.headers?.['x-hisabche-user-id'] ?? ctx.userId,
          workspaceId: ctx.workspaceId,
        })
        db.run(enqueue.sql, enqueue.params)
      }
    })

    const row = db.all<ReturnRow>(
      `SELECT * FROM invoice_returns WHERE id = ? AND workspace_id = ?`,
      [returnId, ctx.workspaceId],
    )[0]!
    return { __status: 201, __data: present(db, ctx.workspaceId, row) }
  })
}
