// ============================================
// packages/local-engine/src/routes/costing.ts
//
// Inventory costing on the device: the settings, stock with no cost behind it,
// and the cost a sale is given after it was posted.
//
// ⚠️ NOT A SECOND COSTING RULE. What is "unvalued" is `findUnvaluedStock`; how
// many sold units still need a layer is `uncoveredSoldUnits`; which layer a
// sale draws from is `planConsumption` (via cost-layers.ts); the key of the late
// entry is `lateCostKeyFromDigest`. All are the functions the server's
// CostingService / InvoiceService call.
//
// Unknown stays unknown: a product with no purchase price is REPORTED as
// blocked and never valued at zero; a sale that cannot be covered stays
// "still_uncosted".
// ============================================

import {
  findUnvaluedStock,
  inventorySettingsInputSchema,
  lateCostKeyFromDigest,
  round2,
  uncoveredSoldUnits,
  type StockPosition,
} from '@hisabche/validation'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'
import { NotFoundError, ValidationError } from '../errors'
import type { LocalDb } from '../db'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'
import { costingMethodOf, drawFromLayers, receiveLayer } from './cost-layers'
import { ensureDefaultAccounts } from './invoices'

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const today = () => new Date().toISOString().slice(0, 10)

/** An action's reply is 200 (the engine answers a bare POST 201). */
function answered<T>(data: T): { __status: 200; __data: T } {
  return { __status: 200, __data: data }
}

/** The same derivation as the server's `lateCostKey`; only the hash library differs. */
function lateCostKey(invoiceId: string): string {
  return lateCostKeyFromDigest(bytesToHex(sha256(utf8ToBytes(`late-cost:${invoiceId}`))))
}

function settingsOf(db: LocalDb, workspaceId: string) {
  const row = db.get<{ costing_method: string; negative_stock: string }>(
    'SELECT costing_method, negative_stock FROM inventory_settings WHERE workspace_id = ?',
    [workspaceId],
  )
  // A business that never chose gets FIFO and refuses to sell what it does not have.
  return {
    costingMethod: (row?.costing_method as 'fifo' | 'avco' | 'standard') ?? 'fifo',
    negativeStock: (row?.negative_stock as 'block' | 'allow') ?? 'block',
  }
}

/** Products on the shelf beside the units still open in their cost layers. */
function stockPositions(db: LocalDb, workspaceId: string): StockPosition[] {
  return db
    .all<{
      id: string
      name: string
      quantity: number
      buy_price: number
      layered: number | null
    }>(
      `SELECT p.id, p.name, p.quantity, p.buy_price,
              (SELECT sum(remaining_qty) FROM cost_layer cl
                WHERE cl.workspace_id = p.workspace_id AND cl.product_id = p.id
                  AND cl.remaining_qty > 0 AND cl.deleted_at IS NULL) AS layered
         FROM product p
        WHERE p.workspace_id = ? AND p.deleted_at IS NULL AND p.quantity > 0
        ORDER BY p.id`,
      [workspaceId],
    )
    .map((row) => ({
      productId: row.id,
      name: String(row.name ?? ''),
      quantity: Number(row.quantity) || 0,
      buyPrice: Number(row.buy_price) || 0,
      layeredQuantity: Number(row.layered) || 0,
    }))
}

