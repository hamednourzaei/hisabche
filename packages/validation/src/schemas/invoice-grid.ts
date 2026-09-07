// ============================================
// packages/validation/src/schemas/invoice-grid.ts
//
// The invoice builder's data model — columns, rows, money.
//
// A GENERIC engine. The core knows nothing about gold, phones, food or
// construction. It knows a small set of column TYPES; every trade-specific
// field — عیار, IMEI, متراژ, ساعت کار — is a column the user adds. Nothing in
// this file should ever branch on a business domain.
//
// Pure by design: no React, no fetching. The grid, the totals row, the
// preview page and the API mapper all read it, which is what makes «preview
// shows exactly what the builder showed» true by construction.
//
// WHERE USER-DEFINED COLUMNS ARE STORED
//
// The invoice model already has a carrier for named per-line components:
// `invoice_item_details` (title, quantity, amount, unit, unit_label,
// weight_grams, sort_order). A user-defined column IS a named component of a
// line, so that is where it goes — no new table, no migration.
//
//   money column, invoice currency   → { title, quantity: 1, amount: value }
//   numeric / other-currency column  → { title, quantity: value, amount: 0 }
//   text / date / select / boolean   → appended to the item's `notes`
//
// The second form matters: details are ADDITIVE to the line total (see
// `computeItemTotal`), so a value of 18 stored as `amount: 18` would add 18 to
// the money. Stored as `quantity: 18, amount: 0` it contributes 18 × 0 = 0 and
// the number survives without corrupting a single total.
// ============================================

import type { z } from 'zod'

import { computeItemTotal } from './invoice.schema'
import type { currencyCodeSchema, unitSchema } from './common.schema'
import { fractionDigits } from '@hisabche/formatting'

type CurrencyCode = z.infer<typeof currencyCodeSchema>

/** The unit vocabulary the invoice item schema accepts. */
type InvoiceUnit = z.infer<typeof unitSchema>

/* ═══════════════════════════════════════════════════════════════════════════
   Money
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Round at a fixed number of decimals through scaled integers.
 *
 * Every aggregation boundary goes through this. `0.1 + 0.2` is exactly the
 * kind of drift that turns a shopkeeper's جمع into 114,349,999.99999999.
 */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** Math.max(0, decimals)
  const scaled = value * factor
  // The nudge absorbs the representation error of the multiply itself, so
  // 2.675 × 100 = 267.49999999999997 still rounds to 268 rather than 267.
  return Math.round(scaled + (scaled >= 0 ? 1e-9 : -1e-9)) / factor
}

/**
 * Parse a cell the user typed. Accepts Persian/Arabic digits, thousands
 * separators and the Persian decimal mark; returns 0 for anything that is not
 * a number so a half-typed cell never produces NaN in a total.
 */
export function parseCellNumber(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0
  if (!raw) return 0

  const latin = String(raw)
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/٫/g, '.')
    .replace(/[^0-9.-]/g, '')

  const value = parseFloat(latin)
  return Number.isFinite(value) ? value : 0
}

/** True when the user typed something — distinct from "typed a 0". */
export function hasCellValue(raw: string | null | undefined): raw is string {
  return typeof raw === 'string' && raw.trim().length > 0
}

/* ═══════════════════════════════════════════════════════════════════════════
   Columns
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The complete type vocabulary. Adding a trade means adding COLUMNS, never a
 * new type — and certainly never a new branch named after a trade.
 */
export const COLUMN_TYPES = [
  'text',
  'integer',
  'decimal',
  'currency',
  'percent',
  'date',
  'select',
  'boolean',
  'computed',
] as const

export type InvoiceColumnType = (typeof COLUMN_TYPES)[number]

