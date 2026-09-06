// ============================================
// backend/src/__tests__/valuation-consistency.test.ts
//
// L5 — do FIFO cost layers stay consistent with transfers and adjustments?
//
// ---------------------------------------------------------------------------
// THE AUDIT, AND WHAT IT FOUND
//
// `warehouse.service.transferStock` carries this note:
//
//     "A transfer does NOT touch cost layers: the goods have not been
//      consumed, they have only changed shelf. Their cost travels with them."
//
// That is TRUE ONLY WHILE FIFO IS POOLED ACROSS WAREHOUSES — and today it is:
// `invoice.service` passes `warehouseId: item.warehouseId ?? null`, invoice
// items carry no warehouse, so `openLayers` is always called workspace-wide
// and never filters by warehouse.
//
// But the machinery for the other behaviour is fully present:
//
//   • `cost_layers.warehouse_id` exists and IS populated on receipt
//   • `openLayers(workspaceId, productId, warehouseId?)` filters when given one
//   • `consumeLayers` forwards a warehouse to the RPC
//
// So the moment ANY production caller passes a real warehouse — a
// warehouse-scoped valuation report, or K2's transfer receive — the two halves
// disagree:
//
//   the destination has quantity (stock_movements) and NO layer,
//   the source still holds a layer for goods that have left.
//
// A sale from the destination would then find no layers and book a cost of
// goods sold of zero: gross margin overstated by the entire cost of the goods,
// silently, on every sale from a warehouse that received a transfer.
//
// ---------------------------------------------------------------------------
// THIS TEST IS A TRIPWIRE, NOT A FIX
//
// The fix is to move the layer with the goods, and that cannot be written yet:
// it depends on the K2 stop condition (where stock LIVES while in transit),
// because the layer has to live in the same place. Deciding it here would put
// a guess into inventory valuation.
//
// So the invariant is stated and enforced: while transfers do not move layers,
// nothing may consume layers per-warehouse. Break either half and this fails.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SERVICES = join(__dirname, '..', 'services')
const read = (rel: string) => readFileSync(join(SERVICES, rel), 'utf8')

/** Comments stripped — this test reasons about code, and the code it reasons
 *  about is discussed at length in comments that would match every pattern. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('L5 — the pooled-FIFO invariant', () => {
  const invoice = code(read('invoice.service.ts'))
  const warehouse = code(read('warehouse.service.ts'))

  it('⚠️ invoice costing is workspace-wide, never warehouse-scoped', () => {
    // THE LOAD-BEARING FACT. Invoice items carry no warehouse, so this
    // resolves to null and FIFO pools across the business — which is what
    // makes «a transfer need not move the layer» true.
    //
    // If this ever becomes a real warehouse id, transfers MUST move layers
    // first, or every sale from a transferred-into warehouse books zero cost.
    expect(invoice).toContain('warehouseId: item.warehouseId ?? null')
  })

  it('the transfer path still does not touch cost layers', () => {
    // The other half of the same invariant. If a transfer starts moving
    // layers, this assertion should be deleted deliberately — together with
    // the one above, in the same change.
    expect(warehouse).not.toContain('cost_layers')
    expect(warehouse).not.toContain('consumeLayers')
    expect(warehouse).not.toContain('receiveLayer')
  })

  it('K2’s transfer document does not move layers either, yet', () => {
    // `ship`/`receive` are refused with TRANSFER_STOCK_LEG_NOT_IMPLEMENTED
    // (the K2 stop condition). When that is resolved, the layer has to move
    // with the goods in the same change — the goods and their cost cannot be
    // in two different places.
    const transfer = code(read('warehouse/transfer.service.ts'))
    expect(transfer).toContain('TRANSFER_STOCK_LEG_NOT_IMPLEMENTED')
    expect(transfer).not.toContain('consumeLayers')
  })
})

describe('L5 — the costing domains that exist and are not wired', () => {
  it('the costing transfer domain has no production consumer', () => {
    // `inventory-costing/transfer.domain.ts` models dispatch / receive /
    // cancel with correct stock effects and is covered by tests. Nothing in
    // any service calls it — the same «built and unreachable» pattern as
    // `general-ledger` (lesson 74).
    //
    // ⚠️ K2 deliberately did NOT reuse it: it models the VALUATION of a
    // transfer (three states, stock effects), while K2 models the DOCUMENT
    // lifecycle (seven states, approvals, actors). Two different questions
    // about the same event. When the stock leg is implemented, K2's service
    // should call THIS domain for the effects rather than compute its own —
    // recorded here so the choice is deliberate rather than forgotten.
    const services = read('warehouse/transfer.service.ts')
    expect(services).not.toContain('inventory-costing/transfer.domain')
  })

  it('the stock-count domain has no production consumer either', () => {
    // `stock-count.domain.ts` already computes variance cost correctly —
    // shortages at actual FIFO cost, surpluses at the current average. It is
    // exactly what L2 (Cycle Count) needs, and no table or service reaches it.
    const costing = code(read('inventory-costing/costing.service.ts'))
    expect(costing).not.toContain('stock-count.domain')
  })
})
