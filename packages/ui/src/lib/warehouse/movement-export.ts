// ============================================
// packages/ui/src/lib/warehouse/movement-export.ts
//
// ONE reading of a stock movement: the type word, the direction word, the
// warehouse it touched, and the lines a file draws from it. The table on the
// product page and its Excel/Markdown exports both call this, so a purchase
// can never be filed as a sale in the file while the screen says otherwise.
// ============================================

import type { StockMovementRecord } from '@hisabche/api'
import { markdownTable, toIsoDay } from '@hisabche/formatting'

import { evidenceSourceLabel } from '../evidence-labels'

type T = (key: string, fallback?: string) => string

/** Movement types the screen has a word for. Anything else is shown as sent. */
export const MOVEMENT_TYPES = [
  'sale',
  'purchase',
  'production',
  'transfer',
  'adjustment',
  'opening',
] as const

export function movementTypeWord(type: string, t: T): string {
  return (MOVEMENT_TYPES as readonly string[]).includes(type)
    ? t(`warehouse.movementType.${type}`, type)
    : type
}

/**
 * Which way it went, in a word — never by colour alone.
 *
 * A transfer between two warehouses neither adds nor removes stock: one side
 * loses what the other gains, so it reads «جابه‌جایی», never «افزایش».
 */
export function movementDirectionWord(quantity: number, t: T, isTransfer = false): string {
  if (isTransfer) return t('warehouse.movementMoved', 'جابه‌جایی')
  return quantity < 0 ? t('warehouse.movementOut', 'کاهش') : t('warehouse.movementIn', 'افزایش')
}

/** from ← to (a transfer reads that way), or whichever side exists. */
export function movementPlace(
  movement: StockMovementRecord,
  warehouseNames: Map<string, string>,
): string | null {
  const from = movement.fromWarehouseId ? warehouseNames.get(movement.fromWarehouseId) : undefined
  const to = movement.toWarehouseId ? warehouseNames.get(movement.toWarehouseId) : undefined
  if (from && to) return `${from} ← ${to}`
  return to ?? from ?? null
}

/** Where a movement came from, for a file: the note, or the document's kind. */
function sourceText(movement: StockMovementRecord, t: T): string {
  if (movement.notes) return movement.notes
  if (movement.referenceType) return evidenceSourceLabel(t, movement.referenceType)
  return '—'
}

export interface MovementExportTable {
  headers: string[]
  rows: Array<Array<string | number>>
}

/**
 * The movements as a plain table.
 *
 * Dates are written in the reader's own calendar (Jalali included); quantities
 * stay NUMBERS — an export is opened to be summed, and a localized string
 * could not be. A part that does not exist is «—», never zero.
 */
export function movementExportTable(
  movements: readonly StockMovementRecord[],
  ctx: { t: T; dateTime: (iso: string) => string; warehouseNames: Map<string, string> },
): MovementExportTable {
  const headers = [
    ctx.t('common.date', 'تاریخ'),
    ctx.t('common.type', 'نوع'),
    ctx.t('warehouse.direction', 'جهت'),
    ctx.t('warehouse.warehouseName', 'انبار'),
    ctx.t('warehouse.change', 'تغییر'),
    ctx.t('warehouse.balance', 'مانده'),
    ctx.t('warehouse.source', 'مبدأ'),
  ]
  const rows = movements.map((movement) => [
    movement.createdAt ? ctx.dateTime(movement.createdAt) : '—',
    movementTypeWord(movement.type, ctx.t),
    movementDirectionWord(movement.quantity, ctx.t, movement.isTransfer),
    movementPlace(movement, ctx.warehouseNames) ?? '—',
    movement.quantity,
    movement.balance,
    sourceText(movement, ctx.t),
  ])
  return { headers, rows }
}

/** The rows as records keyed by their own header — the shape `buildXlsx` reads. */
export function movementExportRecords(
  table: MovementExportTable,
): Array<Record<string, string | number>> {
  return table.rows.map((row) =>
    Object.fromEntries(table.headers.map((header, index) => [header, row[index]!])),
  )
}

/**
 * The movements as one Markdown document: the title, the table, and — when
 * the history the server returned does not add up to the stored quantity —
 * the same warning the table carries on screen, because a file must not read
 * as the whole story either.
 */
export function movementExportMarkdown(
  table: MovementExportTable,
  meta: { title: string; productName: string; warning: string },
): string {
  const lines = [`# ${meta.title}${meta.productName ? ` — ${meta.productName}` : ''}`, '']
  lines.push(markdownTable(table.headers, table.rows))
  if (meta.warning) lines.push('', `> ⚠️ ${meta.warning}`)
  return lines.join('\n') + '\n'
}

/** `<product>-movements-2026-10-17` — a name that survives a download folder. */
export function movementExportFilename(productName: string, today: Date): string {
  const base = productName
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .trim()
    .slice(0, 60)
  return `${base || 'stock'}-movements-${toIsoDay(today)}`
}
