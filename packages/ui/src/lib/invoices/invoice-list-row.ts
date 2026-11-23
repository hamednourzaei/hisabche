// ============================================
// packages/ui/src/lib/invoices/invoice-list-row.ts
//
// ONE row model for the invoice-management table.
//
// /invoices shows four document kinds: sale, purchase, pre-sale and
// pre-purchase. The first two live in `invoices`; the last two are advances
// (`order_deposits` with `source_type = pre_sale | pre_purchase`). They have
// different fields, but the user manages them in one table, so the table reads
// one row shape and branches only where the kinds genuinely differ.
//
// ⚠️ This is a READ ADAPTER, not a second business engine. Every figure and
// every state on a row comes from the service that owns it (`InvoiceService`
// or `OrderDepositService`); nothing is recomputed here.
//
// ⚠️ The three page filters are groups, not document types:
//
//   all       every document (invoices + advances)
//   trading   sale + purchase
//   advances  pre-sale + pre-purchase
//
// The old five-value `?type=` links keep working: `sale`/`purchase` open the
// trading group, `pre_sale`/`pre_purchase` open the advances group narrowed to
// that one kind. `filterFromLegacyType` is the only place that mapping lives.
// ============================================

import type { CustomerDepositRecord } from '@hisabche/api'
import type { Invoice } from './invoices-types'

export type AdvanceKind = 'pre_sale' | 'pre_purchase'
export type InvoicePageFilter = 'all' | 'trading' | 'advances'
export type DocumentKind = 'sale' | 'purchase' | AdvanceKind

export type InvoiceListRow =
  | {
      readonly rowType: 'invoice'
      readonly id: string
      readonly kind: 'sale' | 'purchase'
      readonly invoice: Invoice
    }
  | {
      readonly rowType: 'advance'
      readonly id: string
      readonly kind: AdvanceKind
      readonly advance: CustomerDepositRecord
      /** The party's name, resolved by the container. `null` = not readable. */
      readonly partyName: string | null
    }

/** The advance half of the shared row model. */
export type AdvanceListRow = Extract<InvoiceListRow, { rowType: 'advance' }>

export function invoiceRows(invoices: readonly Invoice[]): InvoiceListRow[] {
  return invoices.map((invoice) => ({
    rowType: 'invoice',
    id: invoice.id,
    // The list endpoint only stores sale/purchase. An unexpected legacy value
    // is read as a sale rather than dropped from the table.
    kind: invoice.type === 'purchase' ? 'purchase' : 'sale',
    invoice,
  }))
}

export function advanceRows(
  records: readonly CustomerDepositRecord[],
  nameById: ReadonlyMap<string, string>,
): InvoiceListRow[] {
  const rows: InvoiceListRow[] = []
  for (const advance of records) {
    const kind: AdvanceKind | null =
      advance.sourceType === 'pre_purchase'
        ? 'pre_purchase'
        : advance.sourceType === 'pre_sale'
          ? 'pre_sale'
          : null
    // Only real advance documents belong in this table. A device row that
    // predates the column cannot say what it is, so it is not guessed.
    if (!kind) continue
    const partyId = advance.customerId ?? advance.supplierId ?? null
    rows.push({
      rowType: 'advance',
      id: advance.id,
      kind,
      advance,
      partyName: partyId ? (nameById.get(partyId) ?? null) : null,
    })
  }
  return rows
}

/**
 * The page filter an old `/invoices?type=…` link asks for.
 * `advanceKinds` is empty unless the link names one advance kind, in which
 * case the advances group opens narrowed to it.
 */
export function filterFromLegacyType(type: string | null | undefined): {
  filter: InvoicePageFilter
  advanceKinds: readonly AdvanceKind[]
} {
  if (type === 'sale' || type === 'purchase') {
    return { filter: 'trading', advanceKinds: [] }
  }
  if (type === 'pre_sale' || type === 'pre_purchase') {
    return { filter: 'advances', advanceKinds: [type] }
  }
  if (type === 'advances') return { filter: 'advances', advanceKinds: [] }
  return { filter: 'all', advanceKinds: [] }
}

/** The `?type=` value a page filter writes back, or `null` for «همه». */
export function legacyTypeFor(filter: InvoicePageFilter): string | null {
  if (filter === 'trading') return 'sale'
  if (filter === 'advances') return 'advances'
  return null
}

/** Case-insensitive match over the facts an advance actually has. */
export function advanceMatchesSearch(row: InvoiceListRow, query: string): boolean {
  if (row.rowType !== 'advance') return true
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const advance = row.advance
  const haystack = [
    row.partyName ?? '',
    advance.note ?? '',
    advance.id,
    ...(advance.document?.lines.map((line) => line.name) ?? []),
    ...(advance.document?.notes ? [advance.document.notes] : []),
  ]
  return haystack.some((value) => value.toLowerCase().includes(needle))
}

/** The deposit states an advance can be filtered by — the same six the server answers. */
export const ADVANCE_STATUS_FILTERS = [
  'pending_posting',
  'posting_unknown',
  'available',
  'partially_used',
  'fully_used',
] as const

export type AdvanceStatusFilter = 'all' | (typeof ADVANCE_STATUS_FILTERS)[number]

export function advanceStatusMatches(
  advance: CustomerDepositRecord,
  status: AdvanceStatusFilter,
): boolean {
  return status === 'all' || advance.status === status
}