/** Built-in column ids. Fixed strings: the API mapper looks them up. */
export const COLUMN = {
  description: 'description',
  quantity: 'quantity',
  unit: 'unit',
  unitPrice: 'unitPrice',
  discount: 'discount',
  tax: 'tax',
  lineTotal: 'lineTotal',
  /**
   * Optional built-in, hidden by default. It exists only because the invoice
   * item table has a real `weight_grams` column and invoices already created
   * with it must keep round-tripping — not because the core cares about
   * weight. A user who needs it enables it like any other column.
   */
  weight: 'weightGrams',
  notes: 'notes',
} as const

export type BuiltinColumnId = (typeof COLUMN)[keyof typeof COLUMN]

const BUILTIN_IDS: readonly string[] = Object.values(COLUMN)

export function isBuiltinColumn(id: string): boolean {
  return BUILTIN_IDS.includes(id)
}

export interface InvoiceColumn {
  id: string
  /** Catalogue key for built-ins. Custom columns have none — see `label`. */
  labelKey?: string
  /** The user-typed title, or the Persian fallback for a built-in. */
  label: string
  type: InvoiceColumnType
  /**
   * A system column carries a field the invoice cannot be saved without, so
   * it can be hidden but never deleted.
   */
  system: boolean
  visible: boolean
  /** Numeric columns may contribute a total to the bottom row. */
  aggregate: boolean
  /**
   * Whether this column's value is added to the LINE TOTAL — «در جمع کل حساب
   * شود؟» (task T8).
   *
   * ---------------------------------------------------------------------
   * ⚠️ THIS IS NOT `aggregate`, AND CONFLATING THE TWO IS THE BUG.
   *
   *   aggregate       show a sum for this column in the FOOTER row
   *   includeInTotal  add this column into what the CUSTOMER PAYS
   *
   * A weight column is worth summing in the footer («۴۲۰ گرم in total») and
   * must never be added to the money. A مالیات column is the reverse.
   *
   * ---------------------------------------------------------------------
   * ⚠️ `undefined` IS NOT `false`. It means «the behaviour before T8», and it
   * differs by type — see `columnCountsInTotal`. Defaulting it to false would
   * silently drop every existing invoice's extra money columns out of its
   * total; defaulting it to true would silently add every percent column that
   * has never been counted. Both would change saved documents' meaning.
   */
  includeInTotal?: boolean
  /** Only meaningful for `currency`. Chosen by the user, per column. */
  currency?: CurrencyCode
  /** Decimals used for display AND for rounding this column's total. */
  precision: number
  /** Shown next to the header — «گرم», «ساعت», «متر». Free text, any trade. */
  suffix?: string
  /**
   * The user's own name for what KIND of column this is — «اجرت», «کرایه
   * حمل», «کارمزد» (task T8).
   *
   * ---------------------------------------------------------------------
   * ⚠️ THIS IS A LABEL. IT IS NOT A NEW `type`, AND THE DIFFERENCE MATTERS.
   *
   * The owner asked for an input to add their own column type. A type the
   * system does not recognise has no arithmetic — nothing would know whether
   * to add it, multiply it, or charge a percentage of it, so a column of that
   * type could only ever be inert text. Offering it would be the
   * undefined-policy guardrail: a setting that looks like it does something.
   *
   * So the BEHAVIOUR stays one of the defined types (currency, percent, …)
   * and this names the column's kind for the people reading the invoice. The
   * trade gets its own vocabulary; the totals stay computable.
   *
   * Displayed instead of the technical type wherever the type is shown.
   */
  typeLabel?: string
  /** Only for `select` — the choices the user defined. */
  options?: string[]
  /** Pre-filled into a new row. */
  defaultValue?: string
}

export interface InvoiceGridRow {
  id: string
  /** Present when the description was picked from the warehouse. */
  productId?: string
  /** Raw text exactly as typed, keyed by column id. */
  values: Record<string, string>
}

