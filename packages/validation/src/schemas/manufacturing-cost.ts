// ============================================
// packages/validation/src/schemas/manufacturing-cost.ts
//
// What one unit of a manufactured product costs, and what a production run
// costs — for ANY product. The core knows components, labour, other costs and a
// quantity; it does not know what a phone, a gearbox or a pizza is. Those are
// rows a person types.
//
// ⚠️ ONE ARITHMETIC. The component table is the invoice grid (same columns,
// same user-defined columns, same `rowTotal`), so «quantity × unit cost», the
// extra money columns and the rounding are the invoice's own — this file adds
// nothing to that rule, it only sums what the rule returns. The screen previews
// with `computeProductionCost` and the server recomputes with the SAME
// function from the SAME rows; a total sent by a client is never stored.
//
// THE MODEL — everything is entered PER ONE UNIT of output:
//
//   components  = Σ rowTotal(row)
//   labour      = explicit cost, else workers × hours × hourly rate
//   other       = Σ other-cost amounts
//   unit cost   = components + labour + other
//   run total   = unit cost × quantity            (the CALCULATED total)
//   total       = override ?? run total           (the override never replaces
//                                                  the calculated figure — both
//                                                  are kept)
// ============================================

import { z } from 'zod'

import { currencyCodeSchema, uuidSchema } from './common.schema'
import {
  COLUMN,
  COLUMN_TYPES,
  defaultColumns,
  hasCellValue,
  isRowFilled,
  roundTo,
  rowQuantity,
  rowTotal,
  rowUnitPrice,
  type GridMoneyContext,
  type InvoiceColumn,
  type InvoiceGridRow,
} from './invoice-grid'

type CurrencyCode = z.infer<typeof currencyCodeSchema>

/**
 * Decimals every production figure is kept with — the cost layers' own scale.
 *
 * ⚠️ NOT the currency's. The invoice rounds a unit price to the currency's
 * decimals, which is right for a price a customer pays and wrong for a cost:
 * in a currency written without decimals, ten grams at 0.06 a gram would cost
 * nothing, and a recipe made by weight would be free. A cost is an accounting
 * figure, so it carries four decimals all the way; the screen shows as many as
 * are there.
 */
export const UNIT_COST_DECIMALS = 4

/* ═══════════════════════════════════════════════════════════════════════════
   Columns
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The component table's starting columns: the invoice's, with the two names
 * that mean something else here. Discount and tax stay available (hidden), so
 * a trade that needs them enables them like any other column.
 */
export function productionColumns(currency: CurrencyCode): InvoiceColumn[] {
  return defaultColumns(currency).map((column) => {
    if (column.id === COLUMN.description) {
      return { ...column, labelKey: 'manufacturing.editor.columns.component', label: 'قطعه / ماده' }
    }
    if (column.id === COLUMN.unitPrice) {
      return {
        ...column,
        labelKey: 'manufacturing.editor.columns.unitCost',
        label: 'بهای واحد',
        precision: UNIT_COST_DECIMALS,
      }
    }
    if (column.id === COLUMN.lineTotal) {
      return {
        ...column,
        labelKey: 'manufacturing.editor.columns.lineTotal',
        label: 'جمع',
        precision: UNIT_COST_DECIMALS,
      }
    }
    return column
  })
}

/* ═══════════════════════════════════════════════════════════════════════════
   Labour
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ProductionLabor {
  workers?: number | null | undefined
  /** Minutes spent on ONE unit. */
  minutes?: number | null | undefined
  hourlyRate?: number | null | undefined
  /**
   * The labour cost itself. `null`/absent means «derive it»; a number —
   * including 0 — is what the person decided and is used as is.
   */
  cost?: number | null | undefined
}

/**
 * Labour per unit. An explicit cost wins, because «we paid the workshop 500»
 * is a fact and a rate is an estimate. With no cost and an incomplete
 * workers/time/rate triple the answer is 0 — time and head-count can be
 * recorded for the record without being priced.
 */
