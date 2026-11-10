// ============================================
// packages/validation/src/schemas/variant-stock.ts
//
// Clothing / footwear (QA document §5, 10 Nov 2026): a size × colour grid and
// stock PER VARIANT (variant-stock-01).
//
// A variant had a SKU, barcode and price but no quantity, and every variant
// was typed in one by one with one attribute. A clothing shop thinks in a
// grid: «this T-shirt in S M L XL, in black and white» — eight variants.
//
// The rules here are shared by the server (which decides) and the screen
// (which previews): the grid, the SKU each cell gets, and what a variant's
// stock is.
// ============================================

import { z } from 'zod'
import { canonicalAttributeKey, type VariantAttribute } from './universal-core/variants.domain'

/** At most two axes (size × colour) and 30 values each — a grid a person can read. */
export const VARIANT_MATRIX_LIMITS = { axes: 2, values: 30, cells: 300 } as const

const axisSchema = z.object({
  name: z.string().trim().min(1).max(40),
  values: z.array(z.string().trim().min(1).max(40)).min(1).max(VARIANT_MATRIX_LIMITS.values),
})

export const variantMatrixSchema = z.object({
  axes: z.array(axisSchema).min(1).max(VARIANT_MATRIX_LIMITS.axes),
  /** The start of every SKU; the parent's code when the screen has one. */
  skuPrefix: z.string().trim().min(1).max(40),
})
export type VariantMatrixInput = z.infer<typeof variantMatrixSchema>

export interface VariantCell {
  readonly sku: string
  readonly attributes: readonly VariantAttribute[]
}

export type VariantMatrixResult =
  | { readonly ok: true; readonly cells: readonly VariantCell[]; readonly skipped: number }
  | {
      readonly ok: false
      readonly code: 'VARIANT_MATRIX_TOO_LARGE' | 'VARIANT_MATRIX_DUPLICATE_VALUE'
    }

/** «Black» → «BLACK», «سفید» stays «سفید»; spaces become dashes. */
function skuPart(value: string): string {
  return value.trim().replace(/\s+/g, '-').toUpperCase()
}

/**
 * Every cell of the grid that does not exist yet.
 *
 * A cell is identified by its attributes, not its SKU (canonicalAttributeKey):
 * «Size: L, Colour: Black» already on the product is skipped — running the grid
 * again after adding a colour adds only the new column.
 */
export function expandVariantMatrix(
  input: VariantMatrixInput,
  existing: ReadonlyArray<{
    readonly sku: string
    readonly attributes: readonly VariantAttribute[]
  }>,
): VariantMatrixResult {
  for (const axis of input.axes) {
    const keys = axis.values.map((v) => v.trim().toLowerCase())
    if (new Set(keys).size !== keys.length) {
      return { ok: false, code: 'VARIANT_MATRIX_DUPLICATE_VALUE' }
    }
  }
  let combos: VariantAttribute[][] = [[]]
  for (const axis of input.axes) {
    combos = combos.flatMap((prefix) =>
      axis.values.map((value) => [...prefix, { name: axis.name.trim(), value: value.trim() }]),
    )
  }
  if (combos.length > VARIANT_MATRIX_LIMITS.cells) {
    return { ok: false, code: 'VARIANT_MATRIX_TOO_LARGE' }
  }

  const taken = new Set(existing.map((v) => canonicalAttributeKey(v.attributes)))
  const skus = new Set(existing.map((v) => v.sku.toUpperCase()))
  const cells: VariantCell[] = []
  let skipped = 0
  for (const attributes of combos) {
    if (taken.has(canonicalAttributeKey(attributes))) {
      skipped += 1
      continue
    }
    const base = [skuPart(input.skuPrefix), ...attributes.map((a) => skuPart(a.value))].join('-')
    let sku = base
    // Two values that read the same once upper-cased still get distinct SKUs.
    for (let n = 2; skus.has(sku.toUpperCase()); n += 1) sku = `${base}-${n}`
    skus.add(sku.toUpperCase())
    cells.push({ sku, attributes })
  }
  return { ok: true, cells, skipped }
}

// ─── Moving stock onto a variant ─────────────────────────────────────────────

/**
 * `assign`  — stock already counted on the product is said to be this variant
 *             (the product's total does not change; it can only use what is not
 *             yet on a variant).
 * `receive` — stock arrives for this variant (the product's total goes up).
 * `remove`  — stock leaves this variant (count correction; total goes down).
 */