/**
 * Decimals a currency is normally written with.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ THIS NOW DELEGATES, AND THE REASON IT DID NOT BEFORE HAS EXPIRED.
 *
 * It used to be `currency === 'USD' ? 2 : 0`, mirrored here rather than
 * imported because `@hisabche/validation` and `@hisabche/formatting` were both
 * leaf packages and an edge between them was not worth saving four lines
 * (lesson 83). A guard kept the two in step.
 *
 * That reasoning held for a two-branch rule over four currencies. It does not
 * hold for twenty-five codes across three precision tiers: the two-branch rule
 * is now WRONG — it gives GBP zero decimals — and a hand-mirrored 25-entry
 * table is a drift risk, not a saved line.
 *
 * So `@hisabche/formatting` is a dependency now, deliberately. It has no
 * hisabche dependencies of its own, so this adds an edge and not a cycle.
 *
 * ⚠️ NO FALLBACK. §9 requires an unknown code to resolve to `undefined` rather
 * than borrow another currency's precision, and `fractionDigits` preserves
 * that. The codes are exhaustive by `currencyCodeSchema`.
 */
export function currencyPrecision(currency: CurrencyCode): number {
  return fractionDigits(currency)
}

/**
 * The generic core layout. Seven columns, none of them trade-specific.
 * Everything else is «+ افزودن ستون».
 */
export function defaultColumns(currency: CurrencyCode): InvoiceColumn[] {
  const money = currencyPrecision(currency)
  return [
    {
      id: COLUMN.description,
      labelKey: 'invoiceBuilder.columns.description',
      label: 'شرح کالا / خدمت',
      type: 'text',
      system: true,
      visible: true,
      aggregate: false,
      precision: 0,
    },
    {
      id: COLUMN.quantity,
      labelKey: 'invoiceBuilder.columns.quantity',
      label: 'تعداد',
      type: 'decimal',
      system: true,
      visible: true,
      aggregate: true,
      precision: 3,
    },
    {
      id: COLUMN.unit,
      labelKey: 'invoiceBuilder.columns.unit',
      label: 'واحد',
      type: 'select',
      system: false,
      visible: true,
      aggregate: false,
      precision: 0,
    },
    {
      id: COLUMN.unitPrice,
      labelKey: 'invoiceBuilder.columns.unitPrice',
      label: 'قیمت واحد',
      type: 'currency',
      system: true,
      visible: true,
      aggregate: false,
      currency,
      precision: money,
    },
    {
      id: COLUMN.discount,
      labelKey: 'invoiceBuilder.columns.discount',
      label: 'تخفیف (٪)',
      type: 'percent',
      system: false,
      visible: false,
      aggregate: false,
      precision: 2,
    },
    {
      id: COLUMN.tax,
      labelKey: 'invoiceBuilder.columns.tax',
      label: 'مالیات (٪)',
      type: 'percent',
      system: false,
      visible: false,
      aggregate: false,
      precision: 2,
    },
    {
      id: COLUMN.lineTotal,
      labelKey: 'invoiceBuilder.columns.lineTotal',
      label: 'مبلغ کل',
      type: 'computed',
      system: true,
      visible: true,
      aggregate: true,
      currency,
      precision: money,
    },
    {
      id: COLUMN.weight,
      labelKey: 'invoiceBuilder.columns.weight',
      label: 'وزن (گرم)',
      type: 'decimal',
      system: false,
      visible: false,
      aggregate: true,
      precision: 3,
    },
    {
      id: COLUMN.notes,
      labelKey: 'invoiceBuilder.columns.notes',
      label: 'توضیحات',
      type: 'text',
      system: false,
      visible: false,
      aggregate: false,
      precision: 0,
    },
  ]
}

export function emptyRow(id: string, columns: readonly InvoiceColumn[]): InvoiceGridRow {
  const values: Record<string, string> = {}
  for (const column of columns) {
    if (column.defaultValue) values[column.id] = column.defaultValue
  }
  return { id, values }
}

/** Columns actually drawn, in order. */
export function visibleColumns(columns: readonly InvoiceColumn[]): InvoiceColumn[] {
  return columns.filter((c) => c.visible)
}

/** A column may be deleted only when it is not load-bearing for the API. */
export function canDeleteColumn(column: InvoiceColumn): boolean {
  return !column.system
}

