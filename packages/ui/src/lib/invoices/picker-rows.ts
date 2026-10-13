// ============================================
// What the invoice's product picker lists, and with which number.
//
// A product is not «in stock» — it is in stock SOMEWHERE. The picker therefore
// answers «what can leave this warehouse», not «what does the business own»:
//
//   · SALE, a warehouse chosen   → only the products that warehouse has a
//     record of; one it has run out of stays, marked and not pickable.
//     A product that was never there is not listed at all.
//   · SALE, «all warehouses»     → one line per product AND warehouse that
//     holds some of it. Picking a line is also choosing its warehouse.
//   · a branch chosen            → only that branch's warehouses count.
//   · PURCHASE or a COMPONENT    → every product (buying is how a product
//     arrives somewhere), with the chosen warehouse's quantity beside it.
//   · a business with no warehouse at all → the old list: every product with
//     its one total.
//
// Pure: the quantities are the server's (`/warehouses/placement`), read fresh.
// ============================================

import type { StockPlacement } from '@hisabche/api'

import type { PickerProduct } from './products'

export interface PickerRow {
  /** Unique within one list: a product can appear once per warehouse. */
  key: string
  product: PickerProduct
  /** The warehouse this line would sell from. Null = no warehouse is involved. */
  warehouseId: string | null
  warehouseName: string
  /** Null = not known. 0 is an answer. */
  stock: number | null
  /** Listed, but not pickable on a sale. */
  exhausted: boolean
}

export interface PickerRowsInput {
  products: readonly PickerProduct[]
  /** Undefined while it is loading or could not be read. */
  placement: StockPlacement | undefined
  /** The invoice's warehouse. Null = «all warehouses». */
  warehouseId: string | null
  /** The invoice's branch. Null = the whole business. */
  branchId: string | null
  mode: 'sale' | 'purchase' | 'component'
}

/** The warehouses an invoice of this branch may draw on. */
export function warehousesForBranch(
  placement: StockPlacement | undefined,
  branchId: string | null,
): StockPlacement['warehouses'] {
  const all = placement?.warehouses ?? []
  // A database that cannot say which branch a warehouse is in cannot filter by one.
  if (!branchId || !placement?.branchesConfigured) return all
  return all.filter((warehouse) => warehouse.branchId === branchId)
}

export function pickerRows(input: PickerRowsInput): PickerRow[] {
  const { products, placement, warehouseId, branchId, mode } = input
  const total = (product: PickerProduct) =>
    typeof product.quantity === 'number' ? product.quantity : null
  const plain = (product: PickerProduct): PickerRow => {
    const stock = total(product)
    return {
      key: product.id,
      product,
      warehouseId: null,
      warehouseName: '',
      stock,
      exhausted: mode === 'sale' && typeof stock === 'number' && stock <= 0,
    }
  }

  // Not read yet, or a business that keeps no warehouses: one total per product.
  const usesWarehouses =
    placement !== undefined && (placement.warehouses.length > 0 || placement.restricted)
  if (!usesWarehouses) return products.map(plain)

  const candidates = warehousesForBranch(placement, branchId)
  const nameOf = new Map(candidates.map((warehouse) => [warehouse.id, warehouse.name]))
  const held = new Map<string, Map<string, number>>()
  for (const row of placement.stock) {
    if (!nameOf.has(row.warehouseId)) continue
    const byWarehouse = held.get(row.productId) ?? new Map<string, number>()
    byWarehouse.set(row.warehouseId, row.quantity)
    held.set(row.productId, byWarehouse)
  }
  const chosen = warehouseId !== null && nameOf.has(warehouseId) ? warehouseId : null

  if (mode !== 'sale') {
    return products.map((product) => {
      if (!chosen) return plain(product)
      return {
        key: product.id,
        product,
        warehouseId: chosen,
        warehouseName: nameOf.get(chosen) ?? '',
        // Nothing there yet is a real answer for a purchase: zero.
        stock: held.get(product.id)?.get(chosen) ?? 0,
        exhausted: false,
      }
    })
  }

  const rows: PickerRow[] = []
  for (const product of products) {
    const byWarehouse = held.get(product.id)
    if (!byWarehouse) continue
    if (chosen) {
      if (!byWarehouse.has(chosen)) continue
      const stock = byWarehouse.get(chosen) ?? 0
      rows.push({
        key: product.id,
        product,
        warehouseId: chosen,
        warehouseName: nameOf.get(chosen) ?? '',
        stock,
        exhausted: stock <= 0,
      })
      continue
    }
    // «All warehouses»: where it can actually be taken from, one line each.
    for (const warehouse of candidates) {
      const stock = byWarehouse.get(warehouse.id) ?? 0
      if (stock <= 0) continue
      rows.push({
        key: `${product.id}|${warehouse.id}`,
        product,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        stock,
        exhausted: false,
      })
    }
  }
  return rows
}