export function laborCost(labor: ProductionLabor | undefined, precision: number): number {
  if (!labor) return 0
  if (labor.cost !== null && labor.cost !== undefined) {
    return roundTo(Math.max(0, Number(labor.cost) || 0), precision)
  }
  const workers = Number(labor.workers) || 0
  const minutes = Number(labor.minutes) || 0
  const rate = Number(labor.hourlyRate) || 0
  if (workers <= 0 || minutes <= 0 || rate <= 0) return 0
  return roundTo((workers * minutes * rate) / 60, precision)
}

/* ═══════════════════════════════════════════════════════════════════════════
   The cost
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ProductionOtherCost {
  label: string
  amount: number
}

export interface ProductionCostInput {
  currency: CurrencyCode
  columns: readonly InvoiceColumn[]
  rows: readonly InvoiceGridRow[]
  /** Exchange rates into `currency`, for cost columns kept in another one. */
  rates?: GridMoneyContext['rates'] | undefined
  otherCosts?: readonly ProductionOtherCost[] | undefined
  labor?: ProductionLabor | undefined
  /** Finished units made in this run. A definition (BOM) is quantity 1. */
  quantity: number
  /** The run total a person set by hand. Null/absent = none. */
  overrideTotal?: number | null | undefined
}

export interface ProductionCostLine {
  kind: 'component' | 'cost'
  position: number
  productId: string | null
  label: string
  /** Per ONE unit of output. */
  quantity: number
  unit: string | null
  unitCost: number
  /** Per ONE unit of output — what `rowTotal` says this row is worth. */
  lineTotal: number
  /** The raw cells, custom columns included, exactly as typed. */
  cells: Record<string, string>
}

export interface ProductionCost {
  lines: ProductionCostLine[]
  componentsCost: number
  laborCost: number
  otherCost: number
  /** components + labour + other, for one unit. */
  unitCost: number
  quantity: number
  /** unitCost × quantity — never overwritten by an override. */
  calculatedTotal: number
  overrideTotal: number | null
  /** What the run is recorded at: the override when there is one. */
  total: number
  /** total ÷ quantity, at cost-layer precision — what a finished unit is received at. */
  effectiveUnitCost: number
}

/**
 * `rates`: units of the production currency one unit of another currency is
 * worth — the invoice's own rule for a cost column kept in a foreign currency.
 * A currency with no rate converts to nothing rather than to a guess.
 */
export function productionMoneyContext(
  currency: CurrencyCode,
  rates: GridMoneyContext['rates'] = {},
): GridMoneyContext {
  return { currency, precision: UNIT_COST_DECIMALS, rates }
}