/** Only these types can produce a meaningful total. */
export function canAggregate(type: InvoiceColumnType): boolean {
  return type === 'integer' || type === 'decimal' || type === 'currency' || type === 'computed'
}

export function moveColumn(
  columns: readonly InvoiceColumn[],
  id: string,
  direction: -1 | 1,
): InvoiceColumn[] {
  const index = columns.findIndex((c) => c.id === id)
  if (index < 0) return [...columns]
  const target = index + direction
  if (target < 0 || target >= columns.length) return [...columns]

  const next = [...columns]
  const a = next[index]
  const b = next[target]
  if (!a || !b) return next
  next[index] = b
  next[target] = a
  return next
}

/**
 * A column id that is stable, readable and cannot collide with a built-in.
 * The title is part of it because the title is what the persisted detail row
 * is keyed by — see the file header.
 */
export function customColumnId(title: string, existing: readonly InvoiceColumn[]): string {
  const base = `custom-${title.trim().replace(/\s+/g, '-')}`
  if (!existing.some((c) => c.id === base)) return base
  let n = 2
  while (existing.some((c) => c.id === `${base}-${n}`)) n += 1
  return `${base}-${n}`
}

/* ═══════════════════════════════════════════════════════════════════════════
   Row and column arithmetic
   ═══════════════════════════════════════════════════════════════════════════ */

export interface GridMoneyContext {
  /** The invoice's own currency — the one every authoritative total is in. */
  currency: CurrencyCode
  /** Decimals for that currency. */
  precision: number
  /**
   * How many units of the INVOICE currency one unit of a foreign currency is
   * worth, keyed by that currency. `undefined` for a currency the user has
   * not given a rate for — in which case nothing is converted. A missing rate
   * makes money visibly absent, never quietly invented.
   */
  rates: Partial<Record<CurrencyCode, number>>
}

/** True when the column holds money in a currency other than the invoice's. */
export function isForeignMoneyColumn(column: InvoiceColumn, ctx: GridMoneyContext): boolean {
  return column.type === 'currency' && (column.currency ?? ctx.currency) !== ctx.currency
}

/**
 * Convert into the invoice currency, or `null` when no rate was supplied.
 *
 * Returning `null` rather than the raw number is the whole point: a caller
 * cannot accidentally treat 600 USD as 600 Toman.
 */
export function toInvoiceCurrency(
  value: number,
  from: CurrencyCode,
  ctx: GridMoneyContext,
): number | null {
  if (from === ctx.currency) return roundTo(value, ctx.precision)
  const rate = ctx.rates[from]
  if (!rate || rate <= 0) return null
  return roundTo(value * rate, ctx.precision)
}

/**
 * The unit price of a row, in the invoice currency.
 *
 * The قیمت واحد column carries its own currency. When that is not the
 * invoice's, the value is converted at the rate the user typed — and the
 * builder prints that rate above the grid and shows the converted figure in
 * the cell, so the conversion is visible, not silent.
 */
export function rowUnitPrice(
  row: InvoiceGridRow,
  columns: readonly InvoiceColumn[],
  ctx: GridMoneyContext,
): number {
  const column = columns.find((c) => c.id === COLUMN.unitPrice)
  const raw = row.values[COLUMN.unitPrice]
  if (!hasCellValue(raw)) return 0
  const converted = toInvoiceCurrency(parseCellNumber(raw), column?.currency ?? ctx.currency, ctx)
  return converted ?? 0
}

export function rowQuantity(row: InvoiceGridRow): number {
  const raw = row.values[COLUMN.quantity]
  if (!hasCellValue(raw)) return 1
  const value = parseCellNumber(raw)
  return value > 0 ? value : 1
}

function boundedPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
}

export function rowDiscountPercent(row: InvoiceGridRow): number {
  return boundedPercent(parseCellNumber(row.values[COLUMN.discount]))
}

