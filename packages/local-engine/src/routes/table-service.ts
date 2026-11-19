// ============================================
// packages/local-engine/src/routes/table-service.ts
//
// WP-10 — TABLE SERVICE on the shared sales-order core.
//
// The device seats an order at a table and runs the KDS stages. It never posts
// money or changes stock: the shared sales-order flow still owns the invoice.
// The occupancy rule prevents two open orders holding the same table.
// ============================================

import {
  canMoveTableOrder,
  canSendToKitchen,
  splitTableBill,
  tableIsOccupied,
  type TableOrderStage,
} from '@hisabche/validation'
import { requireCapability } from '../auth'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface TableOrderRow {
  id: string
  workspace_id: string
  table_id: string
  order_id: string | null
  stage: TableOrderStage
  status: string
  total_minor: number
  created_at: string
  updated_at: string
}

function ensureTable(c: RouteHandlerContext): void {
  c.db.run(
    `CREATE TABLE IF NOT EXISTS table_orders (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      table_id TEXT NOT NULL,
      order_id TEXT,
      stage TEXT NOT NULL DEFAULT 'ordered',
      status TEXT NOT NULL DEFAULT 'quoted',
      total_minor INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  )
}

export function registerTableServiceRoutes(router: Router): void {
  router.get('/local-tables/orders', (c: RouteHandlerContext) => {
    ensureTable(c)
    return {
      data: c.db.all<TableOrderRow>(
        `SELECT * FROM table_orders WHERE workspace_id = ? ORDER BY created_at DESC`,
        [c.ctx.workspaceId],
      ),
    }
  })

  router.post('/local-tables/orders', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    ensureTable(c)
    const raw = (c.body || {}) as Record<string, unknown>
    const tableId = typeof raw.tableId === 'string' ? raw.tableId.trim() : ''
    const totalMinor = Number(raw.totalMinor)
    if (!tableId || !Number.isSafeInteger(totalMinor) || totalMinor < 0) {
      throw new ValidationError('TABLE_ORDER_INPUT_INVALID')
    }
    return c.db.transaction(() => {
      const existing = c.db.all<{ table_id: string; status: string }>(
        `SELECT table_id, status FROM table_orders WHERE workspace_id = ? AND table_id = ?`,
        [c.ctx.workspaceId, tableId],
      )
      if (
        tableIsOccupied(
          existing.map((e) => ({ tableId: e.table_id, status: e.status as never })),
          tableId,
        )
      ) {
        throw new ConflictError('TABLE_ALREADY_OCCUPIED')
      }
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      c.db.run(
        `INSERT INTO table_orders (id, workspace_id, table_id, order_id, stage, status, total_minor, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'ordered', 'quoted', ?, ?, ?)`,
        [
          id,
          c.ctx.workspaceId,
          tableId,
          typeof raw.orderId === 'string' ? raw.orderId : null,
          totalMinor,
          now,
          now,
        ],
      )
      return { __status: 201, __data: c.db.get('SELECT * FROM table_orders WHERE id = ?', [id]) }
    })
  })

  // KDS stage move — only the shared transition table decides what is legal.
  router.post('/local-tables/orders/:id/stage', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    ensureTable(c)
    const row = c.db.get<TableOrderRow>(
      `SELECT * FROM table_orders WHERE id = ? AND workspace_id = ?`,
      [c.params.id, c.ctx.workspaceId],
    )
    if (!row) throw new NotFoundError('Table order', c.params.id ?? '')
    const raw = (c.body || {}) as Record<string, unknown>
    const to = String(raw.to ?? '') as TableOrderStage
    if (!canMoveTableOrder(row.stage, to)) throw new ConflictError('TABLE_STAGE_NOT_ALLOWED')
    if (to === 'preparing' && !canSendToKitchen(row.status as never)) {
      throw new ConflictError('ORDER_NOT_CONFIRMED')
    }
    const now = new Date().toISOString()
    c.db.run(
      `UPDATE table_orders SET stage = ?, updated_at = ? WHERE id = ? AND workspace_id = ?`,
      [to, now, row.id, c.ctx.workspaceId],
    )
    return { __status: 200, __data: { id: row.id, stage: to } }
  })

  // Split a bill; the shared rule refuses an invented/uneven split.
  router.post('/local-tables/orders/:id/split', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    ensureTable(c)
    const row = c.db.get<TableOrderRow>(
      `SELECT * FROM table_orders WHERE id = ? AND workspace_id = ?`,
      [c.params.id, c.ctx.workspaceId],
    )
    if (!row) throw new NotFoundError('Table order', c.params.id ?? '')
    const raw = (c.body || {}) as Record<string, unknown>
    const seats = Array.isArray(raw.seatAmountsMinor) ? (raw.seatAmountsMinor as number[]) : []
    const split = splitTableBill(row.total_minor, seats)
    if (split === null) throw new ValidationError('TABLE_SPLIT_INVALID')
    return { totalMinor: row.total_minor, seatAmountsMinor: split }
  })
}
