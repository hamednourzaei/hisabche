// ============================================
// packages/local-engine/src/routes/sales-orders.ts
//
// WP-13 gap A — OFFLINE SALES-ORDER DRAFTS.
//
// A draft is NOT a committed sale: no stock moves, no money posts, no invoice
// is created here. It exists so a rep can write an order without signal. The
// server still owns price and availability — the existing `/orders` flow
// confirms those when the rep submits the draft.
//
// ⚠️ NO SECOND STATUS MACHINE. Transitions reuse `isValidSalesOrderTransition`
// from @hisabche/validation, the same table the server order service uses.
// ============================================

import {
  draftLineTotalMinor,
  draftTotalMinor,
  isValidSalesOrderTransition,
  type OrderStatus,
} from '@hisabche/validation'
import { requireCapability } from '../auth'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface DraftRow {
  id: string
  workspace_id: string
  order_number: string | null
  customer_id: string | null
  customer_name: string | null
  status: string
  currency: string
  notes: string | null
  total_minor: number
  client_request_id: string | null
  submitted_at: string | null
  server_confirmed_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface DraftItemRow {
  id: string
  workspace_id: string
  order_id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit: string | null
  unit_price_minor: number
  total_minor: number
  sort_order: number
}

// Only an UNSUBMITTED draft may be edited. Once it is pending the server owns it.
const DRAFT_STATUSES: readonly OrderStatus[] = ['quoted']
const CANCELLED: OrderStatus = 'cancelled'

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function randomUuid(): string {
  return crypto.randomUUID()
}

function getDraft(
  db: RouteHandlerContext['db'],
  ctx: RouteHandlerContext['ctx'],
  id: string,
): DraftRow {
  const row = db.get<DraftRow>(
    `SELECT * FROM sales_order_drafts WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, ctx.workspaceId],
  )
  if (!row) throw new NotFoundError('Sales order draft', id)
  return row
}

function itemsOf(db: RouteHandlerContext['db'], ctx: RouteHandlerContext['ctx'], orderId: string) {
  return db.all<DraftItemRow>(
    `SELECT * FROM sales_order_draft_items WHERE order_id = ? AND workspace_id = ? ORDER BY sort_order ASC, created_at ASC`,
    [orderId, ctx.workspaceId],
  )
}

interface IncomingLine {
  productId?: unknown
  productName?: unknown
  quantity?: unknown
  unit?: unknown
  unitPriceMinor?: unknown
}

function parseLines(body: Record<string, unknown>): IncomingLine[] {
  const raw = body.lines
  if (!Array.isArray(raw) || raw.length === 0) throw new ValidationError('ORDER_LINES_REQUIRED')
  if (raw.length > 200) throw new ValidationError('ORDER_LINES_TOO_MANY')
  return raw as IncomingLine[]
}

function lineValues(line: IncomingLine, index: number) {
  const productName = trim(line.productName)
  const quantity = Number(line.quantity)
  const unitPriceMinor = Number(line.unitPriceMinor)
  if (!productName) throw new ValidationError(`ORDER_LINE_NAME_REQUIRED:${index}`)
  if (!Number.isFinite(quantity) || quantity <= 0)
    throw new ValidationError(`ORDER_QUANTITY_INVALID:${index}`)
  if (!Number.isSafeInteger(unitPriceMinor) || unitPriceMinor < 0) {
    throw new ValidationError(`ORDER_PRICE_INVALID:${index}`)
  }
  const totalMinor = draftLineTotalMinor(quantity, unitPriceMinor)
  if (totalMinor === null) throw new ValidationError(`ORDER_LINE_TOTAL_INVALID:${index}`)
  return {
    productId: trim(line.productId) || null,
    productName,
    quantity,
    unit: trim(line.unit) || null,
    unitPriceMinor,
    totalMinor,
    sortOrder: index,
  }
}

function writeLines(
  c: RouteHandlerContext,
  orderId: string,
  lines: ReturnType<typeof lineValues>[],
  now: string,
): void {
  c.db.run('DELETE FROM sales_order_draft_items WHERE order_id = ? AND workspace_id = ?', [
    orderId,
    c.ctx.workspaceId,
  ])
  for (const line of lines) {
    c.db.run(
      `INSERT INTO sales_order_draft_items
         (id, workspace_id, order_id, product_id, product_name, quantity, unit,
          unit_price_minor, total_minor, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUuid(),
        c.ctx.workspaceId,
        orderId,
        line.productId,
        line.productName,
        line.quantity,
        line.unit,
        line.unitPriceMinor,
        line.totalMinor,
        line.sortOrder,
        now,
        now,
      ],
    )
  }
}