export function rowTaxPercent(row: InvoiceGridRow): number {
  return boundedPercent(parseCellNumber(row.values[COLUMN.tax]))
}

/**
 * Whether a column joins the line total.
 *
 * ---------------------------------------------------------------------------
 * THE DEFECT THIS ANSWERS (T8)
 *
 * A gold trader adds a «اجرت» column of type `percent` and puts 18 in it. The
 * old rule was one line inside `rowExtraMoney`:
 *
 *     if (column.type !== 'currency') return sum
 *
 * so the percent column contributed NOTHING. The invoice showed a total the
 * customer does not actually pay. That is an accounting defect, not a display
 * one — the figure is wrong on the printed invoice, in the ledger, and in the
 * customer's balance.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ THE UNDEFINED CASE IS A COMPATIBILITY RULE, NOT A DEFAULT
 *
 * Columns saved before T8 have no `includeInTotal`. They must keep behaving
 * exactly as they did, or reopening an old invoice silently changes its total:
 *
 *   currency, undefined → true   every money column already counted
 *   percent,  undefined → false  no percent column has ever counted
 *
 * A user who wants the percent counted turns it on, once, deliberately.
 */
export function columnCountsInTotal(column: InvoiceColumn): boolean {
  // The built-ins that are already applied by name in `rowTotal`. Counting
  // them here would apply the discount twice and the tax twice.
  if (column.id === COLUMN.unitPrice) return false
  if (column.id === COLUMN.discount) return false
  if (column.id === COLUMN.tax) return false
  if (column.id === COLUMN.lineTotal) return false

  if (column.type !== 'currency' && column.type !== 'percent') return false

  if (column.includeInTotal !== undefined) return column.includeInTotal
  return column.type === 'currency'
}

/**
 * Every user-added money column that adds to this line, in the invoice
 * currency. A column in a foreign currency with no rate is excluded and
 * reported separately — adding a USD figure into a Toman total is exactly the
 * silent corruption this system must not do.
 */
export function rowExtraMoney(
  row: InvoiceGridRow,
  columns: readonly InvoiceColumn[],
  ctx: GridMoneyContext,
): number {
  return columns.reduce((sum, column) => {
    if (column.type !== 'currency') return sum
    if (!columnCountsInTotal(column)) return sum
    if (!hasCellValue(row.values[column.id])) return sum

    const converted = toInvoiceCurrency(
      parseCellNumber(row.values[column.id]),
      column.currency ?? ctx.currency,
      ctx,
    )
    return converted === null ? sum : sum + converted
  }, 0)
}

/**
 * The percent columns the user has switched into the total, as a fraction.
 *
 * «۱۸٪ اجرت» means eighteen percent OF THE GOODS — the base plus the flat
 * money columns, before discount and before tax. Two consequences that are
 * deliberate:
 *
 *   · Applied to base + flat extras, not to the base alone. A necklace priced
 *     as «زنجیر + سنگ» has its making charge on the whole piece.
 *   · Applied BEFORE the discount, so a discount discounts the making charge
 *     too — which is what a shopkeeper means by «۱۰٪ تخفیف دادم».
 *
 * Several percent columns add: 18% + 2% is 20% of the base, not 18% compounded
 * with 2%. Compounding would make the order of the columns change the price.
 */
export function rowExtraPercent(row: InvoiceGridRow, columns: readonly InvoiceColumn[]): number {
  return columns.reduce((sum, column) => {
    if (column.type !== 'percent') return sum
    if (!columnCountsInTotal(column)) return sum
    if (!hasCellValue(row.values[column.id])) return sum
    return sum + parseCellNumber(row.values[column.id])
  }, 0)
}

/**
 * The line total.
 *
 * Delegates the discount rule to `computeItemTotal` — the one place the
 * parent/component money rule lives — so the grid, the preview and the server
 * can never disagree. The per-row tax column is applied after, matching how
 * the invoice-level tax is applied to the invoice.
 */