export function registerCostingRoutes(router: Router): void {
  // ─── GET/PUT /inventory/settings ────────────────────────────
  router.get('/inventory/settings', (c: RouteHandlerContext) => settingsOf(c.db, c.ctx.workspaceId))

  router.put('/inventory/settings', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const parsed = inventorySettingsInputSchema.safeParse(body ?? {})
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '))
    }
    const current = settingsOf(db, ctx.workspaceId)
    // An omitted field keeps the stored value; an explicit undefined never overwrites it.
    const next = {
      costingMethod: parsed.data.costingMethod ?? current.costingMethod,
      negativeStock: parsed.data.negativeStock ?? current.negativeStock,
    }
    db.run(
      `INSERT INTO inventory_settings (workspace_id, costing_method, negative_stock, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(workspace_id) DO UPDATE SET
         costing_method = excluded.costing_method,
         negative_stock = excluded.negative_stock,
         updated_at = excluded.updated_at`,
      [ctx.workspaceId, next.costingMethod, next.negativeStock, new Date().toISOString()],
    )
    return next
  })

  // ─── GET /inventory/unvalued ────────────────────────────────
  router.get('/inventory/unvalued', (c: RouteHandlerContext) =>
    findUnvaluedStock(stockPositions(c.db, c.ctx.workspaceId)),
  )

  // ─── POST /inventory/unvalued/value ─────────────────────────
  // An ACT, done by a person who has seen the list: each ready product gets a
  // cost layer at its own purchase price. Products without one are left alone
  // and reported back.
  router.post('/inventory/unvalued/value', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    return db.transaction(() => {
      const found = findUnvaluedStock(stockPositions(db, ctx.workspaceId))
      const day = today()
      const now = new Date().toISOString()
      let valued = 0
      let quantity = 0
      let value = 0
      for (const row of found.rows) {
        if (row.status !== 'ready' || row.unitCost === null) continue
        receiveLayer(db, {
          workspaceId: ctx.workspaceId,
          productId: row.productId,
          warehouseId: null,
          quantity: row.quantity,
          unitCost: row.unitCost,
          currency: ctx.baseCurrency,
          entryDate: day,
          sourceType: 'opening',
          sourceId: row.productId,
          // The gap is part of the key: the same gap valued twice is one layer.
          sourceLine: `unvalued:${day}:${row.quantity}`,
          now,
        })
        valued += 1
        quantity += row.quantity
        value += row.value ?? 0
      }
      return answered({ valued, quantity, value: round2(value), blocked: found.blocked })
    })
  })

  // ─── POST /invoices/:id/cost ────────────────────────────────
  // Give a sale booked with no cost of goods its cost, from the layers its stock
  // has now. Idempotent: what is posted is the difference between what the layers
  // hold and what the ledger already holds for this sale.
  router.post('/invoices/:id/cost', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const id = params.id ?? ''
    const none = { cost: 0, posted: 0, unposted: 0, uncostedProducts: [] as string[] }

    const invoice = db.get<{
      id: string
      type: string
      status: string
      date: string
      invoice_number: string | null
    }>(
      'SELECT id, type, status, date, invoice_number FROM invoice WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, ctx.workspaceId],
    )
    if (!invoice) throw new NotFoundError('Invoice', id)
    if (invoice.type !== 'sale' || invoice.status === 'cancelled') {
      return answered({ status: 'not_postable', ...none })
    }

    return db.transaction(() => {
      const items = db.all<{ id: string; product_id: string | null; quantity: number }>(
        `SELECT id, product_id, quantity FROM invoice_item
          WHERE invoice_id = ? AND workspace_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
        [id, ctx.workspaceId],
      )
      const entryDate = String(invoice.date || today()).slice(0, 10)
      const now = new Date().toISOString()
      const method = costingMethodOf(db, ctx.workspaceId)

      const drawn = new Set(
        db
          .all<{ consumer_line: string | null }>(
            `SELECT consumer_line FROM cost_consumption
              WHERE workspace_id = ? AND consumer_type = 'invoice' AND consumer_id = ? AND deleted_at IS NULL`,
            [ctx.workspaceId, id],
          )
          .map((row) => String(row.consumer_line ?? '')),
      )

      // ⚠️ THE UNITS THIS SALE TOOK ARE GONE. The layers open today belong to the
      // stock still on the shelf; drawing an old sale from them would leave that
      // stock without a cost. So each line that never drew its cost is first
      // COVERED — by layers the shelf does not need, or by a layer of its own at
      // the product's purchase price — and only a covered line is issued.
      const uncosted: string[] = []
      const toIssue: Array<{ line: string; productId: string; quantity: number }> = []
      for (const item of items) {
        if (!item.product_id || !(Number(item.quantity) > 0)) continue
        if (drawn.has(item.id)) continue
        const position = stockPositions(db, ctx.workspaceId).find(
          (row) => row.productId === item.product_id,
        ) ?? {
          // Not on the shelf (quantity 0) — still needs its units covered.
          productId: item.product_id,
          name: '',
          quantity: 0,
          buyPrice:
            Number(
              db.get<{ buy_price: number }>(
                'SELECT buy_price FROM product WHERE id = ? AND workspace_id = ?',
                [item.product_id, ctx.workspaceId],
              )?.buy_price,
            ) || 0,
          layeredQuantity:
            Number(
              db.get<{ q: number | null }>(
                `SELECT sum(remaining_qty) AS q FROM cost_layer
                WHERE workspace_id = ? AND product_id = ? AND remaining_qty > 0 AND deleted_at IS NULL`,
                [ctx.workspaceId, item.product_id],
              )?.q,
            ) || 0,
        }
        const short = uncoveredSoldUnits(position, Number(item.quantity))
        let covered = short <= 0
        if (!covered && position.buyPrice > 0) {
          receiveLayer(db, {
            workspaceId: ctx.workspaceId,
            productId: item.product_id,
            warehouseId: null,
            quantity: short,
            unitCost: position.buyPrice,
            currency: ctx.baseCurrency,
            entryDate,
            sourceType: 'opening',
            sourceId: item.product_id,
            sourceLine: `sale:${id}:${item.id}`,
            now,
          })
          covered = true
        }
        if (covered) {
          toIssue.push({
            line: item.id,
            productId: item.product_id,
            quantity: Number(item.quantity),
          })
        } else {
          uncosted.push(item.product_id)
        }
      }

      for (const line of toIssue) {
        drawFromLayers(db, {
          workspaceId: ctx.workspaceId,
          productId: line.productId,
          quantity: line.quantity,
          invoiceId: id,
          invoiceLine: line.line,
          entryDate,
          currency: ctx.baseCurrency,
          method,
          warehouseId: null,
          now,
        })
      }

      const cost = round2(
        db
          .all<{ quantity: number; unit_cost: number }>(
            `SELECT quantity, unit_cost FROM cost_consumption
              WHERE workspace_id = ? AND consumer_type = 'invoice' AND consumer_id = ? AND deleted_at IS NULL`,
            [ctx.workspaceId, id],
          )
          .reduce(
            (sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.unit_cost) || 0),
            0,
          ),
      )
      const uncostedProducts = [...new Set(uncosted)]

      const accounts = ensureDefaultAccounts(db, ctx.workspaceId)
      const cogs = accounts.cogs
      const inventory = accounts.inventory
      if (!cogs || !inventory) {
        return answered({
          status: 'ledger_incomplete',
          cost,
          posted: 0,
          unposted: cost,
          uncostedProducts,
        })
      }

      const key = lateCostKey(id)
      const held = round2(
        Number(
          db.get<{ net: number | null }>(
            `SELECT sum(jl.debit - jl.credit) AS net
               FROM journal_line jl
               JOIN journal_entry je ON je.id = jl.journal_id
              WHERE jl.workspace_id = ? AND jl.account_id = ? AND jl.deleted_at IS NULL
                AND je.status = 'posted' AND je.deleted_at IS NULL
                AND ((je.source_type = 'invoice' AND je.source_id = ?)
                  OR (je.source_type = 'cost_repost' AND je.source_id = ?))`,
            [ctx.workspaceId, cogs, id, key],
          )?.net,
        ) || 0,
      )
      const owed = round2(cost - held)
      if (owed <= 0) {
        return answered({
          status: uncostedProducts.length > 0 ? 'still_uncosted' : 'nothing_to_cost',
          cost,
          posted: 0,
          unposted: 0,
          uncostedProducts,
        })
      }

      const lock = db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', [
        'period_lock',
      ])
      if (lock?.value && entryDate <= lock.value) {
        return answered({
          status: 'ledger_incomplete',
          cost,
          posted: 0,
          unposted: owed,
          uncostedProducts,
        })
      }

      const number = invoice.invoice_number ?? id.slice(0, 8)
      const journalId = generateUuid()
      db.run(
        `INSERT INTO journal_entry (
          id, workspace_id, entry_number, date, description, reference, status,
          source_type, source_id, posted_at, created_at, updated_at, origin, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, 'posted', 'cost_repost', ?, ?, ?, ?, 'local', 'local_only')`,
        [
          journalId,
          ctx.workspaceId,
          `J-${entryDate.slice(0, 4)}-${number}-COST`,
          entryDate,
          `بهای تمام‌شده‌ی فاکتور فروش ${number}`,
          id,
          key,
          now,
          now,
          now,
        ],
      )
      for (const line of [
        { accountId: cogs, debit: owed, credit: 0 },
        { accountId: inventory, debit: 0, credit: owed },
      ]) {
        db.run(
          `INSERT INTO journal_line (
            id, workspace_id, journal_id, account_id, debit, credit, description,
            created_at, updated_at, origin, sync_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
          [
            generateUuid(),
            ctx.workspaceId,
            journalId,
            line.accountId,
            line.debit,
            line.credit,
            `بهای تمام‌شده‌ی فاکتور ${number}`,
            now,
            now,
          ],
        )
      }

      return answered({
        status: uncostedProducts.length > 0 ? 'still_uncosted' : 'costed',
        cost,
        posted: owed,
        unposted: 0,
        uncostedProducts,
      })
    })
  })
}