export function registerSalesOrderRoutes(router: Router): void {
  // ─── List drafts ─────────────────────────────────────────────────
  router.get('/orders/drafts', (c: RouteHandlerContext) => {
    const rows = c.db.all<DraftRow>(
      `SELECT * FROM sales_order_drafts
       WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
      [c.ctx.workspaceId],
    )
    return { data: rows }
  })

  // ─── Read one draft with its lines ───────────────────────────────
  router.get('/orders/drafts/:id', (c: RouteHandlerContext) => {
    const draft = getDraft(c.db, c.ctx, c.params.id ?? '')
    return { ...draft, lines: itemsOf(c.db, c.ctx, draft.id) }
  })

  // ─── Create a draft (idempotent by Idempotency-Key or id) ────────
  router.post('/orders/drafts', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const body = (c.body || {}) as Record<string, unknown>
    const currency = trim(body.currency)
    if (!currency) throw new ValidationError('DRAFT_CURRENCY_REQUIRED')

    const lines = parseLines(body).map(lineValues)
    const totalMinor = draftTotalMinor(lines.map((line) => line.totalMinor))
    if (totalMinor === null) throw new ValidationError('ORDER_TOTAL_INVALID')
    const clientRequestId = trim(c.headers?.['idempotency-key']) || trim(body.id)
    const now = new Date().toISOString()

    return c.db.transaction(() => {
      if (clientRequestId) {
        const existing = c.db.get<DraftRow>(
          `SELECT * FROM sales_order_drafts WHERE workspace_id = ? AND client_request_id = ?`,
          [c.ctx.workspaceId, clientRequestId],
        )
        if (existing) return { __status: 200, __data: existing }
      }

      const id = trim(body.id) || randomUuid()
      if (c.db.get<{ id: string }>('SELECT id FROM sales_order_drafts WHERE id = ?', [id])) {
        throw new ConflictError('SALES_ORDER_DRAFT_ID_CONFLICT')
      }
      c.db.run(
        `INSERT INTO sales_order_drafts
           (id, workspace_id, order_number, customer_id, customer_name, status, currency,
            notes, total_minor, client_request_id, created_at, updated_at, origin, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
        [
          id,
          c.ctx.workspaceId,
          trim(body.orderNumber) || null,
          trim(body.customerId) || null,
          trim(body.customerName) || null,
          'quoted',
          currency.toUpperCase(),
          trim(body.notes) || null,
          totalMinor,
          clientRequestId || null,
          now,
          now,
        ],
      )
      writeLines(c, id, lines, now)
      return getDraft(c.db, c.ctx, id)
    })
  })

  // ─── Edit a draft while it is still a draft ──────────────────────
  router.patch('/orders/drafts/:id', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const draft = getDraft(c.db, c.ctx, c.params.id ?? '')
    if (!DRAFT_STATUSES.includes(draft.status as OrderStatus)) {
      throw new ConflictError('DRAFT_NOT_EDITABLE')
    }
    const body = (c.body || {}) as Record<string, unknown>
    const lines = body.lines === undefined ? null : parseLines(body).map(lineValues)
    const computedTotal = lines ? draftTotalMinor(lines.map((line) => line.totalMinor)) : null
    if (lines && computedTotal === null) throw new ValidationError('ORDER_TOTAL_INVALID')
    const totalMinor = computedTotal ?? draft.total_minor
    const now = new Date().toISOString()

    return c.db.transaction(() => {
      c.db.run(
        `UPDATE sales_order_drafts SET
           customer_id = ?, customer_name = ?, notes = ?, total_minor = ?, updated_at = ?
         WHERE id = ? AND workspace_id = ?`,
        [
          body.customerId === undefined ? draft.customer_id : trim(body.customerId) || null,
          body.customerName === undefined ? draft.customer_name : trim(body.customerName) || null,
          body.notes === undefined ? draft.notes : trim(body.notes) || null,
          totalMinor,
          now,
          draft.id,
          c.ctx.workspaceId,
        ],
      )
      if (lines) writeLines(c, draft.id, lines, now)
      return { ...getDraft(c.db, c.ctx, draft.id), lines: itemsOf(c.db, c.ctx, draft.id) }
    })
  })

  // ─── Submit: pending server confirmation (still no money moved) ──
  router.post('/orders/drafts/:id/submit', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const draft = getDraft(c.db, c.ctx, c.params.id ?? '')
    if (!isValidSalesOrderTransition(draft.status as OrderStatus, 'pending')) {
      throw new ConflictError('DRAFT_TRANSITION_NOT_ALLOWED')
    }
    const now = new Date().toISOString()
    c.db.run(
      `UPDATE sales_order_drafts SET status = 'pending', submitted_at = ?, updated_at = ?
       WHERE id = ? AND workspace_id = ?`,
      [now, now, draft.id, c.ctx.workspaceId],
    )
    return {
      __status: 200,
      __data: { ...getDraft(c.db, c.ctx, draft.id), lines: itemsOf(c.db, c.ctx, draft.id) },
    }
  })

  // ─── Cancel a draft ──────────────────────────────────────────────
  router.post('/orders/drafts/:id/cancel', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const draft = getDraft(c.db, c.ctx, c.params.id ?? '')
    if (!isValidSalesOrderTransition(draft.status as OrderStatus, CANCELLED)) {
      throw new ConflictError('DRAFT_TRANSITION_NOT_ALLOWED')
    }
    const now = new Date().toISOString()
    c.db.run(
      `UPDATE sales_order_drafts SET status = 'cancelled', updated_at = ?
       WHERE id = ? AND workspace_id = ?`,
      [now, draft.id, c.ctx.workspaceId],
    )
    return getDraft(c.db, c.ctx, draft.id)
  })
}