export function rowTotal(
  row: InvoiceGridRow,
  columns: readonly InvoiceColumn[],
  ctx: GridMoneyContext,
): number {
  const flat = rowExtraMoney(row, columns, ctx)

  // T8 — «۱۸٪ اجرت» is money the customer pays, and it used to be worth zero.
  // Charged on the goods plus the flat extras, before discount and tax.
  const percent = rowExtraPercent(row, columns)
  const base = rowQuantity(row) * rowUnitPrice(row, columns, ctx)
  const surcharge = ((base + flat) * percent) / 100

  const extras = flat + surcharge
  const net = computeItemTotal({
    quantity: rowQuantity(row),
    unitPrice: rowUnitPrice(row, columns, ctx),
    discount: rowDiscountPercent(row),
    // One synthetic component carrying the user's money columns, so the
    // discount applies to base + extras exactly as it does on the server.
    details: extras ? [{ quantity: 1, amount: extras }] : [],
  })
  const tax = rowTaxPercent(row)
  return roundTo(net + (net * tax) / 100, ctx.precision)
}

/** A row the user has started filling in. */
export function isRowFilled(row: InvoiceGridRow): boolean {
  return Object.values(row.values).some((v) => v.trim().length > 0)
}

/** A row with a description — the only kind that can become an invoice item. */
export function isRowSubmittable(row: InvoiceGridRow): boolean {
  return hasCellValue(row.values[COLUMN.description])
}

/**
 * The totals row: one entry per aggregating column, keyed by column id.
 *
 * `undefined` for a column that does not aggregate, so the caller renders an
 * empty cell rather than a misleading zero.
 */
export function columnTotals(
  rows: readonly InvoiceGridRow[],
  columns: readonly InvoiceColumn[],
  ctx: GridMoneyContext,
): Record<string, number | undefined> {
  const totals: Record<string, number | undefined> = {}

  for (const column of columns) {
    if (!column.aggregate || !canAggregate(column.type)) continue

    if (column.id === COLUMN.lineTotal) {
      totals[column.id] = roundTo(
        rows.reduce((sum, row) => sum + rowTotal(row, columns, ctx), 0),
        ctx.precision,
      )
      continue
    }

    // A money column totals in ITS OWN currency — never converted for the
    // totals row, so «جمع دلار» stays dollars.
    totals[column.id] = roundTo(
      rows.reduce((sum, row) => {
        const value = parseCellNumber(row.values[column.id])
        // A unit price is per unit; its column total is the extended amount.
        return sum + (column.id === COLUMN.unitPrice ? value * rowQuantity(row) : value)
      }, 0),
      column.precision,
    )
  }

  return totals
}

/* ═══════════════════════════════════════════════════════════════════════════
   Invoice-level summary
   ═══════════════════════════════════════════════════════════════════════════ */

export interface InvoiceSummaryInput {
  rows: readonly InvoiceGridRow[]
  columns: readonly InvoiceColumn[]
  ctx: GridMoneyContext
  /** Invoice-level discount, in the invoice currency or as a percentage. */
  discountValue: number
  discountType: 'fixed' | 'percentage'
  taxRate: number
}

export interface InvoiceSummary {
  itemCount: number
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  /**
   * Totals of every money column whose currency is not the invoice's, keyed
   * by currency. Reported alongside — never folded into — `total`, because an
   * invoice settles in exactly one currency.
   */
  foreignTotals: { currency: CurrencyCode; amount: number }[]
}

