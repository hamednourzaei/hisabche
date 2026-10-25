// ============================================
// packages/local-engine/src/routes/cost-layers.ts
//
// The device's way of drawing a sale's units from the cost layers.
//
// ⚠️ NOT A SECOND COSTING RULE. `planConsumption` (@hisabche/validation) decides
// WHICH layers and at WHAT cost, for FIFO and average cost alike — the function
// the server's `inventory_consume_layers` mirrors. This file only reads the open
// layers, hands them over and writes what the plan says. The sale on the till
// and a sale given its cost afterwards both come through here.
// ============================================

import { planConsumption, type CostingMethod } from '@hisabche/validation'
import type { LocalDb } from '../db'

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

/** The workspace's costing method; a business that never chose gets FIFO. */
export function costingMethodOf(db: LocalDb, workspaceId: string): CostingMethod {
  const row = db.get<{ costing_method: string }>(
    'SELECT costing_method FROM inventory_settings WHERE workspace_id = ?',
    [workspaceId],
  )
  return (row?.costing_method as CostingMethod) || 'fifo'
}

/**
 * Draw `quantity` units of a product from its open layers for one invoice line.
 * Returns the cost the layers hold for them and the units no layer covered
 * (a shortfall has NO consumption row: its cost is unknown, not zero).
 */
export function drawFromLayers(
  db: LocalDb,
  input: {
    workspaceId: string
    productId: string
    quantity: number
    invoiceId: string
    invoiceLine: string
    entryDate: string
    currency: string
    method: CostingMethod
    /** Recorded on the consumption row only; layers of every warehouse are open to the draw. */
    warehouseId: string | null
    now: string
  },
): { totalCost: number; shortfall: number } {
  const layers = db.all<{
    id: string
    product_id: string
    warehouse_id: string | null
    remaining_qty: number
    unit_cost: number
    entry_date: string
    created_at: string
  }>(
    `SELECT id, product_id, warehouse_id, remaining_qty, unit_cost, entry_date, created_at
       FROM cost_layer
      WHERE workspace_id = ? AND product_id = ? AND remaining_qty > 0 AND deleted_at IS NULL
      ORDER BY entry_date ASC, created_at ASC`,
    [input.workspaceId, input.productId],
  )

  const plan = planConsumption(
    layers.map((l) => ({
      id: l.id,
      productId: l.product_id,
      warehouseId: l.warehouse_id,
      remainingQty: Number(l.remaining_qty),
      unitCost: l.unit_cost,
      entryDate: l.entry_date,
      createdAt: l.created_at,
    })),
    input.quantity,
    { method: input.method },
  )

  for (const step of plan.steps) {
    if (!step.layerId || !(step.quantity > 0)) continue
    db.run('UPDATE cost_layer SET remaining_qty = remaining_qty - ?, updated_at = ? WHERE id = ?', [
      step.quantity,
      input.now,
      step.layerId,
    ])
    db.run(
      `INSERT INTO cost_consumption (
        id, workspace_id, layer_id, product_id, warehouse_id, consumer_type,
        consumer_id, consumer_line, quantity, unit_cost, currency, entry_date,
        created_at, updated_at, origin, sync_state
      ) VALUES (?, ?, ?, ?, ?, 'invoice', ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
      [
        generateUuid(),
        input.workspaceId,
        step.layerId,
        input.productId,
        input.warehouseId,
        input.invoiceId,
        input.invoiceLine,
        step.quantity,
        step.unitCost,
        input.currency,
        input.entryDate,
        input.now,
        input.now,
      ],
    )
  }
  return { totalCost: plan.totalCost, shortfall: plan.shortfall }
}

/** A new cost layer (a receipt): the units come in at their cost, in the books currency. */
export function receiveLayer(
  db: LocalDb,
  input: {
    workspaceId: string
    productId: string
    warehouseId: string | null
    quantity: number
    unitCost: number
    currency: string
    entryDate: string
    sourceType: string
    sourceId: string
    sourceLine: string | null
    now: string
  },
): string {
  // One layer per (source, line): the same gap valued twice (a double click) is one layer.
  if (input.sourceLine !== null) {
    const same = db.get<{ id: string }>(
      `SELECT id FROM cost_layer
        WHERE workspace_id = ? AND source_type = ? AND source_id = ? AND source_line = ? AND deleted_at IS NULL`,
      [input.workspaceId, input.sourceType, input.sourceId, input.sourceLine],
    )
    if (same) return same.id
  }
  const id = generateUuid()
  db.run(
    `INSERT INTO cost_layer (
      id, workspace_id, product_id, warehouse_id, source_type, source_id, source_line,
      received_qty, remaining_qty, unit_cost, currency, entry_date, created_at, updated_at,
      origin, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
    [
      id,
      input.workspaceId,
      input.productId,
      input.warehouseId,
      input.sourceType,
      input.sourceId,
      input.sourceLine,
      input.quantity,
      input.quantity,
      input.unitCost,
      input.currency,
      input.entryDate,
      input.now,
      input.now,
    ],
  )
  return id
}