export function computeProductionCost(input: ProductionCostInput): ProductionCost {
  const ctx = productionMoneyContext(input.currency, input.rates ?? {})
  const { precision } = ctx
  const lines: ProductionCostLine[] = []

  for (const row of input.rows) {
    // A row nobody typed in is not a component. A row with a figure but no
    // name still counts: dropping it would silently lower the cost.
    if (!isRowFilled(row)) continue
    const label = (row.values[COLUMN.description] ?? '').trim()
    const unit = row.values[COLUMN.unit]
    lines.push({
      kind: 'component',
      position: lines.length,
      productId: row.productId ?? null,
      label,
      quantity: rowQuantity(row),
      unit: hasCellValue(unit) ? unit.trim() : null,
      unitCost: roundTo(rowUnitPrice(row, input.columns, ctx), UNIT_COST_DECIMALS),
      lineTotal: rowTotal(row, input.columns, ctx),
      cells: { ...row.values },
    })
  }

  const componentsCost = roundTo(
    lines.reduce((sum, line) => sum + line.lineTotal, 0),
    precision,
  )

  for (const cost of input.otherCosts ?? []) {
    const amount = roundTo(Math.max(0, Number(cost.amount) || 0), precision)
    const label = cost.label.trim()
    if (!label && amount === 0) continue
    lines.push({
      kind: 'cost',
      position: lines.length,
      productId: null,
      label,
      quantity: 1,
      unit: null,
      unitCost: amount,
      lineTotal: amount,
      cells: {},
    })
  }

  const otherCost = roundTo(
    lines.filter((line) => line.kind === 'cost').reduce((sum, line) => sum + line.lineTotal, 0),
    precision,
  )
  const labor = laborCost(input.labor, precision)
  const unitCost = roundTo(componentsCost + labor + otherCost, precision)

  const quantity = Number(input.quantity) > 0 ? Number(input.quantity) : 0
  const calculatedTotal = roundTo(unitCost * quantity, precision)

  // ⚠️ «No override» is its own state, not an override of zero: `0` is a real
  // figure a person can set (a unit made from scrap), and treating it as
  // «none» would quietly restore the calculated total.
  const overrideTotal =
    input.overrideTotal === null || input.overrideTotal === undefined
      ? null
      : roundTo(Math.max(0, Number(input.overrideTotal) || 0), precision)

  const total = overrideTotal ?? calculatedTotal

  return {
    lines,
    componentsCost,
    laborCost: labor,
    otherCost,
    unitCost,
    quantity,
    calculatedTotal,
    overrideTotal,
    total,
    effectiveUnitCost: quantity > 0 ? roundTo(total / quantity, UNIT_COST_DECIMALS) : 0,
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Request contracts
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * A grid column as the editor holds it. Known fields are checked; unknown ones
 * pass through so a field the grid gains later is not stripped on save.
 */
export const productionColumnSchema = z
  .object({
    id: z.string().min(1).max(80),
    label: z.string().max(120),
    type: z.enum(COLUMN_TYPES),
    system: z.boolean(),
    visible: z.boolean(),
    aggregate: z.boolean(),
    precision: z.number().int().min(0).max(6),
  })
  .passthrough()

export const productionRowSchema = z.object({
  id: z.string().min(1).max(80),
  productId: uuidSchema.optional(),
  values: z.record(z.string().max(500)),
})

export const productionLaborSchema = z.object({
  workers: z.number().min(0).max(100_000).nullable().optional(),
  minutes: z.number().min(0).max(10_000_000).nullable().optional(),
  hourlyRate: z.number().min(0).nullable().optional(),
  cost: z.number().min(0).nullable().optional(),
})

export const productionOtherCostSchema = z.object({
  label: z.string().trim().max(120),
  amount: z.number().min(0),
})

const definitionShape = {
  productId: uuidSchema,
  currency: currencyCodeSchema,
  columns: z.array(productionColumnSchema).min(1).max(40),
  rows: z.array(productionRowSchema).max(300),
  rates: z.record(currencyCodeSchema, z.number().positive()).default({}),
  otherCosts: z.array(productionOtherCostSchema).max(50).default([]),
  labor: productionLaborSchema.default({}),
  notes: z.string().trim().max(2000).optional(),
}

/** Save the definition (BOM / recipe) of a product. */
export const saveProductionDefinitionSchema = z.object({
  ...definitionShape,
  /** The definition being edited. Absent = the product's first, or a new one. */
  bomId: uuidSchema.optional(),
})

export type SaveProductionDefinition = z.infer<typeof saveProductionDefinitionSchema>

/** Record one production run. */
export const produceSchema = z
  .object({
    ...definitionShape,
    bomId: uuidSchema.optional(),
    /** An existing planned order this run completes. */
    workOrderId: uuidSchema.optional(),
    quantity: z.number().positive().max(1_000_000_000),
    overrideTotal: z.number().min(0).nullable().optional(),
    overrideReason: z.string().trim().max(500).optional(),
    /** Keep these rows as the product's definition for next time. */
    saveDefinition: z.boolean().default(true),
    /** OFF = a cost record only: no stock moves at all. */
    addToInventory: z.boolean().default(false),
    /** With inventory ON: also take the stocked components off the shelf. */
    consumeComponents: z.boolean().default(true),
    warehouseId: uuidSchema.nullable().optional(),
    /** One per press of «ثبت»; a retry sends the same key. */
    idempotencyKey: z.string().min(8).max(100),
    /** ISO day the goods were made. */
    producedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.overrideTotal !== null &&
      value.overrideTotal !== undefined &&
      !value.overrideReason
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['overrideReason'],
        message: 'manufacturing.errors.overrideReasonRequired',
      })
    }
  })

export type ProduceInput = z.infer<typeof produceSchema>

/** The grid columns of a stored definition, typed for the grid. */
export function asProductionColumns(
  columns: readonly z.infer<typeof productionColumnSchema>[],
): InvoiceColumn[] {
  return columns as unknown as InvoiceColumn[]
}