export const VARIANT_STOCK_MODES = ['assign', 'receive', 'remove'] as const
export type VariantStockMode = (typeof VARIANT_STOCK_MODES)[number]

export const variantStockMoveSchema = z.object({
  mode: z.enum(VARIANT_STOCK_MODES),
  quantity: z.number().positive().max(1_000_000_000),
  /** Required when the business has warehouses (same rule as every stock edit). */
  warehouseId: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(500).optional(),
})
export type VariantStockMoveInput = z.infer<typeof variantStockMoveSchema>

// The refusal codes are declared in variants.domain (the V55 P2 sale rule
// shares them and that file must stay import-free); re-exported here so every
// existing importer of this file is unchanged.
export type { VariantStockRefusal } from './universal-core/variants.domain'
import type { VariantStockRefusal } from './universal-core/variants.domain'

/**
 * Whether a move may happen, given what the warehouse holds.
 * `productOnHand` is the product's quantity in that warehouse (or in total
 * when the business has none); `variantsOnHand` is the sum over its variants
 * there; `variantOnHand` is this variant's.
 */
export function checkVariantStockMove(input: {
  readonly mode: VariantStockMode
  readonly quantity: number
  readonly productOnHand: number
  readonly variantsOnHand: number
  readonly variantOnHand: number
}): VariantStockRefusal | null {
  if (input.mode === 'assign') {
    const unassigned = input.productOnHand - input.variantsOnHand
    return input.quantity > unassigned + 1e-9 ? 'VARIANT_STOCK_NOT_ENOUGH_UNASSIGNED' : null
  }
  if (input.mode === 'remove') {
    return input.quantity > input.variantOnHand + 1e-9 ? 'VARIANT_STOCK_NOT_ENOUGH' : null
  }
  return null
}

// ─── Reading it back ─────────────────────────────────────────────────────────

export interface VariantStockRow {
  readonly variantId: string
  readonly warehouseId: string | null
  readonly quantity: number
}

export interface VariantStockLine {
  readonly variantId: string
  readonly sku: string
  readonly barcode: string | null
  readonly attributes: readonly VariantAttribute[]
  readonly onHand: number
  readonly sold: number
  readonly byWarehouse: ReadonlyArray<{
    readonly warehouseId: string | null
    readonly quantity: number
  }>
}

const round = (n: number) => Math.round(n * 10_000) / 10_000

/** One line per variant (zero when it never moved), in the order the variants were listed. */
export function summarizeVariantStock(
  variants: ReadonlyArray<{
    readonly id: string
    readonly sku: string
    readonly barcode?: string | null | undefined
    readonly attributes: readonly VariantAttribute[]
  }>,
  stock: readonly VariantStockRow[],
  sold: ReadonlyMap<string, number>,
): VariantStockLine[] {
  return variants.map((variant) => {
    const rows = stock.filter((row) => row.variantId === variant.id && row.quantity !== 0)
    return {
      variantId: variant.id,
      sku: variant.sku,
      barcode: variant.barcode ?? null,
      attributes: variant.attributes,
      onHand: round(rows.reduce((sum, row) => sum + row.quantity, 0)),
      sold: round(sold.get(variant.id) ?? 0),
      byWarehouse: rows.map((row) => ({
        warehouseId: row.warehouseId,
        quantity: round(row.quantity),
      })),
    }
  })
}

/**
 * Totals per value of one attribute: «all size L, whatever the colour».
 * A variant without that attribute is not counted under any value.
 */
export function totalsByAttribute(
  lines: readonly VariantStockLine[],
  attributeName: string,
): Array<{ value: string; onHand: number; sold: number }> {
  const wanted = attributeName.trim().toLowerCase()
  const totals = new Map<string, { value: string; onHand: number; sold: number }>()
  for (const line of lines) {
    const attribute = line.attributes.find((a) => a.name.trim().toLowerCase() === wanted)
    if (!attribute) continue
    const key = attribute.value.trim().toLowerCase()
    const entry = totals.get(key) ?? { value: attribute.value.trim(), onHand: 0, sold: 0 }
    entry.onHand = round(entry.onHand + line.onHand)
    entry.sold = round(entry.sold + line.sold)
    totals.set(key, entry)
  }
  return [...totals.values()]
}
