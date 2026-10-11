// ============================================
// backend/src/services/migration/stock-import.domain.ts
//
// Opening stock, warehouse by warehouse.
//
// A stock sheet says where the goods are in one of two ways:
//
//   A — a row per product AND warehouse
//         SKU    Product  Warehouse   Quantity
//         P-001  Rice     Main        100
//         P-001  Rice     Second      45
//
//   B — a row per product, a column per warehouse
//         SKU    Product  Main  Second
//         P-001  Rice     100   45
//
// Both become the same thing here: for each product, a list of
// (warehouse, quantity). That list is what is written, and it is what the
// import is checked against afterwards — per product and per warehouse, not
// as one total that two wrong figures could add up to.
//
// What is refused rather than guessed: a warehouse this business does not
// have; stock with no warehouse when there are several; the same product and
// warehouse twice; a negative quantity; a «total» column that is not the sum
// of the warehouse columns; a unit that differs from the product's. A refusal
// on ANY part of a product's stock refuses the product — half of its stock in
// the books is a wrong figure that looks finished.
//
// Pure: candidates and the business's warehouses in, a plan out.
// ============================================

import { comparisonKey } from './migration.domain'
import { stockWarehouseFor, type NamedPlace } from './places.domain'
import type { CandidateRow, Finding } from './migration.validate'
import { warehouseOfStockField, warehouseStockField } from './stock-fields'

export { WAREHOUSE_STOCK_PREFIX, warehouseStockField, warehouseOfStockField } from './stock-fields'

export interface StockEntry {
  warehouseId: string
  quantity: number
}

export interface ProductStock {
  /** What goes into each warehouse. */
  entries: StockEntry[]
  /** Stock of a business that keeps no warehouses at all: it has no building to be in. */
  unplaced: number
}

export interface StockPlan {
  /** Keyed by the row of the PRODUCT (a stock row under it adds to that row's plan). */
  byRow: Map<number, ProductStock>
  /** Product rows that must not be imported, and why. */
  refused: Map<number, string>
  findings: Finding[]
}

const quantityOf = (value: unknown): number | null => (typeof value === 'number' ? value : null)

/**
 * A header that IS the name of one of this business's warehouses is that
 * warehouse's quantity column. Exactly one match, as everywhere else.
 */
export function warehouseColumns(
  headers: readonly string[],
  warehouses: readonly NamedPlace[],
  taken: ReadonlySet<number>,
): Record<string, number> {
  const mapping: Record<string, number> = {}
  headers.forEach((header, index) => {
    if (taken.has(index)) return
    const key = comparisonKey(header)
    if (key === '') return
    const hits = warehouses.filter((warehouse) => comparisonKey(warehouse.name) === key)
    if (hits.length !== 1) return
    const field = warehouseStockField((hits[0] as NamedPlace).id)
    // Two columns with the same warehouse name: neither is taken on trust.
    if (mapping[field] !== undefined) delete mapping[field]
    else mapping[field] = index
  })
  return mapping
}

export function planStock(
  candidates: readonly CandidateRow[],
  warehouses: readonly NamedPlace[],
): StockPlan {
  const byRow = new Map<number, ProductStock>()
  const refused = new Map<number, string>()
  const findings: Finding[] = []
  const owners = new Map<number, CandidateRow>()
  for (const candidate of candidates) if (candidate.importable) owners.set(candidate.row, candidate)

  const refuse = (owner: number, row: number, code: string, detail?: string) => {
    if (!refused.has(owner)) refused.set(owner, code)
    findings.push({
      severity: 'warning',
      row,
      column: null,
      code: `PRODUCT_${code}`,
      ...(detail ? { detail } : {}),
    })
  }

  const planOf = (owner: number): ProductStock => {
    let plan = byRow.get(owner)
    if (!plan) {
      plan = { entries: [], unplaced: 0 }
      byRow.set(owner, plan)
    }
    return plan
  }

  const place = (owner: number, row: number, warehouseId: string, quantity: number) => {
    const plan = planOf(owner)
    if (plan.entries.some((entry) => entry.warehouseId === warehouseId)) {
      refuse(owner, row, 'STOCK_REPEATED')
      return
    }
    plan.entries.push({ warehouseId, quantity })
  }

  for (const candidate of candidates) {
    const ownerRow = candidate.stockOf ?? (candidate.importable ? candidate.row : null)
    if (ownerRow === null) continue
    const owner = owners.get(ownerRow)
    if (!owner) continue

    // ⚠️ A quantity in boxes under a product kept in pieces is not that many
    // pieces. No conversion is guessed; the row says its unit differs.
    const unit = comparisonKey(String(candidate.values['unit'] ?? ''))
    const ownerUnit = comparisonKey(String(owner.values['unit'] ?? ''))
    if (candidate !== owner && unit !== '' && ownerUnit !== '' && unit !== ownerUnit) {
      refuse(ownerRow, candidate.row, 'STOCK_UNIT_MISMATCH', String(candidate.values['unit']))
      continue
    }

    const columns = Object.entries(candidate.values)
      .map(([field, value]) => ({ id: warehouseOfStockField(field), quantity: quantityOf(value) }))
      .filter(
        (cell): cell is { id: string; quantity: number } =>
          cell.id !== null && cell.quantity !== null,
      )
    const stated = quantityOf(candidate.values['quantity'])

    if (columns.length > 0) {
      let sum = 0
      for (const cell of columns) {
        if (cell.quantity < 0) {
          refuse(ownerRow, candidate.row, 'STOCK_QUANTITY_NEGATIVE')
          continue
        }
        if (cell.quantity === 0) continue
        if (!warehouses.some((warehouse) => warehouse.id === cell.id)) {
          refuse(ownerRow, candidate.row, 'WAREHOUSE_UNKNOWN')
          continue
        }
        sum += cell.quantity
        place(ownerRow, candidate.row, cell.id, cell.quantity)
      }
      // A «total» column beside the warehouse columns is a check, and it is run.
      if (stated !== null && Math.abs(stated - sum) > 1e-6) {
        refuse(ownerRow, candidate.row, 'STOCK_TOTAL_MISMATCH', `${stated} ≠ ${sum}`)
      }
      continue
    }

    if (stated === null || stated === 0) continue
    if (stated < 0) {
      refuse(ownerRow, candidate.row, 'STOCK_QUANTITY_NEGATIVE')
      continue
    }

    const named = String(candidate.values['warehouse'] ?? '')
    const where = stockWarehouseFor(named, warehouses)
    if ('code' in where) {
      refuse(ownerRow, candidate.row, where.code, named || undefined)
      continue
    }
    if (where.warehouseId === null) planOf(ownerRow).unplaced += stated
    else place(ownerRow, candidate.row, where.warehouseId, stated)
  }

  for (const owner of refused.keys()) byRow.delete(owner)
  return { byRow, refused, findings }
}

/** The total a plan puts in the books, for the preview and the check after. */
export function stockTotals(plan: StockPlan): { units: number; placements: number } {
  let units = 0
  let placements = 0
  for (const stock of plan.byRow.values()) {
    units += stock.unplaced
    for (const entry of stock.entries) {
      units += entry.quantity
      placements += 1
    }
  }
  return { units, placements }
}