export function summarize(input: InvoiceSummaryInput): InvoiceSummary {
  const { rows, columns, ctx, discountValue, discountType, taxRate } = input
  const filled = rows.filter(isRowSubmittable)

  const subtotal = roundTo(
    filled.reduce((sum, row) => sum + rowTotal(row, columns, ctx), 0),
    ctx.precision,
  )

  const discountTotal = roundTo(
    discountType === 'percentage'
      ? (subtotal * boundedPercent(discountValue)) / 100
      : Math.min(subtotal, Math.max(0, discountValue)),
    ctx.precision,
  )

  const taxable = Math.max(0, subtotal - discountTotal)
  const taxTotal = roundTo((taxable * boundedPercent(taxRate)) / 100, ctx.precision)
  const total = roundTo(Math.max(0, taxable + taxTotal), ctx.precision)

  const byCurrency = new Map<CurrencyCode, number>()
  for (const column of columns) {
    if (!isForeignMoneyColumn(column, ctx)) continue
    const code = column.currency
    if (!code) continue
    const sum = filled.reduce((acc, row) => {
      const value = parseCellNumber(row.values[column.id])
      return acc + (column.id === COLUMN.unitPrice ? value * rowQuantity(row) : value)
    }, 0)
    byCurrency.set(code, roundTo((byCurrency.get(code) ?? 0) + sum, column.precision))
  }

  return {
    itemCount: filled.length,
    subtotal,
    discountTotal,
    taxTotal,
    total,
    foreignTotals: [...byCurrency.entries()]
      .filter(([, amount]) => amount !== 0)
      .map(([currency, amount]) => ({ currency, amount })),
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mapping to the invoice API
   ═══════════════════════════════════════════════════════════════════════════ */

export interface MappedInvoiceItem {
  productId?: string
  productName: string
  quantity: number
  unit: InvoiceUnit
  unitLabel?: string
  weightGrams?: number
  unitPrice: number
  discount: number
  totalPrice: number
  notes?: string
  details: {
    title: string
    quantity: number
    amount: number
    unit: InvoiceUnit
    sortOrder: number
  }[]
}

const KNOWN_UNITS: readonly InvoiceUnit[] = [
  'piece',
  'gram',
  'kg',
  'meter',
  'liter',
  'box',
  'pack',
  'carton',
]

/**
 * Turn one grid row into the invoice item the existing API already accepts.
 * See the file header for why each column type lands where it does.
 */
export function rowToInvoiceItem(
  row: InvoiceGridRow,
  columns: readonly InvoiceColumn[],
  ctx: GridMoneyContext,
): MappedInvoiceItem | null {
  const productName = (row.values[COLUMN.description] ?? '').trim()
  if (!productName) return null

  const details: MappedInvoiceItem['details'] = []
  const noteParts: string[] = []
  let sortOrder = 0

  // ─── T8 — what a percent column is worth, in money ────────────────────
  //
  // ⚠️ WITHOUT THIS THE GRID AND THE SERVER DISAGREE.
  //
  // The server totals an item with `computeItemTotal`, which sums
  // `detail.quantity × detail.amount`. A percent column used to be persisted
  // as `{ quantity: 18, amount: 0 }` — eighteen times nothing. So the grid
  // would show the اجرت in the total and the SAVED invoice would not, and the
  // printed document, the ledger and the customer's balance would all carry
  // the lower figure.
  //
  // It is therefore stored as the AMOUNT it came to, on the same base
  // `rowTotal` uses. The percentage stays visible in the title, so the detail
  // still reads «اجرت (۱۸٪)» rather than an unexplained number.
  const percentBase =
    rowQuantity(row) * rowUnitPrice(row, columns, ctx) + rowExtraMoney(row, columns, ctx)

  for (const column of columns) {
    // Built-ins have their own dedicated fields below.
    if (isBuiltinColumn(column.id)) continue

    const raw = row.values[column.id]
    if (!hasCellValue(raw)) continue

    if (column.type === 'text' || column.type === 'date' || column.type === 'select') {
      noteParts.push(`${column.label}: ${raw.trim()}`)
      continue
    }
    if (column.type === 'boolean') {
      noteParts.push(`${column.label}: ${raw.trim()}`)
      continue
    }

    const value = parseCellNumber(raw)
    // A detail's quantity must be positive, so an empty-as-zero cell is
    // simply not persisted — no data is lost, nothing invalid is sent.
    if (value === 0) continue

    const isOwnCurrencyMoney =
      column.type === 'currency' &&
      !isForeignMoneyColumn(column, ctx) &&
      columnCountsInTotal(column)

    // A percent column the user switched into the total — «۱۸٪ اجرت».
    const isCountedPercent = column.type === 'percent' && columnCountsInTotal(column)

    if (isCountedPercent) {
      const surcharge = roundTo((percentBase * value) / 100, ctx.precision)
      details.push({
        // The rate is kept in the label so the detail explains itself. An
        // amount with no rate beside it cannot be checked by the customer or
        // by whoever reads the invoice next year.
        title: `${column.label} (${value}%)`,
        quantity: 1,
        amount: surcharge,
        unit: 'piece',
        sortOrder: sortOrder++,
      })
      continue
    }

    details.push({
      title: column.label,
      // A money component carries its amount; anything else carries its value
      // in `quantity` against a zero amount so the line total is untouched.
      quantity: isOwnCurrencyMoney ? 1 : value,
      amount: isOwnCurrencyMoney ? roundTo(value, ctx.precision) : 0,
      unit: 'piece',
      sortOrder: sortOrder++,
    })
  }

  const unitRaw = row.values[COLUMN.unit]?.trim()
  const unit: InvoiceUnit = unitRaw
    ? (KNOWN_UNITS as readonly string[]).includes(unitRaw)
      ? (unitRaw as InvoiceUnit)
      : 'custom'
    : 'piece'

  const weight = parseCellNumber(row.values[COLUMN.weight])
  const rowNotes = (row.values[COLUMN.notes] ?? '').trim()
  if (rowNotes) noteParts.unshift(rowNotes)
  const notes = noteParts.join(' • ')

  return {
    ...(row.productId ? { productId: row.productId } : {}),
    productName,
    quantity: rowQuantity(row),
    unit,
    ...(unit === 'custom' && unitRaw ? { unitLabel: unitRaw.slice(0, 24) } : {}),
    ...(weight > 0 ? { weightGrams: weight } : {}),
    unitPrice: rowUnitPrice(row, columns, ctx),
    discount: rowDiscountPercent(row),
    totalPrice: rowTotal(row, columns, ctx),
    ...(notes ? { notes: notes.slice(0, 500) } : {}),
    details,
  }
}

export interface GridValidationIssue {
  rowId: string
  /** Catalogue key of the reason. */
  key: string
  fallback: string
}

/**
 * What would stop this draft from being accepted by the server.
 *
 * Mirrors the schema's real constraints (`unitPrice` and `totalPrice` are
 * strictly positive) so the user is told in the builder instead of being
 * bounced by a 400 after confirming.
 */
export function validateGrid(
  rows: readonly InvoiceGridRow[],
  columns: readonly InvoiceColumn[],
  ctx: GridMoneyContext,
): GridValidationIssue[] {
  const issues: GridValidationIssue[] = []

  for (const row of rows) {
    if (!isRowFilled(row)) continue

    if (!isRowSubmittable(row)) {
      issues.push({
        rowId: row.id,
        key: 'invoiceBuilder.errors.descriptionRequired',
        fallback: 'شرح کالا / خدمت الزامی است',
      })
      continue
    }
    if (rowUnitPrice(row, columns, ctx) <= 0) {
      issues.push({
        rowId: row.id,
        key: 'invoiceBuilder.errors.priceRequired',
        fallback: 'قیمت واحد باید بزرگ‌تر از صفر باشد',
      })
      continue
    }
    if (rowTotal(row, columns, ctx) <= 0) {
      issues.push({
        rowId: row.id,
        key: 'invoiceBuilder.errors.totalRequired',
        fallback: 'مبلغ ردیف باید بزرگ‌تر از صفر باشد',
      })
    }
  }

  if (!rows.some(isRowSubmittable)) {
    issues.push({
      rowId: '',
      key: 'invoiceBuilder.errors.noItems',
      fallback: 'حداقل یک ردیف لازم است',
    })
  }

  return issues
}
